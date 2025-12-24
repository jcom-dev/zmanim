/**
 * Configuration for Zmanim infrastructure
 */

export interface ZmanimConfig {
  /** Environment name */
  environment: "prod";
  /** AWS region for primary resources */
  region: string;
  /** AWS region for CloudFront ACM certificate and Route53 health check metrics */
  usEast1Region: string;
  /** Domain name (zmanim.shtetl.io) */
  domain: string;
  /** Base domain (shtetl.io) */
  baseDomain: string;
  /** State bucket name for Terraform state */
  stateBucketName: string;
  /** Route53 hosted zone ID */
  hostedZoneId: string;
  /** EC2 instance type */
  instanceType: string;
  /** EBS data volume size in GB */
  dataVolumeSize: number;
  /** Default tags for all resources */
  defaultTags: Record<string, string>;
  // Note: SSH key is now managed by shtetl-common stack and referenced via remote state
}

/**
 * Zmanim Production configuration
 */
export const zmanimConfig: ZmanimConfig = {
  environment: "prod",
  region: "eu-west-1",
  usEast1Region: "us-east-1",
  domain: "zmanim.shtetl.io",
  baseDomain: "shtetl.io",
  stateBucketName: "shtetl-tf",
  hostedZoneId: "Z079919527B3JRWEWJVH6",
  instanceType: "t4g.small",
  dataVolumeSize: 40,
  defaultTags: {
    ManagedBy: "terraform",
    Project: "zmanim",
    Environment: "prod",
  },
};

/**
 * SSM Parameter paths for Zmanim secrets
 */
export const ssmPaths = {
  amiVersion: "/zmanim/prod/ami-version", // Version tag for AMI lookup (e.g., "v1.0.0")
  clerkDomain: "/zmanim/prod/clerk-domain",
  clerkAudience: "/zmanim/prod/clerk-audience",
  originVerifyKey: "/zmanim/prod/origin-verify-key",
  postgresPassword: "/zmanim/prod/postgres-password",
  redisPassword: "/zmanim/prod/redis-password",
  clerkSecretKey: "/zmanim/prod/clerk-secret-key",
  clerkPublishableKey: "/zmanim/prod/clerk-publishable-key",
  resticPassword: "/zmanim/prod/restic-password",
  jwtSecret: "/zmanim/prod/jwt-secret",
  mapboxPublicToken: "/zmanim/prod/mapbox-public-token",
  mapboxApiKey: "/zmanim/prod/mapbox-api-key",
};
