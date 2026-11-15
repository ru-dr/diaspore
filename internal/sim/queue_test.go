package sim

import (
	"fmt"
	"math/rand/v2"
	"testing"
)

func TestQueueTimeOrder(t *testing.T) {
	q := newQueue()
	for _, at := range []Time{300, 100, 200} {
		q.push(Event{Time: at})
	}

	for _, want := range []Time{100, 200, 300} {
		peeked, ok := q.peek()
		if !ok {
			t.Fatalf("peek(): ok = false, want event at %d", want)
		}

		got, ok := q.pop()
		if !ok {
			t.Fatalf("pop(): ok = false, want event at %d", want)
		}
		if got.Time != want {
			t.Errorf("pop().Time = %d, want %d", got.Time, want)
		}
		if peeked != got {
			t.Errorf("peek() = %+v, but pop() = %+v", peeked, got)
		}
	}
}

func TestQueueSameTimeKeepsPushOrder(t *testing.T) {
	q := newQueue()
	q.push(Event{Time: 100, Type: "a"})
	q.push(Event{Time: 50, Type: "x"})
	q.push(Event{Time: 100, Type: "b"})
	q.push(Event{Time: 100, Type: "c"})

	for _, want := range []string{"x", "a", "b", "c"} {
		got, ok := q.pop()
		if !ok {
			t.Fatalf("pop(): ok = false, want %q", want)
		}
		if got.Type != want {
			t.Errorf("pop().Type = %q, want %q", got.Type, want)
		}
	}
}

func TestQueueEmpty(t *testing.T) {
	q := newQueue()

	if _, ok := q.pop(); ok {
		t.Errorf("pop() on new queue: ok = true, want false")
	}
	if _, ok := q.peek(); ok {
		t.Errorf("peek() on new queue: ok = true, want false")
	}

	q.push(Event{Time: 10})
	q.pop()

	if _, ok := q.pop(); ok {
		t.Errorf("pop() after draining: ok = true, want false")
	}
	if _, ok := q.peek(); ok {
		t.Errorf("peek() after draining: ok = true, want false")
	}
}

// TestQueueSeededAgainstReference mixes pushes and pops the way the loop will,
// and checks every pop against a plain slice: earliest time first, and for
// equal times, the earliest push first.
func TestQueueSeededAgainstReference(t *testing.T) {
	r := rand.New(rand.NewPCG(1, 2)) // fixed seed, never the global rand
	q := newQueue()
	var ref []Event // events still waiting, in push order

	popRef := func() (Event, bool) {
		if len(ref) == 0 {
			return Event{}, false
		}
		best := 0
		for i := 1; i < len(ref); i++ {
			if ref[i].Time < ref[best].Time { // strict <, so ties keep the earliest push
				best = i
			}
		}
		ev := ref[best]
		ref = append(ref[:best], ref[best+1:]...)
		return ev, true
	}

	check := func(step int) {
		got, gotOK := q.pop()
		want, wantOK := popRef()
		if gotOK != wantOK || got != want {
			t.Fatalf("step %d: pop() = %+v, %v; want %+v, %v", step, got, gotOK, want, wantOK)
		}
	}

	const steps = 10000
	for i := range steps {
		if r.IntN(3) < 2 { // push two times out of three
			// Times in [0, 1000) force many ties. Type is a unique label.
			ev := Event{Time: Time(r.IntN(1000)), Type: fmt.Sprintf("e%d", i)}
			q.push(ev)
			ref = append(ref, ev)
		} else {
			check(i)
		}
	}

	for i := steps; len(ref) > 0; i++ {
		check(i)
	}
	if _, ok := q.pop(); ok {
		t.Errorf("pop() after draining: ok = true, want false")
	}
}
