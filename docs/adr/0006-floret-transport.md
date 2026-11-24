# 0006. Floret Transport

## Status

Accepted, 2026-11-21

## Context

Florets are separate processes written in any language. Diaspore needs one way to talk to all of them that every language handles easily, that a person can test by hand, and that never mixes protocol traffic with debug output.

## Decision

Diaspore writes one JSON object per line to a floret's stdin. The floret writes exactly one JSON reply per line to stdout.

stdout carries replies only. Anything else on it is a protocol error. Debug output goes to stderr, which Diaspore saves per floret but never parses or hashes. Lines that belong in the trace go in the reply's `log` field.

Diaspore accepts `\n` and `\r\n` when reading and always writes `\n`. All text is UTF-8. Florets must flush stdout after every reply.

We rejected length-prefixed framing. It is harder for floret authors and gains nothing, since JSON never needs a raw newline.

## Consequences

Any language that can read a line and print JSON can be a floret, and a floret can be tested by typing events into it, but florets can never pretty-print, a stray print stops the run, and every floret author must remember to flush, so PROTOCOL.md shows how for each language.
