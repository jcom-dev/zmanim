import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
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
 * Story 7.4: EC2 Instance & EBS Storage
 *
 * Architecture (Two-Volume Strategy):
 * ┌─────────────────────────────────────────┐
 * │  EC2 Instance (from Packer AMI)         │
 * │  ┌─────────────┐  ┌───────────────────┐ │
 * │  │ Root EBS    │  │ Data EBS          │ │
 * │  │ 10GB gp3    │  │ 20GB gp3          │ │
 * │  │ /           │  │ /data             │ │
 * │  │ (from AMI)  │  │ - /data/postgres  │ │
 * │  │ DISPOSABLE  │  │ - /data/redis     │ │
 * │  └─────────────┘  │ PERSISTENT        │ │
 * │        ↓          └───────────────────┘ │
 * │   Replaced on         ↓                 │
 * │   AMI upgrade    Survives AMI upgrades  │
 * └─────────────────────────────────────────┘
 *
 * Key Design Decisions:
 * - m7g.medium Graviton3 (ARM64): 20% better price/performance vs x86
 * - Root volume from AMI: OS + binaries, replaced on upgrade
 * - Data volume persistent: PostgreSQL + Redis data survives AMI upgrades
 * - Elastic IP: Stable public address for API Gateway
 * - IAM role: S3 (backups), SSM (secrets), SES (emails), CloudWatch (metrics/logs)
 * - User data: Mounts /data, pulls secrets from SSM, starts services
 *
 * Cost Target: ~$33/month (EC2 + EBS + EIP)
 */
export class ComputeStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly elasticIp: ec2.CfnEIP;
  public readonly dataVolume: ec2.CfnVolume;
  public readonly instanceRole: iam.Role;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { config, vpc, securityGroup } = props;

    // =========================================================================
    // Task 5: IAM Role (AC5)
    // =========================================================================
    // Grants access to:
    // - S3: Backup/release buckets (s3:GetObject, s3:PutObject, s3:ListBucket)
    // - SSM: Parameter Store secrets (ssm:GetParameter with decryption)
    // - SES: Backup failure email notifications (ses:SendEmail)
    // - CloudWatch: Metrics and logs (cloudwatch:PutMetricData, logs:*)
    // - SSM Session Manager: AWS Console login (AmazonSSMManagedInstanceCore)
    this.instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: `zmanim-instance-role-${config.environment}`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        // Task 5.6: SSM Session Manager for AWS Console login (no SSH keys needed)
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // CloudWatch Agent policy for metrics and logs
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
      description: 'IAM role for Zmanim EC2 instance - S3, SSM, SES, CloudWatch access',
    });

    // Task 5.2: S3 access policy for backup/releases buckets
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'S3BucketAccess',
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [
          `arn:aws:s3:::zmanim-backups-${config.environment}`,
          `arn:aws:s3:::zmanim-backups-${config.environment}/*`,
          `arn:aws:s3:::zmanim-releases-${config.environment}`,
          `arn:aws:s3:::zmanim-releases-${config.environment}/*`,
        ],
        effect: iam.Effect.ALLOW,
      })
    );

    // Task 5.3: SSM Parameter Store access for /zmanim/prod/*
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SSMParameterAccess',
        actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
        resources: [`arn:aws:ssm:${config.region}:*:parameter/zmanim/${config.environment}/*`],
        effect: iam.Effect.ALLOW,
      })
    );

    // KMS decrypt for SSM SecureString parameters
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'KMSDecrypt',
        actions: ['kms:Decrypt'],
        resources: ['*'], // SSM uses default AWS managed key
        conditions: {
          StringEquals: {
            'kms:ViaService': `ssm.${config.region}.amazonaws.com`,
          },
        },
        effect: iam.Effect.ALLOW,
      })
    );

    // Task 5.4: SES policy for backup failure email notifications
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SESSendEmail',
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'], // SES doesn't support resource-level permissions for SendEmail
        effect: iam.Effect.ALLOW,
      })
    );

    // Task 5.5: CloudWatch policy for metrics and logs (supplemental to managed policy)
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchMetrics',
        actions: [
          'cloudwatch:PutMetricData',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:ListMetrics',
        ],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'ZmanimApp',
          },
        },
        effect: iam.Effect.ALLOW,
      })
    );

    // =========================================================================
    // Task 1: EC2 Instance from Packer AMI (AC1)
    // =========================================================================
    // - m7g.medium Graviton3 (2 vCPU, 4GB RAM)
    // - AMI ID from SSM Parameter Store: /zmanim/prod/ami-id
    // - Placed in public subnet from NetworkStack
    // - Attached security group from NetworkStack

    // Task 1.3: Get AMI ID from SSM Parameter Store
    // The AMI ID is stored in SSM by the Packer build pipeline (build-ami.yml)
    // This avoids CDK context caching issues when AMIs are rebuilt
    // SSM Parameter: /zmanim/{env}/ami-id
    const amiId = ssm.StringParameter.valueForStringParameter(
      this,
      `/zmanim/${config.environment}/ami-id`
    );

    // Create machine image from SSM-sourced AMI ID
    const zmanimAmi = ec2.MachineImage.genericLinux({
      [config.region]: amiId,
    });

    // Task 6: User Data Script (AC6)
    // Minimal user-data: only mount data volume, let firstboot.sh handle the rest
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -euo pipefail',
      '',
      '# ============================================',
      '# Zmanim EC2 User Data Script',
      '# Story 7.4: Mount data volume only',
      '# All other config handled by firstboot.sh in AMI',
      '# ============================================',
      '',
      'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
      'echo "Starting user data script at $(date)"',
      '',
      '# Mount data volume at /data if not already mounted',
      '# IMPORTANT: Use filesystem label to identify the volume, not device name',
      '# NVMe device names can change between instance launches (/dev/nvme1n1 vs /dev/nvme2n1)',
      'DATA_LABEL="zmanim-data"',
      'DATA_MOUNT="/data"',
      '',
      'if ! mountpoint -q $DATA_MOUNT; then',
      '    echo "Data volume not mounted, looking for labeled volume..."',
      '    ',
      '    # Wait for any NVMe device to appear (up to 60 seconds)',
      '    for i in {1..60}; do',
      '        # Look for device with our label',
      '        DATA_DEVICE=$(blkid -L "$DATA_LABEL" 2>/dev/null || true)',
      '        if [ -n "$DATA_DEVICE" ] && [ -b "$DATA_DEVICE" ]; then',
      '            echo "Found labeled volume $DATA_LABEL at $DATA_DEVICE"',
      '            break',
      '        fi',
      '        ',
      '        # If no labeled device, check for unformatted NVMe devices (first boot only)',
      '        for dev in /dev/nvme1n1 /dev/nvme2n1 /dev/nvme3n1; do',
      '            if [ -b "$dev" ] && ! blkid "$dev" | grep -q "TYPE="; then',
      '                echo "Found unformatted device $dev - this appears to be first boot"',
      '                echo "Formatting $dev as XFS with label $DATA_LABEL..."',
      '                mkfs.xfs -L "$DATA_LABEL" "$dev"',
      '                DATA_DEVICE="$dev"',
      '                break 2',
      '            fi',
      '        done',
      '        ',
      '        echo "Waiting for data volume... ($i/60)"',
      '        sleep 1',
      '    done',
      '    ',
      '    if [ -z "$DATA_DEVICE" ] || [ ! -b "$DATA_DEVICE" ]; then',
      '        echo "ERROR: Data volume with label $DATA_LABEL not found after 60 seconds"',
      '        echo "Available block devices:"',
      '        lsblk',
      '        echo "Block device info:"',
      '        blkid',
      '        exit 1',
      '    fi',
      '    ',
      '    # Create mount point and mount by label (stable across reboots)',
      '    mkdir -p $DATA_MOUNT',
      '    mount LABEL="$DATA_LABEL" $DATA_MOUNT',
      '    ',
      '    # Add to fstab using label (stable across device name changes)',
      '    if ! grep -q "LABEL=$DATA_LABEL" /etc/fstab; then',
      '        # Remove any old device-based entry for /data',
      '        sed -i "\\|$DATA_MOUNT|d" /etc/fstab',
      '        echo "LABEL=$DATA_LABEL $DATA_MOUNT xfs defaults,nofail 0 2" >> /etc/fstab',
      '    fi',
      '    ',
      '    echo "Data volume mounted at $DATA_MOUNT (label: $DATA_LABEL)"',
      'else',
      '    echo "Data volume already mounted at $DATA_MOUNT"',
      'fi',
      '',
      '# Create data subdirectories with correct ownership',
      'mkdir -p /data/postgres /data/redis',
      'chown postgres:postgres /data/postgres',
      'chmod 700 /data/postgres',
      'chown redis:redis /data/redis',
      'chmod 750 /data/redis',
      '',
      'echo "User data script completed at $(date)"',
      'echo "Firstboot service will handle SSM config and service startup"',
      'echo "============================================"'
    );

    // Task 1.1 & 1.2: Define EC2 instance with m7g.medium Graviton3
    this.instance = new ec2.Instance(this, 'ZmanimInstance', {
      instanceName: `zmanim-api-${config.environment}`,
      // Task 1.2: m7g.medium Graviton3 (2 vCPU, 4GB RAM, ARM64)
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M7G, ec2.InstanceSize.MEDIUM),
      // Task 1.3: Use latest Packer AMI by name lookup (zmanim-*)
      machineImage: zmanimAmi,
      // Task 1.4: Place in public subnet from NetworkStack
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      // Task 1.5: Attach security group from NetworkStack
      securityGroup,
      // Task 5.7: Attach instance profile
      role: this.instanceRole,
      // Task 2: Root EBS Volume (AC2) - 10GB gp3, disposable
      blockDevices: [
        {
          deviceName: '/dev/sda1', // Ubuntu uses /dev/sda1 for root
          volume: ec2.BlockDeviceVolume.ebs(10, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
            deleteOnTermination: true, // Task 2.2: Disposable on AMI upgrade
          }),
        },
      ],
      // Task 6: User data script
      userData,
      // Enable detailed monitoring for CloudWatch
      detailedMonitoring: true,
    });

    // =========================================================================
    // Task 3: Persistent Data Volume (AC3)
    // =========================================================================
    // - 20GB gp3 with 3000 IOPS baseline
    // - deleteOnTermination: false (CRITICAL for data persistence)
    // - Mounted at /data for PostgreSQL and Redis data
    // - Survives AMI upgrades

    // Get the availability zone from the instance
    const availabilityZone = vpc.publicSubnets[0].availabilityZone;

    // Task 3.1 & 3.2: Create standalone EBS volume 20GB gp3 with 3000 IOPS
    // Note: Changed logical ID to 'PersistentDataVolume' to force new volume creation
    // after old volume was deleted outside of CloudFormation
    this.dataVolume = new ec2.CfnVolume(this, 'PersistentDataVolume', {
      availabilityZone,
      size: 30, // Task 3.1: 30GB
      volumeType: 'gp3', // gp3 for baseline performance
      iops: 3000, // Task 3.2: 3000 IOPS baseline
      throughput: 125, // 125 MiB/s throughput (gp3 default)
      encrypted: true,
      tags: [
        { key: 'Name', value: `zmanim-data-${config.environment}` },
        { key: 'Project', value: 'zmanim' },
        { key: 'Environment', value: config.environment },
        { key: 'Type', value: 'data' },
        { key: 'MountPoint', value: '/data' },
        { key: 'Persistent', value: 'true' }, // Tag for easy identification
      ],
    });

    // Task 3.3: deleteOnTermination: false is default for CfnVolume (not attached via blockDevices)

    // Task 3.4: Attach data volume to instance as /dev/sdf
    new ec2.CfnVolumeAttachment(this, 'PersistentDataVolumeAttachment', {
      device: '/dev/sdf', // Will appear as /dev/nvme1n1 on Nitro instances
      instanceId: this.instance.instanceId,
      volumeId: this.dataVolume.ref,
    });

    // =========================================================================
    // Task 4: Elastic IP (AC4)
    // =========================================================================
    // Task 4.1: Create Elastic IP resource
    this.elasticIp = new ec2.CfnEIP(this, 'ElasticIp', {
      domain: 'vpc',
      tags: [
        { key: 'Name', value: `zmanim-eip-${config.environment}` },
        { key: 'Project', value: 'zmanim' },
        { key: 'Environment', value: config.environment },
      ],
    });

    // Task 4.2: Associate Elastic IP with EC2 instance
    new ec2.CfnEIPAssociation(this, 'EipAssociation', {
      allocationId: this.elasticIp.attrAllocationId,
      instanceId: this.instance.instanceId,
    });

    // =========================================================================
    // CloudFormation Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'InstanceId', {
      value: this.instance.instanceId,
      exportName: `${config.stackPrefix}-InstanceId`,
      description: 'EC2 instance ID',
    });

    // Task 4.3: Export EIP address for API Gateway integration
    new cdk.CfnOutput(this, 'ElasticIpAddress', {
      value: this.elasticIp.ref,
      exportName: `${config.stackPrefix}-ElasticIp`,
      description: 'Elastic IP address for API Gateway integration',
    });

    new cdk.CfnOutput(this, 'InstanceRoleArn', {
      value: this.instanceRole.roleArn,
      exportName: `${config.stackPrefix}-InstanceRoleArn`,
      description: 'IAM role ARN for EC2 instance',
    });

    new cdk.CfnOutput(this, 'DataVolumeId', {
      value: this.dataVolume.ref,
      exportName: `${config.stackPrefix}-DataVolumeId`,
      description: 'Persistent data EBS volume ID (survives AMI upgrades)',
    });

    new cdk.CfnOutput(this, 'AmiId', {
      value: amiId,
      description: 'AMI ID from SSM Parameter Store (/zmanim/{env}/ami-id)',
    });

    // =========================================================================
    // Tags
    // =========================================================================
    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Story', '7.4');
  }
}
