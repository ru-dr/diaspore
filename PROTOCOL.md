# Floret Protocol

Version: 1

---

## 1. Overview

- A **floret** is one node of the system under test. It runs as its own OS process and can be written in any language.
- Diaspore starts every floret, sends it **events**, and reads back its **replies**. The set of florets in one run is the **capitulum**.
- A floret only reacts. For each event it receives, it writes exactly one reply and then waits. Diaspore sends nothing else until that reply arrives (lockstep), so only one floret is ever running.
- Florets never talk to each other directly. A floret asks Diaspore to send a message, and Diaspore decides when it arrives, or whether it arrives at all. That is where delays, drops, duplicates, and partitions come from.
- **Clients** are simulated by Diaspore's workload. They send messages to florets and get replies the same way nodes do.
- This spec covers how messages are framed, the three events, the one reply, the rules a floret must follow, crashes, and errors.

---

## 2. Transport

| Stream | Direction | Carries |
|---|---|---|
| stdin | Diaspore to floret | Events, one per line |
| stdout | floret to Diaspore | Replies, one per line, and nothing else |
| stderr | floret to Diaspore | Free-form debug output. Saved to a file per floret. Never parsed, never part of the trace. |

- **Framing:** every message is one JSON object on one line (JSON Lines), ending in `\n`.
  - Diaspore accepts `\n` or `\r\n` when reading, and always writes `\n`.
  - Never pretty-print. A reply spread over several lines is a protocol error. Newlines inside strings are fine, because JSON encoders escape them.
- **Encoding:** all text is UTF-8.
- **Flush stdout after every reply.** Most runtimes buffer stdout when it is a pipe, and an unflushed reply looks exactly like a hang.
- A floret writes nothing to stdout before its first event.
- Lines that belong in the trace go in the `log` field of `done`. stderr is for throwaway debugging.

---

## 3. Versioning

- The current protocol version is **1**. Versions are plain integers.
- `init` carries `"protocol": 1`. The floret's reply to `init` must carry `"protocol"` set to the version it speaks.
- If that field is missing or different, Diaspore stops before the simulation starts:

  ```
  floret n1 (./kvnode) replied with protocol 2; this Diaspore speaks protocol 1
  ```

- Florets must ignore fields they do not recognise in events. That lets Diaspore add optional event fields without a new version.
- The version goes up for any change that could break an existing floret or an existing Diaspore:
  - a new event type
  - removing or renaming a field, or changing its type, unit, or meaning
  - a new field in `done`, since Diaspore rejects unknown reply fields (see 5.2)
- Adding an optional field to an event does not change the version.

---

## 4. Events: Diaspore to floret

- Every event has `type` and `time`.
- **`time` is virtual time in integer microseconds since the run started.** 1 ms is `1000`. 300 ms is `300000`.
- `time` is the only clock a floret has. It never goes backward.

### 4.1 init

Starts a floret, or restarts it after a crash.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `type` | string | yes | Always `"init"` |
| `protocol` | integer | yes | Protocol version this Diaspore speaks. Currently `1`. |
| `node` | string | yes | This floret's name, like `"n1"` |
| `peers` | array of strings | yes | Names of the other nodes. Never includes this floret or any client. |
| `rand_seed` | integer | yes | Seed for the floret's own randomness, from 0 to 2^53 - 1. The only randomness a floret may use. |
| `time` | integer | yes | Current virtual time in microseconds. `0` on the first start. |
| `stored` | object | yes | Everything this floret saved with `store`, as string keys to string values. `{}` on the first start. |

- Names are unique across nodes and clients. Any `from` that is not in `peers` is a client.
- `peers` comes in the same order on every run of the same config.
- `rand_seed` may be different after a restart. Florets must not assume it stays the same.

### 4.2 message

Delivers a message from another node or from a client.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `type` | string | yes | Always `"message"` |
| `time` | integer | yes | Current virtual time in microseconds |
| `from` | string | yes | Name of the sender, a node or a client |
| `body` | object | yes | Exactly what the sender put in `send`. Diaspore never reads or changes it. |

- The shape of `body` is up to the florets and the workload, for example `{"op": "put", "key": "x", "value": 5}`.

### 4.3 timer

Tells the floret that a timer it set has fired.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `type` | string | yes | Always `"timer"` |
| `time` | integer | yes | Current virtual time in microseconds |
| `id` | string | yes | The id the floret gave when it set the timer |

---

## 5. Reply: floret to Diaspore

### 5.1 done

| Field | Type | Required | Meaning |
|---|---|---|---|
| `type` | string | yes | Always `"done"` |
| `protocol` | integer | in the reply to `init` only | Protocol version this floret speaks |
| `send` | array of send entries | no | Messages to send, in order |
| `set_timers` | array of timer entries | no | Timers to set |
| `cancel_timers` | array of strings | no | Ids of timers to cancel |
| `store` | object | no | Changes to saved state. String keys to a string, or `null` to delete. |
| `log` | array of strings | no | Lines to record in the trace at this event's time |

Send entry:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `to` | string | yes | A peer or a client in this run. Never this floret. |
| `body` | object | yes | Delivered to the receiver unchanged |

Timer entry:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Name chosen by the floret |
| `after` | integer | yes | Microseconds from now until it fires. At least `1`. |

- A missing list means an empty one. `{"type":"done"}` is a valid reply that does nothing.

### 5.2 How Diaspore applies a reply

In this order:

1. **`store`:** listed keys are set, `null` deletes a key, keys not listed stay as they are. Saved in full before anything else happens, so a crash never leaves half a write.
2. **`cancel_timers`:** each pending id is cancelled. An id that is not pending is ignored, since it may have just fired.
3. **`set_timers`:** each timer fires at `time + after`. Setting an id that is already pending replaces it. If one list names the same id twice, the later entry wins.
4. **`send`:** handled in listed order, never sorted. Each send draws random numbers for its delay and faults, so order matters.
5. **`log`:** recorded in the trace.

- Unknown fields in a reply are a protocol error. A typo like `set_timer` would otherwise drop the timer without a word.
- To cancel and reset a timer in one reply, just set it again. Cancel only when you want it gone.

---

## 6. Rules every floret must follow

1. Flush stdout after every reply.
2. Write exactly one reply, on one line, for each event. Write nothing to stdout before the first event.
3. Never read a real clock or sleep. Use `time` and timers.
4. Never open network connections or talk to other processes. Use `send`.
5. Never use randomness except a generator seeded from `rand_seed`.
6. Never let output depend on hash map iteration order, thread scheduling, or the environment (environment variables, host name, process id, files on disk).
7. Keep anything that must survive a crash in `store`. Memory is wiped on every crash.
8. Ignore unknown fields in events.
9. On an unknown event type, write a message to stderr and exit with a nonzero code.

`diaspore check-determinism` runs the same seed twice and catches most breaks of rules 3 to 6.

---

## 7. Crash and restart

- Crashes come from Diaspore's fault rules and the seed. A floret never chooses to crash.
- A crash kills the process with no warning: SIGKILL on Linux and macOS, TerminateProcess on Windows. The floret gets no event and cannot save anything. Only what is already in `store` survives.
- While a floret is down:
  - its pending timers are cancelled, and do not fire after the restart
  - messages that arrive for it are dropped, as if sent to a dead machine
- On restart, Diaspore starts a fresh process and sends `init` with the current `time` and everything in `stored`.
- The reply to that `init` must include `protocol` again. It is also where the floret sets its timers again.
- Messages still in flight when the floret restarts are delivered normally once they arrive.

---

## 8. Errors

Every problem below stops the run. Unless noted, the run is recorded as a failure with a `.pappus` file, the same as a checker failure, because the same seed reproduces it.

| Problem | Reason given |
|---|---|
| Reply is not valid JSON | `floret n2: reply is not valid JSON: ...` |
| Reply fails `reply.schema.json` (not `done`, wrong types, `after` below 1, and so on) | `floret n2: invalid reply: ...` |
| Unknown field in a reply | `floret n2: unknown reply field "set_timer"` |
| `send` to a name that is not a peer or client | `floret n2: send to unknown name "n4"` |
| `send` to itself | `floret n2: send to itself, use a timer instead` |
| Output before the first event, or more than one line per event | `floret n2: unexpected output on stdout` |
| Floret exits on its own, including after an unknown event type | `floret n2 exited with code 1`, plus the last lines of its stderr |
| No reply within the watchdog limit | `floret n2: no reply within 10s of real time`. Marked as a hang, since machine speed can change whether it happens. |
| `protocol` missing or different in the reply to `init` | Plain error before the simulation starts. No `.pappus`. |

- The watchdog limit is 10 seconds of real time by default and can be changed in `diaspore.yaml`.
- The watchdog only decides when to give up. It never affects virtual time or the trace.

---

## 9. JSON Schema files

| File | Describes |
|---|---|
| `schema/event.schema.json` | One event: `init`, `message`, or `timer` |
| `schema/reply.schema.json` | One `done` reply |

- Both use JSON Schema draft 2020-12.
- The schemas check shape only. Rules that need context are checked in Go by `internal/protocol`: `protocol` in the reply to `init`, `send` targets, and sends to itself.
- Floret authors can validate their own replies against `reply.schema.json` while developing.
- At run time Diaspore checks replies with the Go code in `internal/protocol`, not the schema. A test runs every file in `internal/protocol/testdata/valid` and `testdata/invalid` through both, and fails if they ever disagree.

---

## 10. Determinism traps by language

### Go

- Map iteration order is random on purpose. Sort the keys first whenever order affects output. `encoding/json` already sorts map keys.
- Goroutines make order depend on scheduling, and `select` picks at random when several channels are ready. Handle events on one goroutine.
- Seed with `rand.New(rand.NewPCG(uint64(seed), 0))` from `math/rand/v2`. Never call the top-level `rand` functions.
- No `time.Now`, `time.Sleep`, `time.After`, or tickers.
- `os.Stdout` is unbuffered. If you wrap it in a `bufio.Writer`, call `Flush` after every reply.

### Python

- stdout is block-buffered when it is a pipe. Use `print(line, flush=True)`, or call `sys.stdout.reconfigure(line_buffering=True)` once at startup.
- String hashing is randomised per process, so iterating a `set` of strings can give a different order every run. Sort first. Dicts keep insertion order and are safe.
- Use `random.Random(rand_seed)`. Never the module-level `random` functions.
- No `time.time`, `time.monotonic`, `datetime.now`, or `time.sleep`.
- `json.dumps` writes one line by default. Never pass `indent`.
- On Windows, text-mode stdout writes `\r\n`. Diaspore accepts it.

### JavaScript

- `Math.random` cannot be seeded. Use a small seeded generator such as sfc32 or mulberry32, and fold `rand_seed` into its starting state.
- No `Date.now`, `new Date()`, `performance.now`, `setTimeout`, or `setInterval`.
- Object keys that look like integers (`"2"`, `"10"`) always come first when iterating or in `JSON.stringify`, whatever order they were added. Do not let logic depend on key order.
- Numbers are exact only up to 2^53. `time` and `rand_seed` stay below that. Keep your own counters below it too, or use `BigInt`.
- Read stdin line by line with `readline`. Do not call `process.exit()` straight after writing a reply, or the reply may be lost.

### Other languages

- Can you flush stdout after each write?
- Can you seed a random generator from an integer up to 2^53 - 1?
- Do any hash maps or sets iterate in a random order?
- Does anything run on more than one thread?
- Does your JSON library write a single line?
- Are 64-bit integers kept exact when parsed?

---

## 11. Examples

A 3-node key-value store, seen from node `n1`. Lines starting `→` go to its stdin. Lines starting `←` come out of its stdout. The real streams have no arrows.

n1 starts with nothing stored and sets a 300 ms election timer.

```
→ {"type":"init","protocol":1,"node":"n1","peers":["n2","n3"],"rand_seed":918273,"time":0,"stored":{}}
← {"type":"done","protocol":1,"set_timers":[{"id":"election","after":300000}]}
```

`c1` is not in `peers`, so it is a client. n1 saves the value and asks the other nodes to copy it.

```
→ {"type":"message","time":1250,"from":"c1","body":{"op":"put","key":"x","value":5}}
← {"type":"done","store":{"x":"5"},"send":[{"to":"n2","body":{"op":"replicate","key":"x","value":5}},{"to":"n3","body":{"op":"replicate","key":"x","value":5}}]}
```

n2 confirms. n1 answers the client and resets its election timer by setting the same id again. The timer that was due at 300000 is replaced by one due at 321250.

```
→ {"type":"message","time":21250,"from":"n2","body":{"op":"replicated","key":"x"}}
← {"type":"done","send":[{"to":"c1","body":{"op":"put_ok","key":"x"}}],"set_timers":[{"id":"election","after":300000}]}
```

The election timer fires. n1 saves its new term and asks for votes. Because `store` merges, saved state is now `{"term":"1","x":"5"}`.

```
→ {"type":"timer","time":321250,"id":"election"}
← {"type":"done","store":{"term":"1"},"send":[{"to":"n2","body":{"op":"vote_request","term":1}},{"to":"n3","body":{"op":"vote_request","term":1}}],"set_timers":[{"id":"election","after":300000}],"log":["election timeout, starting term 1"]}
```

A fault rule crashes n1 at 400000. The process is killed and its election timer is cancelled. At 1900000 it restarts. Its memory is gone, but both saved keys come back in `stored`, and it gets a new `rand_seed`.

```
→ {"type":"init","protocol":1,"node":"n1","peers":["n2","n3"],"rand_seed":55120931,"time":1900000,"stored":{"term":"1","x":"5"}}
← {"type":"done","protocol":1,"set_timers":[{"id":"election","after":300000}]}
```

---

## 12. Changelog

| Version | Date | Change |
|---|---|---|
| 1 | 2026-11-19 | First version |
