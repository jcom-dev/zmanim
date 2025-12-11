#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { ComputeStack } from '../lib/compute-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { CdnStack } from '../lib/cdn-stack';
import { StorageStack } from '../lib/storage-stack';
import { SecretsStack } from '../lib/secrets-stack';
import { CertificateStack, DnsZoneStack, DnsStack, HealthCheckAlarmStack } from '../lib/dns-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';
import { NextjsLambdaStack } from '../lib/nextjs-lambda-stack';
import { getConfig, getCdkEnvironment } from '../lib/config';

/**
 * Zmanim Lab AWS Infrastructure
 *
 * Stack Dependency Graph:
 *
 *   StorageStack (no dependencies) ─────────────────────────────────────┐
 *       │                                                               │
 *   SecretsStack (no dependencies) [Story 7.9]                          │
 *       │                                                               │
 *   NetworkStack (no dependencies)                                      │
 *       ↓                                                               │
 *   ComputeStack (depends on Network, Secrets for VPC/SSM)              │
 *       ↓                                                               │
 *   ApiGatewayStack (depends on Compute for Elastic IP) [Story 7.7]     │
 *       ↓                                                               │
 *   DnsZoneStack (depends on Compute for Elastic IP)                    │
 *       ↓                                                               │
 *   CertificateStack (in us-east-1! depends on DnsZone) [Story 7.8]     │
 *       ↓                                                               │
 *   CDNStack (depends on DnsZone, Certificate for SSL) ←────────────────┘
 *       ↓                                                     (parallel)
 *   DnsStack (depends on CDN, DnsZone → A record alias, health check)
 *       ↓
 *   HealthCheckAlarmStack (in us-east-1! depends on DnsStack) [Story 7.8]
 *
 * Stack Separation:
 * - StorageStack: S3 buckets for backups and releases (infrastructure storage)
 * - SecretsStack: SSM Parameter Store secrets (Story 7.9)
 * - CdnStack: CloudFront + static bucket only (public content delivery)
 *
 * IMPORTANT: Two stacks MUST be in us-east-1:
 * - CertificateStack: CloudFront requires ACM certificates in us-east-1
 * - HealthCheckAlarmStack: Route 53 health check metrics only available in us-east-1
 *
 * Deployment order is handled automatically by CDK based on cross-stack references.
 */

const app = new cdk.App();

// Get environment from CDK context or default to prod
const envName = app.node.tryGetContext('environment') || 'prod';
if (envName !== 'prod') {
  throw new Error(
    `Invalid environment: ${envName}. Only 'prod' is supported. Development uses Fly.io/Vercel.`
  );
}

const config = getConfig('prod');
const env = getCdkEnvironment(config);

// GitHub OIDC Stack - Must be deployed FIRST to enable GitHub Actions authentication
// This replaces static AWS credentials with federated identity
const githubOidcStack = new GitHubOidcStack(app, 'ZmanimGitHubOidc', {
  env,
  githubRepo: 'jcom-dev/zmanim',
  allowedRefs: ['main'], // Only main branch and tags can deploy
  description: 'Zmanim Lab - GitHub OIDC authentication for CDK deployments',
});

// StorageStack - S3 buckets for backups and releases (no dependencies)
// Separated from CdnStack for cleaner architecture:
// - These buckets are NOT served via CloudFront
// - Used by EC2 for backup/restore and deployment operations
const storageStack = new StorageStack(app, `${config.stackPrefix}Storage`, {
  config,
  env,
  description: 'Zmanim Lab - Storage infrastructure (backups, releases buckets)',
});

// SecretsStack - SSM Parameter Store for secrets management (Story 7.9)
// MUST be deployed before ComputeStack as it references AMI ID from SSM
// Parameters created with placeholder values - real secrets set via CLI after deployment
const secretsStack = new SecretsStack(app, `${config.stackPrefix}Secrets`, {
  config,
  env,
  description: 'Zmanim Lab - SSM Parameter Store secrets management',
});

// NetworkStack - VPC, subnets, security groups (no dependencies)
const networkStack = new NetworkStack(app, `${config.stackPrefix}Network`, {
  config,
  env,
  description: 'Zmanim Lab - Network infrastructure (VPC, subnets, security groups)',
});

// ComputeStack - EC2, EBS, IAM (depends on NetworkStack, SecretsStack)
// Depends on SecretsStack because it reads AMI ID from SSM parameter
const computeStack = new ComputeStack(app, `${config.stackPrefix}Compute`, {
  config,
  env,
  vpc: networkStack.vpc,
  securityGroup: networkStack.ec2SecurityGroup,
  description: 'Zmanim Lab - Compute infrastructure (EC2, EBS, IAM)',
});
computeStack.addDependency(networkStack);
computeStack.addDependency(secretsStack); // SecretsStack imports existing SSM parameters

// ApiGatewayStack - HTTP API, JWT authorizer, throttling (depends on ComputeStack for Elastic IP)
// Story 7.7: Routes requests to EC2 with Clerk JWT validation
const apiGatewayStack = new ApiGatewayStack(app, `${config.stackPrefix}ApiGateway`, {
  config,
  env,
  elasticIp: computeStack.elasticIp.ref,
  description: 'Zmanim Lab - API Gateway (HTTP API, JWT auth, throttling)',
});
apiGatewayStack.addDependency(computeStack);

// DnsZoneStack - Route53 hosted zone + API origin A record (depends on Compute for Elastic IP)
const dnsZoneStack = new DnsZoneStack(app, `${config.stackPrefix}DnsZone`, {
  config,
  env,
  elasticIp: computeStack.elasticIp,
  description: 'Zmanim Lab - Route53 hosted zone for shtetl.io',
});
dnsZoneStack.addDependency(computeStack);

// ==========================================================================
// Story 7.8: CertificateStack - ACM certificate in us-east-1
// ==========================================================================
// CRITICAL: CloudFront requires ACM certificates in us-east-1 (N. Virginia)
// This stack MUST be deployed in us-east-1 regardless of other stacks' regions.
//
// We pass hosted zone ID/name as strings to avoid cross-region construct references.
// CDK's crossRegionReferences feature is enabled to allow cross-region exports.
const certificateStack = new CertificateStack(app, `${config.stackPrefix}Certificate`, {
  config,
  env: {
    account: config.account,
    region: 'us-east-1', // MUST be us-east-1 for CloudFront!
  },
  crossRegionReferences: true, // Required for cross-region certificate reference
  hostedZoneId: dnsZoneStack.hostedZone.hostedZoneId,
  hostedZoneName: dnsZoneStack.hostedZone.zoneName,
  description: 'Zmanim Lab - ACM certificate in us-east-1 for CloudFront',
});
certificateStack.addDependency(dnsZoneStack);

// CDNStack - CloudFront + static assets bucket only (depends on DnsZone, ApiGateway)
// Note: Backups and releases buckets are in StorageStack (cleaner separation)
// API routes go through API Gateway (handles path rewriting /api/* -> /api/v1/*)
// Story 7.11: Custom domain moved to NextjsLambdaStack - CDN uses CloudFront default domain
const cdnStack = new CdnStack(app, `${config.stackPrefix}CDN`, {
  config,
  env,
  apiOriginDomain: dnsZoneStack.apiOriginDomain, // Fallback direct EC2 access
  apiGatewayDomain: cdk.Fn.select(2, cdk.Fn.split('/', apiGatewayStack.httpApi.apiEndpoint)), // Extract domain from https://xyz.execute-api.../
  description: 'Zmanim Lab - CDN infrastructure (CloudFront, static assets)',
});
cdnStack.addDependency(dnsZoneStack);
cdnStack.addDependency(apiGatewayStack);

// DNSStack - A record alias, health check (depends on CDN + DnsZone)
// Story 7.8: Moved ACM certificate to separate CertificateStack in us-east-1
const dnsStack = new DnsStack(app, `${config.stackPrefix}DNS`, {
  config,
  env,
  crossRegionReferences: true, // Required for cross-region health check ID export
  distribution: cdnStack.distribution,
  hostedZone: dnsZoneStack.hostedZone,
  certificateArn: certificateStack.certificate.certificateArn,
  description: 'Zmanim Lab - DNS infrastructure (A record alias, health check)',
});
dnsStack.addDependency(cdnStack);
dnsStack.addDependency(dnsZoneStack);

// ==========================================================================
// Story 7.8: HealthCheckAlarmStack - CloudWatch alarm in us-east-1
// ==========================================================================
// CRITICAL: Route 53 health check metrics are ONLY available in us-east-1.
// CloudWatch alarms must be in the same region as the metrics they monitor.
// Therefore, this stack MUST be deployed in us-east-1.
const healthCheckAlarmStack = new HealthCheckAlarmStack(app, `${config.stackPrefix}HealthCheckAlarm`, {
  config,
  env: {
    account: config.account,
    region: 'us-east-1', // MUST be us-east-1 for Route 53 metrics!
  },
  crossRegionReferences: true, // Required for cross-region health check ID reference
  healthCheckId: dnsStack.healthCheckId,
  description: 'Zmanim Lab - CloudWatch alarm for health check in us-east-1',
});
healthCheckAlarmStack.addDependency(dnsStack);

// ==========================================================================
// Story 7.11: NextjsLambdaStack - Lambda + CloudFront for Next.js SSR
// ==========================================================================
// Uses OpenNext + cdk-nextjs-standalone to deploy Next.js as:
// - Lambda functions for SSR/API routes
// - S3 for static assets
// - CloudFront for CDN
// Cost: ~$1-5/month for low traffic (pay per request)
const nextjsStack = new NextjsLambdaStack(app, `${config.stackPrefix}Nextjs`, {
  config,
  env,
  crossRegionReferences: true, // Certificate is in us-east-1
  certificate: certificateStack.certificate,
  hostedZone: dnsZoneStack.hostedZone,
  description: 'Zmanim Lab - Next.js SSR via Lambda + CloudFront',
});
nextjsStack.addDependency(certificateStack);
nextjsStack.addDependency(dnsZoneStack);

// Apply tags to all stacks
cdk.Tags.of(app).add('Project', 'zmanim');
cdk.Tags.of(app).add('Environment', config.environment);
cdk.Tags.of(app).add('ManagedBy', 'cdk');

app.synth();
