import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack';
import { EnvironmentConfig } from '../lib/config';

/**
 * Story 7.5: S3 Buckets & Restic Backup - StorageStack Tests
 *
 * Test cases mapped to acceptance criteria:
 * - TC-7.5.1: Backups bucket for Restic repository (AC1)
 * - TC-7.5.2: Releases bucket for API binaries (AC2)
 *
 * Note: Static bucket tests remain in cdn-stack.test.ts (AC3)
 * StorageStack was extracted from CdnStack for cleaner architecture.
 */

const testConfig: EnvironmentConfig = {
  environment: 'prod',
  region: 'eu-west-1',
  account: '123456789012',
  domain: 'zmanim.shtetl.io',
  stackPrefix: 'ZmanimProd',
  instanceType: 'm7g.medium',
};

describe('StorageStack (Story 7.5)', () => {
  let app: cdk.App;
  let stack: StorageStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new StorageStack(app, 'TestStorageStack', {
      config: testConfig,
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    template = Template.fromStack(stack);
  });

  // ==========================================================================
  // TC-7.5.1: Backups Bucket (AC1)
  // ==========================================================================
  describe('Backups Bucket (AC1)', () => {
    test('creates backups bucket with correct name', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-backups-prod',
      });
    });

    test('backups bucket blocks all public access', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-backups-prod',
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('backups bucket has AES-256 encryption', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-backups-prod',
        BucketEncryption: {
          ServerSideEncryptionConfiguration: Match.arrayWith([
            Match.objectLike({
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            }),
          ]),
        },
      });
    });

    test('backups bucket has versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-backups-prod',
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('backups bucket has no lifecycle rules (Restic manages retention)', () => {
      // Verify the backups bucket does NOT have lifecycle rules
      // Restic manages its own retention via forget/prune commands
      const buckets = template.findResources('AWS::S3::Bucket', {
        Properties: {
          BucketName: 'zmanim-backups-prod',
        },
      });

      // Get the backups bucket
      const backupsBucketKey = Object.keys(buckets)[0];
      const backupsBucket = buckets[backupsBucketKey];

      // Verify no lifecycle configuration
      expect(backupsBucket.Properties.LifecycleConfiguration).toBeUndefined();
    });

    test('backups bucket exports bucket name', () => {
      template.hasOutput('BackupsBucketName', {
        Export: {
          Name: 'ZmanimProd-BackupsBucket',
        },
      });
    });

    test('backups bucket exports bucket ARN', () => {
      template.hasOutput('BackupsBucketArn', {
        Export: {
          Name: 'ZmanimProd-BackupsBucketArn',
        },
      });
    });
  });

  // ==========================================================================
  // TC-7.5.2: Releases Bucket (AC2)
  // ==========================================================================
  describe('Releases Bucket (AC2)', () => {
    test('creates releases bucket with correct name', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-releases-prod',
      });
    });

    test('releases bucket blocks all public access', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-releases-prod',
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('releases bucket has AES-256 encryption', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-releases-prod',
        BucketEncryption: {
          ServerSideEncryptionConfiguration: Match.arrayWith([
            Match.objectLike({
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            }),
          ]),
        },
      });
    });

    test('releases bucket has versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-releases-prod',
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('releases bucket deletes old versions after 30 days', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-releases-prod',
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Id: 'DeleteOldVersionsAfter30Days',
              Status: 'Enabled',
              NoncurrentVersionExpiration: {
                NoncurrentDays: 30,
              },
            }),
          ]),
        },
      });
    });

    test('releases bucket exports bucket name', () => {
      template.hasOutput('ReleasesBucketName', {
        Export: {
          Name: 'ZmanimProd-ReleasesBucket',
        },
      });
    });

    test('releases bucket exports bucket ARN', () => {
      template.hasOutput('ReleasesBucketArn', {
        Export: {
          Name: 'ZmanimProd-ReleasesBucketArn',
        },
      });
    });
  });

  // ==========================================================================
  // Stack Configuration Tests
  // ==========================================================================
  describe('Stack Configuration', () => {
    test('creates exactly 2 S3 buckets', () => {
      template.resourceCountIs('AWS::S3::Bucket', 2);
    });

    test('all buckets have RETAIN removal policy', () => {
      // Both buckets should retain data on stack deletion
      const buckets = template.findResources('AWS::S3::Bucket');
      Object.values(buckets).forEach((bucket: any) => {
        expect(bucket.DeletionPolicy).toBe('Retain');
        expect(bucket.UpdateReplacePolicy).toBe('Retain');
      });
    });

    test('all buckets have Project tag', () => {
      // All buckets should have the Project tag
      const buckets = template.findResources('AWS::S3::Bucket');
      Object.values(buckets).forEach((bucket: any) => {
        const hasProjectTag = bucket.Properties.Tags.some(
          (tag: { Key: string; Value: string }) =>
            tag.Key === 'Project' && tag.Value === 'zmanim'
        );
        expect(hasProjectTag).toBe(true);
      });
    });
  });
});
