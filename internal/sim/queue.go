package sim

import "container/heap"

// TODO(CP7): Event is a placeholder. Once PROTOCOL.md defines the real event,
// move it out of this file and have the queue use it, keeping the Time field
// (or its new name) as the ordering key.
type Event struct {
	Time Time // virtual time the event happens
	Type string
}

// item wraps an event and the order it was pushed in.
type item struct {
	event     Event
	pushOrder uint64
}

// itemHeap implements heap.Interface, ordered by Event Time, then by pushOrder.
type itemHeap []item

func (h itemHeap) Len() int {
	return len(h)
}

func (h itemHeap) Less(i, j int) bool {
	if h[i].event.Time != h[j].event.Time {
		return h[i].event.Time < h[j].event.Time
	}
	return h[i].pushOrder < h[j].pushOrder
}

func (h itemHeap) Swap(i, j int) {
	h[i], h[j] = h[j], h[i]
}

func (h *itemHeap) Push(x any) {
	*h = append(*h, x.(item))
}

func (h *itemHeap) Pop() any {
	items := *h
	n := len(items)
	last := items[n-1]
	*h = items[:n-1]
	return last
}

// eventQueue always hands back the earliest event by Event Time, then by pushOrder.
type eventQueue struct {
	items         itemHeap
	nextPushOrder uint64
}

func newQueue() *eventQueue {
	return &eventQueue{}
}

func (q *eventQueue) push(event Event) {
	heap.Push(&q.items, item{event: event, pushOrder: q.nextPushOrder})
	q.nextPushOrder++
}

func (q *eventQueue) pop() (Event, bool) {
	if len(q.items) == 0 {
		return Event{}, false
	}
	return heap.Pop(&q.items).(item).event, true
}

func (q *eventQueue) peek() (Event, bool) {
	if len(q.items) == 0 {
		return Event{}, false
	}
	return q.items[0].event, true
}
