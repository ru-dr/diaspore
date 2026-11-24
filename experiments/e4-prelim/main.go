// Preliminary E4 measurement: the cost of one lockstep round trip to a separate floret process.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"time"
)

// event is a typical message event Diaspore would send.
const event = `{"type":"message","time":1250,"from":"c1","body":{"op":"put","key":"x","value":5}}`

// reply is a typical done a floret would send back.
const reply = `{"type":"done","send":[{"to":"n2","body":{"op":"replicate","key":"x","value":5}}]}`

// nodeChild is a minimal JavaScript floret that answers every line with one reply.
const nodeChild = "const rl=require('readline').createInterface({input:process.stdin});rl.on('line',()=>process.stdout.write('" + reply + "\\n'));"

// must stops the program on any setup error.
func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

// child is a minimal Go floret: one reply per event, flushed every time.
func child() {
	in := bufio.NewScanner(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	for in.Scan() {
		out.WriteString(reply + "\n")
		out.Flush()
	}
}

func main() {
	lang := flag.String("lang", "go", "child floret language: go or node")
	n := flag.Int("n", 20000, "number of round trips to measure")
	flag.Parse()
	if flag.Arg(0) == "child" {
		child()
		return
	}

	// Start the child floret as a separate process, like Diaspore will.
	var cmd *exec.Cmd
	if *lang == "node" {
		cmd = exec.Command("node", "-e", nodeChild)
	} else {
		self, err := os.Executable()
		must(err)
		cmd = exec.Command(self, "child")
	}
	stdin, err := cmd.StdinPipe()
	must(err)
	stdout, err := cmd.StdoutPipe()
	must(err)
	w := bufio.NewWriter(stdin)
	r := bufio.NewReader(stdout)

	// roundTrip sends one event line and waits for one reply line.
	roundTrip := func() time.Duration {
		t := time.Now()
		w.WriteString(event + "\n")
		must(w.Flush())
		_, err := r.ReadString('\n')
		must(err)
		return time.Since(t)
	}

	// Startup = spawn the process and get its first reply.
	start := time.Now()
	must(cmd.Start())
	roundTrip()
	startup := time.Since(start)

	// Warm up, then measure.
	for i := 0; i < 1000; i++ {
		roundTrip()
	}
	d := make([]time.Duration, *n)
	var total time.Duration
	for i := range d {
		d[i] = roundTrip()
		total += d[i]
	}
	sort.Slice(d, func(i, j int) bool { return d[i] < d[j] })
	mean := total / time.Duration(*n)
	pct := func(p float64) time.Duration { return d[int(p*float64(*n-1))] }

	fmt.Printf("floret language:      %s\n", *lang)
	fmt.Printf("round trips measured: %d\n", *n)
	fmt.Printf("startup (spawn + first reply): %v\n", startup)
	fmt.Printf("round trip mean: %v  p50: %v  p95: %v  p99: %v\n", mean, pct(0.50), pct(0.95), pct(0.99))
	fmt.Printf("max events/sec for one floret in lockstep: %.0f\n", float64(time.Second)/float64(mean))

	stdin.Close()
	cmd.Wait()
}
