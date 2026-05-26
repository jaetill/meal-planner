# Changelog

## 1.0.0 (2026-05-26)


### Features

* **.claude:** migrate to ai-team plugin subscription (ADR-0015) ([35b3b14](https://github.com/jaetill/meal-planner/commit/35b3b14eb7688e4c64dedac139c5db5564c8553b))
* **.claude:** subscribe to agentic-dev-environment plugin ([6d184f5](https://github.com/jaetill/meal-planner/commit/6d184f5695d1897ef36a2d3f4c4f8d91211e7099))
* adopt Agentic Dev Environment platform — Phases 1-3 + Phase 5 frontend ([#1](https://github.com/jaetill/meal-planner/issues/1)) ([199f810](https://github.com/jaetill/meal-planner/commit/199f81007b93fdaa979d55fed145d3721f43221c))
* **ci:** migrate claude-pr-review to platform reusable (ADR-0018) ([af06d9d](https://github.com/jaetill/meal-planner/commit/af06d9d5b1d0171dc0a3017acd405a061a1a075c))
* **iac:** Phase 6 Slice 1 — terraform skeleton + S3/CloudFront import ([#34](https://github.com/jaetill/meal-planner/issues/34)) ([fac6942](https://github.com/jaetill/meal-planner/commit/fac69421c9600c2bda5313c161115f3b96c6131f))
* **iac:** Slice 2 (IAM) - import 3 roles + 5 inline policies + auto-managed policy ([#45](https://github.com/jaetill/meal-planner/issues/45)) ([b706f19](https://github.com/jaetill/meal-planner/commit/b706f19c216f741586bd065acce4bf1be94abcd7))
* **iac:** Slice 3 (Lambdas) - import 7 functions ([#51](https://github.com/jaetill/meal-planner/issues/51)) ([0f4f470](https://github.com/jaetill/meal-planner/commit/0f4f47099b4bd9513e95214da4779a0150446f2d))
* **iac:** Slice 4 (API Gateway) - HTTP + REST APIs ([#52](https://github.com/jaetill/meal-planner/issues/52)) ([f62ae5a](https://github.com/jaetill/meal-planner/commit/f62ae5a49e2ffe21efbc44d53d307bb2e873877f))
* **iac:** Slice 5 (Secrets + Log groups) - Phase 6 complete ([#53](https://github.com/jaetill/meal-planner/issues/53)) ([9980d5f](https://github.com/jaetill/meal-planner/commit/9980d5f8b839bc87a82e4339080d0f62bd802df4))
* **observability:** Phase 5 - Sentry across all 7 Lambdas + frontend release tagging ([#22](https://github.com/jaetill/meal-planner/issues/22)) ([3c67c3d](https://github.com/jaetill/meal-planner/commit/3c67c3d1296796df3080c60de3d9b6b2ae2329b1))
* **observability:** Phase 7 - user feedback widget + Lambda ([#55](https://github.com/jaetill/meal-planner/issues/55)) ([e114cd0](https://github.com/jaetill/meal-planner/commit/e114cd0bdcdb539652379adf5a506a2851fadc23))
* **orchestration:** fleet-dispatch support + retire legacy triage-bot (ADR-0020) ([#56](https://github.com/jaetill/meal-planner/issues/56)) ([26cda0f](https://github.com/jaetill/meal-planner/commit/26cda0f534d1388a10adc7e0e12ad5f413c35305))


### Bug Fixes

* **ci:** hoist NB comment out of if-block scalar (workflow was unparseable) ([#33](https://github.com/jaetill/meal-planner/issues/33)) ([dfb1398](https://github.com/jaetill/meal-planner/commit/dfb13981f8ffe99d92854305a82190c5257773ed))
* complete platform adoption — wire up hooks, restore deploy.yml ([#2](https://github.com/jaetill/meal-planner/issues/2)) ([a2b89b5](https://github.com/jaetill/meal-planner/commit/a2b89b545fea624a787d4e4cac9622f1f34ee32c))
* **docs:** repair mkdocs --strict build ([#32](https://github.com/jaetill/meal-planner/issues/32)) ([12039b1](https://github.com/jaetill/meal-planner/commit/12039b152773564bc03e0b4cef2553cf4edfdc54))
* **iac:** add validation to cloudfront_acm_cert_arn to prevent empty value ([#68](https://github.com/jaetill/meal-planner/issues/68)) ([933e52d](https://github.com/jaetill/meal-planner/commit/933e52d50c1bf9e57d4c2851485fbd02765e7785)), closes [#38](https://github.com/jaetill/meal-planner/issues/38)
* **iac:** ignore tags on log groups (logs:TagResource IAM gap) ([#54](https://github.com/jaetill/meal-planner/issues/54)) ([9d25a06](https://github.com/jaetill/meal-planner/commit/9d25a06c4da4fddc1e8a40e5e4785684466adb22))
* **implementer:** allow fleet-App dispatch; drop API-key fallback ([#63](https://github.com/jaetill/meal-planner/issues/63)) ([efe3928](https://github.com/jaetill/meal-planner/commit/efe3928ff99e65e8fcb27dc58961a081ca2f3e3b))
* **save:** restore corrupted Unicode chars; extract parse-utils ([#65](https://github.com/jaetill/meal-planner/issues/65)) ([3e26aa2](https://github.com/jaetill/meal-planner/commit/3e26aa2d29dac396f90e08b91de071c324b7e734)), closes [#28](https://github.com/jaetill/meal-planner/issues/28)
* **share:** restore bullet U+2022 corrupted to mojibake in email text body ([#29](https://github.com/jaetill/meal-planner/issues/29)) ([#71](https://github.com/jaetill/meal-planner/issues/71)) ([6f4e8cd](https://github.com/jaetill/meal-planner/commit/6f4e8cd3eaa356fb9363879e5236297fe45d1fd6))
