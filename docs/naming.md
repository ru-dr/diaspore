# Naming

Every term comes from *Taraxacum*, the dandelion. Structures get botanical names. Actions get
plain verbs, so commands read as English while the nouns carry the theme.

Keep this open while writing code.

---

## The five terms

| Term | In the dandelion | In Diaspore |
|---|---|---|
| **Diaspore** | Any part of a plant that disperses and grows a new plant | The project and the binary |
| **Capitulum** | The flower head that holds many small florets | The set of florets in one run |
| **Floret** | One of the small flowers in the head | A node: a program that speaks the Diaspore protocol |
| **Pappus** | The fluffy parachute that carries a seed | The replay file, with the `.pappus` extension |
| **Dandelion** | The whole plant, scattering thousands of seeds at once | The parallel seed sweep |

Plurals are **florets** and **capitula**. Never "capitulums."

---

## Commands

Verbs stay plain so the interface describes itself.

```bash
diaspore run --seed 8837421
diaspore dandelion --seeds 1-1000 --workers 8
diaspore replay run-8837421.pappus
diaspore check-determinism --seed 8837421
```

File extension: `.pappus`

---

## Vocabulary in prose

Use the botanical term when you mean the specific component. Use the plain word when speaking
generally.

| Write this | Not this |
|---|---|
| "the capitulum had three florets" | "the cluster of capitula" |
| "floret 2 was cut off from the majority" | "node 2 (a floret) was cut off" |
| "saved to a pappus" | "saved to a pappus file file" |
| "the dandelion found 3 failing seeds" | "the dandelion sweep sweep" |

---

## Names deliberately not used

Each was considered and rejected. Do not reach for them later.

| Term | Why not |
|---|---|
| **Achene** | The seed body itself. It overlaps with pappus: two words for one artifact. |
| **Clock** (the white seed head) | Collides with the virtual clock. |
| **Receptacle** | Real anatomy, but nothing in the system matches it. |
| **Taproot** | Suggests long-lived persistence. Floret storage exists only to survive simulated crashes, so the name would overpromise. |
| **Flocci** | Sounds like Floci, a local AWS emulator. |
| **Ramet**, **Stolon**, **Scion** | Clonal-plant vocabulary, not dandelion. Wrong organism. |

---

## Before adding a sixth term

All three must be true, or use a plain English name instead:

1. It is a real part of a dandelion, not a general botanical word.
2. Something in the system matches it one to one.
3. A reader who skips this page can still follow the code.

Five terms is already the limit of what a metaphor carries before it becomes a glossary people
have to memorize.

---

## Package and type names

Package names are set in the repository layout in [`design.md`](design.md). Type and function
names are yours to choose during the checkpoints. Use this vocabulary when you name them, and
follow the test above for anything new.
