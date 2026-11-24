package sim

import "testing"

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

// TestQueueMixedPushAndPop pushes and pops in turn, the way the loop will,
// and checks every pop against the expected answer.
func TestQueueMixedPushAndPop(t *testing.T) {
	steps := []struct {
		op    string // "push" or "pop"
		time  Time   // push only
		label string // push: the event's label; pop: the label we expect ("" means empty)
	}{
		{"push", 40, "a"},
		{"push", 10, "b"},
		{"pop", 0, "b"}, // earlier time first, even though pushed later
		{"push", 40, "c"},
		{"push", 20, "d"},
		{"pop", 0, "d"},
		{"pop", 0, "a"}, // a and c tie at 40; a was pushed first
		{"push", 40, "e"},
		{"push", 5, "f"},
		{"pop", 0, "f"},
		{"pop", 0, "c"}, // c and e tie at 40; c was pushed first
		{"pop", 0, "e"},
		{"pop", 0, ""}, // empty
		{"push", 30, "g"},
		{"pop", 0, "g"}, // works again after being empty
		{"push", 50, "h"},
		{"push", 50, "i"},
		{"push", 50, "j"},
		{"pop", 0, "h"}, // three-way tie: needs the push-order rule
		{"pop", 0, "i"},
		{"pop", 0, "j"},
		{"pop", 0, ""},
	}

	q := newQueue()
	for i, s := range steps {
		if s.op == "push" {
			q.push(Event{Time: s.time, Type: s.label})
			continue
		}

		got, ok := q.pop()
		if s.label == "" {
			if ok {
				t.Errorf("step %d: pop() = %+v, want empty", i, got)
			}
			continue
		}
		if !ok || got.Type != s.label {
			t.Errorf("step %d: pop() = %+v, %v; want %q", i, got, ok, s.label)
		}
	}
}
