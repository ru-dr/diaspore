<div align="center">

# Diaspore

**Seeds for failures.**

Deterministic replay and scalable failure search for replicated systems.

[![Go](https://shieldcn.dev/badge/Go-1.27.1-00ADD8.svg?logo=go&logoColor=white)](https://go.dev)
[![Terraform](https://shieldcn.dev/badge/Terraform-AWS-7B42BC.svg?logo=terraform&logoColor=white)](https://www.terraform.io)
[![CI](https://shieldcn.dev/github/ru-dr/diaspore/ci.svg?label=build)](https://github.com/ru-dr/diaspore/actions)
[![License](https://shieldcn.dev/badge/license-MIT-black.svg)](../LICENSE)
[![Status](https://shieldcn.dev/badge/status-in_development-orange.svg)](#roadmap)

[Why](#why) · [How it works](#how-it-works) · [Why this is a scalability project](#why-this-is-a-scalability-project) · [What success looks like](#what-success-looks-like) · [Faults](#faults-injected) · [Roadmap](#roadmap)

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

The replication logic is a pure state machine. It consumes one event — a client request, a
message from a peer, a timer — and produces messages. It cannot read a clock, sleep, generate
randomness, or touch the network.

That restriction is the whole design. A component with a single input channel can be driven by
a scheduler, and a scheduler can be made to behave identically twice. Anything the logic could
do behind that interface would be a second input nobody controls, and two runs of one seed
would diverge. The restriction costs real clarity — logic that wants to say "send, wait, then
commit" has to be turned inside out into state carried between events — and it buys the only
property that matters here.

The same state machine then runs two ways.

**Simulated.** One goroutine drives a queue of scheduled events against a virtual clock. Time
advances only when the queue does, so a scenario spanning thirty seconds finishes in
milliseconds and a cluster far larger than any affordable hardware is reachable. Every
non-determinate choice — fault timing, message ordering, which client acts next — comes from
one seeded source.

Client load is part of that. Nothing outside the seeded scheduler may generate a request. A
load generator with its own clock or its own randomness would be a leak in exactly the place
the project cannot afford one, so there is not one: the scheduler expands a workload profile
into client requests itself. The profile travels inside the run manifest, because a run that
cannot be rebuilt from its manifest is not reproducible.

**Real.** A goroutine per floret, TCP between them with framing and timeouts, real timers, and
an HTTP interface for clients. Faults are injected in-process rather than by interfering with
the network, so an injected partition is the same partition every time. The same workload
profile drives it, replayed over HTTP, where a real clock is the point rather than a hazard.

Hunt bugs in simulation, then check whether the real world agrees.

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

Both exist because they fail differently, not because either is better. Primary-backup opens a
window between acknowledging a write and replicating it, in which an acknowledged write lives
in one place only; losing a floret inside that window is a bug quorum cannot produce.
Comparing their latency is not an objective of the project.

There is no leader election, no disk persistence, and no gRPC. Each omission removes a failure
mode that would consume time without advancing the question. The absence of election has a
visible consequence rather than a hidden one: when the static primary dies, writes stop. That
is the failure mode of the mode, and the sweep should report it as one.

---

## Determinism, and how it is protected

One stray clock read, one map iteration, one goroutine inside the pure core, and replay breaks
silently. Diaspore guards against that with a test that runs the same seed twice and diffs the
recorded traces byte for byte. It runs in CI on every commit.

Comparing bytes rather than structures is deliberate, and it means the encoding is under test
too — an encoder that iterates a map in a different order on the second run would break replay
just as thoroughly as the core doing it, and a structural comparison would not notice.

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

**Deliberately out of scope**, for reasons of design rather than time: a floret that lies would
need signed messages and quorum arithmetic tolerant of dishonesty, which is a second project; a
floret returning wrong values would require corrupting the state machine and so breaking the
determinism everything else rests on; and a floret degraded but still passing health checks
cannot be detected without a health-checking subsystem this design does not have. These are
stated boundaries of the fault model, not omissions.

---

## Invariants checked

**No acknowledged write is lost.** An acknowledgement here is a reply sent to a client, which
is recorded in the trace with the time it happened — not the acknowledgement florets send each
other while replicating, which is a different event. The checker takes the set of client
replies and asks whether each write they confirmed survives in the final state.

**Reads respect the bound their mode states.** Under quorum the bound is zero: the addressed
floret asks a majority and returns the newest version it sees, so a write a majority
acknowledged cannot be missed by a later read, and any stale read at all is a violation. Under
primary-backup a read from the primary is current and a read from a follower has no bound —
none is claimed, because any number would be invented to be checked against. Follower staleness
is measured and its distribution reported. What is asserted for followers instead is that reads
are monotonic: one client, reading one key from one floret, never sees the value go backwards.

That second half depends on a client being able to address a read to a particular floret, which
is unusual for a key-value store and is done here because the thing being measured is how stale
a particular replica is. It also depends on knowing which client issued a read, so client
operations carry an identity — a numbered request stream from the workload profile, and nothing
more than that.

**Replicas converge.** Once everything has settled — every message delivered or dropped, no
client traffic outstanding — no two florets hold different values for the same key. An earlier
draft asked instead whether two florets could both claim authority over a key, which nothing
here can do: the primary is chosen once and never moves. An invariant that cannot be violated
is not a test. Divergence can be violated, through asynchronous fanout, a dropped replicate, a
partition that heals, and a conflict rule that resolves the two sides differently.

Each violation is reported with the seed that produced it, so any finding is independently
reproducible by a third party.

The reasoning behind all three is in [`design.md`](design.md), along with the parts of the read
path that are still open.

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
- CI runs the infrastructure path against Floci from the 11/30 week, when the Terraform and the
  emulator configuration first exist. Before then CI is build, vet, test and the determinism
  check. Either way the pipeline needs no cloud credentials.
- EC2 time is spent only on the axis 3 validation runs.

> **Caveat to verify before relying on this.** Floci's EC2 coverage is listed as partial. It is
> sound for validating Terraform syntax and plan output, but do not assume it will boot three
> instances running the Diaspore binary. Confirm what actually works locally before the 11/30
> week, and keep the real-hardware runs as the only proof of axis 3.

---

## Live terminal interface

A terminal view renders a running capitulum live: one row per floret with its dispatch and
replication state, message counts, current logical clock, and a marker when an invariant is
violated.

Its purpose is demonstration rather than measurement. During the final presentation it allows a
fault to be injected in front of the audience and the recovery — or failure — to be watched as
it happens rather than described after the fact.

It reads the same metrics already written for the figures, so nothing additional is
instrumented. It is scheduled last and is the first item dropped if the schedule tightens.

---

## Figures

1. Violation rate per thousand seeds against cluster size
2. Convergence time against cluster size, simulated and real on one chart
3. Messages exchanged per client write against cluster size
4. Sweep throughput and time-to-first-violation against worker count
5. Event timeline of a single replayed violation

---

## Findings

> Populated as the sweep turns up violations. See [`findings.md`](findings.md).

---

## Roadmap

Split the way the plan's cut order splits it, so this list is not a promise the schedule
already intends to break.

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
than being a milestone: the determinism test is ordered by the virtual clock and never waits on
them.

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

Full reference, including the terms deliberately rejected, is in [`naming.md`](naming.md).

---

## License

MIT — see [LICENSE](../LICENSE).

---

<div align="center">
<sub>Built for CS 6650 (Building Scalable Distributed Systems) at Northeastern University, Fall 2026.</sub>
</div>
