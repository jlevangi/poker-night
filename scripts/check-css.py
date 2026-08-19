#!/usr/bin/env python3
"""Fail if any stylesheet is structurally broken.

A Python test suite cannot see CSS, so a run doing frontend work had no gate at
all: an agent wrote a duplicated fragment mid-consolidation -- an orphaned
declaration and an extra `}` that closed a media query early -- and the loop
committed it as a success, because `compileall` had nothing to say about it.

Braces and unclosed comments are not everything that can be wrong with a
stylesheet, but they are the damage an editing agent actually does, and they are
cheap to check.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "static" / "css"

problems = []
for path in sorted(ROOT.rglob("*.css")):
    raw = path.read_text(errors="replace")
    if raw.count("/*") != raw.count("*/"):
        problems.append(f"{path}: unclosed comment")
    text = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)

    depth = 0
    for number, line in enumerate(text.splitlines(), 1):
        for char in line:
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth < 0:
                    problems.append(f"{path}:{number}: unmatched '}}'")
                    depth = 0
    if depth:
        problems.append(f"{path}: {depth} unclosed block(s)")

for problem in problems:
    print(problem)
print(f"checked {len(list(ROOT.rglob('*.css')))} stylesheets, {len(problems)} problem(s)")
sys.exit(1 if problems else 0)
