import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Nextjs } from 'cdk-nextjs-standalone';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

/**
 * NextjsLambdaStack - Deploy Next.js SSR via Lambda + CloudFront
 *
 * Story 7.11: Production Deployment (Updated to merge CDN + API routing)
 *
 * Uses OpenNext + cdk-nextjs-standalone to deploy Next.js as:
 * - Lambda functions for SSR/API routes
 * - S3 for static assets
 * - CloudFront for CDN
 * - API Gateway origin for /api/* routes (merged from CdnStack)
 *
 * Cost estimate: ~$1-5/month for low traffic (pay per request)
 */
export interface NextjsLambdaStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  certificate: acm.ICertificate;
  hostedZone: route53.IHostedZone;
  apiGatewayDomain: string; // API Gateway domain (e.g., xyz.execute-api.eu-west-1.amazonaws.com)
}

export class NextjsLambdaStack extends cdk.Stack {
  public readonly distribution: cloudfront.IDistribution;
  public readonly url: string;

  constructor(scope: Construct, id: string, props: NextjsLambdaStackProps) {
    super(scope, id, props);

    const { config, certificate, hostedZone, apiGatewayDomain } = props;

    // =========================================================================
    // API Gateway Origin and Behaviors (merged from CdnStack)
    // =========================================================================
    // Route /api/* requests to API Gateway instead of Next.js Lambda
    // API Gateway handles JWT auth, throttling, and proxies to EC2 backend

    const apiOrigin = new origins.HttpOrigin(apiGatewayDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      originShieldEnabled: true,
      originShieldRegion: 'eu-west-1', // Same as primary region
    });

    // Cache Policy: API Zmanim - 1 hour TTL for cacheable zmanim calculations
    const apiZmanimCachePolicy = new cloudfront.CachePolicy(this, 'ApiZmanimCachePolicy', {
      cachePolicyName: `${config.stackPrefix}-ApiZmanimCache`,
      comment: 'Cache policy for zmanim API endpoints - 1 hour TTL',
      defaultTtl: cdk.Duration.hours(1),
      maxTtl: cdk.Duration.hours(24),
      minTtl: cdk.Duration.minutes(1),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept-Language'),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Origin Request Policy: Forward necessary headers for API
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
      originRequestPolicyName: `${config.stackPrefix}-ApiOriginRequest`,
      comment: 'Forward headers for API requests',
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'Accept',
        'Accept-Language',
        'Content-Type',
        'X-Publisher-Id',
        'X-Request-Id',
        'Origin',
        'Referer'
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
    });

    // Response Headers Policy: Security Headers
    const securityHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      responseHeadersPolicyName: `${config.stackPrefix}-SecurityHeaders`,
      comment: 'Security headers for API responses',
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          override: true,
          preload: true,
        },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    // Common API behavior options (reused for multiple patterns)
    const apiBehaviorOptions: cloudfront.AddBehaviorOptions = {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: apiOriginRequestPolicy,
      responseHeadersPolicy: securityHeadersPolicy,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      compress: true,
    };

    // Zmanim-specific behavior with caching
    const apiZmanimBehaviorOptions: cloudfront.AddBehaviorOptions = {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: apiZmanimCachePolicy,
      originRequestPolicy: apiOriginRequestPolicy,
      responseHeadersPolicy: securityHeadersPolicy,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      compress: true,
    };

    // =========================================================================
    // Deploy Next.js with Lambda + CloudFront
    // =========================================================================
    // All env vars are passed via shell environment at build time
    // because SSM SecureString parameters can't be resolved by CloudFormation
    const nextjs = new Nextjs(this, 'NextjsSite', {
      nextjsPath: '../web', // Path to Next.js app relative to infrastructure/

      // Environment variables passed via shell env during CDK synth
      // See .github/workflows/deploy-prod.yml for the actual values
      // NEXT_PUBLIC_* vars are inlined at build time by Next.js
      environment: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://zmanim.shtetl.io',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
      },

      // Custom domain configuration
      domainProps: {
        domainName: config.domain,
        certificate: certificate,
        hostedZone: hostedZone,
      },

      // Override distribution settings (but NOT additionalBehaviors - see below)
      overrides: {
        nextjsDistribution: {
          distributionProps: {
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // USA, Canada, Europe, Israel
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
          },
        },
      },
    });

    // =========================================================================
    // Route Go API via /backend/* path prefix
    // =========================================================================
    // cdk-nextjs-standalone automatically adds an 'api/*' behavior pointing to
    // Next.js Lambda. Since CloudFront requires unique path patterns and we can't
    // override the library's behavior, we use '/backend/*' for the Go API instead.
    //
    // Frontend API client should be updated to use /backend/ prefix.
    // API Gateway maps: /backend/* -> /api/v1/* on the Go backend.

    const distribution = nextjs.distribution.distribution;

    // Add backend API behaviors (using /backend/* to avoid conflict with api/*)
    distribution.addBehavior('backend/zmanim/*', apiOrigin, apiZmanimBehaviorOptions);
    distribution.addBehavior('backend/*', apiOrigin, apiBehaviorOptions);

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
