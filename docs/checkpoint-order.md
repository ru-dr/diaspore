# Checkpoint order

A checkpoint can start when every checkpoint in its needs list is done. Same wave means they can
run in parallel.

| Wave | Checkpoint | Owner | Needs |
|---|---|---|---|
| 1 | CP1 Virtual clock | Rudra | nothing |
| 1 | CP3 Seed streams | Rudra | nothing |
| 1 | CP7 Protocol spec | Ash | nothing |
| 2 | CP2 Event queue | HK | CP1 |
| 2 | CP8 Process driver | Ash | CP7 |
| 3 | CP4 Main loop | HK | CP2 |
| 4 | CP5 Trace and hash | Rudra | CP4 |
| 4 | CP6 Simulated network | Rudra | CP2, CP3, CP4 |
| 4 | CP9 Capitulum | Ash | CP4, CP8 |
| 5 | CP10 Timers | Ash | CP9 |
| 5 | CP11 Crash storage | Ash | CP9 |
| 5 | CP12 Check-determinism | Ash | CP5, CP9 |
| 5 | CP13 Config | Rudra | CP7, CP9 |
| 5 | CP22 Second floret | Ash | CP9 |
| 6 | CP14 Fault rules | Rudra | CP6, CP13 |
| 6 | CP16 Workload | HK | CP4, CP13 |
| 6 | CP17 kvnode floret | HK | CP10, CP11 |
| 7 | CP15 Crash + partition | Ash | CP11, CP14 |
| 7 | CP18 Acked-writes checker | HK | CP16, CP17 |
| 7 | CP21 Linearizability | HK | CP16 |
| 8 | CP19 Pappus + sweep | Rudra | CP5, CP14, CP18 |
| 9 | CP20 Parallel sweep | Rudra | CP19 |
| 10 | CP24 Coordinator + workers | Rudra | CP20 |
| 11 | CP23 Docs + release | HK | CP20, CP21, CP22, CP24 |

CP12, CP15, CP21, and CP22 feed only the release, so they can move if a wave runs late.
