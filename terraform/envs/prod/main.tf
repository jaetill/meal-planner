# Production environment for meal-planner.
#
# Phase 6 retrofit per platform ADR-0007. Imports existing AWS infrastructure
# into Terraform state. Resources are imported one slice at a time; each slice
# is reviewed and merged after `tofu plan` shows zero diff.
#
# Layout:
#   backend.tf    — S3 + DynamoDB remote state
#   providers.tf  — AWS provider + default tags
#   variables.tf  — region / account / env names
#   imports.tf    — `import { ... }` blocks (remove once resources are stable)
#   s3.tf         — jaetill-meal-planner bucket
#   cloudfront.tf — distribution E301SUJKLJO7A7
#   lambdas.tf    — 7 Lambda functions
#   iam.tf        — execution roles + GitHub deploy role
#   apigw.tf      — meal-planner-api HTTP API + routes + integrations
#
# Lambda CODE is NOT managed by Terraform — only function metadata.
# `aws lambda update-function-code` deploys remain in deploy.yml. Each
# aws_lambda_function uses `lifecycle { ignore_changes = [filename,
# source_code_hash, last_modified] }` so Terraform doesn't fight the
# deploy pipeline.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}