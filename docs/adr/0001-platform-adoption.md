# ADR-0001: Platform adoption — meal-planner

- **Status:** Accepted
- **Date:** 2026-05-13
- **Deciders:** Jason
- **Tags:** platform, adoption

## Context

`meal-planner` adopts the Agentic Dev Environment platform per
`PORT_PLAN_meal-planner.md` in the platform workspace. This ADR records
the project-specific deltas from the platform defaults.

## Decision

Adopt all 11 platform standards. The following deltas apply:

- **Default branch:** `master` (not platform-default `main`)
- **Frontend deploy:** S3 + CloudFront (`E301SUJKLJO7A7`) (not GitHub Pages, not Vercel)
- **Backend language:** Node.js CommonJS (not platform-default Python)
- **Lambda packaging:** bare zip per function (no `node_modules` bundled) — adopting Sentry server-side wrapping would require switching to bundled zips per function. Deferred.
- **AWS region:** `us-east-2`
- **Email:** N/A (no transactional email at this time)
- **Auth:** shared Cognito user pool `us-east-2_xneeJzaDJ` (shared with game-night-pwa + jaetill-portal); Cognito-native authorizer (not custom dual-mode)
- **Group claim:** `meal-planner-users`
- **App Client:** `2g8kng7thvouq1ami8cm336gbb`
- **API Gateway:** `e2h43o5aje`
- **`.claude/`:** existing project-specific hooks preserved (`check-comments.sh`, `check-secrets.sh`, `protect-files.sh`); platform hooks added alongside without overwriting.

## Implementation status (initial PR, 2026-05-13)

- ? Phase 1 — Documentation: standards + ADR template + runbooks copied
- ? Phase 2 — AI configuration: 14 agents + 10 commands + 10 platform hooks added (project hooks preserved)
- ? Phase 3 — Quality gates: ESLint, Prettier, vitest, husky, commitlint, lint-staged configured; smoke test added
- ?? Phase 4 — CI workflows: workflow files copied; **needs secrets configured by Jason** (`CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `VITE_SENTRY_DSN`)
- ?? Phase 5 — Observability (frontend): `src/js/sentry.js` copied; **needs Jason to wire it into `index.html` + `callback.html` as the FIRST script**, AND create the Sentry project + DSN secret
- ? Phase 5 — Observability (Lambdas): deferred per PORT_PLAN
- ? Phase 6 — IaC retrofit: deferred (4+ hours, own session)
- ? Phase 7 — User feedback Lambda: deferred per PORT_PLAN

## Consequences

### Positive

- Same agent pipeline as game-night-pwa (proven over the last 2 days). Implementer / reviewer / triage-bot / drift-detector / dep-watcher all available.
- Quality-gate scaffolding installed even though no real tests exist yet — vitest passes on a smoke test; test-writer agent can fill in coverage on subsequent PRs.
- Frontend Sentry init ready to go pending Jason's DSN + index.html wiring.

### Negative

- Bare-zip Lambdas remain unobserved by Sentry. CloudWatch is the only signal.
- No IaC drift detection until Phase 6 lands.
- ESLint will likely complain on the first run against existing untested JS. Treat as backlog; fix as files get touched.

### Neutral

- `package.json` gained 14 devDependencies. Install size grows by ~250 MB but only in dev.
- `npm ci --legacy-peer-deps` in existing deploy.yml may still be needed; verify on first CI run.

## Links

- [PORT_PLAN_meal-planner.md](../../PORT_PLAN_meal-planner.md) (in agentic-dev-environment workspace)
- Game-night-pwa reference implementation: `https://github.com/jaetill/game-night-pwa`