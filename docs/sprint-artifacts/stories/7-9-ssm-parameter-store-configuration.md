# Story 7.9: SSM Parameter Store Configuration

Status: ready-for-dev

## Story

As a **developer**,
I want **secrets stored in SSM Parameter Store**,
So that **sensitive config isn't in code or AMI, and costs $0**.

## Acceptance Criteria

1. **AC1:** SSM SecureString: `/zmanim/prod/clerk-secret-key`
2. **AC2:** SSM SecureString: `/zmanim/prod/postgres-password`
3. **AC3:** SSM SecureString: `/zmanim/prod/restic-password`
4. **AC4:** SSM String: `/zmanim/prod/config` (non-sensitive)
5. **AC5:** EC2 pulls parameters at boot via IAM role
6. **AC6:** User data script exports to environment

## Tasks / Subtasks

- [ ] **Task 1: Create Clerk Secret** (AC: 1)
  - [ ] 1.1 Define SSM parameter `/zmanim/prod/clerk-secret-key`
  - [ ] 1.2 Configure as SecureString with KMS encryption
  - [ ] 1.3 Document manual value entry (secret not in code)

- [ ] **Task 2: Create PostgreSQL Password** (AC: 2)
  - [ ] 2.1 Define SSM parameter `/zmanim/prod/postgres-password`
  - [ ] 2.2 Configure as SecureString
  - [ ] 2.3 Generate strong random password
  - [ ] 2.4 Document password requirements

- [ ] **Task 3: Create Restic Password** (AC: 3)
  - [ ] 3.1 Define SSM parameter `/zmanim/prod/restic-password`
  - [ ] 3.2 Configure as SecureString
  - [ ] 3.3 Generate strong random password
  - [ ] 3.4 Document that this encrypts all backups

- [ ] **Task 4: Create Config Parameter** (AC: 4)
  - [ ] 4.1 Define SSM parameter `/zmanim/prod/config`
  - [ ] 4.2 Configure as String (not encrypted)
  - [ ] 4.3 Store non-sensitive config as JSON
  - [ ] 4.4 Include: database name, Redis host, log level, etc.

- [ ] **Task 5: IAM Policy for EC2** (AC: 5)
  - [ ] 5.1 Add SSM read policy to EC2 IAM role (Story 7.4)
  - [ ] 5.2 Restrict to `/zmanim/prod/*` parameters only
  - [ ] 5.3 Include `ssm:GetParameter` and `ssm:GetParameters`
  - [ ] 5.4 Include `kms:Decrypt` for SecureString access

- [ ] **Task 6: User Data Script** (AC: 6)
  - [ ] 6.1 Update user data script (Story 7.4) to pull parameters
  - [ ] 6.2 Use `aws ssm get-parameter --with-decryption`
  - [ ] 6.3 Export to environment variables
  - [ ] 6.4 Generate `/opt/zmanim/config.env`
  - [ ] 6.5 Generate `/etc/restic/env`
  - [ ] 6.6 Secure file permissions (chmod 600)

- [ ] **Task 7: Testing** (AC: 1-6)
  - [ ] 7.1 Create parameters in staging account
  - [ ] 7.2 Test EC2 can retrieve parameters
  - [ ] 7.3 Verify SecureString decryption works
  - [ ] 7.4 Verify config.env generated correctly
  - [ ] 7.5 Test service startup with SSM-sourced config
  - [ ] 7.6 Document parameter update procedure

## Dev Notes

### Architecture Alignment

This story implements **secrets management** using AWS SSM Parameter Store:

**Why SSM Parameter Store (not Secrets Manager):**
| Feature | SSM Parameter Store | Secrets Manager |
|---------|---------------------|-----------------|
| Cost | Free (Standard tier) | $0.40/secret/month |
| Rotation | Manual | Automatic |
| Complexity | Simple | More features |
| Our needs | ✅ Sufficient | Overkill |

For our use case (static secrets, <10 parameters), SSM is free and sufficient.

### Parameter Structure

```
/zmanim/prod/
├── clerk-secret-key    (SecureString) - Clerk API secret
├── postgres-password   (SecureString) - PostgreSQL password
├── restic-password     (SecureString) - Backup encryption key
└── config              (String)       - Non-sensitive config JSON
```

### Config JSON Structure

```json
{
  "database_name": "zmanim",
  "database_host": "localhost",
  "redis_host": "localhost",
  "redis_port": 6379,
  "log_level": "info",
  "api_port": 8080,
  "allowed_origins": "https://zmanim.shtetl.io"
}
```

### User Data Script Integration

```bash
#!/bin/bash
# Part of EC2 user data (Story 7.4)

# Pull secrets from SSM
CLERK_SECRET=$(aws ssm get-parameter \
  --name /zmanim/prod/clerk-secret-key \
  --with-decryption \
  --query Parameter.Value \
  --output text)

POSTGRES_PASSWORD=$(aws ssm get-parameter \
  --name /zmanim/prod/postgres-password \
  --with-decryption \
  --query Parameter.Value \
  --output text)

RESTIC_PASSWORD=$(aws ssm get-parameter \
  --name /zmanim/prod/restic-password \
  --with-decryption \
  --query Parameter.Value \
  --output text)

CONFIG=$(aws ssm get-parameter \
  --name /zmanim/prod/config \
  --query Parameter.Value \
  --output text)

# Generate config.env
cat > /opt/zmanim/config.env << EOF
CLERK_SECRET_KEY=$CLERK_SECRET
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://zmanim:$POSTGRES_PASSWORD@localhost/zmanim
REDIS_URL=redis://localhost:6379
$(echo $CONFIG | jq -r 'to_entries | .[] | "\(.key | ascii_upcase)=\(.value)"')
EOF

chmod 600 /opt/zmanim/config.env

# Generate restic env
cat > /etc/restic/env << EOF
AWS_DEFAULT_REGION=eu-west-1
RESTIC_REPOSITORY=s3:s3.eu-west-1.amazonaws.com/zmanim-backups-prod
RESTIC_PASSWORD=$RESTIC_PASSWORD
EOF

chmod 600 /etc/restic/env
```

### IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:eu-west-1:*:parameter/zmanim/prod/*"
    },
    {
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "ssm.eu-west-1.amazonaws.com"
        }
      }
    }
  ]
}
```

### CDK Implementation Pattern

```typescript
// lib/compute-stack.ts (or separate secrets-stack.ts)

// Parameters are created manually or via CDK with dummy values
// Real values set via CLI/Console (never in code)

new ssm.StringParameter(this, 'ClerkSecret', {
  parameterName: '/zmanim/prod/clerk-secret-key',
  stringValue: 'REPLACE_ME',  // Placeholder
  type: ssm.ParameterType.SECURE_STRING,
  description: 'Clerk API secret key',
});

// After deployment, update via CLI:
// aws ssm put-parameter --name /zmanim/prod/clerk-secret-key \
//   --value "sk_live_xxx" --type SecureString --overwrite
```

### Security Considerations

1. **Never log secrets** - mask in logs
2. **File permissions** - config.env should be 600
3. **IAM least privilege** - only `/zmanim/prod/*` access
4. **KMS encryption** - SecureString uses AWS-managed KMS key
5. **No secrets in AMI** - pulled fresh at boot

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.9]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.9]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Security]

## Dev Agent Record

### Context Reference

[Story Context XML](./7-9-ssm-parameter-store-configuration.context.xml)

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
