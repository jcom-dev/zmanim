/**
 * Shtetl Common Stack - Shared infrastructure for all Shtetl projects
 *
 * This stack contains:
 * - Terraform State Bucket (shtetl-tf)
 * - VPC + Public Subnet + Internet Gateway + S3 Endpoint
 * - Route53 Hosted Zone (imported)
 * - GitHub OIDC Provider + Deploy Role
 *
 * State Key: s3://shtetl-tf/shtetl-common/terraform.tfstate
 */

import { Construct } from "constructs";
import { TerraformStack, TerraformOutput, S3Backend } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketVersioningA } from "@cdktf/provider-aws/lib/s3-bucket-versioning";
import { S3BucketServerSideEncryptionConfigurationA } from "@cdktf/provider-aws/lib/s3-bucket-server-side-encryption-configuration";
import { S3BucketPublicAccessBlock } from "@cdktf/provider-aws/lib/s3-bucket-public-access-block";
import { S3BucketPolicy } from "@cdktf/provider-aws/lib/s3-bucket-policy";
import { Vpc } from "@cdktf/provider-aws/lib/vpc";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { Route } from "@cdktf/provider-aws/lib/route";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";
import { VpcEndpoint } from "@cdktf/provider-aws/lib/vpc-endpoint";
import { Route53Zone } from "@cdktf/provider-aws/lib/route53-zone";
import { Route53Record } from "@cdktf/provider-aws/lib/route53-record";
import { IamOpenidConnectProvider } from "@cdktf/provider-aws/lib/iam-openid-connect-provider";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { DataAwsCallerIdentity } from "@cdktf/provider-aws/lib/data-aws-caller-identity";
import { KeyPair } from "@cdktf/provider-aws/lib/key-pair";

// CloudFront
import { CloudfrontCachePolicy } from "@cdktf/provider-aws/lib/cloudfront-cache-policy";
import { CloudfrontResponseHeadersPolicy } from "@cdktf/provider-aws/lib/cloudfront-response-headers-policy";
import { CloudfrontFunction } from "@cdktf/provider-aws/lib/cloudfront-function";
import { CloudfrontOriginAccessControl } from "@cdktf/provider-aws/lib/cloudfront-origin-access-control";

import { CommonConfig } from "../config";

export interface ShtetlCommonStackOptions {
  config: CommonConfig;
  /** Skip S3 backend config for bootstrap phase */
  skipBackend?: boolean;
}

export class ShtetlCommonStack extends TerraformStack {
  public readonly stateBucket: S3Bucket;
  public readonly vpc: Vpc;
  public readonly publicSubnet: Subnet;
  public readonly internetGateway: InternetGateway;
  public readonly s3Endpoint: VpcEndpoint;
  public readonly hostedZone: Route53Zone;
  public readonly githubOidcProvider: IamOpenidConnectProvider;
  public readonly githubActionsRole: IamRole;

  // Shared CloudFront resources
  public readonly cfStaticAssetsCachePolicy: CloudfrontCachePolicy;
  public readonly cfHtmlCachePolicy: CloudfrontCachePolicy;
  public readonly cfApiCachePolicy: CloudfrontCachePolicy;
  public readonly cfSecurityHeadersPolicy: CloudfrontResponseHeadersPolicy;
  public readonly cfHostHeaderFunction: CloudfrontFunction;
  public readonly cfS3OriginAccessControl: CloudfrontOriginAccessControl;

  // Shared SSH Key Pair
  public readonly sshKeyPair: KeyPair;

  constructor(scope: Construct, id: string, options: ShtetlCommonStackOptions) {
    super(scope, id);

    const { config, skipBackend } = options;

    // ==========================================================================
    // Provider Configuration
    // ==========================================================================
    new AwsProvider(this, "aws", {
      region: config.region,
      defaultTags: [{ tags: config.defaultTags }],
    });

    // us-east-1 provider (required for CloudFront-related resources)
    new AwsProvider(this, "aws-us-east-1", {
      alias: "us_east_1",
      region: config.usEast1Region,
      defaultTags: [{ tags: config.defaultTags }],
    });

    // Get current AWS account ID
    const callerIdentity = new DataAwsCallerIdentity(this, "caller-identity");

    // ==========================================================================
    // S3 Backend Configuration (skip during bootstrap)
    // ==========================================================================
    if (!skipBackend) {
      new S3Backend(this, {
        bucket: config.stateBucketName,
        key: "shtetl-common/terraform.tfstate",
        region: config.region,
        encrypt: true,
      });
    }

    // ==========================================================================
    // 1.0 Terraform State Bucket
    // ==========================================================================
    this.stateBucket = new S3Bucket(this, "state-bucket", {
      bucket: config.stateBucketName,
      tags: { Name: "Terraform State" },
      lifecycle: {
        preventDestroy: true,
      },
    });

    new S3BucketVersioningA(this, "state-bucket-versioning", {
      bucket: this.stateBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });

    new S3BucketServerSideEncryptionConfigurationA(this, "state-bucket-encryption", {
      bucket: this.stateBucket.id,
      rule: [
        {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: "AES256",
          },
          bucketKeyEnabled: true,
        },
      ],
    });

    new S3BucketPublicAccessBlock(this, "state-bucket-public-access-block", {
      bucket: this.stateBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    // State bucket policy - enforce SSL and protect state files
    new S3BucketPolicy(this, "state-bucket-policy", {
      bucket: this.stateBucket.id,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "EnforceSSL",
            Effect: "Deny",
            Principal: "*",
            Action: "s3:*",
            Resource: [
              this.stateBucket.arn,
              `${this.stateBucket.arn}/*`,
            ],
            Condition: {
              Bool: {
                "aws:SecureTransport": "false",
              },
            },
          },
          {
            Sid: "DenyDeleteStateFiles",
            Effect: "Deny",
            Principal: "*",
            Action: ["s3:DeleteObject", "s3:DeleteObjectVersion"],
            Resource: `${this.stateBucket.arn}/*.tfstate`,
            Condition: {
              StringNotEquals: {
                "aws:PrincipalArn": [
                  `arn:aws:iam::${callerIdentity.accountId}:role/github-actions-deploy`,
                  `arn:aws:iam::${callerIdentity.accountId}:root`,
                ],
              },
            },
          },
        ],
      }),
    });

    // ==========================================================================
    // 1.1 VPC & Networking
    // ==========================================================================
    this.vpc = new Vpc(this, "vpc", {
      cidrBlock: config.vpcCidr,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: {
        Name: "shtetl-vpc",
        Project: "shtetl",
      },
    });

    this.publicSubnet = new Subnet(this, "public-subnet", {
      vpcId: this.vpc.id,
      cidrBlock: config.publicSubnetCidr,
      availabilityZone: config.availabilityZone,
      mapPublicIpOnLaunch: true,
      tags: {
        Name: "shtetl-public-subnet",
        Project: "shtetl",
      },
    });

    this.internetGateway = new InternetGateway(this, "igw", {
      vpcId: this.vpc.id,
      tags: {
        Name: "shtetl-igw",
        Project: "shtetl",
      },
    });

    const publicRouteTable = new RouteTable(this, "public-rt", {
      vpcId: this.vpc.id,
      tags: {
        Name: "shtetl-public-rt",
        Project: "shtetl",
      },
    });

    new Route(this, "public-route", {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: this.internetGateway.id,
    });

    new RouteTableAssociation(this, "public-rt-assoc", {
      subnetId: this.publicSubnet.id,
      routeTableId: publicRouteTable.id,
    });

    // S3 Gateway Endpoint (free)
    this.s3Endpoint = new VpcEndpoint(this, "s3-endpoint", {
      vpcId: this.vpc.id,
      serviceName: `com.amazonaws.${config.region}.s3`,
      vpcEndpointType: "Gateway",
      routeTableIds: [publicRouteTable.id],
      tags: {
        Name: "shtetl-s3-endpoint",
        Project: "shtetl",
      },
    });

    // ==========================================================================
    // 1.2 Route53 Hosted Zone & DNS Records (ALL IMPORTED)
    // ==========================================================================
    // NOTE: The hosted zone and all records already exist and will be imported.
    //
    // IMPORT COMMANDS:
    // terraform import 'aws_route53_zone.hosted-zone' Z079919527B3JRWEWJVH6
    // terraform import 'aws_route53_record.ns' Z079919527B3JRWEWJVH6_shtetl.io_NS
    // terraform import 'aws_route53_record.soa' Z079919527B3JRWEWJVH6_shtetl.io_SOA
    // terraform import 'aws_route53_record.mx-root' Z079919527B3JRWEWJVH6_shtetl.io_MX
    // terraform import 'aws_route53_record.txt-root' Z079919527B3JRWEWJVH6_shtetl.io_TXT
    // terraform import 'aws_route53_record.txt-dmarc' Z079919527B3JRWEWJVH6__dmarc.shtetl.io_TXT
    // terraform import 'aws_route53_record.txt-dkim-google' Z079919527B3JRWEWJVH6_google._domainkey.shtetl.io_TXT
    // terraform import 'aws_route53_record.txt-dkim-resend' Z079919527B3JRWEWJVH6_resend._domainkey.shtetl.io_TXT
    // terraform import 'aws_route53_record.txt-dkim-wiki' Z079919527B3JRWEWJVH6_wiki._domainkey.shtetl.io_TXT
    // terraform import 'aws_route53_record.a-ideas' Z079919527B3JRWEWJVH6_ideas.shtetl.io_A
    // terraform import 'aws_route53_record.a-wiki' Z079919527B3JRWEWJVH6_wiki.shtetl.io_A
    // terraform import 'aws_route53_record.mx-send' Z079919527B3JRWEWJVH6_send.shtetl.io_MX
    // terraform import 'aws_route53_record.spf-send' Z079919527B3JRWEWJVH6_send.shtetl.io_SPF
    // terraform import 'aws_route53_record.cname-acm-validation' Z079919527B3JRWEWJVH6__8733c97b4f6273f99257413ae41aafe9.zmanim.shtetl.io_CNAME
    // terraform import 'aws_route53_record.cname-clerk-dkim1' Z079919527B3JRWEWJVH6_clk._domainkey.zmanim.shtetl.io_CNAME
    // terraform import 'aws_route53_record.cname-clerk-dkim2' Z079919527B3JRWEWJVH6_clk2._domainkey.zmanim.shtetl.io_CNAME
    // terraform import 'aws_route53_record.cname-clerk-accounts' Z079919527B3JRWEWJVH6_accounts.zmanim.shtetl.io_CNAME
    // terraform import 'aws_route53_record.cname-clerk-frontend' Z079919527B3JRWEWJVH6_clerk.zmanim.shtetl.io_CNAME
    // terraform import 'aws_route53_record.cname-clerk-mail' Z079919527B3JRWEWJVH6_clkmail.zmanim.shtetl.io_CNAME

    this.hostedZone = new Route53Zone(this, "hosted-zone", {
      name: config.domainName,
      lifecycle: {
        preventDestroy: true,
      },
      tags: {
        Name: config.domainName,
        Project: "shtetl",
      },
    });

    // -----------------------------------------------------------------------------
    // Root Domain Records (shtetl.io)
    // -----------------------------------------------------------------------------

    // NS Record (auto-created with zone)
    new Route53Record(this, "ns", {
      zoneId: this.hostedZone.zoneId,
      name: "shtetl.io",
      type: "NS",
      ttl: 172800,
      records: [
        "ns-94.awsdns-11.com.",
        "ns-1410.awsdns-48.org.",
        "ns-585.awsdns-09.net.",
        "ns-2044.awsdns-63.co.uk.",
      ],
    });

    // SOA Record (auto-created with zone)
    new Route53Record(this, "soa", {
      zoneId: this.hostedZone.zoneId,
      name: "shtetl.io",
      type: "SOA",
      ttl: 900,
      records: [
        "ns-94.awsdns-11.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
      ],
    });

    // MX Records (Google Workspace)
    new Route53Record(this, "mx-root", {
      zoneId: this.hostedZone.zoneId,
      name: "shtetl.io",
      type: "MX",
      ttl: 3600,
      records: [
        "1 aspmx.l.google.com.",
        "5 alt1.aspmx.l.google.com.",
        "5 alt2.aspmx.l.google.com.",
        "10 alt3.aspmx.l.google.com.",
        "10 alt4.aspmx.l.google.com.",
      ],
    });

    // TXT Record (SPF)
    new Route53Record(this, "txt-root", {
      zoneId: this.hostedZone.zoneId,
      name: "shtetl.io",
      type: "TXT",
      ttl: 300,
      records: [
        "v=spf1 ipv4:172.236.0.201 ip6:2600:3c13::2000:4fff:feda:6f5e  include:amazonses.com include:_spf.google.com -all",
      ],
    });

    // DMARC Record
    new Route53Record(this, "txt-dmarc", {
      zoneId: this.hostedZone.zoneId,
      name: "_dmarc.shtetl.io",
      type: "TXT",
      ttl: 1,
      records: [
        "v=DMARC1; p=none; rua=mailto:ea99e55101454fc68e63fc4e387d2965@dmarc-reports.cloudflare.net",
      ],
    });

    // DKIM - Google (ignore records changes - AWS handles chunking internally)
    new Route53Record(this, "txt-dkim-google", {
      zoneId: this.hostedZone.zoneId,
      name: "google._domainkey.shtetl.io",
      type: "TXT",
      ttl: 300,
      records: [
        "v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAphE7FqeDiPtKA1h78IZjccgAG+3+LwOfIciUbiELVgor99Kfnv/626RxlHbxlwzIS4p9ds4klUyf2qAnnJvw2OKw/df1IM4yInCHIWJM+MWrx8RKiKzFCT0YeOZUlOSAK6aoFO+jJ6ePqdpTjv9fvratuJ1r2ch9Fz4Yo8Snpgj8+yfhin9TPBFQ2eVduCRnzoIo26DP8KYJ/vWixo1a9WTvwXmbnXTqKR65FI/VF/tAeWXfPmSrcfw8+Wx0R+QlAc82ZxI/b8anDrhRsIw/hZefqs+x3yvz1qvvgBdXS7lLOlwvMstIQpnNRkUsi4xphLa/8us6iFxTG9al//+d7wIDAQAB",
      ],
      lifecycle: {
        ignoreChanges: ["records"],
      },
    });

    // DKIM - Resend
    new Route53Record(this, "txt-dkim-resend", {
      zoneId: this.hostedZone.zoneId,
      name: "resend._domainkey.shtetl.io",
      type: "TXT",
      ttl: 300,
      records: [
        "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCtPsYFDbWLNL7u1Nz100QRDkOSzjzvN9hkHvbSVgDtfdjKsQt+YwGaq+057D3b42tNg50fmFRGBg42eoZcOZe+wxOEP53BH8ZdZSL5h4Ydc37s+wWhbHwM0pmZtMZa2PcUT26X+HbpJAtPqvviZ235Vna8UQgvzh1xI2I+X6HkTwIDAQAB",
      ],
    });

    // DKIM - Wiki (ignore records changes - AWS handles chunking internally)
    new Route53Record(this, "txt-dkim-wiki", {
      zoneId: this.hostedZone.zoneId,
      name: "wiki._domainkey.shtetl.io",
      type: "TXT",
      ttl: 300,
      records: [
        "v=DKIM1; k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmm4iFOg4CzDY3OyX31BHagtKmuIEHQeJfqZqrmgbtty2GYJkTylzy1Ii/SRU4x6if4aBy5mJrmtNIJqRKPdw5gRIjvOokZeQv1ESm21yeb6ALHbWHGCFoaUxR1W+nuFBl2xR/Ty+6ZLobuNgaB63+57E+CnismHGSBypnLjCDH5dXAhnXkh/bpq8l/6ncfJFijWrbY3Mv0uKgheJpzPE1BfuGx7AMT5FxDNpmHI6Sr7qobC/6HBsX/AqU41iQesmOqdfNW/regbbrhJHgq4KEuXA591bXfWsYsA1Z5/NE4bPNHSfEVCvmzGB4JZ381z3vY+bXVX01z/Kr2OTiri5AwIDAQAB",
      ],
      lifecycle: {
        ignoreChanges: ["records"],
      },
    });

    // -----------------------------------------------------------------------------
    // Subdomain Records
    // -----------------------------------------------------------------------------

    // ideas.shtetl.io - A record
    new Route53Record(this, "a-ideas", {
      zoneId: this.hostedZone.zoneId,
      name: "ideas.shtetl.io",
      type: "A",
      ttl: 1,
      records: ["172.236.0.201"],
    });

    // wiki.shtetl.io - A record
    new Route53Record(this, "a-wiki", {
      zoneId: this.hostedZone.zoneId,
      name: "wiki.shtetl.io",
      type: "A",
      ttl: 1,
      records: ["172.236.0.201"],
    });

    // send.shtetl.io - MX record (SES)
    new Route53Record(this, "mx-send", {
      zoneId: this.hostedZone.zoneId,
      name: "send.shtetl.io",
      type: "MX",
      ttl: 300,
      records: ["10 feedback-smtp.us-east-1.amazonses.com"],
    });

    // send.shtetl.io - SPF record (SES)
    new Route53Record(this, "spf-send", {
      zoneId: this.hostedZone.zoneId,
      name: "send.shtetl.io",
      type: "SPF",
      ttl: 300,
      records: ["v=spf1 include:amazonses.com ~all"],
    });

    // -----------------------------------------------------------------------------
    // Zmanim Subdomain Records
    // -----------------------------------------------------------------------------

    // NOTE: ACM Certificate validation CNAME is managed by zmanim-prod stack
    // (dynamically derived from the certificate's domainValidationOptions)

    // Clerk DKIM 1
    new Route53Record(this, "cname-clerk-dkim1", {
      zoneId: this.hostedZone.zoneId,
      name: "clk._domainkey.zmanim.shtetl.io",
      type: "CNAME",
      ttl: 300,
      records: ["dkim1.jrvwnuyl6uoa.clerk.services"],
    });

    // Clerk DKIM 2
    new Route53Record(this, "cname-clerk-dkim2", {
      zoneId: this.hostedZone.zoneId,
      name: "clk2._domainkey.zmanim.shtetl.io",
      type: "CNAME",
      ttl: 300,
      records: ["dkim2.jrvwnuyl6uoa.clerk.services"],
    });

    // Clerk Accounts
    new Route53Record(this, "cname-clerk-accounts", {
      zoneId: this.hostedZone.zoneId,
      name: "accounts.zmanim.shtetl.io",
      type: "CNAME",
      ttl: 300,
      records: ["accounts.clerk.services"],
    });

    // Clerk Frontend API
    new Route53Record(this, "cname-clerk-frontend", {
      zoneId: this.hostedZone.zoneId,
      name: "clerk.zmanim.shtetl.io",
      type: "CNAME",
      ttl: 300,
      records: ["frontend-api.clerk.services"],
    });

    // Clerk Mail
    new Route53Record(this, "cname-clerk-mail", {
      zoneId: this.hostedZone.zoneId,
      name: "clkmail.zmanim.shtetl.io",
      type: "CNAME",
      ttl: 300,
      records: ["mail.jrvwnuyl6uoa.clerk.services"],
    });

    // ==========================================================================
    // 1.3 GitHub OIDC Provider
    // ==========================================================================
    this.githubOidcProvider = new IamOpenidConnectProvider(this, "github-oidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIdList: ["sts.amazonaws.com"],
      thumbprintList: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
      tags: {
        Name: "github-oidc",
        Project: "shtetl",
      },
    });

    this.githubActionsRole = new IamRole(this, "github-actions-role", {
      name: "github-actions-deploy",
      maxSessionDuration: 3600,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Federated: this.githubOidcProvider.arn,
            },
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
              StringLike: {
                "token.actions.githubusercontent.com:sub": `repo:${config.githubOrg}/*:*`,
              },
              StringEquals: {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
              },
            },
          },
        ],
      }),
      tags: {
        Name: "github-actions-deploy",
        Project: "shtetl",
      },
    });

    new IamRolePolicyAttachment(this, "github-actions-admin", {
      role: this.githubActionsRole.name,
      policyArn: "arn:aws:iam::aws:policy/AdministratorAccess",
    });

    // ==========================================================================
    // 1.4 SSH Key Pair
    // ==========================================================================
    this.sshKeyPair = new KeyPair(this, "ssh-keypair", {
      keyName: config.sshKeyName,
      publicKey: config.sshKeyPublic,
      tags: {
        Name: config.sshKeyName,
        Project: "shtetl",
      },
    });

    // ==========================================================================
    // 1.5 Shared CloudFront Resources
    // ==========================================================================
    // These resources can be reused by multiple project stacks to serve their
    // frontends through CloudFront. Each project creates its own distribution
    // but references these shared policies/functions for consistency and cost savings.

    // Cache Policy: Static Assets - 1 year TTL for immutable hashed files (e.g., /_next/static/*)
    this.cfStaticAssetsCachePolicy = new CloudfrontCachePolicy(this, "cf-static-assets-cache-policy", {
      name: "shtetl-static-assets-cache",
      comment: "Shared cache policy for immutable static assets - 1 year TTL",
      defaultTtl: 31536000, // 1 year in seconds
      maxTtl: 31536000,
      minTtl: 31536000,
      parametersInCacheKeyAndForwardedToOrigin: {
        cookiesConfig: { cookieBehavior: "none" },
        headersConfig: { headerBehavior: "none" },
        queryStringsConfig: { queryStringBehavior: "none" },
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    });

    // Cache Policy: HTML/Dynamic - 1 day TTL for pages that can change
    this.cfHtmlCachePolicy = new CloudfrontCachePolicy(this, "cf-html-cache-policy", {
      name: "shtetl-html-cache",
      comment: "Shared cache policy for HTML pages - 1 day TTL",
      defaultTtl: 86400, // 1 day in seconds
      maxTtl: 604800, // 7 days
      minTtl: 0,
      parametersInCacheKeyAndForwardedToOrigin: {
        cookiesConfig: { cookieBehavior: "none" },
        headersConfig: { headerBehavior: "none" },
        queryStringsConfig: { queryStringBehavior: "none" },
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    });

    // Cache Policy: API - 1 hour TTL for cacheable API endpoints
    this.cfApiCachePolicy = new CloudfrontCachePolicy(this, "cf-api-cache-policy", {
      name: "shtetl-api-cache",
      comment: "Shared cache policy for cacheable API endpoints - 1 hour TTL",
      defaultTtl: 3600, // 1 hour
      maxTtl: 86400, // 24 hours
      minTtl: 60,
      parametersInCacheKeyAndForwardedToOrigin: {
        cookiesConfig: { cookieBehavior: "none" },
        headersConfig: {
          headerBehavior: "whitelist",
          headers: { items: ["Accept-Language"] },
        },
        queryStringsConfig: { queryStringBehavior: "all" },
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    });

    // Response Headers Policy: Security Headers
    this.cfSecurityHeadersPolicy = new CloudfrontResponseHeadersPolicy(this, "cf-security-headers-policy", {
      name: "shtetl-security-headers",
      comment: "Shared security headers for HTTPS, frame protection, content type",
      securityHeadersConfig: {
        strictTransportSecurity: {
          accessControlMaxAgeSec: 31536000,
          includeSubdomains: true,
          override: true,
          preload: true,
        },
        frameOptions: {
          frameOption: "DENY",
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: "strict-origin-when-cross-origin",
          override: true,
        },
      },
    });

    // CloudFront Function: Forward host header as x-forwarded-host
    // Required for OpenNext/Next.js middleware to know the frontend domain
    this.cfHostHeaderFunction = new CloudfrontFunction(this, "cf-host-header-function", {
      name: "shtetl-host-header",
      runtime: "cloudfront-js-2.0",
      comment: "Shared function to forward host header as x-forwarded-host for OpenNext",
      code: `
function handler(event) {
  var request = event.request;
  request.headers["x-forwarded-host"] = request.headers.host;
  return request;
}
`,
    });

    // S3 Origin Access Control for CloudFront
    this.cfS3OriginAccessControl = new CloudfrontOriginAccessControl(this, "cf-s3-oac", {
      name: "shtetl-s3-oac",
      description: "Shared OAC for static assets buckets",
      originAccessControlOriginType: "s3",
      signingBehavior: "always",
      signingProtocol: "sigv4",
    });

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new TerraformOutput(this, "vpc_id", {
      value: this.vpc.id,
      description: "VPC ID for project stacks",
    });

    new TerraformOutput(this, "vpc_cidr", {
      value: this.vpc.cidrBlock,
      description: "VPC CIDR block",
    });

    new TerraformOutput(this, "public_subnet_id", {
      value: this.publicSubnet.id,
      description: "Public subnet ID",
    });

    new TerraformOutput(this, "public_subnet_az", {
      value: this.publicSubnet.availabilityZone,
      description: "Public subnet availability zone",
    });

    new TerraformOutput(this, "internet_gateway_id", {
      value: this.internetGateway.id,
      description: "Internet Gateway ID",
    });

    new TerraformOutput(this, "s3_endpoint_id", {
      value: this.s3Endpoint.id,
      description: "S3 VPC Endpoint ID",
    });

    new TerraformOutput(this, "hosted_zone_id", {
      value: this.hostedZone.zoneId,
      description: "Route53 hosted zone ID",
    });

    new TerraformOutput(this, "hosted_zone_name", {
      value: this.hostedZone.name,
      description: "Route53 hosted zone name (shtetl.io)",
    });

    new TerraformOutput(this, "hosted_zone_name_servers", {
      value: this.hostedZone.nameServers,
      description: "Route53 hosted zone name servers (update at registrar)",
    });

    new TerraformOutput(this, "github_oidc_provider_arn", {
      value: this.githubOidcProvider.arn,
      description: "GitHub OIDC provider ARN",
    });

    new TerraformOutput(this, "github_actions_role_arn", {
      value: this.githubActionsRole.arn,
      description: "GitHub Actions deploy role ARN",
    });

    new TerraformOutput(this, "state_bucket_name", {
      value: this.stateBucket.id,
      description: "Terraform state bucket name",
    });

    new TerraformOutput(this, "state_bucket_arn", {
      value: this.stateBucket.arn,
      description: "Terraform state bucket ARN",
    });

    // CloudFront outputs for project stacks
    new TerraformOutput(this, "cf_static_assets_cache_policy_id", {
      value: this.cfStaticAssetsCachePolicy.id,
      description: "CloudFront cache policy ID for static assets (1 year TTL)",
    });

    new TerraformOutput(this, "cf_html_cache_policy_id", {
      value: this.cfHtmlCachePolicy.id,
      description: "CloudFront cache policy ID for HTML pages (1 day TTL)",
    });

    new TerraformOutput(this, "cf_api_cache_policy_id", {
      value: this.cfApiCachePolicy.id,
      description: "CloudFront cache policy ID for API endpoints (1 hour TTL)",
    });

    new TerraformOutput(this, "cf_security_headers_policy_id", {
      value: this.cfSecurityHeadersPolicy.id,
      description: "CloudFront response headers policy ID for security headers",
    });

    new TerraformOutput(this, "cf_host_header_function_arn", {
      value: this.cfHostHeaderFunction.arn,
      description: "CloudFront function ARN for host header forwarding",
    });

    new TerraformOutput(this, "cf_s3_oac_id", {
      value: this.cfS3OriginAccessControl.id,
      description: "CloudFront S3 Origin Access Control ID",
    });

    new TerraformOutput(this, "ssh_key_name", {
      value: this.sshKeyPair.keyName,
      description: "SSH key pair name for EC2 instances",
    });
  }
}
