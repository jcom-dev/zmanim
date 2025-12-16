# Story 7.11: Production Deployment GitHub Workflow

## Status: Approved

## Story

As a developer, I want a GitHub Actions workflow that deploys the Go API binary and Next.js static frontend to AWS S3 on pushes to main branch, so that production deployments are automated and consistent.

## Background

Epic 7 established AWS infrastructure with:
- `zmanim-releases-prod` S3 bucket for Go API binaries (StorageStack)
- `zmanim-static-prod` S3 bucket for Next.js static assets (CdnStack)
- CloudFront distribution serving both buckets
- GitHub OIDC role (`github-actions-cdk-deploy`) for credential-free AWS access

The tech spec (lines 186-219) defines "Deployment Flow (Code Update - Path 2)" but no workflow implements it.

## Acceptance Criteria

### AC1: Go API Binary Build and Upload
- [ ] Workflow triggers on push to `main` branch
- [ ] Builds Go binary for `linux/arm64` (Graviton3 target)
- [ ] Uploads binary to `s3://zmanim-releases-prod/zmanim-api-{sha}.bin`
- [ ] Also uploads as `s3://zmanim-releases-prod/zmanim-api-latest.bin` for EC2 download script

### AC2: Next.js Static Export and Upload
- [ ] Runs `npm run build` with `output: 'export'` in next.config.js
- [ ] Syncs `web/out/` directory to `s3://zmanim-static-prod/`
- [ ] Uses `--delete` flag to remove stale files
- [ ] Preserves `_next/static/*` cache headers (handled by CloudFront)

### AC3: CloudFront Cache Invalidation
- [ ] Creates invalidation for `/*` after S3 sync
- [ ] Waits for invalidation to complete (optional, can be async)
- [ ] Outputs invalidation ID for tracking

### AC4: GitHub OIDC Authentication
- [ ] Uses existing `github-actions-cdk-deploy` IAM role
- [ ] No static AWS credentials in secrets
- [ ] Role ARN: `arn:aws:iam::{account}:role/github-actions-cdk-deploy`

### AC5: Workflow Configuration
- [ ] Workflow file: `.github/workflows/deploy-prod.yml`
- [ ] Runs only on `main` branch pushes (not PRs)
- [ ] Can be manually triggered via `workflow_dispatch`
- [ ] Jobs run in parallel where possible (api + web builds)

## Technical Notes

### S3 Bucket Names (from CDK stacks)
- Releases: `zmanim-releases-prod` (StorageStack)
- Static: `zmanim-static-prod` (CdnStack)

### CloudFront Distribution
- Distribution ID exported as `ZmanimProd-DistributionId`
- Can be retrieved via `aws cloudformation describe-stacks`

### Go Build Command
```bash
cd api && GOOS=linux GOARCH=arm64 go build -o zmanim-api ./cmd/api
```

### Next.js Export
Requires `next.config.js` to have `output: 'export'` for static generation.

### EC2 Download Script Reference
`infrastructure/packer/files/download-latest.sh` pulls from S3 releases bucket.

## Out of Scope
- EC2 service restart (handled by existing systemd timer or manual SSM)
- AMI rebuild (separate workflow, Path 1)
- Database migrations (not applicable for static deploy)

## Dependencies
- Story 7.5: S3 Buckets (completed - buckets exist)
- Story 7.6: CloudFront Distribution (completed - distribution exists)
- GitHub OIDC Stack (completed - role exists)

## Dev Agent Record

### Context Reference
- [tech-spec-epic-7.md](../tech-spec-epic-7.md) - Lines 186-219 (Deployment Flow Path 2)
- [storage-stack.ts](../../../infrastructure/lib/storage-stack.ts) - Releases bucket definition
- [cdn-stack.ts](../../../infrastructure/lib/cdn-stack.ts) - Static bucket and CloudFront
- [github-oidc-stack.ts](../../../infrastructure/lib/github-oidc-stack.ts) - IAM role for GitHub Actions

### Implementation Tasks
- [ ] Task 1: Create `.github/workflows/deploy-prod.yml` workflow file
- [ ] Task 2: Add Go ARM64 build job with S3 upload
- [ ] Task 3: Add Next.js build and S3 sync job
- [ ] Task 4: Add CloudFront invalidation step
- [ ] Task 5: Test workflow with manual trigger
