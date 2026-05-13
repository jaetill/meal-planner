# Runbook: Manual deploy (Lambda functions)

## When to use this

Per `CLAUDE.md`, Lambdas are NOT in the deploy.yml workflow — they're deployed manually. This runbook documents that procedure. The frontend (GitHub Pages) is auto-deployed via deploy.yml on every push to `master`.

## Prerequisites

- AWS CLI authenticated as `jaetill-dev` credentials with permission to update each function in **us-east-2**
- Python 3 + zip (for `build/zip.py`) — Windows users: prefer Python or `tar -a` over `Compress-Archive` (CLAUDE.md notes Compress-Archive produces backslash paths Lambda can't resolve)
- The Lambda source you want to deploy in `lambda/`

## Steps

1. **For most handlers (single-file zip):**
   ```bash
   python build/zip.py /tmp/<fn>.zip lambda/<fn>.js
   aws lambda update-function-code \
     --function-name <fn> \
     --zip-file fileb:///tmp/<fn>.zip \
     --region us-east-2
   ```

2. **For `apiKeyAuthorizer` (bundles `aws-jwt-verify`):**
   ```bash
   cd lambda && npm install   # regenerate node_modules if needed
   cd ..
   python build/zip.py /tmp/apiKeyAuthorizer.zip lambda  # zips lambda/ + node_modules
   aws lambda update-function-code \
     --function-name apiKeyAuthorizer \
     --zip-file fileb:///tmp/apiKeyAuthorizer.zip \
     --region us-east-2
   ```

3. **For `feedback` (first-time deploy):** see the [Feedback Lambda first-deploy](#feedback-lambda-first-deploy-phase-7) section below.

4. **Verify** by invoking the function or hitting its API Gateway route and observing CloudWatch Logs and Sentry events.

## Feedback Lambda first-deploy (Phase 7)

The `feedback` Lambda is new in Phase 7 — initial deploy requires creating the function, IAM role, Secrets Manager secret, and API Gateway route. After that, it follows the standard manual-deploy procedure above.

### Prerequisites
- A GitHub fine-grained PAT with `issues:write` scope on `jaetill/game-night-pwa`. Generate at https://github.com/settings/tokens.
- AWS CLI authenticated as `jaetill-dev`.

### Steps
1. **Store the GitHub token in Secrets Manager:**
   ```bash
   aws secretsmanager create-secret \
     --name game-night/prod/github-token \
     --secret-string '{"GITHUB_TOKEN":"ghp_..."}' \
     --region us-east-2
   ```

2. **Create the IAM role:**
   ```bash
   # Trust policy: lambda.amazonaws.com
   aws iam create-role --role-name feedback-lambda-role \
     --assume-role-policy-document file://docs/runbooks/trust-policy-lambda.json
   aws iam put-role-policy --role-name feedback-lambda-role \
     --policy-name feedback-inline \
     --policy-document file://lambda/iam/feedback-inline.json
   ```
   (If `trust-policy-lambda.json` doesn't exist yet, copy the standard Lambda assume-role trust policy from any existing function's role.)

3. **Bundle and create the function:**
   ```bash
   cd lambda && npm install
   cd ..
   python build/zip.py /tmp/feedback.zip lambda  # bundles lambda/ + node_modules (incl. @octokit/rest)
   aws lambda create-function \
     --function-name feedback \
     --runtime nodejs22.x \
     --role arn:aws:iam::<acct>:role/feedback-lambda-role \
     --handler feedback.handler \
     --zip-file fileb:///tmp/feedback.zip \
     --timeout 10 \
     --memory-size 256 \
     --environment "Variables={GITHUB_REPO_OWNER=jaetill,GITHUB_REPO_NAME=game-night-pwa,GITHUB_SECRET_ID=game-night/prod/github-token,DEPLOY_ENV=prod,LOG_LEVEL=INFO}" \
     --region us-east-2
   ```

4. **Add the API Gateway route** (no authorizer — public endpoint):
   - In the AWS console: API Gateway → `pufsqfvq8g` → Resources → POST /feedback → integrate with the `feedback` Lambda → no authorizer (NONE).
   - Add OPTIONS for CORS preflight using the standard mock integration that mirrors `Access-Control-Allow-*` headers.
   - Deploy the API to the `prod` stage.

5. **Smoke test:**
   ```bash
   curl -X POST https://pufsqfvq8g.execute-api.us-east-2.amazonaws.com/prod/feedback \
     -H 'Content-Type: application/json' \
     -d '{"type":"other","description":"first deploy smoke test from runbook"}'
   ```
   Expect `201` with a feedback ID. A new GitHub Issue should appear with `feedback:user-submitted` + `type:other` labels.

## Verification

- `aws lambda get-function --function-name <fn> --region us-east-2` returns the new `LastModified` timestamp.
- A manual invocation (curl against API Gateway, or `aws lambda invoke`) returns expected output.
- CloudWatch Logs show fresh logs from the new code.

## Rollback

See [`rollback.md`](rollback.md). Lambda alias swap to previous version is the primary mechanism (post-Phase-6 once aliases exist).

## Escalation

For solo: that's you. If you're stuck >30 minutes:
- Document the state in a GitHub Issue with `incident:p0` label
- Consider taking the affected route offline by removing the API Gateway route
- The frontend continues to work for non-affected paths
