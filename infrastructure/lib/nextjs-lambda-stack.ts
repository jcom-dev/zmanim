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

    // Fetch secrets from SSM Parameter Store
    const clerkPublishableKey = ssm.StringParameter.valueForStringParameter(
      this,
      `/${config.ssmPrefix}/clerk-publishable-key`
    );
    const clerkSecretKey = ssm.StringParameter.valueForStringParameter(
      this,
      `/${config.ssmPrefix}/clerk-secret-key`
    );

    // Deploy Next.js with Lambda + CloudFront
    const nextjs = new Nextjs(this, 'NextjsSite', {
      nextjsPath: '../web', // Path to Next.js app relative to infrastructure/

      // Environment variables for the Next.js app
      environment: {
        NEXT_PUBLIC_API_URL: `https://${config.domain}`,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
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
