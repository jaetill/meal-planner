# Runbook: Lambda rollback

## When to use this

A Lambda deploy broke functionality and the auto-rollback (per platform ADR-0003) has either fired and failed, or hasn't fired (the project's CI doesn't yet have auto-rollback wired — see Phase 4 of the integration plan).

## Prerequisites

- AWS CLI authenticated to **us-east-2**
- Knowledge of the previous version number (visible in `aws lambda list-versions-by-function`)

## Steps

1. **Identify the previous healthy version:**
   ```bash
   aws lambda list-versions-by-function --function-name <fn> --region us-east-2 \
     --query 'Versions[*].{Version:Version,LastModified:LastModified}' \
     --output table
   ```
   The version *before* the most recent (which is broken) is your target.

2. **Swap the alias** (the `live` alias if Phase 6's IaC has been applied; otherwise the function's published version):
   ```bash
   aws lambda update-alias \
     --function-name <fn> \
     --name live \
     --function-version <prev-version> \
     --region us-east-2
   ```
   This is near-instant.

3. **For functions not yet on alias-based blue-green** (pre-Phase-6): re-deploy the previous version's code. Use `git checkout <previous-tag> -- lambda/<fn>.js` and run the deploy procedure from [`deploy.md`](deploy.md).

## Verification

- `aws lambda get-alias --function-name <fn> --name live` shows the previous version.
- API Gateway routes to that Lambda return expected results.
- CloudWatch Logs / Sentry (post-Phase-5) show the rollback as the active version.

## Rollback (of the rollback)

If the previous version has its own bug that the buggy deploy was meant to fix: you have a real incident. Pick the path of least harm — sometimes "stay broken on the new version" is correct because rollback regresses worse. Document in a postmortem.

## Escalation

For solo: that's you. Per platform ADR-0003, after auto-rollback (when Phase 4 is complete) the `incident-responder` agent will have already opened a P0 issue and pinged you. Manual rollback is the same procedure but human-initiated.
