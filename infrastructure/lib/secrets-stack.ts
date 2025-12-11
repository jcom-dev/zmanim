import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface SecretsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

/**
 * SecretsStack - SSM Parameter Store configuration metadata
 *
 * Story 7.9: SSM Parameter Store Configuration
 *
 * IMPORTANT: This stack does NOT create SSM parameters - they are managed
 * manually via AWS CLI for security (secrets never in CDK code).
 *
 * This stack only:
 * 1. Documents the expected SSM parameter paths
 * 2. Exports the parameter prefix for other stacks
 * 3. Provides CloudFormation outputs with setup instructions
 *
 * The actual parameters were created using:
 *   aws ssm put-parameter --name /zmanim/prod/xxx --value "xxx" --type SecureString
 *
 * Expected Parameters:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  /zmanim/prod/clerk-secret-key      (SecureString)          │
 * │  /zmanim/prod/clerk-publishable-key (SecureString)          │
 * │  /zmanim/prod/postgres-password     (SecureString)          │
 * │  /zmanim/prod/redis-password        (SecureString)          │
 * │  /zmanim/prod/restic-password       (SecureString)          │
 * │  /zmanim/prod/clerk-domain          (String)                │
 * │  /zmanim/prod/clerk-audience        (String)                │
 * │  /zmanim/prod/origin-verify-key     (SecureString)          │
 * └─────────────────────────────────────────────────────────────┘
 *
 * The origin-verify-key is used to restrict direct EC2 access:
 * - API Gateway sends X-Origin-Verify header with this secret
 * - Go API middleware validates the header, rejecting direct requests
 * - This ensures all traffic goes through CloudFront -> API Gateway
 *
 * Cost: $0/month (SSM Standard tier + AWS-managed KMS key)
 */
export class SecretsStack extends cdk.Stack {
  // Export parameter prefix for use by other stacks
  public readonly parameterPrefix: string;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    const { config } = props;
    this.parameterPrefix = `/zmanim/${config.environment}`;

    // =========================================================================
    // CloudFormation Outputs
    // =========================================================================
    // This stack documents the SSM parameter configuration but does not
    // create or manage the parameters themselves (they're managed via CLI).

    new cdk.CfnOutput(this, 'ParameterPrefix', {
      value: this.parameterPrefix,
      exportName: `${config.stackPrefix}-SSMParameterPrefix`,
      description: 'SSM Parameter Store prefix for all Zmanim secrets',
    });

    new cdk.CfnOutput(this, 'ExpectedParameters', {
      value: [
        `${this.parameterPrefix}/clerk-secret-key`,
        `${this.parameterPrefix}/clerk-publishable-key`,
        `${this.parameterPrefix}/postgres-password`,
        `${this.parameterPrefix}/redis-password`,
        `${this.parameterPrefix}/restic-password`,
        `${this.parameterPrefix}/clerk-domain`,
        `${this.parameterPrefix}/clerk-audience`,
        `${this.parameterPrefix}/origin-verify-key`,
      ].join(', '),
      description: 'Expected SSM parameters (must be created via AWS CLI)',
    });

    new cdk.CfnOutput(this, 'VerifyCommand', {
      value: `aws ssm describe-parameters --parameter-filters "Key=Path,Values=${this.parameterPrefix}" --region ${config.region}`,
      description: 'Command to verify all expected parameters exist',
    });

    // =========================================================================
    // Tags
    // =========================================================================
    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Story', '7.9');
  }
}
