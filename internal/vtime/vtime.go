// Package vtime holds the virtual time type.
// It has its own package so sim and protocol can both use it without importing each other.
package vtime

// Time is virtual time in microseconds.
type Time int64
