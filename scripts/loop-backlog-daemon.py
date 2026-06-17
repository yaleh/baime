#!/usr/bin/env python3
"""
loop-backlog-daemon: polls backlog tasks dir and emits task-ready events to stdout.

Emits one line per Ready transition: "task-ready:TASK-N"
Stops when parent process dies or stop-sentinel file appears.
"""

import argparse
import atexit
import os
import sys
import time


def parse_task_id(filename):
    """Extract TASK-N from a filename like 'task-5 - some title.md'."""
    base = os.path.splitext(os.path.basename(filename))[0]
    # normalise to uppercase for consistent matching
    upper = base.upper()
    for part in upper.split():
        if part.startswith("TASK-") and part[5:].isdigit():
            return "TASK-" + part[5:]
    return None


def is_ready(filepath):
    """Return True if the task file contains 'status: Ready' (case-insensitive)."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                stripped = line.strip().lower()
                if stripped == "status: ready" or stripped.startswith("status: ready"):
                    return True
    except OSError:
        pass
    return False


def scan_ready_ids(tasks_dir):
    """Return set of TASK-N ids that are currently Ready."""
    ready = set()
    try:
        entries = os.listdir(tasks_dir)
    except OSError:
        return ready
    for entry in entries:
        if not entry.endswith(".md"):
            continue
        task_id = parse_task_id(entry)
        if task_id is None:
            continue
        fpath = os.path.join(tasks_dir, entry)
        if is_ready(fpath):
            ready.add(task_id)
    return ready


def main():
    parser = argparse.ArgumentParser(
        description="Poll backlog tasks directory and emit task-ready events."
    )
    parser.add_argument(
        "--tasks-dir",
        default=".backlog/tasks",
        help="Directory containing task markdown files (default: .backlog/tasks)",
    )
    parser.add_argument(
        "--pid-file",
        default=".backlog/.daemon.pid",
        help="Path to write the daemon PID (default: .backlog/.daemon.pid)",
    )
    parser.add_argument(
        "--stop-file",
        default=".backlog/.loop-stop",
        help="Sentinel file whose presence causes daemon to exit (default: .backlog/.loop-stop)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=0.5,
        help="Poll interval in seconds (default: 0.5)",
    )
    args = parser.parse_args()

    # Write PID file; register removal on exit
    pid_file = args.pid_file
    pid_dir = os.path.dirname(pid_file)
    if pid_dir:
        os.makedirs(pid_dir, exist_ok=True)
    with open(pid_file, "w") as f:
        f.write(str(os.getpid()))

    def remove_pid():
        try:
            os.remove(pid_file)
        except OSError:
            pass

    atexit.register(remove_pid)

    parent_pid = os.getppid()
    notified = set()  # task IDs that have been emitted while continuously Ready

    while True:
        # Check stop sentinel
        if os.path.exists(args.stop_file):
            break

        # Check parent liveness
        try:
            os.kill(parent_pid, 0)
        except OSError:
            break

        ready_ids = scan_ready_ids(args.tasks_dir)

        # Purge IDs that are no longer Ready (allows re-emission on next transition)
        no_longer_ready = notified - ready_ids
        notified -= no_longer_ready

        # Emit newly-ready IDs
        for task_id in sorted(ready_ids - notified):
            sys.stdout.write("task-ready:{}\n".format(task_id))
            sys.stdout.flush()
            notified.add(task_id)

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
