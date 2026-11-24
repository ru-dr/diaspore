package protocol

import (
	"encoding/json"
	"testing"
)

// sampleReply is the Appendix A reply, a typical mid-size done.
var sampleReply = []byte(`{"type":"done","send":[{"to":"n2","body":{"op":"ack"}}],"set_timers":[{"id":"election","after":500}],"cancel_timers":["heartbeat"],"store":{"term":"3"},"log":["became leader"]}`)

// sampleEvent is a typical client message event.
var sampleEvent = []byte(`{"type":"message","time":1250,"from":"c1","body":{"op":"put","key":"x","value":5}}`)

// BenchmarkDecodeReply measures parsing and validating one reply from a floret.
func BenchmarkDecodeReply(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() {
		if _, err := DecodeReply(sampleReply); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkDecodeEvent measures parsing and validating one event, as a Go floret would.
func BenchmarkDecodeEvent(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() {
		if _, err := DecodeEvent(sampleEvent); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkEncodeMessage measures building one event line for a floret.
func BenchmarkEncodeMessage(b *testing.B) {
	b.ReportAllocs()
	msg := NewMessage(1250, "c1", json.RawMessage(`{"op":"put","key":"x","value":5}`))
	for b.Loop() {
		if _, err := json.Marshal(msg); err != nil {
			b.Fatal(err)
		}
	}
}
