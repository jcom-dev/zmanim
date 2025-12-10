#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { ComputeStack } from '../lib/compute-stack';
import { CdnStack } from '../lib/cdn-stack';
import { DnsZoneStack, DnsStack } from '../lib/dns-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';
import { getConfig, getCdkEnvironment } from '../lib/config';

/**
 * Zmanim Lab AWS Infrastructure
 *
 * Stack Dependency Graph:
 *
 *   NetworkStack (no dependencies)
 *       ↓
 *   ComputeStack (depends on Network for VPC/subnets)
 *       ↓
 *   DnsZoneStack (depends on Compute for Elastic IP → creates hosted zone + origin A record)
 *       ↓
 *   CDNStack (depends on DnsZone for origin domain)
 *       ↓
 *   DnsStack (depends on CDN for distribution + DnsZone for hosted zone)
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

// NetworkStack - VPC, subnets, security groups (no dependencies)
const networkStack = new NetworkStack(app, `${config.stackPrefix}Network`, {
  config,
  env,
  description: 'Zmanim Lab - Network infrastructure (VPC, subnets, security groups)',
});

// ComputeStack - EC2, EBS, IAM (depends on NetworkStack)
const computeStack = new ComputeStack(app, `${config.stackPrefix}Compute`, {
  config,
  env,
  vpc: networkStack.vpc,
  securityGroup: networkStack.ec2SecurityGroup,
  description: 'Zmanim Lab - Compute infrastructure (EC2, EBS, IAM)',
});
computeStack.addDependency(networkStack);

// DnsZoneStack - Route53 hosted zone + API origin A record (depends on Compute for Elastic IP)
const dnsZoneStack = new DnsZoneStack(app, `${config.stackPrefix}DnsZone`, {
  config,
  env,
  elasticIp: computeStack.elasticIp,
  description: 'Zmanim Lab - Route53 hosted zone for shtetl.io',
});
dnsZoneStack.addDependency(computeStack);

// CDNStack - CloudFront, S3 (depends on DnsZone for origin domain)
const cdnStack = new CdnStack(app, `${config.stackPrefix}CDN`, {
  config,
  env,
  apiOriginDomain: dnsZoneStack.apiOriginDomain,
  description: 'Zmanim Lab - CDN infrastructure (CloudFront, S3)',
});
cdnStack.addDependency(dnsZoneStack);

// DNSStack - ACM certificate, CloudFront alias (depends on CDN + DnsZone)
// NOTE: For CloudFront, certificate must be in us-east-1
// Story 7.8 will handle the cross-region certificate requirement
const dnsStack = new DnsStack(app, `${config.stackPrefix}DNS`, {
  config,
  env,
  crossRegionReferences: true, // Enable for future us-east-1 cert references
  distribution: cdnStack.distribution,
  hostedZone: dnsZoneStack.hostedZone,
  description: 'Zmanim Lab - DNS infrastructure (ACM certificate, CloudFront alias)',
});
dnsStack.addDependency(cdnStack);
dnsStack.addDependency(dnsZoneStack);

// Apply tags to all stacks
cdk.Tags.of(app).add('Project', 'zmanim');
cdk.Tags.of(app).add('Environment', config.environment);
cdk.Tags.of(app).add('ManagedBy', 'cdk');

app.synth();
