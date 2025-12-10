# Story 7.3: VPC & Network Infrastructure

Status: ready-for-dev

## Story

As a **developer**,
I want **a secure VPC with public subnet**,
So that **EC2 can serve traffic without NAT Gateway costs**.

## Acceptance Criteria

1. **AC1:** VPC created in eu-west-1 with public subnet
2. **AC2:** Internet Gateway attached
3. **AC3:** S3 VPC Gateway Endpoint configured (free)
4. **AC4:** Security group allows 443 from CloudFront, 22 from admin IPs
5. **AC5:** No NAT Gateway (Packer AMI handles dependencies)

## Tasks / Subtasks

- [ ] **Task 1: Create VPC** (AC: 1)
  - [ ] 1.1 Define VPC in `lib/network-stack.ts`
  - [ ] 1.2 Configure CIDR block `10.0.0.0/16`
  - [ ] 1.3 Create public subnet in `eu-west-1a`
  - [ ] 1.4 Enable DNS hostnames and resolution

- [ ] **Task 2: Internet Gateway** (AC: 2)
  - [ ] 2.1 Create Internet Gateway construct
  - [ ] 2.2 Attach to VPC
  - [ ] 2.3 Configure route table with `0.0.0.0/0` → IGW

- [ ] **Task 3: S3 Gateway Endpoint** (AC: 3)
  - [ ] 3.1 Create VPC Gateway Endpoint for S3
  - [ ] 3.2 Associate with public subnet route table
  - [ ] 3.3 Document cost savings (free vs NAT Gateway)

- [ ] **Task 4: Security Groups** (AC: 4)
  - [ ] 4.1 Create EC2 security group
  - [ ] 4.2 Add ingress rule: 443/tcp from CloudFront Prefix List
  - [ ] 4.3 Add ingress rule: 22/tcp from admin CIDR (configurable)
  - [ ] 4.4 Add ingress rule: 8080/tcp from API Gateway (internal)
  - [ ] 4.5 Configure egress: all traffic (S3 via Gateway Endpoint)

- [ ] **Task 5: Verify No NAT Gateway** (AC: 5)
  - [ ] 5.1 Ensure `natGateways: 0` in VPC config
  - [ ] 5.2 Document that Packer AMI pre-installs all packages
  - [ ] 5.3 Verify S3 access works via Gateway Endpoint

- [ ] **Task 6: Testing** (AC: 1-5)
  - [ ] 6.1 Run `cdk synth` to verify CloudFormation output
  - [ ] 6.2 Deploy to staging account
  - [ ] 6.3 Verify VPC connectivity
  - [ ] 6.4 Test S3 access from within VPC
  - [ ] 6.5 Document network architecture diagram

## Dev Notes

### Architecture Alignment

This story implements the **network foundation** for all AWS resources. Key design decisions:

- **Public Subnet Only:** No private subnets = no NAT Gateway costs (~$32/month savings)
- **S3 Gateway Endpoint:** Free S3 access from VPC without internet transit
- **CloudFront Prefix List:** AWS-managed list of CloudFront IPs for security group rules

**Network Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│ VPC: 10.0.0.0/16                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Public Subnet: 10.0.1.0/24 (eu-west-1a)             │ │
│ │                                                      │ │
│ │   ┌─────────────┐                                   │ │
│ │   │ EC2 Instance │                                  │ │
│ │   │ (Elastic IP) │                                  │ │
│ │   └──────┬──────┘                                   │ │
│ │          │                                          │ │
│ └──────────│──────────────────────────────────────────┘ │
│            │                                            │
│   ┌────────┴────────┐  ┌────────────────────────────┐  │
│   │ Internet Gateway │  │ S3 Gateway Endpoint (free) │  │
│   └────────┬────────┘  └────────────────────────────┘  │
└────────────│────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │    Internet      │
    │ (CloudFront/API) │
    └─────────────────┘
```

### Security Group Rules

| Direction | Protocol | Port | Source/Dest | Purpose |
|-----------|----------|------|-------------|---------|
| Ingress | TCP | 443 | CloudFront Prefix List | HTTPS from CDN |
| Ingress | TCP | 22 | Admin CIDR | SSH access |
| Ingress | TCP | 8080 | API Gateway | Internal API traffic |
| Egress | All | All | 0.0.0.0/0 | Outbound (S3 via endpoint) |

### CDK Implementation Pattern

```typescript
// lib/network-stack.ts
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'ZmanimVpc', {
      maxAzs: 1,
      natGateways: 0,  // CRITICAL: No NAT Gateway
      subnetConfiguration: [{
        name: 'Public',
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 24,
      }],
    });

    // S3 Gateway Endpoint (free)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
  }
}
```

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.3]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.3]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Security]

## Dev Agent Record

### Context Reference

[Story 7-3 Context XML](./7-3-vpc-network-infrastructure.context.xml)

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
