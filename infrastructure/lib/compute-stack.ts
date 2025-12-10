import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface ComputeStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
}

/**
 * ComputeStack - EC2 instance, EBS volumes, IAM roles, Elastic IP
 *
 * Architecture:
 * - m7g.medium Graviton3 instance (2 vCPU, 4GB RAM)
 * - Root EBS: 10GB gp3 (from AMI, disposable on upgrade)
 * - Data EBS: 20GB gp3 (persistent, mounted at /data for PostgreSQL + Redis)
 * - Elastic IP for stable public address
 * - IAM role for S3, SSM, SES access
 *
 * Story 7.4 will implement full EC2 configuration
 */
export class ComputeStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly elasticIp: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { config, vpc, securityGroup } = props;

    // IAM role for EC2 instance
    // Grants access to S3 (backups), SSM (secrets), SES (emails)
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: `zmanim-instance-role-${config.environment}`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
      description: 'IAM role for Zmanim EC2 instance',
    });

    // S3 access policy (will be expanded in Story 7.5)
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        resources: [
          `arn:aws:s3:::zmanim-*-${config.environment}`,
          `arn:aws:s3:::zmanim-*-${config.environment}/*`,
        ],
        effect: iam.Effect.ALLOW,
      })
    );

    // SSM Parameter Store access (will be expanded in Story 7.9)
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:${config.region}:*:parameter/zmanim/${config.environment}/*`],
        effect: iam.Effect.ALLOW,
      })
    );

    // Placeholder EC2 instance - Story 7.4 will configure AMI, user data, etc.
    // Using Amazon Linux 2023 ARM64 as placeholder (Packer AMI will replace)
    this.instance = new ec2.Instance(this, 'ZmanimInstance', {
      instanceName: `zmanim-api-${config.environment}`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M7G, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup,
      role: instanceRole,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(10, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    // Elastic IP for stable public address
    this.elasticIp = new ec2.CfnEIP(this, 'ElasticIp', {
      domain: 'vpc',
      tags: [
        { key: 'Name', value: `zmanim-eip-${config.environment}` },
        { key: 'Project', value: 'zmanim' },
      ],
    });

    // Associate Elastic IP with instance
    // Using allocationId instead of deprecated eip property
    new ec2.CfnEIPAssociation(this, 'EipAssociation', {
      allocationId: this.elasticIp.attrAllocationId,
      instanceId: this.instance.instanceId,
    });

    // Outputs
    new cdk.CfnOutput(this, 'InstanceId', {
      value: this.instance.instanceId,
      exportName: `${config.stackPrefix}-InstanceId`,
      description: 'EC2 instance ID',
    });

    new cdk.CfnOutput(this, 'ElasticIpAddress', {
      value: this.elasticIp.ref,
      exportName: `${config.stackPrefix}-ElasticIp`,
      description: 'Elastic IP address for API',
    });

    new cdk.CfnOutput(this, 'InstanceRoleArn', {
      value: instanceRole.roleArn,
      exportName: `${config.stackPrefix}-InstanceRoleArn`,
      description: 'IAM role ARN for EC2 instance',
    });

    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
