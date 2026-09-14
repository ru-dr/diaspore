#!/usr/bin/env python3
"""Fail when two documents disagree.

Every inconsistency these documents have had came from one cause: a fact
stated in more than one file, then changed in one of them. Prose cannot be
generated from a single source, so the duplication is checked instead.

Each rule below exists because that exact drift happened. Deleting a rule is
allowed; doing it silently is how the drift comes back.

    python3 scripts/check_docs.py
"""

from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = {p.relative_to(ROOT).as_posix(): p.read_text() for p in sorted(ROOT.rglob("*.md"))
        if ".git" not in p.parts}

# Facts are checked against whitespace-normalised text. A claim that wraps
# differently in two files is the same claim, and a checker that reports it is
# a checker people learn to ignore.
FLAT = {name: " ".join(text.split()) for name, text in DOCS.items()}

# naming.md is a naming reference and structure.md is a layout map, so
# identifiers and paths belong in those two and nowhere else.
REFERENCE = {"docs/naming.md", "docs/structure.md"}
# plan.md is a schedule and keeps its per-file task lists.
SCHEDULE = {"docs/plan.md"}

failures: list[str] = []


def fail(rule: str, detail: str) -> None:
    failures.append(f"{rule}\n    {detail}")


def files(*names: str) -> dict[str, str]:
    return {n: DOCS[n] for n in names if n in DOCS}


# --------------------------------------------------------------- shared facts

def same_everywhere(rule: str, pattern: str, where: list[str]) -> None:
    """The same claim, extracted from each file, must come out identical."""
    seen: dict[str, str] = {}
    for name in where:
        found = [m.group(0) for m in re.finditer(pattern, FLAT.get(name, ""), re.I)]
        if not found:
            fail(rule, f"{name} no longer states it at all")
            continue
        seen[name] = "|".join(" ".join(f.split()) for f in found)
    if len(set(seen.values())) > 1:
        for name, value in seen.items():
            fail(rule, f"{name}: {value[:110]}")


def nowhere(rule: str, pattern: str, exempt: set[str] = frozenset()) -> None:
    """A phrase that was wrong once and must not come back."""
    for name, text in DOCS.items():
        if name in exempt:
            continue
        for m in re.finditer(pattern, text, re.I):
            line = text[:m.start()].count("\n") + 1
            fail(rule, f"{name}:{line}  {m.group(0)[:90]}")


def present(rule: str, where: list[str], *any_of: str) -> None:
    """A decision several documents depend on has to appear in each of them.

    Several spellings are accepted on purpose: the rule is about the claim
    being made, not about the sentence it is made in.
    """
    for name in where:
        text = FLAT.get(name, "").lower()
        if not any(p.lower() in text for p in any_of):
            fail(rule, f"{name} states none of: {', '.join(any_of)}")


def numbers_match(rule: str, pattern: str, where: list[str]) -> None:
    """Compare the numbers a claim carries, not the prose carrying them."""
    seen = {}
    for name in where:
        m = re.search(pattern, FLAT.get(name, ""), re.I)
        if not m:
            fail(rule, f"{name} no longer states it at all")
            continue
        seen[name] = tuple(re.findall(r"\d+", m.group(0)))
    if len(set(seen.values())) > 1:
        for name, value in seen.items():
            fail(rule, f"{name}: {', '.join(value)}")


# The fault model: four core, two additive. It drifted to "six" three times.
same_everywhere(
    "fault model: core/additive split must match",
    r"floor of (\w+) and a ceiling of (\w+)",
    ["docs/overview.md", "docs/technical.md"],
)
nowhere("fault model: no flat claim of six faults", r"\bsix faults\b|all six present")

# Cluster sizes for axis 1, stated in the overview and the plan.
numbers_match(
    "axis 1: cluster sizes must match",
    r"3, 10, 25, 50, 100[, ]+(?:and )?200",
    ["docs/overview.md", "docs/plan.md"],
)
numbers_match(
    "axis 3: hardware sizes must match",
    r"\b3, 5,? and 8\b",
    ["docs/overview.md", "docs/plan.md"],
)

# The staleness bound. Invariant 2 was unverifiable for two rounds because no
# document stated one.
present("invariant 2: quorum bound is zero",
        ["docs/overview.md", "docs/technical.md"],
        "bound is zero", "bound is **zero**")
present("invariant 2: followers are unbounded and measured",
        ["docs/overview.md", "docs/technical.md", "docs/design.md"],
        "no bound", "unbounded")
present("invariant 2: monotonic reads asserted instead",
        ["docs/overview.md", "docs/technical.md", "docs/design.md"],
        "monotonic")

# Invariant 3 is convergence. Ownership cannot be violated with a static
# primary, so a checker written for it would find nothing.
nowhere("invariant 3: ownership is not checkable here",
        r"concurrently owned|ownership\.go")
present("invariant 3: convergence once traffic has settled",
        ["docs/overview.md", "docs/technical.md", "docs/design.md"],
        "quiescence", "everything has settled")

# An acknowledged write means a reply to a client, not a peer ack.
present("invariant 1: acknowledgement is a reply to a client",
        ["docs/overview.md", "docs/technical.md", "docs/design.md"],
        "reply to a client", "reply sent to a client", "client replies")

# No leases: a lease implies reassignment, and there is no election.
nowhere("no leases: reassignment is excluded by design",
        r"lease expiry|logical clocks, leases")
present("primary death has a stated consequence",
        ["docs/overview.md", "docs/technical.md", "docs/design.md"],
        "writes stop")

# The determinism guard. Dating it by counting weeks put it one week late.
nowhere("determinism guard: name the week, do not count it", r"from week (five|four|three)")
present("determinism guard: bytes, not structures",
        ["README.md", "docs/overview.md", "docs/technical.md"],
        "byte for byte", "bytes rather than", "byte-diff")

# The cut order has one owner. Others may point at it; reprinting it drifts.
if "docs/plan.md" in DOCS:
    order = re.findall(r"(?m)^\d\. (.{0,40})", DOCS["docs/plan.md"])
    if len(order) < 5:
        fail("cut order: plan.md must still hold all five", f"found {len(order)}")
for name, text in DOCS.items():
    if name in SCHEDULE:
        continue
    if re.search(r"watch.{0,60}then real mode.{0,60}then quorum", " ".join(text.split()), re.I):
        fail("cut order: only plan.md enumerates it", f"{name} reprints the list")

# Floci: CI cannot run the infra path before the Terraform exists.
nowhere("floci: infra job cannot predate the Terraform",
        r"CI runs the infrastructure path against Floci, so")
present("floci: endpoint is the same everywhere",
        ["docs/overview.md", "docs/technical.md"],
        "localhost:4566")

# The project name. It has changed once already.
nowhere("project name: genet is gone", r"\bgenet\b")
nowhere("layout: the sim/ package was renamed to capitulum/",
        r"\bsim/", exempt={"docs/structure.md"})


# ------------------------------------------------- design docs stay prose

SIGNATURE = re.compile(r"`[A-Za-z_][\w.]*\([^`)]*\)[^`]*`")
STRUCT_LIT = re.compile(r"\{[A-Z]\w+(?:,| [A-Z])")
GO_FILE = re.compile(r"\b[\w./]+\.go\b")
PKG_PATH = re.compile(r"`(core|capitulum|real|pappus|dandelion|check|cmd|infra|deploy|scripts)/[\w/]*`")

for name, text in DOCS.items():
    if name in REFERENCE or name in SCHEDULE:
        continue
    for label, pat in (("a call signature", SIGNATURE), ("a struct literal", STRUCT_LIT),
                       ("a .go file", GO_FILE), ("a package path", PKG_PATH)):
        for m in pat.finditer(text):
            line = text[:m.start()].count("\n") + 1
            fail(f"design docs state decisions, not code: {label}",
                 f"{name}:{line}  {m.group(0)[:70]}")

# Documents describe the design, not their own editing history.
nowhere("no drafting history: a reader cannot check it",
        r"an earlier (draft|version)|used to (say|ask)|for a long time",
        exempt={"docs/structure.md"})


# ------------------------------------------------------ links and anchors

def slugs(text: str) -> set[str]:
    return {re.sub(r"[^a-z0-9 -]", "", h.lower()).replace(" ", "-")
            for h in re.findall(r"(?m)^#+ (.+)$", text)}

for name, text in DOCS.items():
    here = ROOT / name
    for label, target in re.findall(r"\[([^\]]+)\]\(([^)][^)]*)\)", text):
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        if target.startswith("#"):
            if target[1:] not in slugs(text):
                fail("link: anchor does not exist", f"{name} -> {target}")
        elif not (here.parent / target).exists():
            fail("link: file does not exist", f"{name} -> {target}")


# ------------------------------------------------------------------ report

if failures:
    print(f"{len(failures)} problem(s):\n", file=sys.stderr)
    for f in failures:
        print(f"  {f}\n", file=sys.stderr)
    sys.exit(1)

print(f"{len(DOCS)} documents agree with each other.")
