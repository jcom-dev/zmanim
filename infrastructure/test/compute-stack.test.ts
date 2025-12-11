import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ComputeStack } from '../lib/compute-stack';
import { NetworkStack } from '../lib/network-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { EnvironmentConfig } from '../lib/config';

/**
 * Story 7.4: EC2 Instance & EBS Storage - CDK Assertions Tests
 *
 * Test cases mapped to acceptance criteria:
 * - TC-7.4.1: EC2 Instance Configuration (AC1)
 * - TC-7.4.2: Root EBS Volume (AC2)
 * - TC-7.4.3: Persistent Data Volume (AC3)
 * - TC-7.4.4: Elastic IP (AC4)
 * - TC-7.4.5: IAM Role Permissions (AC5)
 * - TC-7.4.6: User Data Script (AC6)
 * - TC-7.4.7: CloudWatch Agent (AC7)
 */

describe('ComputeStack', () => {
  let app: cdk.App;
  let networkStack: NetworkStack;
  let apiGatewayStack: ApiGatewayStack;
  let computeStack: ComputeStack;
  let template: Template;

  const testConfig: EnvironmentConfig = {
    environment: 'prod',
    region: 'eu-west-1',
    account: '123456789012',
    domain: 'zmanim.shtetl.io',
    stackPrefix: 'ZmanimProd',
    instanceType: 'm7g.medium',
    adminCidr: '10.0.0.0/8',
  };

  beforeEach(() => {
    app = new cdk.App();
    networkStack = new NetworkStack(app, 'TestNetworkStack', {
      config: testConfig,
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    // ApiGatewayStack now creates the Elastic IP
    apiGatewayStack = new ApiGatewayStack(app, 'TestApiGatewayStack', {
      config: testConfig,
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    computeStack = new ComputeStack(app, 'TestComputeStack', {
      config: testConfig,
      vpc: networkStack.vpc,
      securityGroup: networkStack.ec2SecurityGroup,
      elasticIp: apiGatewayStack.elasticIp,
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    template = Template.fromStack(computeStack);
  });

  // TC-7.4.1: EC2 Instance Configuration (AC1)
  describe('EC2 Instance Configuration', () => {
    test('creates EC2 instance with m7g.medium instance type', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        InstanceType: 'm7g.medium',
      });
    });

    test('instance references AMI from SSM Parameter Store', () => {
      // Check that ImageId references SSM parameter
      template.hasResourceProperties('AWS::EC2::Instance', {
        ImageId: {
          Ref: Match.stringLikeRegexp('.*zmanimprodamiid.*'),
        },
      });
    });

    test('SSM parameter default is /zmanim/prod/ami-id', () => {
      const params = template.findParameters('*');
      const amiParam = Object.entries(params).find(([key]) =>
        key.toLowerCase().includes('amiid')
      );
      expect(amiParam).toBeDefined();
      expect(amiParam![1].Default).toBe('/zmanim/prod/ami-id');
    });

    test('instance is placed in public subnet', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        SubnetId: Match.anyValue(),
      });
    });

    test('instance has security group attached', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        SecurityGroupIds: Match.anyValue(),
      });
    });

    test('instance has detailed monitoring enabled', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        Monitoring: true,
      });
    });

    test('instance has IAM instance profile attached', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        IamInstanceProfile: Match.anyValue(),
      });
    });
  });

  // TC-7.4.2: Root EBS Volume (AC2)
  describe('Root EBS Volume', () => {
    test('root volume is 10GB gp3', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        BlockDeviceMappings: Match.arrayWith([
          Match.objectLike({
            DeviceName: '/dev/sda1',
            Ebs: Match.objectLike({
              VolumeSize: 10,
              VolumeType: 'gp3',
            }),
          }),
        ]),
      });
    });

    test('root volume has deleteOnTermination true', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        BlockDeviceMappings: Match.arrayWith([
          Match.objectLike({
            DeviceName: '/dev/sda1',
            Ebs: Match.objectLike({
              DeleteOnTermination: true,
            }),
          }),
        ]),
      });
    });

    test('root volume is encrypted', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        BlockDeviceMappings: Match.arrayWith([
          Match.objectLike({
            Ebs: Match.objectLike({
              Encrypted: true,
            }),
          }),
        ]),
      });
    });
  });

  // TC-7.4.3: Persistent Data Volume (AC3)
  describe('Persistent Data Volume', () => {
    test('creates standalone EBS volume', () => {
      template.resourceCountIs('AWS::EC2::Volume', 1);
    });

    test('data volume is 30GB gp3 with 3000 IOPS', () => {
      template.hasResourceProperties('AWS::EC2::Volume', {
        Size: 30,
        VolumeType: 'gp3',
        Iops: 3000,
      });
    });

    test('data volume is encrypted', () => {
      template.hasResourceProperties('AWS::EC2::Volume', {
        Encrypted: true,
      });
    });

    test('data volume has throughput configured', () => {
      template.hasResourceProperties('AWS::EC2::Volume', {
        Throughput: 125,
      });
    });

    test('creates volume attachment to instance', () => {
      template.hasResourceProperties('AWS::EC2::VolumeAttachment', {
        Device: '/dev/sdf',
      });
    });

    test('data volume has persistent tag', () => {
      template.hasResourceProperties('AWS::EC2::Volume', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'Persistent',
            Value: 'true',
          }),
        ]),
      });
    });

    test('data volume has mount point tag', () => {
      template.hasResourceProperties('AWS::EC2::Volume', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'MountPoint',
            Value: '/data',
          }),
        ]),
      });
    });
  });

  // TC-7.4.4: Elastic IP Association (AC4)
  // Note: EIP is now created in ApiGatewayStack, ComputeStack only associates it
  describe('Elastic IP Association', () => {
    test('EIP is associated with instance', () => {
      template.hasResourceProperties('AWS::EC2::EIPAssociation', {
        InstanceId: Match.anyValue(),
        AllocationId: Match.anyValue(),
      });
    });

    test('does not create its own Elastic IP (uses one from ApiGatewayStack)', () => {
      template.resourceCountIs('AWS::EC2::EIP', 0);
    });
  });

  // TC-7.4.5: IAM Role Permissions (AC5)
  describe('IAM Role', () => {
    test('creates IAM role for EC2', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: {
                Service: 'ec2.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            }),
          ]),
        }),
      });
    });

    test('role has AmazonSSMManagedInstanceCore managed policy', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: Match.arrayWith([
          Match.objectLike({
            'Fn::Join': Match.arrayWith([
              Match.arrayWith([Match.stringLikeRegexp('.*AmazonSSMManagedInstanceCore.*')]),
            ]),
          }),
        ]),
      });
    });

    test('role has CloudWatchAgentServerPolicy managed policy', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: Match.arrayWith([
          Match.objectLike({
            'Fn::Join': Match.arrayWith([
              Match.arrayWith([Match.stringLikeRegexp('.*CloudWatchAgentServerPolicy.*')]),
            ]),
          }),
        ]),
      });
    });

    test('role has S3 access policy', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'S3BucketAccess',
              Action: Match.arrayWith(['s3:GetObject', 's3:PutObject', 's3:ListBucket']),
              Resource: Match.arrayWith([
                'arn:aws:s3:::zmanim-backups-prod',
                'arn:aws:s3:::zmanim-backups-prod/*',
              ]),
            }),
          ]),
        }),
      });
    });

    test('role has SSM Parameter Store access policy', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'SSMParameterAccess',
              Action: Match.arrayWith(['ssm:GetParameter', 'ssm:GetParameters']),
              Resource: 'arn:aws:ssm:eu-west-1:*:parameter/zmanim/prod/*',
            }),
          ]),
        }),
      });
    });

    test('role has SES email policy', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'SESSendEmail',
              Action: Match.arrayWith(['ses:SendEmail', 'ses:SendRawEmail']),
            }),
          ]),
        }),
      });
    });

    test('role has CloudWatch metrics policy', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'CloudWatchMetrics',
              Action: Match.arrayWith(['cloudwatch:PutMetricData']),
            }),
          ]),
        }),
      });
    });

    test('role has KMS decrypt policy for SSM SecureStrings', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'KMSDecrypt',
              Action: 'kms:Decrypt',
            }),
          ]),
        }),
      });
    });

    test('creates instance profile', () => {
      template.resourceCountIs('AWS::IAM::InstanceProfile', 1);
    });
  });

  // TC-7.4.6: User Data Script (AC6)
  // Note: User data is now minimal - only mounts data volume.
  // SSM secrets, service startup, and CloudWatch config are handled by firstboot.sh in the AMI.
  describe('User Data Script', () => {
    test('instance has user data configured', () => {
      template.hasResourceProperties('AWS::EC2::Instance', {
        UserData: Match.objectLike({
          'Fn::Base64': Match.anyValue(),
        }),
      });
    });

    test('user data contains mount commands for /data', () => {
      const instance = template.findResources('AWS::EC2::Instance');
      const userData = Object.values(instance)[0].Properties.UserData['Fn::Base64'];
      expect(userData).toContain('DATA_MOUNT="/data"');
    });

    test('user data creates PostgreSQL directory', () => {
      const instance = template.findResources('AWS::EC2::Instance');
      const userData = Object.values(instance)[0].Properties.UserData['Fn::Base64'];
      expect(userData).toContain('/data/postgres');
    });

    test('user data creates Redis directory', () => {
      const instance = template.findResources('AWS::EC2::Instance');
      const userData = Object.values(instance)[0].Properties.UserData['Fn::Base64'];
      expect(userData).toContain('/data/redis');
    });

    test('user data references firstboot.sh for config', () => {
      const instance = template.findResources('AWS::EC2::Instance');
      const userData = Object.values(instance)[0].Properties.UserData['Fn::Base64'];
      expect(userData).toContain('firstboot');
    });
  });

  // CloudFormation Outputs
  describe('Stack Outputs', () => {
    test('exports Instance ID', () => {
      template.hasOutput('InstanceId', {
        Export: {
          Name: `${testConfig.stackPrefix}-InstanceId`,
        },
      });
    });

    // Note: ElasticIpAddress output is now in ApiGatewayStack where EIP is created

    test('exports Instance Role ARN', () => {
      template.hasOutput('InstanceRoleArn', {
        Export: {
          Name: `${testConfig.stackPrefix}-InstanceRoleArn`,
        },
      });
    });

    test('exports Data Volume ID', () => {
      template.hasOutput('DataVolumeId', {
        Export: {
          Name: `${testConfig.stackPrefix}-DataVolumeId`,
        },
      });
    });

    test('outputs AMI ID', () => {
      template.hasOutput('AmiId', {});
    });
  });

  // Tags
  describe('Resource Tags', () => {
    test('instance has required tags', () => {
      // Check each tag individually to avoid array matching issues
      const instances = template.findResources('AWS::EC2::Instance');
      const instanceResource = Object.values(instances)[0];
      const tags = instanceResource.Properties.Tags as Array<{ Key: string; Value: string }>;

      expect(tags).toContainEqual({ Key: 'Project', Value: 'zmanim' });
      expect(tags).toContainEqual({ Key: 'Environment', Value: 'prod' });
      expect(tags).toContainEqual({ Key: 'ManagedBy', Value: 'cdk' });
      expect(tags).toContainEqual({ Key: 'Story', Value: '7.4' });
    });

    test('data volume has required tags', () => {
      const volumes = template.findResources('AWS::EC2::Volume');
      const volumeResource = Object.values(volumes)[0];
      const tags = volumeResource.Properties.Tags as Array<{ Key: string; Value: string }>;

      expect(tags).toContainEqual({ Key: 'Project', Value: 'zmanim' });
      expect(tags).toContainEqual({ Key: 'Environment', Value: 'prod' });
      expect(tags).toContainEqual({ Key: 'Type', Value: 'data' });
    });

    // Note: EIP tags test moved to ApiGatewayStack tests where EIP is created
  });
});
