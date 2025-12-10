# Story 7.4: EC2 Instance & EBS Storage

Status: ready-for-dev

## Story

As a **developer**,
I want **an EC2 instance running the Packer AMI with persistent storage**,
So that **I have zero cold start compute with data that survives AMI upgrades**.

## Acceptance Criteria

1. **AC1:** m7g.medium instance launches from Packer AMI
2. **AC2:** Root EBS: 10GB gp3 (from AMI, disposable)
3. **AC3:** Data EBS: 20GB gp3 (persistent, mounted at `/data`)
4. **AC4:** Elastic IP attached
5. **AC5:** IAM role grants S3, SSM, SES access
6. **AC6:** User data mounts data volume, pulls secrets, starts services
7. **AC7:** CloudWatch agent configured

## Tasks / Subtasks

- [ ] **Task 1: EC2 Instance from AMI** (AC: 1)
  - [ ] 1.1 Define EC2 instance in `lib/compute-stack.ts`
  - [ ] 1.2 Configure instance type `m7g.medium` (Graviton3)
  - [ ] 1.3 Reference Packer AMI from SSM Parameter Store
  - [ ] 1.4 Place in public subnet from NetworkStack
  - [ ] 1.5 Attach security group from NetworkStack

- [ ] **Task 2: Root EBS Volume** (AC: 2)
  - [ ] 2.1 Configure root volume 10GB gp3
  - [ ] 2.2 Set `deleteOnTermination: true` (disposable)
  - [ ] 2.3 Document that root is replaced on AMI upgrade

- [ ] **Task 3: Persistent Data Volume** (AC: 3)
  - [ ] 3.1 Create standalone EBS volume 20GB gp3
  - [ ] 3.2 Configure 3000 IOPS baseline
  - [ ] 3.3 Set `deleteOnTermination: false` (persistent)
  - [ ] 3.4 Attach to instance as `/dev/sdf`
  - [ ] 3.5 Document mount point `/data`

- [ ] **Task 4: Elastic IP** (AC: 4)
  - [ ] 4.1 Create Elastic IP resource
  - [ ] 4.2 Associate with EC2 instance
  - [ ] 4.3 Export EIP address for API Gateway integration

- [ ] **Task 5: IAM Role** (AC: 5)
  - [ ] 5.1 Create IAM role for EC2 instance
  - [ ] 5.2 Add S3 policy for backup/releases buckets
  - [ ] 5.3 Add SSM policy for `ssm:GetParameter` on `/zmanim/prod/*`
  - [ ] 5.4 Add SES policy for backup failure emails
  - [ ] 5.5 Add CloudWatch policy for metrics/logs
  - [ ] 5.6 Attach instance profile to EC2

- [ ] **Task 6: User Data Script** (AC: 6)
  - [ ] 6.1 Create user data script in CDK
  - [ ] 6.2 Mount data volume at `/data` if not already formatted
  - [ ] 6.3 Create PostgreSQL data directory `/data/postgres`
  - [ ] 6.4 Create Redis data directory `/data/redis`
  - [ ] 6.5 Pull secrets from SSM Parameter Store
  - [ ] 6.6 Generate `/opt/zmanim/config.env` from secrets
  - [ ] 6.7 Generate `/etc/restic/env` for backup
  - [ ] 6.8 Start systemd services

- [ ] **Task 7: CloudWatch Agent** (AC: 7)
  - [ ] 7.1 Ensure CloudWatch agent installed in AMI
  - [ ] 7.2 Create CloudWatch agent config file
  - [ ] 7.3 Configure metrics: CPU, Memory, Disk, Network
  - [ ] 7.4 Configure log groups for app/postgres/redis logs
  - [ ] 7.5 Start CloudWatch agent via user data

- [ ] **Task 8: Testing** (AC: 1-7)
  - [ ] 8.1 Deploy to staging account
  - [ ] 8.2 Verify instance launches from correct AMI
  - [ ] 8.3 Verify data volume mounts at `/data`
  - [ ] 8.4 Verify PostgreSQL uses `/data/postgres`
  - [ ] 8.5 Verify Redis uses `/data/redis`
  - [ ] 8.6 Verify SSM parameters are retrieved
  - [ ] 8.7 Verify CloudWatch metrics appear
  - [ ] 8.8 Test AMI upgrade with data preservation

## Dev Notes

### Architecture Alignment

This story implements the **core compute infrastructure** with a critical design pattern:

**Two-Volume Architecture:**
```
┌─────────────────────────────────────────┐
│  EC2 Instance (from AMI)                │
│  ┌─────────────┐  ┌───────────────────┐ │
│  │ Root EBS    │  │ Data EBS          │ │
│  │ 10GB gp3    │  │ 20GB gp3          │ │
│  │ /           │  │ /data             │ │
│  │ (from AMI)  │  │ - /data/postgres  │ │
│  │ DISPOSABLE  │  │ - /data/redis     │ │
│  └─────────────┘  │ PERSISTENT        │ │
│        ↓          └───────────────────┘ │
│   Replaced on         ↓                 │
│   AMI upgrade    Survives AMI upgrades  │
└─────────────────────────────────────────┘
```

**Why This Matters:**
- Root volume contains OS + binaries (from AMI)
- Data volume contains PostgreSQL + Redis data
- On AMI upgrade: terminate instance (destroys root), launch new (attaches same data volume)
- Zero data loss during infrastructure updates

### User Data Script Flow

```bash
#!/bin/bash
set -euo pipefail

# 1. Mount data volume (if not already)
if ! mountpoint -q /data; then
  mkfs.xfs /dev/nvme1n1 || true  # Only if not formatted
  mount /dev/nvme1n1 /data
  echo '/dev/nvme1n1 /data xfs defaults,nofail 0 2' >> /etc/fstab
fi

# 2. Create data directories
mkdir -p /data/postgres /data/redis
chown postgres:postgres /data/postgres
chown redis:redis /data/redis

# 3. Pull secrets from SSM
export CLERK_SECRET=$(aws ssm get-parameter --name /zmanim/prod/clerk-secret-key --with-decryption --query Parameter.Value --output text)
export POSTGRES_PASSWORD=$(aws ssm get-parameter --name /zmanim/prod/postgres-password --with-decryption --query Parameter.Value --output text)
export RESTIC_PASSWORD=$(aws ssm get-parameter --name /zmanim/prod/restic-password --with-decryption --query Parameter.Value --output text)

# 4. Generate config files
envsubst < /opt/zmanim/config.env.template > /opt/zmanim/config.env
# ... generate /etc/restic/env

# 5. Start services
systemctl start postgresql
systemctl start redis
systemctl start zmanim-api
systemctl start amazon-cloudwatch-agent
```

### IAM Policies Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter"],
      "Resource": "arn:aws:ssm:eu-west-1:*:parameter/zmanim/prod/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::zmanim-backups-prod/*",
        "arn:aws:s3:::zmanim-releases-prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["cloudwatch:PutMetricData", "logs:*"],
      "Resource": "*"
    }
  ]
}
```

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.4]
- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Deployment-Strategy]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.4]

## Dev Agent Record

### Context Reference

[Story 7.4 Context XML](./7-4-ec2-instance-ebs-storage.context.xml)

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
