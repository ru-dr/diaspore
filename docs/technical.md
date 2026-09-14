# Technical document

**Seeds for failures.** Companion to the project proposal.

CS 6650 — Building Scalable Distributed Systems · Fall 2026

This document describes the apparatus: what is being built, what it can and
cannot find, and what is being measured. The reasoning behind the design
decisions inside it is in [`design.md`](design.md); the schedule is in
[`plan.md`](plan.md).

---

## 1. System under test

Deliberately modest, because it is apparatus rather than contribution: an
in-memory replicated key-value store with two replication modes.

Under **quorum**, a write is acknowledged once a majority of replicas have
stored it. Under **primary-backup**, a statically assigned primary
acknowledges immediately and replicates asynchronously afterwards.

Two modes exist because they produce distinct failure classes. Primary-backup
opens a window between acknowledging a write and replicating it, during which
an acknowledged write exists in one place only; a crash inside that window is a
failure quorum cannot produce. Comparing their latency is not an objective.

There is no leader election, no disk persistence, and no gRPC. Each omission
removes a failure mode that would consume time without advancing the question.
The absence of election is visible rather than hidden: when the static primary
dies, writes stop, and that is the failure mode of the mode rather than a
defect.

## 2. Architecture

### 2.1 The pure core

The replication logic consumes one event at a time and emits messages. It
cannot read a clock, sleep, generate randomness, or touch the network.

This is the load-bearing constraint. A component with one input channel can be
driven by a scheduler, and a scheduler can be made to behave identically on two
runs of the same seed. Any capability the logic had behind that interface would
be an input nobody controls. The cost is that logic wanting to block on
replies must instead carry state between events, which is more code and less
obvious code than the blocking form.

### 2.2 Two runtimes

The **simulated** runtime is a single goroutine driving a priority queue of
events against a virtual clock. Time advances only when the queue advances, so
a thirty-second scenario executes in milliseconds. Every non-determinate choice
comes from one seeded source.

That includes client load. Nothing outside the seeded scheduler may generate a
request, because a load generator with its own clock or randomness would defeat
replay in the one place the project cannot afford it. The scheduler expands a
workload profile into client requests itself, and the profile travels in the
run manifest so that a run is rebuildable from the manifest alone.

The **real** runtime is a goroutine per floret, with TCP between them —
framing, timeouts — real timers, and an HTTP interface for clients. Faults are
injected in-process rather than by manipulating the network, which keeps an
injected partition the same partition on every run. The same workload profile
drives it, replayed over HTTP.

Both runtimes drive the same core. Neither knows about the other.

### 2.3 The portable unit

A seed alone does not reproduce a run: cluster size, workload profile, fault
schedule, and protocol version all participate. These are serialised together
with the recorded event trace into a single file. Transferring that file to
another machine reproduces the execution exactly.

The trace belongs to that file rather than to the simulator, because the
checker has to run against what was handed over rather than against a live
cluster, and because the checker outlives the simulator in the cut order.

## 3. Live terminal interface

Alongside the batch commands, a terminal UI built with **Bubble Tea** renders a
running capitulum live: one row per floret with its dispatch and replication
state, message counts, current logical clock, and a marker when an invariant is
violated.

Its purpose is demonstration rather than measurement. During the final
presentation it allows a fault to be injected in front of the audience and the
resulting recovery — or failure — to be watched as it happens, rather than
described after the fact.

It reads the same metrics already written for the figures, so nothing
additional is instrumented. It is scheduled last, in the week of December 7,
and is the first item dropped if the schedule tightens.

That week freezes the system under test rather than the repository. Once
figures are being produced, changing the replication logic would mean the
figures describe something that no longer exists. A read-only view over metrics
already being written changes nothing the figures depend on, which is why it is
the one thing that may still be built that week.

## 4. Local emulation and cost control

The AWS environment available for this course is credit-limited and terminates
running instances between sessions. The project is therefore built so that no
state is assumed to survive, and so that nearly all development happens without
touching AWS at all.

Local development uses **Floci**, an open-source local AWS emulator serving an
AWS-compatible endpoint on `localhost:4566`. Terraform, the AWS CLI, and the
SDKs are pointed at it unchanged, which means the same infrastructure
definitions are exercised locally and on real hardware.

- Terraform plans and applies are validated locally before any cloud spend.
- CI runs the infrastructure path against Floci from the week of Nov 30, when
  the Terraform and the emulator configuration first exist. Before then CI is
  build, vet, test and the determinism check. Either way the pipeline needs no
  cloud credentials.
- EC2 time is spent only on the real-mode validation runs described in Axis 3
  of the proposal.

Floci is a drop-in replacement for LocalStack Community, which required auth
tokens from March 2026 onward; the endpoint, credential, and configuration
conventions are otherwise identical.

## 5. Faults injected

Four core faults and two additive are injected, all scheduled by the seeded
controller — so the fault timeline is part of what a seed determines.

| Injected fault | Failure class | What it exercises | |
|---|---|---|---|
| Node crash | Crash failure | Loss of a floret mid-operation | core |
| Crash and restart | Fail-recover | Recovery with stale or absent state | core |
| Message drop | Omission failure | Acknowledgements that never arrive | core |
| Network partition | Link failure | Minority isolation; the P in CAP | core |
| Message delay | Timing failure | Correct responses arriving too late | additive |
| Message reorder | Timing failure | Causality assumptions in the protocol | additive |

The four marked *core* carry the argument alone. Delay and reorder are the
fourth item in the cut order, so the model has a floor of four and a ceiling of
six.

With delay present, sustained delay under load additionally produces
**performance failure** behaviour, where the capitulum responds but too slowly
to be useful. Cut delay and that class goes with it, and is not claimed.

### 5.1 Deliberately out of scope

Three failure classes are excluded, for reasons of design rather than time.

- **Byzantine failure.** A floret that lies, or sends different answers to
  different peers, would require message signing and Byzantine-tolerant quorum
  arithmetic — effectively a second project.
- **Response failure.** Producing incorrect values or invalid state transitions
  requires deliberately corrupting the state machine, which would break the
  determinism guarantee the project rests on.
- **Gray failure.** Detecting a floret that is degraded yet still passing health
  checks requires a health-checking subsystem that this design does not include.

Excluding them is a stated boundary of the fault model, not an omission.

## 6. Invariants checked

**No acknowledged write is lost.** An acknowledgement means a reply sent to a
client, recorded in the trace with the time it happened — not the
acknowledgement florets exchange while replicating, which is a different event
and is easy to mistake for this one. The checker reads the set of
client replies and asks whether every write they confirmed is still present at
the end.

**Reads respect the bound their mode states.** Under quorum the bound is zero,
because the addressed floret asks a majority and returns the newest version it
sees; a write a majority acknowledged cannot be missed by a later majority
read, so any stale read is a violation. Under primary-backup a read from the
primary is current and a read from a follower has no bound. No bound is
claimed there deliberately: any number would be invented in order to be checked
against, and the useful thing is the measured distribution. What is asserted
for followers instead is monotonicity — one client, reading one key from one
floret, never sees the value go backwards.

Both halves require a client that can address a read to a particular floret,
which is unusual for a key-value store and is the point here: the quantity
being measured is how stale a *particular* replica is. They also require
knowing which client issued a read, so client operations carry an identity — a
numbered request stream defined by the workload profile, and nothing more.

**Replicas converge.** After quiescence, no two florets hold different values
for the same key. The obvious alternative — asking whether two florets could
both claim authority over a key — is unviolatable here, because the primary is
chosen once and never moves, so authority is constant. An invariant that cannot
fail is not a check. Divergence is the failure this design can produce.

Each violation is reported together with the seed that produced it, so any
finding is independently reproducible by a third party.

The parts of the read path that remain undecided, and what would settle each,
are in [`design.md`](design.md).

## 7. Coverage of course topics

| Topic | Where it is load-bearing |
|---|---|
| Go, Containers | Implementation; Docker images, Compose for local clusters |
| Network Fundamentals | TCP transport, framing, timeout and retry handling |
| Concurrency & Parallelism | Real runtime; parallel sweep execution |
| Consensus | Quorum acknowledgement rules and commit conditions |
| Service API | HTTP key-value interface; CLI surface |
| Load Testing & Threads | Client workload driver; sweep throughput scaling |
| Caching | Follower replicas as an unbounded read cache; staleness measured, not asserted |
| Data | Versioned store and conflict resolution; version vectors if they survive cut 5, last-write-wins by timestamp otherwise |
| Leaders, Followers, Time, Events | Primary and follower roles, logical clocks, event ordering |
| Testing & Messaging | Invariant checking; replication message protocol |

The caching row is worth reading precisely. The project does not implement a
cache with a coherence protocol. A follower replica is readable directly and is
therefore a cache with no bound, and what the work contributes is the
measurement of how far behind it runs.

## 8. Deliverables

Split the way the cut order in [`plan.md`](plan.md) splits everything else.

**Not reducible.**

- A Go implementation with a pure replication core
- A deterministic simulator with a seeded fault controller
- A portable run format, and a replay command reproducing any run
- An invariant checker reporting violations with reproducing seeds
- A parallel sweep capable of executing thousands of scenarios
- A CI pipeline that enforces determinism on every commit
- Measured results along axes 1 and 2
- A set of committed reproductions of discovered failures

**Conditional on the schedule.** Each is in the cut order and may not ship,
listed from the last thing cut to the first.

- The second replication mode: quorum alongside primary-backup — cut 3
- A Terraform-provisioned AWS environment — part of cut 2
- A second runtime: real mode over TCP on EC2 — cut 2
- Axis 3: the simulated curve validated against real hardware — cut 2
- The live terminal view — cut 1, the first to go

## 9. Figures to be produced

- Violation rate per thousand seeds against cluster size
- Convergence time against cluster size, simulated and real on one chart
- Messages exchanged per client write against cluster size
- Sweep throughput and time-to-first-violation against worker count
- Event timeline of a single replayed violation

## 10. Risks and mitigation

### 10.1 Determinism leakage

A single unguarded clock read, map iteration, or stray goroutine inside the
core breaks replay silently. Mitigated by a test that executes the same seed
twice and compares traces byte for byte, enforced in CI from the week of
Oct 5 — named rather than counted, because this is the date the rest of the
schedule is measured against and an off-by-one here is expensive.

Comparing bytes rather than structures also puts the encoding under test. An
encoder that walked a map in a different order on the second run would break
replay exactly as thoroughly as the core doing it, and a structural comparison
would pass.

This is the load-bearing safeguard. If that test fails, no other result in the
project can be trusted.

### 10.2 Benchmark noise on shared cloud hardware

Absolute timings on EC2 are unreliable. Mitigated by reporting relative
behaviour and curve shape rather than absolute latency figures.

### 10.3 Scope

The simulated half constitutes a complete result on its own.

The cut order lives in [`plan.md`](plan.md) and nowhere else, so there is one
list to keep true rather than three that drift. Five items, each leaving a
project that still stands.

The determinism test, the portable run format, and the sweep are not reducible.
They are the project.

## 11. Schedule

| Week of | Milestone |
|---|---|
| Oct 26 | Proposal; event model and core skeleton complete |
| Nov 02 | Midterm week; run format designed on paper only |
| Nov 09 | Simulated runtime, virtual clock, determinism test in CI |
| Nov 16 | Fault controller; logical clocks; both replication modes, including quorum's read path |
| Nov 23 | Invariant checker; parallel sweep; first findings |
| Nov 30 | Terraform environment; real mode on EC2; validation runs |
| Dec 07 | Final mastery week; figures and written findings |
| Dec 14 | Final presentation |

Assignment deadlines take precedence in every week. The two mastery weeks
(Nov 02 and Dec 07) are planned as near-zero project weeks.

## 12. Command-line interface

| Command | Function |
|---|---|
| `diaspore run --seed <n>` | Execute one simulated run under a given seed |
| `diaspore dandelion --seeds <n>` | Sweep many seeds, report invariant violations |
| `diaspore pappus export --seed <n>` | Write a portable `.pappus` run file |
| `diaspore pappus replay <file>` | Reproduce an identical run from a `.pappus` file |
| `diaspore verify <file>` | Check a trace for lost writes and stale reads |
| `diaspore real --peers <list>` | Run over TCP against a live cluster |
| `diaspore watch` | Live terminal view of a running capitulum |

## 13. Naming

Every term is taken from a single organism — *Taraxacum*, the dandelion — and
each names the component it actually corresponds to.

- **Diaspore.** A seed together with the structures that carry it, dispersed as
  a unit and growing into the same plant wherever it lands. This is the project,
  and it is what the portable run file does: hand it to another machine and the
  identical execution grows there.
- **Capitulum.** The flower head — the structure holding all the florets
  together. Here, the cluster.
- **Floret.** One individual flower within the head, each producing a single
  seed. Here, a node.
- **Pappus.** The parachute that carries the seed. Here, the run manifest —
  seed, cluster configuration, workload profile, fault schedule, protocol
  version, and event trace — serialised as one transferable file.
- **Dandelion.** The organism that releases thousands of diaspores at once, each
  landing independently. Here, the parallel sweep: many seeds scattered, and a
  report of which ones took root badly.

Command verbs stay plain — `run`, `verify`, `real` — so the interface remains
self-describing. The vocabulary names structures, not actions.

See [`naming.md`](naming.md) for the working reference.
