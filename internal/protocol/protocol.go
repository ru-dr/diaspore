// Package protocol defines the floret protocol v1 messages described in PROTOCOL.md.
package protocol

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/ru-dr/diaspore/internal/sim"
)

// Version is the protocol version this Diaspore speaks.
const Version = 1

// MaxInt is the largest integer a JavaScript number holds exactly (2^53 - 1).
const MaxInt = 1<<53 - 1

// Event and reply type names.
const (
	TypeInit    = "init"
	TypeMessage = "message"
	TypeTimer   = "timer"
	TypeDone    = "done"
)

// Init starts or restarts a floret.
type Init struct {
	Type     string            `json:"type"`
	Protocol int               `json:"protocol"`
	Node     string            `json:"node"`
	Peers    []string          `json:"peers"`
	RandSeed int64             `json:"rand_seed"`
	Time     sim.Time          `json:"time"`
	Stored   map[string]string `json:"stored"`
}

// Message delivers a message from another node or a client.
type Message struct {
	Type string          `json:"type"`
	Time sim.Time        `json:"time"`
	From string          `json:"from"`
	Body json.RawMessage `json:"body"`
}

// Timer tells a floret that one of its timers fired.
type Timer struct {
	Type string   `json:"type"`
	Time sim.Time `json:"time"`
	ID   string   `json:"id"`
}

// Done is the only reply a floret sends.
type Done struct {
	Type         string             `json:"type"`
	Protocol     *int               `json:"protocol,omitempty"`
	Send         []Send             `json:"send,omitempty"`
	SetTimers    []SetTimer         `json:"set_timers,omitempty"`
	CancelTimers []string           `json:"cancel_timers,omitempty"`
	Store        map[string]*string `json:"store,omitempty"`
	Log          []string           `json:"log,omitempty"`
}

// Send is one outgoing message inside a reply.
type Send struct {
	To   string          `json:"to"`
	Body json.RawMessage `json:"body"`
}

// SetTimer asks Diaspore to fire a timer after a delay in microseconds.
type SetTimer struct {
	ID    string   `json:"id"`
	After sim.Time `json:"after"`
}

// NewInit builds an init event, turning nil peers and stored into [] and {} so it encodes validly.
func NewInit(node string, peers []string, randSeed int64, t sim.Time, stored map[string]string) Init {
	if peers == nil {
		peers = []string{}
	}
	if stored == nil {
		stored = map[string]string{}
	}
	return Init{Type: TypeInit, Protocol: Version, Node: node, Peers: peers, RandSeed: randSeed, Time: t, Stored: stored}
}

// NewMessage builds a message event.
func NewMessage(t sim.Time, from string, body json.RawMessage) Message {
	return Message{Type: TypeMessage, Time: t, From: from, Body: body}
}

// NewTimer builds a timer event.
func NewTimer(t sim.Time, id string) Timer {
	return Timer{Type: TypeTimer, Time: t, ID: id}
}

// DecodeEvent parses one event line, ignoring unknown fields, and returns *Init, *Message, or *Timer.
func DecodeEvent(line []byte) (any, error) {
	var head struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(line, &head); err != nil {
		return nil, fmt.Errorf("event is not a valid JSON object: %w", err)
	}
	switch head.Type {
	case TypeInit:
		var e Init
		if err := decodeLenient(line, &e, "protocol", "node", "peers", "rand_seed", "time", "stored"); err != nil {
			return nil, err
		}
		return &e, e.validate()
	case TypeMessage:
		var e Message
		if err := decodeLenient(line, &e, "time", "from", "body"); err != nil {
			return nil, err
		}
		return &e, e.validate()
	case TypeTimer:
		var e Timer
		if err := decodeLenient(line, &e, "time", "id"); err != nil {
			return nil, err
		}
		return &e, e.validate()
	default:
		return nil, fmt.Errorf("unknown event type %q", head.Type)
	}
}

// DecodeReply parses one reply line strictly: unknown fields and trailing data are errors.
func DecodeReply(line []byte) (*Done, error) {
	dec := json.NewDecoder(bytes.NewReader(line))
	dec.DisallowUnknownFields()
	var d Done
	if err := dec.Decode(&d); err != nil {
		return nil, fmt.Errorf("invalid reply: %w", err)
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, errors.New("invalid reply: extra data after the JSON object")
	}
	if err := d.validate(); err != nil {
		return nil, err
	}
	return &d, nil
}

// decodeLenient checks required keys exist, then decodes while ignoring unknown fields.
func decodeLenient(line []byte, v any, required ...string) error {
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(line, &obj); err != nil {
		return fmt.Errorf("event is not a valid JSON object: %w", err)
	}
	for _, k := range required {
		raw, ok := obj[k]
		if !ok || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			return fmt.Errorf("event is missing field %q", k)
		}
	}
	if err := json.Unmarshal(line, v); err != nil {
		return fmt.Errorf("invalid event: %w", err)
	}
	return nil
}

// validate checks init rules the decoder cannot see.
func (e *Init) validate() error {
	if e.Protocol < 1 {
		return errors.New("init: protocol must be at least 1")
	}
	if e.Node == "" {
		return errors.New("init: node must not be empty")
	}
	if e.RandSeed < 0 || e.RandSeed > MaxInt {
		return fmt.Errorf("init: rand_seed %d is outside 0 to 2^53 - 1", e.RandSeed)
	}
	if err := checkTime(e.Time); err != nil {
		return fmt.Errorf("init: %w", err)
	}
	seen := make(map[string]bool, len(e.Peers))
	for _, p := range e.Peers {
		if p == "" {
			return errors.New("init: peer names must not be empty")
		}
		if seen[p] {
			return fmt.Errorf("init: peer %q is listed twice", p)
		}
		seen[p] = true
	}
	return nil
}

// validate checks message rules the decoder cannot see.
func (e *Message) validate() error {
	if err := checkTime(e.Time); err != nil {
		return fmt.Errorf("message: %w", err)
	}
	if e.From == "" {
		return errors.New("message: from must not be empty")
	}
	if !isObject(e.Body) {
		return errors.New("message: body must be a JSON object")
	}
	return nil
}

// validate checks timer rules the decoder cannot see.
func (e *Timer) validate() error {
	if err := checkTime(e.Time); err != nil {
		return fmt.Errorf("timer: %w", err)
	}
	if e.ID == "" {
		return errors.New("timer: id must not be empty")
	}
	return nil
}

// validate checks reply rules the decoder cannot see.
func (d *Done) validate() error {
	if d.Type != TypeDone {
		return fmt.Errorf("invalid reply: type must be %q, got %q", TypeDone, d.Type)
	}
	if d.Protocol != nil && *d.Protocol < 1 {
		return errors.New("invalid reply: protocol must be at least 1")
	}
	for i, s := range d.Send {
		if s.To == "" {
			return fmt.Errorf("invalid reply: send[%d] needs a to", i)
		}
		if !isObject(s.Body) {
			return fmt.Errorf("invalid reply: send[%d] body must be a JSON object", i)
		}
	}
	for i, st := range d.SetTimers {
		if st.ID == "" {
			return fmt.Errorf("invalid reply: set_timers[%d] needs an id", i)
		}
		if st.After < 1 || st.After > MaxInt {
			return fmt.Errorf("invalid reply: set_timers[%d] after must be from 1 to 2^53 - 1, got %d", i, st.After)
		}
	}
	for i, id := range d.CancelTimers {
		if id == "" {
			return fmt.Errorf("invalid reply: cancel_timers[%d] must not be empty", i)
		}
	}
	return nil
}

// checkTime keeps virtual time in the range every language reads exactly.
func checkTime(t sim.Time) error {
	if t < 0 || t > MaxInt {
		return fmt.Errorf("time %d is outside 0 to 2^53 - 1", t)
	}
	return nil
}

// isObject reports whether raw JSON is an object.
func isObject(raw json.RawMessage) bool {
	t := bytes.TrimSpace(raw)
	return len(t) > 0 && t[0] == '{'
}
