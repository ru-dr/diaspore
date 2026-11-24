# 0008. Strict Replies, Lenient Events

## Status

Accepted, 2026-11-21

## Context

If Diaspore ignored unknown reply fields, a typo such as `set_timer` instead of `set_timers` would silently drop the timer, and the run would look like a real liveness bug. In the other direction, Diaspore needs room to add optional event fields without breaking older florets.

## Decision

Replies are strict. Unknown fields, wrong types, and out-of-range values are protocol errors. Only `type` is required, a missing list means an empty one, and `protocol` is also required in the reply to `init`.

Events are lenient. Florets ignore fields they do not know.

Diaspore checks replies at run time with Go code in `internal/protocol`, not with the JSON Schema. A test runs every example file through both the schema and the Go code, and fails if they disagree.

We rejected validating with the schema at run time. It is slower on every event, and the checks that depend on context still need Go.

## Consequences

Floret mistakes fail with a message that names the field, and the Go code and the schema cannot drift apart without a failing test, but the rules are written twice, and the tests depend on `santhosh-tekuri/jsonschema`.
