# CDKTF Migration Specification

## Overview

This document specifies the migration from AWS CDK (CloudFormation) to CDKTF (Terraform) for the Shtetl Zmanim production infrastructure. The goal is to replicate the exact same infrastructure using Terraform as the underlying provisioning engine.

**Source:** `infrastructure-1/` (AWS CDK) - **DELETED**
**Target:**
- `infrastructure-common/` - Shtetl Common stack (CDKTF - TypeScript)
- `infrastructure/` - Zmanim stack (CDKTF - TypeScript)
**Terraform Backend:** S3 bucket `shtetl-tf` with S3 native locking (no DynamoDB)
**CloudFormation Status:** All stacks deleted from AWS - clean slate deployment
**Code Style:** CDKTF TypeScript only (no raw HCL)

---

## Architecture: Two-Stack Design

The infrastructure is split into two stacks in separate CDKTF projects:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHTETL COMMON STACK                          │
│         infrastructure-common/ (shared across projects)         │
├─────────────────────────────────────────────────────────────────┤
│  • Terraform State Bucket (shtetl-tf)                           │
│  • Route53 Hosted Zone (shtetl.io) + existing records           │
│  • VPC + Subnets + Internet Gateway + S3 Endpoint               │
│  • GitHub OIDC Provider + Deploy Role                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ References (vpc_id, zone_id, etc.)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ZMANIM STACK                               │
│              infrastructure/ (zmanim project)                   │
├─────────────────────────────────────────────────────────────────┤
│  • S3 Buckets (backups, releases)                               │
│  • Security Group + IAM Role + Instance Profile                 │
│  • Elastic IP + EC2 Instance + EBS Volume                       │
│  • API Gateway (HTTP API + Routes + JWT Auth)                   │
│  • ACM Certificate (us-east-1)                                  │
│  • Next.js Lambda + CloudFront Distribution                     │
│  • Route53 Records (zmanim.shtetl.io, origin-api.*)             │
│  • Health Check + CloudWatch Alarm + SNS                        │
└─────────────────────────────────────────────────────────────────┘
```

### Why Two Stacks?

| Benefit | Description |
|---------|-------------|
| **Shared infra stability** | Common stack rarely changes, isolated from project deploys |
| **Different deploy cadence** | Shared infra deployed once, project infra deployed frequently |
| **Multi-project ready** | Future projects use same VPC, Route53, OIDC |
| **Clear separation** | Platform infra vs Application infra |

### State File Structure

```
s3://shtetl-tf/
├── shtetl-common/terraform.tfstate   # Shtetl Common Stack
├── zmanim-prod/terraform.tfstate     # Zmanim Production
└── (future projects)/terraform.tfstate
```

---

## Why CDKTF?

| Aspect | AWS CDK (CloudFormation) | CDKTF (Terraform) |
|--------|--------------------------|-------------------|
| State Management | CloudFormation stacks | Terraform state (portable) |
| Drift Detection | Limited | Built-in `terraform plan` |
| Multi-Cloud | AWS only | Any provider |
| Rollback | Automatic (can be problematic) | Manual, controlled |
| Import Existing | Complex | `terraform import` |
| Community | AWS-focused | Massive ecosystem |
| Speed | Slow (CloudFormation) | Faster provisioning |

---

## Phase 1: Prerequisites

### 1.1 Install Dependencies

```bash
npm install -g cdktf-cli
cdktf --version  # Verify installation
```

---

## Phase 2: CDKTF Project Structure

Two separate CDKTF projects for clean separation:

```
infrastructure-common/              # SHTETL COMMON (shared across projects)
├── cdktf.json
├── package.json
├── tsconfig.json
├── main.ts                        # Entry point
├── lib/
│   ├── config.ts                  # Shared configuration
│   └── stacks/
│       └── shtetl-common.ts       # STACK 1: State bucket, Route53, VPC, OIDC
└── __tests__/
    └── shtetl-common.test.ts

infrastructure/                     # ZMANIM PROJECT
├── cdktf.json
├── package.json
├── tsconfig.json
├── main.ts                        # Entry point
├── lib/
│   ├── config.ts                  # Zmanim configuration
│   ├── stacks/
│   │   └── zmanim-prod.ts         # STACK 2: All zmanim resources
│   └── constructs/
│       ├── secure-bucket.ts       # Reusable S3 bucket construct
│       └── api-route.ts           # API Gateway route helper
├── packer/                        # AMI build files
│   ├── zmanim-ami.pkr.hcl
│   ├── variables.pkr.hcl
│   ├── scripts/
│   └── files/
└── __tests__/
    └── zmanim-prod.test.ts
```

### Why Two Separate Projects?

| Benefit | Description |
|---------|-------------|
| **Shared infra stability** | Common stack rarely changes, isolated from project deploys |
| **Different deploy cadence** | Shared infra deployed once, project infra deployed frequently |
| **Clear ownership** | Platform team owns `infrastructure-common`, product team owns `infrastructure` |
| **Simpler dependencies** | Each project has its own `node_modules`, no conflicts |

---

## Phase 3: Stack Specifications

**Note:** The code examples below show the Terraform HCL that CDKTF will generate. The actual implementation will be in TypeScript using CDKTF constructs. During iterative development, write TypeScript code → run `cdktf synth` → review generated HCL → `terraform apply`.

Example CDKTF TypeScript pattern:
```typescript
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";

new S3Bucket(this, "state-bucket", {
  bucket: "shtetl-tf",
  tags: { Name: "Terraform State", ManagedBy: "cdktf" }
});
```

---

## STACK 1: Shtetl Common (`shtetl-common`)

**Purpose:** Shared infrastructure for all Shtetl projects
**State Key:** `s3://shtetl-tf/shtetl-common/terraform.tfstate`
**Region:** eu-west-1

### 1.0 Terraform State Bucket (Bootstrap)

The state bucket is included in the common stack but requires a two-phase deployment:

1. **Phase 1 (Bootstrap):** Deploy with local state to create the bucket
2. **Phase 2 (Migrate):** Add backend config and migrate state to S3

| Resource | Terraform Resource | Configuration |
|----------|-------------------|---------------|
| State Bucket | `aws_s3_bucket` | `shtetl-tf` |
| Versioning | `aws_s3_bucket_versioning` | Enabled |
| Encryption | `aws_s3_bucket_server_side_encryption_configuration` | AES256 |
| Public Access Block | `aws_s3_bucket_public_access_block` | All blocked |

```hcl
# =============================================================================
# TERRAFORM STATE BUCKET
# =============================================================================
# This bucket stores Terraform state for all Shtetl projects.
#
# BOOTSTRAP PROCESS:
# 1. Comment out the backend "s3" block below
# 2. Run: terraform init && terraform apply
# 3. Uncomment the backend "s3" block
# 4. Run: terraform init -migrate-state
# 5. Confirm state migration when prompted
# =============================================================================

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # UNCOMMENT AFTER BOOTSTRAP (Step 3)
  # backend "s3" {
  #   bucket       = "shtetl-tf"
  #   key          = "shtetl-common/terraform.tfstate"
  #   region       = "eu-west-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = "eu-west-1"

  default_tags {
    tags = {
      ManagedBy = "terraform"
      Project   = "shtetl"
    }
  }
}

# -----------------------------------------------------------------------------
# State Bucket
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "terraform_state" {
  bucket = "shtetl-tf"

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = "Terraform State"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy to enforce SSL and prevent deletion of state files
resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSSL"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.terraform_state.arn,
          "${aws_s3_bucket.terraform_state.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid       = "DenyDeleteStateFiles"
        Effect    = "Deny"
        Principal = "*"
        Action = [
          "s3:DeleteObject",
          "s3:DeleteObjectVersion"
        ]
        Resource = "${aws_s3_bucket.terraform_state.arn}/*.tfstate"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalArn" = [
              "arn:aws:iam::*:role/github-actions-deploy",
              "arn:aws:iam::*:root"
            ]
          }
        }
      }
    ]
  })
}
```

**Bootstrap Commands:**

```bash
# Phase 1: Initial deployment with local state
cd infrastructure-common
npx cdktf synth
cd cdktf.out/stacks/shtetl-common
terraform init
terraform apply

# Phase 2: Migrate state to S3
# 1. Edit main.tf - uncomment the backend "s3" block
# 2. Run migration:
terraform init -migrate-state

# Terraform will prompt:
# "Do you want to copy existing state to the new backend?"
# Answer: yes

# Verify state is now in S3
aws s3 ls s3://shtetl-tf/shtetl-common/
# Should show: terraform.tfstate
```

### 1.1 VPC & Networking

| Resource | Terraform Resource | Configuration |
|----------|-------------------|---------------|
| VPC | `aws_vpc` | CIDR: 10.0.0.0/16 |
| Public Subnet | `aws_subnet` | 10.0.1.0/24, eu-west-1a |
| Internet Gateway | `aws_internet_gateway` | Attached to VPC |
| Route Table | `aws_route_table` | 0.0.0.0/0 → IGW |
| Route Table Association | `aws_route_table_association` | Subnet ↔ Route Table |
| S3 Gateway Endpoint | `aws_vpc_endpoint` | Gateway type, S3 service |

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name    = "shtetl-vpc"
    Project = "shtetl"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "eu-west-1a"
  map_public_ip_on_launch = true

  tags = {
    Name    = "shtetl-public-subnet"
    Project = "shtetl"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name    = "shtetl-igw"
    Project = "shtetl"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name    = "shtetl-public-rt"
    Project = "shtetl"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.eu-west-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.public.id]

  tags = {
    Name    = "shtetl-s3-endpoint"
    Project = "shtetl"
  }
}
```

### 1.2 Route53 Hosted Zone & All DNS Records (IMPORTED)

The hosted zone and ALL its existing DNS records will be **imported** into Terraform state. This preserves the existing zone ID (important for nameserver consistency) and all DNS records.

| Resource | Terraform Resource | Configuration |
|----------|-------------------|---------------|
| Hosted Zone | `aws_route53_zone` | shtetl.io (IMPORT: Z079919527B3JRWEWJVH6) |
| All Records | `aws_route53_record` | MX, TXT, CNAME, A, etc. (IMPORT all) |

**IMPORTANT:** The hosted zone and records already exist and will be IMPORTED, not recreated. This is critical because:
1. Recreating the zone would change nameservers (breaking DNS)
2. Existing records (email, verification, etc.) must be preserved

```hcl
# -----------------------------------------------------------------------------
# Route53 Hosted Zone (IMPORTED - DO NOT RECREATE)
# -----------------------------------------------------------------------------
resource "aws_route53_zone" "shtetl" {
  name = "shtetl.io"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name    = "shtetl.io"
    Project = "shtetl"
  }
}

# -----------------------------------------------------------------------------
# DNS Records (ALL IMPORTED from existing zone)
# -----------------------------------------------------------------------------
# STEP 1: Run the discovery script below to get all existing records
# STEP 2: Add each record to Terraform code matching EXACTLY
# STEP 3: Import each record into state

# Example records - REPLACE with actual values from your zone:

# NS Record (auto-created with zone, but import to manage)
resource "aws_route53_record" "ns" {
  zone_id = aws_route53_zone.shtetl.zone_id
  name    = "shtetl.io"
  type    = "NS"
  ttl     = 172800
  records = [
    # These are assigned by AWS - get actual values from zone
    "ns-XXX.awsdns-XX.com.",
    "ns-XXX.awsdns-XX.net.",
    "ns-XXX.awsdns-XX.org.",
    "ns-XXX.awsdns-XX.co.uk.",
  ]
}

# SOA Record (auto-created with zone)
resource "aws_route53_record" "soa" {
  zone_id = aws_route53_zone.shtetl.zone_id
  name    = "shtetl.io"
  type    = "SOA"
  ttl     = 900
  records = [
    # Get actual SOA from zone
    "ns-XXX.awsdns-XX.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
  ]
}

# MX Records
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.shtetl.zone_id
  name    = "shtetl.io"
  type    = "MX"
  ttl     = 3600
  records = [
    # REPLACE with actual MX records
  ]
}

# TXT Records (SPF, verification, etc.)
resource "aws_route53_record" "txt_root" {
  zone_id = aws_route53_zone.shtetl.zone_id
  name    = "shtetl.io"
  type    = "TXT"
  ttl     = 3600
  records = [
    # REPLACE with actual TXT records (SPF, domain verification, etc.)
  ]
}

# DMARC Record
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.shtetl.zone_id
  name    = "_dmarc.shtetl.io"
  type    = "TXT"
  ttl     = 3600
  records = [
    # REPLACE with actual DMARC policy
  ]
}

# DKIM Records (add each selector)
# resource "aws_route53_record" "dkim_selector1" { ... }

# Add ALL other records from your zone...
```

**Discovery Script - Get All Existing Records:**

```bash
#!/bin/bash
# Save as: scripts/discover-dns-records.sh

ZONE_ID="Z079919527B3JRWEWJVH6"

echo "=== Fetching all DNS records from zone $ZONE_ID ==="
echo ""

# Get all records as JSON
aws route53 list-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --output json > /tmp/dns-records.json

# Pretty print for review
echo "=== Records found: ==="
jq -r '.ResourceRecordSets[] | "\(.Type)\t\(.Name)\t\(.TTL // "alias")\t\(.ResourceRecords // .AliasTarget)"' /tmp/dns-records.json

echo ""
echo "=== Full JSON saved to /tmp/dns-records.json ==="
echo ""
echo "=== Terraform import commands: ==="

# Generate import commands
jq -r '.ResourceRecordSets[] | "terraform import '\''aws_route53_record.\(.Type | ascii_downcase)_\(.Name | gsub("\\.shtetl\\.io\\.?$"; "") | gsub("\\."; "_") | if . == "" then "root" else . end)'\'' '${ZONE_ID}'_\(.Name)_\(.Type)"' /tmp/dns-records.json
```

**Import Process:**

```bash
# 1. Run discovery to see all existing records
chmod +x scripts/discover-dns-records.sh
./scripts/discover-dns-records.sh

# 2. Review /tmp/dns-records.json and add EACH record to Terraform code
#    Make sure values match EXACTLY (including trailing dots on FQDNs)

# 3. Import the hosted zone first
terraform import aws_route53_zone.shtetl Z079919527B3JRWEWJVH6

# 4. Import each record (format: ZONEID_NAME_TYPE)
# Examples:
terraform import aws_route53_record.ns Z079919527B3JRWEWJVH6_shtetl.io_NS
terraform import aws_route53_record.soa Z079919527B3JRWEWJVH6_shtetl.io_SOA
terraform import aws_route53_record.mx Z079919527B3JRWEWJVH6_shtetl.io_MX
terraform import aws_route53_record.txt_root Z079919527B3JRWEWJVH6_shtetl.io_TXT
terraform import aws_route53_record.dmarc Z079919527B3JRWEWJVH6__dmarc.shtetl.io_TXT
# ... import all other records

# 5. Verify no changes
terraform plan
# Should show: No changes (if all records match exactly)
```

**Common Import Gotchas:**

| Issue | Solution |
|-------|----------|
| Trailing dots on FQDNs | Include them: `"mail.example.com."` not `"mail.example.com"` |
| Multiple TXT values | Use list: `records = ["v=spf1...", "other-txt"]` |
| Alias records (no TTL) | Use `alias {}` block instead of `records` |
| Record name format | Import uses: `ZONEID_name_TYPE` (name without zone suffix) |

**Critical:** Run `terraform plan` after imports. If it shows changes, adjust your Terraform code to match the actual record values exactly.

### 1.3 GitHub OIDC Provider

| Resource | Terraform Resource | Configuration |
|----------|-------------------|---------------|
| OIDC Provider | `aws_iam_openid_connect_provider` | GitHub Actions |
| IAM Role | `aws_iam_role` | github-actions-deploy |
| IAM Policy | `aws_iam_role_policy_attachment` | AdministratorAccess |

```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    Name    = "github-oidc"
    Project = "shtetl"
  }
}

resource "aws_iam_role" "github_actions" {
  name                 = "github-actions-deploy"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:jcom-dev/*:*"
          }
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Name    = "github-actions-deploy"
    Project = "shtetl"
  }
}

resource "aws_iam_role_policy_attachment" "github_actions" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
```

### 1.4 Shtetl Common Stack Outputs

```hcl
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID for project stacks"
}

output "vpc_cidr" {
  value       = aws_vpc.main.cidr_block
  description = "VPC CIDR block"
}

output "public_subnet_id" {
  value       = aws_subnet.public.id
  description = "Public subnet ID"
}

output "public_subnet_az" {
  value       = aws_subnet.public.availability_zone
  description = "Public subnet availability zone"
}

output "internet_gateway_id" {
  value       = aws_internet_gateway.main.id
  description = "Internet Gateway ID"
}

output "s3_endpoint_id" {
  value       = aws_vpc_endpoint.s3.id
  description = "S3 VPC Endpoint ID"
}

output "hosted_zone_id" {
  value       = aws_route53_zone.shtetl.zone_id
  description = "Route53 hosted zone ID"
}

output "hosted_zone_name" {
  value       = aws_route53_zone.shtetl.name
  description = "Route53 hosted zone name (shtetl.io)"
}

output "hosted_zone_name_servers" {
  value       = aws_route53_zone.shtetl.name_servers
  description = "Route53 hosted zone name servers (update at registrar)"
}

output "github_oidc_provider_arn" {
  value       = aws_iam_openid_connect_provider.github.arn
  description = "GitHub OIDC provider ARN"
}

output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "GitHub Actions deploy role ARN"
}

# State bucket outputs (useful for other stacks to reference)
output "state_bucket_name" {
  value       = aws_s3_bucket.terraform_state.id
  description = "Terraform state bucket name"
}

output "state_bucket_arn" {
  value       = aws_s3_bucket.terraform_state.arn
  description = "Terraform state bucket ARN"
}
```

---

## STACK 2: Zmanim (`zmanim-prod`)

**Purpose:** All Zmanim infrastructure - EC2, API Gateway, S3 buckets, CloudFront, Next.js Lambda, health checks
**State Key:** `s3://shtetl-tf/zmanim-prod/terraform.tfstate`
**Region:** eu-west-1 (with us-east-1 alias for CloudFront/ACM and Route53 health check metrics)
**Dependencies:** Reads outputs from `shtetl-common` stack via `terraform_remote_state`

### 2.0 Remote State Reference

```hcl
data "terraform_remote_state" "common" {
  backend = "s3"

  config = {
    bucket = "shtetl-tf"
    key    = "shtetl-common/terraform.tfstate"
    region = "eu-west-1"
  }
}

locals {
  vpc_id           = data.terraform_remote_state.common.outputs.vpc_id
  public_subnet_id = data.terraform_remote_state.common.outputs.public_subnet_id
  public_subnet_az = data.terraform_remote_state.common.outputs.public_subnet_az
  hosted_zone_id   = data.terraform_remote_state.common.outputs.hosted_zone_id
  hosted_zone_name = data.terraform_remote_state.common.outputs.hosted_zone_name
}
```

### 2.1 Security Group

| Resource | Terraform Resource | Configuration |
|----------|-------------------|---------------|
| Security Group | `aws_security_group` | Zmanim EC2 rules |

```hcl
variable "admin_cidr" {
  description = "CIDR block for SSH access"
  type        = string
  default     = "127.0.0.1/32"
}

resource "aws_security_group" "zmanim_ec2" {
  name        = "zmanim-ec2-sg"
  description = "Security group for Zmanim EC2 instance"
  vpc_id      = local.vpc_id

  ingress {
    description = "HTTPS from anywhere (CloudFront)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH from admin"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_cidr]
  }

  ingress {
    description = "API from API Gateway"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "zmanim-ec2-sg"
    Project = "zmanim"
  }
}
```

### 2.2 S3 Storage Buckets

| Resource | Terraform Resource | Configuration |
|----------|-------------------|---------------|
| Backups Bucket | `aws_s3_bucket` | `zmanim-backups-prod` |
| Releases Bucket | `aws_s3_bucket` | `zmanim-releases-prod` |
| Versioning | `aws_s3_bucket_versioning` | Enabled |
| Encryption | `aws_s3_bucket_server_side_encryption_configuration` | AES256 |
| Public Access Block | `aws_s3_bucket_public_access_block` | All blocked |
| Lifecycle | `aws_s3_bucket_lifecycle_configuration` | Releases: 30-day cleanup |

```hcl
resource "aws_s3_bucket" "backups" {
  bucket = "zmanim-backups-prod"

  tags = {
    Name    = "zmanim-backups-prod"
    Project = "zmanim"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket" "releases" {
  bucket = "zmanim-releases-prod"

  tags = {
    Name    = "zmanim-releases-prod"
    Project = "zmanim"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Versioning for both buckets
resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "releases" {
  bucket = aws_s3_bucket.releases.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption for both buckets
resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access for both buckets
resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "releases" {
  bucket                  = aws_s3_bucket.releases.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rule for releases (delete old versions)
resource "aws_s3_bucket_lifecycle_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
```

### 2.3 SSM Parameter Data Sources

```hcl
data "aws_ssm_parameter" "clerk_domain" {
  name = "/zmanim/prod/clerk-domain"
}

data "aws_ssm_parameter" "clerk_audience" {
  name = "/zmanim/prod/clerk-audience"
}

data "aws_ssm_parameter" "origin_verify_key" {
  name            = "/zmanim/prod/origin-verify-key"
  with_decryption = true
}

data "aws_ssm_parameter" "ami_id" {
  name = "/zmanim/prod/ami-id"
}
```

### 2.4 Elastic IP

```hcl
resource "aws_eip" "zmanim" {
  domain = "vpc"

  tags = {
    Name    = "zmanim-api-eip"
    Project = "zmanim"
  }
}
```

### 2.5 API Gateway (HTTP API)

| Resource | Terraform Resource | Configuration |
|----------|-------------------|---------------|
| HTTP API | `aws_apigatewayv2_api` | `zmanim-api-prod` |
| Log Group | `aws_cloudwatch_log_group` | 30 days retention |
| JWT Authorizer | `aws_apigatewayv2_authorizer` | Clerk OIDC |
| Stage | `aws_apigatewayv2_stage` | `$default` |
| Integration | `aws_apigatewayv2_integration` | HTTP_PROXY to EC2 |
| Routes | `aws_apigatewayv2_route` | See route table |

```hcl
resource "aws_apigatewayv2_api" "zmanim" {
  name          = "zmanim-api-prod"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = ["https://zmanim.shtetl.io"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["Authorization", "Content-Type", "X-Publisher-Id"]
    expose_headers    = ["X-Request-Id", "X-Amzn-RequestId"]
    max_age           = 3600
    allow_credentials = true
  }

  tags = {
    Name    = "zmanim-api-prod"
    Project = "zmanim"
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/zmanim-api-prod"
  retention_in_days = 30

  tags = {
    Name    = "zmanim-api-logs"
    Project = "zmanim"
  }
}

resource "aws_apigatewayv2_authorizer" "clerk" {
  api_id           = aws_apigatewayv2_api.zmanim.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "clerk-jwt"

  jwt_configuration {
    audience = [data.aws_ssm_parameter.clerk_audience.value]
    issuer   = "https://${data.aws_ssm_parameter.clerk_domain.value}"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.zmanim.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationLatency = "$context.integrationLatency"
      integrationStatus  = "$context.integrationStatus"
      authError          = "$context.authorizer.error"
    })
  }

  default_route_settings {
    throttling_burst_limit = 1000
    throttling_rate_limit  = 500
  }
}

resource "aws_apigatewayv2_integration" "ec2" {
  api_id             = aws_apigatewayv2_api.zmanim.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = "http://${aws_eip.zmanim.public_ip}:8080"
  integration_method = "ANY"
  timeout_milliseconds = 29000

  request_parameters = {
    "overwrite:header.X-Origin-Verify" = data.aws_ssm_parameter.origin_verify_key.value
  }
}

# Public routes (no auth)
locals {
  public_routes = {
    "GET /api/health"           = "/health"
    "GET /api/zmanim/{proxy+}"  = "/api/v1/zmanim/{proxy}"
    "POST /api/zmanim/{proxy+}" = "/api/v1/zmanim/{proxy}"
    "GET /api/cities/{proxy+}"  = "/api/v1/cities/{proxy}"
    "GET /api/publishers"       = "/api/v1/publishers"
    "GET /api/publishers/{proxy+}" = "/api/v1/publishers/{proxy}"
    "GET /api/countries"        = "/api/v1/countries"
    "GET /api/countries/{proxy+}" = "/api/v1/countries/{proxy}"
    "GET /api/continents"       = "/api/v1/continents"
    "GET /api/regions"          = "/api/v1/regions"
    "GET /api/regions/{proxy+}" = "/api/v1/regions/{proxy}"
    "GET /api/coverage/{proxy+}" = "/api/v1/coverage/{proxy}"
    "GET /api/geo/{proxy+}"     = "/api/v1/geo/{proxy}"
  }

  protected_routes = {
    "ANY /api/publisher/{proxy+}" = "/api/v1/publisher/{proxy}"
    "ANY /api/admin/{proxy+}"     = "/api/v1/admin/{proxy}"
    "ANY /api/{proxy+}"           = "/api/v1/{proxy}"
  }
}

resource "aws_apigatewayv2_route" "public" {
  for_each = local.public_routes

  api_id    = aws_apigatewayv2_api.zmanim.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.ec2.id}"
}

resource "aws_apigatewayv2_route" "protected" {
  for_each = local.protected_routes

  api_id             = aws_apigatewayv2_api.zmanim.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.ec2.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.clerk.id
}
```

### 2.6 EC2 Compute

| Resource | Terraform Resource | Configuration |
|----------|-------------------|---------------|
| EC2 Instance | `aws_instance` | m7g.medium ARM64 |
| EBS Data Volume | `aws_ebs_volume` | 30GB gp3, persistent |
| Volume Attachment | `aws_volume_attachment` | /dev/sdf |
| EIP Association | `aws_eip_association` | Links EIP |
| IAM Role | `aws_iam_role` | EC2 service principal |
| Instance Profile | `aws_iam_instance_profile` | Attached to instance |

```hcl
resource "aws_iam_role" "ec2" {
  name = "zmanim-instance-role-prod"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name    = "zmanim-instance-role"
    Project = "zmanim"
  }
}

resource "aws_iam_instance_profile" "ec2" {
  name = "zmanim-instance-profile-prod"
  role = aws_iam_role.ec2.name
}

# Managed policies
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Custom policy for S3, SSM, SES, CloudWatch
resource "aws_iam_role_policy" "custom" {
  name = "zmanim-custom-policy"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*",
          aws_s3_bucket.releases.arn,
          "${aws_s3_bucket.releases.arn}/*"
        ]
      },
      {
        Sid    = "SSMAccess"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:eu-west-1:*:parameter/zmanim/prod/*"
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = "kms:Decrypt"
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.eu-west-1.amazonaws.com"
          }
        }
      },
      {
        Sid    = "SESSend"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "ZmanimApp"
          }
        }
      }
    ]
  })
}

# EC2 Instance
resource "aws_instance" "api" {
  ami                    = data.aws_ssm_parameter.ami_id.value
  instance_type          = "m7g.medium"
  subnet_id              = local.public_subnet_id
  vpc_security_group_ids = [aws_security_group.zmanim_ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  monitoring             = true

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 10
    encrypted             = true
    delete_on_termination = true
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -ex
    exec > /var/log/user-data.log 2>&1

    # Wait for NVMe device
    while [ ! -e /dev/nvme1n1 ]; do sleep 1; done

    # Format if needed
    if ! blkid /dev/nvme1n1; then
      mkfs.ext4 -L zmanim-data /dev/nvme1n1
    fi

    # Mount
    mkdir -p /data
    echo 'LABEL=zmanim-data /data ext4 defaults,nofail 0 2' >> /etc/fstab
    mount -a

    # Create directories
    mkdir -p /data/postgres /data/redis
    chown 999:999 /data/postgres
    chmod 700 /data/postgres
    chown 999:999 /data/redis
    chmod 750 /data/redis
  EOF
  )

  tags = {
    Name    = "zmanim-api-prod"
    Project = "zmanim"
  }

  lifecycle {
    ignore_changes = [ami]
  }
}

# Persistent data volume
resource "aws_ebs_volume" "data" {
  availability_zone = local.public_subnet_az
  size              = 30
  type              = "gp3"
  iops              = 3000
  throughput        = 125
  encrypted         = true

  tags = {
    Name    = "zmanim-data-prod"
    Project = "zmanim"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.api.id
}

resource "aws_eip_association" "api" {
  instance_id   = aws_instance.api.id
  allocation_id = aws_eip.zmanim.id
}
```

### 2.7 Route53 Record (origin-api)

```hcl
# Direct access to API (bypasses CloudFront)
resource "aws_route53_record" "origin_api" {
  zone_id = local.hosted_zone_id
  name    = "origin-api.zmanim"
  type    = "A"
  ttl     = 300
  records = [aws_eip.zmanim.public_ip]
}
```

### 2.8 Health Check & Alarm (us-east-1)

```hcl
resource "aws_route53_health_check" "api" {
  fqdn              = "origin-api.zmanim.shtetl.io"
  port              = 8080
  type              = "HTTP"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name    = "zmanim-api-health-prod"
    Project = "zmanim"
  }
}

resource "aws_sns_topic" "api_alerts" {
  provider     = aws.us_east_1
  name         = "zmanim-api-alerts-prod"
  display_name = "Zmanim API Health Alerts"

  tags = {
    Name    = "zmanim-api-alerts"
    Project = "zmanim"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_health" {
  provider            = aws.us_east_1
  alarm_name          = "zmanim-api-health-prod"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.api.id
  }

  alarm_actions = [aws_sns_topic.api_alerts.arn]
  ok_actions    = [aws_sns_topic.api_alerts.arn]

  tags = {
    Name    = "zmanim-api-health-alarm"
    Project = "zmanim"
  }
}
```

### 2.9 ACM Certificate (us-east-1)

```hcl
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_acm_certificate" "cloudfront" {
  provider          = aws.us_east_1
  domain_name       = "zmanim.shtetl.io"
  validation_method = "DNS"

  tags = {
    Name    = "zmanim-cloudfront-cert"
    Project = "zmanim"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cloudfront.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = local.hosted_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}
```

### 2.10 CloudFront + Next.js Lambda (OpenNext)

Uses [OpenNext](https://open-next.js.org/) for Next.js AWS deployment with **global performance optimization** via CloudFront edge caching and S3 static asset distribution.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CloudFront (Global Edge)                     │
│              PriceClass_All - All edge locations worldwide           │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│ │ /_next/static/* │  │    /* (SSR)     │  │   /api/* (backend)  │  │
│ │   S3 Origin     │  │  Lambda@Edge    │  │   API Gateway       │  │
│ │   (cached 1yr)  │  │  (eu-west-1)    │  │   → EC2             │  │
│ └─────────────────┘  └─────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Global Performance Strategy

| Content Type | Origin | Cache TTL | Notes |
|--------------|--------|-----------|-------|
| `/_next/static/*` | S3 | 1 year | Immutable, hashed filenames |
| `/images/*` | S3 | 1 week | Next.js Image Optimization |
| `/*.html`, `/` | Lambda@Edge | 0-60s | ISR/SSR with stale-while-revalidate |
| `/api/*` | API Gateway | varies | See zmanim cache policy |

#### OpenNext CDKTF Example

```typescript
import { OpenNextConstruct } from "./constructs/opennext";

// In zmanim-prod.ts stack
new OpenNextConstruct(this, "nextjs", {
  buildOutputPath: "../web/.open-next",
  domain: "zmanim.shtetl.io",
  certificateArn: certificate.arn,
  hostedZoneId: common.outputs.hostedZoneId,

  // Global optimization settings
  cloudfront: {
    priceClass: "PriceClass_All",  // All edge locations

    // Static assets - immutable, max cache
    staticAssetsCacheTtl: Duration.days(365),

    // ISR pages - short cache with revalidation
    defaultCacheTtl: Duration.seconds(60),

    // Enable compression
    compress: true,
  },

  // Additional origins for API
  additionalOrigins: [{
    domainName: apiGateway.apiEndpoint.replace("https://", ""),
    originId: "api",
    pathPattern: "/api/*",
  }],
});
```

#### S3 Static Asset Bucket

```hcl
# Static assets bucket for Next.js
resource "aws_s3_bucket" "static_assets" {
  bucket = "zmanim-static-prod"

  tags = {
    Name    = "zmanim-static-prod"
    Project = "zmanim"
  }
}

# Enable CORS for web fonts
resource "aws_s3_bucket_cors_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://zmanim.shtetl.io"]
    max_age_seconds = 86400
  }
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "static_assets" {
  name                              = "zmanim-static-oac"
  description                       = "OAC for static assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
```

#### Manual CloudFront Configuration (Alternative)

```hcl
# Cache policy for zmanim API
resource "aws_cloudfront_cache_policy" "zmanim_api" {
  name        = "zmanim-api-cache"
  default_ttl = 3600
  max_ttl     = 86400
  min_ttl     = 60

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Accept-Language"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Origin request policy for API
resource "aws_cloudfront_origin_request_policy" "api" {
  name = "zmanim-api-origin-request"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Accept", "Accept-Language", "Content-Type", "X-Publisher-Id", "X-Request-Id", "Origin", "Referer"]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

# Security headers policy
resource "aws_cloudfront_response_headers_policy" "security" {
  name = "zmanim-security-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    content_type_options {
      override = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }
}

# CloudFront distribution (manual setup - full config omitted for brevity)
# See terraform-aws-next module for easier setup
```

### 2.11 Route53 Record (zmanim.shtetl.io)

```hcl
# Main domain alias to CloudFront
resource "aws_route53_record" "main" {
  zone_id = local.hosted_zone_id
  name    = "zmanim"
  type    = "A"

  alias {
    name                   = module.nextjs.cloudfront_distribution_domain_name
    zone_id                = module.nextjs.cloudfront_distribution_hosted_zone_id
    evaluate_target_health = false
  }
}
```

### 2.12 Frontend Health Check (optional)

```hcl
# Health check for the full site (through CloudFront)
resource "aws_route53_health_check" "frontend" {
  fqdn              = "zmanim.shtetl.io"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/"
  failure_threshold = 3
  request_interval  = 30
  enable_sni        = true

  tags = {
    Name    = "zmanim-frontend-health-prod"
    Project = "zmanim"
  }
}

resource "aws_sns_topic" "frontend_alerts" {
  provider     = aws.us_east_1
  name         = "zmanim-frontend-alerts-prod"
  display_name = "Zmanim Frontend Health Alerts"

  tags = {
    Name    = "zmanim-frontend-alerts"
    Project = "zmanim"
  }
}

resource "aws_cloudwatch_metric_alarm" "frontend_health" {
  provider            = aws.us_east_1
  alarm_name          = "zmanim-frontend-health-prod"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.frontend.id
  }

  alarm_actions = [aws_sns_topic.frontend_alerts.arn]
  ok_actions    = [aws_sns_topic.frontend_alerts.arn]

  tags = {
    Name    = "zmanim-frontend-health-alarm"
    Project = "zmanim"
  }
}
```

### 2.13 Zmanim Stack Outputs

```hcl
# API Outputs
output "api_gateway_endpoint" {
  value       = aws_apigatewayv2_api.zmanim.api_endpoint
  description = "API Gateway endpoint URL"
}

output "api_gateway_id" {
  value       = aws_apigatewayv2_api.zmanim.id
  description = "API Gateway ID"
}

output "elastic_ip" {
  value       = aws_eip.zmanim.public_ip
  description = "EC2 Elastic IP"
}

output "instance_id" {
  value       = aws_instance.api.id
  description = "EC2 instance ID"
}

output "health_check_id" {
  value       = aws_route53_health_check.api.id
  description = "Route53 API health check ID"
}

output "origin_api_url" {
  value       = "http://origin-api.zmanim.shtetl.io:8080"
  description = "Direct API URL (bypasses CloudFront)"
}

# Frontend Outputs
output "cloudfront_distribution_id" {
  value       = module.nextjs.cloudfront_distribution_id
  description = "CloudFront distribution ID"
}

output "cloudfront_domain_name" {
  value       = module.nextjs.cloudfront_distribution_domain_name
  description = "CloudFront distribution domain name"
}

output "website_url" {
  value       = "https://zmanim.shtetl.io"
  description = "Public website URL"
}

output "certificate_arn" {
  value       = aws_acm_certificate.cloudfront.arn
  description = "ACM certificate ARN"
}
```

---

## Phase 4: Deployment Strategy (Clean Slate)

**Status:** CloudFormation stacks have been deleted from AWS. The `infrastructure-1/` CDK code has been removed from the repository. We are deploying fresh infrastructure with CDKTF.

**Exception:** Route53 hosted zone and records will be imported (not recreated) to preserve nameservers and existing DNS records.

### Step 1: ~~Delete Existing CloudFormation Stacks~~ ✅ DONE

CloudFormation stacks have already been deleted:
- ~~ZmanimGitHubOidc~~
- ~~ZmanimProdNetwork~~
- ~~ZmanimProdCompute~~
- ~~ZmanimProdCDN~~
- ~~ZmanimProdDNS~~
- ~~ZmanimProdNextjs~~

The `infrastructure-1/` folder has been deleted from the repository.

### Step 2: Bootstrap Shtetl Common Stack (Local State)

The state bucket is part of the common stack, so we bootstrap with local state first:

```bash
cd infrastructure-common
cdktf synth
cd cdktf.out/stacks/shtetl-common

# Ensure backend "s3" block is COMMENTED OUT in the generated code
# (CDKTF should generate it commented by default for bootstrap)

# Initialize with local state
terraform init

# Plan - review all resources to be created
terraform plan

# Apply - creates ALL common resources including state bucket
terraform apply

# Note the Route53 name servers from output!
# You'll need to update these at your domain registrar
```

### Step 3: Migrate State to S3

Once the `shtetl-tf` bucket exists, migrate the local state to S3:

```bash
# 1. Uncomment the backend "s3" block in the generated Terraform code
#    Edit: cdktf.out/stacks/shtetl-common/cdk.tf (or main.tf)
#
#    terraform {
#      backend "s3" {
#        bucket       = "shtetl-tf"
#        key          = "shtetl-common/terraform.tfstate"
#        region       = "eu-west-1"
#        encrypt      = true
#        use_lockfile = true
#      }
#    }

# 2. Run migration
terraform init -migrate-state

# Terraform will prompt:
# "Do you want to copy existing state to the new backend?"
# Answer: yes

# 3. Verify migration succeeded
aws s3 ls s3://shtetl-tf/shtetl-common/
# Should show: terraform.tfstate

# 4. Delete local state files (now safely in S3)
rm -f terraform.tfstate terraform.tfstate.backup

# 5. Verify Terraform still works
terraform plan
# Should show: No changes
```

### Step 4: Update Domain Name Servers

If Route53 created a NEW hosted zone, update your domain registrar:

```bash
# Get name servers from Terraform output
cd cdktf.out/stacks/shtetl-common
terraform output hosted_zone_name_servers

# Output will look like:
# [
#   "ns-123.awsdns-45.com",
#   "ns-678.awsdns-90.net",
#   "ns-111.awsdns-22.org",
#   "ns-333.awsdns-44.co.uk"
# ]

# Update these at your domain registrar (e.g., GoDaddy, Namecheap, etc.)
# DNS propagation can take up to 48 hours
```

### Step 5: Deploy Zmanim Stack

Now that the common stack is in S3, deploy the Zmanim stack:

```bash
cd infrastructure
cdktf synth
cd cdktf.out/stacks/zmanim-prod

# Zmanim stack uses S3 backend from the start
terraform init

# Plan - review all Zmanim resources
terraform plan

# Apply - creates ALL Zmanim resources
terraform apply

# This creates:
# - EC2 instance + EBS volume
# - API Gateway
# - CloudFront + Lambda (Next.js)
# - S3 buckets
# - Route53 records
# - Health checks + alarms
```

### Step 6: Post-Deployment Setup

```bash
# 1. Create SSM parameters (secrets)
aws ssm put-parameter --name /zmanim/prod/postgres-password --value "YOUR_PASSWORD" --type SecureString
aws ssm put-parameter --name /zmanim/prod/redis-password --value "YOUR_PASSWORD" --type SecureString
aws ssm put-parameter --name /zmanim/prod/clerk-secret-key --value "YOUR_KEY" --type SecureString
aws ssm put-parameter --name /zmanim/prod/clerk-publishable-key --value "YOUR_KEY" --type SecureString
aws ssm put-parameter --name /zmanim/prod/clerk-domain --value "YOUR_DOMAIN" --type String
aws ssm put-parameter --name /zmanim/prod/clerk-audience --value "YOUR_AUDIENCE" --type String
aws ssm put-parameter --name /zmanim/prod/restic-password --value "YOUR_PASSWORD" --type SecureString
aws ssm put-parameter --name /zmanim/prod/origin-verify-key --value "$(openssl rand -hex 32)" --type SecureString

# 2. Build and push AMI (via GitHub Actions or manually)
# This updates /zmanim/prod/ami-id parameter

# 3. Subscribe to health check SNS topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:zmanim-health-alerts-prod \
  --protocol email \
  --notification-endpoint your-email@example.com

# 4. Verify deployment
curl -I https://zmanim.shtetl.io/api/health
```

### Step 7: Verify Everything

```bash
# 1. Verify both stacks show no changes
cd infrastructure-common/cdktf.out/stacks/shtetl-common && terraform plan
cd infrastructure/cdktf.out/stacks/zmanim-prod && terraform plan

# 2. Verify state files exist in S3
aws s3 ls s3://shtetl-tf/ --recursive
# shtetl-common/terraform.tfstate
# zmanim-prod/terraform.tfstate

# 3. Test infrastructure
curl -I https://zmanim.shtetl.io/api/health
curl https://zmanim.shtetl.io/api/health

# 4. Check CloudFront distribution
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName,Aliases.Items[0]]'

# 5. Check EC2 instance
aws ec2 describe-instances --filters "Name=tag:Name,Values=zmanim-api-prod" --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PublicIpAddress]'
```

### Step 8: Archive Old Infrastructure Code

```bash
# Move old CDK code to archive
mv infrastructure-1 infrastructure-cdk-archive

# Or delete it entirely
rm -rf infrastructure-1

# Update .gitignore if needed
echo "infrastructure-cdk-archive/" >> .gitignore
```

---

## Phase 5: CI/CD Updates

### GitHub Actions Workflow

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'infrastructure-common/**'
      - 'infrastructure/**'
  workflow_dispatch:
    inputs:
      stack:
        description: 'Stack to deploy'
        required: true
        default: 'all'
        type: choice
        options:
          - all
          - shtetl-common
          - zmanim-prod

permissions:
  id-token: write
  contents: read

jobs:
  deploy-common:
    if: github.event.inputs.stack == 'all' || github.event.inputs.stack == 'shtetl-common'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/github-actions-deploy
          aws-region: eu-west-1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: infrastructure-common/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: infrastructure-common

      - name: CDKTF Synth
        run: npx cdktf synth
        working-directory: infrastructure-common

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Deploy Shtetl Common
        working-directory: infrastructure-common/cdktf.out/stacks/shtetl-common
        run: |
          terraform init
          terraform plan -out=tfplan
          terraform apply -auto-approve tfplan

  deploy-zmanim:
    if: github.event.inputs.stack == 'all' || github.event.inputs.stack == 'zmanim-prod'
    needs: [deploy-common]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/github-actions-deploy
          aws-region: eu-west-1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: infrastructure/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: infrastructure

      - name: CDKTF Synth
        run: npx cdktf synth
        working-directory: infrastructure

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Deploy Zmanim
        working-directory: infrastructure/cdktf.out/stacks/zmanim-prod
        run: |
          terraform init
          terraform plan -out=tfplan
          terraform apply -auto-approve tfplan
```

---

## Phase 6: GitHub Actions Workflow Migration

This section documents which existing GitHub Actions workflows need to be **replaced**, **modified**, or **kept unchanged** when migrating from CDK to CDKTF.

### Workflow Migration Summary

| Workflow | Current Purpose | Action | Notes |
|----------|-----------------|--------|-------|
| `deploy-prod-infrastructure.yml` | Deploy CDK stacks | **REPLACE** | New CDKTF/Terraform workflow |
| `deploy-prod-frontend.yml` | Deploy Next.js via CDK | **REPLACE** | New Terraform-based frontend deploy |
| `build-prod-ami.yml` | Build Packer AMI | **MODIFY** | Update paths only |
| `deploy-prod-backend.yml` | Deploy Go API binary | **KEEP** | No CDK dependency |

---

### 6.1 REPLACE: `deploy-prod-infrastructure.yml`

**Current:** Deploys ALL AWS infrastructure via CDK (`npx cdk deploy --all`)

**New Workflow:** `deploy-prod-infrastructure.yml` (replacement)

```yaml
name: Deploy Prod Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'infrastructure-common/**'
      - 'infrastructure/**'
  workflow_dispatch:
    inputs:
      stack:
        description: 'Stack to deploy'
        required: true
        default: 'all'
        type: choice
        options:
          - all
          - shtetl-common
          - zmanim-prod

env:
  AWS_REGION: eu-west-1
  TF_VERSION: '1.10'

permissions:
  id-token: write
  contents: read

concurrency:
  group: prod-terraform-deploy
  cancel-in-progress: false

jobs:
  synth-common:
    name: CDKTF Synth (Common)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: infrastructure-common/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: infrastructure-common

      - name: CDKTF Synth
        run: npx cdktf synth
        working-directory: infrastructure-common

      - name: Upload synthesized stacks
        uses: actions/upload-artifact@v4
        with:
          name: cdktf-out-common
          path: infrastructure-common/cdktf.out
          retention-days: 7

  synth-zmanim:
    name: CDKTF Synth (Zmanim)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: infrastructure/package-lock.json

      - name: Install web dependencies
        run: npm ci
        working-directory: web

      - name: Install infrastructure dependencies
        run: npm ci
        working-directory: infrastructure

      - name: CDKTF Synth
        run: npx cdktf synth
        working-directory: infrastructure
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.PROD_CLERK_PUBLISHABLE_KEY }}
          NEXT_PUBLIC_API_URL: https://zmanim.shtetl.io
          CLERK_SECRET_KEY: ${{ secrets.PROD_CLERK_SECRET_KEY }}

      - name: Upload synthesized stacks
        uses: actions/upload-artifact@v4
        with:
          name: cdktf-out-zmanim
          path: infrastructure/cdktf.out
          retention-days: 7

  deploy-common:
    name: Deploy Shtetl Common
    needs: synth-common
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push' ||
      github.event.inputs.stack == 'all' ||
      github.event.inputs.stack == 'shtetl-common'
    environment: production-common

    steps:
      - name: Download synthesized stacks
        uses: actions/download-artifact@v4
        with:
          name: cdktf-out-common
          path: cdktf.out

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          role-session-name: github-actions-terraform-common
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Init
        working-directory: cdktf.out/stacks/shtetl-common
        run: terraform init

      - name: Terraform Plan
        working-directory: cdktf.out/stacks/shtetl-common
        run: terraform plan -out=tfplan

      - name: Terraform Apply
        working-directory: cdktf.out/stacks/shtetl-common
        run: terraform apply -auto-approve tfplan

  deploy-zmanim:
    name: Deploy Zmanim Prod
    needs: [deploy-common, synth-zmanim]
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push' ||
      github.event.inputs.stack == 'all' ||
      github.event.inputs.stack == 'zmanim-prod'
    environment: production

    steps:
      - name: Download synthesized stacks
        uses: actions/download-artifact@v4
        with:
          name: cdktf-out-zmanim
          path: cdktf.out

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          role-session-name: github-actions-terraform-zmanim
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Init
        working-directory: cdktf.out/stacks/zmanim-prod
        run: terraform init

      - name: Terraform Plan
        working-directory: cdktf.out/stacks/zmanim-prod
        run: terraform plan -out=tfplan

      - name: Terraform Apply
        working-directory: cdktf.out/stacks/zmanim-prod
        run: terraform apply -auto-approve tfplan

      - name: Deployment summary
        run: |
          echo "## Deployment Complete" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Region:** ${{ env.AWS_REGION }}" >> $GITHUB_STEP_SUMMARY
          echo "**Commit:** ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### URLs:" >> $GITHUB_STEP_SUMMARY
          echo "- Site: https://zmanim.shtetl.io" >> $GITHUB_STEP_SUMMARY
          echo "- API Health: https://zmanim.shtetl.io/api/health" >> $GITHUB_STEP_SUMMARY
```

**Key Changes:**
- Uses `cdktf synth` instead of `cdk synth`
- Deploys via `terraform apply` instead of `cdk deploy`
- Two-stage deployment: common stack first, then zmanim stack
- Separate GitHub environment for common stack (`production-common`)
- Requires Terraform 1.10+ for S3 native locking

---

### 6.2 REPLACE: `deploy-prod-frontend.yml`

**Current:** Deploys Next.js via CDK (`npx cdk deploy ZmanimProdNextjs`)

**Recommendation:** Merge into `deploy-prod-infrastructure.yml` above

The current workflow is separate because CDK allowed deploying individual stacks. With CDKTF, the Next.js deployment is part of the `zmanim-prod` stack, so a separate workflow isn't needed.

**Alternative:** If you want a fast frontend-only deploy (skip common stack):

```yaml
name: Deploy Prod Frontend

on:
  push:
    branches: [main]
    paths:
      - 'web/**'
  workflow_dispatch:

env:
  AWS_REGION: eu-west-1
  TF_VERSION: '1.10'

permissions:
  id-token: write
  contents: read

concurrency:
  group: prod-terraform-deploy
  cancel-in-progress: false

jobs:
  deploy-frontend:
    name: Deploy Next.js
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: |
            web/package-lock.json
            infrastructure/package-lock.json

      - name: Install web dependencies
        run: npm ci
        working-directory: web

      - name: Install infrastructure dependencies
        run: npm ci
        working-directory: infrastructure

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          role-session-name: github-actions-terraform-frontend
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: CDKTF Synth
        working-directory: infrastructure
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.PROD_CLERK_PUBLISHABLE_KEY }}
          NEXT_PUBLIC_API_URL: https://zmanim.shtetl.io
          CLERK_SECRET_KEY: ${{ secrets.PROD_CLERK_SECRET_KEY }}
        run: npx cdktf synth

      - name: Terraform Init & Apply (Zmanim only)
        working-directory: infrastructure/cdktf.out/stacks/zmanim-prod
        run: |
          terraform init
          terraform apply -auto-approve -target=module.nextjs
```

**Note:** The `-target` flag limits the apply to just the Next.js module, making frontend deploys faster.

---

### 6.3 MODIFY: `build-prod-ami.yml`

**Current:** Builds Go API binary, runs Packer to create AMI, stores AMI ID in SSM

**Action:** Keep workflow, update Packer path

The Packer workflow doesn't depend on CDK - it uses Packer directly. Only the file paths need updating if we move Packer files.

**Changes Required:**

| Current Path | New Path |
|--------------|----------|
| `infrastructure/packer/` | `infrastructure/packer/` (no change - stays in zmanim infrastructure) |

The Packer files remain in the `infrastructure/` folder (zmanim project) since they build the zmanim-specific AMI.

**No path changes needed** - the current `infrastructure/packer/` path is correct for the new structure.

---

### 6.4 KEEP: `deploy-prod-backend.yml`

**Current:** Builds Go API binary, uploads to S3, triggers EC2 restart via SSM

**Action:** No changes required

This workflow doesn't use CDK at all. It:
1. Builds the Go binary
2. Uploads to S3 (`zmanim-releases-prod`)
3. Runs SSM command to restart the API service on EC2

All of these are infrastructure-agnostic. The S3 bucket and EC2 instance will exist whether provisioned by CDK or Terraform.

---

### 6.5 Workflow Migration Checklist

- [ ] Create new `deploy-prod-infrastructure.yml` (Terraform-based)
- [ ] Delete or archive old CDK-based `deploy-prod-infrastructure.yml`
- [ ] Create/update `deploy-prod-frontend.yml` (Terraform-based, optional)
- [ ] Verify `build-prod-ami.yml` works (paths unchanged: `infrastructure/packer/`)
- [ ] Verify `deploy-prod-backend.yml` still works (no changes expected)
- [ ] Create new GitHub environment `production-common` for common stack
- [ ] Test all workflows in order:
  1. `deploy-prod-infrastructure.yml` (full deploy)
  2. `build-prod-ami.yml` (build new AMI)
  3. `deploy-prod-frontend.yml` (frontend-only if separate)
  4. `deploy-prod-backend.yml` (API deploy)

---

### 6.6 GitHub Secrets (No Changes)

The existing secrets remain the same:

| Secret | Purpose |
|--------|---------|
| `AWS_ACCOUNT_ID` | AWS account ID |
| `AWS_DEPLOY_ROLE_ARN` | IAM role for OIDC authentication |
| `PROD_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `PROD_CLERK_SECRET_KEY` | Clerk secret key |

### 6.7 SSM Parameters (Service Configuration)

All runtime configuration for services is stored in AWS SSM Parameter Store. These parameters are read by the EC2 instance and referenced by CDKTF for API Gateway configuration.

| Parameter | Type | Purpose |
|-----------|------|---------|
| `/zmanim/prod/postgres-password` | SecureString | PostgreSQL database password |
| `/zmanim/prod/redis-password` | SecureString | Redis cache password |
| `/zmanim/prod/clerk-secret-key` | SecureString | Clerk secret key (backend) |
| `/zmanim/prod/clerk-publishable-key` | String | Clerk publishable key |
| `/zmanim/prod/clerk-domain` | String | Clerk domain for JWT issuer |
| `/zmanim/prod/clerk-audience` | String | Clerk audience for JWT validation |
| `/zmanim/prod/restic-password` | SecureString | Backup encryption password |
| `/zmanim/prod/origin-verify-key` | SecureString | API Gateway → EC2 verification header |
| `/zmanim/prod/jwt-secret` | SecureString | JWT signing secret |
| `/zmanim/prod/ami-id` | String | Current AMI ID (updated by Packer build) |

**Important:** These parameters must exist before deploying the Zmanim stack, as they are referenced during `terraform plan`/`apply`. Create them during initial setup:

```bash
# Create SSM parameters (one-time setup)
aws ssm put-parameter --name /zmanim/prod/postgres-password --value "YOUR_PASSWORD" --type SecureString
aws ssm put-parameter --name /zmanim/prod/redis-password --value "YOUR_PASSWORD" --type SecureString
aws ssm put-parameter --name /zmanim/prod/clerk-secret-key --value "sk_live_..." --type SecureString
aws ssm put-parameter --name /zmanim/prod/clerk-publishable-key --value "pk_live_..." --type String
aws ssm put-parameter --name /zmanim/prod/clerk-domain --value "your-clerk-domain.clerk.accounts.dev" --type String
aws ssm put-parameter --name /zmanim/prod/clerk-audience --value "your-audience" --type String
aws ssm put-parameter --name /zmanim/prod/restic-password --value "YOUR_BACKUP_PASSWORD" --type SecureString
aws ssm put-parameter --name /zmanim/prod/origin-verify-key --value "$(openssl rand -hex 32)" --type SecureString
aws ssm put-parameter --name /zmanim/prod/jwt-secret --value "$(openssl rand -hex 32)" --type SecureString
aws ssm put-parameter --name /zmanim/prod/ami-id --value "ami-placeholder" --type String
```

---

## Phase 7: Iterative Development Approach

**DO NOT scaffold the entire infrastructure at once.** Build incrementally, deploy, fix issues, repeat.

### Development Cycles

Each cycle follows this pattern:
```
Code (1-3 resources) → Deploy → Verify → Fix issues → Next cycle
```

### Shtetl Common Stack - Build Order

| Cycle | Resources | Verify |
|-------|-----------|--------|
| **1** | S3 state bucket only | `aws s3 ls s3://shtetl-tf/` |
| **2** | Migrate state to S3 | `terraform plan` shows no changes |
| **3** | Route53 zone import | Zone imported, `terraform plan` clean |
| **4** | Route53 records import | All records imported, no drift |
| **5** | VPC + Subnet + IGW | VPC appears in console |
| **6** | Route tables + S3 endpoint | `terraform plan` clean |
| **7** | GitHub OIDC provider | OIDC auth works from Actions |
| **8** | Stack outputs | Outputs visible via `terraform output` |

### Zmanim Stack (`zmanim-prod`) - Build Order

| Cycle | Resources | Verify |
|-------|-----------|--------|
| **1** | Remote state data source | Can read common stack outputs |
| **2** | S3 buckets (backups, releases, static-assets) | Buckets exist, encryption enabled |
| **3** | Security group | SG created in correct VPC |
| **4** | IAM role + instance profile | Role appears in console |
| **5** | Elastic IP | EIP allocated |
| **6** | EC2 instance + EBS volume | Instance running, volume attached |
| **7** | EIP association | Instance has correct public IP |
| **8** | SSM parameter data sources | Parameters readable |
| **9** | API Gateway (API + stage) | API endpoint responds |
| **10** | API Gateway authorizer | JWT auth works |
| **11** | API Gateway integration | Requests reach EC2 |
| **12** | API Gateway routes (public) | Public endpoints work |
| **13** | API Gateway routes (protected) | Auth-required endpoints work |
| **14** | Route53 record (origin-api.zmanim) | Direct API access works via DNS |
| **15** | Health check + alarm + SNS | Health check passes, alerts work |

**⚡ MILESTONE: API is fully functional at this point**
- Direct access: `http://origin-api.zmanim.shtetl.io:8080`
- Via API Gateway: API Gateway endpoint URL
- Can stop here if frontend not needed yet

| Cycle | Resources | Verify |
|-------|-----------|--------|
| **16** | ACM certificate (us-east-1) | Cert issued and validated |
| **17** | OpenNext build + S3 static assets | Static assets uploaded |
| **18** | Lambda function (SSR) | Lambda deployed |

**⚡ MILESTONE: Next.js Lambda is functional standalone**
- Can invoke Lambda directly for testing
- Static assets accessible from S3
- Not yet behind CloudFront

| Cycle | Resources | Verify |
|-------|-----------|--------|
| **19** | CloudFront distribution + OAC | Distribution created, S3 OAC configured |
| **20** | CloudFront cache policies | Correct caching for static (1yr) vs dynamic |
| **21** | CloudFront behaviors | Routing works (`/_next/static/*` → S3, `/*` → Lambda, `/api/*` → API GW) |
| **22** | Route53 record (zmanim.shtetl.io) | `https://zmanim.shtetl.io` works |
| **23** | Verify global performance | Edge caching working, fast worldwide access |

### Target Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                    CloudFront (PriceClass_All - Global)                 │
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│ │ /_next/static/*  │  │ /* (SSR pages)   │  │ /api/* (backend API)   │ │
│ │     S3 Origin    │  │  Lambda (SSR)    │  │   API Gateway → EC2    │ │
│ │  (cached 1 year) │  │  (OpenNext)      │  │   (JWT auth)           │ │
│ └──────────────────┘  └──────────────────┘  └────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

The phased approach allows:
- **API can go live first** (milestone at cycle 15) for testing
- **Next.js Lambda testable independently** (milestone at cycle 18) before CloudFront
- **Easier debugging** - isolate issues to specific components
- **Global performance verification** (cycle 23) - ensure edge caching works

### Why Iterative?

1. **Catch errors early** - A typo in cycle 3 is easier to fix than in cycle 19
2. **Understand dependencies** - See what Terraform actually creates
3. **Avoid state corruption** - Smaller changes = easier rollback
4. **Learn CDKTF patterns** - Build muscle memory incrementally
5. **Faster debugging** - When something breaks, you know what changed

### Example: Cycle 1 (State Bucket)

```typescript
// infrastructure-common/main.ts - ONLY the state bucket, nothing else
import { App } from "cdktf";
import { ShtetlCommonStack } from "./lib/stacks/shtetl-common";

const app = new App();
new ShtetlCommonStack(app, "shtetl-common", {
  // Only enable state bucket for now
  enableStateBucket: true,
  enableVpc: false,
  enableRoute53: false,
  enableGitHubOidc: false,
});
app.synth();
```

```bash
# Deploy cycle 1
cd infrastructure-common
npx cdktf synth
cd cdktf.out/stacks/shtetl-common
terraform init
terraform plan   # Review: should show only S3 bucket + related resources
terraform apply

# Verify
aws s3 ls s3://shtetl-tf/
# Success? → Move to cycle 2
# Error? → Fix, redeploy, verify again
```

### Example: Cycle 2 (Migrate State)

```bash
# Edit the generated Terraform to add backend config
# Then migrate:
terraform init -migrate-state
# Answer "yes" to copy state

# Verify
terraform plan  # Should show: No changes
aws s3 ls s3://shtetl-tf/shtetl-common/  # Should show terraform.tfstate

# Success? → Move to cycle 3
```

### Handling Failures

When a cycle fails:

1. **Read the error** - Terraform errors are usually clear
2. **Check AWS Console** - See what actually got created
3. **Fix the code** - Update CDKTF TypeScript
4. **Re-synth** - `cdktf synth`
5. **Plan again** - `terraform plan` to see if fix works
6. **Apply** - `terraform apply`
7. **Don't proceed** until current cycle is green

### Time Estimates Per Cycle

| Cycle Type | Typical Time |
|------------|--------------|
| Simple (1 resource) | 5-10 min |
| Medium (2-3 resources) | 15-30 min |
| Complex (API Gateway, CloudFront) | 30-60 min |
| Import (Route53) | 30-60 min |

**Total estimated time:** 2-3 days of focused work, not hours.

---

## Phase 8: Testing Checklist

Before declaring migration complete:

- [ ] Shtetl Common stack deployed and outputs available
- [ ] Zmanim stack references common stack correctly
- [ ] Route53 zone and all records imported
- [ ] `terraform plan` shows no changes on both stacks
- [ ] API endpoints respond correctly
- [ ] CloudFront distribution working
- [ ] Health checks passing
- [ ] Alarms configured and tested
- [ ] GitHub Actions deploy works
- [ ] SSM parameters accessible
- [ ] EC2 can access S3 buckets
- [ ] DNS resolves correctly

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Import misses resources | Resources not tracked | Thorough inventory before import |
| State corruption | Infrastructure drift | Enable S3 versioning, S3 native locking |
| Cross-stack dependency issues | Deploy failures | Deploy common stack first, verify outputs |
| Downtime during migration | User impact | Import existing (no recreation) |
| Next.js Lambda complexity | Build failures | Test with terraform-aws-next module first |

---

## Resource Summary

| Stack | Resources | State Key |
|-------|-----------|-----------|
| **Shtetl Common** (`infrastructure-common/`) | State Bucket, VPC, Subnet, IGW, S3 Endpoint, Route53 Zone (imported), GitHub OIDC | `shtetl-common/terraform.tfstate` |
| **Zmanim Prod** (`infrastructure/`) | EC2, EBS, EIP, API Gateway, CloudFront (global), Lambda (OpenNext), S3 x3 (backups, releases, static), ACM, Health Check, SNS, Alarm, Security Group, IAM | `zmanim-prod/terraform.tfstate` |

---

## References

- [CDKTF Documentation](https://developer.hashicorp.com/terraform/cdktf)
- [AWS Provider for Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest)
- [terraform-aws-next.js](https://github.com/milliHQ/terraform-aws-next.js)
- [Terraform Remote State](https://developer.hashicorp.com/terraform/language/state/remote-state-data)
- [S3 Native State Locking](https://developer.hashicorp.com/terraform/language/settings/backends/s3#s3-state-locking)
