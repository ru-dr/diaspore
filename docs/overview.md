<div align="center">

# Diaspore

**Seeds for failures.**

Why this is a scalability project, what would count as success, and what is left to build.

[![Go](https://shieldcn.dev/badge/Go-1.27.1-00ADD8.svg?logo=go&logoColor=white)](https://go.dev)
[![Terraform](https://shieldcn.dev/badge/Terraform-AWS-7B42BC.svg?logo=terraform&logoColor=white)](https://www.terraform.io)
[![License](https://shieldcn.dev/badge/license-MIT-black.svg)](../LICENSE)
[![Status](https://shieldcn.dev/badge/status-in_development-orange.svg)](#roadmap)

</div>

---

This file holds the argument and nothing else. What the system is and how it works is in
[`technical.md`](technical.md); why it is built that way is in [`design.md`](design.md). Those
facts are stated once, there, and are not repeated here — a claim in two places is a claim
that can disagree with itself, and this project has spent enough on that already.

---

## Why this is a scalability project

Testing a distributed system is itself a scaling problem. The space of possible executions
grows combinatorially with node count and message count, and the interesting failures live
deep in it. Determinism and virtual time are how that space gets searched faster than real
time permits — which makes the search, not the store being searched, the thing that has to
scale.

Three axes, measured independently.

**1. Scaling the system under test.** The same scenarios run at 3, 10, 25, 50, 100 and 200
florets, measuring convergence time, messages per client write, and violation rate against
cluster size. Virtual time reaches cluster sizes no course-scale hardware budget can fund;
that is the point of having it.

**2. Scaling the search.** Seeds are independent, so the sweep parallelises without
coordination — no shared state, no contention, nothing to synchronise. Scenarios per second
and time to first violation are measured against worker count, and the expectation is a
straight line. A bend in it would itself be a finding.

**3. Validating against hardware.** The simulated growth curve is checked at 3, 5 and 8 real
florets and plotted against the simulated curve, which continues past the point where hardware
becomes uneconomical. The claim being tested is not that the simulation is accurate in
absolute terms — it will not be — but that the shape of the curve is the same.

---

## What success looks like

These three are the result, and none depends on anything in the cut order.

1. A violation found by the sweep replays byte-identically from its seed alone.
2. Violation rate against cluster size is measured beyond the scale reachable on hardware.
3. Sweep throughput is shown to scale with parallelism.

One more, conditional on real mode surviving the schedule:

4. At least one simulated finding is confirmed on a live cluster. This is axis 3, and axis 3
   is the second thing cut if the weeks run short — see the cut order in
   [`plan.md`](plan.md). The simulated half is a complete result without it.

The first is the one to watch. If a sweep finds something and it does not replay, the tool has
found a bug in itself rather than in the system under test, and nothing downstream of that is
worth reporting.

---

## Where the risk actually is

Two risks are worth naming here rather than leaving in the table in [`plan.md`](plan.md),
because both could invalidate a result rather than delay one.

**Determinism leaking out of the core.** One unguarded clock read and replay breaks silently —
silently being the problem. The guard is described in [`design.md`](design.md) and enforced
from the 10/05 week. If it ever goes red, no other number in the project can be trusted until
it is green again.

**Floci's EC2 coverage is partial.** Local emulation is what keeps cloud spend near zero, and
it is sound for validating Terraform syntax and plan output. Do not assume it will boot three
instances running the binary. Confirm what actually works locally before the 11/30 week, and
treat the real-hardware runs as the only evidence for axis 3.

---

## Roadmap

Split the way the cut order splits things, so this is not a promise the schedule already
intends to break. It answers a different question from the cut order in
[`plan.md`](plan.md): that list says what gets dropped first under pressure, this one says
what has to exist for there to be a result at all. The two are not the same partition.

**The project.** Not reducible — without these there is no result.

- [ ] The event model: what a floret consumes and what it emits
- [ ] The pure replication core, primary-backup mode
- [ ] The simulated runtime and its virtual clock
- [ ] Same-seed determinism test in CI
- [ ] Fault controller: crash, crash-restart, drop, partition
- [ ] The portable run manifest
- [ ] Invariant checker
- [ ] Parallel sweep

**Additive.** Each improves the result; each is droppable, in this order from the bottom up.

- [ ] Version vectors — otherwise last-write-wins by timestamp
- [ ] Message delay and reorder faults
- [ ] Quorum mode — one mode demonstrates the idea
- [ ] Terraform environment, real mode on EC2, simulated versus real comparison
- [ ] The live terminal view

Logical clocks are not listed separately because they are recorded alongside each event rather
than being a milestone: the determinism test is ordered by the virtual clock and never waits
on them.

---

## Everything else

| Document | What is in it |
|---|---|
| [`technical.md`](technical.md) | The apparatus: architecture, faults, invariants, deliverables, schedule |
| [`design.md`](design.md) | Why it is built this way, and what is still undecided |
| [`structure.md`](structure.md) | Package layout, import direction, where each fact lives |
| [`naming.md`](naming.md) | Naming reference, including terms deliberately rejected |
| [`plan.md`](plan.md) | Week-by-week schedule, cut order, risk table |
| [`findings.md`](findings.md) | Seeds that broke invariants, and why |
