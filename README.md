<div align="center">

# Diaspore

**Seeds for failures.**

Deterministic replay and scalable failure search for replicated systems.

[![Go](https://shieldcn.dev/badge/Go-1.27.1-00ADD8.svg?logo=go&logoColor=white)](https://go.dev)
[![Terraform](https://shieldcn.dev/badge/Terraform-AWS-7B42BC.svg?logo=terraform&logoColor=white)](https://www.terraform.io)
[![CI](https://shieldcn.dev/github/ru-dr/diaspore/ci.svg?label=build)](https://github.com/ru-dr/diaspore/actions)
[![License](https://shieldcn.dev/badge/license-MIT-black.svg)](LICENSE)
[![Status](https://shieldcn.dev/badge/status-in_development-orange.svg)](docs/plan.md)

[Quick start](#quick-start) · [CLI](#cli) · [How it works](#how-it-works) · [Docs](#documentation)

</div>

---

Distributed systems fail on timing, and that timing differs on every run. A suite passes a
hundred times, fails once, passes again, and you never learn whether the defect was fixed or
merely avoided.

Diaspore pulls every source of that randomness into one place and drives it from a single seed.
Same seed, same execution, every time. A bug stops being an anecdote and becomes an address.

---

## Quick start

```bash
git clone https://github.com/ru-dr/diaspore
cd diaspore
go build ./cmd/diaspore
./diaspore run --seed 8837421 --faults crash,partition,delay
./diaspore dandelion --seeds 1000
```

`dandelion` scatters a thousand seeded runs and reports the ones that broke an invariant.

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

A seed alone does not reproduce a run — cluster size, fault schedule and protocol version all
participate. A `.pappus` file carries them together with the event trace, so handing someone
that file hands them the entire failure.

---

## How it works

The replication logic is a pure state machine expressed as `Step(event) -> []Message`. It
imports nothing that can read a clock, sleep, generate randomness, or touch the network.

That one constraint lets the same code run two ways.

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

**Simulated** — one goroutine, a priority queue, a virtual clock that advances only when the
queue does, so a thirty-second scenario runs in milliseconds. Fully deterministic.

**Real** — a goroutine per floret, TCP with framing and timeouts, real timers, HTTP key-value
API. Faults injected in-process rather than by touching the network.

Hunt bugs in simulation, then check whether the real world agrees.

---

## Determinism, and how it is protected

One stray clock read, one map iteration, one goroutine inside `core/`, and replay breaks
silently. A test runs the same seed twice and diffs the traces byte for byte, in CI on every
commit.

If that test goes red, nothing else in the repo can be trusted.

---

## Naming

Every term comes from *Taraxacum*, the dandelion. Structures get botanical names; actions get
plain verbs.

| Term | In code |
|---|---|
| Diaspore | Project, module path, binary |
| Capitulum | A cluster instance |
| Floret | A single node |
| Pappus | The portable run manifest |
| Dandelion | The parallel sweep |

Plurals are florets and capitula. Never capitulums. Full reference in
[`docs/naming.md`](docs/naming.md).

---

## Documentation

| Document | What is in it |
|---|---|
| [`docs/overview.md`](docs/overview.md) | The long form: scaling axes, fault model, invariants, figures |
| [`docs/technical.md`](docs/technical.md) | Architecture, the fault model, invariants, schedule and risks |
| [`docs/design.md`](docs/design.md) | Event model, ack rules per mode, the decisions and why |
| [`docs/structure.md`](docs/structure.md) | Package layout, import direction, key identifiers |
| [`docs/naming.md`](docs/naming.md) | Naming reference, including terms deliberately rejected |
| [`docs/plan.md`](docs/plan.md) | Week-by-week schedule, cut order, known risks |
| [`docs/findings.md`](docs/findings.md) | Seeds that broke invariants, and why |

---

## Development

```bash
make dev
make test
make sweep
make infra-up
make infra-down
```

Local AWS work runs against [Floci](https://github.com/floci-io/floci) on `localhost:4566`, so
Terraform is validated before any cloud spend. Its EC2 coverage is partial — see the caveat in
[`docs/overview.md`](docs/overview.md).

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
<sub>Built for CS 6650 (Building Scalable Distributed Systems) at Northeastern University, Fall 2026.</sub>
</div>
