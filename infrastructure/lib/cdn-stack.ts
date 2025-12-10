import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface CdnStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  apiOriginDomain: string; // Domain name pointing to EC2 (e.g., origin-api.zmanim.shtetl.io)
  certificate?: acm.ICertificate;
}

/**
 * CDNStack - CloudFront distribution and static assets bucket
 *
 * Architecture (Story 7.6):
 * - CloudFront distribution with Origin Shield (eu-west-1)
 * - Origin 1: API Gateway (dynamic, 1hr cache for zmanim, no cache for auth)
 * - Origin 2: S3 bucket (static assets, 1yr cache for _next/static)
 * - Behaviors: /api/* → API, /_next/static/* → S3 (long cache), /* → S3
 * - HTTPS only with HTTP redirect, TLSv1.2 minimum
 * - SPA routing CloudFront Function for client-side routes
 * - Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
 *
 * Note: Backups and releases buckets are in StorageStack (not CDN-related)
 *
 * Cache Hit Ratio Target: >80% for zmanim calculations
 */
export class CdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly staticBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    const { config, apiOriginDomain, certificate } = props;

    // S3 bucket for static assets (Next.js export)
    // Story 7.5: AC3 - zmanim-static-prod bucket for Next.js assets
    // - AES-256 server-side encryption
    // - Block all public access (CloudFront OAC handles access)
    // - No lifecycle rules (content is replaced on deploy)
    this.staticBucket = new s3.Bucket(this, 'StaticBucket', {
      bucketName: `zmanim-static-${config.environment}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED, // AES-256 server-side encryption
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // CloudFront OAC handles access - configured via S3BucketOrigin.withOriginAccessControl()
    });

    // ==========================================================================
    // Story 7.6: CloudFront Distribution with Full Configuration
    // ==========================================================================

    // S3 origin with Origin Access Control (OAC) - replaces deprecated OAI
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.staticBucket, {
      originShieldEnabled: true,
      originShieldRegion: 'eu-west-1', // AC1: Origin Shield in eu-west-1 (same as origin)
    });

    // API origin pointing to EC2 via origin-api subdomain
    // Story 7.6: AC2 - API Gateway origin (actually EC2 via Route53)
    const apiOrigin = new origins.HttpOrigin(apiOriginDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY, // AC2.2: HTTPS only to origin
      httpsPort: 443,
      originShieldEnabled: true,
      originShieldRegion: 'eu-west-1', // Origin Shield for API requests too
    });

    // Cache Policy: API Zmanim - 1 hour TTL (AC2.3)
    // For /api/zmanim/* endpoints - cacheable calculation results
    const apiZmanimCachePolicy = new cloudfront.CachePolicy(this, 'ApiZmanimCachePolicy', {
      cachePolicyName: `${config.stackPrefix}-ApiZmanimCache`,
      comment: 'Cache policy for zmanim API endpoints - 1 hour TTL',
      defaultTtl: cdk.Duration.hours(1), // AC2.3: 1 hour default
      maxTtl: cdk.Duration.hours(24),
      minTtl: cdk.Duration.minutes(1),
      // Include query strings in cache key (date, location params)
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      // Include Accept-Language header for localized responses
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept-Language'),
      // Enable compression
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Cache Policy: Static Assets - 1 year TTL (AC3.2)
    // For /_next/static/* - immutable hashed assets
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
      cachePolicyName: `${config.stackPrefix}-StaticAssetsCache`,
      comment: 'Cache policy for immutable static assets - 1 year TTL',
      defaultTtl: cdk.Duration.days(365), // AC3.2: 1 year for /_next/static/*
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.days(365), // Force long cache
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Cache Policy: HTML/Default - 1 day TTL (AC3.3)
    // For HTML pages and other static files
    const htmlCachePolicy = new cloudfront.CachePolicy(this, 'HtmlCachePolicy', {
      cachePolicyName: `${config.stackPrefix}-HtmlCache`,
      comment: 'Cache policy for HTML pages and other static files - 1 day TTL',
      defaultTtl: cdk.Duration.days(1), // AC3.3: 1 day for HTML
      maxTtl: cdk.Duration.days(7),
      minTtl: cdk.Duration.seconds(0),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Origin Request Policy: Forward necessary headers for API
    // AC2.5: Forward headers for API requests
    // Note: Authorization header forwarding is handled automatically when
    // cache behavior specifies CACHING_DISABLED or when included in cache key.
    // CloudFront prohibits Authorization in origin request policy header list.
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
      originRequestPolicyName: `${config.stackPrefix}-ApiOriginRequest`,
      comment: 'Forward headers for API requests',
      // Forward relevant headers except Host (CloudFront replaces it with origin domain)
      // Authorization is forwarded automatically when using CACHING_DISABLED
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

    // Response Headers Policy: Security Headers (AC5.3)
    // HSTS, X-Frame-Options, X-Content-Type-Options
    const securityHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      responseHeadersPolicyName: `${config.stackPrefix}-SecurityHeaders`,
      comment: 'Security headers for HTTPS, frame protection, content type',
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365), // HSTS max-age
          includeSubdomains: true,
          override: true,
          preload: true,
        },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY, // X-Frame-Options: DENY
          override: true,
        },
        contentTypeOptions: {
          override: true, // X-Content-Type-Options: nosniff
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

    // CloudFront Function: SPA Routing (AC4.4, Task 7)
    // Rewrites requests without file extension to /index.html for client-side routing
    const spaRoutingFunction = new cloudfront.Function(this, 'SpaRoutingFunction', {
      functionName: `${config.stackPrefix}-SpaRouting`,
      comment: 'Rewrite requests without extension to /index.html for SPA routing',
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // If URI has no file extension and doesn't start with /api/, serve index.html
  // This enables client-side routing for the Next.js SPA
  if (!uri.includes('.') && !uri.startsWith('/api/') && !uri.startsWith('/_next/')) {
    request.uri = '/index.html';
  }

  // Handle trailing slash (redirect /path/ to /path)
  if (uri.endsWith('/') && uri.length > 1) {
    request.uri = uri.slice(0, -1);
  }

  return request;
}
`),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // CloudFront Distribution (Story 7.6)
    // AC1: Origin Shield in eu-west-1
    // AC2-4: Multiple behaviors with appropriate cache policies
    // AC5: HTTPS only, TLSv1.2 minimum
    // AC6: Custom domain (certificate reference)
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Zmanim CDN - ${config.environment}`,
      defaultRootObject: 'index.html', // Task 1.4

      // Default behavior: S3 static files (AC3, AC4.3)
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // AC5.1
        cachePolicy: htmlCachePolicy, // 1 day cache for HTML
        responseHeadersPolicy: securityHeadersPolicy, // AC5.3
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true, // AC3.4: Enable compression
        functionAssociations: [
          {
            function: spaRoutingFunction, // Task 7.3: SPA routing
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },

      additionalBehaviors: {
        // Behavior: /api/zmanim/* - Cacheable zmanim calculations (AC2.3)
        '/api/zmanim/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: apiZmanimCachePolicy, // 1 hour cache
          originRequestPolicy: apiOriginRequestPolicy, // AC2.5
          responseHeadersPolicy: securityHeadersPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: true,
        },

        // Behavior: /api/* - No cache for auth, mutations (AC2.4)
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // No cache
          originRequestPolicy: apiOriginRequestPolicy,
          responseHeadersPolicy: securityHeadersPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: true,
        },

        // Behavior: /_next/static/* - Immutable assets (AC3.2, AC4.2)
        '/_next/static/*': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy, // 1 year cache
          responseHeadersPolicy: securityHeadersPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          compress: true, // AC3.4
        },
      },

      // AC6: Custom domain with certificate
      // Certificate must be in us-east-1 for CloudFront
      // Story 7.8 will create the us-east-1 certificate; for now, use optional prop
      ...(certificate && {
        domainNames: [config.domain], // zmanim.shtetl.io
        certificate: certificate,
      }),

      // AC1.3: Price class for US, EU, Israel edges
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,

      // AC5.2: Minimum TLS version
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,

      // Enable distribution
      enabled: true,

      // Enable logging for cache hit ratio analysis
      enableLogging: true,
      logBucket: this.staticBucket, // Reuse static bucket for logs
      logFilePrefix: 'cloudfront-logs/',
    });

    // Outputs
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      exportName: `${config.stackPrefix}-DistributionId`,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
      exportName: `${config.stackPrefix}-DistributionDomain`,
      description: 'CloudFront distribution domain name',
    });

    // Task 6.3: Export distribution ARN for Route53 alias
    new cdk.CfnOutput(this, 'DistributionArn', {
      value: `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
      exportName: `${config.stackPrefix}-DistributionArn`,
      description: 'CloudFront distribution ARN for Route53 alias',
    });

    new cdk.CfnOutput(this, 'StaticBucketName', {
      value: this.staticBucket.bucketName,
      exportName: `${config.stackPrefix}-StaticBucket`,
      description: 'S3 bucket for static assets',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
