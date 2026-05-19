# Slice 5: Secrets Manager + CloudWatch log groups
#
# Secret values are NOT managed by Terraform — only the secret container.
# Rotate values via aws secretsmanager update-secret in operations runbooks.

resource "aws_secretsmanager_secret" "main" {
  name = "meal-planner/secrets"
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
