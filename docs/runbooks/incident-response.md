# Runbook: Incident response

## When to use this

The `incident-responder` agent has paged you (P0 alert), or you've otherwise observed prod is broken.

## Prerequisites

- AWS console access (us-east-2)
- CloudWatch Logs access for the affected Lambda(s)
- Sentry dashboard access (post-Phase-5)
- Project repo open

## Steps

1. **Acknowledge.** Stop other work. Note the time you started.

2. **Triangulate the cause.** In ~5 minutes, determine likely cause:
   - Recent Lambda deploy? → Most likely cause; rollback per [`rollback.md`](rollback.md).
   - Frontend deploy? → Check GitHub Actions deploy.yml for failures or warnings.
   - API Gateway issue? → Check API Gateway dashboard for 5xx spikes.
   - Cognito issue? → Check `just.jaetill.com` is reachable; Hosted UI loads.
   - Postmark issue? → Check Postmark dashboard for delivery failures.
   - BGG XML API down? → Out-of-band; bggProxy will fail until BGG returns.
   - S3 issue? → Check S3 service health; presigned URLs may be expiring incorrectly.

3. **Mitigate.** In order of safety:
   - **Rollback Lambda** to previous version (fast).
   - **Disable affected route** at API Gateway (takes that feature offline; rest works).
   - **Take site offline** as last resort (set Vite build maintenance flag; redeploy).

4. **Verify mitigation worked.** Wait 5 min minimum. Check CloudWatch + Sentry.

5. **Document while it's fresh.** Open a postmortem draft (`/postmortem` slash command).

## Verification

- The alert that fired no longer fires
- HTTP 5xx rate, p99 latency back to baseline
- No new errors in Sentry for the affected paths
- User reports (if any) stop coming in

## Rollback (of the rollback)

If your mitigation made things worse, get back to a known state — usually the last successful deploy.

## Escalation

For solo: that's you. If the incident exceeds 30 min and you're stuck, document the state thoroughly. For Game Night specifically: if user accounts are exposed via the incident, the user-facing communication plan kicks in.

## Postmortem

Within 48 hours of resolution, draft a postmortem (`/postmortem` slash command). Per platform standards: blameless, with a real root cause and prevention steps. If prevention requires architectural change, file an ADR.
