#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { ComputeStack } from '../lib/compute-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { StorageStack } from '../lib/storage-stack';
import { SecretsStack } from '../lib/secrets-stack';
import { CertificateStack, DnsZoneStack, DnsStack, HealthCheckAlarmStack } from '../lib/dns-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';
import { NextjsLambdaStack } from '../lib/nextjs-lambda-stack';
import { getConfig, getCdkEnvironment } from '../lib/config';

/**
 * Zmanim Lab AWS Infrastructure
 *
 * Stack Dependency Graph (Simplified - CdnStack merged into NextjsLambdaStack):
 *
 *   StorageStack (no dependencies)
 *       │
 *   SecretsStack (no dependencies) [Story 7.9]
 *       │
 *   NetworkStack (no dependencies)
 *       │
 *   ApiGatewayStack (no dependencies, creates Elastic IP) [Story 7.7]
 *       ↓
 *   ComputeStack (depends on Network, Secrets, ApiGateway for VPC/SSM/EIP)
 *       │
 *   DnsZoneStack (depends on ApiGateway for Elastic IP)
 *       ↓
 *   CertificateStack (in us-east-1! depends on DnsZone) [Story 7.8]
 *       ↓
 *   NextjsLambdaStack (depends on Certificate, DnsZone, ApiGateway)
 *       ↓                 - Merged CloudFront distribution for Next.js + API
 *       ↓                 - Routes /api/* to API Gateway
 *       ↓                 - Routes all other requests to Next.js Lambda
 *   DnsStack (depends on Nextjs, DnsZone → A record alias, health check)
 *       ↓
 *   HealthCheckAlarmStack (in us-east-1! depends on DnsStack) [Story 7.8]
 *
 * Stack Separation:
 * - StorageStack: S3 buckets for backups and releases (infrastructure storage)
 * - SecretsStack: SSM Parameter Store secrets (Story 7.9)
 * - NextjsLambdaStack: Merged CloudFront for Next.js SSR + API routing
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

// ApiGatewayStack - HTTP API, JWT authorizer, throttling, Elastic IP
// Story 7.7: Routes requests to EC2 with Clerk JWT validation
// Creates the Elastic IP so it doesn't depend on ComputeStack
const apiGatewayStack = new ApiGatewayStack(app, `${config.stackPrefix}ApiGateway`, {
  config,
  env,
  description: 'Zmanim Lab - API Gateway (HTTP API, JWT auth, throttling)',
});

// ComputeStack - EC2, EBS, IAM (depends on NetworkStack, SecretsStack, ApiGatewayStack)
// Depends on ApiGatewayStack for the Elastic IP to associate with EC2
const computeStack = new ComputeStack(app, `${config.stackPrefix}Compute`, {
  config,
  env,
  vpc: networkStack.vpc,
  securityGroup: networkStack.ec2SecurityGroup,
  elasticIp: apiGatewayStack.elasticIp,
  description: 'Zmanim Lab - Compute infrastructure (EC2, EBS, IAM)',
});
computeStack.addDependency(networkStack);
computeStack.addDependency(secretsStack); // SecretsStack imports existing SSM parameters
computeStack.addDependency(apiGatewayStack); // ApiGatewayStack creates the Elastic IP

// DnsZoneStack - Route53 hosted zone + API origin A record (depends on ApiGateway for Elastic IP)
const dnsZoneStack = new DnsZoneStack(app, `${config.stackPrefix}DnsZone`, {
  config,
  env,
  elasticIp: apiGatewayStack.elasticIp,
  description: 'Zmanim Lab - Route53 hosted zone for shtetl.io',
});
dnsZoneStack.addDependency(apiGatewayStack);

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

// ==========================================================================
// Story 7.11: NextjsLambdaStack - Lambda + CloudFront for Next.js SSR + API
// ==========================================================================
// MERGED: Previously CdnStack and NextjsLambdaStack were separate. Now merged
// into a single CloudFront distribution that handles both:
// - Next.js SSR via Lambda (default behavior)
// - API routes via API Gateway origin (/api/*)
//
// Uses OpenNext + cdk-nextjs-standalone to deploy Next.js as:
// - Lambda functions for SSR
// - S3 for static assets
// - CloudFront for CDN with custom API behaviors
// Cost: ~$1-5/month for low traffic (pay per request)

// Extract API Gateway domain from endpoint URL (https://xyz.execute-api.../  -> xyz.execute-api...)
const apiGatewayDomain = cdk.Fn.select(2, cdk.Fn.split('/', apiGatewayStack.httpApi.apiEndpoint));

const nextjsStack = new NextjsLambdaStack(app, `${config.stackPrefix}Nextjs`, {
  config,
  env,
  crossRegionReferences: true, // Certificate is in us-east-1
  certificate: certificateStack.certificate,
  hostedZone: dnsZoneStack.hostedZone,
  apiGatewayDomain: apiGatewayDomain, // For /api/* routing to API Gateway
  description: 'Zmanim Lab - Next.js SSR + API via Lambda + CloudFront',
});
nextjsStack.addDependency(certificateStack);
nextjsStack.addDependency(dnsZoneStack);
nextjsStack.addDependency(apiGatewayStack); // Needs API Gateway for /api/* routing

// DNSStack - A record alias, health check (depends on Nextjs + DnsZone)
// Story 7.8: Uses NextjsLambdaStack's CloudFront distribution (merged from CdnStack)
const dnsStack = new DnsStack(app, `${config.stackPrefix}DNS`, {
  config,
  env,
  crossRegionReferences: true, // Required for cross-region health check ID export
  distribution: nextjsStack.distribution, // Now using merged NextJS distribution
  hostedZone: dnsZoneStack.hostedZone,
  certificateArn: certificateStack.certificate.certificateArn,
  description: 'Zmanim Lab - DNS infrastructure (A record alias, health check)',
});
dnsStack.addDependency(nextjsStack); // Changed from cdnStack
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

// Apply tags to all stacks
cdk.Tags.of(app).add('Project', 'zmanim');
cdk.Tags.of(app).add('Environment', config.environment);
cdk.Tags.of(app).add('ManagedBy', 'cdk');

app.synth();
