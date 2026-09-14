<div align="center">

# Diaspore

**Seeds for failures.**

Deterministic replay and scalable failure search for replicated systems.

[![Go](https://shieldcn.dev/badge/Go-1.27.1-00ADD8.svg?logo=go&logoColor=white)](https://go.dev)
[![Terraform](https://shieldcn.dev/badge/Terraform-AWS-7B42BC.svg?logo=terraform&logoColor=white)](https://www.terraform.io)
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
| `diaspore verify <file>` | Check a run against all three invariants |
| `diaspore real --peers <list>` | Run over TCP against a live cluster |
| `diaspore watch` | Live terminal view of a running capitulum |

A seed alone does not reproduce a run — cluster size, workload profile, fault schedule and
protocol version all participate. A `.pappus` file carries them together with the event trace,
so handing someone that file hands them the entire failure. The workload is in there for the
same reason as the rest: a run that cannot be rebuilt from its manifest is not reproducible.

---

## How it works

The replication logic is a pure state machine. It takes one event at a time — a client
request, a message from a peer, a timer — and produces messages. It cannot read a clock,
sleep, generate randomness, or touch the network.

That restriction is the whole design. Something with a single input channel can be driven by a
scheduler, and a scheduler can be made to behave identically twice. Every capability the logic
does not have is an input nobody would control.

```
          ┌────────────────────────────────┐
          │   the pure core                │
          │   one event in, messages out   │
          └────────────────────────────────┘
                  ▲                ▲
      ┌───────────┴──────┐  ┌──────┴────────────┐
      │ deterministic    │  │ live runtime      │
      │ runtime          │  │ real clock, TCP   │
      │ virtual clock    │  │ real timers       │
      │ seeded faults    │  │                   │
      └────────┬─────────┘  └───────────────────┘
               │
               ▼
        run manifest ────▶ checker ────▶ violations
               │
               ▼
        the sweep: thousands of seeds in parallel
```

**Simulated** — one goroutine, a queue of scheduled events, a virtual clock that advances only
when the queue does, so a thirty-second scenario runs in milliseconds. Client load comes from
the same seeded scheduler; a load generator with its own clock would be a hole in the floor.

**Real** — a goroutine per floret, TCP with framing and timeouts, real timers, an HTTP
interface. Faults injected in-process rather than by touching the network, so an injected
partition is the same partition every time.

Hunt bugs in simulation, then check whether the real world agrees.

---

## Determinism, and how it is protected

One stray clock read, one map iteration, one goroutine inside the core, and replay breaks
silently — silently being the whole problem. A test runs the same seed twice and diffs the
recorded traces byte for byte, in CI on every commit.

If that test goes red, nothing else in the repo can be trusted. Why it compares bytes rather
than structures, and what that costs, is in [`docs/design.md`](docs/design.md).

---

## Naming

Every term comes from *Taraxacum*, the dandelion — a capitulum holds florets, a pappus carries
a seed, a dandelion scatters thousands at once. Structures get botanical names; actions get
plain verbs, so the commands above read as English while the nouns carry the theme.

The five terms, what each corresponds to, and the ones deliberately rejected are in
[`docs/naming.md`](docs/naming.md). Keep it open while writing code.

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

---

<sub>The documents are checked against each other on every push:
<code>python3 scripts/check_docs.py</code>. Each rule in it exists because that
drift happened once.</sub>
