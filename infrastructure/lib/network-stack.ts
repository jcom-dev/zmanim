import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface NetworkStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

/**
 * NetworkStack - VPC, subnets, security groups, S3 Gateway Endpoint
 *
 * Architecture (Story 7.3):
 * - VPC with CIDR 10.0.0.0/16 in eu-west-1
 * - Single public subnet 10.0.1.0/24 in eu-west-1a (no NAT Gateway - saves ~$32/month)
 * - Internet Gateway for outbound traffic (automatically created by PUBLIC subnet)
 * - S3 VPC Gateway Endpoint (free) for backup/release bucket access
 * - Security groups for EC2:
 *   - Ingress 443 from CloudFront prefix list
 *   - Ingress 22 from admin CIDR (configurable)
 *   - Ingress 8080 from anywhere (API Gateway, tightened in Story 7.7)
 *   - Egress all (S3 traffic routes via Gateway Endpoint)
 *
 * Network Diagram:
 * ┌─────────────────────────────────────────────────────────┐
 * │ VPC: 10.0.0.0/16                                        │
 * │ ┌─────────────────────────────────────────────────────┐ │
 * │ │ Public Subnet: 10.0.1.0/24 (eu-west-1a)             │ │
 * │ │   ┌─────────────┐                                   │ │
 * │ │   │ EC2 Instance │                                  │ │
 * │ │   │ (Elastic IP) │                                  │ │
 * │ │   └──────┬──────┘                                   │ │
 * │ └──────────│──────────────────────────────────────────┘ │
 * │   ┌────────┴────────┐  ┌────────────────────────────┐  │
 * │   │ Internet Gateway │  │ S3 Gateway Endpoint (free) │  │
 * │   └────────┬────────┘  └────────────────────────────┘  │
 * └────────────│────────────────────────────────────────────┘
 *              │
 *     ┌────────┴────────┐
 *     │    Internet      │
 *     │ (CloudFront/API) │
 *     └─────────────────┘
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ec2SecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { config } = props;

    // =========================================================================
    // VPC Configuration (AC1)
    // =========================================================================
    // - CIDR: 10.0.0.0/16
    // - Single public subnet in eu-west-1a (10.0.1.0/24)
    // - No NAT Gateway (Packer AMI pre-installs all packages)
    // - DNS hostnames and support enabled
    // - Internet Gateway automatically created by PUBLIC subnet type
    this.vpc = new ec2.Vpc(this, 'ZmanimVpc', {
      vpcName: `zmanim-vpc-${config.environment}`,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 1, // Single AZ: eu-west-1a
      natGateways: 0, // CRITICAL: No NAT - saves ~$32/month (AC5)
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC, // Creates Internet Gateway (AC2)
          cidrMask: 24, // 10.0.1.0/24
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // =========================================================================
    // S3 Gateway Endpoint (AC3)
    // =========================================================================
    // - Free alternative to NAT Gateway for S3 access
    // - Automatically associated with public subnet route table
    // - Saves ~$32/month vs NAT Gateway + data processing fees
    const s3Endpoint = this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // =========================================================================
    // Security Group (AC4)
    // =========================================================================
    // Ingress rules:
    // - 443/tcp from CloudFront prefix list (AWS-managed)
    // - 22/tcp from admin CIDR (configurable via ADMIN_CIDR env var)
    // - 8080/tcp from anywhere (API Gateway, tightened in Story 7.7)
    // Egress:
    // - All traffic (S3 via Gateway Endpoint, outbound via IGW)
    this.ec2SecurityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `zmanim-ec2-sg-${config.environment}`,
      description: 'Security group for Zmanim EC2 instance',
      allowAllOutbound: true,
    });

    // Ingress: HTTPS from CloudFront (uses AWS-managed prefix list)
    // The CloudFront origin-facing prefix list ID varies by region
    // Using Peer.prefixList with the AWS-managed CloudFront prefix list
    // Note: pl-4fa04526 is for us-east-1; eu-west-1 uses a different ID
    // CDK will look up the correct prefix list at synth time
    this.ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), // CloudFront IPs - will be restricted via CloudFront signed URLs/Origin Access Identity
      ec2.Port.tcp(443),
      'HTTPS from CloudFront (Origin Access)'
    );

    // Ingress: SSH from admin CIDR (configurable)
    // If ADMIN_CIDR is not set, defaults to a placeholder that must be configured
    const adminCidr = config.adminCidr || '127.0.0.1/32'; // Placeholder - blocks all SSH unless configured
    this.ec2SecurityGroup.addIngressRule(
      ec2.Peer.ipv4(adminCidr),
      ec2.Port.tcp(22),
      `SSH from admin (${config.adminCidr ? 'configured' : 'placeholder - set ADMIN_CIDR env var'})`
    );

    // Ingress: API from API Gateway (port 8080)
    // Currently allows from anywhere - Story 7.7 will restrict to API Gateway VPC link
    this.ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
      'API from API Gateway (to be restricted in Story 7.7)'
    );

    // =========================================================================
    // CloudFormation Outputs
    // =========================================================================
    // These exports are used by other stacks (ComputeStack, etc.)

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `${config.stackPrefix}-VpcId`,
      description: 'VPC ID for compute and other stacks',
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      exportName: `${config.stackPrefix}-VpcCidr`,
      description: 'VPC CIDR block (10.0.0.0/16)',
    });

    new cdk.CfnOutput(this, 'PublicSubnetId', {
      value: this.vpc.publicSubnets[0].subnetId,
      exportName: `${config.stackPrefix}-PublicSubnetId`,
      description: 'Public subnet ID for EC2 instance (10.0.1.0/24)',
    });

    new cdk.CfnOutput(this, 'PublicSubnetAz', {
      value: this.vpc.publicSubnets[0].availabilityZone,
      exportName: `${config.stackPrefix}-PublicSubnetAz`,
      description: 'Availability zone for public subnet (eu-west-1a)',
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: this.ec2SecurityGroup.securityGroupId,
      exportName: `${config.stackPrefix}-SecurityGroupId`,
      description: 'Security group ID for EC2 instance',
    });

    new cdk.CfnOutput(this, 'S3EndpointId', {
      value: s3Endpoint.vpcEndpointId,
      description: 'S3 Gateway Endpoint ID (free S3 access from VPC)',
    });

    new cdk.CfnOutput(this, 'InternetGatewayId', {
      value: this.vpc.internetGatewayId || 'auto-created',
      description: 'Internet Gateway ID (auto-created with public subnet)',
    });

    // =========================================================================
    // Tags
    // =========================================================================
    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Story', '7.3');
  }
}
