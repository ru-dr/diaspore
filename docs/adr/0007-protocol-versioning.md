# 0007. Protocol Versioning

## Status

Accepted, 2026-11-21

## Context

Florets and Diaspore are built by different people at different times. A floret written against an older protocol would quietly ignore a renamed field and misbehave, and a checker would then report a bug that is really a version mismatch.

## Decision

The protocol version is a plain integer, currently 1.

`init` carries `"protocol": 1`. The floret's reply to `init` must carry the version it speaks. Diaspore checks it and stops before the simulation starts if it is missing or different.

Florets ignore unknown fields in events, so adding an optional event field needs no new version. Anything that could break an existing floret or an existing Diaspore bumps the number, including a new event type or a new reply field.

We rejected a check that lives only inside each floret, because authors forget it. We rejected a separate hello message, because it breaks the rule of one event in and one reply out.

## Consequences

One check in Go covers every floret in every language, and it repeats on every restart because a restart sends `init` again, but every floret must echo the version, and any breaking change means a new number that every floret has to adopt.
