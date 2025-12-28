package handlers

import (
	"net/http"
	"os"

	"github.com/jcom-dev/zmanim/internal/middleware"
)

// RollupHealthCheck returns the health status of the rollup scheduler
//
//	@Summary		Rollup scheduler health check
//	@Description	Returns the health status of the calculation stats rollup scheduler
//	@Tags			System
//	@Produce		json
//	@Success		200	{object}	APIResponse{data=object}	"Rollup scheduler healthy"
//	@Failure		503	{object}	APIResponse{error=APIError}	"Rollup scheduler unhealthy"
//	@Router			/health/rollup [get]
func (h *Handlers) RollupHealthCheck(w http.ResponseWriter, r *http.Request) {
	if h.rollupScheduler == nil {
		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"status":  "disabled",
			"healthy": true,
			"message": "Rollup scheduler not initialized",
		})
		return
	}

	lastRun, running, healthy := h.rollupScheduler.GetStatus()

	status := "ok"
	statusCode := http.StatusOK

	if !healthy {
		status = "unhealthy"
		statusCode = http.StatusServiceUnavailable
	}

	response := map[string]interface{}{
		"status":  status,
		"running": running,
		"healthy": healthy,
	}

	if !lastRun.IsZero() {
		response["last_run"] = lastRun.Format("2006-01-02T15:04:05Z07:00")
	}

	RespondJSON(w, r, statusCode, response)
}

// TriggerRollup manually triggers the rollup scheduler (test endpoint only)
//
//	@Summary		Trigger rollup manually
//	@Description	Manually triggers the calculation stats rollup (test endpoint - requires ENABLE_TEST_ENDPOINTS=true)
//	@Tags			System
//	@Produce		json
//	@Success		200	{object}	APIResponse{data=object}	"Rollup triggered successfully"
//	@Failure		403	{object}	APIResponse{error=APIError}	"Test endpoints disabled"
//	@Failure		503	{object}	APIResponse{error=APIError}	"Rollup scheduler unavailable"
//	@Router			/internal/rollup/trigger [post]
func (h *Handlers) TriggerRollup(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Security gate: Only allow if ENABLE_TEST_ENDPOINTS=true
	if os.Getenv("ENABLE_TEST_ENDPOINTS") != "true" {
		RespondForbidden(w, r, "Test endpoints are disabled")
		return
	}

	if h.rollupScheduler == nil {
		RespondServiceUnavailable(w, r, "Rollup scheduler not initialized")
		return
	}

	// Get request ID for logging correlation
	requestID := middleware.GetRequestID(ctx)

	err := h.rollupScheduler.TriggerImmediate(ctx)
	if err != nil {
		RespondInternalError(w, r, "Failed to execute rollup")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":     "triggered",
		"request_id": requestID,
		"message":    "Rollup executed successfully",
	})
}
