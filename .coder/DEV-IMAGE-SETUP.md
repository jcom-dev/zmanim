# Shtetl Zmanim Development Image Setup

## Overview

To speed up Coder workspace startup, we've created a pre-built Docker image with all dependencies installed. This reduces startup time from ~5-10 minutes to under 30 seconds.

## Architecture

### Before (Slow)
```
Coder starts → Pulls base Ubuntu image → Runs startup.sh →
Installs Go, Node, tools → Clones repo → Installs dependencies →
Installs Playwright → Runs migrations → Starts services
Time: 5-10 minutes
```

### After (Fast)
```
Coder starts → Pulls pre-built image (already has everything) →
Runs startup-fast.sh → Updates repo → Creates .env files →
Runs migrations → Starts services
Time: 20-30 seconds
```

## Components

### 1. Docker Image (`.coder/Dockerfile.dev`)

Pre-installs all dependencies:
- **System packages**: nano, vim, tmux, jq, tree, htop, network tools
- **PostgreSQL 17 client** (from official PGDG repo)
- **Redis client**
- **Go 1.25.4**
- **Node.js 24.x LTS**
- **Go tools**: sqlc
- **Node tools**: Jest (global)
- **CLI tools**: Fly.io CLI, uv (Python), Claude Code
- **Repository**: Cloned at `/home/coder/workspace/zmanim`
- **Dependencies**: Go modules and npm packages pre-installed
- **Playwright**: Chromium browser pre-installed

### 2. GitHub Actions Workflow (`.github/workflows/build-dev-image.yml`)

Automatically builds and pushes the image to Docker Hub:
- **Triggers**:
  - Push to `main` branch
  - Changes to Dockerfile, go.mod, go.sum, package.json, or package-lock.json
  - Manual trigger via workflow_dispatch
- **Image location**: `jcomdev/zmanim:latest`
- **Tags**: `latest`, `sha-{commit}`, and branch name
- **Build cache**: Enabled for faster builds

### 3. Fast Startup Script (`.coder/startup-fast.sh`)

Minimal runtime configuration:
1. Fix workspace ownership
2. Update repository to latest (`git pull`)
3. Update dependencies (if changed)
4. Create `.env` files from Coder variables
5. Configure git user identity
6. Run database migrations
7. Start services in tmux

**Time savings**: ~4-9 minutes faster!

### 4. Coder Template Update (`.coder/zmanim-workspace.tf`)

Updated to use pre-built image:
- **Before**: `codercom/enterprise-base:ubuntu`
- **After**: `jcomdev/zmanim:latest`
- **Pull policy**: Always pull latest image
- **Startup script**: `startup-fast.sh` (instead of `startup.sh`)

## Usage

### Initial Setup

1. **Trigger image build** (one-time):
   - Push changes to `main` branch, OR
   - Go to GitHub Actions → "Build Dev Image" → "Run workflow"

2. **Wait for build** (~10-15 minutes):
   - Check progress: https://github.com/jcom-dev/zmanim/actions
   - Image will be pushed to: https://hub.docker.com/r/jcomdev/zmanim

3. **Update Coder template**:
   ```bash
   cd .coder
   ./push-template.sh
   ```

4. **Create new workspace** or restart existing workspace:
   - New workspaces will use the fast image automatically
   - Existing workspaces need to be rebuilt or recreated

### Maintenance

The image is **automatically rebuilt** when you push changes to:
- `.coder/Dockerfile.dev`
- `api/go.mod` or `api/go.sum`
- `web/package.json` or `web/package-lock.json`

**Manual rebuild**:
```bash
# Trigger via GitHub Actions UI, or push an empty commit
git commit --allow-empty -m "chore: rebuild dev image"
git push
```

### Forcing Image Update in Coder

If a new image is available but Coder is using an old one:

1. **Stop workspace** (via Coder UI)
2. **Rebuild workspace** (via Coder UI)
3. Coder will pull the latest image

The template is configured with `pull_triggers = ["always"]` to ensure fresh images.

## File Reference

```
.coder/
├── Dockerfile.dev           # Pre-built development image
├── startup-fast.sh          # Fast runtime configuration (NEW)
├── startup.sh               # Original slow startup (kept for reference)
├── zmanim-workspace.tf  # Coder template (UPDATED)
└── DEV-IMAGE-SETUP.md       # This file

.github/workflows/
└── build-dev-image.yml      # Auto-build image on push (NEW)
```

## Troubleshooting

### Image build fails
- Check GitHub Actions logs
- Verify DOCKER_TOKEN secret is set
- Ensure Go/Node versions are available

### Workspace startup still slow
- Verify template is updated: `cat .coder/zmanim-workspace.tf | grep jcomdev`
- Check if latest image is being pulled
- Rebuild workspace to force fresh pull

### Missing dependencies in image
- Add to `.coder/Dockerfile.dev`
- Push to trigger rebuild
- Wait for build to complete
- Recreate workspace

### Want to test without pushing to main
1. Create a test image locally:
   ```bash
   docker build -f .coder/Dockerfile.dev -t zmanim-dev-test .
   ```
2. Update template temporarily to use `zmanim-dev-test:latest`
3. Push template and test

## Benefits

- ⚡ **5-10x faster** workspace startup
- 🔄 **Always up-to-date** dependencies via automated rebuilds
- 🎯 **Consistent environments** across all developers
- 💾 **Reduced Coder startup logs** (easier to debug)
- 🚀 **Better developer experience** (less waiting)

## Next Steps

1. ✅ Push changes to trigger first build
2. ✅ Wait for build to complete
3. ✅ Update Coder template via `./push-template.sh`
4. ✅ Test with a new workspace
5. ✅ Verify startup time improvement
