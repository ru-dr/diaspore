package sim

import "errors"

// Time is virtual time in microseconds.
type Time int64

var ErrBackward = errors.New("clock cannot move backward")

type Clock struct {
	currTime Time
}

func simClock() *Clock {
	return &Clock{}
}

func (c *Clock) Now() Time {
	return c.currTime
}

func (c *Clock) advanceTo(t Time) error {
	if t < c.currTime {
		return ErrBackward
	}
	c.currTime = t
	return nil
}
