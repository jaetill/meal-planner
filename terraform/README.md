# Terraform — meal-planner production environment

Phase 6 IaC retrofit per platform ADR-0007. Imports existing AWS infrastructure
into Terraform state, one slice at a time.

## Current state

**Slice 1 (S3 + CloudFront)** — applied 2026-05-17. Files: `s3.tf`, `cloudfront.tf`.

**Slice 2 (IAM)** — applied 2026-05-19. File: `iam.tf` (3 roles + 5 inline policies + 1 auto-managed policy).

**Slices 3-5** — not yet authored. See "Remaining slices" below.

## Prerequisites

- OpenTofu 1.6+ (`tofu --version`)
- AWS CLI with credentials for the 214599503944 account
- Backend bucket `jaetill-tfstate` and DynamoDB lock table `terraform-state-lock`
  exist (set up by the platform's `scripts/bootstrap-tfstate.sh` during
  game-night-pwa Phase 6 in 2026-05-10)

## First-run workflow (Slice 1)

```sh
cd terraform/envs/prod
tofu init
```

Set the missing variable before planning:

```powershell
# Look up the ACM cert ARN for meals.jaetill.com (must be in us-east-1)
aws acm list-certificates --region us-east-1 `
  --query "CertificateSummaryList[?DomainName=='meals.jaetill.com'].CertificateArn" `
  --output text

# Set as a Terraform variable
$env:TF_VAR_cloudfront_acm_cert_arn = "<arn from above>"
```

Then plan:

```sh
tofu plan -out slice1.plan
```

Expected: the `import` blocks pull the live resources into state, and the
diff shows whether the config matches reality. **Iterate until the plan
shows zero diff** (or only intentional changes).

Once happy:

```sh
tofu apply slice1.plan
```

Then remove the `import` blocks from `imports.tf` (they've done their job —
the resources are in state now).

## Remaining slices

The following resources exist in AWS but are not yet in Terraform. Each is
its own PR.

### Slice 2 — IAM roles (2 unique execution roles + GitHub deploy role)

```sh
aws iam list-roles --query "Roles[?starts_with(RoleName, 'meal-planner') || RoleName=='MealPlannerSave-role-c47ma2hi'].RoleName"
# meal-planner-noaws-role          — used by share, nutrition, kroger
# MealPlannerSave-role-c47ma2hi    — used by save, plan, alexa, groups
# meal-planner-github-deploy       — assumed by GitHub Actions OIDC
```

For each: import the role, its attached managed policies, and any inline
policies. The `MealPlannerSave-role-c47ma2hi` is an AWS-generated service
role for AWS Lambda — its name comes from the console's auto-create.

### Slice 3 — Lambda functions (7)

```sh
aws lambda list-functions --region us-east-2 \
  --query "Functions[?starts_with(FunctionName, 'meal-planner') || FunctionName=='MealPlannerSave'].FunctionName"
# meal-planner-share
# meal-planner-nutrition
# meal-planner-groups
# meal-planner-alexa
# meal-planner-kroger
# meal-planner-plan
# MealPlannerSave
```

For each: import the function. Per the game-night-pwa pattern, use
`lifecycle { ignore_changes = [filename, source_code_hash, last_modified,
environment.0.variables, layers] }` so Terraform doesn't fight the
deploy.yml's `aws lambda update-function-code` calls.

### Slice 4 — API Gateway HTTP API (`meal-planner-api`, ID `dmtezcygeb`)

```sh
aws apigatewayv2 get-routes --api-id dmtezcygeb
# Currently 3 routes: GET /kroger/products, GET /nutrition, GET /kroger/locations
# Wired to 2 Lambdas: meal-planner-kroger, meal-planner-nutrition

aws apigatewayv2 get-integrations --api-id dmtezcygeb
# 2 AWS_PROXY integrations to the above Lambdas
```

The other 5 Lambdas (share, alexa, groups, save, plan) are not exposed
through this API. They may be invoked via:
- Function URLs (check `aws lambda get-function-url-config --function-name <name>`)
- Alexa skill (meal-planner-alexa specifically)
- Direct SDK invocation from the frontend

Inventory invocation paths before this slice.

### Slice 5 — Secrets Manager + CloudWatch log groups

```sh
aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'meal-planner') || contains(Name, 'kroger') || contains(Name, 'anthropic')].Name"
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/meal-planner --query "logGroups[].logGroupName"
```

CloudWatch log groups for each Lambda are typically auto-created. Importing
them is optional — without them, Terraform creates fresh log groups on
apply (which collides with the existing ones).

## State key

`s3://jaetill-tfstate/meal-planner/prod/terraform.tfstate`

## Owner

Solo project — Jason. Apply happens on Jason's workstation after PR review;
no `tofu apply` from CI per platform Standard 08 / ADR-0007.

## Why this is a skeleton, not a full retrofit

Phase 6 IaC retrofit is intrinsically interactive — each resource's `tofu
plan` diff has to be reviewed and the config adjusted to match reality.
Doing that across 7 Lambdas + IAM + API GW + S3 + CloudFront autonomously
without a human reviewing the diffs would either produce blind drift or
take much longer than batch-importing them in slices.

This PR ships **Slice 1 (S3 + CloudFront)** as a working example. Subsequent
slices follow the same pattern, one PR each.