# Shtetl Zmanim Backend (Go)

Go backend API for the Shtetl Zmanim multi-publisher platform.

## Structure

```
backend/
├── cmd/
│   └── api/
│       └── main.go           # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go         # Configuration management
│   ├── db/
│   │   └── postgres.go       # Database connection
│   ├── handlers/
│   │   └── handlers.go       # HTTP handlers
│   ├── middleware/
│   │   └── middleware.go     # HTTP middleware
│   ├── models/
│   │   └── models.go         # Data models
│   └── services/
│       ├── publisher_service.go  # Publisher business logic
│       └── zmanim_service.go     # Zmanim calculation logic
├── .dockerignore
├── .env.example
├── Dockerfile
├── go.mod
└── go.sum
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
PORT=8080
ENVIRONMENT=development

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/zmanim

# JWT Configuration
JWT_SECRET=your-jwt-secret

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com

# Rate Limiting
RATE_LIMIT_REQUESTS=60
RATE_LIMIT_DURATION=1m
```

## Development

### Prerequisites

- Go 1.21 or higher
- PostgreSQL

### Running Locally

```bash
# Install dependencies
go mod download

# Run the server
go run cmd/api/main.go
```

The server will start on `http://localhost:8080`.

### Building

```bash
# Build the binary
go build -o main cmd/api/main.go

# Run the binary
./main
```

## API Endpoints

### Health Check
- `GET /health` - Check API and database health

### Publishers
- `GET /api/v1/publishers` - List all publishers
  - Query params: `page`, `page_size`, `region_id`
- `GET /api/v1/publishers/{id}` - Get publisher by ID

### Locations
- `GET /api/v1/locations` - List predefined locations

### Zmanim Calculations
- `POST /api/v1/zmanim` - Calculate zmanim
  - Body: `{ "date": "2024-01-01", "latitude": 31.7683, "longitude": 35.2137, "timezone": "Asia/Jerusalem", "publisher_id": "uuid" }`

## Docker

### Build Image

```bash
docker build -t zmanim-backend .
```

### Run Container

```bash
docker run -p 8080:8080 --env-file .env zmanim-backend
```

## Deployment

The backend is deployed to Fly.io with **automatic deployment enabled**.

### Automatic Deployment
- **Enabled**: GitHub integration with auto-deploy is active
- **Trigger**: Pushes to the main branch automatically trigger deployments
- **Configuration**: See root [`fly.toml`](../fly.toml) for deployment settings

### Manual Deployment
If needed, you can also manually deploy:

```bash
# Deploy to Fly.io manually
fly deploy
```

### Monitoring Deployments
```bash
# Check deployment status
fly status --app zmanim

# View logs
fly logs --app zmanim
```

## Testing

```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...
```

## API Testing with Authentication

The API uses Clerk for authentication. Most endpoints require a valid JWT token.

### Getting a Test Token

Use the provided script to get a JWT token for API testing:

```bash
# Load env and run script (uses ADMIN_EMAIL from .env by default)
source api/.env && node scripts/get-test-token.js

# Or specify a specific user email
source api/.env && node scripts/get-test-token.js user@example.com
```

**Priority order for user selection:**
1. CLI argument (if provided)
2. `ADMIN_EMAIL` from `.env` (recommended: set this to your admin account)
3. Auto-select (finds first admin with active session)

**Requirements:**
- `CLERK_SECRET_KEY` must be set in `.env`
- The target user must have an active session (be logged into the web app)
- If no active session exists, the script creates a sign-in link

### Making Authenticated Requests

**Public endpoints** (no auth required):
```bash
curl -s http://localhost:8080/api/v1/publishers | jq '.'
```

**Admin endpoints** (requires admin user token):
```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8080/api/v1/admin/stats | jq '.'
```

**Publisher endpoints** (requires token + X-Publisher-Id header):
```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  -H "X-Publisher-Id: 2" \
  "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-20" | jq '.'
```

### Shell Limitations

**Important:** Command substitution (`$()`) does not work in some shell environments (exits with code 2). Always paste the token directly into curl commands rather than using variables:

```bash
# CORRECT - paste token directly
curl -s -H "Authorization: Bearer eyJhbG..." http://localhost:8080/api/v1/admin/stats

# WRONG - variable substitution may fail
TOKEN=$(node scripts/get-test-token.js)  # Exit code 2 in some shells
curl -s -H "Authorization: Bearer $TOKEN" ...
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `CLERK_SECRET_KEY required` | Run `source api/.env` before the script |
| `No active session` | Log into the web app at http://localhost:3001 first |
| Token expired | Tokens last 30 minutes; re-run the script |
| `UNAUTHORIZED` response | Verify token is correct and not expired |

## License

MIT
