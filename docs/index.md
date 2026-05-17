# meal-planner

Weekly meal planning + grocery list + cook mode for the family. Frontend on S3 + CloudFront, Lambda backends behind API Gateway, Cognito auth, recipes/plans stored in S3.

## What's in these docs

- **[Standards](standards/index.md)** — engineering practices this project adopts from the [agentic-dev-environment](https://github.com/jaetill/agentic-dev-environment) platform.
- **[ADRs](adr/0001-platform-adoption.md)** — architectural decisions specific to meal-planner, plus the inherited platform ADRs.
- **[Runbooks](runbooks/index.md)** — operational procedures: deploy, rollback, incident response, Sentry alerts, secret leaks, IaC recovery.
- **IAM Audit** — the [2026-04-12 IAM audit](iam-audit.md).

## Architecture summary

- Frontend: Vite + vanilla JS + Tailwind, deployed to S3 + CloudFront.
- Lambda: 7 functions (save, alexa, groups, kroger, nutrition, share, plan) behind API Gateway, authed via Cognito.
- Storage: S3 (`jaetill-meal-planner`) for recipes, plans, photos.
- Observability: Sentry browser + Sentry Lambda wrap (`@sentry/aws-serverless`), Grafana Cloud dashboard `Meal Planner - Lambda Health`.
- Deploys: GitHub Actions OIDC into `meal-planner-github-deploy` IAM role.

## How to contribute

This is a personal project. AI agents do most of the work via the `ai-team` plugin defined in [agentic-dev-environment](https://github.com/jaetill/agentic-dev-environment).