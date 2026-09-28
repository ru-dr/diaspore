# Plan

September 23 to December 14, 2026.

This file tracks progress. The full checkpoint details, with "Decide first" questions and
"Tests first" lists, are in the build guide: [`build-guide.pdf`](build-guide.pdf).

Every must-have ships. There are no cuts. The two gates below only ever drop bonus items.

---

## Assumptions

- About 8 to 10 hours a week go to Diaspore. Each checkpoint is sized for 2 to 4 hours.
- Course work is due Mondays at 9am Vancouver time, so Sundays stay free for assignments.
- Thanksgiving is Thursday, November 26. That week is planned light.
- Confirm the final project due date and presentation date on the syllabus.

---

## Calendar

| Week | Dates | Phase | Checkpoints | Milestone |
|---|---|---|---|---|
| 1 | Sep 23 to 27 | Ground | CP0 | |
| 2 | Sep 28 to Oct 4 | Core | CP1 to CP3 | |
| 3 | Oct 5 to 11 | Core | CP4 to CP6 | A, Oct 11 |
| 4 | Oct 12 to 18 | Protocol | CP7 to CP9 | |
| 5 | Oct 19 to 25 | Protocol | CP10 to CP12 | B, Oct 25, Gate 1 |
| 6 | Oct 26 to Nov 1 | First bug | CP13 to CP14 | |
| 7 | Nov 2 to 8 | First bug | CP15 to CP16 | |
| 8 | Nov 9 to 15 | First bug | CP17 to CP19 | C, Nov 15 |
| 9 | Nov 16 to 22 | Finish | CP20 to CP21 | |
| 10 | Nov 23 to 29 | Finish, light week | CP22 to CP23 | D, Nov 29, Gate 2 |
| 11 | Nov 30 to Dec 6 | Bonus | B1, then B2 | |
| 12 | Dec 7 to 13 | Wrap-up | Report, demo, buffer | Semester ends Dec 14 |

---

## Checkpoints

### Phase 0: Ground

- [ ] **CP0** A repo that tests itself: CI runs the tests on Linux, macOS, and Windows

### Phase 1: The deterministic core

- [ ] **CP1** Virtual clock: a clock that moves only when the simulator moves it
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

---

## Milestones

### A: Deterministic core, Sunday, October 11

- [ ] Ping-pong runs over the simulated network
- [ ] The same seed gives the same hash, every time
- [ ] The core has no goroutines and no real clock

### B: Real processes in lockstep, Sunday, October 25

- [ ] Real floret processes run in lockstep, with timers
- [ ] Crash and restart work, with storage
- [ ] `check-determinism` catches a bad floret
- [ ] Blog post 1 is published

### C: The first bug, end to end, Sunday, November 15

- [ ] A sweep finds the planted bug
- [ ] The `.pappus` file replays it with the same hash
- [ ] A short demo is recorded: sweep, failure, replay

### D: Every must-have is done, Sunday, November 29

- [ ] Every must-have works and is tested
- [ ] v0.1.0 is tagged, with binaries for Linux, macOS, and Windows

---

## Gates

**Gate 1, October 25.** If Milestone B is not working, drop every bonus item and put that time
into the must-haves.

**Gate 2, November 29.** If Milestone D is not done, skip the bonus week and use it to finish the
must-haves.

---

## Bonus, only after Milestone D

- [ ] **B1** The dandelion across machines
- [ ] **B2** HTML timeline viewer
- [ ] **B3** GitHub Action that attaches the `.pappus` file
- [ ] **B4** Optional Go SDK helper

---

## Wrap-up, December 7 to 13

- [ ] Report: problem, design, faults and checkers, results, limits, future work, related work
- [ ] Demo: sweep, failure, pappus, replay, and the timeline if B2 exists
- [ ] Blog post 3
- [ ] Two days kept as buffer
