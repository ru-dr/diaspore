# Naming reference

**Seeds for failures.** Keep this open while writing code.

CS 6650 — Building Scalable Distributed Systems · Fall 2026

---

## The rule

Every name is taken from a single organism — *Taraxacum*, the dandelion.
Structures get botanical names; actions get plain verbs.

If a new botanical word suggests itself mid-file, stop: it means the concept has
no real counterpart in the plant, and a plain English name is correct.

## Terms

| Term | In botany | In code |
|---|---|---|
| Diaspore | Seed plus the structures carrying it | Project, module path, binary |
| Capitulum | The flower head | A cluster instance |
| Floret | One flower within the head | A single node |
| Pappus | The parachute | The portable run manifest |
| Dandelion | Releases thousands of diaspores at once | The parallel sweep |

Containment order, which the code mirrors: a **Dandelion** sweep spawns many
**Capitula**, each holding several **Florets**, each run exporting one
**Pappus**.

Plurals are *florets* and *capitula*. Never *capitulums*.

## Packages

| Package | Holds |
|---|---|
| `core/` | `Floret` and its state machine |
| `capitulum/` | Owns florets, drives the event loop |
| `pappus/` | Run manifest: read, write, validate |
| `dandelion/` | Parallel seed execution |
| `check/` | Invariant checking |
| `real/` | Live runtime over TCP |

Module path: `github.com/ru-dr/diaspore`

## Identifiers

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

## Command line

Verbs stay plain so the interface self-describes; nouns carry the theme.

| Command | Function |
|---|---|
| `diaspore run --seed <n>` | One simulated run |
| `diaspore dandelion --seeds <n>` | Sweep many seeds |
| `diaspore pappus export --seed <n>` | Write a run manifest |
| `diaspore pappus replay <file>` | Reproduce a run |
| `diaspore verify <file>` | Check for violations |
| `diaspore real --peers <list>` | Run over TCP |
| `diaspore watch` | Live terminal view |

File extension: `.pappus`

## Names deliberately not used

Each was considered and rejected. Do not reach for them later.

| Term | Why not |
|---|---|
| Achene | The seed body; overlaps with pappus |
| Clock (the seed head) | Collides with logical clocks |
| Receptacle | Nothing in the system corresponds to it |
| Taproot | Implies persistence, which there is none of |
| Flocci | Collides with Floci, the local AWS emulator |
| Ramet, Stolon, Scion | Clonal-plant vocabulary; wrong organism |

## Before adding a sixth term

All three must hold, or use a plain English name instead.

1. It is a real part of a dandelion, not a general botanical word.
2. Something in the code corresponds to it one-to-one.
3. A reader who skips this page can still follow the code.

Five terms is the limit at which a metaphor still helps rather than becoming a
glossary the reader has to memorise.
