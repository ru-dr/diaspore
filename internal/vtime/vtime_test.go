package vtime

import "testing"

// Time must stay a 64-bit integer so microsecond values up to 2^53 - 1 fit exactly.
func TestTimeHoldsMaxProtocolValue(t *testing.T) {
	const max = 1<<53 - 1
	got := Time(max)
	if int64(got) != max {
		t.Errorf("Time(%d) = %d, want %d", max, got, max)
	}
}
