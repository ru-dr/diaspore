# 0010. Floret Failures and Crashes

## Status

Accepted, 2026-11-21

## Context

A floret can break the protocol by sending bad JSON, using an unknown field, exiting on its own, or hanging. Diaspore can also crash a floret on purpose. Both need defined behavior, or a real bug either hides or looks random.

## Decision

Any protocol break stops the run and is recorded as a failure with a `.pappus` file, the same as a checker failure, because the seed reproduces it. The reason names the floret and the problem. A version mismatch is the exception. It is a plain error before the simulation starts.

A floret that exits on its own is a failure and is never restarted. On an unknown event type, a floret writes to stderr and exits with a nonzero code.

A real-time watchdog catches hangs. It waits 10 seconds by default, can be changed in `diaspore.yaml`, and never affects virtual time. A hang is marked as a hang, because machine speed can change whether it happens.

A crash kills the process without warning, and only `store` survives. The floret's pending timers are cancelled, and messages that arrive while it is down are dropped. Messages still in flight when it restarts are delivered normally. These crash rules belong to CP11 and are decided here early.

## Consequences

Floret bugs found during a sweep are saved and replay like any other failure, and a restart never hides a real panic, but nodes that assume every message eventually arrives will fail. That is the kind of bug Diaspore exists to find. Bugs caused by partial disk writes cannot be found, because a crash only lands between events.
