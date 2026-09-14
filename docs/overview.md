<div align="center">

# Diaspore

**Seeds for failures.**

Deterministic replay and scalable failure search for replicated systems.

[![Go](https://shieldcn.dev/badge/Go-1.27.1-00ADD8.svg?logo=go&logoColor=white)](https://go.dev)
[![Terraform](https://shieldcn.dev/badge/Terraform-AWS-7B42BC.svg?logo=terraform&logoColor=white)](https://www.terraform.io)
[![CI](https://shieldcn.dev/github/ru-dr/diaspore/ci.svg?label=build)](https://github.com/ru-dr/diaspore/actions)
[![License](https://shieldcn.dev/badge/license-MIT-black.svg)](../LICENSE)
[![Status](https://shieldcn.dev/badge/status-in_development-orange.svg)](#roadmap)

[Why](#why) · [How it works](#how-it-works) · [Why this is a scalability project](#why-this-is-a-scalability-project) · [Quick start](#quick-start) · [CLI](#cli) · [Architecture](#architecture) · [Faults](#faults-injected) · [Roadmap](#roadmap)

</div>

---

## Why

Distributed systems fail on timing. Which message arrived first, when a node died, how long a
packet sat in a queue. That timing differs on every run.

So a test suite passes a hundred times, fails once, and passes again — leaving no way to tell
whether the defect was fixed or merely avoided.

The randomness causing that is scattered everywhere: the OS scheduler, the network, the clock,
goroutines interleaving. Diaspore pulls all of it into one place and drives it from a single
seed.

Same seed, same execution, every time. A bug stops being an anecdote and becomes an address.

---

## How it works

The replication logic is a **pure state machine**. It imports nothing that can read a clock,
sleep, generate randomness, or touch the network. Everything it does is expressed as
`Step(event) -> []Message`.

That one constraint lets the same code run two ways.

**Simulated** — a single goroutine driving a priority queue of events against a virtual clock.
Time advances only when the queue advances, so a thirty-second scenario executes in
milliseconds. The only randomness source is seeded.

Client load is part of that. In simulation nothing outside the seeded controller may generate
a request: `capitulum/workload.go` expands a workload profile into `ClientWrite` and
`ClientRead` events on the virtual clock, drawing from the one seeded source. A load generator
with its own clock or its own randomness would be a determinism leak in the least affordable
place, so there is not one. The profile is stored in the `.pappus` manifest, because a run
that cannot be rebuilt from the manifest is not reproducible.

**Real** — a goroutine per floret, TCP transport with framing and timeouts, real timers, and an
HTTP key-value API. `cmd/loadgen` replays the same profile over HTTP here, where a real clock
is the point. Faults are injected in-process through admin endpoints rather than by
manipulating the network, which keeps injected partitions deterministic and repeatable.

So you hunt bugs in simulation, then check whether the real world agrees.

---

## Why this is a scalability project

Testing a distributed system is itself a scaling problem. The space of possible executions
grows combinatorially with node count and message count. Determinism and virtual time are how
that space gets searched faster than real time permits.

Three axes, measured independently.

**1. Scaling the system under test.** The same scenarios run at 3, 10, 25, 50, 100 and 200
florets, measuring convergence time, messages per client write, and violation rate against
cluster size. Virtual time reaches cluster sizes no course-scale hardware budget can fund.

**2. Scaling the search.** Seeds are independent, so the sweep parallelises without
coordination. Scenarios per second and time to first violation are measured against worker
count.

**3. Validating against hardware.** The simulated growth curve is checked at 3, 5 and 8 real
florets and plotted against the simulated curve, which continues past the point where hardware
becomes uneconomical.

---

## What success looks like

These three are the result, and none of them depends on anything in the cut list.

1. A violation found by the sweep replays byte-identically from its seed alone.
2. Violation rate against cluster size is measured beyond the scale reachable on hardware.
3. Sweep throughput is shown to scale with parallelism.

One more, conditional on real mode surviving the schedule:

4. At least one simulated finding is confirmed on a live cluster. This is axis 3, and axis 3 is
   the second thing cut if the weeks run short — see the cut order in
   [`plan.md`](plan.md). The simulated half is a complete result without it.

---

## System under test

Deliberately modest, because it is apparatus rather than contribution: an in-memory replicated
key-value store with two replication modes.

**Quorum.** A write is acknowledged after a majority of florets have stored it.

**Primary-backup.** A statically assigned primary acknowledges immediately and replicates
asynchronously.

Both exist because they produce distinct failure classes. Comparing their latency is not an
objective of the project.

There is no leader election, no disk persistence, and no gRPC. Each omission removes a failure
mode that would consume time without advancing the question.

---

## Quick start

```bash
git clone https://github.com/ru-dr/diaspore
cd diaspore
go build ./cmd/diaspore
./diaspore run --seed 8837421 --faults crash,partition,delay
./diaspore dandelion --seeds 1000
```

`dandelion` scatters a thousand seeded runs and reports the ones that broke an invariant. Named
for what it does — one source, a thousand landings, and you find out which ones took root badly.

---

## CLI

| Command | What it does |
|---|---|
| `diaspore run --seed <n>` | Execute one simulated run under a given seed |
| `diaspore dandelion --seeds <n>` | Sweep many seeds, report invariant violations |
| `diaspore pappus export --seed <n>` | Write a portable `.pappus` run file |
| `diaspore pappus replay <file>` | Reproduce an identical run from a `.pappus` file |
| `diaspore verify <file>` | Check a trace for lost writes and stale reads |
| `diaspore real --peers <list>` | Run over TCP against a live cluster |
| `diaspore watch` | Live terminal view of a running capitulum |

Verbs stay plain so the interface self-describes. Nouns carry the theme.

A seed alone does not reproduce a run — cluster size, fault schedule and protocol version all
participate. These are serialised together with the recorded event trace into a single
`.pappus` file. Handing someone that file hands them the entire failure.

---

## Architecture

```
        ┌──────────────────────────────────────┐
        │  core/     floret state machine      │
        │            no I/O, no clocks         │
        └──────────────────────────────────────┘
                  ▲                  ▲
                  │                  │
   ┌──────────────┴───────┐   ┌──────┴──────────────┐
   │  capitulum/          │   │  real/              │
   │  event queue         │   │  TCP transport      │
   │  virtual clock       │   │  goroutine runtime  │
   │  seeded faults       │   │  real timers        │
   └──────────┬───────────┘   └─────────────────────┘
              │
              ▼
        .pappus file ──▶ check/ ──▶ violations
              │
              ▼
        dandelion/ ──▶ parallel sweep
```

| Path | Role |
|---|---|
| `core/` | Floret and its replication state machine. Deterministic by construction. |
| `capitulum/` | Owns florets, drives the event loop, virtual clock, seeded fault controller |
| `real/` | TCP transport and goroutine runtime for live clusters |
| `pappus/` | Run manifest: read, write, validate |
| `dandelion/` | Parallel seed execution |
| `check/` | Reads a trace, reports violations |
| `cmd/diaspore` | CLI |
| `infra/` | Terraform for the AWS environment |

---

## Determinism, and how it is protected

One stray clock read, one map iteration, one goroutine inside `core/`, and replay breaks
silently. Diaspore guards against that with a test that runs the same seed twice and diffs the
traces byte for byte. It runs in CI on every commit.

If that test goes red, nothing else in the repo can be trusted.

---

## Faults injected

Four core faults and two additive, all scheduled by the seeded controller — so the fault
timeline is part of what a seed determines.

| Injected fault | Failure class | What it exercises | |
|---|---|---|---|
| Node crash | Crash failure | Loss of a floret mid-operation | core |
| Crash and restart | Fail-recover | Recovery with stale or absent state | core |
| Message drop | Omission failure | Acknowledgements that never arrive | core |
| Network partition | Link failure | Minority isolation; the P in CAP | core |
| Message delay | Timing failure | Correct responses arriving too late | additive |
| Message reorder | Timing failure | Causality assumptions in the protocol | additive |

The four marked *core* carry the argument on their own. Delay and reorder are the fourth item
in the cut order, so the fault model has a floor of four and a ceiling of six.

With delay present, sustained delay under load additionally produces performance failure
behaviour, where the capitulum responds but too slowly to be useful. If delay is cut, that
class goes with it and is not claimed.

**Deliberately out of scope**, for reasons of design rather than time: Byzantine failure, which
would need message signing and Byzantine-tolerant quorum arithmetic; response failure, which
would require corrupting the state machine and so break the determinism guarantee the project
rests on; and gray failure, which needs a health-checking subsystem this design does not
include. These are stated boundaries of the fault model, not omissions.

---

## Invariants checked

1. No acknowledged write is lost.
2. Reads respect the bound their mode states:
   - **Quorum** — reads go through a majority read quorum, so the bound is **zero**. Any write
     that was acknowledged is visible to every read that follows it. A stale read at all is a
     violation.
   - **Primary-backup** — a read served by the primary has a bound of **zero**. A read served
     by a follower has **no bound**, and none is claimed: follower staleness is measured and
     reported, not asserted. What is asserted for followers is **monotonic reads** — one
     client reading one key from one floret never sees the value go backwards.
3. After quiescence — every message delivered or dropped, no client traffic in flight — no two
   florets hold different values for the same key.

Invariant 2 used to say "beyond the mode's stated staleness bound" while no document stated
one, which left `check/staleness.go` unwritable. The bounds above are the statement;
[`design.md`](design.md) carries the reasoning.

The third is convergence, not ownership. An earlier draft asked whether two florets could both
claim authority over a key, which nothing here can do: the primary is static and there is no
election, so authority never moves. Divergence is the failure this design can actually produce,
through asynchronous fanout, a dropped replicate, a partition that heals, and whatever the
conflict-resolution rule then decides.

Each violation is reported with the seed that produced it, so any finding is independently
reproducible by a third party.

---

## Local development without AWS

The AWS environment for this course is credit-limited and terminates running instances between
sessions. Diaspore therefore assumes no state survives, and nearly all development happens
without touching AWS.

Local development uses [Floci](https://github.com/floci-io/floci), an MIT-licensed local AWS
emulator serving an AWS-compatible endpoint on `localhost:4566`. Terraform, the AWS CLI and the
SDKs are pointed at it unchanged. It replaced LocalStack Community, which began requiring auth
tokens in March 2026.

- Terraform plans and applies are validated locally before any cloud spend.
- CI runs the infrastructure path against Floci from the 11/30 week, when the Terraform and
  the Floci compose file first exist. Before then CI is build, vet, test and the determinism
  check. Either way the pipeline needs no cloud credentials.
- EC2 time is spent only on the axis 3 validation runs.

> **Caveat to verify before relying on this.** Floci's EC2 coverage is listed as partial. It is
> sound for validating Terraform syntax and plan output, but do not assume it will boot three
> instances running the Diaspore binary. Confirm what actually works locally before the 11/30
> week, and keep the real-hardware runs as the only proof of axis 3.

---

## Live terminal interface

`diaspore watch` renders a running capitulum live: one row per floret with its dispatch and
replication state, message counts, current logical clock, and a marker when an invariant is
violated.

Its purpose is demonstration rather than measurement. During the final presentation it allows a
fault to be injected in front of the audience and the recovery — or failure — to be watched as
it happens rather than described after the fact.

It reads the same metrics already written for the figures, so nothing additional is
instrumented. It is scheduled last, in the week of December 7, and is the first item dropped if
the schedule tightens.

---

## Figures

1. Violation rate per thousand seeds against cluster size
2. Convergence time against cluster size, simulated and real on one chart
3. Messages exchanged per client write against cluster size
4. Sweep throughput and time-to-first-violation against worker count
5. Event timeline of a single replayed violation

---

## Findings

> Populated as the sweep turns up violations.

| Seed | Faults | Violation | Confirmed on real cluster |
|---|---|---|---|
| — | — | — | — |

---

## Roadmap

Split the way the plan's cut order splits it, so this list is not a promise the schedule
already intends to break.

**The project.** Not reducible — without these there is no result.

- [ ] Event and message types defined
- [ ] `core/` floret state machine, primary-backup mode
- [ ] `capitulum/` simulated runtime with virtual clock
- [ ] Same-seed determinism test in CI
- [ ] Fault controller: crash, crash-restart, drop, partition
- [ ] `.pappus` manifest format
- [ ] Invariant checker
- [ ] `dandelion` parallel sweep

**Additive.** Each improves the result; each is droppable, in this order from the bottom up.

- [ ] Version vectors — otherwise last-write-wins by timestamp
- [ ] Message delay and reorder faults
- [ ] Quorum mode — one mode demonstrates the idea
- [ ] Terraform environment, real mode on EC2, simulated versus real comparison
- [ ] `diaspore watch`

Logical clocks are listed nowhere separately because they are a field on the trace record, not
a milestone: the determinism test is ordered by the virtual clock and never waits on them.

---

## Naming

Every term comes from a single organism — *Taraxacum*, the dandelion — and each names the
component it actually corresponds to. Structures get botanical names; actions get plain verbs.

| Term | In botany | In code |
|---|---|---|
| Diaspore | Seed plus the structures carrying it | Project, module path, binary |
| Capitulum | The flower head | A cluster instance |
| Floret | One flower within the head | A single node |
| Pappus | The parachute | The portable run manifest |
| Dandelion | Releases thousands of diaspores at once | The parallel sweep |

Containment order, which the code mirrors: a dandelion sweep spawns many capitula, each holding
several florets, each run exporting one pappus.

Plurals are florets and capitula. Never capitulums.

Full reference, including the terms deliberately rejected, is in
[`naming.md`](naming.md).

---

## License

MIT — see [LICENSE](../LICENSE).

---

<div align="center">
<sub>Built for CS 6650 (Building Scalable Distributed Systems) at Northeastern University, Fall 2026.</sub>
</div>
