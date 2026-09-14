# Design

What this system does and why it does it that way. The companion document,
[`technical.md`](technical.md), describes the apparatus; this file argues for
the decisions inside it. Where something is still open, it says so and says
what would settle it, rather than inventing an answer to look finished.

---

## The event model

Every input to a floret is an event: a client asking to write, a client asking
to read, a message arriving from a peer, or a timer firing. A floret consumes
one event and produces some messages. That is the whole interface.

The reason is not elegance. It is that a thing with one input channel and one
output channel can be driven by a scheduler, and a scheduler can be made
deterministic. Anything a floret could do behind that interface — read a
clock, sleep, spawn a goroutine, open a socket — is a second input channel
that the scheduler does not control, and therefore a source of variation
between two runs of the same seed. The rule that the core may not do any of
those things is not hygiene; it is what makes replay possible at all.

The cost is real and worth stating. Logic that would naturally be written as
"send this, wait for the acks, then commit" has to be turned inside out into
state held across events. Every pending write becomes a record with a tally
attached. That is more code and less obvious code than the blocking version,
and it is the price of the property the whole project rests on.

## Two modes, and why both

The system under test is an in-memory replicated key-value store. It is
deliberately unambitious, because it is apparatus rather than contribution.

It has two replication modes. Under **quorum**, a write is acknowledged once a
majority of florets have stored it. Under **primary-backup**, one statically
chosen floret acknowledges immediately and replicates to the others
afterwards.

Both exist because they fail differently, not because one is better. Quorum
trades latency for a guarantee that survives a minority failing. Primary-backup
trades that guarantee for latency, and in exchange offers a window — between
the acknowledgement and the fanout — in which an acknowledged write exists in
exactly one place. Losing a floret inside that window is a specific, findable
bug that quorum cannot produce. Comparing their latency is not an objective;
producing two distinct failure classes for the sweep to search is.

## What counts as an acknowledged write

The first invariant is that no acknowledged write is lost. That sentence is
only checkable if "acknowledged" has a recorded meaning, and for most of this
project's life it did not: florets acknowledge each other during replication,
and that is a different event from telling a client its write succeeded.

The decision is that a floret's reply to a client is one of the messages it
emits, like any other, and is therefore written to the trace with the time it
happened. The set of acknowledged writes is exactly the set of those replies.
The checker reads that set out of the trace and asks whether each one is still
present in the final state.

This costs something: a reply to a client is not a wire message between peers,
and putting both in one output channel means the channel carries two kinds of
thing. The alternative was a separate output for client responses, which would
have given the state machine two return paths and every runtime two things to
drain. One channel and a destination that may be a client is the smaller
complication.

## Client identity

Reads are asserted to be monotonic per client: one client, reading one key
from one floret, never sees the value go backwards. That requires knowing
which client issued a read, so every client operation carries an identity.

A client here is not a process or a connection. It is a numbered stream of
requests produced by the workload profile — a label that groups requests so
the checker can reason about ordering within a group. Nothing else about the
system depends on it, and deliberately so: giving clients sessions, or state,
or affinity beyond what the profile says, would add a component with its own
failure modes to a system that is meant to be apparatus.

## The read path

This is the part with the most still open, and it is the part everything else
waits on, because the staleness invariant, the follower-as-cache claim and the
quorum guarantee are all statements about how a read is served.

What is decided:

A read is addressed to a particular floret. The client names it. This is
unusual for a key-value store, which would normally hide replica selection
behind the API, and it is done here because the thing being measured is how
stale a *particular* replica is. A read that lands wherever the system chooses
cannot answer that question.

Which floret a read is addressed to is decided by the workload profile, not by
the code that generates load. The profile can say that reads go anywhere, that
they prefer the primary, or that each client is pinned to one floret. This
belongs in the profile because the profile travels inside the run manifest,
and a run that cannot be rebuilt from its manifest is not reproducible — which
is the property the entire project exists to provide.

Provisionally, and this is the part to be careful about:

Under quorum the addressed floret does not answer alone. It asks a majority
and returns the newest version it sees. That is what would make the zero
staleness bound true rather than aspirational: a write acknowledged by a
majority cannot be missed by a later majority read, so any stale read at all
would be a real violation and not an expected consequence of asking the wrong
replica.

Under primary-backup the addressed floret answers from its own store.

That pair — coordinate under quorum, answer locally under primary-backup — is
the shape the other documents are written against. It is not decided. It is
the first open question below, and the reason it is worth separating from the
decisions above is that everything in this paragraph changes if it goes the
other way: if the addressed floret always answers locally, there is no quorum
read, the zero bound is not available at all, and two wire messages that the
09/21 freeze would otherwise commit to do not exist.

The zero is asserted in two other documents, and a second open question below
could void it independently. If a read quorum is allowed to answer with a
possibly stale value when it cannot reach a majority, rather than failing,
then the bound is zero only while a majority is reachable and the invariant
becomes conditional on availability. Deciding that question is therefore not
only a read-path decision; it decides what invariant 2 says.

Under primary-backup the primary is by definition current. A follower is
behind by however much replication lag and fault injection have put there,
and no bound is claimed for it. That is a decision, not an omission: any bound would be a number
invented to be checked against, and the honest thing is to measure the
distribution and report it. What is asserted for followers instead is
monotonicity, which is a property the system should have regardless of how far
behind a replica is.

What is not decided, and what would settle each:

- **Whether the addressed floret coordinates a quorum or simply answers.**
  This is the one to decide first: it settles the two below it, it decides
  whether a read request and reply exist on the wire at all, and the envelope
  freezes on 09/21. Coordinating gives quorum a zero bound and makes follower
  reads meaningless in that mode, so pinning becomes a primary-backup idea.
  Answering locally makes pinning mean the same thing in both modes and makes
  the zero bound unavailable, which means invariant 2 says something else.
  Settled by choosing what the project is measuring: the protocol as it would
  be deployed, or replica staleness directly.
- **What a read quorum returns when its replies disagree, and whether it
  writes the winner back.** Reading repair changes the fault behaviour being
  measured, because a read would then heal the divergence a later check is
  looking for. Settled by deciding whether the sweep is measuring the system
  as it would be deployed or the replication protocol in isolation.
- **Whether a read quorum may fail rather than return a possibly stale value,
  and what the client sees when it does.** This is the availability half of
  the partition question. Settled by choosing what the second invariant should
  mean during a partition: unavailable, or available and stale.
- **Whether follower reads exist in quorum mode at all.** If the mode implies
  the quorum path unconditionally, addressing a read to a follower means
  something different in each mode, and the profile's pinning option applies
  to only one of them.
- **Whether a pinned client may be repinned during a run.** The profile allows
  pinning; it does not say whether a pin is permanent. Monotonic reads across a
  move to a different replica is a stronger claim than monotonic reads at one,
  and only one of those is asserted. Settled by deciding whether repinning is
  part of the workload or part of the fault model.
- **What a reply carries when an operation fails or times out.** The first
  invariant counts successful acknowledgements only, so failures need a
  representation the checker can tell apart from success. Settled alongside the
  availability question above, since they produce the same cases.

## Staleness, and the cache it implies

Under quorum the bound is zero and any stale read is a violation. Under
primary-backup a read from the primary is current and a read from a follower is
unbounded.

The consequence worth naming is that a follower replica is a read cache with no
coherence guarantee. That is the honest form of the caching claim elsewhere in
these documents: the project does not implement a cache with a bounded
staleness, it implements replicas that can be read directly and it measures how
far behind they are. Anyone expecting a cache invalidation protocol will not
find one, and none is claimed.

## Convergence, not ownership

The third invariant is that once traffic has settled, no two florets disagree
about the value of a key.

"Settled" needs a definition that a partitioned run can actually reach. Saying
every message has been delivered or dropped does not work: under a partition
that never heals, messages are neither, so the invariant would be unevaluable
in precisely the runs it exists for. The definition used instead is that the
run has ended and the scheduler has no events left. Anything still in flight
at that point is never delivered, which for the purpose of the check is the
same as dropped.

That leaves a second problem, and it is the more interesting one. If a
partition has not healed by the end of the run, the two sides *should*
disagree — that is what a partition is. Asserting that every floret in the
cluster agrees would report a violation for behaviour that is correct.

So convergence is asserted within each group of florets that could still
reach one another when the run ended, not across the cluster. The checker
knows the partition state because the fault schedule is in the manifest. If
the partition healed, there is one group and the assertion is global; if it
did not, each side is checked against itself. A disagreement inside a group
that could communicate is a real violation. A disagreement across a break is
the fault doing its job.

The obvious alternative is to ask whether two florets could both claim
authority over a key. Nothing in this design can do that. The primary is
chosen once and never moves, and there is no election, so authority is a
constant. An invariant that cannot be violated is not a test, it is a sentence
that always passes, and the checker written for it would have found nothing
all semester.

Divergence is the failure this design can actually produce: asynchronous
fanout drops a replicate, a partition heals, two replicas apply updates in
different orders, and the conflict rule resolves them differently on each
side. That is worth checking because it can fail.

## Why there are no leases

Primary-backup here has a static primary and no heartbeats. A lease is a
mechanism for handing the role to someone else when the holder stops
responding, and handing the role to someone else is election, which this design
excludes.

Excluding it is what keeps the system small enough to be apparatus. It also
creates a specific behaviour that has to be stated rather than discovered:
when the primary dies, writes stop. That is not a bug to be fixed later. It is
the failure mode of the mode, and the sweep should report it as one.

## What this design cannot find

Three classes of failure are out of scope by construction, and it is worth
being direct about them so that a reader does not assume the sweep covers more
ground than it does.

A floret that lies — returning different answers to different peers — would
need signed messages and quorum arithmetic that tolerates dishonesty. That is a
second project, not a feature.

A floret that returns wrong values or makes invalid transitions would require
deliberately corrupting the state machine, which would break the determinism
the rest of the work depends on. The tool cannot inject the fault without
destroying its own foundation.

A floret that is degraded but still answers health checks cannot be detected
without a health-checking subsystem, and there is none.

These are boundaries of the fault model, chosen deliberately. Every fault the
system does inject is scheduled by the seeded controller, which is why the
fault timeline is part of what a seed determines and why a finding is
reproducible from the seed alone.
