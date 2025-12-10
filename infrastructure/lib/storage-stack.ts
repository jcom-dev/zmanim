import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

/**
 * StorageStack - S3 buckets for backups and releases
 *
 * Story 7.5: S3 Buckets & Restic Backup
 *
 * This stack creates non-CDN storage buckets:
 * - Backups bucket: Restic repository for PostgreSQL/Redis backups
 * - Releases bucket: API binary artifacts for deployment
 *
 * These buckets are NOT served via CloudFront - they are accessed
 * directly by EC2 instances for backup/restore and deployment operations.
 *
 * Separated from CdnStack for cleaner architecture:
 * - CdnStack = CloudFront + static assets (public content delivery)
 * - StorageStack = backups + releases (private infrastructure storage)
 */
export interface StorageStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class StorageStack extends cdk.Stack {
  public readonly backupsBucket: s3.Bucket;
  public readonly releasesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ==========================================================================
    // Story 7.5 AC1: Backups Bucket for Restic Repository
    // ==========================================================================
    // Purpose: Store Restic backup repository for PostgreSQL and Redis data
    // Access: EC2 instance via IAM role (not public)
    //
    // Configuration:
    // - AES-256 server-side encryption (S3_MANAGED)
    // - Versioning enabled for safety (accidental deletion protection)
    // - NO lifecycle rules - Restic manages its own retention via forget/prune
    //   (Deleting S3 objects directly would corrupt the Restic repository structure)
    this.backupsBucket = new s3.Bucket(this, 'BackupsBucket', {
      bucketName: `zmanim-backups-${config.environment}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED, // AES-256 server-side encryption
      enforceSSL: true,
      versioned: true, // AC1.3: Enable versioning for safety
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ==========================================================================
    // Story 7.5 AC2: Releases Bucket for API Binaries
    // ==========================================================================
    // Purpose: Store compiled Go API binaries for deployment
    // Access: EC2 instance and GitHub Actions via IAM role (not public)
    //
    // Configuration:
    // - AES-256 server-side encryption
    // - Versioning enabled for rollback capability
    // - Lifecycle rule: delete old versions after 30 days (cost optimization)
    this.releasesBucket = new s3.Bucket(this, 'ReleasesBucket', {
      bucketName: `zmanim-releases-${config.environment}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED, // AES-256 server-side encryption
      enforceSSL: true,
      versioned: true, // Keep versions for rollback capability
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'DeleteOldVersionsAfter30Days',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30), // AC2.3: Delete old versions after 30 days
        },
      ],
    });

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new cdk.CfnOutput(this, 'BackupsBucketName', {
      value: this.backupsBucket.bucketName,
      exportName: `${config.stackPrefix}-BackupsBucket`,
      description: 'S3 bucket for Restic backups',
    });

    new cdk.CfnOutput(this, 'BackupsBucketArn', {
      value: this.backupsBucket.bucketArn,
      exportName: `${config.stackPrefix}-BackupsBucketArn`,
      description: 'S3 bucket ARN for Restic backups (for IAM policies)',
    });

    new cdk.CfnOutput(this, 'ReleasesBucketName', {
      value: this.releasesBucket.bucketName,
      exportName: `${config.stackPrefix}-ReleasesBucket`,
      description: 'S3 bucket for API releases',
    });

    new cdk.CfnOutput(this, 'ReleasesBucketArn', {
      value: this.releasesBucket.bucketArn,
      exportName: `${config.stackPrefix}-ReleasesBucketArn`,
      description: 'S3 bucket ARN for API releases (for IAM policies)',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Purpose', 'Infrastructure Storage');
  }
}
