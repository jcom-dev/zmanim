# Shtetl Zmanim Test Scripts

## Local Development

- **Frontend:** http://localhost:3001
- **API:** http://localhost:8080

### Starting/Restarting Services

Use the `restart.sh` script in the project root to start or restart all services:

```bash
# From project root
./restart.sh
```

This script:
1. Stops any running tmux session named 'zmanim'
2. Kills any processes on ports 8080 (API) and 3001 (web)
3. Starts the Go API server and Next.js dev server in a tmux session
4. Verifies both services are healthy

**Viewing logs:**
```bash
tmux attach -t zmanim     # Attach to session
# Ctrl+B then 0           # Switch to API logs
# Ctrl+B then 1           # Switch to Web logs
# Ctrl+B then D           # Detach from session
```

---

## Running CI Locally

Before pushing to GitHub, run these scripts to catch issues early:

### Quick Pre-commit Checks

Fast validation before committing (target: under 30 seconds):

```bash
./scripts/pre-commit-check.sh
```

**What it checks:**
- Go formatting (gofmt)
- ESLint (frontend linting)
- TypeScript type checking
- Go vet (static analysis)

**Use this:**
- Before every commit
- As part of your git pre-commit hook
- When you want quick feedback

### Full CI Pipeline

Complete mirror of GitHub Actions CI pipeline:

```bash
# Run all checks (including E2E tests)
./scripts/test-local.sh

# Skip E2E tests (faster, ~2-5 minutes)
./scripts/test-local.sh --skip-e2e

# Verbose output (see all command output)
./scripts/test-local.sh --verbose

# Help
./scripts/test-local.sh --help
```

**What it runs:**

| Step | Check | Mirrors CI |
|------|-------|------------|
| 0 | Tool version checks | ✓ |
| 1 | Backend linting (golangci-lint) | `pr-checks.yml` |
| 2 | Frontend linting (ESLint) | `pr-checks.yml` |
| 3 | Frontend type checking | `pr-checks.yml` |
| 4 | Backend build | `pr-checks.yml` |
| 5 | Backend tests with coverage | `pr-checks.yml` |
| 6 | Go vet | `pr-checks.yml` |
| 7 | Frontend build (Next.js) | `pr-checks.yml` |
| 7.5 | Frontend unit tests (Vitest) | `pr-checks.yml` |
| 8 | E2E tests (Playwright) | `pr-e2e.yml` |

**Use this:**
- Before pushing to `dev` branch
- After making significant changes
- When you want to be confident CI will pass

**Requirements:**
- Go 1.24+
- Node.js 20+
- golangci-lint (optional but recommended)
- For E2E: Services running via `./restart.sh`

**Example workflow:**
```bash
# 1. Make changes
# ...

# 2. Quick check before committing
./scripts/pre-commit-check.sh

# 3. Commit your changes
git add .
git commit -m "feat: my awesome feature"

# 4. Full check before pushing
./scripts/test-local.sh --skip-e2e

# 5. Push to GitHub
git push origin dev
```

**Known Issues:**

- **ESLint 9.x Flat Config:** The web project uses ESLint 9.x with legacy `.eslintrc.json` configuration, which may cause warnings or errors. ESLint 9.x expects `eslint.config.mjs` flat config format. This is a known issue that should be fixed in a separate story. The scripts will correctly detect lint failures.

- **golangci-lint:** If not installed, backend linting will be skipped. Install with `brew install golangci-lint` or see https://golangci-lint.run/usage/install/

---

## Authentication Testing

These scripts help debug and test API authentication issues.

### Quick Start

```bash
# 1. Start/restart local services
./restart.sh

# 2. Get a test token from Clerk
source api/.env && node scripts/get-test-token.js

# 3. Test the API with the token
node scripts/test-auth.js "<token>" "http://localhost:8080"
```

### Scripts

#### `get-test-token.js`

Retrieves a valid JWT token from Clerk for testing.

**Requirements:**
- `CLERK_SECRET_KEY` environment variable (from `api/.env`)

**What it does:**
1. Lists all users in Clerk with their roles
2. Finds a user with `publisher` or `admin` role
3. Gets their active session token
4. Outputs the JWT for use with `test-auth.js`

**Usage:**
```bash
source api/.env && node scripts/get-test-token.js
```

**Output:**
```
Available users:
================
  user@example.com [admin] publishers: abc-123
  ...

Found user with admin role: user@example.com
JWT TOKEN (use this for API testing):
========================================
eyJhbGciOiJSUzI1NiIs...
```

---

#### `test-auth.js`

Tests API endpoints with a JWT token.

**Usage:**
```bash
node scripts/test-auth.js <token> [api_base]

# Example:
node scripts/test-auth.js "eyJhbG..." "http://localhost:8080"
```

**What it tests:**

| Section | Endpoints | Expected |
|---------|-----------|----------|
| Health Check | `GET /health` | 200 (no auth needed) |
| Public | `GET /api/v1/publishers` | 200 |
| Publisher | `GET /api/v1/publisher/accessible` | 200 with valid token, 401 without |
| Publisher | `GET /api/v1/publisher/algorithm/templates` | 200 with valid token |
| Admin | `GET /api/v1/admin/stats` | 200 with admin role |

**JWT Inspection:**
The script also decodes and displays:
- Token claims (role, publisher_access_list, etc.)
- Token expiration time
- User ID

---

#### `test-auth.sh`

Bash version of `test-auth.js` (same functionality, uses `curl`).

```bash
./scripts/test-auth.sh "<token>" "http://localhost:8080"
```

---

### Common Issues

#### 401 Unauthorized

**Symptoms:**
```
GET /api/v1/publisher/algorithm 401 (Unauthorized)
Response: {"error":{"code":"UNAUTHORIZED","message":"Invalid or missing authentication token"}}
```

**Causes:**
1. **Token is null/undefined** - Frontend sending `Authorization: Bearer null`
2. **Token expired** - Check `exp` claim in JWT
3. **Missing role** - User needs `publisher` or `admin` role in Clerk metadata

**Debugging:**
```bash
# Get a fresh token
source api/.env && node scripts/get-test-token.js

# Test with the token
node scripts/test-auth.js "<token>" "http://localhost:8080"

# Check token claims - look for:
# - "role": "publisher" or "admin"
# - Token expiration time
```

#### 403 Forbidden

**Symptoms:**
```
Status: 403 FORBIDDEN
```

**Cause:** User has valid auth but wrong role (e.g., trying admin endpoint with publisher role)

---

### Frontend Authentication Pattern

The frontend uses `useAuthenticatedFetch` hook to prevent 401 errors:

```typescript
// Correct pattern - uses centralized hook
import { useAuthenticatedFetch, ApiError } from '@/lib/hooks/useAuthenticatedFetch';

function MyComponent() {
  const { fetchWithAuth } = useAuthenticatedFetch();

  const loadData = async () => {
    try {
      const data = await fetchWithAuth<MyType>('/api/v1/endpoint');
      // Handle success
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Handle auth error
      }
    }
  };
}
```

The hook:
1. Gets token from Clerk via `useAuth().getToken()`
2. **Throws error if token is null** (prevents `Bearer null`)
3. Automatically adds `X-Publisher-Id` header
4. Returns typed response data

See `web/lib/hooks/useAuthenticatedFetch.ts` for implementation.
