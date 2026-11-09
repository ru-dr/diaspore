# Plan

October 29 to December 14, 2026. A team of three.

This file tracks progress. The full checkpoint details, with "Decide first" questions and
"Tests first" lists, are in the build guide: [`build-guide.pdf`](build-guide.pdf). If the two ever
disagree, the build guide wins.

Every must-have ships. The gates below only ever drop bonus items. The one exception is CP24,
which has a smaller fallback at Gate 2.

---

## Assumptions

- Three people share the work. Each checkpoint is sized for 2 to 4 hours of one person.
- CP1 to CP24 is about 48 to 96 hours in all, or 16 to 32 hours each. The team finishes four to
  five checkpoints a week. Hours per person per week are still open in the team guide.
- Project deadlines use Vancouver time. The Vancouver clock stays at UTC-7 all year. After
  November 1, Boston is two hours ahead, so 9am in Vancouver is 11am in Boston.
- Thanksgiving is Thursday, November 26. That week is planned light.
- The syllabus is tentative. Check Canvas and Piazza for changes.

---

## Deadlines

| Due (Vancouver) | What | Notes |
|---|---|---|
| Mon Nov 23, 9am | Project Liftoff: Project Proposal and Team Charter | 11am Boston. Draft by Wed Nov 18, submit by Sun Nov 22. |
| Mon Dec 14, 9am | Final Project deliverables (20%) | 11am Boston |
| Mon Dec 14, 1 to 3pm | Final Project presentations | 3 to 5pm Boston |

---

## Calendar

| Week | Dates | Phase | Checkpoints | Milestone |
|---|---|---|---|---|
| 1 | Oct 29 to Nov 1 | Core | CP1, CP2, CP3, CP7, in parallel (one person takes two) | |
| 2 | Nov 2 to 8 | Core, then protocol | CP4 to CP6, CP8, CP9 | A, Nov 8 |
| 3 | Nov 9 to 15 | Protocol | CP10 to CP14 | B, Nov 15, Gate 1 |
| 4 | Nov 16 to 22 | First bug | CP15 to CP17, CP22, and Project Liftoff | Liftoff due Nov 23 |
| 5 | Nov 23 to 29 | First bug, light week | CP18, CP19, CP21, and the CP24 design | C, Nov 29 |
| 6 | Nov 30 to Dec 6 | Finish and scale out | CP20, build CP24, then CP23 | D, Dec 6, Gate 2 |
| 7 | Dec 7 to 13 | Wrap-up | Report, poster, demo, buffer | Due Dec 14 |

---

## Checkpoints

### Phase 0: Ground

- [x] **CP0** A repo that tests itself: CI runs the tests on Linux, macOS, and Windows

### Phase 1: The deterministic core

- [x] **CP1** Virtual clock: a clock that moves only when the simulator moves it
- [ ] **CP2** Event queue: always hands back the earliest event
- [ ] **CP3** One seed, many streams: every random choice comes from one seed
- [ ] **CP4** The loop: take the next event, run its handler, repeat
- [ ] **CP5** Trace and hash: every run gets a fingerprint
- [ ] **CP6** Simulated network: messages travel through Diaspore with seeded delay

### Phase 2: Real processes and the protocol

- [ ] **CP7** Protocol spec v1: `PROTOCOL.md` and JSON Schema files
- [ ] **CP8** Talking to one process: start a floret, send `init`, read the reply
- [ ] **CP9** Lockstep driver: one event, one reply, repeat, with a hang watchdog
- [ ] **CP10** Timers: florets can set and cancel timers
- [ ] **CP11** Storage, crash, and restart: stored state survives a crash
- [ ] **CP12** `check-determinism`: run one seed twice and compare

### Phase 3: The first real bug

- [ ] **CP13** Config file: `diaspore.yaml` describes a whole run
- [ ] **CP14** Faults: delay, drop, and duplicate
- [ ] **CP15** Crash schedule and partitions
- [ ] **CP16** Workload and history: seeded clients, and a record of what happened
- [ ] **CP17** Example key-value floret with a planted bug
- [ ] **CP18** Checker: acked writes are never lost
- [ ] **CP19** `.pappus`, replay, and the first sweep

### Phase 4: Finish the must-haves

- [ ] **CP20** Parallel dandelion and scaling numbers
- [ ] **CP21** Linearizability checker with Porcupine
- [ ] **CP22** One tiny raw floret in a second language
- [ ] **CP23** Docs and release v0.1.0
- [ ] **CP24** Dandelion across machines: a coordinator hands out seed ranges to workers, and
  survives a dead worker (formerly bonus B1)

---

## Milestones

### A: Deterministic core, Sunday, November 8

- [ ] Ping-pong runs over the simulated network
- [ ] The same seed gives the same hash, every time
- [ ] The core has no goroutines and no real clock
- [ ] `PROTOCOL.md` is written

### B: Real processes in lockstep, Sunday, November 15

- [ ] Real floret processes run in lockstep, with timers
- [ ] Crash and restart work, with storage
- [ ] `check-determinism` catches a bad floret
- [ ] Blog post 1 is published

### C: The first bug, end to end, Sunday, November 29

- [ ] A sweep finds the planted bug
- [ ] The `.pappus` file replays it with the same hash
- [ ] A short demo is recorded: sweep, failure, replay

### D: Every must-have is done, Sunday, December 6

- [ ] Every must-have works and is tested
- [ ] `dandelion` runs on at least two machines and four workers, with scaling charts for one
  machine and for several, and the bottleneck named
- [ ] v0.1.0 is tagged, with binaries for Linux, macOS, and Windows

---

## Gates

**Gate 1, November 15.** If Milestone B is not working, drop bonus items B2 to B5 now and put
that time into the must-haves. CP24 stays.

**Gate 2, December 6.** If Milestone D is not done, shrink CP24 but keep its core: the
coordinator re-sends a dead worker's seeds to another worker. Drop workers joining in the middle
of a sweep, and tuning the range sizes. Dead-worker recovery is the last thing to cut. If it is
cut, write it up as a limit. Every other must-have ships in full.

---

## Bonus, only if Milestone D lands early

Do these in order. They never take time from a must-have.

- [ ] **B2** HTML timeline viewer
- [ ] **B3** GitHub Action that attaches the `.pappus` file
- [ ] **B4** Optional Go SDK helper
- [ ] **B5** etcd's Raft library, wrapped as a floret

---

## Wrap-up, December 7 to 13

Freeze the code and the experiment runs by Wednesday, December 9. Write after the freeze. Keep
Saturday and Sunday as buffer, and submit by Sunday night.

- [ ] Report: problem, design, why Diaspore is a distributed system, faults and checkers,
  results, limits, future work, related work
- [ ] Project management write-up: how the design moved, who worked on what, and the problems
- [ ] Experiments write-up as a PDF, at most five pages
- [ ] A solo reflection from each of the three of us, at most five pages
- [ ] Poster, and the blog report (details come later in the semester)
- [ ] Demo: sweep, failure, pappus, replay, and the timeline if B2 exists
- [ ] Blog post 3
