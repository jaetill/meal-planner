# ADR-0014: Lambda Sentry observability — `@sentry/aws-serverless` adoption + PII scrubbing

- **Status:** Proposed
- **Date:** 2026-05-17
- **Deciders:** Jason
- **Tags:** observability, sentry, security, new-external-dep, lambda

> **Format:** This ADR follows [MADR 4.x](https://adr.github.io/madr/) with three documented extensions: (1) **Neutral consequences** as a third bucket alongside Positive/Negative; (2) **Implementation notes** as a separate section before Links; (3) **Bundled sub-decisions** when multiple related decisions are tightly coupled (each sub-decision gets its own Considered Options and Pros and Cons sections).

## Context and Problem Statement

ADR-0009 chose Sentry for error tracking and ADR-0001 deferred Lambda-side Sentry instrumentation ("Phase 5 — Observability (Lambdas)") because the bare-zip packaging model couldn't bundle `node_modules`. The Lambdas have been running with CloudWatch as the only error signal — no grouping, no dedup, no release tracking — while the frontend Sentry init has been ready since the platform adoption PR.

Two questions need answering: (1) which Sentry SDK package to adopt for the Lambda runtime, and (2) how to prevent PII from leaking to Sentry given that Lambdas process Cognito claims, emails (in `share.js`), and API keys (in `kroger.js`, `nutrition.js`, `plan.js`, `save.js`).

## Decision Drivers

- **ADR-0009 compliance.** Sentry was already chosen; this is the implementation, not the vendor selection.
- **ADR-0006 PII obligation.** Error payloads, breadcrumbs, and exception values can contain emails, JWTs, and API keys — all must be scrubbed before leaving the Lambda.
- **Lambda packaging change.** Adopting any npm dependency forces a shift from bare-zip (single `.js` file) to bundled-zip (`handler + lib/ + node_modules`). This has deploy-time and zip-size implications.
- **Graceful degradation.** Sentry must not break Lambdas if the DSN is misconfigured or the secret is missing — the app is the priority.
- **Minimal cold-start impact.** Lambda cold starts are user-facing; the SDK must not add significant init time.

## Considered Options

- **Sub-decision 1 — Sentry SDK package:** chose `@sentry/aws-serverless`
- **Sub-decision 2 — PII scrubbing strategy:** chose dual-layer scrubbing (structured logger field redaction + Sentry `beforeSend`/`beforeBreadcrumb` hooks)

## Decision Outcome

We adopt **`@sentry/aws-serverless`** as the sole new runtime dependency for all 7 Lambdas, with **dual-layer PII scrubbing** that catches sensitive data at both the structured-log emit layer and the Sentry event submission layer.

The bundle is internally consistent because the Sentry SDK's `consoleIntegration` captures every `console.log` as a breadcrumb — meaning the structured logger's output flows into Sentry breadcrumbs, and both layers must independently scrub PII to prevent leaks through either path.

## Consequences

### Positive

- All 7 Lambdas gain Sentry error tracking with automatic grouping, release tagging, and source context — closing the observability gap identified in ADR-0001.
- PII scrubbing is defense-in-depth: even if a developer logs a raw email via `console.log` (bypassing the structured logger), Sentry's `beforeBreadcrumb` catches it.
- Graceful no-op when `SENTRY_DSN` is unset — existing Lambda behavior is unchanged until secrets are configured.
- Lambda zips now include `lib/` (shared logger + sentry init), establishing a pattern for future shared utilities without a build step.

### Negative

- **Lambda zip size increase.** Each zip grows from ~10 KB (single file) to ~2–4 MB (handler + `lib/` + `node_modules`). Well within the 50 MB unzipped limit; no action needed.
- **Cold-start impact.** `@sentry/aws-serverless` adds ~50–100ms to cold starts from `require()` and `Sentry.init()`. Acceptable for API Gateway Lambdas (p99 cold start is already ~300–500ms from AWS SDK).
- **New external dependency.** `@sentry/aws-serverless` is maintained by Sentry (a well-funded, widely-adopted vendor), but it is a new supply-chain surface. Mitigated by `npm audit` in CI (added in this PR's `package-lock.json`) and pinning to `^9.0.0`.
- **Deploy workflow complexity.** `deploy.yml` zip steps change from `zip -j` (flat) to `pushd lambda && zip -r` (recursive with lib + node_modules). More lines, but each step remains self-contained.

### Neutral

- `traces_sample_rate` is set to 0.1 (10%). This is a starting point; can be tuned per-Lambda via env var later without code changes.
- The structured logger (`lambda/lib/logger.js`) is introduced alongside Sentry but has no dependency on it. It would be useful even without Sentry for CloudWatch Logs Insights queries.
- `lambda/package.json` is new. It scopes Lambda dependencies separately from the frontend `package.json`, avoiding dev-dependency pollution in Lambda zips.

## Pros and Cons of the Options

### Sub-decision 1: Sentry SDK package

| Option | Trade-off |
|---|---|
| **`@sentry/aws-serverless`** (chosen) | Purpose-built for Lambda: auto-captures cold starts, wraps handler for unhandled exceptions, integrates with Lambda lifecycle. Maintained by Sentry. |
| **`@sentry/node`** | General Node.js SDK. Works in Lambda but lacks Lambda-specific lifecycle hooks (no automatic cold-start tracking, no `wrapHandler` convenience). Requires manual flush before Lambda freezes. |
| **Manual `captureException` calls** | No dependency; full control. Misses unhandled rejections, requires explicit flush, no automatic breadcrumbs. High maintenance burden across 7 Lambdas. |
| **AWS Lambda Powertools + Sentry transport** | Over-engineered for this project's scale. Powertools is Python-first; the Node.js version is less mature. Adds a second dependency for marginal benefit. |

### Sub-decision 2: PII scrubbing strategy

| Option | Trade-off |
|---|---|
| **Dual-layer scrubbing** (chosen) | Logger scrubs fields + regex at emit time; Sentry `beforeSend`/`beforeBreadcrumb` scrubs events before they leave the Lambda. Defense-in-depth: catches PII from both structured and unstructured sources. |
| **Logger-only scrubbing** | Simpler; single scrubbing point. But Sentry's `consoleIntegration` breadcrumbs and exception `value` strings bypass the logger entirely — PII can leak through exception messages. |
| **Sentry-only scrubbing (server-side data scrubbing)** | Sentry's server-side rules handle scrubbing after data arrives. PII leaves the Lambda in plaintext over TLS — acceptable per some threat models but violates ADR-0006's "scrub at emit time" principle. |
| **Disable `consoleIntegration`** | Eliminates the breadcrumb leak path but loses valuable debugging context (the sequence of log lines leading to an error). Too high a cost for a scrubbing shortcut. |

## Implementation notes

- `lambda/lib/sentry.js`: shared Sentry init; `beforeSend` strips `event.user.email`, `event.user.username`, `event.user.ip_address`; regex-scrubs emails and JWTs from breadcrumb messages, exception values, and extras.
- `lambda/lib/logger.js`: structured JSON logger; field-level redaction for 16 named PII fields; regex scrubbing for emails and JWTs in string values. OTEL semantic-convention field names.
- All 7 handlers wrapped via `Sentry.wrapHandler()` — single-line change per file.
- `deploy.yml`: Lambda zip commands updated to include `lib/` and `node_modules/`; Sentry release creation step added (gated on `SENTRY_AUTH_TOKEN` presence).
- Frontend build now receives `VITE_SENTRY_DSN`, `VITE_DEPLOY_ENV`, `VITE_RELEASE_VERSION` env vars for release correlation.
- Closes the "Phase 5 — Observability (Lambdas): deferred" item from ADR-0001.

## Links

- [`@sentry/aws-serverless` docs](https://docs.sentry.io/platforms/javascript/guides/aws-lambda/) — SDK reference.
- [Sentry data scrubbing](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/) — server-side scrubbing (not relied upon; defense-in-depth only).
- ADR-0009 — chose Sentry as error-tracking vendor; this ADR implements the Lambda side.
- ADR-0006 — PII redaction obligation; operationalized here via dual-layer scrubbing.
- ADR-0001 — platform adoption; Phase 5 Lambda observability was deferred, now resolved.
- [MADR 4.x](https://adr.github.io/madr/) — ADR format used.
