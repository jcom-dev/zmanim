/**
 * Zmanim Production Stack - Zmanim-specific infrastructure
 *
 * This stack contains:
 * - S3 Buckets (backups, releases, static assets)
 * - Security Group
 * - IAM Role + Instance Profile
 * - Elastic IP + EC2 Instance + EBS Volume
 * - API Gateway (HTTP API + JWT Auth + Routes)
 * - ACM Certificate (us-east-1)
 * - Route53 Records (origin-api, zmanim.shtetl.io)
 * - Health Check + CloudWatch Alarm + SNS
 * - Lambda Functions (Next.js SSR, Image Optimization)
 * - CloudFront Distribution (uses shared policies from shtetl-common)
 *
 * Shared resources from shtetl-common stack:
 * - CloudFront cache policies (static assets, HTML, API)
 * - CloudFront response headers policy (security headers)
 * - CloudFront function (host header forwarding)
 * - CloudFront S3 Origin Access Control
 *
 * State Key: s3://shtetl-tf/zmanim-prod/terraform.tfstate
 */

import { Construct } from "constructs";
import { TerraformStack, TerraformOutput, S3Backend, Fn } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { DataTerraformRemoteStateS3 } from "cdktf";

// S3
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketVersioningA } from "@cdktf/provider-aws/lib/s3-bucket-versioning";
import { S3BucketServerSideEncryptionConfigurationA } from "@cdktf/provider-aws/lib/s3-bucket-server-side-encryption-configuration";
import { S3BucketPublicAccessBlock } from "@cdktf/provider-aws/lib/s3-bucket-public-access-block";
import { S3BucketLifecycleConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-lifecycle-configuration";

// EC2/VPC
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { SecurityGroupRule } from "@cdktf/provider-aws/lib/security-group-rule";
import { Eip } from "@cdktf/provider-aws/lib/eip";
import { Instance } from "@cdktf/provider-aws/lib/instance";
import { EbsVolume } from "@cdktf/provider-aws/lib/ebs-volume";
import { VolumeAttachment } from "@cdktf/provider-aws/lib/volume-attachment";
import { EipAssociation } from "@cdktf/provider-aws/lib/eip-association";

// IAM
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamInstanceProfile } from "@cdktf/provider-aws/lib/iam-instance-profile";
import { IamRolePolicy } from "@cdktf/provider-aws/lib/iam-role-policy";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";

// SSM
import { DataAwsSsmParameter } from "@cdktf/provider-aws/lib/data-aws-ssm-parameter";

// AMI
import { DataAwsAmi } from "@cdktf/provider-aws/lib/data-aws-ami";

// API Gateway
import { Apigatewayv2Api } from "@cdktf/provider-aws/lib/apigatewayv2-api";
import { Apigatewayv2Stage } from "@cdktf/provider-aws/lib/apigatewayv2-stage";
import { Apigatewayv2Authorizer } from "@cdktf/provider-aws/lib/apigatewayv2-authorizer";
import { Apigatewayv2Integration } from "@cdktf/provider-aws/lib/apigatewayv2-integration";
import { Apigatewayv2Route } from "@cdktf/provider-aws/lib/apigatewayv2-route";
import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";

// Route53
import { Route53Record } from "@cdktf/provider-aws/lib/route53-record";
import { Route53HealthCheck } from "@cdktf/provider-aws/lib/route53-health-check";

// ACM
import { AcmCertificate } from "@cdktf/provider-aws/lib/acm-certificate";
import { AcmCertificateValidation } from "@cdktf/provider-aws/lib/acm-certificate-validation";

// CloudWatch/SNS
import { CloudwatchMetricAlarm } from "@cdktf/provider-aws/lib/cloudwatch-metric-alarm";
import { SnsTopic } from "@cdktf/provider-aws/lib/sns-topic";

// CloudFront
import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
// Cache policies, response headers policy, CloudFront function, and OAC are now shared
// from shtetl-common stack. Only the distribution itself is created per-project.
import { S3BucketPolicy } from "@cdktf/provider-aws/lib/s3-bucket-policy";
import { DataAwsCallerIdentity } from "@cdktf/provider-aws/lib/data-aws-caller-identity";

// Lambda
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { LambdaFunctionUrl } from "@cdktf/provider-aws/lib/lambda-function-url";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";

import { ZmanimConfig, ssmPaths } from "../config";

export interface ZmanimProdStackOptions {
  config: ZmanimConfig;
}

export class ZmanimProdStack extends TerraformStack {
  constructor(scope: Construct, id: string, options: ZmanimProdStackOptions) {
    super(scope, id);

    const { config } = options;

    // ==========================================================================
    // Providers
    // ==========================================================================
    new AwsProvider(this, "aws", {
      region: config.region,
      defaultTags: [{ tags: config.defaultTags }],
    });

    // us-east-1 provider for ACM certificate and Route53 health check metrics
    new AwsProvider(this, "aws-us-east-1", {
      alias: "us_east_1",
      region: config.usEast1Region,
      defaultTags: [{ tags: config.defaultTags }],
    });

    // ==========================================================================
    // S3 Backend
    // ==========================================================================
    new S3Backend(this, {
      bucket: config.stateBucketName,
      key: "zmanim-prod/terraform.tfstate",
      region: config.region,
      encrypt: true,
    });

    // ==========================================================================
    // Remote State Reference (Shtetl Common)
    // ==========================================================================
    const commonState = new DataTerraformRemoteStateS3(this, "common", {
      bucket: config.stateBucketName,
      key: "shtetl-common/terraform.tfstate",
      region: config.region,
    });

    const vpcId = commonState.getString("vpc_id");
    const publicSubnetId = commonState.getString("public_subnet_id");
    const publicSubnetAz = commonState.getString("public_subnet_az");
    const hostedZoneId = commonState.getString("hosted_zone_id");

    // Shared CloudFront resources from common stack
    const cfStaticAssetsCachePolicyId = commonState.getString("cf_static_assets_cache_policy_id");
    const cfHtmlCachePolicyId = commonState.getString("cf_html_cache_policy_id");
    const cfApiCachePolicyId = commonState.getString("cf_api_cache_policy_id");
    const cfSecurityHeadersPolicyId = commonState.getString("cf_security_headers_policy_id");
    const cfHostHeaderFunctionArn = commonState.getString("cf_host_header_function_arn");
    const cfS3OacId = commonState.getString("cf_s3_oac_id");

    // ==========================================================================
    // SSM Parameter Data Sources
    // ==========================================================================
    const ssmAmiVersion = new DataAwsSsmParameter(this, "ssm-ami-version", {
      name: ssmPaths.amiVersion,
    });

    // ==========================================================================
    // AMI Lookup by Version Tag (from SSM parameter)
    // ==========================================================================
    const zmanimAmi = new DataAwsAmi(this, "zmanim-ami", {
      mostRecent: true,
      owners: ["self"],
      filter: [
        {
          name: "tag:Version",
          values: [ssmAmiVersion.value],
        },
        {
          name: "tag:ManagedBy",
          values: ["Packer"],
        },
        {
          name: "state",
          values: ["available"],
        },
      ],
    });

    const ssmClerkDomain = new DataAwsSsmParameter(this, "ssm-clerk-domain", {
      name: ssmPaths.clerkDomain,
    });

    const ssmClerkAudience = new DataAwsSsmParameter(this, "ssm-clerk-audience", {
      name: ssmPaths.clerkAudience,
    });

    const ssmOriginVerifyKey = new DataAwsSsmParameter(this, "ssm-origin-verify-key", {
      name: ssmPaths.originVerifyKey,
      withDecryption: true,
    });

    const ssmClerkSecretKey = new DataAwsSsmParameter(this, "ssm-clerk-secret-key", {
      name: ssmPaths.clerkSecretKey,
      withDecryption: true,
    });

    const ssmClerkPublishableKey = new DataAwsSsmParameter(this, "ssm-clerk-publishable-key", {
      name: ssmPaths.clerkPublishableKey,
    });

    // ==========================================================================
    // 2.2 S3 Storage Buckets
    // ==========================================================================
    const backupsBucket = new S3Bucket(this, "backups-bucket", {
      bucket: `zmanim-backups-${config.environment}`,
      tags: { Name: `zmanim-backups-${config.environment}` },
      lifecycle: { preventDestroy: true },
    });

    new S3BucketVersioningA(this, "backups-versioning", {
      bucket: backupsBucket.id,
      versioningConfiguration: { status: "Enabled" },
    });

    new S3BucketServerSideEncryptionConfigurationA(this, "backups-encryption", {
      bucket: backupsBucket.id,
      rule: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
    });

    new S3BucketPublicAccessBlock(this, "backups-public-access-block", {
      bucket: backupsBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    const releasesBucket = new S3Bucket(this, "releases-bucket", {
      bucket: `zmanim-releases-${config.environment}`,
      tags: { Name: `zmanim-releases-${config.environment}` },
      lifecycle: { preventDestroy: true },
    });

    new S3BucketVersioningA(this, "releases-versioning", {
      bucket: releasesBucket.id,
      versioningConfiguration: { status: "Enabled" },
    });

    new S3BucketServerSideEncryptionConfigurationA(this, "releases-encryption", {
      bucket: releasesBucket.id,
      rule: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
    });

    new S3BucketPublicAccessBlock(this, "releases-public-access-block", {
      bucket: releasesBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    new S3BucketLifecycleConfiguration(this, "releases-lifecycle", {
      bucket: releasesBucket.id,
      rule: [
        {
          id: "cleanup-old-versions",
          status: "Enabled",
          filter: [{}], // Required - empty filter applies to all objects
          noncurrentVersionExpiration: [{ noncurrentDays: 30 }],
        },
      ],
    });

    // ==========================================================================
    // 2.1 Security Group
    // ==========================================================================
    const ec2SecurityGroup = new SecurityGroup(this, "ec2-sg", {
      name: "zmanim-ec2-sg",
      description: "Security group for Zmanim EC2 instance",
      vpcId: vpcId,
      tags: { Name: "zmanim-ec2-sg" },
    });

    new SecurityGroupRule(this, "sg-ingress-https", {
      type: "ingress",
      securityGroupId: ec2SecurityGroup.id,
      fromPort: 443,
      toPort: 443,
      protocol: "tcp",
      cidrBlocks: ["0.0.0.0/0"],
      description: "HTTPS from anywhere (CloudFront)",
    });

    new SecurityGroupRule(this, "sg-ingress-ssh", {
      type: "ingress",
      securityGroupId: ec2SecurityGroup.id,
      fromPort: 22,
      toPort: 22,
      protocol: "tcp",
      cidrBlocks: ["127.0.0.1/32"], // Placeholder - set ADMIN_CIDR via variable
      description: "SSH from admin (placeholder)",
    });

    new SecurityGroupRule(this, "sg-ingress-api", {
      type: "ingress",
      securityGroupId: ec2SecurityGroup.id,
      fromPort: 8080,
      toPort: 8080,
      protocol: "tcp",
      cidrBlocks: ["0.0.0.0/0"],
      description: "API from API Gateway",
    });

    new SecurityGroupRule(this, "sg-egress-all", {
      type: "egress",
      securityGroupId: ec2SecurityGroup.id,
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: ["0.0.0.0/0"],
      description: "All outbound traffic",
    });

    // ==========================================================================
    // 2.6 IAM Role + Instance Profile
    // ==========================================================================
    const ec2Role = new IamRole(this, "ec2-role", {
      name: `zmanim-instance-role-${config.environment}`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ec2.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      tags: { Name: "zmanim-instance-role" },
    });

    const instanceProfile = new IamInstanceProfile(this, "instance-profile", {
      name: `zmanim-instance-profile-${config.environment}`,
      role: ec2Role.name,
    });

    new IamRolePolicyAttachment(this, "ec2-ssm-policy", {
      role: ec2Role.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    });

    new IamRolePolicyAttachment(this, "ec2-cloudwatch-policy", {
      role: ec2Role.name,
      policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
    });

    new IamRolePolicy(this, "ec2-custom-policy", {
      name: "zmanim-custom-policy",
      role: ec2Role.id,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "S3Access",
            Effect: "Allow",
            Action: ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:DeleteObject"],
            Resource: [
              backupsBucket.arn,
              `${backupsBucket.arn}/*`,
              releasesBucket.arn,
              `${releasesBucket.arn}/*`,
            ],
          },
          {
            Sid: "SSMAccess",
            Effect: "Allow",
            Action: ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
            Resource: `arn:aws:ssm:${config.region}:*:parameter/zmanim/${config.environment}/*`,
          },
          {
            Sid: "KMSDecrypt",
            Effect: "Allow",
            Action: "kms:Decrypt",
            Resource: "*",
            Condition: {
              StringEquals: { "kms:ViaService": `ssm.${config.region}.amazonaws.com` },
            },
          },
          {
            Sid: "SESSend",
            Effect: "Allow",
            Action: ["ses:SendEmail", "ses:SendRawEmail"],
            Resource: "*",
          },
          {
            Sid: "CloudWatchMetrics",
            Effect: "Allow",
            Action: ["cloudwatch:PutMetricData", "cloudwatch:GetMetricStatistics", "cloudwatch:ListMetrics"],
            Resource: "*",
            Condition: { StringEquals: { "cloudwatch:namespace": "ZmanimApp" } },
          },
        ],
      }),
    });

    // ==========================================================================
    // 2.4 Elastic IP
    // ==========================================================================
    const elasticIp = new Eip(this, "eip", {
      domain: "vpc",
      tags: { Name: `zmanim-api-eip` },
    });

    // ==========================================================================
    // 2.6 EC2 Instance + EBS Volume
    // ==========================================================================
    const userData = `#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

# =============================================================================
# Helper functions
# =============================================================================
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log_step() { echo ""; log "========== $* =========="; }
log_ok() { log "  ✓ $*"; }
log_err() { log "  ✗ ERROR: $*"; }
log_warn() { log "  ! WARNING: $*"; }

SCRIPT_START=$(date +%s)
log_step "ZMANIM USER DATA SCRIPT STARTING"
log "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id || echo 'unknown')"
log "AMI ID: $(curl -s http://169.254.169.254/latest/meta-data/ami-id || echo 'unknown')"

DATA_LABEL="zmanim-data"
DATA_MOUNT="/data"

# =============================================================================
# Step 1: Mount the EBS data volume
# =============================================================================
log_step "Step 1/4: Mounting EBS data volume"

if ! mountpoint -q $DATA_MOUNT; then
    log "Data volume not mounted, searching for labeled volume..."
    DATA_DEVICE=""
    for i in {1..60}; do
        DATA_DEVICE=$(blkid -L "$DATA_LABEL" 2>/dev/null || true)
        if [ -n "$DATA_DEVICE" ] && [ -b "$DATA_DEVICE" ]; then
            log_ok "Found labeled volume $DATA_LABEL at $DATA_DEVICE"
            break
        fi
        for dev in /dev/nvme1n1 /dev/nvme2n1 /dev/nvme3n1; do
            if [ -b "$dev" ] && ! blkid "$dev" | grep -q "TYPE="; then
                log "Found unformatted device $dev - formatting with XFS..."
                mkfs.xfs -L "$DATA_LABEL" "$dev"
                DATA_DEVICE="$dev"
                log_ok "Formatted $dev with label $DATA_LABEL"
                break 2
            fi
        done
        [ $((i % 10)) -eq 0 ] && log "  Waiting for data volume... ($i/60s)"
        sleep 1
    done
    if [ -z "$DATA_DEVICE" ] || [ ! -b "$DATA_DEVICE" ]; then
        log_err "Data volume not found after 60 seconds"
        lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,LABEL
        exit 1
    fi
    mkdir -p $DATA_MOUNT
    mount LABEL="$DATA_LABEL" $DATA_MOUNT
    if ! grep -q "LABEL=$DATA_LABEL" /etc/fstab; then
        sed -i "\\|$DATA_MOUNT|d" /etc/fstab
        echo "LABEL=$DATA_LABEL $DATA_MOUNT xfs defaults,nofail 0 2" >> /etc/fstab
        log_ok "Added $DATA_MOUNT to /etc/fstab"
    fi
    log_ok "Data volume mounted at $DATA_MOUNT"
else
    log_ok "Data volume already mounted at $DATA_MOUNT"
fi
df -h $DATA_MOUNT

# =============================================================================
# Step 2: Create data directories with correct ownership
# =============================================================================
log_step "Step 2/4: Creating data directories"

mkdir -p /data/postgres /data/redis
chown postgres:postgres /data/postgres 2>/dev/null || true
chmod 700 /data/postgres
chown redis:redis /data/redis 2>/dev/null || true
chmod 750 /data/redis
log_ok "Created /data/postgres (postgres:postgres, 700)"
log_ok "Created /data/redis (redis:redis, 750)"
ls -la /data/

# =============================================================================
# Step 3: Enable and start services (in correct order)
# =============================================================================
log_step "Step 3/4: Starting services"
log "Boot order: firstboot → postgresql → db-init → redis → zmanim-api"

log "Enabling all services for future boots..."
systemctl enable zmanim-firstboot.service postgresql postgresql@17-main.service zmanim-db-init.service redis-server zmanim-api.service restic-backup.timer 2>/dev/null
log_ok "All services enabled"

# --- 1. Firstboot ---
log ""
log "[1/5] Starting zmanim-firstboot (fetches config from SSM)..."
START_TIME=$(date +%s)
systemctl start zmanim-firstboot.service
for i in {1..60}; do
    if systemctl is-active --quiet zmanim-firstboot.service; then
        ELAPSED=$(($(date +%s) - START_TIME))
        log_ok "firstboot completed in \$ELAPSED seconds"
        break
    fi
    if systemctl is-failed --quiet zmanim-firstboot.service; then
        log_err "firstboot failed!"
        journalctl -u zmanim-firstboot.service --no-pager -n 30
        exit 1
    fi
    sleep 1
done

# --- 2. PostgreSQL ---
log ""
log "[2/5] Starting PostgreSQL 17..."
START_TIME=$(date +%s)
systemctl start postgresql@17-main.service
for i in {1..30}; do
    if [ -S /var/run/postgresql/.s.PGSQL.5432 ]; then
        ELAPSED=$(($(date +%s) - START_TIME))
        log_ok "PostgreSQL ready in \$ELAPSED seconds (socket available)"
        break
    fi
    if systemctl is-failed --quiet postgresql@17-main.service; then
        log_err "PostgreSQL failed to start!"
        journalctl -u postgresql@17-main.service --no-pager -n 50
        exit 1
    fi
    sleep 1
done

# --- 3. DB Init ---
log ""
log "[3/5] Starting zmanim-db-init (creates database if needed)..."
START_TIME=$(date +%s)
systemctl start zmanim-db-init.service
for i in {1..60}; do
    if systemctl is-active --quiet zmanim-db-init.service; then
        ELAPSED=$(($(date +%s) - START_TIME))
        log_ok "db-init completed in \$ELAPSED seconds"
        break
    fi
    if systemctl is-failed --quiet zmanim-db-init.service; then
        log_err "db-init failed!"
        journalctl -u zmanim-db-init.service --no-pager -n 30
        exit 1
    fi
    sleep 1
done

# --- 4. Redis ---
log ""
log "[4/5] Starting Redis..."
START_TIME=$(date +%s)
systemctl start redis-server
for i in {1..15}; do
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        ELAPSED=$(($(date +%s) - START_TIME))
        log_ok "Redis ready in \$ELAPSED seconds (responding to PING)"
        break
    fi
    if systemctl is-failed --quiet redis-server; then
        log_err "Redis failed to start!"
        journalctl -u redis-server --no-pager -n 30
        exit 1
    fi
    sleep 1
done

# --- 5. Zmanim API ---
log ""
log "[5/5] Starting Zmanim API..."
START_TIME=$(date +%s)
systemctl start zmanim-api.service
sleep 3
if systemctl is-active --quiet zmanim-api.service; then
    ELAPSED=$(($(date +%s) - START_TIME))
    log_ok "Zmanim API started in \$ELAPSED seconds"
else
    log_warn "Zmanim API may have failed to start"
    journalctl -u zmanim-api.service --no-pager -n 30
fi

# --- Backup timer ---
log ""
log "Starting backup timer..."
systemctl start restic-backup.timer
systemctl is-active --quiet restic-backup.timer && log_ok "Backup timer started"

# =============================================================================
# Step 4: Final verification
# =============================================================================
log_step "Step 4/4: Final verification"

log "Service status summary:"
for svc in zmanim-firstboot postgresql@17-main zmanim-db-init redis-server zmanim-api restic-backup.timer; do
    if systemctl is-active --quiet \$svc 2>/dev/null; then
        log_ok "\$svc: active"
    elif systemctl is-failed --quiet \$svc 2>/dev/null; then
        log_err "\$svc: failed"
    else
        log_warn "\$svc: inactive"
    fi
done

log ""
log "Disk usage:"
df -h /data /

log ""
log "Memory usage:"
free -h

log_step "ZMANIM USER DATA SCRIPT COMPLETED"
log "Total startup time: $(($(date +%s) - SCRIPT_START))s"
`;

    const ec2Instance = new Instance(this, "ec2", {
      ami: zmanimAmi.id,
      instanceType: config.instanceType,
      subnetId: publicSubnetId,
      vpcSecurityGroupIds: [ec2SecurityGroup.id],
      iamInstanceProfile: instanceProfile.name,
      monitoring: true,
      userData: userData,
      rootBlockDevice: {
        volumeType: "gp3",
        volumeSize: 10,
        encrypted: true,
        deleteOnTermination: true,
      },
      tags: { Name: `zmanim-api-${config.environment}` },
      lifecycle: { ignoreChanges: ["ami"] },
    });

    const dataVolume = new EbsVolume(this, "data-volume", {
      availabilityZone: publicSubnetAz,
      size: config.dataVolumeSize,
      type: "gp3",
      iops: 3000,
      throughput: 125,
      encrypted: true,
      tags: {
        Name: `zmanim-data-${config.environment}`,
        Persistent: "true",
        MountPoint: "/data",
      },
      lifecycle: { preventDestroy: true },
    });

    new VolumeAttachment(this, "data-volume-attachment", {
      deviceName: "/dev/sdf",
      volumeId: dataVolume.id,
      instanceId: ec2Instance.id,
    });

    new EipAssociation(this, "eip-association", {
      instanceId: ec2Instance.id,
      allocationId: elasticIp.id,
    });

    // ==========================================================================
    // 2.5 API Gateway (HTTP API)
    // ==========================================================================
    const apiLogGroup = new CloudwatchLogGroup(this, "api-log-group", {
      name: `/aws/apigateway/zmanim-api-${config.environment}`,
      retentionInDays: 30,
      tags: { Name: "zmanim-api-logs" },
    });

    const httpApi = new Apigatewayv2Api(this, "http-api", {
      name: `zmanim-api-${config.environment}`,
      protocolType: "HTTP",
      corsConfiguration: {
        allowOrigins: [`https://${config.domain}`],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Authorization", "Content-Type", "X-Publisher-Id"],
        exposeHeaders: ["X-Request-Id", "X-Amzn-RequestId"],
        maxAge: 3600,
        allowCredentials: true,
      },
      tags: { Name: `zmanim-api-${config.environment}` },
    });

    new Apigatewayv2Stage(this, "api-stage", {
      apiId: httpApi.id,
      name: "$default",
      autoDeploy: true,
      accessLogSettings: {
        destinationArn: apiLogGroup.arn,
        format: JSON.stringify({
          requestId: "$context.requestId",
          ip: "$context.identity.sourceIp",
          requestTime: "$context.requestTime",
          httpMethod: "$context.httpMethod",
          routeKey: "$context.routeKey",
          status: "$context.status",
          protocol: "$context.protocol",
          responseLength: "$context.responseLength",
          integrationLatency: "$context.integrationLatency",
          integrationStatus: "$context.integrationStatus",
          authError: "$context.authorizer.error",
        }),
      },
      defaultRouteSettings: {
        throttlingBurstLimit: 1000,
        throttlingRateLimit: 500,
      },
    });

    const clerkAuthorizer = new Apigatewayv2Authorizer(this, "clerk-authorizer", {
      apiId: httpApi.id,
      authorizerType: "JWT",
      identitySources: ["$request.header.Authorization"],
      name: "clerk-jwt",
      jwtConfiguration: {
        audience: [ssmClerkAudience.value],
        issuer: `https://${ssmClerkDomain.value}`,
      },
    });

    // ==========================================================================
    // API Gateway Routes - Simplified 2-Path Authentication Pattern
    // ==========================================================================
    // This configuration implements the simplified routing pattern from Story 9.1:
    // - /api/v1/public/* → No authentication (public access)
    // - /api/v1/auth/* → JWT authentication required (Clerk authorizer)
    // - /api/v1/health → No authentication (health check)
    //
    // Backend routes (Story 8.17) already migrated to this pattern.
    // Frontend auto-routing (normalizeEndpoint) handles path translation.
    // ==========================================================================

    // Health check integration (special case - maps to /health, not /api/v1/health on backend)
    const healthIntegration = new Apigatewayv2Integration(this, "health-integration", {
      apiId: httpApi.id,
      integrationType: "HTTP_PROXY",
      integrationUri: `http://${elasticIp.publicIp}:8080/health`,
      integrationMethod: "GET",
      timeoutMilliseconds: 29000,
      requestParameters: {
        "overwrite:header.X-Origin-Verify": ssmOriginVerifyKey.value,
      },
    });

    // Health endpoint route (no auth)
    new Apigatewayv2Route(this, "route-health", {
      apiId: httpApi.id,
      routeKey: "GET /api/v1/health",
      target: `integrations/${healthIntegration.id}`,
    });

    // Public routes integration - forwards to /api/v1/public/{proxy} on backend
    // Integration URI uses {proxy} (singular) which gets replaced with full path segments
    const publicIntegration = new Apigatewayv2Integration(this, "ec2-public-integration", {
      apiId: httpApi.id,
      integrationType: "HTTP_PROXY",
      integrationUri: `http://${elasticIp.publicIp}:8080/api/v1/public/{proxy}`,
      integrationMethod: "ANY",
      timeoutMilliseconds: 29000,
      requestParameters: {
        "overwrite:header.X-Origin-Verify": ssmOriginVerifyKey.value,
      },
    });

    // Public routes - no authentication required
    // Matches: /api/v1/public/publishers, /api/v1/public/cities, /api/v1/public/zmanim, etc.
    new Apigatewayv2Route(this, "route-public", {
      apiId: httpApi.id,
      routeKey: "ANY /api/v1/public/{proxy+}",
      target: `integrations/${publicIntegration.id}`,
    });

    // Authenticated routes integration - forwards to /api/v1/auth/{proxy} on backend
    const authIntegration = new Apigatewayv2Integration(this, "ec2-auth-integration", {
      apiId: httpApi.id,
      integrationType: "HTTP_PROXY",
      integrationUri: `http://${elasticIp.publicIp}:8080/api/v1/auth/{proxy}`,
      integrationMethod: "ANY",
      timeoutMilliseconds: 29000,
      requestParameters: {
        "overwrite:header.X-Origin-Verify": ssmOriginVerifyKey.value,
      },
    });

    // Authenticated routes - JWT authentication required (Clerk authorizer)
    // Matches: /api/v1/auth/publisher/*, /api/v1/auth/admin/*, /api/v1/auth/external/*, etc.
    new Apigatewayv2Route(this, "route-auth", {
      apiId: httpApi.id,
      routeKey: "ANY /api/v1/auth/{proxy+}",
      target: `integrations/${authIntegration.id}`,
      authorizationType: "JWT",
      authorizerId: clerkAuthorizer.id,
    });

    // ==========================================================================
    // 2.7 Route53 Record (origin-api)
    // ==========================================================================
    new Route53Record(this, "origin-api-record", {
      zoneId: hostedZoneId,
      name: `origin-api.zmanim.${config.baseDomain}`,
      type: "A",
      ttl: 300,
      records: [elasticIp.publicIp],
    });

    // ==========================================================================
    // 2.8 Health Check & Alarm (us-east-1)
    // ==========================================================================
    const healthCheck = new Route53HealthCheck(this, "api-health-check", {
      fqdn: `origin-api.zmanim.${config.baseDomain}`,
      port: 8080,
      type: "HTTP",
      resourcePath: "/health",
      failureThreshold: 3,
      requestInterval: 30,
      tags: { Name: `zmanim-api-health-${config.environment}` },
    });

    const alertTopic = new SnsTopic(this, "alert-topic", {
      provider: this.node.tryFindChild("aws-us-east-1") as AwsProvider,
      name: `zmanim-api-alerts-${config.environment}`,
      displayName: "Zmanim API Health Alerts",
      tags: { Name: "zmanim-api-alerts" },
    });

    new CloudwatchMetricAlarm(this, "health-alarm", {
      provider: this.node.tryFindChild("aws-us-east-1") as AwsProvider,
      alarmName: `zmanim-api-health-${config.environment}`,
      comparisonOperator: "LessThanThreshold",
      evaluationPeriods: 2,
      metricName: "HealthCheckStatus",
      namespace: "AWS/Route53",
      period: 60,
      statistic: "Minimum",
      threshold: 1,
      treatMissingData: "breaching",
      dimensions: { HealthCheckId: healthCheck.id },
      alarmActions: [alertTopic.arn],
      okActions: [alertTopic.arn],
      tags: { Name: "zmanim-api-health-alarm" },
    });

    // ==========================================================================
    // 2.9 ACM Certificate (us-east-1)
    // ==========================================================================
    const certificate = new AcmCertificate(this, "cloudfront-cert", {
      provider: this.node.tryFindChild("aws-us-east-1") as AwsProvider,
      domainName: config.domain,
      validationMethod: "DNS",
      tags: { Name: "zmanim-cloudfront-cert" },
      lifecycle: { createBeforeDestroy: true },
    });

    // Certificate validation DNS record
    // Use lookup to extract the first domain validation option
    const dvo = Fn.element(Fn.tolist(certificate.domainValidationOptions), 0);
    const certValidationRecord = new Route53Record(this, "cert-validation-record", {
      zoneId: hostedZoneId,
      name: Fn.lookup(dvo, "resource_record_name", ""),
      type: Fn.lookup(dvo, "resource_record_type", ""),
      records: [Fn.lookup(dvo, "resource_record_value", "")],
      ttl: 300,
      allowOverwrite: true,
    });

    new AcmCertificateValidation(this, "cert-validation", {
      provider: this.node.tryFindChild("aws-us-east-1") as AwsProvider,
      certificateArn: certificate.arn,
      validationRecordFqdns: [certValidationRecord.fqdn],
    });

    // ==========================================================================
    // 3.0 CloudFront Distribution (Next.js + API)
    // ==========================================================================
    const callerIdentity = new DataAwsCallerIdentity(this, "caller-identity", {});

    // S3 bucket for static assets (Next.js export)
    const staticBucket = new S3Bucket(this, "static-bucket", {
      bucket: `zmanim-static-${config.environment}`,
      tags: { Name: `zmanim-static-${config.environment}` },
    });

    new S3BucketServerSideEncryptionConfigurationA(this, "static-encryption", {
      bucket: staticBucket.id,
      rule: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
    });

    new S3BucketPublicAccessBlock(this, "static-public-access-block", {
      bucket: staticBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    // S3 Origin Access Control is now shared from shtetl-common stack:
    // - cfS3OacId: OAC for static assets buckets

    // S3 bucket policy for CloudFront OAC - defined later after CloudFront distribution
    // (moved to after distribution so we can reference distribution.arn)

    // ==========================================================================
    // 3.1 Lambda Functions for Next.js SSR (OpenNext)
    // ==========================================================================

    // IAM Role for Lambda functions
    const lambdaRole = new IamRole(this, "lambda-role", {
      name: `zmanim-lambda-role-${config.environment}`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "lambda.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      tags: { Name: "zmanim-lambda-role" },
    });

    // Basic Lambda execution policy
    new IamRolePolicyAttachment(this, "lambda-basic-policy", {
      role: lambdaRole.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    });

    // Lambda policy for S3 access (static assets bucket)
    new IamRolePolicy(this, "lambda-s3-policy", {
      name: "zmanim-lambda-s3-policy",
      role: lambdaRole.id,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
            Resource: [staticBucket.arn, `${staticBucket.arn}/*`],
          },
        ],
      }),
    });

    // Server Lambda function (Next.js SSR)
    // Note: Initial deployment uses a placeholder. GitHub Actions will update the code.
    const serverFunction = new LambdaFunction(this, "server-function", {
      functionName: `zmanim-server-${config.environment}`,
      role: lambdaRole.arn,
      handler: "index.handler",
      runtime: "nodejs24.x",
      memorySize: 1024,
      timeout: 30,
      architectures: ["arm64"],
      // Use releases bucket with placeholder path - GitHub Actions will update
      s3Bucket: releasesBucket.id,
      s3Key: "frontend/placeholder/server-function.zip",
      environment: {
        variables: {
          NEXT_PUBLIC_API_URL: `https://${config.domain}`,
          NEXT_PUBLIC_ENV_MODE: "prod",
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ssmClerkPublishableKey.value,
          CLERK_SECRET_KEY: ssmClerkSecretKey.value,
          CLERK_DOMAIN: ssmClerkDomain.value,
          OPEN_NEXT_ORIGIN: `https://${config.domain}`,
        },
      },
      tags: { Name: `zmanim-server-${config.environment}` },
      lifecycle: {
        ignoreChanges: ["s3_key", "s3_object_version"],
      },
    });

    // Server function URL for CloudFront
    const serverFunctionUrl = new LambdaFunctionUrl(this, "server-function-url", {
      functionName: serverFunction.functionName,
      authorizationType: "NONE",
    });

    // Allow CloudFront to invoke the server function
    new LambdaPermission(this, "server-function-cloudfront-permission", {
      functionName: serverFunction.functionName,
      action: "lambda:InvokeFunctionUrl",
      principal: "cloudfront.amazonaws.com",
      sourceArn: `arn:aws:cloudfront::${callerIdentity.accountId}:distribution/*`,
    });

    // Image optimization Lambda function
    const imageFunction = new LambdaFunction(this, "image-function", {
      functionName: `zmanim-image-${config.environment}`,
      role: lambdaRole.arn,
      handler: "index.handler",
      runtime: "nodejs24.x",
      memorySize: 1024,
      timeout: 30,
      architectures: ["arm64"],
      // Use releases bucket with placeholder path - GitHub Actions will update
      s3Bucket: releasesBucket.id,
      s3Key: "frontend/placeholder/image-function.zip",
      environment: {
        variables: {
          BUCKET_NAME: staticBucket.id,
        },
      },
      tags: { Name: `zmanim-image-${config.environment}` },
      lifecycle: {
        ignoreChanges: ["s3_key", "s3_object_version"],
      },
    });

    // Image function URL for CloudFront
    const imageFunctionUrl = new LambdaFunctionUrl(this, "image-function-url", {
      functionName: imageFunction.functionName,
      authorizationType: "NONE",
    });

    // Allow CloudFront to invoke the image function
    new LambdaPermission(this, "image-function-cloudfront-permission", {
      functionName: imageFunction.functionName,
      action: "lambda:InvokeFunctionUrl",
      principal: "cloudfront.amazonaws.com",
      sourceArn: `arn:aws:cloudfront::${callerIdentity.accountId}:distribution/*`,
    });

    // Extract Lambda function URL domains (remove https:// and trailing /)
    const serverFunctionDomain = Fn.replace(
      Fn.replace(serverFunctionUrl.functionUrl, "https://", ""),
      "/",
      ""
    );
    const imageFunctionDomain = Fn.replace(
      Fn.replace(imageFunctionUrl.functionUrl, "https://", ""),
      "/",
      ""
    );

    // Cache policies are now shared from shtetl-common stack:
    // - cfStaticAssetsCachePolicyId: 1 year TTL for /_next/static/*
    // - cfHtmlCachePolicyId: 1 day TTL for HTML pages
    // - cfApiCachePolicyId: 1 hour TTL for cacheable API endpoints

    // Origin Request Policy: Forward headers for API
    // Note: Authorization header cannot be forwarded via custom origin request policy
    // Using AWS managed "AllViewerExceptHostHeader" policy (b689b0a8-53d0-40ab-baf2-68738e2966ac)
    // which forwards all headers including Authorization except Host
    const allViewerExceptHostPolicyId = "b689b0a8-53d0-40ab-baf2-68738e2966ac";

    // Response Headers Policy is now shared from shtetl-common stack:
    // - cfSecurityHeadersPolicyId: Security headers (HSTS, frame options, etc.)

    // Extract API Gateway domain from endpoint URL
    const apiGatewayDomain = Fn.replace(
      Fn.replace(httpApi.apiEndpoint, "https://", ""),
      "/",
      ""
    );

    // CloudFront Function is now shared from shtetl-common stack:
    // - cfHostHeaderFunctionArn: Forward host header as x-forwarded-host for OpenNext

    // CloudFront Distribution
    const distribution = new CloudfrontDistribution(this, "cloudfront", {
      enabled: true,
      isIpv6Enabled: true,
      comment: `Zmanim CDN - ${config.environment}`,
      // No defaultRootObject - Lambda handles all routing
      priceClass: "PriceClass_100", // US, Canada, Europe, Israel
      aliases: [config.domain],
      viewerCertificate: {
        acmCertificateArn: certificate.arn,
        sslSupportMethod: "sni-only",
        minimumProtocolVersion: "TLSv1.2_2021",
      },

      // Origins
      origin: [
        // S3 origin for static assets
        {
          domainName: staticBucket.bucketRegionalDomainName,
          originId: "S3Static",
          originAccessControlId: cfS3OacId,
        },
        // API Gateway origin (Go backend)
        {
          domainName: apiGatewayDomain,
          originId: "ApiGateway",
          customOriginConfig: {
            httpPort: 80,
            httpsPort: 443,
            originProtocolPolicy: "https-only",
            originSslProtocols: ["TLSv1.2"],
          },
          originShield: {
            enabled: true,
            originShieldRegion: config.region,
          },
        },
        // Lambda origin for Next.js SSR (server function)
        {
          domainName: serverFunctionDomain,
          originId: "LambdaServer",
          customOriginConfig: {
            httpPort: 80,
            httpsPort: 443,
            originProtocolPolicy: "https-only",
            originSslProtocols: ["TLSv1.2"],
          },
          originShield: {
            enabled: true,
            originShieldRegion: config.region,
          },
        },
        // Lambda origin for image optimization
        {
          domainName: imageFunctionDomain,
          originId: "LambdaImage",
          customOriginConfig: {
            httpPort: 80,
            httpsPort: 443,
            originProtocolPolicy: "https-only",
            originSslProtocols: ["TLSv1.2"],
          },
        },
      ],

      // Default behavior: Lambda SSR for Next.js pages
      defaultCacheBehavior: {
        targetOriginId: "LambdaServer",
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
        cachedMethods: ["GET", "HEAD"],
        compress: true,
        // Use AWS managed CachingDisabled policy for SSR
        cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        // Use AWS managed AllViewerExceptHostHeader policy
        originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
        responseHeadersPolicyId: cfSecurityHeadersPolicyId,
        // Forward host header for OpenNext/Clerk (shared function from common stack)
        functionAssociation: [
          {
            eventType: "viewer-request",
            functionArn: cfHostHeaderFunctionArn,
          },
        ],
      },

      // Ordered cache behaviors (evaluated in order, first match wins)
      orderedCacheBehavior: [
        // /_next/static/* - Immutable hashed assets from S3 (1 year cache)
        {
          pathPattern: "/_next/static/*",
          targetOriginId: "S3Static",
          viewerProtocolPolicy: "redirect-to-https",
          allowedMethods: ["GET", "HEAD", "OPTIONS"],
          cachedMethods: ["GET", "HEAD"],
          compress: true,
          cachePolicyId: cfStaticAssetsCachePolicyId,
          responseHeadersPolicyId: cfSecurityHeadersPolicyId,
        },
        // /_next/image* - Image optimization via Lambda
        {
          pathPattern: "/_next/image*",
          targetOriginId: "LambdaImage",
          viewerProtocolPolicy: "redirect-to-https",
          allowedMethods: ["GET", "HEAD", "OPTIONS"],
          cachedMethods: ["GET", "HEAD"],
          compress: true,
          cachePolicyId: cfHtmlCachePolicyId,
          // Use AWS managed AllViewerExceptHostHeader policy
          originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
          responseHeadersPolicyId: cfSecurityHeadersPolicyId,
        },
        // /api/v1/zmanim/* - Cacheable zmanim calculations (1 hour cache) -> Go API
        {
          pathPattern: "/api/v1/zmanim/*",
          targetOriginId: "ApiGateway",
          viewerProtocolPolicy: "redirect-to-https",
          allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
          cachedMethods: ["GET", "HEAD"],
          compress: true,
          cachePolicyId: cfApiCachePolicyId,
          originRequestPolicyId: allViewerExceptHostPolicyId,
          responseHeadersPolicyId: cfSecurityHeadersPolicyId,
        },
        // /api/v1/* - No cache for auth, mutations -> Go API
        {
          pathPattern: "/api/v1/*",
          targetOriginId: "ApiGateway",
          viewerProtocolPolicy: "redirect-to-https",
          allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
          cachedMethods: ["GET", "HEAD"],
          compress: true,
          // Use AWS managed CachingDisabled policy
          cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
          originRequestPolicyId: allViewerExceptHostPolicyId,
          responseHeadersPolicyId: cfSecurityHeadersPolicyId,
        },
      ],

      // No custom error responses needed - Lambda handles all routing

      restrictions: {
        geoRestriction: {
          restrictionType: "none",
        },
      },

      tags: { Name: `zmanim-cdn-${config.environment}` },
    });

    // Route53 alias record for zmanim.shtetl.io pointing to CloudFront
    new Route53Record(this, "cloudfront-alias", {
      zoneId: hostedZoneId,
      name: config.domain,
      type: "A",
      alias: {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: false,
      },
    });

    // S3 bucket policy for CloudFront OAC (must be after distribution for ARN reference)
    new S3BucketPolicy(this, "static-bucket-policy", {
      bucket: staticBucket.id,
      policy: Fn.jsonencode({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowCloudFrontServicePrincipal",
            Effect: "Allow",
            Principal: {
              Service: "cloudfront.amazonaws.com",
            },
            Action: "s3:GetObject",
            Resource: `${staticBucket.arn}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": distribution.arn,
              },
            },
          },
        ],
      }),
    });

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new TerraformOutput(this, "api_gateway_endpoint", {
      value: httpApi.apiEndpoint,
      description: "API Gateway endpoint URL",
    });

    new TerraformOutput(this, "api_gateway_id", {
      value: httpApi.id,
      description: "API Gateway ID",
    });

    new TerraformOutput(this, "elastic_ip", {
      value: elasticIp.publicIp,
      description: "EC2 Elastic IP",
    });

    new TerraformOutput(this, "instance_id", {
      value: ec2Instance.id,
      description: "EC2 instance ID",
    });

    new TerraformOutput(this, "health_check_id", {
      value: healthCheck.id,
      description: "Route53 API health check ID",
    });

    new TerraformOutput(this, "origin_api_url", {
      value: `http://origin-api.zmanim.${config.baseDomain}:8080`,
      description: "Direct API URL (bypasses CloudFront)",
    });

    new TerraformOutput(this, "certificate_arn", {
      value: certificate.arn,
      description: "ACM certificate ARN",
    });

    new TerraformOutput(this, "backups_bucket_name", {
      value: backupsBucket.id,
      description: "Backups S3 bucket name",
    });

    new TerraformOutput(this, "releases_bucket_name", {
      value: releasesBucket.id,
      description: "Releases S3 bucket name",
    });

    new TerraformOutput(this, "alert_topic_arn", {
      value: alertTopic.arn,
      description: "SNS topic ARN for health alerts",
    });

    new TerraformOutput(this, "cloudfront_distribution_id", {
      value: distribution.id,
      description: "CloudFront distribution ID",
    });

    new TerraformOutput(this, "cloudfront_domain_name", {
      value: distribution.domainName,
      description: "CloudFront distribution domain name",
    });

    new TerraformOutput(this, "static_bucket_name", {
      value: staticBucket.id,
      description: "S3 bucket name for static assets",
    });

    new TerraformOutput(this, "site_url", {
      value: `https://${config.domain}`,
      description: "Production site URL",
    });

    new TerraformOutput(this, "server_function_name", {
      value: serverFunction.functionName,
      description: "Next.js SSR Lambda function name",
    });

    new TerraformOutput(this, "server_function_url", {
      value: serverFunctionUrl.functionUrl,
      description: "Next.js SSR Lambda function URL",
    });

    new TerraformOutput(this, "image_function_name", {
      value: imageFunction.functionName,
      description: "Image optimization Lambda function name",
    });

    new TerraformOutput(this, "image_function_url", {
      value: imageFunctionUrl.functionUrl,
      description: "Image optimization Lambda function URL",
    });
  }
}
