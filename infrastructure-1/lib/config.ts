/**
 * Environment configuration for Zmanim Lab AWS infrastructure
 *
 * Key decisions from Epic 7 Architecture:
 * - Region: eu-west-1 (Ireland) - best latency balance for US + Israel users
 * - Stack naming: Zmanim{StackName}Prod pattern
 * - Production only - development stays on Fly.io/Vercel/Xata stack
 */

export type Environment = 'prod';

export interface EnvironmentConfig {
  /**
   * Environment name (prod only for now)
   */
  environment: Environment;

  /**
   * AWS region - eu-west-1 for production
   */
  region: string;

  /**
   * AWS account ID - loaded from environment variable
   */
  account: string;

  /**
   * Domain name for the application
   */
  domain: string;

  /**
   * Stack name prefix for CloudFormation resources
   */
  stackPrefix: string;

  /**
   * EC2 instance type
   */
  instanceType: string;

  /**
   * Admin IP CIDR for SSH access (e.g., VPN IP)
   * This should be set via environment variable for security
   */
  adminCidr?: string;
}

/**
 * Get configuration for the specified environment
 */
export function getConfig(env: Environment): EnvironmentConfig {
  const configs: Record<Environment, EnvironmentConfig> = {
    prod: {
      environment: 'prod',
      region: 'eu-west-1', // Ireland - best balance for US + Israel users
      account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID || '',
      domain: 'zmanim.shtetl.io',
      stackPrefix: 'ZmanimProd',
      instanceType: 'm7g.medium', // Graviton3 ARM64
      adminCidr: process.env.ADMIN_CIDR, // Optional, set via environment for security
    },
  };

  const config = configs[env];
  if (!config) {
    throw new Error(`Unknown environment: ${env}`);
  }

  // Validate required values
  if (!config.account) {
    console.warn(
      'Warning: AWS account not set. Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable.'
    );
  }

  return config;
}

/**
 * CDK environment settings for stack deployment
 *
 * For local development/synthesis without AWS credentials, uses
 * environment-agnostic mode if account is not set.
 */
export function getCdkEnvironment(config: EnvironmentConfig) {
  // If no account is set, return undefined to enable environment-agnostic mode
  // This allows `cdk synth` to work without AWS credentials
  if (!config.account) {
    return undefined;
  }

  return {
    account: config.account,
    region: config.region,
  };
}

// Export default production config for convenience
export const prodConfig = getConfig('prod');
