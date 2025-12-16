# Manual Infrastructure Changes

This file tracks manual changes that need to be made outside of CDK/Terraform for full infrastructure functionality.

## 2025-12-12: Clerk JWT Template - Missing `aud` Claim

### Problem
API Gateway JWT authorizer returns 401 Unauthorized for authenticated requests. The JWT token from Clerk has:
- `iss`: `https://clerk.zmanim.shtetl.io` (correct)
- `azp`: `https://zmanim.shtetl.io` (authorized party, NOT audience)
- `metadata`: `{role: 'admin'}` (from template)
- **Missing**: `aud` claim

AWS API Gateway HTTP API JWT authorizer validates the `aud` (audience) claim, but the token doesn't have it.

### Root Cause Analysis
The frontend code correctly requests `getToken({ template: 'zmanim-api' })` but the returned token doesn't contain the `aud` claim even though the template supposedly has it.

### Debugging Steps (run in browser console on https://zmanim.shtetl.io)

```javascript
// Test 1: Get token WITH template
const templateToken = await window.Clerk.session.getToken({ template: 'zmanim-api' });
console.log('Template token claims:', JSON.parse(atob(templateToken.split('.')[1])));

// Test 2: Get token WITHOUT template (session token)
const sessionToken = await window.Clerk.session.getToken();
console.log('Session token claims:', JSON.parse(atob(sessionToken.split('.')[1])));

// Check: templateToken should have 'aud', sessionToken should NOT
```

### Expected JWT Template Configuration (Clerk Dashboard)
Template name: `zmanim-api` (case-sensitive!)

```json
{
  "aud": "https://zmanim.shtetl.io",
  "metadata": {
    "role": "{{user.public_metadata.role}}"
  }
}
```

### Possible Issues to Check
1. **Template name mismatch** - Verify template is exactly `zmanim-api` (case-sensitive)
2. **Template not saved** - Re-save the template in Clerk Dashboard
3. **Token caching** - Hard refresh browser or clear Clerk cache
4. **Wrong Clerk instance** - Verify you're editing PRODUCTION Clerk (not test instance)

### Related Infrastructure
- SSM Parameter: `/zmanim/prod/clerk-audience` = `https://zmanim.shtetl.io`
- API Gateway Authorizer ID: `1jf98y` on API `c5qra1ksq0`
- JWT Authorizer config:
  - Issuer: `https://clerk.zmanim.shtetl.io`
  - Audience: `["https://zmanim.shtetl.io"]`
- CDK Stack: `infrastructure/lib/stacks/zmanim-prod.ts` lines 513-522
- Frontend code: `web/lib/api-client.ts` line 51 (`JWT_TEMPLATE = 'zmanim-api'`)

### Status
- [x] Verified API Gateway authorizer config is correct
- [x] Verified frontend code requests correct template
- [ ] Verify JWT template exists and is correctly named in Clerk Dashboard
- [ ] Test that template token contains `aud` claim
- [ ] Test admin portal authentication
