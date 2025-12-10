import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

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
}

/**
 * DnsStack - ACM certificate, CloudFront alias, health checks
 *
 * Depends on DnsZoneStack for the hosted zone.
 */
export class DnsStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const { config, distribution, hostedZone } = props;

    // ACM Certificate for CloudFront (MUST be in us-east-1)
    // For now, creating in eu-west-1 - Story 7.8 will handle cross-region
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: config.domain,
      subjectAlternativeNames: [`*.${config.domain}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // A record alias pointing CloudFront distribution to zmanim.shtetl.io
    new route53.ARecord(this, 'CloudFrontAlias', {
      zone: hostedZone,
      recordName: 'zmanim', // zmanim.shtetl.io
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      comment: 'CloudFront distribution alias',
    });

    // Health check for the API endpoint
    const healthCheck = new route53.CfnHealthCheck(this, 'HealthCheck', {
      healthCheckConfig: {
        type: 'HTTPS',
        fullyQualifiedDomainName: distribution.distributionDomainName,
        resourcePath: '/api/health',
        requestInterval: 30,
        failureThreshold: 3,
      },
      healthCheckTags: [
        { key: 'Name', value: `zmanim-health-${config.environment}` },
        { key: 'Project', value: 'zmanim' },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      exportName: `${config.stackPrefix}-CertificateArn`,
      description: 'ACM certificate ARN for CloudFront',
    });

    new cdk.CfnOutput(this, 'HealthCheckId', {
      value: healthCheck.attrHealthCheckId,
      exportName: `${config.stackPrefix}-HealthCheckId`,
      description: 'Route 53 health check ID',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
