## Dependency Watch (2026-07-13)

---

### `package.json` (root — frontend / build tooling)

#### HIGH — Security Advisory (fix immediately)

| Package | Installed | Advisory | CVE/GHSA |
|---------|-----------|----------|----------|
| `vite` (direct devDep) | ^8.0.0 (8.0.0–8.0.15) | `server.fs.deny` bypass via Windows alternate paths — **file read outside root** | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) |
| `vite` (direct devDep) | ^8.0.0 (8.0.0–8.0.15) | NTLMv2 hash disclosure via UNC path handling (launch-editor) | [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) |

**Context:** Both advisories are Windows-specific and affect the Vite dev server only — not the deployed production build. Nevertheless severity is HIGH; fix by running `npm audit fix` in the repo root (stays within the `^8.0.0` semver range).

#### LOW — Security Advisory (batch fix)

| Package | Installed | Advisory | CVE/GHSA |
|---------|-----------|----------|----------|
| `esbuild` (transitive via vite) | 0.27.3–0.28.0 | Arbitrary file read on Windows dev server | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) |

**Context:** Windows dev server only. Resolved by the same `npm audit fix` that updates vite.

#### Minor / patch updates (low priority — monthly sweep)

| Package | Declared | Latest |
|---------|----------|--------|
| `tailwindcss` | ^4.2.1 | 4.3.2 |
| `@tailwindcss/vite` | ^4.2.1 | 4.3.2 |

Both are within the declared semver range; `npm update` will pick them up.

---

### `lambda/package.json` (Lambda functions)

#### MODERATE — Security Advisory (fix soon — requires major bump)

| Package | Root cause | Advisory | CVE/GHSA |
|---------|-----------|----------|----------|
| `@opentelemetry/core` (transitive via `@sentry/aws-serverless`) | Unbounded memory allocation in W3C Baggage propagation — **potential DoS** | 18 OTel packages affected; fix requires `@sentry/aws-serverless@>=10.0.0` | [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) |

**Context:** All 18 vulnerable packages (`@opentelemetry/instrumentation-*`, `@opentelemetry/sdk-trace-base`, `@sentry/node`, etc.) share the same root cause. The fix is a **major** version upgrade of `@sentry/aws-serverless` from `^9` to `^10`. Review the [Sentry v10 migration guide](https://docs.sentry.io/platforms/javascript/guides/aws-lambda/migration/v9-to-v10/) before upgrading — Lambda handler wrapping API may have changed.

#### Major version bumps available (breaking-change risk — review before upgrading)

| Package | Current constraint | Latest | Notes |
|---------|--------------------|--------|-------|
| `@sentry/aws-serverless` | ^9.0.0 (9.47.1 installed) | **10.65.0** | Also resolves all 18 moderate advisories above. Major API changes; check `Sentry.wrapHandler()` compat in `lambda/lib/sentry.js`. |
| `@octokit/rest` | ^21.0.0 (21.1.1 installed) | **22.0.1** | Check GitHub API client call sites across lambda handlers for renamed methods/changed pagination. |

**Recommended action:** Upgrade `@sentry/aws-serverless` to `^10.65.0` first (resolves the moderate CVE chain). Treat `@octokit/rest` as a separate PR.

---

### Summary

| Manifest | CRITICAL | HIGH | MODERATE | LOW | Major bumps |
|----------|----------|------|----------|-----|-------------|
| `package.json` (root) | 0 | 1 | 0 | 1 | 0 |
| `lambda/package.json` | 0 | 0 | 1* | 0 | 2 |

\* One root cause (`@opentelemetry/core`) surfacing across 18 packages.

**Immediate actions:**
1. `npm audit fix` in repo root → resolves `vite` HIGH and `esbuild` LOW.
2. Upgrade `lambda/` `@sentry/aws-serverless` `^9` → `^10.65.0` (with migration testing) → resolves all 18 moderate advisories.
