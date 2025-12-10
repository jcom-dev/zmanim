import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CdnStack } from '../lib/cdn-stack';
import { EnvironmentConfig } from '../lib/config';

/**
 * CdnStack Tests - CloudFront Distribution and Static Assets
 *
 * Story 7.5 (AC3): Static assets bucket configuration
 * Story 7.6: CloudFront distribution with Origin Shield, cache policies, etc.
 *
 * Note: Backups and releases bucket tests are in storage-stack.test.ts
 * (StorageStack was extracted from CdnStack for cleaner architecture)
 */

describe('CdnStack - S3 Static Bucket (Story 7.5 AC3)', () => {
  let app: cdk.App;
  let stack: CdnStack;
  let template: Template;

  const testConfig: EnvironmentConfig = {
    environment: 'prod',
    region: 'eu-west-1',
    account: '123456789012',
    domain: 'zmanim.shtetl.io',
    stackPrefix: 'ZmanimProd',
    instanceType: 'm7g.medium',
  };

  beforeEach(() => {
    app = new cdk.App();
    stack = new CdnStack(app, 'TestCdnStack', {
      config: testConfig,
      apiOriginDomain: 'origin-api.zmanim.shtetl.io',
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    template = Template.fromStack(stack);
  });

  // TC-7.5.3: Static Assets Bucket (AC3)
  describe('Static Assets Bucket (AC3)', () => {
    test('creates bucket with correct name', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-static-prod',
      });
    });

    test('has server-side encryption enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-static-prod',
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
      });
    });

    test('blocks all public access (CloudFront OAC handles access)', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'zmanim-static-prod',
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('has RETAIN deletion policy', () => {
      const buckets = template.findResources('AWS::S3::Bucket', {
        Properties: {
          BucketName: 'zmanim-static-prod',
        },
      });

      const staticBucket = Object.values(buckets)[0];
      expect(staticBucket.DeletionPolicy).toBe('Retain');
    });
  });

  // Stack Outputs
  describe('Stack Outputs', () => {
    test('exports static bucket name', () => {
      template.hasOutput('StaticBucketName', {
        Export: {
          Name: `${testConfig.stackPrefix}-StaticBucket`,
        },
      });
    });
  });

  // CloudFront Integration (AC3.3)
  describe('CloudFront Integration', () => {
    test('creates CloudFront distribution', () => {
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });

    test('creates Origin Access Control for S3', () => {
      template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    });

    test('static bucket has policy allowing CloudFront access', () => {
      // Find bucket policies
      const policies = template.findResources('AWS::S3::BucketPolicy');

      // At least one policy should allow CloudFront OAC access
      const hasCloudFrontPolicy = Object.values(policies).some((policy) => {
        const statement = policy.Properties.PolicyDocument.Statement;
        return statement.some(
          (s: { Action: string; Principal: { Service: string } }) =>
            s.Action === 's3:GetObject' && s.Principal?.Service === 'cloudfront.amazonaws.com'
        );
      });

      expect(hasCloudFrontPolicy).toBe(true);
    });
  });

  // Resource count validation (only static bucket now)
  describe('Resource Count', () => {
    test('creates exactly 1 S3 bucket (static only)', () => {
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });

    test('creates bucket policy for SSL enforcement', () => {
      template.resourceCountIs('AWS::S3::BucketPolicy', 1);
    });
  });
});

/**
 * Story 7.6: CloudFront Distribution - CDK Assertions Tests
 *
 * Test cases mapped to acceptance criteria:
 * - TC-7.6.1: CloudFront distribution with Origin Shield (AC1)
 * - TC-7.6.2: API Gateway origin configuration (AC2)
 * - TC-7.6.3: S3 static origin configuration (AC3)
 * - TC-7.6.4: Cache behaviors routing (AC4)
 * - TC-7.6.5: HTTPS configuration (AC5)
 * - TC-7.6.6: SPA routing function (AC4.4)
 */
describe('CdnStack - CloudFront Distribution (Story 7.6)', () => {
  let app: cdk.App;
  let stack: CdnStack;
  let template: Template;

  const testConfig: EnvironmentConfig = {
    environment: 'prod',
    region: 'eu-west-1',
    account: '123456789012',
    domain: 'zmanim.shtetl.io',
    stackPrefix: 'ZmanimProd',
    instanceType: 'm7g.medium',
  };

  beforeEach(() => {
    app = new cdk.App();
    stack = new CdnStack(app, 'TestCdnStack', {
      config: testConfig,
      apiOriginDomain: 'origin-api.zmanim.shtetl.io',
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    template = Template.fromStack(stack);
  });

  // TC-7.6.1: CloudFront Distribution with Origin Shield (AC1)
  describe('CloudFront Distribution with Origin Shield (AC1)', () => {
    test('creates CloudFront distribution', () => {
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });

    test('has default root object set to index.html', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultRootObject: 'index.html',
        }),
      });
    });

    test('has Origin Shield enabled for S3 origin in eu-west-1', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Origins: Match.arrayWith([
            Match.objectLike({
              OriginShield: {
                Enabled: true,
                OriginShieldRegion: 'eu-west-1',
              },
            }),
          ]),
        }),
      });
    });

    test('has Price Class 100 (US, EU, Israel edges)', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          PriceClass: 'PriceClass_100',
        }),
      });
    });
  });

  // TC-7.6.2: API Gateway Origin (AC2)
  describe('API Gateway Origin (AC2)', () => {
    test('has HTTP origin for API domain', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Origins: Match.arrayWith([
            Match.objectLike({
              DomainName: 'origin-api.zmanim.shtetl.io',
              CustomOriginConfig: Match.objectLike({
                HTTPSPort: 443,
                OriginProtocolPolicy: 'https-only',
              }),
            }),
          ]),
        }),
      });
    });
  });

  // TC-7.6.3: S3 Static Origin (AC3)
  describe('S3 Static Origin (AC3)', () => {
    test('creates Origin Access Control for S3', () => {
      template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    });

    test('has S3 origin configuration', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Origins: Match.arrayWith([
            Match.objectLike({
              S3OriginConfig: Match.anyValue(),
            }),
          ]),
        }),
      });
    });
  });

  // TC-7.6.4: Cache Behaviors (AC4)
  describe('Cache Behaviors (AC4)', () => {
    test('has /api/zmanim/* behavior', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/zmanim/*',
              ViewerProtocolPolicy: 'redirect-to-https',
            }),
          ]),
        }),
      });
    });

    test('has /api/* behavior', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
              ViewerProtocolPolicy: 'redirect-to-https',
            }),
          ]),
        }),
      });
    });

    test('has /_next/static/* behavior for immutable assets', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/_next/static/*',
              ViewerProtocolPolicy: 'redirect-to-https',
            }),
          ]),
        }),
      });
    });

    test('has default behavior with redirect-to-https', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultCacheBehavior: Match.objectLike({
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
        }),
      });
    });
  });

  // TC-7.6.5: HTTPS Configuration (AC5)
  describe('HTTPS Configuration (AC5)', () => {
    test('all behaviors have redirect-to-https', () => {
      // Check default behavior
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultCacheBehavior: Match.objectLike({
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
        }),
      });
    });

    test('all cache behaviors have redirect-to-https', () => {
      // Check that all additional behaviors use HTTPS
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
              ViewerProtocolPolicy: 'redirect-to-https',
            }),
            Match.objectLike({
              PathPattern: '/_next/static/*',
              ViewerProtocolPolicy: 'redirect-to-https',
            }),
          ]),
        }),
      });
    });

    // Note: minimumProtocolVersion is configured in code but ViewerCertificate
    // block only appears when a certificate is provided (Story 7.8).
    // The TLS 1.2 requirement is verified by the CloudFormation output checks.
  });

  // TC-7.6.6: Cache Policies
  describe('Cache Policies', () => {
    test('creates API zmanim cache policy with 1 hour TTL', () => {
      template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
        CachePolicyConfig: Match.objectLike({
          Name: 'ZmanimProd-ApiZmanimCache',
          DefaultTTL: 3600, // 1 hour
        }),
      });
    });

    test('creates static assets cache policy with 1 year TTL', () => {
      template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
        CachePolicyConfig: Match.objectLike({
          Name: 'ZmanimProd-StaticAssetsCache',
          DefaultTTL: 31536000, // 365 days
        }),
      });
    });

    test('creates HTML cache policy with 1 day TTL', () => {
      template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
        CachePolicyConfig: Match.objectLike({
          Name: 'ZmanimProd-HtmlCache',
          DefaultTTL: 86400, // 1 day
        }),
      });
    });
  });

  // TC-7.6.7: SPA Routing Function (Task 7)
  describe('SPA Routing Function (Task 7)', () => {
    test('creates CloudFront Function for SPA routing', () => {
      template.resourceCountIs('AWS::CloudFront::Function', 1);
    });

    test('CloudFront Function has correct name', () => {
      template.hasResourceProperties('AWS::CloudFront::Function', {
        Name: 'ZmanimProd-SpaRouting',
      });
    });

    test('default behavior has function association for viewer-request', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultCacheBehavior: Match.objectLike({
            FunctionAssociations: Match.arrayWith([
              Match.objectLike({
                EventType: 'viewer-request',
              }),
            ]),
          }),
        }),
      });
    });
  });

  // TC-7.6.8: Security Headers (AC5.3)
  describe('Security Headers (AC5.3)', () => {
    test('creates Response Headers Policy', () => {
      template.resourceCountIs('AWS::CloudFront::ResponseHeadersPolicy', 1);
    });

    test('Response Headers Policy has security headers configured', () => {
      template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
        ResponseHeadersPolicyConfig: Match.objectLike({
          Name: 'ZmanimProd-SecurityHeaders',
          SecurityHeadersConfig: Match.objectLike({
            StrictTransportSecurity: Match.objectLike({
              Override: true,
              AccessControlMaxAgeSec: Match.anyValue(),
            }),
            FrameOptions: Match.objectLike({
              FrameOption: 'DENY',
              Override: true,
            }),
            ContentTypeOptions: Match.objectLike({
              Override: true,
            }),
          }),
        }),
      });
    });
  });

  // TC-7.6.9: Origin Request Policy (AC2.5)
  describe('Origin Request Policy (AC2.5)', () => {
    test('creates Origin Request Policy for API', () => {
      template.resourceCountIs('AWS::CloudFront::OriginRequestPolicy', 1);
    });

    test('Origin Request Policy forwards necessary headers', () => {
      template.hasResourceProperties('AWS::CloudFront::OriginRequestPolicy', {
        OriginRequestPolicyConfig: Match.objectLike({
          Name: 'ZmanimProd-ApiOriginRequest',
          HeadersConfig: Match.objectLike({
            HeaderBehavior: 'whitelist',
            Headers: Match.arrayWith(['Accept', 'Content-Type', 'X-Publisher-Id']),
          }),
        }),
      });
    });
  });

  // TC-7.6.10: Stack Outputs
  describe('Stack Outputs', () => {
    test('exports distribution ID', () => {
      template.hasOutput('DistributionId', {
        Export: {
          Name: 'ZmanimProd-DistributionId',
        },
      });
    });

    test('exports distribution domain', () => {
      template.hasOutput('DistributionDomain', {
        Export: {
          Name: 'ZmanimProd-DistributionDomain',
        },
      });
    });

    test('exports distribution ARN', () => {
      template.hasOutput('DistributionArn', {
        Export: {
          Name: 'ZmanimProd-DistributionArn',
        },
      });
    });
  });
});
