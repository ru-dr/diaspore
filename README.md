<div align="center">

# Diaspore

**Seeds for failures.**

Deterministic simulation and failure search for distributed systems.

[![Go](https://shieldcn.dev/badge/Go-1.27.1-00ADD8.svg?logo=go&logoColor=white)](https://go.dev)
[![License](https://shieldcn.dev/badge/license-MIT-black.svg)](LICENSE)
[![Status](https://shieldcn.dev/badge/status-in_development-orange.svg)](docs/plan.md)

[How it works](#how-it-works) · [CLI](#cli) · [Protocol](#the-protocol) · [Roadmap](#roadmap) · [Docs](#documentation)

</div>

---

Distributed systems fail on timing, and that timing differs on every run. A suite passes a
hundred times, fails once, passes again, and you never learn whether the defect was fixed or
merely avoided.

Diaspore pulls every source of that randomness into one place and drives it from a single seed.
Same seed, same execution, every time. A bug stops being an anecdote and becomes an address.

> **Status:** in development. Nothing below works yet. This README describes the v0.1 target,
> and the [plan](docs/plan.md) tracks progress.

---

## How it works

Diaspore is one Go binary. The system under test is a set of **florets**: separate programs
that Diaspore starts, feeds events to, and listens to. A floret can be written in any language
that can read and write lines of JSON.

Diaspore owns everything a floret would normally get from the outside world:

- **Time** is virtual. It advances only when Diaspore says so, so a two-minute scenario runs in
  a fraction of a second.
- **The network** is simulated. Every message passes through Diaspore, which decides when it
  arrives, or whether it arrives at all.
- **Faults** such as delays, drops, duplicates, crashes, and partitions come from rules in a
  config file.
- **Client load** comes from the same seeded scheduler, so the workload replays too.

All of it is driven by one seed. Diaspore sends one event to one floret, waits for its reply,
and only then moves on. Nothing races, so nothing can differ between two runs.

```
      diaspore.yaml + seed
               │
               ▼
   ┌───────────────────────────────┐
   │ Diaspore                      │
   │ virtual clock · event queue   │
   │ seeded faults · workload      │
   └───────┬───────────────▲───────┘
           │ one event     │ one reply
           ▼               │
   ┌───────────────────────────────┐
   │ floret: any program           │
   │ JSON lines on stdin / stdout  │
   └───────────────────────────────┘

   trace ──▶ history ──▶ checkers ──▶ .pappus on failure
```

Every run writes a trace of every event, fingerprinted with a hash. Checkers read the history
of what clients asked and got back, and flag any run that broke a rule.

---

## CLI

Planned for v0.1:

| Command | What it does |
|---|---|
| `diaspore run --seed <n>` | Execute one simulated run under a given seed |
| `diaspore dandelion --seeds <range> --workers <n>` | Sweep many seeds in parallel and report the ones that broke a checker |
| `diaspore replay <file.pappus>` | Reproduce an identical run and verify its trace hash |
| `diaspore check-determinism --seed <n>` | Run one seed twice and point to the first line where the traces differ |

A seed alone does not reproduce a run. The cluster size, workload, fault rules, floret programs,
and protocol version all participate. A `.pappus` file carries them together: the seed, the full
resolved config, a hash of each floret program, and the expected trace hash. Handing someone that
file hands them the entire failure.

---

## Configuration

A run is described by `diaspore.yaml`:

```yaml
version: 1
nodes:
  count: 3
  command: ./kvnode
workload:
  type: kv
  clients: 3
  ops: 200
faults:
  - fault: delay
    amount: 1ms-50ms
  - fault: drop
    chance: 0.02
  - fault: crash
    every: 5s-20s
    restart_after: 1s-3s
checkers:
  - acked-writes
run:
  duration: 120s
```

Faults are building blocks. Rules combine them by choosing which messages, what goes wrong,
and how often.

---

## The protocol

The protocol is the product. There is no required SDK. A floret reads one JSON event per line
on stdin and writes exactly one reply per line on stdout.

Three events go in: `init`, `message`, and `timer`. One reply comes out: `done`.

```json
{"type": "message", "time": 1250, "from": "n2", "body": {"op": "put", "key": "x", "value": 5}}
```

```json
{"type": "done", "send": [{"to": "n2", "body": {"op": "ack"}}], "set_timers": [{"id": "retry", "after": 500}]}
```

Every floret must follow five rules:

1. Do work only inside the handler for the current event.
2. Never read the real clock. Use the `time` field.
3. Never open network connections. Use `send`.
4. Never use unseeded randomness. Use the seed given in `init`.
5. Keep anything that must survive a crash in `store`.

A full spec with JSON Schema files will live in `PROTOCOL.md`.

---

## Determinism, and how it is protected

One stray clock read, one map iteration, or one unseeded random call, and replay breaks
silently. Silently is the whole problem.

`check-determinism` runs the same seed twice and diffs the traces byte for byte. CI runs it on
every commit. If that check goes red, nothing else in the repo can be trusted.

Diaspore cannot stop a floret written in another language from breaking the rules. It can only
catch it. Each language has its own traps, such as randomized hash ordering or unseedable random
functions, and `PROTOCOL.md` will list the known ones.

---

## Roadmap

**v0.1, the course version**

- Deterministic core: event queue, virtual time, one seed, trace hash
- Protocol v1 with JSON Schema
- Lockstep process driver with a hang watchdog
- Timers, durable storage, crash and restart
- Faults: delay, drop, duplicate, crash, partition
- Seeded workload and client history
- Checkers: acknowledged writes are never lost, and linearizability via
  [Porcupine](https://github.com/anishathalye/porcupine)
- An example replicated key-value floret in Go, with one planted bug
- One small floret in a second language
- `run`, `dandelion` across all CPU cores, `replay`, `check-determinism`
- `.pappus` v1
- Scaling measurements for sweeps

**Later**

- `dandelion` across many machines
- An HTML timeline viewer for traces
- A GitHub Action that fails a pull request and attaches the `.pappus` file
- An optional Go SDK

**Not planned for now:** a live production runtime, disk faults, clock skew, shrinking failing
runs, and binary encodings.

---

## What Diaspore is not

- It does not test existing services unchanged. Florets must follow the protocol.
- It does not prove a system correct. It finds bugs; it cannot show there are none.
- It does not model real TCP behavior, kernel scheduling, or disk timing.

---

## Prior art

The ideas are not new. Diaspore borrows whole-system simulation from a single seed from
[FoundationDB](https://apple.github.io/foundationdb/testing.html) and TigerBeetle's VOPR, and
the language-agnostic JSON protocol from Jepsen's
[Maelstrom](https://github.com/jepsen-io/maelstrom).

Related tools worth knowing: gosim and detsim for Go, turmoil and madsim for Rust, and
Antithesis as a commercial platform. Diaspore aims to be a small, open take on these ideas.

---

## Naming

Every term comes from *Taraxacum*, the dandelion. A capitulum holds florets, a pappus carries a
seed, and a dandelion scatters thousands at once. Structures get botanical names; actions get
plain verbs, so the commands read as English while the nouns carry the theme.

The full reference, including terms deliberately rejected, is in
[`docs/naming.md`](docs/naming.md).

---

## Documentation

| Document | What is in it |
|---|---|
| [`docs/design.md`](docs/design.md) | The pieces, the event model, the decisions, and why |
| [`docs/plan.md`](docs/plan.md) | Schedule, checkpoint tracker, milestones, and gates |
| [`docs/naming.md`](docs/naming.md) | Naming reference, including terms deliberately rejected |

Coming during the build: `PROTOCOL.md`, the full floret protocol, and `docs/findings.md`, the
seeds that broke checkers and why.

---

## Development

```bash
go build ./cmd/diaspore
go test ./...
```

---

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">
<sub>Built for CS 6650 (Building Scalable Distributed Systems) at Northeastern University, Fall 2026.</sub>
</div>
