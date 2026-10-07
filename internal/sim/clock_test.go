package sim

import (
	"testing"
)

func TestClockStartAtZero(t *testing.T) {
	var now = simClock().Now()

	if now != 0 {
		t.Errorf("clock should start at 0, got %d", now)
	}
}

func TestClockMoveForward(t *testing.T) {
	c := simClock()
	err := c.advanceTo(500)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if c.Now() != 500 {
		t.Errorf("Now() = %d, want %d", c.Now(), 500)
	}
}

func TestClockRefuseBackward(t *testing.T) {
	c := simClock()

	if err := c.advanceTo(500); err != nil {
		t.Fatalf("advanceTo(500): unexpected error: %v", err)
	}

	err := c.advanceTo(400)
	if err == nil {
		t.Errorf("advanceTo(400) after 500: got nil error, want error")
	}

	if c.Now() != 500 {
		t.Errorf("Now() = %d, want %d", c.Now(), 500)
	}
}
