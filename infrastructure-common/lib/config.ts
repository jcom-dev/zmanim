/**
 * Configuration for Shtetl Common infrastructure
 *
 * This provides shared configuration for all Shtetl projects.
 */

export interface CommonConfig {
  /** AWS region for primary resources */
  region: string;
  /** AWS region for CloudFront-related resources (must be us-east-1) */
  usEast1Region: string;
  /** State bucket name for Terraform state */
  stateBucketName: string;
  /** Domain name (shtetl.io) */
  domainName: string;
  /** Route53 hosted zone ID (existing zone) */
  hostedZoneId: string;
  /** GitHub organization for OIDC */
  githubOrg: string;
  /** VPC CIDR block */
  vpcCidr: string;
  /** Public subnet CIDR */
  publicSubnetCidr: string;
  /** Availability zone */
  availabilityZone: string;
  /** Default tags for all resources */
  defaultTags: Record<string, string>;
}

/**
 * Shtetl Common configuration
 */
export const commonConfig: CommonConfig = {
  region: "eu-west-1",
  usEast1Region: "us-east-1",
  stateBucketName: "shtetl-tf",
  domainName: "shtetl.io",
  hostedZoneId: "Z079919527B3JRWEWJVH6",
  githubOrg: "jcom-dev",
  vpcCidr: "10.0.0.0/16",
  publicSubnetCidr: "10.0.1.0/24",
  availabilityZone: "eu-west-1a",
  defaultTags: {
    ManagedBy: "terraform",
    Project: "shtetl",
  },
};
