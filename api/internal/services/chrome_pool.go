package services

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
)

// ChromePool manages a pool of reusable Chrome browser contexts for PDF generation
// This eliminates cold start delays on the first PDF request
type ChromePool struct {
	allocCtx      context.Context
	allocCancel   context.CancelFunc
	mu            sync.Mutex
	initialized   bool
	initOnce      sync.Once
	chromePath    string
	allocatorOpts []chromedp.ExecAllocatorOption
}

// NewChromePool creates a new Chrome pool
func NewChromePool() *ChromePool {
	return &ChromePool{}
}

// initialize sets up the Chrome allocator context (runs only once)
func (p *ChromePool) initialize() error {
	var initErr error
	p.initOnce.Do(func() {
		// Build allocator options
		allocatorOpts := append(chromedp.DefaultExecAllocatorOptions[:],
			chromedp.DisableGPU,
			chromedp.NoSandbox,                           // Required for running in containers
			chromedp.Flag("disable-dev-shm-usage", true), // Avoid /dev/shm issues in containers
		)

		// Check for Chrome/Chromium path in order of preference
		// Prefer google-chrome over chromium-browser (snap) due to file:// protocol sandbox issues
		chromePaths := []string{
			"/usr/bin/google-chrome",
			"/usr/bin/chromium",
			"/usr/bin/chromium-browser",
			"/snap/bin/chromium",
		}

		var foundPath string
		for _, chromePath := range chromePaths {
			if _, err := os.Stat(chromePath); err == nil {
				foundPath = chromePath
				allocatorOpts = append(allocatorOpts, chromedp.ExecPath(chromePath))
				break
			}
		}

		if foundPath == "" {
			slog.Warn("No Chrome/Chromium binary found, relying on system default")
		} else {
			slog.Info("Chrome pool initialized", "chrome_path", foundPath)
		}

		// Create persistent allocator context
		p.allocCtx, p.allocCancel = chromedp.NewExecAllocator(context.Background(), allocatorOpts...)
		p.chromePath = foundPath
		p.allocatorOpts = allocatorOpts
		p.initialized = true

		// Warm up the Chrome instance by creating and immediately closing a context
		// This ensures Chrome is fully launched and ready for the first real request
		go p.warmup()
	})

	return initErr
}

// warmup pre-launches Chrome to eliminate first-request cold start
func (p *ChromePool) warmup() {
	ctx, cancel := chromedp.NewContext(p.allocCtx)
	defer cancel()

	// Set a timeout for warmup (allow time for Chrome launch and font loading)
	ctx, cancel2 := context.WithTimeout(ctx, 30*time.Second)
	defer cancel2()

	// Navigate to a simple data URL to initialize Chrome
	_ = chromedp.Run(ctx, chromedp.Navigate("data:text/html,<html><body>warmup</body></html>"))

	slog.Info("Chrome pool warmup completed")
}

// GetContext returns a new Chrome context from the pool
// The returned context should be used for a single operation and then cancelled
func (p *ChromePool) GetContext(timeout time.Duration) (context.Context, context.CancelFunc, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Initialize on first use
	if !p.initialized {
		if err := p.initialize(); err != nil {
			return nil, nil, fmt.Errorf("initialize chrome pool: %w", err)
		}
	}

	// Create new context from the persistent allocator
	ctx, cancel := chromedp.NewContext(p.allocCtx)

	// Apply timeout
	ctx, cancel2 := context.WithTimeout(ctx, timeout)

	// Return a combined cancel function that cancels both contexts
	combinedCancel := func() {
		cancel2()
		cancel()
	}

	return ctx, combinedCancel, nil
}

// Shutdown closes the Chrome pool and all associated resources
func (p *ChromePool) Shutdown() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.initialized && p.allocCancel != nil {
		p.allocCancel()
		slog.Info("Chrome pool shut down")
	}
}
