package sim

import "errors"

// Time is virtual time in microseconds.
type Time int64

// ErrBackward is returned when asked to move the clock to an earlier time.
var ErrBackward = errors.New("clock cannot move backward")

// Clock is the simulator's virtual clock. It only moves when the loop moves it.
type Clock struct {
	currTime Time
}

// simClock returns a new clock starting at time 0.
func simClock() *Clock {
	return &Clock{}
}

// Now returns the current virtual time.
func (c *Clock) Now() Time {
	return c.currTime
}

// advanceTo moves the clock forward to t. Moving to the same time is allowed.
func (c *Clock) advanceTo(t Time) error {
	if t < c.currTime {
		return ErrBackward
	}
	c.currTime = t
	return nil
}
