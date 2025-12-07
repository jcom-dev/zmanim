// Package services provides business logic services
package services

import (
	"sync"

	"github.com/ringsaturn/tzf"
)

// TimezoneService provides timezone lookup from coordinates
type TimezoneService struct {
	finder tzf.F
	mu     sync.RWMutex
}

var (
	tzService     *TimezoneService
	tzServiceOnce sync.Once
)

// GetTimezoneService returns the singleton timezone service
func GetTimezoneService() *TimezoneService {
	tzServiceOnce.Do(func() {
		finder, err := tzf.NewDefaultFinder()
		if err != nil {
			// If we can't initialize, create a nil-safe service
			tzService = &TimezoneService{}
			return
		}
		tzService = &TimezoneService{finder: finder}
	})
	return tzService
}

// LookupTimezone returns the IANA timezone for the given coordinates
// Returns "UTC" if lookup fails or service is not initialized
func (s *TimezoneService) LookupTimezone(lat, lng float64) string {
	if s.finder == nil {
		return "UTC"
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	tz := s.finder.GetTimezoneName(lng, lat)
	if tz == "" {
		return "UTC"
	}
	return tz
}

// FixTimezoneIfUTC returns the correct timezone if the provided one is UTC
// This is used to fix cities with missing timezone data
func (s *TimezoneService) FixTimezoneIfUTC(tz string, lat, lng float64) string {
	if tz == "UTC" || tz == "" {
		return s.LookupTimezone(lat, lng)
	}
	return tz
}
