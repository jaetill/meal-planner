## Dependency Watch (2026-06-29)

---

### `package.json` (root — frontend / tooling)

#### 🔴 HIGH — Security Advisories (action required)

| Package | Installed | Advisory | GHSA | Severity |
|---------|-----------|----------|------|----------|
| `vite` | 8.0.x | `server.fs.deny` bypass on Windows alternate paths | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) | **HIGH** |
| `vite` | 8.0.x | NTLMv2 hash disclosure via UNC path (launch-editor) | [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) | moderate (rolled up to HIGH) |

Both advisories affect `vite >=8.0.0 <=8.0.15`. Fix is available: update to `>=8.0.16`.

> **Note:** Both CVEs require a Windows host. This project deploys on Linux (Lambda) and the dev server is not exposed to the internet, so immediate production risk is low. Still flag for update because `npm audit` reports HIGH and CI may gate on it.

**Recommended action:** `npm install vite@latest` (or pin `^8.0.16`).

#### 🟡 LOW — Security Advisories

| Package | Installed | Advisory | GHSA | Severity |
|---------|-----------|----------|------|----------|
| `esbuild` (transitive via vite) | 0.27.x–0.28.0 | Arbitrary file read on Windows dev server | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | low |

Resolved automatically when vite is updated (vite ships esbuild as a bundled dep).

#### 🔵 Minor / Patch Outdated (batch sweep)

| Package | Specifier | Wanted | Latest | Priority |
|---------|-----------|--------|--------|----------|
| `@tailwindcss/vite` | `^4.2.1` | 4.3.1 | 4.3.1 | low |
| `tailwindcss` | `^4.2.1` | 4.3.1 | 4.3.1 | low |

These are minor bumps within the `^4.x` range; no breaking changes expected.

---

### `lambda/package.json` (Lambda functions)

#### 🟠 MODERATE — Security Advisories (action required — major bump needed)

Root cause: `@opentelemetry/core <2.8.0` has unbounded memory allocation in W3C Baggage propagation ([GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf), CVSS 5.3). This is a transitive dep pulled in by `@sentry/aws-serverless@9.x` → `@sentry/node` → `@opentelemetry/*`.

**18 packages flagged** — all ultimately trace to the same root advisory. Key direct/near-direct affected packages:

| Package | Via | Fix Available |
|---------|-----|---------------|
| `@sentry/aws-serverless` | direct | `10.62.0` (major) |
| `@sentry/node` | `@sentry/aws-serverless` | via `@sentry/aws-serverless@10` |
| `@opentelemetry/core` | `@sentry/node` | `>=2.8.0` |
| `@opentelemetry/instrumentation-aws-sdk` | `@sentry/aws-serverless` | via `@sentry/aws-serverless@10` |
| *(13 other `@opentelemetry/*` instrumentations)* | transitive | via `@sentry/aws-serverless@10` |

**Fix:** `npm install --prefix lambda @sentry/aws-serverless@^10.62.0`

> **Breaking-change risk:** This is a **major version bump** (9 → 10). Review the [Sentry v10 migration guide](https://docs.sentry.io/platforms/javascript/migration/v9-to-v10/) before updating. Pay particular attention to `Sentry.wrapHandler()` API compatibility in `lambda/lib/sentry.js` — the wrapper signature did not change in v9→v10, but verify `beforeSend`/`beforeBreadcrumb` hooks still work as expected.

#### 🟠 MAJOR VERSION — Outdated (breaking-change risk)

| Package | Specifier | Current | Latest | Risk |
|---------|-----------|---------|--------|------|
| `@sentry/aws-serverless` | `^9.0.0` | 9.47.1 | **10.62.0** | Major — see above |
| `@octokit/rest` | `^21.0.0` | 21.1.1 | **22.0.1** | Major — review changelog for API changes before updating |

`@octokit/rest` v22 has no active security advisory; upgrade is recommended but not urgent. Pin to `^22.0.1` once breaking changes are reviewed.

---

### Summary

| Severity | Count | Location | Action |
|----------|-------|----------|--------|
| HIGH | 2 advisories (1 package) | root `vite` (devDep) | Update `vite` → `>=8.0.16` |
| MODERATE | 18 advisories (1 root cause) | lambda `@sentry/aws-serverless` | Update `@sentry/aws-serverless` → `^10.62.0` (major, test first) |
| LOW | 1 advisory | root `esbuild` (transitive) | Resolved by vite update |
| Major bump | 2 packages | lambda | `@sentry/aws-serverless`, `@octokit/rest` |
| Minor/patch | 2 packages | root | `tailwindcss`, `@tailwindcss/vite` |
