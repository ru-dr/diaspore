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
> - `plan.md` 09/14 lists it as the week's deliverable, and 09/21 freezes the
>   message envelope — so the read path has to be settled before that freeze,
>   not after it.

## Event model

## Messages

## The read path

The single question the other documents are waiting on. Read quorum, follower
routing and the caching claim are all this one thing, and the shape three
files already assume is:

- A read names its client and the floret that answers it:
  `ClientRead{Client ClientID, Key, At FloretID}`. A client is a numbered
  request stream from the workload profile, which is what makes monotonic
  reads groupable at all.
- Which floret a read is addressed to comes from the profile's read-target
  policy — uniform, primary, or pinned per client — so it is in the manifest
  and not in `workload.go`.
- In quorum mode that floret gathers a majority using `Read`/`ReadReply` and
  returns the newest version it sees. The bound is zero, and violable.
- In primary-backup that floret answers from its own store. The primary is
  fresh; a follower is stale by however much, and that is measured rather than
  bounded.
- `real/api.go` carries the same selector over HTTP, or there is no follower
  staleness to measure on real hardware.

What this section still owes:

- Which version a read quorum returns when replies disagree, and whether it
  writes the winner back.
- Whether a read quorum is allowed to fail rather than return a stale value,
  and what the client sees when it does.
- Whether a follower read is allowed at all in quorum mode, or whether the
  mode implies the quorum path unconditionally.
- Whether a pinned client may be repinned mid-run, and if so whether
  monotonic reads still holds across the move. The profile allows pinning; it
  does not yet say whether the pin is permanent.
- What a `ClientReply` carries for a failed or timed-out operation, since
  invariant 1 only counts the ones that succeeded.

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
