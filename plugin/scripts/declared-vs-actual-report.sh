#!/usr/bin/env bash
# declared-vs-actual-report.sh — Cross-task declared-vs-actual file scope deviation report
# Usage: bash scripts/declared-vs-actual-report.sh [tasks_dir]
#
# Scans all backlog/tasks/*.md files, extracts ## Gate Evidence Pack sections,
# and produces a cross-task aggregation report of declared-vs-actual file scope
# deviation (GCL 3rd-class observation signal).
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    cat <<'USAGE'
Usage: bash scripts/declared-vs-actual-report.sh [tasks_dir]

Scans all *.md files in tasks_dir (default: backlog/tasks), extracts
## Gate Evidence Pack sections, and prints a cross-task aggregation report
of declared-vs-actual file scope deviation.

Script: declared-vs-actual-report.sh

Fields parsed from Gate Evidence Pack sections:
  FILE_ACTIVITY: <file1>, <file2>, ...   (actual files touched)
  SCOPE_DIFF:    <file1>, <file2>, ...   (files outside declared scope; "none" = empty)

Output sections:
  1. Per-task lines: task-id, actual file count, in-scope count, scope-diff count
  2. Systematic-deviation summary: tasks with drift, most-frequent out-of-scope files

Read-only: writes no files, modifies no jsonl. Exits 0 even with zero digests.
USAGE
    exit 0
fi

TASKS_DIR="${1:-backlog/tasks}"

python3 - "$TASKS_DIR" <<'PYEOF'
import sys
import os
import glob
import re
from collections import Counter
from datetime import datetime, timezone

tasks_dir = sys.argv[1]

# ── Load task files ───────────────────────────────────────────────────────────

pattern = os.path.join(tasks_dir, "*.md")
files = sorted(glob.glob(pattern))

# ── Parse each file ──────────────────────────────────────────────────────────

def parse_list_field(value):
    """Parse a comma-separated field value into a set of non-empty strings.
    'none' or empty → empty set."""
    value = value.strip()
    if not value or value.lower() == "none":
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}

def extract_task_id(filename):
    """Extract task-id from filename like 'task-900 - fixture.md'."""
    base = os.path.basename(filename)
    m = re.match(r"(task-\d+)", base, re.IGNORECASE)
    if m:
        return m.group(1)
    # fallback: use the stem without extension
    return os.path.splitext(base)[0]

def parse_gate_evidence(filepath):
    """Parse FILE_ACTIVITY and SCOPE_DIFF from ## Gate Evidence Pack section.
    Returns (file_activity_set, scope_diff_set) or None if section not found."""
    try:
        with open(filepath, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except OSError:
        return None

    in_section = False
    file_activity = None
    scope_diff = None

    for line in lines:
        stripped = line.strip()
        # Detect section start
        if re.match(r"^##\s+Gate Evidence Pack", stripped):
            in_section = True
            file_activity = None
            scope_diff = None
            continue
        # Detect next heading — end of section
        if in_section and re.match(r"^##\s+", stripped):
            break
        if in_section:
            if stripped.startswith("FILE_ACTIVITY:"):
                file_activity = stripped[len("FILE_ACTIVITY:"):].strip()
            elif stripped.startswith("SCOPE_DIFF:"):
                scope_diff = stripped[len("SCOPE_DIFF:"):].strip()

    if not in_section:
        return None

    fa_set = parse_list_field(file_activity or "")
    sd_set = parse_list_field(scope_diff or "")
    return (fa_set, sd_set)

# ── Aggregate ────────────────────────────────────────────────────────────────

results = []       # list of (task_id, actual_count, in_scope_count, scope_diff_count, scope_diff_set)
no_digest_count = 0
drift_counter = Counter()  # file → number of tasks where it appears in scope_diff

for filepath in files:
    task_id = extract_task_id(filepath)
    parsed = parse_gate_evidence(filepath)
    if parsed is None:
        no_digest_count += 1
        continue
    fa_set, sd_set = parsed
    in_scope_set = fa_set - sd_set
    results.append((task_id, len(fa_set), len(in_scope_set), len(sd_set), sd_set))
    for f in sd_set:
        drift_counter[f] += 1

tasks_with_digest = len(results)
tasks_with_drift = sum(1 for _, _, _, sd_count, _ in results if sd_count > 0)

# ── Print report ─────────────────────────────────────────────────────────────

generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

print("=" * 70)
print("DECLARED-VS-ACTUAL FILE SCOPE DEVIATION REPORT")
print(f"Tasks dir: {tasks_dir}  |  Files scanned: {len(files)}")
print(f"Generated: {generated}")
print("=" * 70)

# Section 1: per-task lines
print()
print("── Section 1: Per-task file scope deviation ────────────────────────────")
print()

if not results:
    print("  No tasks with Gate Evidence Pack found.")
else:
    header = f"  {'task-id':<20} {'actual':>8} {'in-scope':>10} {'scope-diff':>12}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for task_id, actual, in_scope, sd_count, _ in results:
        marker = " *" if sd_count > 0 else ""
        print(f"  {task_id:<20} {actual:>8} {in_scope:>10} {sd_count:>12}{marker}")
    print()
    print("  (* = task has scope drift)")

# Section 2: systematic-deviation summary
print()
print("── Section 2: Systematic-deviation summary ─────────────────────────────")
print()
print(f"  Tasks with Gate Evidence Pack digest: {tasks_with_digest}")
print(f"  Tasks with non-empty scope drift:     {tasks_with_drift}")
print(f"  Tasks without digest (no-digest):     {no_digest_count}")
print()

if drift_counter:
    print("  Most-frequent out-of-scope files (ranked by occurrence across tasks):")
    print()
    print(f"  {'occurrences':>12}  file")
    print("  " + "-" * 50)
    for filename, count in drift_counter.most_common():
        print(f"  {count:>12}  {filename}")
else:
    if tasks_with_digest > 0:
        print("  No out-of-scope files detected across all tasks with digests.")
    else:
        print("  No digest data available — run meta-cc-digest.sh to populate Gate Evidence Pack sections.")

print()
print("=" * 70)
print("End of report")
print("=" * 70)
PYEOF
