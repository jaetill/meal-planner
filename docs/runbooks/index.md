# Runbooks

Operational playbooks for game-night-pwa. Format per platform [ADR-0008](https://github.com/jaetill/agentic-dev-environment/blob/main/docs/adr/0008-documentation.md): tight 6-section (When / Prereqs / Steps / Verify / Rollback / Escalation).

## Default runbooks

- [Deploy](deploy.md) — manual Lambda deploy procedure (frontend auto-deploys via deploy.yml; this is for the bypass case)
- [Rollback](rollback.md) — Lambda alias-swap rollback
- [Incident response](incident-response.md) — general "something is broken in prod" procedure
- [Secret leak](secret-leak.md) — Postmark / Cognito / SSM Parameter Store rotation
- [IaC recovery](iac-recover.md) — placeholder; meaningful after Phase 6 (Terraform retrofit)

## Project-specific runbooks (added as patterns emerge)

- See [`docs/iam-audit.md`](../iam-audit.md) — existing IAM audit (separate from runbooks; informational)
- (Add Cognito-related, BGG XML import, S3 game-night data corruption, etc., as needed)
