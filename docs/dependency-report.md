## Dependency Watch (2026-07-06)

---

### `package.json` (root — frontend / dev toolchain)

#### HIGH — Security Advisories (action recommended)

| Package | Installed range | Fix version | Advisory |
|---------|----------------|-------------|----------|
| `vite` | `^8.0.0` (resolves to 8.0.0–8.0.15) | ≥ 8.0.16 | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff): `server.fs.deny` bypass via Windows alternate paths (HIGH, CWE-22/200) |
| `vite` | same | ≥ 8.0.16 | [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3): NTLMv2 hash disclosure via UNC path in `launch-editor` (MODERATE) |

**Recommendation:** Run `npm install vite@latest` (or pin to `^8.0.16`) to pick up the patch. Both advisories affect the dev server on Windows; CI/deployment risk is low, but the HIGH rating warrants a prompt patch.

#### LOW — Security Advisories (dev toolchain only)

| Package | Installed range | Advisory |
|---------|----------------|----------|
| `esbuild` | 0.27.3–0.28.0 (transitive via vite) | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr): arbitrary file read on Windows dev server (LOW, CVSS 2.5). Resolved by updating `vite` above. |

#### Minor/patch — no security impact

| Package | Declared range | Wanted (in-range latest) | Registry latest |
|---------|---------------|--------------------------|-----------------|
| `@tailwindcss/vite` | `^4.2.1` | 4.3.2 | 4.3.2 |
| `tailwindcss` | `^4.2.1` | 4.3.2 | 4.3.2 |

These are within their declared semver range; no action required this cycle. Batch with next monthly sweep if desired.

---

### `lambda/package.json` (Lambda — production runtime)

#### MODERATE — Security Advisory (requires major-version upgrade to fix)

| Package | Installed range | Fix version | Advisory |
|---------|----------------|-------------|----------|
| `@sentry/aws-serverless` | `^9.0.0` (resolves to 9.47.1) | 10.63.0 (major) | [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf): `@opentelemetry/core` unbounded memory allocation in W3C Baggage propagation (MODERATE, CVSS 5.3, CWE-770). Exploitable remotely with no auth — any inbound request carrying a crafted `baggage` header can grow Lambda memory unboundedly. |

**Root cause:** `@sentry/aws-serverless` ≤ 9.47.1 bundles `@opentelemetry/core` < 2.8.0 via its `@sentry/node` → `@opentelemetry/*` instrumentation chain (18 affected transitive packages). The only available fix is `@sentry/aws-serverless@10.63.0`, which is a **major version bump (9 → 10)**.

**Recommendation:** Plan a Sentry v10 upgrade. Review the [Sentry v10 migration guide](https://docs.sentry.io/platforms/javascript/migration/v9-to-v10/) before updating — this affects all Lambda handlers (`save.js`, `groups.js`, `nutrition.js`, `kroger.js`, `alexa.js`, `share.js`, `plan.js`) that call `Sentry.wrapHandler()` via `lambda/lib/sentry.js`. The upgrade is not a one-liner but is bounded to `lib/sentry.js` if the wrapper API is stable.

#### Major version bump available (no security advisory)

| Package | Installed range | Wanted (in-range) | Latest | Risk |
|---------|---------------|-------------------|--------|------|
| `@octokit/rest` | `^21.0.0` | 21.1.1 | **22.0.1** | Major — review [v22 changelog](https://github.com/octokit/rest.js/releases) for breaking changes before upgrading |
| `@sentry/aws-serverless` | `^9.0.0` | 9.47.1 | **10.63.0** | Major — see security note above; security concern elevates priority |

---

### Summary

| Severity | Count | Packages |
|----------|-------|---------|
| HIGH (security) | 1 | `vite` (root) |
| MODERATE (security, major-bump fix) | 1 | `@sentry/aws-serverless` (lambda) |
| LOW (security, dev-only, auto-resolved) | 1 | `esbuild` (root, transitive) |
| Major bump (no CVE) | 1 | `@octokit/rest` (lambda) |
| Minor/patch | 2 | `@tailwindcss/vite`, `tailwindcss` (root) |

**Immediate actions:**
1. `vite` — patch to ≥ 8.0.16 (`npm install vite@latest` in root)
2. `@sentry/aws-serverless` — schedule Sentry v10 upgrade sprint; track breaking-change review for `lambda/lib/sentry.js`

**Next monthly sweep:** `@octokit/rest` v22, `@tailwindcss/vite`/`tailwindcss` latest.
