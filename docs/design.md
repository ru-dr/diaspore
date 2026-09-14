# Design

Event model, ack rules per mode, and the decisions behind them.

> Not written yet. [`technical.md`](technical.md) is the guide for this file:
> it states the architecture, the fault model and the invariants, and this is
> where those become concrete decisions with reasons attached.
>
> Due **09/21, 9:00 AM**. Three other documents already defer to it:
>
> - `overview.md` and `technical.md` state the staleness bound per mode and
>   point here for the reasoning. `check/staleness.go` is unwritable until this
>   file justifies it.
> - `structure.md` cites this file for why primary-backup has no leases.
> - `plan.md` 09/14 lists it as the week's deliverable.

## Event model

## Messages

## Ack rules

### Quorum

*Write quorum, read quorum, and why the staleness bound is zero.*

### Primary-backup

*Why the primary acknowledges before fanout, what a follower read may return,
and why no bound is claimed for it — only monotonic reads.*

### Why no leases

*A lease implies the primary can be reassigned. There is no election here, so
say what happens when the static primary dies: writes stop, and that is a
finding.*

## Invariants

## Decisions and why

## Open questions
