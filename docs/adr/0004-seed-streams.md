# 0004. Seed Streams

## Status

Accepted, 2026-11-11

## Context

With one generator, a future change can alter the numbers each choice gets. For example, adding a new “duplicate” check in the middle of a run shifts the numbers for every check after it. An old seed would then give a different run.

## Decision

Each random purpose gets its own stream, such as delay, drop, or floret/3. Each stream name is unique and does not depend on creation order.

A stream seed comes from one hash. The input is the master seed as 8 bytes, followed by the stream name bytes. The hash is crypto/sha256.

We keep the first 16 bytes and split them into two parts of 8 bytes. Each part becomes a uint64 and goes into rand.NewPCG.

We use big-endian for every conversion between bytes and numbers. Every machine then reads the same bytes as the same number.

## Consequences

We can add new random choices without changing other streams, and old seeds keep replaying the same run, but the hash rule can never change and every stream name must be unique and stable.