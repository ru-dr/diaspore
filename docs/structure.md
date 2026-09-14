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
│       └── main.go              Workload driver: HTTP in real mode, the same
│                                 profile as seeded client events in simulation
│
├── core/                        THE PURE LAYER — no I/O, no clocks, no goroutines
│   ├── floret.go                Floret struct, Step(event) -> []Message
│   ├── state.go                 Per-floret state: store, pending writes, peer view
│   ├── event.go                 Event types: ClientWrite, ClientRead, MsgRecv, Timer
│   ├── message.go               Wire messages: Replicate, Ack
│   ├── store.go                 In-memory key-value map with versions
│   ├── version.go               Version vectors, comparison, conflict resolution
│   ├── mode_quorum.go           Quorum replication: majority ack before commit
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
│   ├── faults.go                Fault controller: the six injected faults
│   ├── rand.go                  The ONLY randomness source, seeded
│   ├── trace.go                 Records every event keyed by virtual time and
│                                 sequence. Logical clock added as a field in 11/16
│   └── determinism_test.go      Same seed twice, diff the traces  ← guards everything
│
├── real/                        Live runtime
│   ├── runtime.go               Goroutine per floret, drives the same core.Floret
│   ├── transport.go             TCP peer connections, framing, timeouts
│   ├── clock.go                 Wall clock and real timers
│   ├── api.go                   HTTP key-value API for clients
│   └── admin.go                 In-process fault injection endpoints
│
├── pappus/                      The portable unit
│   ├── format.go                Manifest schema: seed, config, fault schedule, version, trace
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
│   ├── lostwrites.go            Replay client log against final state
│   ├── staleness.go             Measure how far behind a read was
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
cmd/  ──▶  capitulum/  ──▶  core/
      ──▶  real/       ──▶  core/
      ──▶  dandelion/  ──▶  capitulum/
                       ──▶  check/      ──▶  pappus/
      ──▶  check/      ──▶  pappus/
```

Everything points inward. `core/` is the only package with no dependencies of its own.

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
| `(f *Floret) Step(e Event) []Message` | The pure state machine |
| `(c *Capitulum) Step() bool` | Advance one event |
| `(c *Capitulum) Florets() []*Floret` | Membership |
| `(c *Capitulum) Kill(id FloretID)` | Inject a crash |
| `(c *Capitulum) Sever(a, b FloretID)` | Inject a partition |
| `capitulum.New(n int, seed uint64)` | Construct a cluster |
| `pappus.Write(c *Capitulum, path string)` | Export a run |
| `pappus.Read(path string)` | Load a run |
| `dandelion.Sweep(seeds, workers int)` | Run the sweep |

File extension: `.pappus`

## Note on a resolved drift

An earlier version of this file had a `sim/` package holding the virtual clock, event queue,
fault controller and seeded randomness. The naming reference assigns that role to
`capitulum/`, which also owns floret membership. This file now follows the naming reference.
If any code or doc still says `sim/`, it is stale.
