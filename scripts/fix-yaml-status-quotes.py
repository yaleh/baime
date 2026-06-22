#!/usr/bin/env python3
"""Fix unquoted YAML status values in backlog task files.

Changes:
  status: Basic: Done     ->  status: "Basic: Done"
  status: Epic: Proposal  ->  status: "Epic: Proposal"

Idempotent: already-quoted values are left unchanged.
"""
import re
import sys
from pathlib import Path

TASKS_DIR = Path("backlog/tasks")
fixed = 0
skipped = 0

def fix_status_line(line):
    """Quote status value if it contains ': ' and isn't already quoted."""
    m = re.match(r'^(status:\s*)(.+)$', line)
    if not m:
        return line
    prefix, value = m.group(1), m.group(2)
    # Already quoted
    if value.startswith('"') and value.endswith('"'):
        return line
    # Needs quoting (contains ': ' which YAML would misparse)
    if ': ' in value:
        return f'{prefix}"{value}"\n'
    return line

for filepath in sorted(TASKS_DIR.glob("*.md")):
    content = filepath.read_text()
    lines = content.splitlines(keepends=True)
    new_lines = []
    changed = False
    in_frontmatter = False
    fm_count = 0

    for line in lines:
        if line.strip() == '---':
            fm_count += 1
            in_frontmatter = (fm_count == 1)
            new_lines.append(line)
            if fm_count == 2:
                in_frontmatter = False
            continue

        if in_frontmatter and line.startswith('status:'):
            fixed_line = fix_status_line(line.rstrip('\n'))
            if not fixed_line.endswith('\n'):
                fixed_line += '\n'
            if fixed_line != line:
                changed = True
            new_lines.append(fixed_line)
        else:
            new_lines.append(line)

    if changed:
        filepath.write_text(''.join(new_lines))
        print(f"fixed: {filepath.name}")
        fixed += 1
    else:
        skipped += 1

print(f"\nDone: {fixed} files fixed, {skipped} files unchanged.")
