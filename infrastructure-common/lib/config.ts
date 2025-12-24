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
  /** SSH key pair name for EC2 instances */
  sshKeyName: string;
  /** SSH public key material */
  sshKeyPublic: string;
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
  sshKeyName: "dniasoff_keypair",
  sshKeyPublic: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDOhNxmkXI3lthcD9ufxEhrHqGnKI4kHosKb/ALYnlRwTl3ClVLSGgrGIwHlq7Zr/ozd7Ctoo0PWTyZo0+omqkSTW2zPdtbE+WpXgqyPEgsfKGYZOFcC5K4sM8GdMrwA0QHdI3nV4KN3Qo0P1VwnOSk4LzvGMs4YoSoiIKvWS7AsGselUOm2CzOrhG2lvmvrqbcAXrd7L6J/GTa7J/3twwjMB/YPKvgrb1Q9gUHMrr5i7bFdln66ci6DAxA+2/t3hyTDduVSc41NuIe8/Mp2Xl9cO8G1e5NVF4FyIKpqkbRl/fXQ/lb77CppqmymR1L9RNypYSMGH4fMerOnu8FpiGJ",
};
