# 0009. Protocol Numbers

## Status

Accepted, 2026-11-21

## Context

Appendix A of the build guide never says what unit time is in, while the CP1 clock counts microseconds. JavaScript stores every number as a 64-bit float, which is exact only up to 2^53. A larger integer is silently rounded in a JavaScript floret, which breaks replay in that language only. ADR 0004 derives each floret's seed as a full uint64.

## Decision

`time` and `after` are integer microseconds, the same unit as `sim.Time`.

Every integer in the protocol stays from 0 to 2^53 - 1, including `rand_seed`. Diaspore masks each floret's derived seed into that range before sending it.

`after` must be at least 1 microsecond, so a floret can never stop virtual time from moving forward.

## Consequences

Go, Python, and JavaScript florets read every number exactly, and nothing is rounded between the clock and the protocol, but people who think in milliseconds can get the scale wrong, so every example in PROTOCOL.md uses realistic values such as 300000 for 300 ms. The 2^53 cap is about 285 years of virtual time, so it costs nothing in practice.
