# Build plan

Aligned to the CS 6650 schedule. Every deadline is **Monday 9:00 AM Vancouver time**, exactly
16:00 UTC, and the clock does not shift for DST at any point in the semester.

Assignments take precedence in every week. Project work is what fits after that. The two
mastery weeks are planned as near-zero project weeks.

The milestones from 10/26 onward are the ones stated in the technical document. The weeks
before it are the runway that gets you to the first of them.

---

## Week of 09/14

- [ ] `docs/design.md`: the event model, the invariants, the two modes and their exact ack rules
- [ ] `docs/naming.md`: the naming reference, committed so it stops drifting
- [ ] `go mod init github.com/ru-dr/diaspore`, package skeleton, `Makefile`, README
- [ ] `deploy/Dockerfile` and `docker-compose.yml`

**Deliverable:** a design doc someone else could build from, and a repo that builds nothing.

---

## Week of 09/21

- [ ] `core/event.go`, `core/message.go` — types only, no logic
- [ ] `core/floret.go` — the `Step(event) -> []Message` signature, stubbed
- [ ] `core/store.go` — in-memory versioned key-value map
- [ ] Freeze the message envelope format

**Deliverable:** the event model exists in code and compiles.

---

## Week of 09/28

- [ ] `capitulum/queue.go`, `capitulum/clock.go` — priority queue and virtual clock
- [ ] `capitulum/capitulum.go` — `New(n, seed)`, `Step() bool`, `Florets()`
- [ ] `capitulum/rand.go` — the single seeded randomness source
- [ ] `core/mode_primary.go` — primary-backup, ack immediately, fanout after

**Deliverable:** one simulated run advances through events on a virtual clock.

---

## Week of 10/05

- [ ] `capitulum/trace.go` — record every event with its logical timestamp
- [ ] **`capitulum/determinism_test.go`** — same seed twice, byte-diff the traces
- [ ] `.github/workflows/ci.yml` and wire the determinism test into it
- [ ] `capitulum/faults.go` — first fault: crash

**Deliverable:** determinism proven and protected in CI. Do not let this slip past this week —
every result downstream depends on it.

---

## Week of 10/12

- [ ] `cmd/diaspore/main.go` — CLI skeleton and dispatch
- [ ] `cmd/diaspore/run.go` — `diaspore run --seed`
- [ ] `capitulum/faults.go` — add crash-restart and message drop
- [ ] `real/api.go` — HTTP key-value endpoints

**Deliverable:** one command runs a seeded simulation with a crash in it, twice, identically.

---

## Week of 10/19

- [ ] `capitulum/faults.go` — add delay, reorder, partition. All six present
- [ ] `real/admin.go` — in-process fault injection endpoints
- [ ] `cmd/loadgen` — configurable concurrency, per-request timing log
- [ ] Rehearse the proposal demo

**Deliverable:** proposal demo ready — run a seed, show the failure, run it again, show it
identical.

> The proposal presentation is 1–3 PM on 10/26 and Assignment 6 is due 9 AM the same day. The
> proposal has to be substantially finished during this week.

---

## Week of 10/26 — Proposal presentation, 1–3 PM PDT

Stated milestone: event model and core skeleton complete. Build nothing new.

- [ ] Slides: the problem, the seed idea, the determinism diff, the three scaling axes
- [ ] Present
- [ ] Write down what Coady says about scope and edit this file the same day

---

## Week of 11/02 — Midterm mastery

**15% of your grade.** Assume zero project time.

- [ ] Midterm mastery
- [ ] If any time is left: `pappus/format.go` manifest schema, on paper only

---

## Week of 11/09

Stated milestone: simulated runtime, virtual clock, determinism test in CI. If the runway weeks
above held, this is already done and this week buys you slack — use it on the sweep, not on
polish.

- [ ] `core/version.go` — version vectors, comparison, conflict resolution
- [ ] `pappus/write.go`, `pappus/read.go` — export and load a run
- [ ] `cmd/diaspore/pappus.go` — `pappus export` and `pappus replay`

**Deliverable:** hand a `.pappus` file to another machine and get the identical run.

---

## Week of 11/16

Stated milestone: fault controller, logical clocks, both replication modes.

- [ ] `core/clock.go` — logical clocks driven only by `Step`
- [ ] `core/mode_quorum.go` — write commits only after majority ack
- [ ] `core/mode_primary.go` — proper follower state, heartbeats, lease expiry
- [ ] Document what happens when the static primary dies — that failure is a finding, not a bug

**Deliverable:** both modes runnable under the same seed, with distinct failure classes.

---

## Week of 11/23

Stated milestone: invariant checker, parallel sweep, first findings. This is the heart of the
project.

- [ ] `check/invariants.go`, `lostwrites.go`, `staleness.go`, `ownership.go`
- [ ] `cmd/diaspore/verify.go`
- [ ] `dandelion/sweep.go`, `worker.go`, `report.go`
- [ ] `cmd/diaspore/dandelion.go`
- [ ] First thousand-seed sweep, record what it finds
- [ ] Axis 1 and axis 2 data: violation rate and convergence time against cluster size at
      3, 10, 25, 50, 100, 200; sweep throughput against worker count
- [ ] **Start the written report draft**

**Deliverable:** a list of seeds that break invariants, and two of the three scaling axes
measured.

---

## Week of 11/30

Stated milestone: Terraform environment, real mode on EC2, validation runs.

- [ ] `deploy/floci-compose.yml`, `infra/floci.tfvars` — validate the infra path locally first
- [ ] `infra/*.tf` — VPC, EC2 florets, security groups
- [ ] `infra/user_data.sh` — bootstrap and start
- [ ] `diaspore real --peers` against the live cluster at 3, 5 and 8 florets
- [ ] Axis 3: reproduce one sweep finding on real hardware
- [ ] **Poster draft**

**Deliverable:** `make infra-up`, run, `make infra-down`. Then down, and confirmed down.

---

## Week of 12/07 — Final mastery

**15% of your grade.** Freeze the code.

- [ ] Final mastery
- [ ] `scripts/plot.py` — the five figures
- [ ] `docs/findings.md` — the seeds, the violations, simulated versus real
- [ ] Commit reproductions to `testdata/`
- [ ] Finish report and poster
- [ ] `diaspore watch`, only if everything above is done

---

## Week of 12/14 — Final presentation, 1–3 PM PDT

- [ ] Slides
- [ ] Rehearse the live replay — pick one seed and know exactly what it does
- [ ] Blog post
- [ ] Present

---

## If you fall behind

Cut in this order. Each cut leaves a project that still stands on its own.

1. `diaspore watch` — presentation polish, and the static figures carry you
2. Real mode on AWS, and axis 3 with it — the simulated half is a complete result
3. Quorum mode — one mode is enough to demonstrate the idea
4. Message reorder and delay faults — crash and partition carry the point
5. Version vectors — last-write-wins by timestamp will do

Never cut: the determinism test, the `.pappus` format, or the sweep. Those three *are* the
project.

---

## Known risks

| Risk | Why it bites | Mitigation |
|---|---|---|
| Determinism leakage | One unguarded clock read, map iteration or stray goroutine in `core/` breaks replay silently | Same-seed byte-diff test in CI from 10/05 onward. Load-bearing: if it fails, no other result can be trusted |
| Benchmark noise on shared cloud hardware | Absolute EC2 timings are unreliable | Report relative behaviour and curve shape, not absolute latency |
| 200-floret simulated runs may not finish in reasonable time | Message count grows with the square of cluster size in quorum mode | Check the 200-floret cost early, in the 10/05 week, on one seed. If it is too slow, say so in the proposal rather than discovering it in November |
| Floci EC2 coverage is partial | The claim that the same Terraform is exercised locally and on hardware may not hold for EC2 instances | Verify what Floci actually supports before 11/30. Treat it as syntax and plan validation, not a substitute for the real runs |
| AWS credit limits and instance termination between sessions | No state survives | Already assumed in the design. Confirm instances are down after every session |

---

## Bookkeeping

- Homework is 50% off until 11:59 PM the same day, zero after. Masteries and the project have
  no late window at all
- One no-penalty extension for the whole semester, requested before the deadline
- Regrade window is 72 hours from grades being released
- Any online source whose idea you use gets a citation block at the top of the code file.
  Substantive discussion with a classmate gets cited in the report
