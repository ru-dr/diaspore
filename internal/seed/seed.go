package seed

import (
	"crypto/sha256"
	"encoding/binary"
	"math/rand/v2"
)

type Source struct {
	masterSeed uint64
	streams    map[string]*rand.Rand
}

func NewSource(masterSeed uint64) *Source {
	sMap := make(map[string]*rand.Rand)
	return &Source{
		masterSeed: masterSeed,
		streams:    sMap,
	}
}

func (s *Source) Stream(name string) *rand.Rand {
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
}
