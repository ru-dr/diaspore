# 0003. Virtual clock

## Status

Accepted, 2026-10-06

## Context

The problem was what the data shape of the virtual clock should be, or in simple words, how we are going to store the time of the virtual clock. Real time can't be used, because to replay an issue we need control over the clock, as we are going to use a deterministic seed.

## Decision

I chose int64 as my base data shape, using a Go defined type. With int64, I have 292,000 years before it overflows. Since every simulation restarts the clock from 0, that is not going to be an issue.

The unit is microseconds, as I think the smaller the unit, the better for more granular control.

The loop will move the clock forward, and moving it back returns an error. This will be an unexported method, so outside code can read the clock but can't update it.

## Consequences

Other packages can read the clock, but only code in internal/sim/ can move it.