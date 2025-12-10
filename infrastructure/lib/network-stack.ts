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
 * Architecture:
 * - Single public subnet in eu-west-1a (no NAT Gateway - Packer AMI handles dependencies)
 * - Internet Gateway for outbound traffic
 * - S3 VPC Gateway Endpoint (free) for backup/release bucket access
 * - Security groups for EC2 and CloudFront access
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ec2SecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { config } = props;

    // VPC with single public subnet (no NAT Gateway - saves ~$32/month)
    // Story 7.3 will implement full VPC configuration
    this.vpc = new ec2.Vpc(this, 'ZmanimVpc', {
      vpcName: `zmanim-vpc-${config.environment}`,
      maxAzs: 1,
      natGateways: 0, // No NAT - Packer AMI handles all dependencies
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
      // S3 Gateway Endpoint will be added in Story 7.3
    });

    // Security group for EC2 instance
    // Story 7.3 will add CloudFront prefix list and admin IP rules
    this.ec2SecurityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `zmanim-ec2-sg-${config.environment}`,
      description: 'Security group for Zmanim EC2 instance',
      allowAllOutbound: true,
    });

    // Outputs for cross-stack references
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `${config.stackPrefix}-VpcId`,
      description: 'VPC ID for compute and other stacks',
    });

    new cdk.CfnOutput(this, 'PublicSubnetId', {
      value: this.vpc.publicSubnets[0].subnetId,
      exportName: `${config.stackPrefix}-PublicSubnetId`,
      description: 'Public subnet ID for EC2 instance',
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: this.ec2SecurityGroup.securityGroupId,
      exportName: `${config.stackPrefix}-SecurityGroupId`,
      description: 'Security group ID for EC2 instance',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
