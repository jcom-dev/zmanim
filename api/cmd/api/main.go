// Shtetl Zmanim API
//
// Production-grade API for Halachic Authorities to publish zmanim with complete autonomy
// and transparency. Provides endpoints for authorities to manage their calculation
// formulas, coverage areas, and integrations.
//
//	@title			Shtetl Zmanim API
//	@version		1.0
//	@description	API for Halachic Authorities to publish zmanim with complete autonomy and transparency
//	@termsOfService	https://zmanim.com/terms
//
//	@contact.name	Shtetl Zmanim Support
//	@contact.email	support@zmanim.com
//
//	@license.name	MIT
//	@license.url	https://opensource.org/licenses/MIT
//
//	@host			localhost:8080
//	@BasePath		/api/v1
//
//	@securityDefinitions.apikey	BearerAuth
//	@in							header
//	@name						Authorization
//	@description				JWT Bearer token from Clerk authentication
//
//	@tag.name			Publishers
//	@tag.description	Publisher profile and management endpoints
//
//	@tag.name			Zmanim
//	@tag.description	Zmanim calculation and retrieval endpoints
//
//	@tag.name			Coverage
//	@tag.description	Geographic coverage area management
//
//	@tag.name			Algorithm
//	@tag.description	Algorithm configuration and versioning
//
//	@tag.name			Cities
//	@tag.description	City search and location endpoints
//
//	@tag.name			DSL
//	@tag.description	Domain-specific language for zmanim formulas
//
//	@tag.name			Admin
//	@tag.description	Administrative endpoints (requires admin role)

package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jcom-dev/zmanim/internal/ai"
	"github.com/jcom-dev/zmanim/internal/cache"
	"github.com/jcom-dev/zmanim/internal/config"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/handlers"
	custommw "github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/services"
	"github.com/redis/go-redis/v9"
	httpSwagger "github.com/swaggo/http-swagger/v2"

	_ "github.com/jcom-dev/zmanim/docs" // Swagger generated docs
)

// rateLimiterAdapter adapts services.RateLimiter to middleware.RateLimiterService
// This bridges the type gap between packages to avoid import cycles
type rateLimiterAdapter struct {
	service *services.RateLimiter
}

func (a *rateLimiterAdapter) Check(ctx context.Context, clientID string) (*custommw.RateLimitResult, error) {
	result, err := a.service.Check(ctx, clientID)
	if err != nil {
		return nil, err
	}

	// Convert services.RateLimitResult to middleware.RateLimitResult
	return &custommw.RateLimitResult{
		Allowed:         result.Allowed,
		MinuteRemaining: result.MinuteRemaining,
		HourRemaining:   result.HourRemaining,
		MinuteReset:     result.MinuteReset,
		HourReset:       result.HourReset,
		RetryAfter:      result.RetryAfter,
	}, nil
}

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database connection
	database, err := db.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	log.Println("Database connection established")

	// Initialize handlers
	h := handlers.New(database)

	// Initialize calculation logging service
	calculationLogService := services.NewCalculationLogService(database.Pool)
	h.SetCalculationLogService(calculationLogService)
	defer calculationLogService.Close()

	// Initialize Redis cache (optional - only if REDIS_URL is set)
	redisCache, err := cache.New()
	if err != nil {
		log.Printf("Warning: Redis cache initialization failed: %v - caching disabled", err)
	} else {
		h.SetCache(redisCache)
		defer redisCache.Close()
	}

	// Initialize unified zmanim service (calculation, ordering, linking, filtering)
	ctx := context.Background()
	unifiedZmanimService, err := services.NewUnifiedZmanimService(ctx, database, redisCache)
	if err != nil {
		log.Fatalf("Failed to initialize unified zmanim service: %v", err)
	}
	h.SetUnifiedZmanimService(unifiedZmanimService)
	log.Println("Unified zmanim service initialized")

	// Initialize AI services (optional - only if API keys are set)
	var claudeService *ai.ClaudeService
	var searchService *ai.SearchService
	var contextService *ai.ContextService
	var embeddingService *ai.EmbeddingService

	// Claude service for formula generation/explanation
	if apiKey := os.Getenv("ANTHROPIC_API_KEY"); apiKey != "" {
		claudeService = ai.NewClaudeService(apiKey)
		log.Println("Claude AI service initialized")
	} else {
		log.Println("Warning: ANTHROPIC_API_KEY not set - AI generation features will be disabled")
	}

	// OpenAI embeddings and RAG services
	if apiKey := os.Getenv("OPENAI_API_KEY"); apiKey != "" {
		embeddingService = ai.NewEmbeddingService(apiKey)
		searchService = ai.NewSearchService(database.Pool, embeddingService)
		contextService = ai.NewContextService(searchService)
		log.Println("OpenAI embedding and RAG services initialized")
	} else {
		log.Println("Warning: OPENAI_API_KEY not set - RAG search features will be disabled")
	}

	h.SetAIServices(claudeService, searchService, contextService, embeddingService)

	// Initialize PDF report service (Story 11.6)
	// Use public token for Static Images API (not the secret key)
	mapboxAPIKey := os.Getenv("MAPBOX_PUBLIC_TOKEN")
	if mapboxAPIKey == "" {
		log.Println("Warning: MAPBOX_PUBLIC_TOKEN not set - static maps in PDF reports will be disabled")
	}
	var redisClient *redis.Client
	if redisCache != nil {
		redisClient = redisCache.Client()
	}
	pdfReportService := services.NewPDFReportService(database, unifiedZmanimService, redisClient, mapboxAPIKey)
	publisherReportsHandler := handlers.NewPublisherReportsHandler(pdfReportService, h.GetPublisherResolver())
	log.Println("PDF report service initialized")

	// Setup router
	r := chi.NewRouter()

	// Apply middleware
	r.Use(middleware.RequestID)
	r.Use(custommw.RealIP)
	r.Use(custommw.OriginVerify)           // Verify requests come through API Gateway (blocks direct EC2 access)
	r.Use(custommw.LogFailedRequestBodies) // Log request bodies for failed requests (debug)
	r.Use(custommw.Logger)
	r.Use(custommw.Recoverer)
	r.Use(custommw.Timeout(30 * time.Second))
	r.Use(custommw.SecurityHeaders)

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Publisher-Id"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check endpoint
	r.Get("/health", h.HealthCheck)

	// Static file server for uploads (logos, etc.)
	uploadsDir := http.Dir("./uploads")
	fileServer := http.FileServer(uploadsDir)
	r.Handle("/uploads/*", http.StripPrefix("/uploads", fileServer))

	// Swagger documentation UI
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"), // URL pointing to API definition
		httpSwagger.DocExpansion("list"),
		httpSwagger.DomID("swagger-ui"),
	))

	// OpenAPI specification endpoints
	r.Get("/openapi.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		http.ServeFile(w, r, "./docs/swagger.json")
	})
	r.Get("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-yaml")
		http.ServeFile(w, r, "./docs/swagger.yaml")
	})

	// Initialize auth middleware
	authMiddleware := custommw.NewAuthMiddleware(cfg.JWT.JWKSUrl, cfg.JWT.Issuer)

	// Initialize rate limiter
	rateLimiter := custommw.NewDefaultRateLimiter()
	defer rateLimiter.Stop()

	// Initialize M2M auth middleware for external API
	m2mAuth := custommw.NewM2MAuthMiddleware(cfg.JWT.JWKSUrl, cfg.JWT.Issuer)

	// Initialize Redis-backed rate limiter for external API (Story 8.7)
	var externalRateLimiter *custommw.ExternalRateLimiter
	if redisCache != nil {
		rateLimiterService := services.NewRateLimiter(redisCache.Client())
		adapter := &rateLimiterAdapter{service: rateLimiterService}
		externalRateLimiter = custommw.NewExternalRateLimiter(adapter)
		log.Println("External API rate limiter initialized (Redis-backed)")
	} else {
		log.Println("Warning: External API rate limiter disabled - Redis not available")
	}

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(custommw.ContentType("application/json"))

		// Public routes (with optional auth for rate limiting)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.OptionalAuth)
			r.Use(rateLimiter.Middleware)

			// Publishers
			r.Get("/publishers", h.GetPublishers)
			r.Get("/publishers/{id}", h.GetPublisher)
			r.Get("/publishers/names", h.GetPublisherNames)

			// Publisher registration requests (public) - Legacy
			r.Post("/publisher-requests", h.SubmitPublisherRequest)

			// Publisher registration (Story 8.37 - Unified Onboarding Flow)
			r.Post("/publishers/check-duplicate", h.CheckPublisherDuplicate)
			r.Post("/publishers/register", h.StartPublisherRegistration)
			r.Get("/publishers/register/verify/{token}", h.VerifyRegistrationToken)
			r.Post("/publishers/register/confirm/{token}", h.ConfirmExistingUserRegistration)

			// Localities - geo_localities endpoints (Story 10.4)
			r.Get("/localities", h.ListLocalities)
			r.Get("/localities/search", h.SearchLocalities)
			r.Get("/localities/browse", h.BrowseHierarchy)
			r.Get("/localities/{id}", h.GetLocality)
			r.Get("/localities/nearby", h.GetNearbyLocalities)
			r.Get("/localities/{localityId}/publishers", h.GetPublishersForLocality)

			// Geographic hierarchy for coverage selection
			r.Get("/continents", h.GetContinents)
			r.Get("/countries", h.GetCountries)
			r.Get("/countries/{country_code}/regions", h.GetRegionsByCountry)
			r.Get("/countries/{country_code}", h.GetCountryByCode) // Must be after /regions
			r.Get("/regions", h.GetRegions)

			// Geographic boundaries for map rendering
			r.Get("/geo/boundaries/countries", h.GetCountryBoundaries)
			r.Get("/geo/boundaries/regions", h.GetRegionBoundaries)
			r.Get("/geo/boundaries/lookup", h.LookupPointLocation)
			r.Get("/geo/boundaries/at-point", h.SmartLookupPointLocation) // Zoom-aware smart lookup
			r.Get("/geo/boundaries/stats", h.GetBoundaryStats)
			r.Get("/geo/feature/{type}/{id}", h.GetFeatureGeometry) // Single feature geometry for map preview

			// Zmanim calculations
			r.Get("/zmanim", h.GetZmanimForLocality)
			r.Post("/zmanim", h.CalculateZmanim)

			// DSL endpoints (Epic 4)
			r.Post("/dsl/validate", h.ValidateDSLFormula)        // Validate DSL formula
			r.Post("/dsl/preview", h.PreviewDSLFormula)          // Preview/calculate DSL formula
			r.Post("/dsl/preview-week", h.PreviewDSLFormulaWeek) // Weekly preview (Story 4-10)

			// AI endpoints (Story 4-7, 4-8)
			r.Post("/ai/search", h.SearchAI)
			r.Post("/ai/context", h.GetAIContext)
			r.Post("/ai/generate-formula", h.GenerateFormula)
			r.Post("/ai/explain-formula", h.ExplainFormula)

			// Hebrew calendar endpoints (Story 4-10)
			r.Get("/calendar/week", h.GetWeekCalendar)
			r.Get("/calendar/hebrew-date", h.GetHebrewDate)
			r.Get("/calendar/gregorian-date", h.GetGregorianDate)
			r.Get("/calendar/shabbat", h.GetShabbatTimes)

			// Public algorithm browsing (Story 4-12)
			r.Get("/algorithms/public", h.BrowsePublicAlgorithms)
			r.Get("/algorithms/{id}/public", h.GetPublicAlgorithm)

			// Public zmanim browsing
			r.Get("/zmanim/browse", h.BrowsePublicZmanim)

			// Master Zmanim Registry (public)
			r.Get("/registry/zmanim", h.GetMasterZmanim)
			r.Get("/registry/zmanim/grouped", h.GetMasterZmanimGrouped)
			r.Get("/registry/zmanim/events", h.GetEventZmanimGrouped)
			r.Get("/registry/zmanim/validate-key", h.ValidateZmanKey)
			r.Get("/registry/zmanim/{zmanKey}", h.GetMasterZman)
			r.Get("/registry/tags", h.GetAllTags)

			// Astronomical Primitives (scientific times for formulas)
			r.Get("/registry/primitives", h.GetAstronomicalPrimitives)
			r.Get("/registry/primitives/grouped", h.GetAstronomicalPrimitivesGrouped)
			r.Get("/registry/primitives/preview", h.GetAstronomicalPrimitivesPreview)

			// Categories (public, for UI rendering)
			r.Get("/categories/time", h.GetTimeCategories)
			r.Get("/categories/events", h.GetEventCategories)
			r.Get("/categories/display-groups", h.GetDisplayGroups)
			r.Get("/tag-types", h.GetTagTypes)
		})

		// Authenticated routes for algorithm actions (Story 4-12)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireRole("publisher"))
			r.Post("/algorithms/{id}/copy", h.CopyAlgorithm)
			r.Post("/algorithms/{id}/fork", h.ForkAlgorithm)
		})

		// Verified publishers for linking (requires publisher auth)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireRole("publisher"))
			r.Get("/publishers/verified", h.GetVerifiedPublishers)
			r.Get("/publishers/{publisherId}/zmanim", h.GetPublisherZmanimForLinking)
		})

		// Unified auth routes (Story 9.3: role-based endpoint consolidation)
		r.Route("/auth", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)

			// Unified correction request endpoints (Story 9.3)
			r.Get("/correction-requests", h.GetCorrectionRequests)                           // Role-filtered list
			r.Put("/correction-requests/{id}/status", h.UpdateCorrectionRequestStatus)       // Admin only
			r.Get("/correction-requests/history", h.GetCorrectionRequestHistory)             // Admin only - correction history
			r.Post("/correction-requests/{id}/revert", h.RevertCorrectionRequest)            // Admin only - revert approved correction
			r.Get("/correction-requests/check-duplicates", h.CheckCorrectionDuplicates)      // Check for duplicate requests
		})

		// Publisher protected routes
		r.Route("/publisher", func(r chi.Router) {
			r.Use(authMiddleware.RequireRole("publisher"))
			r.Get("/accessible", h.GetAccessiblePublishers)
			r.Post("/select", h.SelectPublisher)
			r.Get("/dashboard", h.GetPublisherDashboardSummary)
			r.Get("/analytics", h.GetPublisherAnalytics)
			r.Get("/activity", h.GetPublisherActivity)
			r.Get("/profile", h.GetPublisherProfile)
			r.Put("/profile", h.UpdatePublisherProfile)
			r.Post("/logo", h.UploadPublisherLogo)
			// Calculation settings
			r.Get("/settings/calculation", h.GetPublisherCalculationSettings)
			r.Put("/settings/calculation", h.UpdatePublisherCalculationSettings)
			r.Put("/settings/global-coverage", h.UpdateGlobalCoverage)
			r.Get("/algorithm", h.GetPublisherAlgorithmHandler)
			r.Put("/algorithm", h.UpdatePublisherAlgorithmHandler)
			r.Post("/algorithm/preview", h.PreviewAlgorithm)
			r.Get("/algorithm/methods", h.GetZmanMethods)
			// Publisher zmanim management (Story 4-4)
			r.Get("/zmanim", h.GetPublisherZmanim)
			r.Get("/zmanim/week", h.GetPublisherZmanimWeek)      // Batch week preview with caching
			r.Get("/zmanim/year", h.GetPublisherZmanimYear)      // Full Hebrew year export for comparison
			r.Post("/zmanim", h.CreatePublisherZmanFromRegistry) // Updated: create from registry
			r.Post("/zmanim/import", h.ImportZmanim)
			r.Post("/zmanim/from-publisher", h.CreateZmanFromPublisher) // Copy or link from another publisher
			r.Get("/zmanim/{zmanKey}", h.GetPublisherZman)
			r.Put("/zmanim/{zmanKey}", h.UpdatePublisherZman)
			r.Delete("/zmanim/{zmanKey}", h.SoftDeletePublisherZman) // Updated: soft delete
			// Soft delete & restore
			r.Get("/zmanim/deleted", h.GetDeletedZmanim)
			r.Post("/zmanim/{zmanKey}/restore", h.RestorePublisherZman)
			r.Delete("/zmanim/{zmanKey}/permanent", h.PermanentDeletePublisherZman)
			// Per-zman version history
			r.Get("/zmanim/{zmanKey}/history", h.GetZmanVersionHistory)
			r.Get("/zmanim/{zmanKey}/history/{version}", h.GetZmanVersionDetail)
			r.Post("/zmanim/{zmanKey}/rollback", h.RollbackZmanVersion)
			// Zman aliases (Story 5.4)
			r.Get("/zmanim/aliases", h.ListAliases)
			r.Get("/zmanim/{zmanKey}/alias", h.GetAlias)
			r.Put("/zmanim/{zmanKey}/alias", h.CreateOrUpdateAlias)
			r.Delete("/zmanim/{zmanKey}/alias", h.DeleteAlias)
			// Publisher zman tags (publisher-specific tag overrides)
			r.Get("/zmanim/{zmanKey}/tags", h.GetPublisherZmanTags)
			r.Put("/zmanim/{zmanKey}/tags", h.UpdatePublisherZmanTags)
			r.Post("/zmanim/{zmanKey}/tags/revert", h.RevertPublisherZmanTags)
			r.Post("/zmanim/{zmanKey}/tags/{tagId}", h.AddTagToPublisherZman)
			r.Delete("/zmanim/{zmanKey}/tags/{tagId}", h.RemoveTagFromPublisherZman)
			// Zman registry requests (Story 5.6)
			r.Get("/zman-requests", h.GetPublisherZmanRequests)
			r.Post("/zman-requests", h.CreateZmanRegistryRequest)
			// Registry browser (Story 11.1)
			r.Get("/registry/master", h.ListMasterZmanimForRegistry)
			r.Get("/registry/filters", h.GetRegistryFilters)
			// Master zman documentation (Story 11.2)
			r.Get("/registry/master/{id}/documentation", h.GetMasterZmanDocumentation)
			// Publisher examples browser (Story 11.3)
			r.Get("/registry/publishers", h.ListValidatedPublishers)
			r.Get("/registry/publishers/{publisher_id}/zmanim", h.GetPublisherZmanimForExamples)
			r.Get("/registry/coverage/{publisher_id}", h.GetPublisherCoverageLocalities)
			r.Post("/registry/link", h.LinkPublisherZman)
			r.Post("/registry/copy", h.CopyPublisherZman)
			// Publisher zman documentation (Story 11.4)
			r.Get("/registry/publisher-zman/{id}/documentation", h.GetPublisherZmanDocumentation)
			// Publisher reports (Story 11.6)
			r.Post("/reports/zmanim-pdf", publisherReportsHandler.GenerateZmanimReport)
			r.Post("/calendar/weekly-pdf", publisherReportsHandler.GenerateWeeklyCalendarPDF)
			r.Post("/algorithm/publish", h.PublishAlgorithm)
			r.Get("/algorithm/versions", h.GetAlgorithmVersions)
			r.Get("/algorithm/versions/{id}", h.GetAlgorithmVersion)
			r.Put("/algorithm/versions/{id}/deprecate", h.DeprecateAlgorithmVersion)
			// Algorithm version history (Story 8.1)
			r.Get("/algorithm/history", h.GetVersionHistory)
			r.Get("/algorithm/history/{version}", h.GetVersionDetail)
			r.Get("/algorithm/diff", h.GetVersionDiff)
			r.Post("/algorithm/rollback", h.RollbackVersion)
			r.Post("/algorithm/snapshot", h.CreateVersionSnapshot)
			// Coverage management
			r.Get("/coverage", h.GetPublisherCoverage)
			r.Get("/coverage/localities", h.GetRepresentativeLocalities)
			r.Post("/coverage", h.CreatePublisherCoverage)
			r.Put("/coverage/{id}", h.UpdatePublisherCoverage)
			r.Delete("/coverage/{id}", h.DeletePublisherCoverage)
			// Location overrides (Story 6.4)
			r.Get("/location-overrides", h.GetPublisherLocationOverrides)
			r.Post("/localities/{localityId}/override", h.CreateLocationOverride)
			r.Put("/location-overrides/{id}", h.UpdateLocationOverride)
			r.Delete("/location-overrides/{id}", h.DeleteLocationOverride)
			// Cache management
			r.Delete("/cache", h.InvalidatePublisherCache)
			// Team management (Story 2-10)
			r.Get("/team", h.GetPublisherTeam)
			r.Post("/team/invite", h.InvitePublisherTeamMember)
			r.Delete("/team/{userId}", h.RemovePublisherTeamMember)
			r.Post("/team/invitations/{id}/resend", h.ResendPublisherInvitation)
			r.Delete("/team/invitations/{id}", h.CancelPublisherInvitation)
			r.Post("/team/accept", h.AcceptPublisherInvitation)
			// Onboarding wizard - simplified to zmanim count trigger
			r.Post("/onboarding/complete", h.CompleteOnboarding)
			r.Delete("/onboarding", h.ResetOnboarding)
			// Algorithm collaboration (Story 4-12)
			r.Put("/algorithm/visibility", h.SetAlgorithmVisibility)
			r.Get("/algorithm/forks", h.GetMyForks)
			// Note: Algorithm-wide version history removed (Story 4-13)
			// Version history is now per-zman at /zmanim/{zmanKey}/history

			// Publisher snapshot/version control
			r.Get("/snapshot/export", h.ExportPublisherSnapshot)
			r.Post("/snapshot/import", h.ImportPublisherSnapshot)
			r.Get("/snapshots", h.ListPublisherSnapshots)
			r.Post("/snapshot", h.SavePublisherSnapshot)
			r.Get("/snapshot/{id}", h.GetPublisherSnapshot)
			r.Post("/snapshot/{id}/restore", h.RestorePublisherSnapshot)
			r.Delete("/snapshot/{id}", h.DeletePublisherSnapshot)

			// Complete publisher export (admin/backup - includes profile, logo, coverage, zmanim)
			r.Get("/export/complete", h.ExportCompletePublisher)

			// City correction requests (Story 6.5)
			r.Post("/correction-requests", h.CreateCorrectionRequest)
			r.Get("/correction-requests/{id}", h.GetCorrectionRequestByID)
			r.Put("/correction-requests/{id}", h.UpdateCorrectionRequest)
			r.Delete("/correction-requests/{id}", h.DeleteCorrectionRequest)
			r.Get("/correction-requests/check-duplicates", h.CheckCorrectionDuplicates)
		})

		// User routes (authenticated)
		r.Route("/user", func(r chi.Router) {
			r.Use(authMiddleware.OptionalAuth)
			r.Post("/request-password-reset", h.RequestPasswordReset)
		})

		// Admin protected routes
		r.Route("/admin", func(r chi.Router) {
			r.Use(authMiddleware.RequireRole("admin"))

			// Audit log
			r.Get("/audit-log", h.AdminGetAuditLog)

			// Publisher management
			r.Get("/publishers", h.AdminListPublishers)
			r.Post("/publishers", h.AdminCreatePublisher)
			r.Put("/publishers/{id}", h.AdminUpdatePublisher)
			r.Delete("/publishers/{id}", h.AdminDeletePublisher)
			r.Put("/publishers/{id}/restore", h.AdminRestorePublisher)
			r.Delete("/publishers/{id}/permanent", h.AdminPermanentDeletePublisher)
			r.Put("/publishers/{id}/verify", h.AdminVerifyPublisher)
			r.Put("/publishers/{id}/suspend", h.AdminSuspendPublisher)
			r.Put("/publishers/{id}/reactivate", h.AdminReactivatePublisher)
			r.Put("/publishers/{id}/certified", h.AdminSetPublisherCertified)

			// Publisher user management (Epic 2)
			r.Get("/publishers/{id}/users", h.AdminGetPublisherUsers)
			r.Post("/publishers/{id}/users/invite", h.AdminInviteUserToPublisher)
			r.Delete("/publishers/{id}/users/{userId}", h.AdminRemoveUserFromPublisher)

			// Publisher export/import
			// Import: POST /publishers/{id}/import - imports into existing publisher
			// Import: POST /publishers/{id}/import?create_new=true - creates new publisher from export
			r.Get("/publishers/{id}/export", h.AdminExportPublisher)
			r.Post("/publishers/{id}/import", h.AdminImportPublisher)

			// Publisher registration requests (Story 2-9)
			r.Get("/publisher-requests", h.AdminGetPublisherRequests)
			r.Post("/publisher-requests/{id}/approve", h.AdminApprovePublisherRequest)
			r.Post("/publisher-requests/{id}/reject", h.AdminRejectPublisherRequest)

			// Statistics
			r.Get("/stats", h.AdminGetStats)

			// System configuration
			r.Get("/config", h.AdminGetConfig)
			r.Put("/config", h.AdminUpdateConfig)

			// Cache management
			r.Delete("/cache/zmanim", h.AdminFlushZmanimCache)

			// AI management (Story 4-7, 4-8)
			r.Get("/ai/stats", h.GetAIIndexStats)
			r.Post("/ai/reindex", h.TriggerReindex)
			r.Get("/ai/audit", h.GetAIAuditLogs)

			// Zman registry request management (Story 5.8, 5.19)
			r.Get("/zman-requests", h.AdminGetZmanRegistryRequests)
			r.Get("/zman-requests/{id}", h.AdminGetZmanRegistryRequestByID)
			r.Put("/zman-requests/{id}", h.AdminReviewZmanRegistryRequest)
			r.Get("/zman-requests/{id}/tags", h.AdminGetZmanRequestTags)
			r.Post("/zman-requests/{id}/tags/{tagRequestId}/approve", h.AdminApproveTagRequest)
			r.Post("/zman-requests/{id}/tags/{tagRequestId}/reject", h.AdminRejectTagRequest)

			// Master Zmanim Registry CRUD (admin)
			// Note: GET /registry/zmanim uses the public route (auth-aware)
			r.Get("/registry/zmanim/{id}", h.AdminGetMasterZmanByID)
			r.Post("/registry/zmanim", h.AdminCreateMasterZman)
			r.Put("/registry/zmanim/{id}", h.AdminUpdateMasterZman)
			r.Delete("/registry/zmanim/{id}", h.AdminDeleteMasterZman)
			r.Post("/registry/zmanim/{id}/toggle-visibility", h.AdminToggleZmanVisibility)
			r.Get("/registry/time-categories", h.AdminGetTimeCategories)
			r.Get("/registry/tags", h.AdminGetTags)
			r.Get("/registry/primitives/grouped", h.GetAstronomicalPrimitivesGrouped)

			// Locality correction requests (Story 6.5)
			r.Put("/localities/{localityId}", h.AdminUpdateLocality)
			r.Post("/correction-requests/{id}/revert", h.RevertCorrectionRequest)
			r.Get("/correction-requests/history", h.GetCorrectionRequestHistory)

			// User management (unified admin + publisher roles)
			r.Route("/users", func(r chi.Router) {
				r.Get("/", h.AdminListAllUsers)                                                // List all users with roles
				r.Post("/", h.AdminAddUser)                                                    // Add user (create or update)
				r.Put("/{userId}", h.AdminUpdateUser)                                          // Update user info (name)
				r.Delete("/{userId}", h.AdminDeleteUser)                                       // Delete user completely
				r.Put("/{userId}/admin", h.AdminSetAdminRole)                                  // Toggle admin status
				r.Post("/{userId}/reset-password", h.AdminResetUserPassword)                   // Trigger password reset
				r.Post("/{userId}/publishers", h.AdminAddPublisherToUser)                      // Add publisher access
				r.Delete("/{userId}/publishers/{publisherId}", h.AdminRemovePublisherFromUser) // Remove publisher access
			})
		})

		// External API routes (M2M authentication only)
		r.Route("/external", func(r chi.Router) {
			r.Use(m2mAuth.RequireM2M)
			r.Use(m2mAuth.LoggingMiddleware)

			// Apply Redis-backed rate limiter (Story 8.7)
			// 10 requests/minute, 100 requests/hour per client_id
			if externalRateLimiter != nil {
				r.Use(externalRateLimiter.Middleware)
			}

			// Publisher zmanim list
			r.Get("/publishers/{id}/zmanim", h.GetExternalPublisherZmanim)

			// Bulk zmanim calculation
			r.Post("/zmanim/calculate", h.CalculateExternalBulkZmanim)
		})
	})

	// Create server
	srv := &http.Server{
		Addr:         cfg.Server.Host + ":" + cfg.Server.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Starting server on %s:%s (environment: %s)", cfg.Server.Host, cfg.Server.Port, cfg.Server.Environment)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
