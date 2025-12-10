# Zmanim Lab - AWS Infrastructure

AWS CDK project for Zmanim Lab production infrastructure.

## Environment Strategy

**Production (AWS):** This CDK project deploys to AWS for the production environment.
- Domain: zmanim.shtetl.io
- Region: eu-west-1 (Ireland)
- Infrastructure: EC2 m7g.medium, CloudFront CDN, PostgreSQL + Redis on EC2

**Development (Current Stack):** Development stays on the existing stack:
- API: Fly.io
- Frontend: Vercel
- Database: Xata PostgreSQL
- Cache: Upstash Redis
- Domain: zmanim.shtetl.dev

This separation keeps development costs minimal while production gets optimized AWS infrastructure.

## Stack Architecture

```
DNSStack (us-east-1 for CloudFront certificates)
    ↓
CDNStack → CloudFront, S3 buckets, API Gateway
    ↓
ComputeStack → EC2, EBS volumes, IAM roles
    ↓
NetworkStack → VPC, public subnet, security groups
```

## Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CDK_DEFAULT_ACCOUNT` | Yes* | AWS account ID for deployment |
| `AWS_ACCESS_KEY_ID` | Yes | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS credentials |
| `ADMIN_CIDR` | No | Admin IP CIDR for SSH access |

*For local synthesis without deployment, this can be omitted.

## Commands

```bash
# Install dependencies
npm install

# Synthesize CloudFormation templates (verify without deploying)
npx cdk synth

# Show expected changes
npx cdk diff

# Deploy all stacks (requires AWS credentials)
npx cdk deploy --all

# Deploy specific stack
npx cdk deploy ZmanimProdNetwork

# Destroy all stacks (careful!)
npx cdk destroy --all
```

## Stack Details

### NetworkStack (ZmanimProdNetwork)
- VPC with single public subnet
- No NAT Gateway (Packer AMI handles dependencies)
- Security groups for EC2

### ComputeStack (ZmanimProdCompute)
- EC2 m7g.medium Graviton3 instance
- 10GB root EBS (from AMI, disposable)
- 20GB data EBS (persistent, /data)
- Elastic IP for stable address
- IAM role for S3, SSM, SES access

### CDNStack (ZmanimProdCDN)
- CloudFront distribution with Origin Shield
- S3 buckets: static assets, backups (Restic), releases
- /api/* routes to EC2, /* routes to S3

### DNSStack (ZmanimProdDNS)
- ACM certificate for zmanim.shtetl.io
- Route 53 health check
- (Route 53 hosted zone or external DNS CNAME)

## Related Stories

- Story 7.1: AWS CDK Project Setup (this)
- Story 7.2: Packer AMI Build Pipeline
- Story 7.3: VPC & Network Infrastructure
- Story 7.4: EC2 Instance & EBS Storage
- Story 7.5: S3 Buckets & Restic Backup
- Story 7.6: CloudFront Distribution
- Story 7.7: API Gateway Configuration
- Story 7.8: Route 53 & SSL Certificates
- Story 7.9: SSM Parameter Store Configuration
- Story 7.10: Data Migration & Go-Live

See `/docs/sprint-artifacts/epic-7-aws-migration.md` for full architecture documentation.

## IAM Permissions for CDK Deployment

The IAM user/role running CDK deploy requires permissions for:

**Core CDK Permissions:**
- CloudFormation: `cloudformation:*` (create/update/delete stacks)
- SSM Parameter Store: `ssm:GetParameter` (CDK bootstrap version)
- S3: `s3:*` on CDK staging bucket (asset uploads)

**Infrastructure Permissions:**
- EC2: VPC, Subnets, Security Groups, Instances, EIP, EBS volumes
- S3: Create and manage buckets (static, backups, releases)
- CloudFront: Create and manage distributions
- Route 53: Hosted zones, records, health checks
- ACM: Request and manage certificates
- IAM: Create roles and policies (for EC2 instance role)
- STS: `sts:GetCallerIdentity` (credential verification)

**Minimum Policy (Custom):**
For least-privilege access, create a custom policy with the above permissions.

**Quick Start (Not Recommended for Production):**
For initial testing, you can use `arn:aws:iam::aws:policy/AdministratorAccess`.
Tighten permissions before production use.

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key ID |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret access key |
| `AWS_ACCOUNT_ID` | AWS account ID (12 digits) |
