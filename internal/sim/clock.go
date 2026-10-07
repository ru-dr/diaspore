package sim

import "errors"

type Time int64

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
		return errors.New("clock cannot move backward")
	}
	c.currTime = t
	return nil
}