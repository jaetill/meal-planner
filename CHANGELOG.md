# Changelog

## [1.1.2](https://github.com/jaetill/meal-planner/compare/v1.1.1...v1.1.2) (2026-06-26)


### Bug Fixes

* **ci:** drop unused IMPLEMENTER_PAT forwarding from implementer caller (refs [#363](https://github.com/jaetill/meal-planner/issues/363)) ([#151](https://github.com/jaetill/meal-planner/issues/151)) ([261de4d](https://github.com/jaetill/meal-planner/commit/261de4dd3db0b256bde93252fb7f3ed0a00e6196))

## [1.1.1](https://github.com/jaetill/meal-planner/compare/v1.1.0...v1.1.1) (2026-06-21)


### Bug Fixes

* **ci:** pin deploy.yml actions to commit SHAs (closes [#144](https://github.com/jaetill/meal-planner/issues/144)) ([#145](https://github.com/jaetill/meal-planner/issues/145)) ([4f386b8](https://github.com/jaetill/meal-planner/commit/4f386b8ef0ea4dd146c6274c730e4aa4bc94556d))
* **iac:** require environment:production OIDC claim; drop master ref bypass (closes [#90](https://github.com/jaetill/meal-planner/issues/90)) ([#147](https://github.com/jaetill/meal-planner/issues/147)) ([b18acb5](https://github.com/jaetill/meal-planner/commit/b18acb502594b39f01ac61f90f70d2855220fce9))

## [1.1.0](https://github.com/jaetill/meal-planner/compare/v1.0.0...v1.1.0) (2026-06-18)


### Features

* **iac:** add ADR-0035 iac-additive-guard caller ([#280](https://github.com/jaetill/meal-planner/issues/280)) ([#108](https://github.com/jaetill/meal-planner/issues/108)) ([06107d5](https://github.com/jaetill/meal-planner/commit/06107d5f0b89384b9c09739da74907a729bcc677))


### Bug Fixes

* **ci:** pin iac-guard reusable workflow to SHA and add dependabot ([#131](https://github.com/jaetill/meal-planner/issues/131)) ([882cb63](https://github.com/jaetill/meal-planner/commit/882cb635f67ddda58050abfff9a7a5c2cee4fd3e)), closes [#109](https://github.com/jaetill/meal-planner/issues/109)
* **ci:** scope reusable secrets explicitly (ADR-0048) ([#140](https://github.com/jaetill/meal-planner/issues/140)) ([84060be](https://github.com/jaetill/meal-planner/commit/84060be69f087b381b0cbb216f9ad20bacf1e490))
* **hooks:** drop comment-ratio and section-divider checks from check-comments ([#130](https://github.com/jaetill/meal-planner/issues/130)) ([2800b69](https://github.com/jaetill/meal-planner/commit/2800b69664e472b730eecf48f4ee5f8328d04d86)), closes [#3](https://github.com/jaetill/meal-planner/issues/3)
* **hooks:** replace \x27 in ERE bracket expressions with portable QUOTE_PAT ([#127](https://github.com/jaetill/meal-planner/issues/127)) ([cf34c4e](https://github.com/jaetill/meal-planner/commit/cf34c4e42e361ce286ebbc84dd09617021446d2c)), closes [#4](https://github.com/jaetill/meal-planner/issues/4)
* **iac:** add CF Function edge-deny for feedback-contacts/* (closes [#120](https://github.com/jaetill/meal-planner/issues/120)) ([#124](https://github.com/jaetill/meal-planner/issues/124)) ([dc345e7](https://github.com/jaetill/meal-planner/commit/dc345e7749011f784bfd02f731dd1e696f7c5a76))
* **iac:** add explicit s3:GetObject deny for jaetill-meal-planner (closes [#112](https://github.com/jaetill/meal-planner/issues/112)) ([#126](https://github.com/jaetill/meal-planner/issues/126)) ([7214c32](https://github.com/jaetill/meal-planner/commit/7214c322c06036b81bc6f7d32317ea67c990ba8d))
* **iac:** deny CloudFront OAC read on feedback-contacts/* (closes [#121](https://github.com/jaetill/meal-planner/issues/121)) ([#123](https://github.com/jaetill/meal-planner/issues/123)) ([1a3f3d1](https://github.com/jaetill/meal-planner/commit/1a3f3d13c1969ff19661f8bc79700854a82bdbd1))
* **iac:** drop GetFunction/GetFunctionConfiguration/GetPolicy from iac-drift LambdaRead (closes [#118](https://github.com/jaetill/meal-planner/issues/118)) ([#125](https://github.com/jaetill/meal-planner/issues/125)) ([7eef8e6](https://github.com/jaetill/meal-planner/commit/7eef8e62ef352e56053c967f6f668a27ec5bf03a))
* **iac:** remove s3_origin_config conflicting with OAC in cloudfront.tf ([#99](https://github.com/jaetill/meal-planner/issues/99)) ([a704bdc](https://github.com/jaetill/meal-planner/commit/a704bdc0390958842c7d80c30bfb4dcce678e2fb)), closes [#35](https://github.com/jaetill/meal-planner/issues/35)
* **iac:** scope iac-drift role from ReadOnlyAccess to plan-only policy (closes [#113](https://github.com/jaetill/meal-planner/issues/113)) ([#116](https://github.com/jaetill/meal-planner/issues/116)) ([fc69ac5](https://github.com/jaetill/meal-planner/commit/fc69ac54fa550b0b98bbbc9f818828b589d6655c))
* **iam:** accept environment-scoped OIDC sub for gated prod deploys (ADR-0043) Closes [#50](https://github.com/jaetill/meal-planner/issues/50) ([#89](https://github.com/jaetill/meal-planner/issues/89)) ([142d258](https://github.com/jaetill/meal-planner/commit/142d258deb4d788b96628c22d0e438f773c9af4d))
* **iam:** add meal-planner-feedback to deploy-role lambda resources ([#92](https://github.com/jaetill/meal-planner/issues/92)) ([#101](https://github.com/jaetill/meal-planner/issues/101)) ([6469c86](https://github.com/jaetill/meal-planner/commit/6469c86fd9684ed08a6815262f8b3b1e125a7817))
* **iam:** remove dead bucket ARN from object-level S3 statements ([#100](https://github.com/jaetill/meal-planner/issues/100)) ([0e502bf](https://github.com/jaetill/meal-planner/commit/0e502bf63cb89483cdbbf13407d63e099e1f4110)), closes [#48](https://github.com/jaetill/meal-planner/issues/48)
* **logger:** recurse scrubFields into nested objects to prevent PII escaping to CloudWatch ([#74](https://github.com/jaetill/meal-planner/issues/74)) ([e4102d9](https://github.com/jaetill/meal-planner/commit/e4102d91228f2b7335e214f1d9982f8cf867f464))
* **plan:** restore degree sign and em-dash encoding in plan.js (closes [#30](https://github.com/jaetill/meal-planner/issues/30)) ([#82](https://github.com/jaetill/meal-planner/issues/82)) ([bd60a33](https://github.com/jaetill/meal-planner/commit/bd60a335c648bf8b25f78b6121acb6b19c466c27))
* **sentry:** iterate breadcrumbs.values instead of breadcrumbs (closes [#27](https://github.com/jaetill/meal-planner/issues/27)) ([#85](https://github.com/jaetill/meal-planner/issues/85)) ([59c621e](https://github.com/jaetill/meal-planner/commit/59c621e676481f2b88d6709f12146a82fdb00f36))
* **terraform:** remove localhost from prod S3 CORS allowed_origins ([#139](https://github.com/jaetill/meal-planner/issues/139)) ([1eac73b](https://github.com/jaetill/meal-planner/commit/1eac73b6f665c92e35314d9ad7a874fd8c0e8907)), closes [#40](https://github.com/jaetill/meal-planner/issues/40)

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
