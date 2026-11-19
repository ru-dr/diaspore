package seed

import "testing"

func draw(s *Source, name string, n int) []uint64 {
	gen := s.Stream(name)
	out := make([]uint64, n)
	for i := range out {
		out[i] = gen.Uint64()
	}
	return out
}

func TestSameSeedSameNumbers(t *testing.T) {
	a := draw(NewSource(42), "delay", 1000)
	b := draw(NewSource(42), "delay", 1000)

	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("position %d differs: %d vs %d", i, a[i], b[i])
		}
	}
}

func TestDifferentSeedsDifferentNumbers(t *testing.T) {
	a := draw(NewSource(42), "delay", 1000)
	b := draw(NewSource(7), "delay", 1000)

	same := true
	for i := range a {
		if a[i] != b[i] {
			same = false
			break
		}
	}
	if same {
		t.Fatal("seeds 42 and 7 gave identical numbers")
	}
}

func TestNewStreamDoesNotChangeOthers(t *testing.T) {
	first := draw(NewSource(42), "delay", 1000)

	src := NewSource(42)
	draw(src, "duplicate", 50)
	second := draw(src, "delay", 1000)

	for i := range first {
		if first[i] != second[i] {
			t.Fatalf("delay changed at position %d after adding duplicate", i)
		}
	}
}
