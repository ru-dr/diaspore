# Diaspore Design

Version 0.1, September 23, 2026.

The features in this document are fixed. How each piece works inside is decided during the build,
one checkpoint at a time, and recorded in the decisions log of the build guide. Where a detail is
left to a checkpoint, this document says so.

Vocabulary follows [`naming.md`](naming.md).

---

## 1. Goal

Make distributed bugs reproducible. Every source of randomness in a run comes from one seed, so a
failing run replays exactly, on any machine.

---

## 2. The pieces

- **Diaspore** is one Go binary. It owns time, the network, faults, client load, and randomness.
- **Florets** are separate programs, written in any language. They talk to Diaspore through JSON
  lines on stdin and stdout.
- **The capitulum** is the set of florets in one run, plus everything Diaspore tracks about them.
- **Checkers** read what clients asked and got back, and decide whether a rule was broken.
- **A pappus** is the replay file written when a checker fails.
- **The dandelion** runs many seeds in parallel.

---

## 3. The event model

A floret only ever reacts. Diaspore sends it one event, and it answers with exactly one reply.

Three kinds of event go in:

- **init** starts or restarts a floret. It carries the floret's identity, its peers, a seed for
  its own randomness, the current time, and any stored state.
- **message** delivers a message from another floret or from a client.
- **timer** tells the floret that a timer it set earlier has fired.

One kind of reply comes out: **done**. It can contain messages to send, timers to set, timers to
cancel, state to store, and log lines.

Every event carries the current virtual time. Florets never read a real clock.

The exact fields and layout become `PROTOCOL.md` in CP7. The starting draft is Appendix A of the
build guide.

---

## 4. Why lockstep

Diaspore sends one event to one floret, then waits for the reply before anything else happens.
Only one floret is ever running.

That is what keeps two runs of the same seed identical. Nothing can race, whatever language the
florets are written in.

The cost is speed, since every event is a round trip to another process. That cost is accepted
for v0.1, and measured as part of the scaling results.

---

## 5. Time and randomness

Time is virtual. It is a number Diaspore owns, and it jumps straight to the next event.

One seed decides every random choice: message delays, drops, crash times, the workload, and the
seed handed to each floret. How the master seed is split between those uses is decided in CP3.

---

## 6. Faults

The course version supports five faults:

| Fault | What happens |
|---|---|
| Delay | A message arrives later than usual |
| Drop | A message never arrives |
| Duplicate | A message arrives twice |
| Crash | A floret dies and later restarts |
| Partition | Some florets cannot reach others for a while |

A fault rule says three things: which messages, what goes wrong, and how often. Rules live in
`diaspore.yaml`.

Faults are building blocks. New behavior comes from combining rules. New building blocks can be
added in Go later.

Whether reordering needs its own fault, or already comes from random delays, is decided in CP6.

---

## 7. Crashes and storage

A crash wipes a floret's memory. Anything it saved through `store` survives and is handed back
when it restarts.

What happens to messages and timers aimed at a crashed floret is decided in CP11.

---

## 8. Workload and history

Seeded virtual clients send key-value requests to the florets. The history records every request,
every reply, and when each happened.

A request that times out has an unknown outcome. The write may or may not have happened, and
checkers must treat it that way.

---

## 9. Checkers

| Checker | The rule |
|---|---|
| `acked-writes` | A write acknowledged to a client is never lost |
| `linearizability` | Every operation looks like it happened at one instant between its start and end, checked with Porcupine |

Checkers are chosen by name in `diaspore.yaml`.

---

## 10. Outputs of a run

| File | What it holds |
|---|---|
| `trace.jsonl` | Every event in the run. Its hash is the run's fingerprint. |
| `history.jsonl` | Every client request and result, with times |
| `*.pappus` | The seed, the full resolved config, a hash of each floret program, the protocol and Diaspore versions, the expected trace hash, and a failure summary |

A pappus stands alone. Anyone with the file and the same floret programs can replay the run.

---

## 11. Commands

| Command | What it does |
|---|---|
| `diaspore run --seed <n>` | One simulated run |
| `diaspore dandelion --seeds <range> --workers <n>` | Sweep many seeds in parallel |
| `diaspore replay <file.pappus>` | Reproduce a run and verify its trace hash |
| `diaspore check-determinism --seed <n>` | Run one seed twice and point to the first difference |

---

## 12. The determinism contract

**Florets must:**

1. Do work only inside the handler for the current event.
2. Never read the real clock.
3. Never open network connections.
4. Never use unseeded randomness.
5. Keep anything that must survive a crash in `store`.

**Diaspore's core must:**

- Never read the real clock.
- Never use global randomness.
- Never run goroutines inside the event loop. Goroutines are allowed only in the process driver,
  and between separate seeds in the dandelion.

Diaspore cannot stop a floret from breaking its rules, but it can catch it.
`check-determinism` runs a seed twice and compares the traces byte for byte. CI runs it on every
commit.

---

## 13. Scalability

The dandelion runs seeds in parallel across CPU cores. Each run stays single-threaded inside.

The report measures:

- Seeds per second against worker count, for 1, 2, 4, and 8 workers.
- Events per second within one run.
- Time spent waiting on floret processes.
- How the cost of a run grows with the number of florets.

Running across many machines is bonus B1.

---

## 14. The example system

- A replicated key-value floret in Go. It speaks the raw protocol with no SDK, and it contains one
  planted bug that shows up only under a crash plus unlucky timing.
- One small floret in a second language, to prove the protocol works outside Go.

---

## 15. Repository layout

Each entry shows the checkpoint that creates it.

```
diaspore/
├── README.md
├── PROTOCOL.md                      CP7
├── LICENSE                          CP0
├── go.mod                           CP0
├── .gitignore                       CP0
├── .goreleaser.yaml                 CP23
├── .github/workflows/
│   ├── ci.yml                       CP0, determinism check added in CP12
│   └── release.yml                  CP23
├── cmd/diaspore/
│   ├── main.go                      CP12
│   ├── run.go                       CP13
│   ├── dandelion.go                 CP19
│   ├── replay.go                    CP19
│   └── determinism.go               CP12
├── internal/
│   ├── sim/
│   │   ├── clock.go                 CP1
│   │   ├── queue.go                 CP2
│   │   └── loop.go                  CP4
│   ├── seed/seed.go                 CP3
│   ├── trace/trace.go               CP5
│   ├── network/network.go           CP6
│   ├── protocol/protocol.go         CP7
│   ├── floret/process.go            CP8
│   ├── capitulum/
│   │   ├── capitulum.go             CP9
│   │   ├── timers.go                CP10
│   │   └── storage.go               CP11
│   ├── config/config.go             CP13
│   ├── faults/
│   │   ├── rules.go                 CP14
│   │   ├── crash.go                 CP15
│   │   └── partition.go             CP15
│   ├── workload/
│   │   ├── clients.go               CP16
│   │   └── history.go               CP16
│   ├── check/
│   │   ├── ackedwrites.go           CP18
│   │   └── linearizable.go          CP21
│   ├── pappus/pappus.go             CP19
│   └── dandelion/sweep.go           CP19, parallel in CP20
├── schema/
│   ├── event.schema.json            CP7
│   └── reply.schema.json            CP7
├── testdata/florets/
│   ├── echo/                        CP8
│   ├── garbage/                     CP8
│   ├── ring/                        CP9
│   ├── hang/                        CP9
│   ├── counter/                     CP11
│   └── clock-reader/                CP12
├── examples/
│   ├── kv/
│   │   ├── main.go                  CP17
│   │   └── diaspore.yaml            CP17
│   └── second-floret/               CP22
├── docs/
│   ├── build-guide.tex
│   ├── build-guide.pdf
│   ├── design.md
│   ├── plan.md
│   ├── naming.md
│   └── findings.md
└── runs/                            run outputs, listed in .gitignore
```

Notes:

- Every `.go` file gets a matching `_test.go` file next to it.
- `internal/` keeps the core private. Other projects cannot import it.
- `testdata/` holds the small test florets. Go tooling skips it when building.
- `examples/kv` imports nothing from `internal/`, so it proves the raw protocol works on its own.
- `second-floret/` gets renamed once its language is locked.
- The types and functions inside each file are designed during the checkpoints.

---

## 16. Decided, and why

| Decision | Why |
|---|---|
| Core in Go, shipped as one binary | Runs on Linux, macOS, and Windows with nothing else to install |
| Florets are separate programs speaking JSON lines | Any language can take part |
| SDKs are optional, and there is no Python SDK | The protocol is the product. SDKs multiply work. |
| JSON rather than protobuf for v1 | Readable by eye and easy to write by hand. The encoding can change later. |
| YAML for configuration | Easy for people to write and review |
| Lockstep, one event at a time | The only way to keep runs exact across separate processes |
| A simulated network, not real TCP | Full control. Real TCP timing can never be replayed. |
| MIT license | Simple and permissive |
| Every must-have ships, with no cuts | The gates in the plan only ever drop bonus items |

---

## 17. Product choices still open

Lock these before the build reaches them:

| Choice | Options | Needed by |
|---|---|---|
| Language of the second floret | Python or JavaScript | CP22 |
| How people install Diaspore | `go install`, release binaries, or both | CP23 |

---

## 18. Outside v0.1

**Bonus, in order:** the dandelion across machines, an HTML timeline viewer, a GitHub Action, and
an optional Go SDK.

**Not now:** a live production runtime, disk faults, clock skew, shrinking failing runs, and
binary encodings.

**Later failure classes.** These fit the building-block design, so they can come after the
course, from you or the community.

| Failure class | What it means | How Diaspore could inject it |
|---|---|---|
| Gray failure | A floret is degraded but still looks healthy | Create the conditions, like a slow floret, a flaky link, or a one-way partition, and let the checkers catch the damage |
| Response failure | A floret returns wrong values or makes an invalid state change | Change a reply in transit, or hand back corrupted stored state on restart |
| Byzantine failure | A floret lies, or tells different peers different things | Change a floret's messages differently for each recipient |

In every case the seed decides the change, so runs stay deterministic. Realistic Byzantine lies
need knowledge of the message format, so they suit community plugins. Tolerating Byzantine
faults, with signing and special quorums, is the tested system's job, not Diaspore's.

---

## 19. Limits

- Diaspore does not test existing services unchanged. Florets must follow the protocol.
- It does not prove a system correct. It finds bugs, and cannot show there are none.
- It does not model real TCP behavior, kernel scheduling, or disk timing.

---

## 20. Related work

- **FoundationDB** and **TigerBeetle's VOPR**: whole-system simulation driven by one seed.
- **Jepsen's Maelstrom**: nodes as separate programs speaking JSON over stdin and stdout.
- **gosim** and **detsim** for Go, **turmoil** and **madsim** for Rust.
- **Antithesis**: a commercial platform for deterministic testing of any software.

Before publishing claims, check whether Maelstrom supports exact replay from a seed, and the
current features of gosim and detsim.
