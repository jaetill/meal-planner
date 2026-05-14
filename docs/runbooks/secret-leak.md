# Runbook: Secret leak

## When to use this

A secret has been exposed — committed to git, posted publicly, sent in plaintext, etc. Time matters: act fast.

## Prerequisites

- Access to wherever the secret is stored (1Password, AWS Secrets Manager, SSM Parameter Store)
- Git history access for cleanup
- AWS CLI authenticated to us-east-2 with appropriate IAM perms

## Steps

1. **Rotate the secret immediately.**
   - **Postmark API key** (in Secrets Manager `shared/postmark-api-key`):
     1. Generate new server token in Postmark dashboard
     2. Update Secrets Manager: `aws secretsmanager update-secret --secret-id shared/postmark-api-key --secret-string <new-token> --region us-east-2`
     3. Old token remains valid until you delete it; once new token is verified working, delete the old one in Postmark.
   - **API keys in SSM** (`/game-night/api-keys/{key}`):
     1. Generate new key locally
     2. `aws ssm put-parameter --name "/game-night/api-keys/<new-key>" --value "<cognito-username>" --type SecureString --region us-east-2`
     3. Update consumers (e.g., `.claude/mcp.json` env var `GAME_NIGHT_API_KEY`)
     4. Delete the leaked key: `aws ssm delete-parameter --name "/game-night/api-keys/<old-key>" --region us-east-2`
   - **Cognito-related leak** (e.g., temp password emailed in plaintext to wrong recipient):
     1. Force-reset the affected user: `aws cognito-idp admin-reset-user-password --user-pool-id us-east-2_xneeJzaDJ --username <username>`
     2. User receives a new temporary password on next login flow.

2. **Update consumers** to use the new value. Lambdas pull from Secrets Manager / SSM at cold start; force a redeploy or wait for natural cold start. For the MCP server, update `.claude/mcp.json` (gitignored).

3. **Revoke the old credential** if the system supports it.

4. **Audit the leak's blast radius.**
   - Where was the secret exposed (git, log, screenshot, message)?
   - Who could have seen it?
   - What systems/data did it grant access to?
   - Check audit logs for that period (CloudTrail, GitHub audit log, app logs).

5. **Clean up the exposure** if recoverable.
   - Git: `git filter-repo` or BFG Repo-Cleaner; force-push (rare exception to ADR-0002 no-force-push). Rotated already; this is cleanup.
   - Logs: redact / delete log lines containing the secret.

6. **File a postmortem.** This is an architectural problem (the leak happened *somehow*); identify the systemic gap and fix it.

## Verification

- Old credential is non-functional (try it; expect auth failure)
- New credential works in all systems that consume it
- The exposure has been removed from accessible places
- A postmortem ADR has been filed proposing prevention

## Rollback

If rotation broke something downstream:
- Postmark: re-issue the old token's permissions (if not yet deleted)
- SSM: temporarily restore the old key from `aws ssm get-parameter-history` if available
- Cognito: the affected user's flow goes through Cognito's password reset; coordinate with the user

## Escalation

For solo: act on what you can; document the rest. If the leak involved customer data (PII), there may be legal/compliance reporting obligations. For Game Night specifically: if user accounts were exposed, user-facing communication is needed.
