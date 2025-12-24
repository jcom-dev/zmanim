package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Server    ServerConfig
	Database  DatabaseConfig
	JWT       JWTConfig
	CORS      CORSConfig
	RateLimit RateLimitConfig
}

// ServerConfig holds server-specific configuration
type ServerConfig struct {
	Host        string
	Port        string
	Environment string
}

// DatabaseConfig holds database connection configuration
type DatabaseConfig struct {
	URL string
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret   string
	JWKSUrl  string
	Issuer   string
	Audience string
}

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins []string
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	Requests int
	Duration time.Duration
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if it exists (for local development)
	_ = godotenv.Load()

	config := &Config{
		Server: ServerConfig{
			Host:        getEnv("HOST", "127.0.0.1"),
			Port:        getEnv("PORT", "8080"),
			Environment: getEnv("ENVIRONMENT", "development"),
		},
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", ""),
		},
		JWT: JWTConfig{
			Secret:   getEnv("JWT_SECRET", ""),
			JWKSUrl:  getEnv("CLERK_JWKS_URL", ""),
			Issuer:   getEnv("CLERK_ISSUER", ""),
			Audience: getEnv("CLERK_AUDIENCE", ""),
		},
		CORS: CORSConfig{
			AllowedOrigins: getEnvSlice("ALLOWED_ORIGINS", []string{
				"http://localhost:3000",
				"http://localhost:3001",
				"http://127.0.0.1:3000",
				"http://127.0.0.1:3001",
				"https://localhost:3000",
				"https://localhost:3001",
				"https://127.0.0.1:3000",
				"https://127.0.0.1:3001",
			}),
		},
		RateLimit: RateLimitConfig{
			Requests: getEnvInt("RATE_LIMIT_REQUESTS", 60),
			Duration: getEnvDuration("RATE_LIMIT_DURATION", time.Minute),
		},
	}

	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return config, nil
}

// Validate checks if all required configuration values are present
func (c *Config) Validate() error {
	if c.Database.URL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.JWT.Secret == "" && c.Server.Environment == "production" {
		return fmt.Errorf("JWT_SECRET is required in production")
	}
	return nil
}

// getEnv gets an environment variable with a fallback value
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// getEnvInt gets an integer environment variable with a fallback value
func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return fallback
}

// getEnvDuration gets a duration environment variable with a fallback value
func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return fallback
}

// getEnvSlice gets a comma-separated environment variable as a slice
func getEnvSlice(key string, fallback []string) []string {
	if value := os.Getenv(key); value != "" {
		// Simple split by comma
		result := []string{}
		current := ""
		for _, char := range value {
			if char == ',' {
				if current != "" {
					result = append(result, current)
					current = ""
				}
			} else {
				current += string(char)
			}
		}
		if current != "" {
			result = append(result, current)
		}
		return result
	}
	return fallback
}
