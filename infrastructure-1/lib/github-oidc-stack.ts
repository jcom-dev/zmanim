import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * GitHub OIDC Stack
 *
 * Creates OIDC provider and IAM role for GitHub Actions to deploy CDK
 * without static AWS credentials. Uses federated identity with GitHub's
 * OIDC provider.
 *
 * This stack must be deployed FIRST (bootstrap) before the GitHub Actions
 * workflow can use OIDC authentication.
 */

export interface GitHubOidcStackProps extends cdk.StackProps {
  /**
   * GitHub repository in format "owner/repo"
   */
  readonly githubRepo: string;

  /**
   * GitHub branches/refs allowed to assume the role
   * @default ["main"] - only main branch
   */
  readonly allowedRefs?: string[];
}

export class GitHubOidcStack extends cdk.Stack {
  /**
   * The IAM role ARN that GitHub Actions will assume
   */
  public readonly roleArn: string;

  /**
   * The IAM role name
   */
  public readonly roleName: string;

  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const { githubRepo } = props;

    // GitHub's OIDC provider thumbprint (constant, provided by GitHub)
    // See: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
    const githubOidcThumbprint = '6938fd4d98bab03faadb97b34396831e3780aea1';

    // Create OIDC provider for GitHub Actions
    // This is idempotent - if it exists, CDK will use the existing one
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: [githubOidcThumbprint],
    });

    // Build the trust policy conditions for the specific repo and refs
    // Format varies by trigger type:
    // - push: repo:<owner>/<repo>:ref:refs/heads/<branch>
    // - tag: repo:<owner>/<repo>:ref:refs/tags/<tag>
    // - workflow_dispatch: repo:<owner>/<repo>:ref:refs/heads/<branch>
    // - pull_request: repo:<owner>/<repo>:pull_request
    // Using wildcard to allow all refs from this specific repo
    const allowedSubjects = [
      `repo:${githubRepo}:*`, // Allow all refs from this repo (branches, tags, workflow_dispatch, etc.)
    ];

    // Create IAM role that GitHub Actions can assume
    const deployRole = new iam.Role(this, 'GitHubActionsDeployRole', {
      roleName: 'github-actions-cdk-deploy',
      description: `CDK deployment role for GitHub Actions (${githubRepo})`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': allowedSubjects,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Attach CDK deployment permissions
    // Using AdministratorAccess for CDK is common but can be scoped down
    // For production, consider creating a custom policy with least privilege
    deployRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
    );

    // Store outputs for reference
    this.roleArn = deployRole.roleArn;
    this.roleName = deployRole.roleName;

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'OidcProviderArn', {
      value: oidcProvider.openIdConnectProviderArn,
      description: 'GitHub OIDC Provider ARN',
      exportName: 'GitHubOidcProviderArn',
    });

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'IAM Role ARN for GitHub Actions to assume',
      exportName: 'GitHubActionsDeployRoleArn',
    });

    new cdk.CfnOutput(this, 'DeployRoleName', {
      value: deployRole.roleName,
      description: 'IAM Role name for GitHub Actions',
      exportName: 'GitHubActionsDeployRoleName',
    });
  }
}
