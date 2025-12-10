import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface DnsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  distribution: cloudfront.IDistribution;
}

/**
 * DNSStack - Route 53, ACM certificate, health checks
 *
 * Architecture:
 * - ACM certificate for zmanim.shtetl.io (in us-east-1 for CloudFront)
 * - Route 53 hosted zone (or CNAME if external DNS)
 * - A record alias pointing to CloudFront distribution
 * - Health check on /health endpoint
 *
 * Story 7.8 will implement full DNS configuration
 *
 * IMPORTANT: CloudFront requires certificates in us-east-1. Options:
 * 1. Use aws-cdk-lib/aws-certificatemanager DnsValidatedCertificate (handles cross-region)
 * 2. Create separate certificate stack in us-east-1
 * 3. Use crossRegionReferences: true on stacks
 *
 * For Story 7.1, this is a placeholder with regional certificate.
 * Story 7.8 will implement proper cross-region certificate handling.
 */
export class DnsStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;
  public readonly hostedZone?: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const { config, distribution } = props;

    // Note: For production, we may use an existing hosted zone
    // This is a placeholder - Story 7.8 will determine if Route 53 or external DNS
    //
    // Option 1: Create new hosted zone (if we manage DNS in AWS)
    // Option 2: Use external DNS provider with CNAME records
    //
    // For now, creating placeholder resources

    // ACM Certificate for CloudFront (MUST be in us-east-1)
    // Story 7.8 will configure DNS validation
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: config.domain,
      subjectAlternativeNames: [`*.${config.domain}`],
      validation: acm.CertificateValidation.fromDns(),
    });

    // Health check for the API endpoint
    // Story 7.8 will configure full health check with alarm
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

    // Note: If using external DNS, document the required CNAME records:
    // - zmanim.shtetl.io → CloudFront distribution domain
    // - _acme-challenge.zmanim.shtetl.io → ACM validation CNAME

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
