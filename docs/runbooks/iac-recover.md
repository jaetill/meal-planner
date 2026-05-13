# Runbook: Terraform/OpenTofu state recovery

## When to use this

Terraform/OpenTofu state is lost, corrupted, or out of sync with reality. Symptoms: `tofu plan` says it'll recreate everything; or `tofu apply` fails with "resource already exists."

**This runbook is meaningful only after Phase 6 of the integration plan has been executed.** Until then, this project's AWS infrastructure is not under Terraform management; manual rollback procedures apply (see [`rollback.md`](rollback.md) for Lambda; AWS console for everything else).

## Prerequisites

- AWS CLI authenticated to us-east-2 with read access to the S3 state bucket
- Access to the S3 bucket that holds state (per platform ADR-0007 — exact name TBD by Phase 6)
- The DynamoDB lock table

## Steps (post-Phase-6)

1. **Take a backup.** Don't make changes without one.
   ```bash
   aws s3 cp s3://<bucket>/game-night/prod/terraform.tfstate \
     ./recovery/$(date +%Y%m%d-%H%M)-terraform.tfstate \
     --region us-east-2
   ```

2. **Check state versioning.** S3 versioning is enabled per ADR-0007. List versions:
   ```bash
   aws s3api list-object-versions \
     --bucket <bucket> \
     --prefix game-night/prod/terraform.tfstate \
     --region us-east-2
   ```
   Identify the last known good version.

3. **Restore that version:**
   ```bash
   aws s3api copy-object \
     --bucket <bucket> \
     --key game-night/prod/terraform.tfstate \
     --copy-source <bucket>/game-night/prod/terraform.tfstate?versionId=<last-good-version-id> \
     --region us-east-2
   ```

4. **Run `tofu plan`** to compare restored state to actual cloud state. Resolve any drift via import or state-rm as needed.

5. **Verify clean plan.** `tofu plan` should show 0 changes.

## Verification

- `tofu plan` shows 0 changes
- All expected resources exist
- Service health endpoints are green (Lambdas respond, API Gateway routes work)

## Rollback

If the restored state is itself corrupt: try an even earlier version. S3 versioning preserves historical versions per the IaC standard.

## Escalation

If state can't be recovered from S3 versions, the option is to **rebuild state from scratch** via imports of every resource. This is painful but possible. For game-night-pwa with 8 Lambdas + S3 + Cognito client + IAM roles + API Gateway, estimate a half-day of focused work.

This runbook is rarely triggered. If you find yourself running it frequently, the underlying issue (concurrent applies? interrupted deploys?) needs an ADR-level fix.
