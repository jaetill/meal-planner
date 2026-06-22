## Dependency Watch (2026-06-22)

---

### `package.json` (root — frontend)

#### HIGH — Security Advisories

| Package | Installed | Fix Version | Advisory |
|---------|-----------|-------------|----------|
| `vite` | `^8.0.0` (8.0.x) | ≥ 8.0.16 | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) |

**GHSA-fx2h-pf6j-xcff** — `vite: server.fs.deny bypass on Windows alternate paths` (HIGH, CWE-22/CWE-200). Affects vite 8.0.0–8.0.15. An attacker can read files outside the allowed directory via Windows alternate path forms. Fix available via `npm update vite`.

**GHSA-v6wh-96g9-6wx3** — `launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows` (MODERATE, CWE-73/CWE-522). Bundled in the same vite fix.

> **Risk note**: Both advisories are Windows-only. This project runs on Linux (CI + Lambda). Direct production risk is low, but the dependency should still be updated to eliminate the advisory. `vite` is a devDependency used in the build pipeline only.

**Action**: `npm install vite@latest --save-dev` (or pin to `^8.0.16`).

#### LOW — Security Advisories

| Package | Installed | Fix Version | Advisory |
|---------|-----------|-------------|----------|
| `esbuild` | (transitive, via vite) | Resolved by vite upgrade | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) |

**GHSA-g7r4-m6w7-qqqr** — `esbuild allows arbitrary file read when running the development server on Windows` (LOW, CVSS 2.5, CWE-22). Affects esbuild 0.27.3–0.28.0. Windows dev server only; resolved by updating vite.

#### Minor/Patch Updates (low priority — batch in monthly sweep)

| Package | Declared | Latest |
|---------|----------|--------|
| `@tailwindcss/vite` | `^4.2.1` | `4.3.1` |
| `tailwindcss` | `^4.2.1` | `4.3.1` |

Both are within the declared semver range (`^4.2.x`). No action needed until next monthly sweep; `npm update` will pick them up.

---

### `lambda/package.json`

#### MODERATE — Security Advisories (fix requires major version bump)

| Package | Installed | Fix Version | Advisory |
|---------|-----------|-------------|----------|
| `@sentry/aws-serverless` | `^9.0.0` (9.47.1) | `10.59.0` (major) | [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) |

**GHSA-8988-4f7v-96qf** — `OpenTelemetry Core: Unbounded memory allocation in W3C Baggage propagation` (MODERATE, CVSS 5.3, CWE-770). Affects `@opentelemetry/core <2.8.0`, which is a transitive dependency of `@sentry/aws-serverless` v9. A remote attacker can send crafted HTTP baggage headers to cause excessive memory allocation (potential DoS). Lambda functions using Sentry's AWS handler are exposed on every request.

The fix requires upgrading `@sentry/aws-serverless` from v9 to **v10.59.0**, which is a **major version bump**. Review the [Sentry v10 migration guide](https://docs.sentry.io/platforms/javascript/migration/v9-to-v10/) before upgrading — the `Sentry.wrapHandler()` API surface changed in v10.

**Affected transitive packages** (all resolved by upgrading `@sentry/aws-serverless`):
`@opentelemetry/core`, `@opentelemetry/instrumentation-aws-sdk`, `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-fs`, `@opentelemetry/instrumentation-undici`, `@opentelemetry/instrumentation-pg`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base`, `@sentry/node`, and 9 others.

**Action**: Schedule a dedicated upgrade PR for `@sentry/aws-serverless` v9 → v10. Test `lib/sentry.js` wrapper and all Lambda handlers after upgrade.

#### Major Version Updates Available

| Package | Declared | Wanted | Latest |
|---------|----------|--------|--------|
| `@sentry/aws-serverless` | `^9.0.0` | `9.47.1` | `10.59.0` |
| `@octokit/rest` | `^21.0.0` | `21.1.1` | `22.0.1` |

- **`@sentry/aws-serverless` v9 → v10**: Required to fix the MODERATE advisory above. Breaking changes expected — see migration guide.
- **`@octokit/rest` v21 → v22**: GitHub API client. Review the [v22 changelog](https://github.com/octokit/rest.js/releases) for breaking changes before upgrading. No security advisory; schedule for next major-deps sweep.

---

### Summary

| Severity | Count | Manifests |
|----------|-------|-----------|
| HIGH | 1 | root |
| MODERATE | 18 (1 root cause) | lambda |
| LOW | 1 | root |
| Major version available | 2 | lambda |
| Minor/patch update available | 2 | root |

**Immediate actions (this sprint):**
1. `npm install vite@latest --save-dev` in root — fixes HIGH + LOW advisories (Windows-only, low production risk but advisory should be cleared).
2. Plan `@sentry/aws-serverless` v9 → v10 upgrade in `lambda/` — clears all 18 MODERATE advisories. Requires migration review; open a dedicated PR.
