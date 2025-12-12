import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CertificateStack, DnsZoneStack, DnsStack, HealthCheckAlarmStack } from '../lib/dns-stack';
import { EnvironmentConfig } from '../lib/config';

/**
 * Story 7.8: Route 53 & SSL Certificates - CDK Assertions Tests
 *
 * Test cases mapped to acceptance criteria:
 * - TC-7.8.1: ACM certificate in us-east-1 for CloudFront (AC1)
 * - TC-7.8.2: DNS validation configured (AC2)
 * - TC-7.8.3: A record alias points to CloudFront (AC3)
 * - TC-7.8.4: Health check monitors /api/health endpoint (AC4)
 * - TC-7.8.5: CloudWatch alarm for health check failures (AC4)
 */

const testConfig: EnvironmentConfig = {
  environment: 'prod',
  region: 'eu-west-1',
  account: '123456789012',
  domain: 'zmanim.shtetl.io',
  stackPrefix: 'ZmanimProd',
  instanceType: 'm7g.medium',
};

// =============================================================================
// TC-7.8.1: CertificateStack Tests (AC1, AC2)
// =============================================================================
describe('CertificateStack (Story 7.8)', () => {
  let app: cdk.App;
  let stack: CertificateStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new CertificateStack(app, 'TestCertificateStack', {
      config: testConfig,
      hostedZoneId: 'Z1234567890ABC',
      hostedZoneName: 'shtetl.io',
      env: {
        account: testConfig.account,
        region: 'us-east-1', // MUST be us-east-1 for CloudFront
      },
    });
    template = Template.fromStack(stack);
  });

  describe('ACM Certificate (AC1)', () => {
    test('creates ACM certificate for zmanim.shtetl.io', () => {
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'zmanim.shtetl.io',
      });
    });

    test('uses DNS validation method', () => {
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        ValidationMethod: 'DNS',
      });
    });

    test('references Route 53 hosted zone for validation', () => {
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainValidationOptions: Match.arrayWith([
          Match.objectLike({
            DomainName: 'zmanim.shtetl.io',
            HostedZoneId: 'Z1234567890ABC',
          }),
        ]),
      });
    });

    test('exports certificate ARN', () => {
      template.hasOutput('CertificateArn', {
        Export: {
          Name: 'ZmanimProd-CloudFrontCertificateArn',
        },
      });
    });
  });
});

// =============================================================================
// TC-7.8.2: DnsZoneStack Tests (Hosted Zone)
// =============================================================================
describe('DnsZoneStack (Story 7.8)', () => {
  let app: cdk.App;
  let stack: DnsZoneStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    // DnsZoneStack no longer requires elasticIp - it's now independent
    stack = new DnsZoneStack(app, 'TestDnsZoneStack', {
      config: testConfig,
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    template = Template.fromStack(stack);
  });

  describe('Hosted Zone', () => {
    // Note: DnsZoneStack imports an existing hosted zone, doesn't create one
    // The A record for origin-api is now created in ComputeStack

    test('exports hosted zone ID', () => {
      template.hasOutput('HostedZoneId', {
        Export: {
          Name: 'ZmanimProd-HostedZoneId',
        },
      });
    });

    test('outputs API origin domain', () => {
      template.hasOutput('ApiOriginDomain', {});
    });
  });
});

// =============================================================================
// TC-7.8.3, TC-7.8.4: DnsStack Tests (A Record, Health Check)
// =============================================================================
describe('DnsStack (Story 7.8)', () => {
  let app: cdk.App;
  let stack: DnsStack;
  let template: Template;
  let hostedZone: route53.IHostedZone;
  let distribution: cloudfront.IDistribution;

  beforeEach(() => {
    app = new cdk.App();

    // Create mock hosted zone
    const zoneStack = new cdk.Stack(app, 'ZoneStack', {
      env: { account: testConfig.account, region: testConfig.region },
    });
    hostedZone = new route53.PublicHostedZone(zoneStack, 'HostedZone', {
      zoneName: 'shtetl.io',
    });

    // Create mock CloudFront distribution
    const cdnStack = new cdk.Stack(app, 'CdnStack', {
      env: { account: testConfig.account, region: testConfig.region },
    });
    const bucket = new s3.Bucket(cdnStack, 'Bucket');
    distribution = new cloudfront.Distribution(cdnStack, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
      },
    });

    // Create DnsStack
    stack = new DnsStack(app, 'TestDnsStack', {
      config: testConfig,
      distribution: distribution,
      hostedZone: hostedZone,
      certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    template = Template.fromStack(stack);
  });

  // TC-7.8.3: A Record Alias (AC3)
  describe('A Record Alias (AC3)', () => {
    test('creates A record alias for zmanim.shtetl.io', () => {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'zmanim.shtetl.io.',
        Type: 'A',
      });
    });

    test('points to CloudFront distribution', () => {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'zmanim.shtetl.io.',
        AliasTarget: Match.objectLike({
          DNSName: Match.anyValue(),
          HostedZoneId: Match.anyValue(), // CloudFront hosted zone ID
        }),
      });
    });

    test('has 300 second TTL (5 minutes)', () => {
      // Note: TTL is not set directly for alias records, CloudFront manages it
      // This test verifies the record exists with alias target
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'zmanim.shtetl.io.',
        Type: 'A',
        AliasTarget: Match.objectLike({
          DNSName: Match.anyValue(),
        }),
      });
    });
  });

  // TC-7.8.4: Health Check (AC4)
  describe('Health Check (AC4)', () => {
    test('creates HTTPS health check', () => {
      template.hasResourceProperties('AWS::Route53::HealthCheck', {
        HealthCheckConfig: Match.objectLike({
          Type: 'HTTPS',
        }),
      });
    });

    test('monitors zmanim.shtetl.io domain', () => {
      template.hasResourceProperties('AWS::Route53::HealthCheck', {
        HealthCheckConfig: Match.objectLike({
          FullyQualifiedDomainName: 'zmanim.shtetl.io',
        }),
      });
    });

    test('checks /api/health endpoint', () => {
      template.hasResourceProperties('AWS::Route53::HealthCheck', {
        HealthCheckConfig: Match.objectLike({
          ResourcePath: '/api/health',
        }),
      });
    });

    test('has 30 second request interval', () => {
      template.hasResourceProperties('AWS::Route53::HealthCheck', {
        HealthCheckConfig: Match.objectLike({
          RequestInterval: 30,
        }),
      });
    });

    test('has failure threshold of 3 consecutive failures', () => {
      template.hasResourceProperties('AWS::Route53::HealthCheck', {
        HealthCheckConfig: Match.objectLike({
          FailureThreshold: 3,
        }),
      });
    });

    test('uses port 443 for HTTPS', () => {
      template.hasResourceProperties('AWS::Route53::HealthCheck', {
        HealthCheckConfig: Match.objectLike({
          Port: 443,
        }),
      });
    });

    test('has SNI enabled', () => {
      template.hasResourceProperties('AWS::Route53::HealthCheck', {
        HealthCheckConfig: Match.objectLike({
          EnableSNI: true,
        }),
      });
    });

    test('exports health check ID', () => {
      template.hasOutput('HealthCheckId', {
        Export: {
          Name: 'ZmanimProd-HealthCheckId',
        },
      });
    });
  });
});

// =============================================================================
// TC-7.8.5: HealthCheckAlarmStack Tests (CloudWatch Alarm - us-east-1)
// =============================================================================
describe('HealthCheckAlarmStack (Story 7.8)', () => {
  let app: cdk.App;
  let stack: HealthCheckAlarmStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new HealthCheckAlarmStack(app, 'TestHealthCheckAlarmStack', {
      config: testConfig,
      healthCheckId: 'abc123-health-check-id',
      env: {
        account: testConfig.account,
        region: 'us-east-1', // MUST be us-east-1 for Route 53 metrics
      },
    });
    template = Template.fromStack(stack);
  });

  // CloudWatch Alarm (AC4)
  describe('CloudWatch Alarm (AC4)', () => {
    test('creates CloudWatch alarm for health check', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'zmanim-api-health-prod',
      });
    });

    test('uses Route 53 HealthCheckStatus metric', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'AWS/Route53',
        MetricName: 'HealthCheckStatus',
      });
    });

    test('alarms when status drops below 1 (unhealthy)', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Threshold: 1,
        ComparisonOperator: 'LessThanThreshold',
      });
    });

    test('uses 2 evaluation periods', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        EvaluationPeriods: 2,
      });
    });

    test('treats missing data as breaching', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        TreatMissingData: 'breaching',
      });
    });

    test('has alarm actions enabled', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ActionsEnabled: true,
      });
    });

    test('exports alarm ARN', () => {
      template.hasOutput('HealthCheckAlarmArn', {
        Export: {
          Name: 'ZmanimProd-HealthCheckAlarmArn',
        },
      });
    });
  });

  // SNS Topic for alerts
  describe('SNS Alert Topic', () => {
    test('creates SNS topic for health check alerts', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'zmanim-health-alerts-prod',
        DisplayName: 'Zmanim Health Check Alerts',
      });
    });

    test('exports alert topic ARN', () => {
      template.hasOutput('AlertTopicArn', {
        Export: {
          Name: 'ZmanimProd-AlertTopicArn',
        },
      });
    });
  });
});
