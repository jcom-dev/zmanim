import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

// =============================================================================
// Story 7.8: Route 53 & SSL Certificates
//
// This file contains three stacks for DNS/SSL configuration:
//
// 1. CertificateStack - ACM certificate in us-east-1 (required for CloudFront)
// 2. DnsZoneStack - Route 53 hosted zone (shtetl.io)
// 3. DnsStack - A record alias, health check, CloudWatch alarm
//
// Key constraint: CloudFront requires ACM certificates in us-east-1 region.
// =============================================================================

/**
 * CertificateStack - ACM certificate in us-east-1 for CloudFront
 *
 * Story 7.8 Task 1: ACM Certificate
 *
 * CRITICAL: CloudFront requires certificates to be in us-east-1 (N. Virginia)
 * regardless of the distribution's origin region (eu-west-1 in our case).
 *
 * This stack MUST be deployed in us-east-1:
 * - Certificate is requested for zmanim.shtetl.io (AC1)
 * - DNS validation is configured with Route 53 (AC2)
 * - CDK auto-creates CNAME validation records in the hosted zone
 *
 * Dependency: Requires DnsZoneStack to exist first (for hosted zone reference)
 */
export interface CertificateStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  hostedZoneId: string; // Passed as string to avoid cross-region construct reference
  hostedZoneName: string;
}

export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const { config, hostedZoneId, hostedZoneName } = props;

    // Import hosted zone from DnsZoneStack (cross-region reference via ID)
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: hostedZoneName,
    });

    // Create ACM certificate with DNS validation
    // This certificate will be used by CloudFront distribution
    this.certificate = new acm.Certificate(this, 'CloudFrontCertificate', {
      domainName: config.domain, // zmanim.shtetl.io
      // Optional: Add wildcard for future subdomains
      // subjectAlternativeNames: [`*.${config.domain}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
      certificateName: `${config.stackPrefix}-CloudFrontCert`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      exportName: `${config.stackPrefix}-CloudFrontCertificateArn`,
      description: 'ACM certificate ARN in us-east-1 for CloudFront',
    });

    new cdk.CfnOutput(this, 'CertificateDomain', {
      value: config.domain,
      description: 'Domain name covered by this certificate',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Purpose', 'CloudFront SSL');
  }
}

/**
 * DnsZoneStack - Route 53 hosted zone (must be created first)
 *
 * Creates the hosted zone that other stacks depend on.
 * User must update their domain registrar's nameservers to point to this zone.
 */
export interface DnsZoneStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  elasticIp: ec2.CfnEIP;
}

export class DnsZoneStack extends cdk.Stack {
  public readonly hostedZone: route53.PublicHostedZone;
  public readonly apiOriginDomain: string;

  constructor(scope: Construct, id: string, props: DnsZoneStackProps) {
    super(scope, id, props);

    const { config, elasticIp } = props;

    // Extract base domain from config.domain (e.g., shtetl.io from zmanim.shtetl.io)
    const domainParts = config.domain.split('.');
    const baseDomain = domainParts.slice(-2).join('.'); // shtetl.io

    // Create hosted zone for shtetl.io
    this.hostedZone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: baseDomain,
      comment: `Hosted zone for ${baseDomain} - managed by CDK`,
    });

    // Create origin-api.zmanim.shtetl.io A record pointing to Elastic IP
    // This is the internal origin domain that CloudFront uses
    this.apiOriginDomain = `origin-api.${config.domain}`;

    new route53.ARecord(this, 'ApiOriginRecord', {
      zone: this.hostedZone,
      recordName: `origin-api.zmanim`, // origin-api.zmanim.shtetl.io
      target: route53.RecordTarget.fromIpAddresses(elasticIp.ref),
      ttl: cdk.Duration.minutes(5),
      comment: 'API origin for CloudFront (internal)',
    });

    // Outputs
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      exportName: `${config.stackPrefix}-HostedZoneId`,
      description: 'Route 53 hosted zone ID',
    });

    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(', ', this.hostedZone.hostedZoneNameServers || []),
      description: 'Nameservers - update your domain registrar to use these',
    });

    new cdk.CfnOutput(this, 'ApiOriginDomain', {
      value: this.apiOriginDomain,
      description: 'API origin domain for CloudFront',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}

export interface DnsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  distribution: cloudfront.IDistribution;
  hostedZone: route53.IHostedZone;
  certificateArn?: string; // Optional: ACM certificate ARN from CertificateStack (us-east-1)
}

/**
 * DnsStack - A record alias, health check (without alarm)
 *
 * Story 7.8: Route 53 & SSL Certificates
 *
 * Key implementation details:
 * - A record alias pointing zmanim.shtetl.io to CloudFront (AC3)
 * - Health check monitors https://zmanim.shtetl.io/api/health (AC4)
 *
 * Note: The ACM certificate is created by CertificateStack in us-east-1.
 * The CloudWatch alarm is created by HealthCheckAlarmStack in us-east-1
 * (Route 53 metrics are only available there).
 *
 * Depends on:
 * - DnsZoneStack for the hosted zone
 * - CertificateStack for the ACM certificate (us-east-1)
 * - CdnStack for the CloudFront distribution
 */
export class DnsStack extends cdk.Stack {
  public readonly healthCheckId: string;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const { config, distribution, hostedZone } = props;

    // ==========================================================================
    // Story 7.8 Task 3: Route 53 A Record Alias
    // ==========================================================================
    // AC3: A record alias points to CloudFront
    // Creates: zmanim.shtetl.io → CloudFront distribution
    new route53.ARecord(this, 'CloudFrontAlias', {
      zone: hostedZone,
      recordName: 'zmanim', // zmanim.shtetl.io
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      // Note: TTL is ignored for alias records - CloudFront manages the TTL
      comment: 'CloudFront distribution alias for zmanim.shtetl.io',
    });

    // ==========================================================================
    // Story 7.8 Task 4: Health Check
    // ==========================================================================
    // AC4: Health check monitors /health endpoint
    // Monitors: https://zmanim.shtetl.io/api/health
    // Interval: 30 seconds
    // Failure threshold: 3 consecutive failures (90 seconds to alarm)
    const healthCheck = new route53.CfnHealthCheck(this, 'HealthCheck', {
      healthCheckConfig: {
        type: 'HTTPS',
        fullyQualifiedDomainName: config.domain, // zmanim.shtetl.io (not CloudFront domain)
        resourcePath: '/api/health',
        port: 443,
        requestInterval: 30, // Check every 30 seconds
        failureThreshold: 3, // 3 consecutive failures trigger alarm
        enableSni: true, // Required for SNI (Server Name Indication)
      },
      healthCheckTags: [
        { key: 'Name', value: `zmanim-health-${config.environment}` },
        { key: 'Project', value: 'zmanim' },
        { key: 'ManagedBy', value: 'cdk' },
      ],
    });

    // Store health check ID for use by HealthCheckAlarmStack
    this.healthCheckId = healthCheck.attrHealthCheckId;

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new cdk.CfnOutput(this, 'HealthCheckId', {
      value: healthCheck.attrHealthCheckId,
      exportName: `${config.stackPrefix}-HealthCheckId`,
      description: 'Route 53 health check ID (use this for CloudWatch alarm in us-east-1)',
    });

    new cdk.CfnOutput(this, 'ExternalDnsInstructions', {
      value: 'If using external DNS (Cloudflare, etc.): Create CNAME record pointing zmanim.shtetl.io to the CloudFront distribution domain. See docs/infrastructure/external-dns-setup.md',
      description: 'Instructions for external DNS setup (if not using Route 53)',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}

/**
 * HealthCheckAlarmStack - CloudWatch alarm for Route 53 health check (us-east-1)
 *
 * Story 7.8 Task 4: Health Check CloudWatch Alarm
 *
 * CRITICAL: This stack MUST be deployed in us-east-1 because Route 53 health
 * check metrics (HealthCheckStatus) are ONLY available in us-east-1.
 *
 * Creates:
 * - SNS Topic for alerts (subscribe email/Slack here)
 * - CloudWatch Alarm monitoring health check status
 *
 * Depends on:
 * - DnsStack for the health check ID
 */
export interface HealthCheckAlarmStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  healthCheckId: string; // Passed as string to avoid cross-region reference issues
}

export class HealthCheckAlarmStack extends cdk.Stack {
  public readonly healthCheckAlarm: cloudwatch.Alarm;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: HealthCheckAlarmStackProps) {
    super(scope, id, props);

    const { config, healthCheckId } = props;

    // SNS Topic for health check alerts
    // Subscribe your email or Slack webhook to this topic
    this.alertTopic = new sns.Topic(this, 'HealthCheckAlertTopic', {
      topicName: `zmanim-health-alerts-${config.environment}`,
      displayName: 'Zmanim Health Check Alerts',
    });

    // CloudWatch Alarm for health check failures
    // Route 53 health check metrics are ONLY available in us-east-1
    this.healthCheckAlarm = new cloudwatch.Alarm(this, 'HealthCheckAlarm', {
      alarmName: `zmanim-api-health-${config.environment}`,
      alarmDescription: `Alert when Zmanim API health check fails (3 consecutive failures). Health Check ID: ${healthCheckId}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Route53',
        metricName: 'HealthCheckStatus',
        dimensionsMap: {
          HealthCheckId: healthCheckId,
        },
        statistic: 'Minimum',
        period: cdk.Duration.minutes(1),
      }),
      // HealthCheckStatus: 1 = healthy, 0 = unhealthy
      // Alarm when status drops below 1 (i.e., becomes unhealthy)
      threshold: 1,
      evaluationPeriods: 2, // 2 evaluation periods of 1 minute each
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      actionsEnabled: true,
    });

    // Add SNS action to send alerts when alarm triggers
    this.healthCheckAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
    this.healthCheckAlarm.addOkAction(new cloudwatch_actions.SnsAction(this.alertTopic));

    // Outputs
    new cdk.CfnOutput(this, 'HealthCheckAlarmArn', {
      value: this.healthCheckAlarm.alarmArn,
      exportName: `${config.stackPrefix}-HealthCheckAlarmArn`,
      description: 'CloudWatch alarm ARN for health check failures',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      exportName: `${config.stackPrefix}-AlertTopicArn`,
      description: 'SNS topic ARN for health check alerts - subscribe your email/Slack here',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
