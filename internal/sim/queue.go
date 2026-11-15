package sim

import "container/heap"

// Event is a placeholder until PROTOCOL.md (CP7) defines the real event.
// Time is set by Diaspore; the queue only reads it.
type Event struct {
	Time Time   // virtual time the event happens
	Type string // "init", "message", or "timer" (build guide, Appendix A)
}

// item wraps an event with the order it was pushed in.
type item struct {
	ev  Event
	seq uint64
}

// itemHeap implements heap.Interface, ordered by event time, then by push order.
type itemHeap []item

func (h itemHeap) Len() int { return len(h) }

func (h itemHeap) Less(i, j int) bool {
	if h[i].ev.Time != h[j].ev.Time {
		return h[i].ev.Time < h[j].ev.Time
	}
	return h[i].seq < h[j].seq
}

func (h itemHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h *itemHeap) Push(x any) { *h = append(*h, x.(item)) }

func (h *itemHeap) Pop() any {
	old := *h
	n := len(old)
	it := old[n-1]
	*h = old[:n-1]
	return it
}

// eventQueue always hands back the earliest event. Events with the same
// time come out in the order they were pushed.
type eventQueue struct {
	items   itemHeap
	nextSeq uint64
}

func newQueue() *eventQueue {
	return &eventQueue{}
}

func (q *eventQueue) push(ev Event) {
	heap.Push(&q.items, item{ev: ev, seq: q.nextSeq})
	q.nextSeq++
}

// pop removes and returns the earliest event. It returns false if the queue is empty.
func (q *eventQueue) pop() (Event, bool) {
	if len(q.items) == 0 {
		return Event{}, false
	}
	return heap.Pop(&q.items).(item).ev, true
}

// peek returns the earliest event without removing it. It returns false if the queue is empty.
func (q *eventQueue) peek() (Event, bool) {
	if len(q.items) == 0 {
		return Event{}, false
	}
	return q.items[0].ev, true
}
