import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface CdnStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  apiEndpoint: string; // EC2 Elastic IP or API Gateway URL
  certificate?: acm.ICertificate;
}

/**
 * CDNStack - CloudFront distribution, S3 buckets for static assets
 *
 * Architecture:
 * - CloudFront distribution with Origin Shield (eu-west-1)
 * - Origin 1: API Gateway (dynamic, 1hr cache for zmanim)
 * - Origin 2: S3 bucket (static assets, 1yr cache)
 * - Behaviors: /api/* → API, /* → S3
 * - HTTPS only with HTTP redirect
 *
 * Stories 7.5 (S3), 7.6 (CloudFront), 7.7 (API Gateway) will implement full config
 */
export class CdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly staticBucket: s3.Bucket;
  public readonly backupsBucket: s3.Bucket;
  public readonly releasesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    const { config, apiEndpoint } = props;

    // S3 bucket for static assets (Next.js export)
    this.staticBucket = new s3.Bucket(this, 'StaticBucket', {
      bucketName: `zmanim-static-${config.environment}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // S3 bucket for backups (Restic)
    this.backupsBucket = new s3.Bucket(this, 'BackupsBucket', {
      bucketName: `zmanim-backups-${config.environment}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'ExpireOldBackups',
          enabled: false, // Restic manages retention, this is a safety net
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // S3 bucket for releases (API binaries)
    this.releasesBucket = new s3.Bucket(this, 'ReleasesBucket', {
      bucketName: `zmanim-releases-${config.environment}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true, // Keep old versions for rollback
    });

    // CloudFront distribution
    // Story 7.6 will add: Origin Shield, cache policies, custom domain, certificate
    // Using S3BucketOrigin (replaces deprecated S3Origin) with OAC (Origin Access Control)
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Zmanim CDN - ${config.environment}`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.staticBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiEndpoint, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            httpPort: 8080,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // API responses not cached by default
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      // Certificate and domain aliases will be added in Story 7.8
      // domainNames: [config.domain],
      // certificate: props.certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
      enabled: true,
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

    new cdk.CfnOutput(this, 'StaticBucketName', {
      value: this.staticBucket.bucketName,
      exportName: `${config.stackPrefix}-StaticBucket`,
      description: 'S3 bucket for static assets',
    });

    new cdk.CfnOutput(this, 'BackupsBucketName', {
      value: this.backupsBucket.bucketName,
      exportName: `${config.stackPrefix}-BackupsBucket`,
      description: 'S3 bucket for Restic backups',
    });

    new cdk.CfnOutput(this, 'ReleasesBucketName', {
      value: this.releasesBucket.bucketName,
      exportName: `${config.stackPrefix}-ReleasesBucket`,
      description: 'S3 bucket for API releases',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
