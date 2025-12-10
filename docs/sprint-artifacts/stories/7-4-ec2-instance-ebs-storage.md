# Story 7.4: EC2 Instance & EBS Storage

Status: review

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

- [x] **Task 1: EC2 Instance from AMI** (AC: 1)
  - [x] 1.1 Define EC2 instance in `lib/compute-stack.ts`
  - [x] 1.2 Configure instance type `m7g.medium` (Graviton3)
  - [x] 1.3 Reference Packer AMI from SSM Parameter Store
  - [x] 1.4 Place in public subnet from NetworkStack
  - [x] 1.5 Attach security group from NetworkStack

- [x] **Task 2: Root EBS Volume** (AC: 2)
  - [x] 2.1 Configure root volume 10GB gp3
  - [x] 2.2 Set `deleteOnTermination: true` (disposable)
  - [x] 2.3 Document that root is replaced on AMI upgrade

- [x] **Task 3: Persistent Data Volume** (AC: 3)
  - [x] 3.1 Create standalone EBS volume 20GB gp3
  - [x] 3.2 Configure 3000 IOPS baseline
  - [x] 3.3 Set `deleteOnTermination: false` (persistent)
  - [x] 3.4 Attach to instance as `/dev/sdf`
  - [x] 3.5 Document mount point `/data`

- [x] **Task 4: Elastic IP** (AC: 4)
  - [x] 4.1 Create Elastic IP resource
  - [x] 4.2 Associate with EC2 instance
  - [x] 4.3 Export EIP address for API Gateway integration

- [x] **Task 5: IAM Role** (AC: 5)
  - [x] 5.1 Create IAM role for EC2 instance
  - [x] 5.2 Add S3 policy for backup/releases buckets
  - [x] 5.3 Add SSM policy for `ssm:GetParameter` on `/zmanim/prod/*`
  - [x] 5.4 Add SES policy for backup failure emails
  - [x] 5.5 Add CloudWatch policy for metrics/logs
  - [x] 5.6 **Add SSM Session Manager policy (AmazonSSMManagedInstanceCore) for AWS Console login**
  - [x] 5.7 Attach instance profile to EC2

- [x] **Task 6: User Data Script** (AC: 6)
  - [x] 6.1 Create user data script in CDK
  - [x] 6.2 Mount data volume at `/data` if not already formatted
  - [x] 6.3 Create PostgreSQL data directory `/data/postgres`
  - [x] 6.4 Create Redis data directory `/data/redis`
  - [x] 6.5 Pull secrets from SSM Parameter Store
  - [x] 6.6 Generate `/opt/zmanim/config.env` from secrets
  - [x] 6.7 Generate `/etc/restic/env` for backup
  - [x] 6.8 Start systemd services

- [x] **Task 7: CloudWatch Agent** (AC: 7)
  - [x] 7.1 Ensure CloudWatch agent installed in AMI (verified in Packer scripts)
  - [x] 7.2 Create CloudWatch agent config file
  - [x] 7.3 Configure metrics: CPU, Memory, Disk, Network
  - [x] 7.4 Configure log groups for app/postgres/redis logs
  - [x] 7.5 Start CloudWatch agent via user data

- [x] **Task 8: Testing** (AC: 1-7)
  - [x] 8.1 CDK synth successful, CloudFormation template generated
  - [x] 8.2 Verified instance type m7g.medium and AMI from SSM
  - [x] 8.3 Verified data volume configuration (20GB gp3, 3000 IOPS)
  - [x] 8.4 Verified user data mounts /data/postgres
  - [x] 8.5 Verified user data creates /data/redis
  - [x] 8.6 Verified SSM parameter retrieval in user data
  - [x] 8.7 Verified CloudWatch agent config with metrics/logs
  - [x] 8.8 CDK unit tests pass (80/80) - AMI upgrade pattern documented

## Definition of Done

**Story is NOT complete until the dev agent has executed ALL of the following verification steps and documented the results:**

### Required Verification Tests

1. **CDK Synthesis for Compute Stack**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npm run build && npx cdk synth ZmanimProdCompute
   ```
   - [x] Command exits with code 0
   - [x] CloudFormation template generated successfully

2. **EC2 Instance Configuration Verification**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth ZmanimProdCompute 2>&1 | grep -E "(InstanceType|ImageId|m7g)" | head -10
   ```
   - [x] Instance type is m7g.medium (Graviton3)
   - [x] AMI reference pulls from SSM Parameter Store (`/zmanim/prod/ami-id`)

3. **Root EBS Volume Configuration**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth ZmanimProdCompute 2>&1 | grep -A10 "BlockDeviceMapping" | head -15
   ```
   - [x] Root volume is 10GB gp3
   - [x] DeleteOnTermination is true (disposable)

4. **Data EBS Volume Configuration (Persistent)**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth ZmanimProdCompute 2>&1 | grep -E "(Volume|EBS|20)" | head -10
   ```
   - [x] Data volume is 20GB gp3
   - [x] DeleteOnTermination is false (persistent - standalone CfnVolume)
   - [x] IOPS configured (3000 baseline)

5. **Elastic IP Verification**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth ZmanimProdCompute 2>&1 | grep -E "(EIP|ElasticIP|AllocationId)"
   ```
   - [x] Elastic IP resource exists
   - [x] Associated with EC2 instance via EIPAssociation

6. **IAM Role Permissions Verification**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth ZmanimProdCompute 2>&1 | grep -A20 "PolicyDocument" | head -40
   ```
   - [x] S3 access policy for backup/releases buckets
   - [x] SSM:GetParameter policy for `/zmanim/prod/*`
   - [x] SES policy for email notifications
   - [x] CloudWatch policy for metrics/logs

7. **SSM Session Manager Role Verification (for AWS Console access)**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth ZmanimProdCompute 2>&1 | grep -E "(AmazonSSMManagedInstanceCore|ssmmessages|ec2messages)"
   ```
   - [x] AmazonSSMManagedInstanceCore managed policy attached
   - [x] CloudWatchAgentServerPolicy managed policy attached
   - [x] Enables login via AWS Console > EC2 > Session Manager (no SSH keys needed)

8. **User Data Script Verification**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth ZmanimProdCompute 2>&1 | grep -E "UserData|Fn::Base64" | head -5
   ```
   - [x] User data script exists (Fn::Base64 encoded)
   - [x] Script mounts /data volume
   - [x] Script pulls SSM parameters with --with-decryption

9. **Cross-Stack References**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth ZmanimProdCompute 2>&1 | grep -E "ImportValue|Fn::ImportValue"
   ```
   - [x] References SubnetId from NetworkStack
   - [x] References SecurityGroupId from NetworkStack

### Evidence Required in Dev Agent Record
- CDK synth output showing EC2, EBS, EIP resources
- IAM policy document showing required permissions
- Confirmation of cross-stack dependencies

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

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

Implementation plan:
1. Task 1-7: Implement full compute-stack.ts with EC2, EBS, IAM, user data, CloudWatch
2. Task 8: Run CDK synth and unit tests for DoD verification

### Completion Notes List

**Implementation Summary:**
- Rewrote `infrastructure/lib/compute-stack.ts` with full Story 7.4 implementation
- EC2 instance: m7g.medium Graviton3, AMI from SSM `/zmanim/prod/ami-id`
- Root EBS: 10GB gp3, encrypted, deleteOnTermination=true
- Data EBS: 20GB gp3, 3000 IOPS, 125 MiB/s throughput, encrypted, persistent (CfnVolume)
- Elastic IP: VPC domain, associated with instance, exported for API Gateway
- IAM role: S3 (backups/releases), SSM (secrets), SES (email), CloudWatch, KMS decrypt
- Managed policies: AmazonSSMManagedInstanceCore, CloudWatchAgentServerPolicy
- User data script: Mounts /data, creates postgres/redis dirs, pulls SSM secrets, generates config.env and restic env, starts all services
- CloudWatch agent config: CPU, memory, disk, netstat metrics; log groups for zmanim-api, postgresql, redis, user-data
- Created comprehensive CDK unit tests in `infrastructure/test/compute-stack.test.ts`

**DoD Verification Results:**
- CDK synth: ✓ Exits code 0, CloudFormation template generated
- EC2: ✓ m7g.medium, AMI from SSM parameter
- Root EBS: ✓ 10GB gp3, deleteOnTermination=true
- Data EBS: ✓ 20GB gp3, 3000 IOPS, persistent CfnVolume
- Elastic IP: ✓ Created and associated
- IAM: ✓ All policies (S3, SSM, SES, CloudWatch, KMS)
- SSM Session Manager: ✓ AmazonSSMManagedInstanceCore attached
- User Data: ✓ Base64 encoded, mounts /data, pulls secrets
- Cross-stack: ✓ Imports SubnetId, SecurityGroupId from NetworkStack
- Unit tests: ✓ 80/80 passed

### File List

**Modified:**
- `infrastructure/lib/compute-stack.ts` - Full Story 7.4 implementation

**Created:**
- `infrastructure/test/compute-stack.test.ts` - 80 CDK assertion tests

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
| 2025-12-10 | Dev Agent (Claude Opus 4.5) | Implemented EC2, EBS, IAM, user data, CloudWatch. All DoD checks passed. 80/80 tests pass. |
