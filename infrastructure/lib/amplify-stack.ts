import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

/**
 * AmplifyStack - AWS Amplify Hosting for Next.js SSR
 *
 * Story 7.11: Production Deployment GitHub Workflow
 *
 * This stack creates an Amplify app for hosting the Next.js frontend with:
 * - SSR support for dynamic routes (Clerk auth, zmanim pages)
 * - GitHub integration for automatic deployments
 * - Custom domain configuration (zmanim.shtetl.io)
 * - Environment variables from SSM Parameter Store
 *
 * Benefits over static S3 hosting:
 * - Full SSR support for dynamic routes
 * - Automatic builds on git push
 * - Preview deployments for PRs
 * - Built-in CI/CD
 */
export interface AmplifyStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  hostedZoneId?: string;
  certificateArn?: string;
}

export class AmplifyStack extends cdk.Stack {
  public readonly amplifyApp: amplify.CfnApp;
  public readonly mainBranch: amplify.CfnBranch;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    const { config } = props;

    // IAM role for Amplify to access resources
    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'IAM role for Amplify to access SSM parameters and other resources',
    });

    // Allow Amplify to read SSM parameters for environment variables
    amplifyRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/zmanim/*`],
      })
    );

    // Create Amplify App using CloudFormation (L1 construct for full control)
    // Note: Using CfnApp because the L2 amplify.App construct has limited SSR support
    this.amplifyApp = new amplify.CfnApp(this, 'AmplifyApp', {
      name: `zmanim-${config.environment}`,
      description: 'Zmanim Lab - Next.js SSR frontend',

      // GitHub repository configuration
      repository: 'https://github.com/jcom-dev/zmanim',
      accessToken: cdk.SecretValue.secretsManager('github-access-token').unsafeUnwrap(),

      // Build settings for Next.js SSR
      buildSpec: cdk.Fn.sub(`
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - cd web
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: web/.next
        files:
          - '**/*'
      cache:
        paths:
          - web/node_modules/**/*
          - web/.next/cache/**/*
    appRoot: web
`),

      // Platform for SSR (WEB_COMPUTE for SSR, WEB for static)
      platform: 'WEB_COMPUTE',

      // Environment variables
      // Note: NEXT_PUBLIC_* vars are safe to hardcode (they're public)
      // CLERK_SECRET_KEY is for SSR - passed via ssm-secure dynamic reference
      environmentVariables: [
        {
          name: 'NEXT_PUBLIC_API_URL',
          value: `https://${config.domain}`,
        },
        {
          name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
          // Public key - safe to embed directly
          value: 'pk_live_Y2xlcmsuem1hbmltLnNodGV0bC5pbyQ',
        },
        {
          name: 'AMPLIFY_MONOREPO_APP_ROOT',
          value: 'web',
        },
      ],

      // IAM service role
      iamServiceRole: amplifyRole.roleArn,

      // Custom headers for security
      customHeaders: `
customHeaders:
  - pattern: '**/*'
    headers:
      - key: 'Strict-Transport-Security'
        value: 'max-age=31536000; includeSubDomains'
      - key: 'X-Frame-Options'
        value: 'DENY'
      - key: 'X-Content-Type-Options'
        value: 'nosniff'
`,
    });

    // Main branch configuration
    this.mainBranch = new amplify.CfnBranch(this, 'MainBranch', {
      appId: this.amplifyApp.attrAppId,
      branchName: 'main',
      description: 'Production branch',
      enableAutoBuild: true,
      enablePullRequestPreview: false,
      stage: 'PRODUCTION',

      // Framework detection
      framework: 'Next.js - SSR',
    });

    // Custom domain configuration
    const customDomain = new amplify.CfnDomain(this, 'CustomDomain', {
      appId: this.amplifyApp.attrAppId,
      domainName: config.domain,
      subDomainSettings: [
        {
          branchName: this.mainBranch.branchName,
          prefix: '', // Root domain (zmanim.shtetl.io)
        },
      ],
      enableAutoSubDomain: false,
    });
    customDomain.addDependency(this.mainBranch);

    // Outputs
    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.amplifyApp.attrAppId,
      exportName: `${config.stackPrefix}-AmplifyAppId`,
      description: 'Amplify App ID',
    });

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: `https://main.${this.amplifyApp.attrDefaultDomain}`,
      exportName: `${config.stackPrefix}-AmplifyAppUrl`,
      description: 'Amplify default URL',
    });

    new cdk.CfnOutput(this, 'AmplifyCustomDomain', {
      value: `https://${config.domain}`,
      exportName: `${config.stackPrefix}-AmplifyCustomDomain`,
      description: 'Custom domain URL',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Purpose', 'Frontend Hosting');
  }
}
