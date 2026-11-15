# 0005. Event queue

## Status

Accepted, 2026-11-15

## Context

Events are created out of order, but they must happen in time order. Two events can also have the same time, for example a timer and a message both at 1250. A heap does not keep equal items in any fixed order, so without a rule, which one comes out first depends on the heap's internal layout. The same seed could then give a different run and a different trace hash.

## Decision

The queue is a min-heap built on container/heap. It orders events by their Time field, and events with the same time come out in the order they were pushed. To do this, the queue stamps each event with a counter when it is pushed and compares that counter only when the times are equal.

The time comes from the event itself, because Diaspore sets it. The queue only reads it and never changes it. Until PROTOCOL.md defines the real event, the field is assumed to be called Time.

Events are stored as values, so changing an event after pushing it does not change the queue. Popping or peeking an empty queue returns false instead of panicking or returning an error, because an empty queue is a normal way for a run to end.

The queue does not refuse events in the past. The loop owns the clock, so that check belongs there (CP4).

## Consequences

Same-time events always come out in the same order, so runs stay deterministic. This also answers the CP10 question: a timer and a message at the same time come out in the order they were scheduled.

The tie-break rule can never change, because traces and .pappus files depend on it. Events cannot be removed once pushed, so canceling a timer (CP10) has to skip it when it pops instead of removing it from the queue. The queue depends on the event having a Time field, so it changes when PROTOCOL.md defines the real event.
