#!/usr/bin/env bash
# gcl-report.sh — Reproducible GCL analysis from gcl-events.jsonl
# Usage: bash scripts/gcl-report.sh [path/to/gcl-events.jsonl]
set -euo pipefail

JSONL_FILE="${1:-docs/research/gcl-events.jsonl}"

python3 - "$JSONL_FILE" <<'PYEOF'
import sys
import json
import math
from collections import defaultdict
from datetime import datetime, timezone, timedelta

jsonl_file = sys.argv[1]

# Load events
try:
    with open(jsonl_file) as f:
        raw_lines = [l.strip() for l in f if l.strip()]
except FileNotFoundError:
    print(f"File not found: {jsonl_file}")
    sys.exit(1)

if not raw_lines:
    print("No events found.")
    sys.exit(0)

events = []
for line in raw_lines:
    try:
        events.append(json.loads(line))
    except json.JSONDecodeError as e:
        print(f"Warning: skipping malformed line: {e}", file=sys.stderr)

if not events:
    print("No events found.")
    sys.exit(0)

# ── helpers ──────────────────────────────────────────────────────────────────

def mean(xs):
    return sum(xs) / len(xs) if xs else float('nan')

def std(xs):
    if len(xs) < 2:
        return float('nan')
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))

def fmt(v, digits=2):
    if v != v:  # nan
        return "  N/A"
    return f"{v:+.{digits}f}" if digits > 0 else f"{v:.0f}"

def fmt_plain(v, digits=2):
    if v != v:
        return "N/A"
    return f"{v:.{digits}f}"

BASELINE_H = 1.70

# ── Section 1: Stratified E/C/H stats by gate_type × task_kind ───────────────

groups = defaultdict(list)
for ev in events:
    key = (ev.get("gate_type", "?"), ev.get("task_kind", "?"))
    groups[key].append(ev)

print("=" * 70)
print("GCL ANALYSIS REPORT")
print(f"Source: {jsonl_file}  |  Events: {len(events)}")
print(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
print("=" * 70)

print()
print("── Section 1: Stratified E / C / H by gate_type × task_kind ──────────")
print()
header = f"{'gate_type':<12} {'task_kind':<10} {'N':>4}  {'mean_E':>7} {'std_E':>7}  {'mean_C':>7} {'std_C':>7}  {'mean_H':>7} {'std_H':>7}  {'delta_H':>8}"
print(header)
print("-" * len(header))

for key in sorted(groups):
    gate_type, task_kind = key
    evs = groups[key]
    Es = [e["E"] for e in evs if "E" in e]
    Cs = [e["C"] for e in evs if "C" in e]
    Hs = [e["H"] for e in evs if "H" in e]
    mH = mean(Hs)
    delta = mH - BASELINE_H if Hs else float('nan')
    print(
        f"{gate_type:<12} {task_kind:<10} {len(evs):>4}  "
        f"{fmt_plain(mean(Es)):>7} {fmt_plain(std(Es)):>7}  "
        f"{fmt_plain(mean(Cs)):>7} {fmt_plain(std(Cs)):>7}  "
        f"{fmt_plain(mH):>7} {fmt_plain(std(Hs)):>7}  "
        f"{fmt(delta):>8}"
    )

# ── Section 2: delta_H trend (rolling 30-day mean GCL) ───────────────────────

print()
print("── Section 2: Rolling 30-day mean GCL (by calendar month bucket) ──────")
print()

# Parse timestamps; fall back gracefully
def parse_ts(ev):
    ts = ev.get("timestamp", "")
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None

# Build list of (datetime, GCL, H)
timed = []
for ev in events:
    dt = parse_ts(ev)
    gcl = ev.get("GCL")
    h = ev.get("H")
    if dt is not None and gcl is not None:
        timed.append((dt, gcl, h))

timed.sort(key=lambda x: x[0])

if not timed:
    print("  No timestamped GCL data available.")
else:
    # 30-day rolling windows anchored to each unique date in the data
    unique_dates = sorted({t[0].date() for t in timed})
    window = timedelta(days=30)

    print(f"  {'window_end':<12} {'events':>7} {'mean_GCL':>9} {'mean_H':>8} {'delta_H':>9}")
    print("  " + "-" * 50)

    for anchor in unique_dates:
        anchor_dt = datetime(anchor.year, anchor.month, anchor.day, tzinfo=timezone.utc)
        start_dt = anchor_dt - window
        window_evs = [(dt, gcl, h) for dt, gcl, h in timed if start_dt <= dt <= anchor_dt]
        gcls = [gcl for _, gcl, _ in window_evs]
        hs = [h for _, _, h in window_evs if h is not None]
        mH = mean(hs)
        delta = mH - BASELINE_H if hs else float('nan')
        print(
            f"  {str(anchor):<12} {len(window_evs):>7} {fmt_plain(mean(gcls)):>9} "
            f"{fmt_plain(mH):>8} {fmt(delta):>9}"
        )

# ── Section 3: GCL vs escape_rate table ──────────────────────────────────────

print()
print("── Section 3: GCL vs escape_rate ──────────────────────────────────────")
print()

has_escape = [ev for ev in events if ev.get("escape_rate") is not None]
no_escape  = [ev for ev in events if ev.get("escape_rate") is None]

if not has_escape:
    print("  No escape_rate data present in events.")
    print(f"  ({len(no_escape)} events have escape_rate=null or missing)")
else:
    # Group by GCL bucket
    gcl_buckets = defaultdict(list)
    for ev in has_escape:
        gcl = ev.get("GCL")
        er = ev.get("escape_rate")
        if gcl is not None and er is not None:
            bucket = round(gcl)
            gcl_buckets[bucket].append(er)

    print(f"  {'GCL_bucket':>10} {'N':>4} {'mean_escape_rate':>17} {'std_escape_rate':>16}")
    print("  " + "-" * 52)
    for bucket in sorted(gcl_buckets):
        ers = gcl_buckets[bucket]
        print(
            f"  {bucket:>10} {len(ers):>4} {fmt_plain(mean(ers)):>17} {fmt_plain(std(ers)):>16}"
        )

    print()
    print(f"  Events with escape_rate data:    {len(has_escape)}")
    print(f"  Events without escape_rate data: {len(no_escape)}")

print()
print("=" * 70)
print("End of report")
print("=" * 70)
PYEOF
