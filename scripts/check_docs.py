#!/usr/bin/env python3
"""Fail when two documents disagree about the same fact.

Every inconsistency this project has had came from one cause: a fact stated in
more than one file, then changed in one of them. The structural answer is that
each fact has an owner and the others link to it.

Two kinds of duplication need different treatment.

TABLES are enumerated — a table of faults, a list of commands, a roadmap. They
drift silently, because a row changes in one copy and not the other. Each has
exactly one owner and no other document may reproduce it. Where a second copy
is justified, it is listed as an owner and the copies are compared.

CLAIMS are prose — what an acknowledged write is, what the staleness bound is.
Several documents legitimately mention these, so forbidding the word would cry
wolf. What matters is that every document making the claim still makes it.

TABLES and CLAIMS below are the record of where each fact lives. Putting a
fact in a new document means adding it here, or not doing it.

    python3 scripts/check_docs.py
"""

from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = {p.relative_to(ROOT).as_posix(): p.read_text()
       for p in sorted(ROOT.rglob("*.md")) if ".git" not in p.parts}
# Claims match against whitespace-normalised text: a sentence that wraps
# differently in two files is the same sentence, and a check that reports it
# is a check people learn to ignore.
FLAT = {name: " ".join(text.split()) for name, text in RAW.items()}

README, OVERVIEW = "README.md", "docs/overview.md"
TECHNICAL, DESIGN = "docs/technical.md", "docs/design.md"
NAMING, STRUCTURE, PLAN = "docs/naming.md", "docs/structure.md", "docs/plan.md"

# naming.md is a naming reference and structure.md is a layout map, so
# identifiers and paths belong in those two. plan.md is a schedule and keeps
# its per-file task lists.
REFERENCE = {NAMING, STRUCTURE}
SCHEDULE = {PLAN}

# name -> (a pattern that only the real block matches, the files allowed it)
TABLES: dict[str, tuple[str, list[str]]] = {
    "the fault table":  (r"\| Node crash \| Crash failure", [TECHNICAL]),
    "the cli table":    (r"\| `diaspore run --seed", [README, TECHNICAL]),
    "the naming table": (r"\| Capitulum \| The flower head", [NAMING]),
    "the roadmap":      (r"\*\*The project\.\*\* Not reducible", [OVERVIEW]),
    "the cut order":    (r"Cut in this order", [PLAN]),
    "the figure list":  (r"Violation rate per thousand seeds", [TECHNICAL]),
    "the three axes":   (r"\*\*2\. Scaling the search\.\*\*", [OVERVIEW]),
    "success criteria": (r"replays byte-identically from its seed alone", [OVERVIEW]),
    "the topic table":  (r"\| Go, Containers \|", [TECHNICAL]),
    "the schedule":     (r"\| Week of \| Milestone \|", [TECHNICAL]),
    "the import graph": (r"## Import direction", [STRUCTURE]),
    "the deliverables": (r"\*\*Not reducible\.\*\*", [TECHNICAL]),
}

# claim -> (documents that make it, phrases any one of which proves it)
CLAIMS: dict[str, tuple[list[str], list[str]]] = {
    "invariant 1, an acknowledgement is a client reply":
        ([TECHNICAL, DESIGN], ["reply sent to a client", "reply to a client"]),
    "invariant 2, the quorum bound is zero":
        ([TECHNICAL, DESIGN], ["bound is zero", "zero staleness bound"]),
    "invariant 2, followers are unbounded":
        ([TECHNICAL, DESIGN], ["no bound"]),
    "invariant 2, monotonic reads are asserted instead":
        ([TECHNICAL, DESIGN], ["monotonic"]),
    "invariant 2, the zero rests on an open question":
        ([TECHNICAL, DESIGN], ["itself undecided", "could void it"]),
    "invariant 3, settled means the run ended":
        ([TECHNICAL, DESIGN], ["run has ended", "run ending"]),
    "invariant 3, scoped to florets that could communicate":
        ([TECHNICAL, DESIGN], ["reach one another"]),
    "the read path shape is provisional":
        ([DESIGN], ["provisionally"]),
    "the primary never moves, so writes stop":
        ([TECHNICAL, DESIGN], ["writes stop"]),
    "the determinism guard compares bytes":
        ([TECHNICAL, README], ["byte for byte", "bytes rather than"]),
}

failures: list[str] = []


def fail(rule: str, detail: str) -> None:
    failures.append(f"{rule}\n    {detail}")


# --------------------------------------------------------- one owner per table

for table, (marker, owners) in TABLES.items():
    holders = [n for n in RAW if re.search(marker, RAW[n])]
    for name in owners:
        if name not in holders:
            fail(f"{table}: the file that owns it no longer has it", name)
    for name in holders:
        if name not in owners:
            fail(f"{table}: reproduced outside the files that own it",
                 f"{name} has it — link to {owners[0]} instead")

# --------------------------------------------- every holder still makes the claim

for claim, (holders, phrases) in CLAIMS.items():
    for name in holders:
        if not any(p.lower() in FLAT.get(name, "").lower() for p in phrases):
            fail(f"{claim}: a document that makes this claim no longer does",
                 f"{name} contains none of: {', '.join(phrases)}")


def same(rule: str, pattern: str, where: list[str]) -> None:
    """Sanctioned copies must be identical, not merely similar."""
    seen = {}
    for name in where:
        found = [" ".join(m.group(0).split())
                 for m in re.finditer(pattern, FLAT.get(name, ""), re.I)]
        if not found:
            fail(rule, f"{name} no longer states it")
            continue
        seen[name] = "|".join(found)
    if len(set(seen.values())) > 1:
        for name, value in seen.items():
            fail(rule, f"{name}: {value[:110]}")


def numbers(rule: str, pattern: str, where: list[str]) -> None:
    """Compare the numbers a claim carries, not the prose carrying them."""
    seen = {}
    for name in where:
        m = re.search(pattern, FLAT.get(name, ""), re.I)
        if not m:
            fail(rule, f"{name} no longer states it")
            continue
        seen[name] = tuple(re.findall(r"\d+", m.group(0)))
    if len(set(seen.values())) > 1:
        for name, value in seen.items():
            fail(rule, f"{name}: {', '.join(value)}")


def nowhere(rule: str, pattern: str, exempt: set[str] = frozenset()) -> None:
    """A claim that was wrong once and must not come back."""
    for name, text in RAW.items():
        if name in exempt:
            continue
        for m in re.finditer(pattern, text, re.I):
            fail(rule, f"{name}:{text[:m.start()].count(chr(10)) + 1}  {m.group(0)[:90]}")


# The two sanctioned copies, compared row for row.
same("cli table: README and technical.md must match",
     r"\| `diaspore [^|]+\| [^|]+ \|", [README, TECHNICAL])
# technical.md restates the five terms as prose for a reader who will not
# open the reference. The terms themselves must still be the same five.
for _term in ("Diaspore", "Capitulum", "Floret", "Pappus", "Dandelion"):
    for _doc in (NAMING, TECHNICAL):
        if _term.lower() not in FLAT.get(_doc, "").lower():
            fail("the five names must be the same five everywhere",
                 f"{_doc} does not mention {_term}")

# The overview owns the axes; the plan schedules the same runs.
numbers("axis 1 cluster sizes", r"3, 10, 25, 50, 100[, ]+(?:and )?200", [OVERVIEW, PLAN])
numbers("axis 3 hardware sizes", r"\b3, 5,? and 8\b", [OVERVIEW, PLAN])


# ------------------------------------------------ claims that were wrong once

nowhere("fault model: no flat claim of six faults", r"\bsix faults\b|all six present")
nowhere("invariant 3: ownership is unviolatable here", r"concurrently owned|ownership\.go")
nowhere("invariant 3: settled is not delivered-or-dropped",
        r"(?:once|after) (?:everything|every message)[^.]{0,60}delivered or dropped")
nowhere("no leases: reassignment is excluded", r"lease expiry|logical clocks, leases")
nowhere("determinism guard: name the week, do not count it", r"from week (five|four|three)")
nowhere("floci: the infra job cannot predate the Terraform",
        r"CI runs the infrastructure path against Floci, so")
nowhere("cli: verify checks three invariants, not two",
        r"Check a trace for lost writes and stale reads")
nowhere("constructor: a run needs mode and profile", r"capitulum\.New\(n int, seed")
nowhere("figures: plot.py reads what the sweep emits", r"Trace CSV")
nowhere("project name: genet is gone", r"\bgenet\b")
nowhere("layout: sim/ was renamed capitulum/", r"\bsim/", exempt={STRUCTURE})
nowhere("no drafting history: a reader cannot check it",
        r"an earlier (draft|version)|used to (say|ask)|for a long time", exempt={STRUCTURE})

# The freeze cannot commit to messages the read path may not need.
if "coordinator or simply answers" in FLAT.get(DESIGN, "") \
        and not re.search(r"`Read` and `ReadReply`, \*\*if\*\*", RAW.get(PLAN, "")):
    fail("freeze: read messages are contingent while the read path is open",
         "plan.md 09/21 commits to them unconditionally")


# ----------------------------------------------- design docs stay prose

PATTERNS = {
    "a call signature": re.compile(r"`[A-Za-z_][\w.]*\([^`)]*\)[^`]*`"),
    "a struct literal": re.compile(r"\{[A-Z]\w+(?:,| [A-Z])"),
    "a .go file": re.compile(r"\b[\w./]+\.go\b"),
    "a package path": re.compile(
        r"`(core|capitulum|real|pappus|dandelion|check|cmd|infra|deploy|scripts)/[\w/]*`"),
}
for name, text in RAW.items():
    if name in REFERENCE or name in SCHEDULE:
        continue
    for label, pat in PATTERNS.items():
        for m in pat.finditer(text):
            fail(f"design docs state decisions, not code: {label}",
                 f"{name}:{text[:m.start()].count(chr(10)) + 1}  {m.group(0)[:70]}")


# ------------------------------------------------------- links and anchors

def slugs(text: str) -> set[str]:
    return {re.sub(r"[^a-z0-9 -]", "", h.lower()).replace(" ", "-")
            for h in re.findall(r"(?m)^#+ (.+)$", text)}

for name, text in RAW.items():
    for _, target in re.findall(r"\[([^\]]+)\]\(([^)][^)]*)\)", text):
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        if target.startswith("#"):
            if target[1:] not in slugs(text):
                fail("link: anchor does not exist", f"{name} -> {target}")
            continue
        path, _, anchor = target.partition("#")
        dest = (ROOT / name).parent.joinpath(path)
        if not dest.exists():
            fail("link: file does not exist", f"{name} -> {target}")
        elif anchor and anchor not in slugs(dest.read_text()):
            fail("link: anchor does not exist in the target file", f"{name} -> {target}")


if failures:
    print(f"{len(failures)} problem(s):\n", file=sys.stderr)
    for f in failures:
        print(f"  {f}\n", file=sys.stderr)
    sys.exit(1)

print(f"{len(RAW)} documents · {len(TABLES)} owned tables · {len(CLAIMS)} tracked claims · no disagreement")
