# Shtetl Zmanim - E2E Testing Setup Guide

This guide explains how to redeploy your Coder workspace with local PostgreSQL and Redis for E2E testing.

## Overview

**What Changed:**
- ✅ Added PostgreSQL 16 container for E2E test database
- ✅ Added Redis 7 container for E2E test cache
- ✅ Integrated MailSlurp email testing
- ✅ Support for Clerk TEST instance
- ✅ Updated docker-compose.yml with test services

## Prerequisites

### 1. Create a Clerk Test Instance

1. Go to https://dashboard.clerk.com
2. Create a **new application** (separate from production)
3. Name it "Shtetl Zmanim Test" or similar
4. Copy the API keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_test_...`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_...`)

### 2. Get MailSlurp API Key

1. Sign up at https://app.mailslurp.com
2. Get your API key from the dashboard
3. Free tier includes 100 emails/month

## Deployment Steps

### Step 1: Create Environment Files

The project uses separate `.env.*` files in the project root for each service:

1. **Create `.env.clerk`** (required):
   ```bash
   cp .env.clerk.example .env.clerk
   ```

   Edit and add your keys:
   ```bash
   # Production Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   CLERK_JWKS_URL=https://your-app.clerk.accounts.dev/.well-known/jwks.json
   CLERK_ISSUER=https://your-app.clerk.accounts.dev

   # Test Clerk Instance (NEW - for E2E tests)
   CLERK_TEST_PUBLISHABLE_KEY=pk_test_...
   CLERK_TEST_SECRET_KEY=sk_test_...
   ```

2. **Create `.env.mailslurp`** (required):
   ```bash
   cp .env.mailslurp.example .env.mailslurp
   ```

   Edit and add your key:
   ```bash
   MAILSLURP_API_KEY=sk_...
   ```

3. **Verify existing files** (should already exist):
   - `.env.resend` - Email service
   - `.env.upstash` - Optional (using local Redis now)

### Step 2: Push Updated Template to Coder

1. Navigate to `.coder/` directory:
   ```bash
   cd .coder/
   ```

2. Run the push script:
   ```bash
   ./push-template.sh
   ```

   This will:
   - Validate the Terraform configuration
   - Push the updated template to your Coder instance
   - Create PostgreSQL and Redis containers

### Step 3: Rebuild Your Workspace

1. Stop your current workspace in Coder UI
2. Start it again - it will now include:
   - PostgreSQL on `localhost:5433`
   - Redis on `localhost:6380`
   - All test environment variables

### Step 4: Configure Test Environment

1. Navigate to the tests directory:
   ```bash
   cd tests/
   ```

2. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and fill in:
   ```bash
   # Clerk TEST keys (from Step 1)
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

   # MailSlurp (from Step 2)
   MAILSLURP_API_KEY=sk_...

   # Database (auto-configured by Coder)
   TEST_DATABASE_URL=postgresql://zmanim_test:test_password@localhost:5433/zmanim_test
   DATABASE_URL=postgresql://zmanim_test:test_password@localhost:5433/zmanim_test

   # Application URL
   BASE_URL=http://localhost:3001
   ```

### Step 5: Initialize Test Database

1. Run database migrations:
   ```bash
   # From the API directory
   cd /home/coder/workspace/zmanim/api

   # Run migrations against test database
   TEST_DATABASE_URL=postgresql://zmanim_test:test_password@localhost:5433/zmanim_test \
     go run cmd/migrate/main.go
   ```

### Step 6: Run Tests

1. Navigate to tests directory:
   ```bash
   cd /home/coder/workspace/zmanim/tests
   ```

2. Run the full E2E test suite:
   ```bash
   npm run test:suite
   ```

3. Run specific test suites:
   ```bash
   npm run test:admin       # Admin flow tests
   npm run test:publisher   # Publisher flow tests
   npm run test:user        # User flow tests
   npm run test:email       # Email flow tests
   ```

## Environment Variables Reference

### Production vs Test

| Service | Production | Test (E2E) |
|---------|-----------|------------|
| **Database** | Xata (external) | PostgreSQL `localhost:5433` |
| **Cache** | Upstash Redis (external) | Redis `localhost:6380` |
| **Clerk** | Live instance (`pk_live_...`) | Test instance (`pk_test_...`) |
| **Email** | Resend (production) | MailSlurp (testing) |

### Coder Workspace Environment

These are automatically set by the Terraform configuration:

```bash
# Test Database
TEST_DATABASE_URL=postgresql://zmanim_test:test_password@localhost:5433/zmanim_test
TEST_POSTGRES_HOST=localhost
TEST_POSTGRES_PORT=5433
TEST_POSTGRES_DB=zmanim_test
TEST_POSTGRES_USER=zmanim_test
TEST_POSTGRES_PASSWORD=test_password_<workspace-id>

# Test Cache
TEST_REDIS_URL=redis://localhost:6380
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6380

# Test Authentication
CLERK_TEST_SECRET_KEY=<from terraform.tfvars>
CLERK_TEST_PUBLISHABLE_KEY=<from terraform.tfvars>

# Test Email
MAILSLURP_API_KEY=<from terraform.tfvars>
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs coder-<workspace-id>-postgres

# Connect to test database
psql postgresql://zmanim_test:test_password@localhost:5433/zmanim_test
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
redis-cli -p 6380 ping
```

### Test Failures

1. **Clerk timeout errors**: Ensure you're using a TEST Clerk instance (`sk_test_...`)
2. **Database errors**: Run migrations on test database
3. **Email errors**: Verify MailSlurp API key is valid

## Docker Compose Alternative

If not using Coder, you can run services via Docker Compose:

```bash
# Start test services only
docker-compose up postgres-test redis-test -d

# Start all services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f postgres-test
docker-compose logs -f redis-test
```

## Cleanup

### Clean Up Test Data

```bash
cd tests/
npx tsx cleanup-clerk-users.ts
```

### Reset Test Database

```bash
# Drop and recreate database
psql postgresql://zmanim_test:test_password@localhost:5433/postgres -c "DROP DATABASE IF EXISTS zmanim_test;"
psql postgresql://zmanim_test:test_password@localhost:5433/postgres -c "CREATE DATABASE zmanim_test;"

# Run migrations again
cd api/
TEST_DATABASE_URL=postgresql://zmanim_test:test_password@localhost:5433/zmanim_test \
  go run cmd/migrate/main.go
```

## Next Steps

1. ✅ Update terraform.tfvars with test credentials
2. ✅ Push template to Coder
3. ✅ Rebuild workspace
4. ✅ Configure test .env file
5. ✅ Initialize test database
6. ✅ Run E2E tests
7. 🎉 Celebrate working tests!

## Support

- **Coder Issues**: Check `.coder/README.md`
- **Test Issues**: Check `tests/TESTING.md`
- **Clerk Setup**: https://clerk.com/docs
- **MailSlurp Docs**: https://docs.mailslurp.com
