# Slice 5: Secrets Manager + CloudWatch log groups
#
# Secret values are NOT managed by Terraform — only the secret container.
# Rotate values via aws secretsmanager update-secret in operations runbooks.

# ── Legacy bundled secret (deprecated — retire after migration to per-service secrets) ──
resource "aws_secretsmanager_secret" "main" {
  name = "meal-planner/secrets"
}

# ── Per-service secrets (issue #47 — least-privilege isolation) ──────────────
# Populate values before running `tofu apply` that updates Lambda role assignments:
#   aws secretsmanager put-secret-value --secret-id meal-planner/anthropic \
#     --secret-string '{"ANTHROPIC_API_KEY":"...","USDA_API_KEY":"..."}'
#   aws secretsmanager put-secret-value --secret-id meal-planner/kroger \
#     --secret-string '{"KROGER_CLIENT_ID":"...","KROGER_CLIENT_SECRET":"..."}'
#   aws secretsmanager put-secret-value --secret-id meal-planner/postmark \
#     --secret-string '{"POSTMARK_API_KEY":"..."}'

resource "aws_secretsmanager_secret" "anthropic" {
  name        = "meal-planner/anthropic"
  description = "Anthropic + USDA API keys — nutrition, save, plan lambdas"
}

resource "aws_secretsmanager_secret" "kroger_secret" {
  name        = "meal-planner/kroger"
  description = "Kroger API client credentials — kroger lambda"
}

resource "aws_secretsmanager_secret" "postmark" {
  name        = "meal-planner/postmark"
  description = "Postmark API key — share lambda"
}

# ============================================================================
# CloudWatch log groups - one per Lambda (auto-created on first invocation;
# managing here so retention can be set explicitly per ADR-0009 §1).
# Existing groups have no retention; setting "0" preserves that. Adjust to 7
# (dev) / 30 (staging) / 90 (prod) per platform Standard 06 when ready.
# ============================================================================

resource "aws_cloudwatch_log_group" "groups" {
  name              = "/aws/lambda/meal-planner-groups"
  retention_in_days = 0

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_cloudwatch_log_group" "kroger" {
  name              = "/aws/lambda/meal-planner-kroger"
  retention_in_days = 0

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_cloudwatch_log_group" "nutrition" {
  name              = "/aws/lambda/meal-planner-nutrition"
  retention_in_days = 0

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_cloudwatch_log_group" "plan" {
  name              = "/aws/lambda/meal-planner-plan"
  retention_in_days = 0

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_cloudwatch_log_group" "share" {
  name              = "/aws/lambda/meal-planner-share"
  retention_in_days = 0

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_cloudwatch_log_group" "save" {
  name              = "/aws/lambda/MealPlannerSave"
  retention_in_days = 0

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

# GitHub PAT for feedback Lambda - value set externally via aws CLI:
#   aws secretsmanager put-secret-value --secret-id meal-planner/github-token \
#     --secret-string '{"GITHUB_TOKEN":"ghp_..."}'
# PAT needs: repo scope (specifically: issues:write on jaetill/meal-planner).
resource "aws_secretsmanager_secret" "github_token" {
  name        = "meal-planner/github-token"
  description = "GitHub PAT used by feedback Lambda to file user-feedback issues"
}

# NOTE: aws_cloudwatch_log_group for feedback omitted - jaetill-dev lacks logs:CreateLogGroup.
# Lambda auto-creates the log group on first invocation; can be imported later.
