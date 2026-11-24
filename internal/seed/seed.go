// Package seed turns one master seed into many independent random streams.
package seed

import (
	"crypto/sha256"
	"encoding/binary"
	"math/rand/v2"
)

// Source hands out one random stream per name, all derived from the master seed.
type Source struct {
	masterSeed uint64
	streams    map[string]*rand.Rand
}

// NewSource creates a Source for the given master seed.
func NewSource(masterSeed uint64) *Source {
	sMap := make(map[string]*rand.Rand)
	return &Source{
		masterSeed: masterSeed,
		streams:    sMap,
	}
}

// Stream returns the stream for name, creating it on first use.
// The same seed and name always give the same numbers (see ADR 0004).
func (s *Source) Stream(name string) *rand.Rand {
	if existing, ok := s.streams[name]; ok {
		return existing
	}

	// Hash input: master seed as 8 big-endian bytes, then the name.
	input := make([]byte, 8)
	binary.BigEndian.PutUint64(input, s.masterSeed)
	input = append(input, name...)

	// First 16 bytes of the hash become the two PCG seeds.
	digest := sha256.Sum256(input)
	seedHi := binary.BigEndian.Uint64(digest[0:8])
	seedLo := binary.BigEndian.Uint64(digest[8:16])

	gen := rand.New(rand.NewPCG(seedHi, seedLo))
	s.streams[name] = gen
	return gen
}
