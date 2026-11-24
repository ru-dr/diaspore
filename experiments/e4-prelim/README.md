# E4 preliminary: cost of one lockstep round trip

Measures what one event costs when the floret is a separate process: write one JSON line to its stdin, wait for one reply line on its stdout. This is the floor under experiment E4 (cost of lockstep), measured before the real process driver (CP8) exists.

## Run

From the repo root:

```bash
go run ./experiments/e4-prelim -lang go
```

```bash
go run ./experiments/e4-prelim -lang node
```

`-n` sets the number of measured round trips (default 20,000, after 1,000 warm-up). The `node` run needs Node.js installed.

## Results (Nov 22, 2026, Apple M4 Pro, macOS)

| Measure | Go floret | JavaScript floret |
| --- | --- | --- |
| Startup: spawn the process and get its first reply | 4.7 ms | 89.6 ms |
| Round trip, mean | 7.7 µs | 8.3 µs |
| Round trip, p50 / p95 / p99 | 7.8 / 11.1 / 13.2 µs | 7.4 / 13.7 / 22.8 µs |
| Max events per second for one floret | about 129,000 | about 120,000 |

Diaspore's own cost per event, from `go test -bench=. ./internal/protocol/`: decoding a reply takes 1.3 µs and encoding a message 0.2 µs.

## What it shows

- The process boundary (about 8 µs) costs about five times Diaspore's own work per event (about 1.5 µs).
- Spawning a floret costs about 600 round trips in Go and about 10,000 in JavaScript, so crash-heavy runs are dominated by restarts.
- JavaScript's median matches Go's, but its p99 is about 1.7 times higher.

## Limits

- One floret with trivial logic, so these are lower bounds on cost per event.
- One laptop; numbers will differ on cloud instances.
- Not yet the real driver: E4 repeats this with CP8, real florets, and growing floret counts.
