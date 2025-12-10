import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/network-stack';
import { EnvironmentConfig } from '../lib/config';

/**
 * Story 7.3: VPC & Network Infrastructure - CDK Assertions Tests
 *
 * Test cases mapped to acceptance criteria:
 * - TC-7.3.1: VPC with correct CIDR block (AC1)
 * - TC-7.3.2: Internet Gateway attachment (AC2)
 * - TC-7.3.3: S3 Gateway Endpoint (AC3)
 * - TC-7.3.4: Security Group rules (AC4)
 * - TC-7.3.5: No NAT Gateway (AC5)
 * - TC-7.3.10: DNS Configuration
 */

describe('NetworkStack', () => {
  let app: cdk.App;
  let stack: NetworkStack;
  let template: Template;

  const testConfig: EnvironmentConfig = {
    environment: 'prod',
    region: 'eu-west-1',
    account: '123456789012',
    domain: 'zmanim.shtetl.io',
    stackPrefix: 'ZmanimProd',
    instanceType: 'm7g.medium',
    adminCidr: '10.0.0.0/8', // Test admin CIDR
  };

  beforeEach(() => {
    app = new cdk.App();
    stack = new NetworkStack(app, 'TestNetworkStack', {
      config: testConfig,
      env: {
        account: testConfig.account,
        region: testConfig.region,
      },
    });
    template = Template.fromStack(stack);
  });

  // TC-7.3.1: VPC Synthesis (AC1)
  describe('VPC Configuration', () => {
    test('creates VPC with correct CIDR block', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: '10.0.0.0/16',
      });
    });

    test('VPC has DNS hostnames enabled', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        EnableDnsHostnames: true,
      });
    });

    test('VPC has DNS support enabled', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        EnableDnsSupport: true,
      });
    });

    test('creates public subnet with public IP mapping', () => {
      // Note: AZ is 'dummy1a' in test context (no real AWS env)
      // In real deployment, CDK uses maxAzs: 1 to pick eu-west-1a
      template.hasResourceProperties('AWS::EC2::Subnet', {
        MapPublicIpOnLaunch: true,
      });
    });

    test('public subnet has correct CIDR mask', () => {
      // Subnet should be /24 within the 10.0.0.0/16 VPC
      template.hasResourceProperties('AWS::EC2::Subnet', {
        CidrBlock: Match.stringLikeRegexp('^10\\.0\\.[0-9]+\\.0/24$'),
      });
    });
  });

  // TC-7.3.2: Internet Gateway Attachment (AC2)
  describe('Internet Gateway', () => {
    test('creates Internet Gateway', () => {
      template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    });

    test('attaches Internet Gateway to VPC', () => {
      template.hasResource('AWS::EC2::VPCGatewayAttachment', {
        Properties: {
          InternetGatewayId: Match.anyValue(),
          VpcId: Match.anyValue(),
        },
      });
    });

    test('creates default route to Internet Gateway', () => {
      template.hasResourceProperties('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        GatewayId: Match.anyValue(),
      });
    });
  });

  // TC-7.3.3: S3 Gateway Endpoint (AC3)
  describe('S3 Gateway Endpoint', () => {
    test('creates S3 VPC Gateway Endpoint', () => {
      template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
        VpcEndpointType: 'Gateway',
        ServiceName: Match.objectLike({
          'Fn::Join': Match.arrayWith([
            Match.arrayWith([Match.stringLikeRegexp('.*\\.s3$')]),
          ]),
        }),
      });
    });

    test('S3 endpoint is associated with route table', () => {
      template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
        RouteTableIds: Match.anyValue(),
      });
    });
  });

  // TC-7.3.4: Security Group Rules (AC4)
  describe('Security Group', () => {
    test('creates EC2 security group', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for Zmanim EC2 instance',
      });
    });

    test('allows HTTPS (443) ingress', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        SecurityGroupIngress: Match.arrayWith([
          Match.objectLike({
            FromPort: 443,
            ToPort: 443,
            IpProtocol: 'tcp',
          }),
        ]),
      });
    });

    test('allows SSH (22) from admin CIDR', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        SecurityGroupIngress: Match.arrayWith([
          Match.objectLike({
            FromPort: 22,
            ToPort: 22,
            IpProtocol: 'tcp',
            CidrIp: testConfig.adminCidr,
          }),
        ]),
      });
    });

    test('allows API (8080) ingress', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        SecurityGroupIngress: Match.arrayWith([
          Match.objectLike({
            FromPort: 8080,
            ToPort: 8080,
            IpProtocol: 'tcp',
          }),
        ]),
      });
    });

    test('allows all outbound traffic', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        SecurityGroupEgress: Match.arrayWith([
          Match.objectLike({
            CidrIp: '0.0.0.0/0',
            IpProtocol: '-1',
          }),
        ]),
      });
    });
  });

  // TC-7.3.5: No NAT Gateway (AC5)
  describe('No NAT Gateway', () => {
    test('does not create NAT Gateway', () => {
      template.resourceCountIs('AWS::EC2::NatGateway', 0);
    });

    test('does not create Elastic IP for NAT', () => {
      // EIPs should not exist for NAT (only for EC2 in ComputeStack)
      // This stack should have no EIPs
      const eips = template.findResources('AWS::EC2::EIP');
      expect(Object.keys(eips).length).toBe(0);
    });
  });

  // CloudFormation Outputs
  describe('Stack Outputs', () => {
    test('exports VPC ID', () => {
      template.hasOutput('VpcId', {
        Export: {
          Name: `${testConfig.stackPrefix}-VpcId`,
        },
      });
    });

    test('exports VPC CIDR', () => {
      template.hasOutput('VpcCidr', {
        Export: {
          Name: `${testConfig.stackPrefix}-VpcCidr`,
        },
      });
    });

    test('exports Public Subnet ID', () => {
      template.hasOutput('PublicSubnetId', {
        Export: {
          Name: `${testConfig.stackPrefix}-PublicSubnetId`,
        },
      });
    });

    test('exports Security Group ID', () => {
      template.hasOutput('SecurityGroupId', {
        Export: {
          Name: `${testConfig.stackPrefix}-SecurityGroupId`,
        },
      });
    });

    test('outputs S3 Endpoint ID', () => {
      template.hasOutput('S3EndpointId', {});
    });

    test('outputs Internet Gateway ID', () => {
      template.hasOutput('InternetGatewayId', {});
    });
  });

  // Tags
  describe('Resource Tags', () => {
    test('VPC has required tags', () => {
      // Test each tag individually since arrayWith matching can be strict
      const vpcResources = template.findResources('AWS::EC2::VPC');
      const vpcResource = Object.values(vpcResources)[0];
      const tags = vpcResource.Properties.Tags as Array<{ Key: string; Value: string }>;

      expect(tags).toContainEqual({ Key: 'Project', Value: 'zmanim' });
      expect(tags).toContainEqual({ Key: 'Environment', Value: 'prod' });
      expect(tags).toContainEqual({ Key: 'ManagedBy', Value: 'cdk' });
      expect(tags).toContainEqual({ Key: 'Story', Value: '7.3' });
    });
  });
});

// TC-7.3.4.1: Security Group without admin CIDR
describe('NetworkStack without admin CIDR', () => {
  test('uses placeholder CIDR for SSH when adminCidr not set', () => {
    const app = new cdk.App();
    const configWithoutAdmin: EnvironmentConfig = {
      environment: 'prod',
      region: 'eu-west-1',
      account: '123456789012',
      domain: 'zmanim.shtetl.io',
      stackPrefix: 'ZmanimProd',
      instanceType: 'm7g.medium',
      // adminCidr not set
    };

    const stack = new NetworkStack(app, 'TestNoAdminStack', {
      config: configWithoutAdmin,
      env: {
        account: configWithoutAdmin.account,
        region: configWithoutAdmin.region,
      },
    });
    const template = Template.fromStack(stack);

    // Should use placeholder CIDR that blocks all SSH
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          FromPort: 22,
          ToPort: 22,
          IpProtocol: 'tcp',
          CidrIp: '127.0.0.1/32', // Placeholder blocks SSH
        }),
      ]),
    });
  });
});
