import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Nextjs } from 'cdk-nextjs-standalone';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

/**
 * NextjsLambdaStack - Deploy Next.js SSR via Lambda + CloudFront
 *
 * Story 7.11: Production Deployment
 *
 * Uses OpenNext + cdk-nextjs-standalone to deploy Next.js as:
 * - Lambda functions for SSR/API routes
 * - S3 for static assets
 * - CloudFront for CDN
 *
 * Cost estimate: ~$1-5/month for low traffic (pay per request)
 */
export interface NextjsLambdaStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  certificate: acm.ICertificate;
  hostedZone: route53.IHostedZone;
}

export class NextjsLambdaStack extends cdk.Stack {
  public readonly distribution: cloudfront.IDistribution;
  public readonly url: string;

  constructor(scope: Construct, id: string, props: NextjsLambdaStackProps) {
    super(scope, id, props);

    const { config, certificate, hostedZone } = props;

    // Fetch runtime secrets from SSM Parameter Store
    // Note: NEXT_PUBLIC_* vars must be set as shell env vars at build time
    // because they're baked into the client bundle during static generation
    const ssmPrefix = `/zmanim/${config.environment}`;
    const clerkSecretKey = ssm.StringParameter.valueForStringParameter(
      this,
      `${ssmPrefix}/clerk-secret-key`
    );

    // Deploy Next.js with Lambda + CloudFront
    // NEXT_PUBLIC_* env vars are set in GitHub Actions workflow at build time
    const nextjs = new Nextjs(this, 'NextjsSite', {
      nextjsPath: '../web', // Path to Next.js app relative to infrastructure/

      // Runtime environment variables for the Lambda functions
      // NEXT_PUBLIC_* are already baked in at build time
      environment: {
        CLERK_SECRET_KEY: clerkSecretKey,
      },

      // Custom domain configuration
      domainProps: {
        domainName: config.domain,
        certificate: certificate,
        hostedZone: hostedZone,
      },
    });

    this.distribution = nextjs.distribution.distribution;
    this.url = `https://${config.domain}`;

    // Outputs
    new cdk.CfnOutput(this, 'NextjsUrl', {
      value: this.url,
      description: 'Next.js site URL',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: nextjs.distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
