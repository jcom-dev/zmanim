# Story 7.2: Packer AMI Build Pipeline

Status: ready-for-dev

## Story

As a **developer**,
I want **a Packer-built AMI with all dependencies pre-installed**,
So that **EC2 instances boot instantly without requiring NAT Gateway for runtime package installation**.

## Acceptance Criteria

1. **AC1:** Packer template builds Amazon Linux 2023 ARM64
2. **AC2:** PostgreSQL 16 + PostGIS installed and configured
3. **AC3:** Redis 7 installed with persistence enabled
4. **AC4:** Go API binary included in `/opt/zmanim/`
5. **AC5:** systemd services configured for all components
6. **AC6:** Backup scripts included
7. **AC7:** GitHub Actions builds AMI on release tag
8. **AC8:** AMI ID stored in SSM Parameter Store

## Tasks / Subtasks

- [ ] **Task 1: Create Packer Template** (AC: 1)
  - [ ] 1.1 Create `infrastructure/packer/` directory
  - [ ] 1.2 Create `zmanim-ami.pkr.hcl` with Amazon Linux 2023 ARM64 base
  - [ ] 1.3 Configure Packer variables for version, region
  - [ ] 1.4 Set up source AMI filter for latest AL2023

- [ ] **Task 2: Install PostgreSQL + PostGIS** (AC: 2)
  - [ ] 2.1 Add provisioner to install PostgreSQL 16 from dnf
  - [ ] 2.2 Install PostGIS 3.4 extension
  - [ ] 2.3 Create `postgresql.conf` with optimized settings
  - [ ] 2.4 Create `pg_hba.conf` for local socket authentication
  - [ ] 2.5 Configure data directory at `/data/postgres`

- [ ] **Task 3: Install Redis** (AC: 3)
  - [ ] 3.1 Add provisioner to install Redis 7 from dnf
  - [ ] 3.2 Create `redis.conf` with persistence (RDB + AOF)
  - [ ] 3.3 Set memory limit to 1GB
  - [ ] 3.4 Configure data directory at `/data/redis`

- [ ] **Task 4: Include Go API Binary** (AC: 4)
  - [ ] 4.1 Create `/opt/zmanim/` directory structure
  - [ ] 4.2 Add file provisioner to copy pre-built binary
  - [ ] 4.3 Set executable permissions
  - [ ] 4.4 Create `config.env.template` for environment variables

- [ ] **Task 5: Configure systemd Services** (AC: 5)
  - [ ] 5.1 Create `postgresql.service` (if not provided by package)
  - [ ] 5.2 Create `redis.service` (if not provided by package)
  - [ ] 5.3 Create `zmanim-api.service` with dependencies on postgres/redis
  - [ ] 5.4 Configure `ExecStartPre` for binary download script
  - [ ] 5.5 Enable services for auto-start

- [ ] **Task 6: Include Backup Scripts** (AC: 6)
  - [ ] 6.1 Install Restic from dnf
  - [ ] 6.2 Create `/opt/zmanim/backup.sh` script
  - [ ] 6.3 Create `restic-backup.service` systemd unit
  - [ ] 6.4 Create `restic-backup.timer` for daily 3 AM UTC
  - [ ] 6.5 Create `backup-notify@.service` for failure emails
  - [ ] 6.6 Create `/opt/zmanim/notify-failure.sh` script

- [ ] **Task 7: GitHub Actions AMI Build** (AC: 7, 8)
  - [ ] 7.1 Create `.github/workflows/build-ami.yml`
  - [ ] 7.2 Configure trigger on release tags (`v*-ami`)
  - [ ] 7.3 Build Go binary for linux/arm64
  - [ ] 7.4 Run `packer init` and `packer build`
  - [ ] 7.5 Store AMI ID in SSM Parameter Store `/zmanim/prod/ami-id`
  - [ ] 7.6 Add required secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

- [ ] **Task 8: Verification** (AC: 1-8)
  - [ ] 8.1 Build AMI locally with `packer build`
  - [ ] 8.2 Launch test instance from AMI
  - [ ] 8.3 Verify all services start automatically
  - [ ] 8.4 Verify PostgreSQL accepts connections
  - [ ] 8.5 Verify Redis accepts connections
  - [ ] 8.6 Document AMI contents and configuration

## Dev Notes

### Architecture Alignment

This story creates the **immutable infrastructure foundation** for Epic 7. The Packer AMI approach:
- **Eliminates NAT Gateway costs** (~$32/month savings) by pre-installing all packages
- **Ensures reproducible deployments** - same AMI = same environment
- **Reduces boot time** from 5-10 minutes (runtime install) to <1 minute

**Key Design Decisions:**
- Amazon Linux 2023 ARM64 for Graviton3 compatibility
- Co-located services (PostgreSQL + Redis + API on same instance)
- Data directory at `/data` (separate EBS volume, survives AMI upgrades)

### systemd Service Architecture

```
zmanim-api.service
├── After: postgresql.service
├── After: redis.service
├── Requires: postgresql.service, redis.service
├── ExecStartPre: /opt/zmanim/download-latest.sh
└── ExecStart: /opt/zmanim/zmanim-api

restic-backup.timer (daily 3 AM UTC)
└── Activates: restic-backup.service
    ├── ExecStart: /opt/zmanim/backup.sh
    └── OnFailure: backup-notify@%n.service
```

### Packer Template Structure

```hcl
# infrastructure/packer/zmanim-ami.pkr.hcl
source "amazon-ebs" "zmanim" {
  ami_name      = "zmanim-${var.version}"
  instance_type = "t4g.small"  # ARM64 for build
  region        = "eu-west-1"
  source_ami_filter {
    filters = {
      name                = "al2023-ami-*-arm64"
      virtualization-type = "hvm"
    }
    owners      = ["amazon"]
    most_recent = true
  }
}

build {
  sources = ["source.amazon-ebs.zmanim"]

  provisioner "shell" { ... }  # Install packages
  provisioner "file" { ... }   # Copy configs
  provisioner "shell" { ... }  # Configure services
}
```

### Project Structure

```
infrastructure/
├── packer/
│   ├── zmanim-ami.pkr.hcl      # Main Packer template
│   ├── variables.pkr.hcl       # Variables
│   ├── scripts/
│   │   ├── install-packages.sh
│   │   ├── configure-postgres.sh
│   │   ├── configure-redis.sh
│   │   └── configure-systemd.sh
│   └── files/
│       ├── postgresql.conf
│       ├── pg_hba.conf
│       ├── redis.conf
│       ├── zmanim-api.service
│       ├── restic-backup.service
│       ├── restic-backup.timer
│       ├── backup.sh
│       └── notify-failure.sh
```

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.2]
- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Packer-AMI-Contents]
- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Backup-Strategy]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.2]

## Dev Agent Record

### Context Reference

- [Story 7-2 Context XML](./7-2-packer-ami-build-pipeline.context.xml)

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

<!-- To be filled during implementation -->

### Completion Notes List

<!-- To be filled after implementation -->

### File List

<!-- To be filled after implementation -->

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
