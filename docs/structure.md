# Repository structure

Module path: `github.com/ru-dr/diaspore`

```
diaspore/
├── cmd/
│   ├── diaspore/
│   │   ├── main.go              CLI entry, flag parsing, subcommand dispatch
│   │   ├── run.go               diaspore run --seed
│   │   ├── dandelion.go         diaspore dandelion --seeds  (the sweep)
│   │   ├── pappus.go            diaspore pappus export | replay
│   │   ├── verify.go            diaspore verify <file>
│   │   ├── real.go              diaspore real --peers
│   │   └── watch.go             diaspore watch  (Bubble Tea terminal view)
│   └── loadgen/
│       └── main.go              Replays a pappus.Profile over HTTP against real mode.
│                                 In simulation the same profile is expanded by
│                                 capitulum/workload.go — one definition, two drivers
│
├── core/                        THE PURE LAYER — no I/O, no clocks, no goroutines
│   ├── floret.go                Floret struct, Step(event) -> []Message
│   ├── state.go                 Per-floret state: store, pending writes, peer view
│   ├── client.go                ClientID, and what a client is: a numbered request
│                                 stream from the profile, nothing more
│   ├── event.go                 Event types: ClientWrite{Client, Key, Value},
│                                 ClientRead{Client, Key, At FloretID}, MsgRecv, Timer
│   ├── message.go               Replicate, Ack, Read, ReadReply between florets, and
│                                 ClientReply to a client. A reply is a Message because
│                                 Step returns only messages — and it is what invariant 1
│                                 means by an acknowledged write
│   ├── store.go                 In-memory key-value map with versions
│   ├── version.go               Version vectors, comparison, conflict resolution
│   ├── mode_quorum.go           Quorum: majority ack before commit, and a majority
│                                 read quorum on the read path
│   ├── mode_primary.go          Primary-backup: static primary, async fanout.
│                                 No leases, no reassignment — see design.md
│   ├── clock.go                 Logical clock, incremented only by Step. Payload
│                                 in the trace, never its ordering key
│   └── *_test.go                Unit tests per file
│
├── capitulum/                   Deterministic runtime — owns florets, drives the event loop
│   ├── capitulum.go             New(n, seed), Step() bool, Florets(), Kill(), Sever()
│   ├── clock.go                 Virtual clock, advances only when the queue advances
│   ├── queue.go                 Priority queue of scheduled events
│   ├── faults.go                Fault controller: four core faults, two additive
│   ├── rand.go                  The ONLY randomness source, seeded
│   ├── workload.go              Expands a pappus.Profile into ClientWrite and ClientRead
│                                 events on the virtual clock, drawing from rand.go
│   ├── trace.go                 Recorder: appends to a pappus.Trace, keyed by virtual
│                                 time and sequence. Logical clock added as a field in 11/16
│   └── determinism_test.go      Same seed twice, diff the traces  ← guards everything
│
├── real/                        Live runtime
│   ├── runtime.go               Goroutine per floret, drives the same core.Floret
│   ├── transport.go             TCP peer connections, framing, timeouts
│   ├── clock.go                 Wall clock and real timers
│   ├── api.go                   HTTP key-value API. Reads take a floret selector, so a
│                                 client can read a named follower and its staleness
│   └── admin.go                 In-process fault injection endpoints
│
├── pappus/                      The portable unit. Imports core/ and nothing else
│   ├── format.go                Manifest schema: seed, config, workload profile, fault
│   │                            schedule, protocol version, trace
│   ├── trace.go                 Trace and TraceRecord types — the serialised event log
│   ├── encode.go                Canonical byte encoding of a Trace. Written in 10/05 for
│                                 the determinism test; write.go wraps it in 11/09
│   ├── profile.go               Workload profile: key space, read/write ratio, arrival
│   │                            rate, client count, and the read-target policy —
│   │                            uniform, primary, or pinned per client. The policy is
│   │                            here rather than in workload.go because a run must be
│   │                            rebuildable from the manifest alone
│   ├── write.go                 Serialize a run to .pappus
│   └── read.go                  Load and validate a .pappus
│
├── dandelion/                   Parallel seed execution
│   ├── sweep.go                 Sweep(seeds, workers int)
│   ├── worker.go                One goroutine, independent seeds, no coordination
│   └── report.go                Which seeds took root badly
│
├── check/                       Invariant checking
│   ├── invariants.go            The three rules
│   ├── lostwrites.go            Acknowledged writes, taken from the ClientReply records
│                                 in the trace, against final state
│   ├── staleness.go             Staleness against the bound design.md states per mode
│   ├── divergence.go            Replicas disagree on a key after quiescence
│   └── report.go                Human-readable violation output
│
├── infra/                       Terraform
│   ├── main.tf                  VPC, EC2 instances, security groups
│   ├── variables.tf             Region, instance type, floret count
│   ├── outputs.tf               Public IPs for the peer list
│   ├── user_data.sh             Bootstrap: pull image, start container
│   └── floci.tfvars             Endpoint overrides for local emulation
│
├── deploy/
│   ├── Dockerfile               Multi-stage Go build, distroless final image
│   ├── docker-compose.yml       Local capitulum
│   └── floci-compose.yml        Floci on localhost:4566 for the infra path
│
├── scripts/
│   ├── experiment.sh            Full sweep, then real-mode confirmation
│   └── plot.py                  Trace CSV -> matplotlib figures
│
├── docs/
│   ├── assets/                  Logo and figures
│   ├── overview.md              The long form: scaling axes, fault model, figures
│   ├── technical.md             Technical document: architecture, faults, schedule
│   ├── design.md                Design doc: event model, ack rules, decisions
│   ├── naming.md                Naming reference — keep open while writing code
│   ├── structure.md             This file
│   ├── plan.md                  Week-by-week schedule
│   └── findings.md              Seeds that broke things, and why
│
├── testdata/
│   └── *.pappus                 Committed reproductions of known bugs
│
├── .github/workflows/
│   └── ci.yml                   Build, vet, test, determinism check. Infra path
│                                 against Floci added in the 11/30 week
│
├── Makefile                     dev, test, sweep, infra-up, infra-down
├── go.mod
├── go.sum
├── LICENSE
└── README.md
```

## The one rule

`core/` imports nothing from `capitulum/` or `real/`, and imports nothing that can tell the
time, sleep, generate randomness, or touch the network. If a package under `core/` ever needs
one of those, the design is wrong.

`capitulum/` and `real/` both import `core/`. They never import each other.

## Import direction

```
core/        ◀── nothing. The pure layer
pappus/      ──▶ core/
capitulum/   ──▶ core/, pappus/
real/        ──▶ core/, pappus/
check/       ──▶ core/, pappus/
dandelion/   ──▶ capitulum/, check/
cmd/         ──▶ any of the above
```

Everything points inward. `core/` is the only package with no dependencies of
its own, and `pappus/` is the only other package `check/` is allowed to know
about.

`check/` reads a whole `pappus.Pappus`, never a live `Capitulum`. It takes the
manifest rather than the trace alone because two of the three invariants need
the configuration: `staleness.go` cannot pick a bound without knowing the mode,
and `divergence.go` cannot say who should agree without the membership. That is deliberate:
`check/` is on the never-cut list and the simulator is not, so the checker must
not depend on a runtime. It is also why the trace type lives in `pappus/` —
the manifest is what gets handed to another machine, and the checker runs
against exactly that.

For the same reason `pappus.Write` takes the manifest, not a `*Capitulum`.
`capitulum/` builds one and hands it over; `pappus/` never learns what a
runtime is.

`dandelion/` imports `check/` because `report.go` says which seeds broke an
invariant, which means running the checker over each sweep result. It is not
only a scheduler.

## Key identifiers

| Signature | Purpose |
|---|---|
| `type Floret struct` | A node |
| `type Capitulum struct` | A cluster |
| `type Pappus struct` | A run manifest |
| `type FloretID uint16` | Node identity |
| `type ClientID uint16` | Client identity, needed to group monotonic reads |
| `(f *Floret) Step(e Event) []Message` | The pure state machine |
| `(c *Capitulum) Step() bool` | Advance one event |
| `(c *Capitulum) Florets() []*Floret` | Membership |
| `(c *Capitulum) Kill(id FloretID)` | Inject a crash |
| `(c *Capitulum) Sever(a, b FloretID)` | Inject a partition |
| `capitulum.New(n int, seed uint64)` | Construct a cluster |
| `(c *Capitulum) Pappus() pappus.Pappus` | Build the manifest for this run |
| `pappus.Write(p Pappus, path string)` | Export a run |
| `pappus.Read(path string)` | Load a run |
| `type pappus.Profile struct` | Workload definition, expanded by capitulum, replayed by loadgen |
| `check.Run(p pappus.Pappus) []Violation` | Check a run: the trace plus the config it needs |
| `dandelion.Sweep(seeds, workers int)` | Run the sweep |

File extension: `.pappus`

## Note on a resolved drift

An earlier version of this file had a `sim/` package holding the virtual clock, event queue,
fault controller and seeded randomness. The naming reference assigns that role to
`capitulum/`, which also owns floret membership. This file now follows the naming reference.
If any code or doc still says `sim/`, it is stale.
