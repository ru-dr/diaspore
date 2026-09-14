# Technical document

**Seeds for failures.** Companion to the project proposal.

CS 6650 — Building Scalable Distributed Systems · Fall 2026

---

## 1. System under test

Deliberately modest, because it is apparatus rather than contribution: an
in-memory replicated key-value store with two replication modes.

- **Quorum.** A write is acknowledged after a majority of replicas have stored it.
- **Primary-backup.** A statically assigned primary acknowledges immediately and
  replicates asynchronously.

Two modes produce distinct failure classes, which is why both exist. Comparing
their latency is not an objective of the project.

There is no leader election, no disk persistence, and no gRPC. Each omission
removes a failure mode that would consume time without advancing the question.

## 2. Architecture

### 2.1 The pure core

`core/` holds the replication state machine. It imports nothing that can read a
clock, sleep, generate randomness, or touch the network. If a package under
`core/` ever needs one of those, the design is wrong.

Everything it does is expressed as `Step(event) → []Message`.

### 2.2 Two runtimes

- `sim/` — a single goroutine driving a priority queue of events against a
  virtual clock. Time advances only when the queue advances, so a thirty-second
  scenario executes in milliseconds. The only randomness source in the package
  is seeded.
- `real/` — a goroutine per node, TCP transport with framing and timeouts, real
  timers, and an HTTP key-value API. Fault injection is done in-process via
  admin endpoints rather than by manipulating the network, which keeps injected
  partitions deterministic and repeatable.

Both import `core/`. Neither imports the other.

### 2.3 The portable unit

A seed alone does not reproduce a run — cluster size, fault schedule, and
protocol version all participate. These are serialised together with the
recorded event trace into a single file. Transferring that file to another
machine reproduces the execution exactly.

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
- CI runs the infrastructure path against Floci from the week of Nov 30, when the
  Terraform first exists. Before then CI is build, vet, test and the determinism
  check. Either way the pipeline needs no cloud credentials.
- EC2 time is spent only on the real-mode validation runs described in Axis 3
  of the proposal.

Floci is a drop-in replacement for LocalStack Community, which required auth
tokens from March 2026 onward; the endpoint, credential, and configuration
conventions are otherwise identical.

## 5. Faults injected

Six faults are injected, all scheduled by the seeded controller — so the fault
timeline is part of what a seed determines.

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

- No acknowledged write is lost.
- No read returns a value older than a previously acknowledged write to the same
  key, beyond the mode's stated staleness bound.
- After quiescence, no two florets hold different values for the same key.

The third is convergence rather than ownership. With a static primary and no
election, authority never moves, so no key can have two claimants; divergence
through asynchronous fanout, a dropped replicate and a healed partition is the
failure this design can actually produce.

Each violation is reported together with the seed that produced it, so any
finding is independently reproducible by a third party.

## 7. Coverage of course topics

| Topic | Where it is load-bearing |
|---|---|
| Go, Containers | Implementation; Docker images, Compose for local clusters |
| Network Fundamentals | TCP transport, framing, timeout and retry handling |
| Concurrency & Parallelism | Real runtime; parallel sweep execution |
| Consensus | Quorum acknowledgement rules and commit conditions |
| Service API | HTTP key-value interface; CLI surface |
| Load Testing & Threads | Client workload driver; sweep throughput scaling |
| Caching | Digest caching in the replication path |
| Data | Versioned store, version vectors, conflict resolution |
| Leaders, Followers, Time, Events | Primary and follower roles, logical clocks, leases |
| Testing & Messaging | Invariant checking; replication message protocol |

## 8. Deliverables

- A Go implementation with a pure replication core and two runtimes
- A deterministic simulator with a seeded fault controller
- A portable run format, and a replay command reproducing any run
- An invariant checker reporting violations with reproducing seeds
- A parallel sweep capable of executing thousands of scenarios
- Terraform-provisioned AWS environment and a CI pipeline that enforces
  determinism on every commit
- Measured results along all three scalability axes
- A set of committed reproductions of discovered failures

## 9. Figures to be produced

- Violation rate per thousand seeds against cluster size
- Convergence time against cluster size, simulated and real on one chart
- Messages exchanged per client write against cluster size
- Sweep throughput and time-to-first-violation against worker count
- Event timeline of a single replayed violation

## 10. Risks and mitigation

### 10.1 Determinism leakage

A single unguarded clock read, map iteration, or stray goroutine inside the core
breaks replay silently. Mitigated by a test that executes the same seed twice
and compares traces byte for byte, enforced in CI from week five onward.

This is the load-bearing safeguard. If that test fails, no other result in the
project can be trusted.

### 10.2 Benchmark noise on shared cloud hardware

Absolute timings on EC2 are unreliable. Mitigated by reporting relative
behaviour and curve shape rather than absolute latency figures.

### 10.3 Scope

The simulated half constitutes a complete result on its own. If the schedule
slips, the reduction order is: real-mode validation, then the second replication
mode, then message reordering and delay faults. The determinism test, the
portable run format, and the sweep are not reducible — they are the project.

## 11. Schedule

| Week of | Milestone |
|---|---|
| Oct 26 | Proposal; event model and core skeleton complete |
| Nov 02 | Midterm week; run format designed on paper only |
| Nov 09 | Simulated runtime, virtual clock, determinism test in CI |
| Nov 16 | Fault controller; logical clocks; both replication modes |
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
  seed, cluster configuration, fault schedule, protocol version, and event trace
  — serialised as one transferable file.
- **Dandelion.** The organism that releases thousands of diaspores at once, each
  landing independently. Here, the parallel sweep: many seeds scattered, and a
  report of which ones took root badly.

Command verbs stay plain — `run`, `verify`, `real` — so the interface remains
self-describing. The vocabulary names structures, not actions.

See [`naming.md`](naming.md) for the working reference.
