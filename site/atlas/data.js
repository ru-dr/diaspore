/* Diaspore Atlas content.
   status: built = in main, designing = ADR proposed, planned = not started.
   code.real = true means copied from main; false means a proposed sketch.
   In code strings, § stands for a backtick (Go struct tags). */

const NODES = [
/* ───────────── What you give ───────────── */
{ id: "cli", label: "CLI", sub: "run · dandelion · replay", g: "input", x: 170, y: 350,
  cp: "CP12, CP13, CP19, CP20", owner: "Ash, Rudra", status: "planned", adr: "design §11", file: "cmd/diaspore/",
  what: "The diaspore binary's commands. Each one is a different way of driving the same simulation engine.",
  takes: [["argv", "the command and its flags, like run --seed 8837421"], ["diaspore.yaml", "path from -c, default ./diaspore.yaml"], ["file.pappus", "for replay only"]],
  gives: [["exit code", "0 = every seed passed, 1 = a run failed, 2 = setup or usage error"], ["stdout", "a short summary: seed, steps, pass or the failure reason"], ["files", "trace.jsonl, history.jsonl, and a .pappus on failure, under runs/"]],
  uses: ["Config loader (CP13)", "Main loop (CP4)", "Dandelion (CP19, CP20)", "Replay (CP19)"],
  steps: [
    "Parse the command and flags.",
    "Load and check diaspore.yaml.",
    "run: one seed. dandelion: a seed range across workers. replay: read a .pappus and rerun it. check-determinism: run one seed twice and diff.",
    "Print the result and exit with the matching code."
  ],
  code: { real: false, title: "cmd/diaspore/main.go (proposed sketch)", src:
`func main() {
	cmd, args := os.Args[1], os.Args[2:]
	switch cmd {
	case "run":               // CP13
		os.Exit(runCmd(args))     // --seed n -c diaspore.yaml
	case "dandelion":         // CP19, CP20
		os.Exit(sweepCmd(args))   // --seeds 1-500 --workers 8
	case "replay":            // CP19
		os.Exit(replayCmd(args))  // file.pappus [--strict]
	case "check-determinism": // CP12
		os.Exit(determinismCmd(args))
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\\n", cmd)
		os.Exit(2)
	}
}` },
  example: { in: "$ diaspore run --seed 8837421", out:
`seed 8837421 · 18342 steps · 120s virtual in 1.4s
FAIL acked-writes at 83.120000s: write x=5 was acked, then lost after n1 crashed
wrote runs/run-8837421.pappus` } },

{ id: "yaml", label: "diaspore.yaml", sub: "the run's setup", g: "input", x: 170, y: 520,
  cp: "CP13", owner: "Rudra", status: "designing", adr: "ADR 0012 (proposed)", file: "internal/config/config.go",
  what: "One YAML file that describes a whole run: the floret program, how many copies, the workload, the faults, the checkers and the run length.",
  takes: [["diaspore.yaml", "YAML text, version 1"]],
  gives: [["config.Config", "the resolved config: every field checked, every default filled, durations in µs, chances in ppm"], ["errors", "all problems at once, each with line, column and field path"]],
  uses: ["goccy/go-yaml in strict mode", "registries for workload types, fault kinds and checkers"],
  steps: [
    "Decode the YAML into Go structs. Unknown keys are errors.",
    "Turn durations (120s, 1ms-50ms) into microseconds and chances (0.02) into parts per million.",
    "Fill defaults (watchdog 10s) and validate each section with its own type's rules.",
    "Return the resolved config. It drives the run and is copied into every .pappus."
  ],
  code: { real: false, title: "internal/config/config.go (proposed sketch)", src:
`type Config struct {
	Version  int        §yaml:"version"§
	Florets  Florets    §yaml:"florets"§
	Run      Run        §yaml:"run"§
	Workload *Workload  §yaml:"workload"§ // optional
	Faults   []Fault    §yaml:"faults"§
	Checkers []Checker  §yaml:"checkers"§ // "name" or {checker: name, ...}
}

type Florets struct {
	Command []string §yaml:"command"§ // argv, run without a shell
	Count   int      §yaml:"count"§   // florets n1..nCount
}

type Run struct {
	Duration sim.Time §yaml:"duration"§ // from "120s"
	Watchdog Real     §yaml:"watchdog"§ // real time, default 10s
}

func Load(path string) (Config, error)` },
  example: { in:
`version: 1
florets: { command: ["./kvnode"], count: 3 }
run: { duration: 120s }
faults:
  - { fault: drop, chnace: 0.02 }`, out:
`diaspore.yaml:5:20: faults[0]: unknown field "chnace"
  did you mean "chance"?` } },

{ id: "seed", label: "Master seed", sub: "one uint64", g: "input", x: 170, y: 180,
  cp: "CP3", owner: "Rudra", status: "built", adr: "ADR 0004", file: "internal/seed/seed.go",
  what: "The one number that decides every random choice in a run. Same seed, same run.",
  takes: [["--seed", "a number from the command line, or one seed from a sweep range"]],
  gives: [["seed.Source", "the root that hands out one named random stream per purpose"]],
  uses: ["seed.NewSource"],
  steps: [
    "Read the seed from --seed, or take the next one from --seeds 1-500.",
    "Build a seed.Source from it. Nothing draws from the master seed directly.",
    "Save it in the .pappus so the run can be replayed."
  ],
  code: { real: true, title: "internal/seed/seed.go (main)", src:
`type Source struct {
	masterSeed uint64
	streams    map[string]*rand.Rand
}

func NewSource(masterSeed uint64) *Source {
	sMap := make(map[string]*rand.Rand)
	return &Source{
		masterSeed: masterSeed,
		streams:    sMap,
	}
}` },
  example: { in: "--seed 8837421", out: "src := seed.NewSource(8837421)" } },

/* ───────────── Core ───────────── */
{ id: "streams", label: "Seed streams", sub: "one generator per purpose", g: "world", x: 580, y: 180,
  cp: "CP3", owner: "Rudra", status: "built", adr: "ADR 0004", file: "internal/seed/seed.go",
  what: "Turns the master seed into a separate random generator for each purpose, so changing one part of a run never shifts the random numbers of another.",
  takes: [["masterSeed", "uint64"], ["name", "a fixed purpose name: delay, drop, workload, floret/3 …"]],
  gives: [["*rand.Rand", "a PCG generator for that name, the same one on every call"]],
  uses: ["crypto/sha256", "encoding/binary (big-endian)", "math/rand/v2 PCG"],
  steps: [
    "If this name already has a stream, return it.",
    "Build the input: master seed as 8 big-endian bytes, then the name's bytes.",
    "SHA-256 the input. Read bytes 0–7 and 8–15 as two big-endian uint64 values.",
    "Seed rand.NewPCG with them, cache the generator under the name and return it."
  ],
  code: { real: true, title: "internal/seed/seed.go (main)", src:
`func (s *Source) Stream(name string) *rand.Rand {
	if existing, ok := s.streams[name]; ok {
		return existing
	}

	input := make([]byte, 8)
	binary.BigEndian.PutUint64(input, s.masterSeed)
	input = append(input, name...)

	digest := sha256.Sum256(input)
	seedHi := binary.BigEndian.Uint64(digest[0:8])
	seedLo := binary.BigEndian.Uint64(digest[8:16])

	gen := rand.New(rand.NewPCG(seedHi, seedLo))
	s.streams[name] = gen
	return gen
}` },
  example: { in:
`src := seed.NewSource(8837421)
d := src.Stream("delay").IntN(50_000)
w := src.Stream("workload").IntN(3)`, out:
`d and w are the same on every machine, every run.
Adding src.Stream("duplicate") later does not change d or w.` } },

{ id: "clock", label: "Virtual clock", sub: "int64 microseconds", g: "engine", x: 990, y: 180,
  cp: "CP1", owner: "Rudra", status: "built", adr: "ADR 0003", file: "internal/sim/clock.go",
  what: "Diaspore's own time. A number in microseconds that only the main loop moves. It never reads a wall clock.",
  takes: [["advanceTo(t)", "the time of the event the loop just popped"]],
  gives: [["Now()", "the current virtual time, sim.Time"], ["ErrBackward", "if asked to move back"]],
  uses: ["errors (no time package at all)"],
  steps: [
    "Starts at 0.",
    "The loop calls advanceTo with each popped event's time, so time jumps straight to the next event.",
    "Moving backwards returns ErrBackward.",
    "advanceTo is unexported, so only package sim can move time. Everyone else can read Now()."
  ],
  code: { real: true, title: "internal/sim/clock.go (main)", src:
`// Time is virtual time in microseconds.
type Time int64

var ErrBackward = errors.New("clock cannot move backward")

type Clock struct {
	currTime Time
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
}` },
  example: { in: "c.advanceTo(1250); c.advanceTo(21250); c.advanceTo(900)", out: "Now() = 21250, then ErrBackward" } },

{ id: "queue", label: "Event queue", sub: "earliest first", g: "engine", x: 990, y: 350,
  cp: "CP2", owner: "HK", status: "built", adr: "ADR 0005", file: "internal/sim/queue.go",
  what: "Holds everything scheduled for the future: message arrivals, timers, client requests, crashes and restarts.",
  takes: [["push(Event)", "an event with its virtual Time"]],
  gives: [["pop() (Event, bool)", "the earliest event; false when empty"], ["peek()", "the earliest event without removing it"]],
  uses: ["container/heap (min-heap)"],
  steps: [
    "push stamps each event with an increasing pushOrder counter.",
    "Less compares Time first; equal times compare pushOrder, so first pushed comes out first.",
    "pop returns the earliest event. An empty queue returns false, which is a normal way for a run to end.",
    "Events are stored as values, so changing one after pushing it changes nothing in the queue."
  ],
  code: { real: true, title: "internal/sim/queue.go (main)", src:
`func (h itemHeap) Less(i, j int) bool {
	if h[i].event.Time != h[j].event.Time {
		return h[i].event.Time < h[j].event.Time
	}
	return h[i].pushOrder < h[j].pushOrder
}

func (q *eventQueue) push(event Event) {
	heap.Push(&q.items, item{event: event, pushOrder: q.nextPushOrder})
	q.nextPushOrder++
}

func (q *eventQueue) pop() (Event, bool) {
	if len(q.items) == 0 {
		return Event{}, false
	}
	return heap.Pop(&q.items).(item).event, true
}` },
  example: { in:
`push({Time: 300000, Type: "timer"})
push({Time: 1250,   Type: "message"})
push({Time: 1250,   Type: "crash"})`, out:
`pop → message @1250   (pushed before crash)
pop → crash   @1250
pop → timer   @300000
pop → false   (empty)` } },

{ id: "loop", label: "Main loop", sub: "pop · deliver · apply", g: "engine", x: 1400, y: 350,
  cp: "CP4", owner: "HK", status: "planned", adr: "design §3, §4", file: "internal/sim/loop.go",
  what: "The heart of a run. A single-threaded cycle that repeats until the run's duration is reached or the queue is empty.",
  takes: [["config.Config", "resolved setup"], ["*seed.Source", "for every random draw"], ["the event queue", "seeded with init, workload and fault events"]],
  gives: [["Result", "pass, or a failure with kind, time, step and reason"], ["trace lines", "one per step, to the trace writer"], ["history", "via the workload"]],
  uses: ["Clock", "Event queue", "Lockstep driver", "Network", "Timers", "Storage", "Trace writer", "Workload"],
  steps: [
    "Pop the earliest event. Stop if the queue is empty or its time is past run.duration.",
    "Skip stale events: a cancelled timer, a message for a crashed floret.",
    "clock.advanceTo(event.Time).",
    "Floret event → lockstep driver → validated reply. Client event → workload.",
    "Apply the reply in order: store, cancel_timers, set_timers, send, log.",
    "Write one trace line. Repeat."
  ],
  code: { real: false, title: "internal/sim/loop.go (proposed sketch)", src:
`func (s *Sim) Run() Result {
	for {
		ev, ok := s.queue.pop()
		if !ok || ev.Time > s.cfg.Run.Duration {
			return s.finish()
		}
		if s.stale(ev) {
			continue
		}
		if err := s.clock.advanceTo(ev.Time); err != nil {
			return s.fail(err)
		}
		if ev.ToClient() {
			s.workload.Deliver(ev)
			continue
		}
		reply, err := s.florets.Deliver(ev) // lockstep, watchdog
		if err != nil {
			return s.fail(err) // protocol break or hang
		}
		s.apply(ev.Node, reply) // store, cancel, set, send, log
		if err := s.trace.Step(ev, reply); err != nil {
			return s.fail(err)
		}
	}
}` },
  example: { in: "queue: [c1→n1 put @1250, n1 timer @300000]", out:
`step 1  t=1250    n1 ← message from c1, reply: store x, send ×2
        queue now: [n1→n2 @21250, n1 timer @300000]` } },

{ id: "trace", label: "Trace and hash", sub: "trace.jsonl + SHA-256", g: "engine", x: 1400, y: 180,
  cp: "CP5", owner: "Rudra", status: "designing", adr: "ADR 0011 (proposed)", file: "internal/trace/",
  what: "A line-by-line record of the run plus its fingerprint. Two runs are identical exactly when their hashes match.",
  takes: [["Step(event, reply)", "after every floret reply"], ["fault lines", "kind: drop, duplicate … from CP6 and CP14"]],
  gives: [["trace.jsonl", "one JSON object per line"], ["Hash()", "SHA-256 of the whole file, 64 lowercase hex"]],
  uses: ["encoding/json (HTML escaping off)", "crypto/sha256", "io.MultiWriter", "protocol, vtime"],
  steps: [
    "Build a line: step, time, node, kind, the event sent and the reply received.",
    "Encode it with fixed settings and a trailing \\n on every OS.",
    "Write it through io.MultiWriter to the file and the hasher at once, so the file is never read back.",
    "At the end, Hash() returns the hex digest. sha256sum trace.jsonl gives the same value."
  ],
  code: { real: false, title: "internal/trace/trace.go (proposed sketch, ADR 0011)", src:
`type Line struct {
	Step  int64           §json:"step"§
	Time  vtime.Time      §json:"time"§
	Node  string          §json:"node"§
	Kind  string          §json:"kind"§ // "step", later "drop", ...
	Event json.RawMessage §json:"event"§
	Reply json.RawMessage §json:"reply,omitempty"§
}

func New(f io.Writer) *Writer {
	h := sha256.New()
	enc := json.NewEncoder(io.MultiWriter(f, h))
	enc.SetEscapeHTML(false)
	return &Writer{enc: enc, h: h}
}

func (w *Writer) Hash() string { return hex.EncodeToString(w.h.Sum(nil)) }` },
  example: { in: "step 3: n1 got c1's put, replied with one send", out:
`{"step":3,"time":1250,"node":"n1","kind":"step","event":{"type":"message","time":1250,"from":"c1","body":{"op":"put"}},"reply":{"type":"done","send":[{"to":"n2","body":{"op":"replicate"}}]}}

Hash() = 3f9c1e…(64 hex)` } },

{ id: "timers", label: "Timers", sub: "set · cancel · fire", g: "engine", x: 990, y: 520,
  cp: "CP10", owner: "Ash", status: "planned", adr: "PROTOCOL.md §5.2", file: "internal/sim/timers.go",
  what: "How a floret waits without sleeping. It asks for a timer in its reply and later gets a timer event.",
  takes: [["set_timers", "[{id, after}] from a reply, after in µs ≥ 1"], ["cancel_timers", "[id, …] from a reply"]],
  gives: [["timer events", "pushed into the queue at now + after"], ["protocol.Timer", "{type: timer, time, id} delivered to the floret"]],
  uses: ["Event queue", "Clock"],
  steps: [
    "cancel_timers first: mark each pending id cancelled. Unknown ids are ignored.",
    "set_timers next: push a timer event at now + after. Setting a pending id replaces it.",
    "If one reply names the same id twice, the later entry wins.",
    "When a timer pops and isn't cancelled, deliver {type: timer, id} to its floret."
  ],
  code: { real: false, title: "internal/sim/timers.go (proposed sketch)", src:
`type timerKey struct{ node, id string }

func (s *Sim) applyTimers(node string, d *protocol.Done) {
	for _, id := range d.CancelTimers {
		delete(s.pending, timerKey{node, id})
	}
	for _, t := range d.SetTimers {
		gen := s.nextGen()
		s.pending[timerKey{node, t.ID}] = gen // replaces an older one
		s.queue.push(Event{Time: s.clock.Now() + t.After,
			Type: "timer", Node: node, TimerID: t.ID, Gen: gen})
	}
}
// on pop: deliver only if s.pending[key] == ev.Gen` },
  example: { in: `now = 21250, reply: "set_timers":[{"id":"election","after":300000}]`, out:
`queue: timer n1/election @321250
(the older election timer @300000 is now stale and skipped)` } },

{ id: "storage", label: "Storage", sub: "survives crashes", g: "engine", x: 1400, y: 520,
  cp: "CP11", owner: "Ash", status: "planned", adr: "ADR 0010, PROTOCOL.md §7", file: "internal/sim/storage.go",
  what: "The only state a floret keeps through a crash. Diaspore holds it for the floret, like a disk that never fails.",
  takes: [["store", "map of key → string, or null to delete, from a reply"]],
  gives: [["stored", "the floret's full map, sent in init after a restart"]],
  uses: ["a map[string]string per floret"],
  steps: [
    "Applied first, before anything else in the reply, so a crash can't leave half a write.",
    "Listed keys are set, null deletes, unlisted keys stay as they were.",
    "On restart, the whole map goes into init.stored."
  ],
  code: { real: false, title: "internal/sim/storage.go (proposed sketch)", src:
`func (s *Sim) applyStore(node string, store map[string]*string) {
	m := s.stored[node]
	for k, v := range store {
		if v == nil {
			delete(m, k)
		} else {
			m[k] = *v
		}
	}
}` },
  example: { in: `stored {"term":"0"} + reply "store":{"x":"5","term":null}`, out: `stored {"x":"5"}` } },

/* ───────────── Simulated world ───────────── */
{ id: "network", label: "Simulated network", sub: "seeded delays", g: "world", x: 580, y: 520,
  cp: "CP6", owner: "Rudra", status: "planned", adr: "design §6", file: "internal/network/",
  what: "Florets never talk directly. Every message goes through Diaspore, which decides when it arrives, or whether it does.",
  takes: [["send", "[{to, body}] from a reply, in listed order"], ["delay stream", "seed.Stream(\"delay\")"], ["fault rules", "from CP14"]],
  gives: [["message events", "pushed into the queue at now + delay, zero, one or two copies"], ["fault trace lines", "kind: drop, duplicate"]],
  uses: ["Seed streams", "Fault rules", "Event queue", "Trace writer"],
  steps: [
    "Take each send in the order listed. Never sort: each one draws random numbers.",
    "Check the target is a peer or client and not the sender.",
    "Draw a delay from the delay stream.",
    "Run the fault rules: drop, duplicate, extra delay.",
    "Push each surviving copy as a message event at now + delay."
  ],
  code: { real: false, title: "internal/network/network.go (proposed sketch)", src:
`func (n *Network) Send(now vtime.Time, from string, s protocol.Send) {
	delay := vtime.Time(n.delay.Int64N(int64(n.max-n.min))) + n.min
	copies := n.faults.Apply(from, s.To, &delay) // 0, 1 or 2
	for i := 0; i < copies; i++ {
		n.queue.push(Event{Time: now + delay, Type: "message",
			Node: s.To, From: from, Body: s.Body})
	}
}` },
  example: { in: `t=1250 n1 send → n2, → n3 (delay 1ms-50ms, drop 0.02)`, out:
`n2: delay 20000 → arrives @21250
n3: drop roll 0.013 < 0.02 → dropped, trace kind "drop"` } },

{ id: "faults", label: "Fault rules", sub: "delay · drop · duplicate", g: "world", x: 580, y: 690,
  cp: "CP14", owner: "Rudra", status: "planned", adr: "design §6", file: "internal/faults/rules.go",
  what: "Building blocks that say which messages, what goes wrong and how often. Combining them makes complex failures.",
  takes: [["faults:", "rules from the resolved config"], ["a message", "from, to"], ["fault streams", "one per rule kind"]],
  gives: [["a verdict per message", "drop it, duplicate it, or add delay"]],
  uses: ["Seed streams", "a registry of fault kinds"],
  steps: [
    "Each rule kind registers itself by name: delay, drop, duplicate.",
    "For each message, every matching rule rolls from its own stream.",
    "chance is in parts per million: roll IntN(1_000_000) < chance.",
    "The result goes back to the network and into the trace."
  ],
  code: { real: false, title: "internal/faults/rules.go (proposed sketch)", src:
`type Rule interface {
	Matches(from, to string) bool
	Apply(r *rand.Rand, m *Msg) // may set m.Drop, m.Copies, m.Delay
}

type drop struct{ ppm int64 } // chance 0.02 → 20000

func (d drop) Apply(r *rand.Rand, m *Msg) {
	if r.Int64N(1_000_000) < d.ppm {
		m.Drop = true
	}
}` },
  example: { in: "- { fault: drop, chance: 1 }", out: "every matching message dropped (chance 0 drops none)" } },

{ id: "crash", label: "Crashes, partitions", sub: "kill · restart · split", g: "world", x: 580, y: 860,
  cp: "CP15", owner: "Ash", status: "planned", adr: "ADR 0010", file: "internal/faults/crash.go",
  what: "Faults that hit whole florets: killing a process, restarting it later, or splitting the network into groups.",
  takes: [["crash rule", "every: 5s-20s, restart_after: 1s-3s"], ["partition rule", "groups and duration"], ["crash stream", "seed.Stream(\"crash\")"]],
  gives: [["crash / restart events", "in the queue"], ["init with stored", "for the restarted floret"]],
  uses: ["Seed streams", "Event queue", "Process driver", "Storage", "Timers"],
  steps: [
    "Pick crash times and restart delays from the crash stream.",
    "On crash: SIGKILL (Linux, macOS) or TerminateProcess (Windows). No warning, no last reply.",
    "While down: its timers are cancelled, messages to it are dropped.",
    "On restart: spawn a fresh process and send init with the current time, stored and a new rand_seed.",
    "Partitions block messages between groups until they heal."
  ],
  code: { real: false, title: "internal/faults/crash.go (proposed sketch)", src:
`func (s *Sim) crash(node string) {
	s.florets.Kill(node)           // SIGKILL / TerminateProcess
	s.cancelAllTimers(node)
	s.down[node] = true
}

func (s *Sim) restart(node string) error {
	s.down[node] = false
	init := protocol.NewInit(node, s.peers(node),
		s.floretSeed(node), s.clock.Now(), s.stored[node])
	return s.florets.Start(node, init) // must reply protocol: 1
}` },
  example: { in: "crash n1 @400000, restart_after 1.5s", out:
`@400000  kill n1 (election timer cancelled)
@1900000 → {"type":"init","node":"n1","time":1900000,"stored":{"term":"1","x":"5"},"rand_seed":55120931,...}` } },

/* ───────────── Process boundary ───────────── */
{ id: "lockstep", label: "Lockstep driver", sub: "one event, one reply", g: "boundary", x: 1810, y: 350,
  cp: "CP9", owner: "Ash", status: "planned", adr: "design §4, ADR 0010", file: "internal/capitulum/",
  what: "Sends one event to one floret and waits for its one reply before anything else happens. This is what keeps runs identical.",
  takes: [["event", "protocol.Init, Message or Timer for one floret"]],
  gives: [["*protocol.Done", "the validated reply"], ["error", "protocol break, exit, or hang after the watchdog"]],
  uses: ["Process driver", "protocol.DecodeReply", "a real-time watchdog (10s default)"],
  steps: [
    "Encode the event and write it as one line to the floret's stdin.",
    "Wait for exactly one line on stdout, with a real-time watchdog running.",
    "Decode it strictly with protocol.DecodeReply, plus checks that need context (send targets).",
    "Return the reply. Only one floret process is ever running."
  ],
  code: { real: false, title: "internal/capitulum/lockstep.go (proposed sketch)", src:
`func (c *Capitulum) Deliver(node string, ev any) (*protocol.Done, error) {
	p := c.procs[node]
	if err := p.WriteLine(ev); err != nil {
		return nil, err
	}
	select {
	case line := <-p.lines:
		d, err := protocol.DecodeReply(line)
		if err != nil {
			return nil, fmt.Errorf("floret %s: %w", node, err)
		}
		return d, c.checkTargets(node, d)
	case <-p.exited:
		return nil, fmt.Errorf("floret %s exited with code %d", node, p.code)
	case <-time.After(c.watchdog): // real time, never touches the trace
		return nil, HangError{node}
	}
}` },
  example: { in: `n1 ← {"type":"timer","time":321250,"id":"election"}`, out: `n1 → {"type":"done","store":{"term":"1"},"send":[...],"set_timers":[...]}
round trip ≈ 7.7 µs for a Go floret (E4)` } },

{ id: "driver", label: "Process driver", sub: "spawn · pipes · kill", g: "boundary", x: 1810, y: 180,
  cp: "CP8", owner: "Ash", status: "planned", adr: "ADR 0006", file: "internal/capitulum/process.go",
  what: "Starts each floret as a real OS process and connects to it through stdin, stdout and stderr.",
  takes: [["florets.command", "argv from the config"], ["node name", "n1, n2, n3"], ["init", "protocol.NewInit(...)"]],
  gives: [["a running process", "with line-based stdin/stdout"], ["stderr file", "per floret, never parsed"], ["error", "if the init reply's protocol isn't 1"]],
  uses: ["os/exec", "bufio", "goroutines (only here, design §12)"],
  steps: [
    "exec.Command(argv...) without a shell, once per floret.",
    "A goroutine reads stdout line by line; stderr goes to a file.",
    "Send init. The reply must carry protocol: 1, or the run stops before it starts.",
    "Kill on crash or at the end of the run."
  ],
  code: { real: false, title: "internal/capitulum/process.go (proposed sketch)", src:
`func start(node string, argv []string, stderr io.Writer) (*proc, error) {
	cmd := exec.Command(argv[0], argv[1:]...)
	in, _ := cmd.StdinPipe()
	out, _ := cmd.StdoutPipe()
	cmd.Stderr = stderr
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	p := &proc{cmd: cmd, in: in, lines: make(chan []byte)}
	go p.readLines(bufio.NewScanner(out)) // accepts \\n and \\r\\n
	return p, nil
}` },
  example: { in: `argv ["./kvnode"], node n1`, out:
`→ {"type":"init","protocol":1,"node":"n1","peers":["n2","n3"],"rand_seed":918273,"time":0,"stored":{}}
← {"type":"done","protocol":1,"set_timers":[{"id":"election","after":300000}]}` } },

{ id: "protocol", label: "Floret protocol v1", sub: "3 events in, 1 reply out", g: "boundary", x: 1810, y: 520,
  cp: "CP7", owner: "Ash", status: "built", adr: "ADR 0006–0009", file: "internal/protocol/protocol.go",
  what: "The contract between Diaspore and any floret: three events in (init, message, timer), one reply out (done), as JSON lines.",
  takes: [["reply line", "[]byte from a floret's stdout"], ["event fields", "to build init, message, timer"]],
  gives: [["*protocol.Done", "or an error naming the problem"], ["Init / Message / Timer", "values ready to encode"]],
  uses: ["encoding/json with DisallowUnknownFields", "sim.Time", "schema/*.json (checked against the Go code in tests)"],
  steps: [
    "Replies are strict: unknown fields, trailing data, wrong types are errors.",
    "Events are lenient: florets ignore fields they don't know.",
    "validate() checks what the decoder can't: type is done, after is 1 to 2^53 − 1, send has a to and an object body.",
    "Every integer stays within 0 to 2^53 − 1 so JavaScript florets read it exactly."
  ],
  code: { real: true, title: "internal/protocol/protocol.go (main)", src:
`type Done struct {
	Type         string             §json:"type"§
	Protocol     *int               §json:"protocol,omitempty"§
	Send         []Send             §json:"send,omitempty"§
	SetTimers    []SetTimer         §json:"set_timers,omitempty"§
	CancelTimers []string           §json:"cancel_timers,omitempty"§
	Store        map[string]*string §json:"store,omitempty"§
	Log          []string           §json:"log,omitempty"§
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
}` },
  example: { in: `{"type":"done","set_timer":[{"id":"e","after":5}]}`, out: `invalid reply: json: unknown field "set_timer"` } },

{ id: "failures", label: "Protocol breaks", sub: "stop the run", g: "boundary", x: 1810, y: 690,
  cp: "CP8, CP9", owner: "Ash", status: "planned", adr: "ADR 0010, PROTOCOL.md §8", file: "internal/capitulum/",
  what: "When a floret breaks the protocol, the run stops and counts as a failure, because the same seed reproduces it.",
  takes: [["errors", "from the lockstep driver and process driver"]],
  gives: [["Failure{kind: protocol}", "with floret, time, step and reason"], ["a .pappus", "like a checker failure"]],
  uses: ["Lockstep driver", "Pappus writer"],
  steps: [
    "Invalid JSON, invalid reply, unknown field, send to an unknown name or to itself: stop.",
    "Output before the first event, or more than one line per event: stop.",
    "Floret exits on its own: stop, with the last lines of its stderr. Never restarted.",
    "No reply within the watchdog: stop, marked as a hang.",
    "Exception: protocol version mismatch on init is a plain error before the run, with no pappus."
  ],
  code: { real: false, title: "failure reasons (PROTOCOL.md §8)", src:
`floret n2: reply is not valid JSON: ...
floret n2: invalid reply: ...
floret n2: unknown reply field "set_timer"
floret n2: send to unknown name "n4"
floret n2: send to itself, use a timer instead
floret n2: unexpected output on stdout
floret n2 exited with code 1
floret n2: no reply within 10s of real time` },
  example: { in: `n2 replies: {"type":"done","send":[{"to":"n2","body":{}}]}`, out:
`FAIL protocol at step 512: floret n2: send to itself, use a timer instead
wrote runs/run-8837421.pappus` } },

/* ───────────── Florets ───────────── */
{ id: "floret", label: "Florets n1 · n2 · n3", sub: "your program, any language", g: "florets", x: 2220, y: 180,
  cp: "CP17, CP22", owner: "HK, Ash", status: "planned", adr: "design §14", file: "examples/kv/main.go",
  what: "The system under test. A separate program that loops: read one event, update its state, write one reply.",
  takes: [["stdin", "events, one JSON line each: init, message, timer"]],
  gives: [["stdout", "one done reply per event, flushed"], ["stderr", "free debug text, saved but never parsed"]],
  uses: ["only its own memory, rand_seed and the event's time; no network, clock or sleep"],
  steps: [
    "Read a line, parse the event.",
    "init: restore state from stored. message: handle a client request or a peer's message. timer: do periodic work.",
    "Describe every effect in the reply: send, set_timers, store, log.",
    "Write the reply as one line and flush."
  ],
  code: { real: false, title: "examples/kv/main.go (minimal sketch, one node)", src:
`var data = map[string]string{} // memory: wiped on crash

func handle(e Event) Reply {
	switch e.Type {
	case "init":
		data = e.Stored
		return Reply{Type: "done", Protocol: 1}
	case "message":
		if e.Body["op"] == "put" {
			k, v := e.Body["key"].(string), fmt.Sprint(e.Body["value"])
			data[k] = v
			return Reply{Type: "done",
				Store: map[string]*string{k: &v}, // save before the ack
				Send:  []Send{{To: e.From, Body: map[string]any{"op": "put_ok", "key": k}}}}
		}
	}
	return Reply{Type: "done"}
}

func main() {
	in, out := bufio.NewScanner(os.Stdin), json.NewEncoder(os.Stdout)
	for in.Scan() {
		var e Event
		json.Unmarshal(in.Bytes(), &e)
		out.Encode(handle(e)) // os.Stdout is unbuffered in Go
	}
}` },
  example: { in: `{"type":"message","time":1250,"from":"c1","body":{"op":"put","key":"x","value":5}}`, out: `{"type":"done","store":{"x":"5"},"send":[{"to":"c1","body":{"op":"put_ok","key":"x"}}]}` } },

{ id: "contract", label: "Determinism rules", sub: "what florets must do", g: "florets", x: 2220, y: 350,
  cp: "—", owner: "everyone", status: "built", adr: "design §12, PROTOCOL.md §6", file: "PROTOCOL.md",
  what: "The rules a floret follows so that the same seed gives the same run. Diaspore can't enforce them, but check-determinism catches breaks.",
  takes: [["a floret", "any language"]],
  gives: [["determinism", "same events in, same replies out"]],
  uses: ["check-determinism to catch breaks"],
  steps: [
    "Flush stdout after every reply. Exactly one line per event.",
    "Never read a real clock or sleep. Use the event's time and timers.",
    "Never open network connections. Use send.",
    "Only use a random generator seeded from rand_seed.",
    "Never depend on map iteration order, threads, env vars, hostnames or files.",
    "Keep anything that must survive a crash in store."
  ],
  code: { real: false, title: "per language (PROTOCOL.md §10)", src:
`// Go
r := rand.New(rand.NewPCG(uint64(seed), 0))   // never top-level rand

# Python
rng = random.Random(rand_seed)                 # never module random
print(json.dumps(reply), flush=True)

// JavaScript
// Math.random can't be seeded: use sfc32 or mulberry32 from rand_seed` },
  example: { in: "floret reads time.Now() to decide an election timeout", out: "check-determinism: traces differ at step 41 (n2 reply)" } },

/* ───────────── Workload ───────────── */
{ id: "workload", label: "Workload clients", sub: "c1 · c2 · c3, in Diaspore", g: "world", x: 580, y: 350,
  cp: "CP16", owner: "HK", status: "planned", adr: "design §8", file: "internal/workload/",
  what: "Simulated users that send requests to florets. They are Go code inside Diaspore, not processes.",
  takes: [["workload:", "type kv, clients, ops, timeout"], ["workload stream", "seed.Stream(\"workload\")"], ["client messages", "replies florets send to c1, c2, c3"]],
  gives: [["request events", "message events from cN into the queue"], ["history entries", "request, result, start and end time"]],
  uses: ["Seed streams", "Event queue", "History writer"],
  steps: [
    "From the workload stream, pick each client's next op, key, value, target floret and time.",
    "Push it as a message event from cN.",
    "When a floret sends to cN, match it to the open request and record the result.",
    "If the client's timeout passes first, record the outcome as unknown."
  ],
  code: { real: false, title: "internal/workload/kv.go (proposed sketch)", src:
`func (w *KV) next(c string, now vtime.Time) Event {
	op := []string{"put", "get"}[w.r.IntN(2)]
	key := fmt.Sprintf("k%d", w.r.IntN(w.keys))
	body := map[string]any{"op": op, "key": key}
	if op == "put" {
		body["value"] = w.r.IntN(1000)
	}
	to := w.florets[w.r.IntN(len(w.florets))]
	return Event{Time: now + w.gap(), Type: "message", From: c, Node: to, Body: body}
}` },
  example: { in: "clients: 3, ops: 200", out:
`c1 → n1 {"op":"put","key":"x","value":5} @1250
c2 → n3 {"op":"get","key":"x"}          @3400` } },

/* ───────────── Verdict and outputs ───────────── */
{ id: "history", label: "History", sub: "history.jsonl", g: "verdict", x: 2630, y: 180,
  cp: "CP16", owner: "HK", status: "planned", adr: "design §8, §10", file: "internal/workload/history.go",
  what: "What every client asked and got back, with times. The evidence the checkers judge.",
  takes: [["invoke", "client, op, key, value, start time"], ["complete", "result and end time, or unknown on timeout"]],
  gives: [["history.jsonl", "one entry per request"]],
  uses: ["encoding/json"],
  steps: [
    "Open an entry when a client sends a request.",
    "Close it with the result when the reply arrives.",
    "Mark it unknown if the client gave up.",
    "Write history.jsonl at the end."
  ],
  code: { real: false, title: "history entry (proposed sketch)", src:
`type Op struct {
	Client string     §json:"client"§
	Op     string     §json:"op"§     // put | get
	Key    string     §json:"key"§
	Value  *int       §json:"value,omitempty"§
	Result string     §json:"result"§ // ok | fail | unknown
	Start  vtime.Time §json:"start"§
	End    vtime.Time §json:"end,omitempty"§
}` },
  example: { in: "c1 put x=5 acked at 41900", out: `{"client":"c1","op":"put","key":"x","value":5,"result":"ok","start":1250,"end":41900}` } },

{ id: "checkers", label: "Checkers", sub: "acked-writes · linearizability", g: "verdict", x: 2630, y: 350,
  cp: "CP18, CP21", owner: "HK", status: "planned", adr: "design §9", file: "internal/check/",
  what: "Read the history after the run and decide whether a rule broke. This is where a bug becomes a failure.",
  takes: [["history", "[]Op"], ["checkers:", "names from the config"]],
  gives: [["nil", "rule held"], ["Failure{kind: checker}", "checker, time, reason"]],
  uses: ["History", "Porcupine (linearizability)", "a registry of checkers by name"],
  steps: [
    "acked-writes: every put that got ok must still be readable by any later get that starts after it ends.",
    "linearizability: every op must look like it happened at one instant between its start and end.",
    "Unknown outcomes count as maybe-happened, never as failed.",
    "The first broken rule fails the run."
  ],
  code: { real: false, title: "internal/check/acked.go (proposed sketch)", src:
`type Checker interface {
	Name() string
	Check(h []workload.Op) *Failure
}

func (ackedWrites) Check(h []workload.Op) *Failure {
	acked := map[string]workload.Op{} // key → last acked put
	for _, op := range h {            // in start order
		switch {
		case op.Op == "put" && op.Result == "ok":
			acked[op.Key] = op
		case op.Op == "get" && op.Result == "ok":
			if w, ok := acked[op.Key]; ok && op.Start > w.End && op.Value == nil {
				return &Failure{Time: op.End,
					Reason: fmt.Sprintf("write %s=%d was acked, then lost", op.Key, *w.Value)}
			}
		}
	}
	return nil
}` },
  example: { in:
`c1 put x=5 ok [1250..41900]
c2 get x → (missing) [2000000..2050000]`, out: "FAIL acked-writes at 2.050000s: write x=5 was acked, then lost" } },

{ id: "pappus", label: ".pappus file", sub: "a failure you can replay", g: "verdict", x: 2630, y: 520,
  cp: "CP19", owner: "Rudra", status: "designing", adr: "ADR 0013 (proposed)", file: "internal/pappus/pappus.go",
  what: "The replay file written when a run fails. Everything needed to reproduce the failure on another machine.",
  takes: [["seed", "uint64, at most 2^53 − 1"], ["config.Config", "resolved"], ["floret hashes", "SHA-256 of each program"], ["trace hash", "from the trace writer"], ["Failure", "kind, checker or floret, time, step, reason"]],
  gives: [["runs/run-<seed>.pappus", "indented JSON, fixed field order, trailing newline"]],
  uses: ["encoding/json", "crypto/sha256"],
  steps: [
    "Collect seed, config, versions, floret hashes, trace hash and step count.",
    "Add the failure.",
    "Write it with a fixed field order and no wall-clock time, so writing the same run twice gives the same bytes."
  ],
  code: { real: false, title: "internal/pappus/pappus.go (proposed sketch, ADR 0013)", src:
`type Pappus struct {
	Pappus    int           §json:"pappus"§   // format version, 1
	Diaspore  string        §json:"diaspore"§ // "0.1.0"
	Protocol  int           §json:"protocol"§
	Seed      uint64        §json:"seed"§     // ≤ 2^53 − 1
	Config    config.Config §json:"config"§
	Florets   FloretHash    §json:"florets"§
	TraceHash string        §json:"trace_hash"§
	Steps     int64         §json:"steps"§
	Failure   Failure       §json:"failure"§
}

type Failure struct {
	Kind    string     §json:"kind"§ // checker | protocol
	Checker string     §json:"checker,omitempty"§
	Floret  string     §json:"floret,omitempty"§
	Time    vtime.Time §json:"time"§
	Step    int64      §json:"step"§
	Reason  string     §json:"reason"§
}` },
  example: { in: "seed 8837421 failed acked-writes", out:
`{
  "pappus": 1, "diaspore": "0.1.0", "protocol": 1,
  "seed": 8837421,
  "config": { ... },
  "florets": { "command": ["./kvnode"], "sha256": "a1b2…" },
  "trace_hash": "3f9c…",
  "steps": 18342,
  "failure": { "kind": "checker", "checker": "acked-writes",
               "time": 83120000, "step": 17001,
               "reason": "write x=5 was acked, then lost after n1 crashed" }
}` } },

{ id: "replay", label: "Replay", sub: "same seed, same hash", g: "verdict", x: 2630, y: 690,
  cp: "CP19", owner: "Rudra", status: "planned", adr: "ADR 0013 (proposed)", file: "cmd/diaspore/replay.go",
  what: "Reruns a saved failure from its .pappus and proves it happened the same way.",
  takes: [["file.pappus", "path"], ["--strict", "refuse if a floret program changed"]],
  gives: [["same hash", "the exact same run happened"], ["warning", "floret program changed since the pappus"], ["different hash", "the run changed, for example after a fix"]],
  uses: ["Pappus reader", "Main loop", "Trace writer"],
  steps: [
    "Read seed, config and floret hashes from the pappus.",
    "Hash the floret programs on disk. If one differs, warn, or stop with --strict.",
    "Run the simulation with the same seed and config.",
    "Compare the new trace hash with the stored one."
  ],
  code: { real: false, title: "cmd/diaspore/replay.go (proposed sketch)", src:
`func replay(p pappus.Pappus, strict bool) int {
	if changed := p.Florets.Changed(); changed != "" {
		fmt.Fprintf(os.Stderr, "warning: %s changed since this pappus\\n", changed)
		if strict {
			return 2
		}
	}
	res := sim.New(p.Config, seed.NewSource(p.Seed)).Run()
	if res.TraceHash == p.TraceHash {
		fmt.Println("replay: same trace hash, same failure")
		return 1
	}
	fmt.Println("replay: trace hash differs")
	return 0
}` },
  example: { in: "$ diaspore replay runs/run-8837421.pappus", out:
`replay: same trace hash 3f9c…, same failure
FAIL acked-writes at 83.120000s: write x=5 was acked, then lost after n1 crashed` } },

{ id: "determinism", label: "check-determinism", sub: "run twice, compare", g: "verdict", x: 2630, y: 860,
  cp: "CP12", owner: "Ash", status: "planned", adr: "design §12", file: "cmd/diaspore/determinism.go",
  what: "Catches florets (or Diaspore bugs) that break determinism, before they make replays lie.",
  takes: [["--seed", "one seed"], ["diaspore.yaml", "the setup"]],
  gives: [["ok", "both traces byte for byte equal"], ["first difference", "step number and both lines"]],
  uses: ["Main loop ×2", "Trace writer"],
  steps: [
    "Run the seed once and keep its trace.",
    "Run it again.",
    "Compare line by line and report the first line that differs. CI runs this on every commit."
  ],
  code: { real: false, title: "cmd/diaspore/determinism.go (proposed sketch)", src:
`a, b := runTrace(cfg, s), runTrace(cfg, s)
for i := range min(len(a), len(b)) {
	if !bytes.Equal(a[i], b[i]) {
		fmt.Printf("traces differ at line %d\\n  run 1: %s\\n  run 2: %s\\n", i+1, a[i], b[i])
		return 1
	}
}
fmt.Println("deterministic: same", len(a), "lines, same hash")` },
  example: { in: "$ diaspore check-determinism --seed 42", out:
`traces differ at line 41
  run 1: {"step":41,"node":"n2",...,"reply":{"set_timers":[{"id":"e","after":300000}]}}
  run 2: {"step":41,"node":"n2",...,"reply":{"set_timers":[{"id":"e","after":287113}]}}` } },

/* ───────────── Scale ───────────── */
{ id: "dandelion", label: "Dandelion sweep", sub: "many seeds in parallel", g: "scale", x: 990, y: 860,
  cp: "CP19, CP20", owner: "Rudra", status: "planned", adr: "design §13", file: "internal/dandelion/",
  what: "Runs many seeds to hunt for one that fails. This is how Diaspore finds bugs, not just replays them.",
  takes: [["--seeds", "a range like 1-500"], ["--workers", "parallel runs, default the CPU count"]],
  gives: [["one report per failing seed", "with its .pappus"], ["seeds per second", "for the scaling results"]],
  uses: ["Main loop", "goroutines between seeds, never inside a run"],
  steps: [
    "Put every seed of the range on a channel.",
    "Each worker goroutine takes a seed and runs a full simulation, single-threaded inside.",
    "Collect failures; write a pappus for each.",
    "Report every failing seed once."
  ],
  code: { real: false, title: "internal/dandelion/sweep.go (proposed sketch)", src:
`func Sweep(cfg config.Config, from, to uint64, workers int) []Failure {
	seeds, out := make(chan uint64), make(chan Failure)
	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for s := range seeds {
				if f := sim.New(cfg, seed.NewSource(s)).Run().Failure; f != nil {
					out <- *f
				}
			}
		}()
	}
	go func() {
		for s := from; s <= to; s++ { seeds <- s }
		close(seeds); wg.Wait(); close(out)
	}()
	return collect(out)
}` },
  example: { in: "$ diaspore dandelion --seeds 1-500 --workers 8", out:
`500 seeds in 41s (12.2 seeds/s, 8 workers)
FAIL seed 137  acked-writes  → runs/run-137.pappus
FAIL seed 412  acked-writes  → runs/run-412.pappus` } },

{ id: "coordinator", label: "Coordinator", sub: "workers across machines", g: "scale", x: 1400, y: 860,
  cp: "CP24", owner: "Rudra", status: "planned", adr: "design §13, §17", file: "internal/dandelion/coord/",
  what: "Spreads a dandelion across machines. The part of Diaspore that is itself a distributed system.",
  takes: [["a seed range", "and a list of worker addresses"]],
  gives: [["failures from every worker", "deduplicated"], ["throughput numbers", "seeds per second vs workers"]],
  uses: ["net/http or net/rpc (still open)", "a dandelion on each worker"],
  steps: [
    "Split the range into chunks and hand them to workers.",
    "Workers run their chunk and send back failures and a done message.",
    "If a worker stops answering, give its chunk to another worker.",
    "Re-running a seed is safe: the same seed always gives the same run."
  ],
  code: { real: false, title: "coordinator ⇄ worker messages (proposed sketch)", src:
`// coordinator → worker
type Assign struct {
	Chunk  int    §json:"chunk"§
	From   uint64 §json:"from"§
	To     uint64 §json:"to"§
	Config []byte §json:"config"§ // resolved diaspore.yaml
}

// worker → coordinator
type Report struct {
	Chunk    int             §json:"chunk"§
	Failures []pappus.Pappus §json:"failures"§
	Done     bool            §json:"done"§
}` },
  example: { in: "seeds 1-10000, 3 machines, worker B dies at chunk 7", out:
`chunk 7 reassigned to worker C
10000 seeds · 2 failures · 3 workers` } }
];

/* [from, to, label, options]
   main: drawn by default (the main flow). Others appear when a connected box is selected or "All links" is on.
   both: arrow both ways. dashed: a check or a loop back, not data flow. bend: curve sideways by this many px. */
const EDGES = [
  ["cli", "seed", "--seed n", { main: 1 }],
  ["cli", "yaml", "reads", { main: 1 }],
  ["seed", "streams", "split by name", { main: 1 }],
  ["yaml", "workload", "workload:", { main: 1 }],
  ["yaml", "faults", "faults:", { main: 1 }],
  ["yaml", "driver", "florets.command", { bend: -260 }],
  ["streams", "workload", "workload stream", { main: 1 }],
  ["streams", "network", "delay stream", { bend: 300 }],
  ["streams", "driver", "rand_seed per floret", { bend: -150 }],
  ["workload", "queue", "client requests", { main: 1 }],
  ["queue", "loop", "pop earliest", { main: 1 }],
  ["loop", "clock", "advanceTo(t)", { main: 1 }],
  ["loop", "trace", "Step(ev, reply)", { main: 1 }],
  ["loop", "lockstep", "event → ← reply", { main: 1, both: 1 }],
  ["lockstep", "driver", "one line each way", { main: 1, both: 1 }],
  ["driver", "floret", "stdin / stdout", { main: 1, both: 1 }],
  ["protocol", "lockstep", "DecodeReply", { main: 1 }],
  ["contract", "floret", "rules", { main: 1, dashed: 1 }],
  ["loop", "timers", "set / cancel", { main: 1 }],
  ["timers", "queue", "timer events", { main: 1 }],
  ["loop", "storage", "store", { main: 1 }],
  ["storage", "driver", "stored on init", {}],
  ["loop", "network", "each send", { main: 1 }],
  ["faults", "network", "drop / dup", { main: 1 }],
  ["network", "queue", "arrival events", { main: 1 }],
  ["crash", "queue", "crash / restart", {}],
  ["crash", "driver", "kill / respawn", {}],
  ["loop", "workload", "replies to clients", { bend: 120 }],
  ["workload", "history", "records", { bend: -330 }],
  ["lockstep", "failures", "break or hang", { main: 1, bend: -300 }],
  ["failures", "pappus", "recorded", { main: 1 }],
  ["history", "checkers", "read at end", { main: 1 }],
  ["checkers", "pappus", "on failure", { main: 1 }],
  ["trace", "pappus", "trace_hash", {}],
  ["pappus", "replay", "input", { main: 1 }],
  ["replay", "trace", "compare hash", { dashed: 1 }],
  ["determinism", "trace", "run twice, diff", { dashed: 1 }],
  ["dandelion", "seed", "seed range", { dashed: 1 }],
  ["coordinator", "dandelion", "hands out ranges", { main: 1 }],
  ["dandelion", "pappus", "one per failing seed", { dashed: 1 }]
];

/* Zones are drawn around their boxes automatically. */
const ZONES = [
  { key: "input",    label: "You give" },
  { key: "world",    label: "Seeded world" },
  { key: "engine",   label: "Engine · one thread" },
  { key: "boundary", label: "Process boundary" },
  { key: "florets",  label: "Florets · OS processes" },
  { key: "verdict",  label: "Verdict and outputs" },
  { key: "scale",    label: "Scale" }
];
