# Slice 2: IAM
#
# 3 roles:
#   - meal-planner-noaws-role        (used by share, nutrition, kroger)
#   - MealPlannerSave-role-c47ma2hi  (used by save, plan, alexa, groups; path /service-role/)
#   - meal-planner-github-deploy     (OIDC trust for GitHub Actions)
#
# 5 inline role policies + 1 auto-generated customer-managed policy
# (AWSLambdaBasicExecutionRole-acdb24f8-...) attached to the Save role.

# ── Shared trust policy for Lambda execution roles ──────────────────────
data "aws_iam_policy_document" "lambda_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ── Execution roles ──────────────────────────────────────────────────────

resource "aws_iam_role" "noaws" {
  name               = "meal-planner-noaws-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

resource "aws_iam_role" "save" {
  name               = "MealPlannerSave-role-c47ma2hi"
  path               = "/service-role/"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

# ── GitHub Actions OIDC deploy role ──────────────────────────────────────

resource "aws_iam_role" "github_deploy" {
  name        = "meal-planner-github-deploy"
  description = "GitHub Actions OIDC role for meal-planner CI/CD"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = "arn:aws:iam::${var.aws_account_id}:oidc-provider/token.actions.githubusercontent.com" }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:sub" = "repo:jaetill/meal-planner:environment:production"
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

# ── Inline policies on the noaws role ────────────────────────────────────

resource "aws_iam_role_policy" "noaws_logs_only" {
  name = "meal-planner-logs-only"
  role = aws_iam_role.noaws.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "logs:CreateLogGroup"
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"
      },
      {
        Effect = "Allow"
        Action = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-nutrition:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-kroger:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-share:*",
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "noaws_secrets" {
  name = "meal-planner-secrets-access"
  role = aws_iam_role.noaws.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:meal-planner/secrets-WnfBUU"
      }
    ]
  })
}

# ── Inline policies on the Save role ─────────────────────────────────────

resource "aws_iam_role_policy" "save_s3" {
  name = "meal-planner-s3-access"
  role = aws_iam_role.save.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "arn:aws:s3:::jaetill-meal-planner/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "save_secrets" {
  name = "meal-planner-secrets-access"
  role = aws_iam_role.save.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:meal-planner/secrets-WnfBUU"
      }
    ]
  })
}

# ── Inline policy on the github-deploy role ──────────────────────────────

resource "aws_iam_role_policy" "github_deploy" {
  name = "deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::jaetill-meal-planner"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "arn:aws:s3:::jaetill-meal-planner/*"
      },
      {
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = "arn:aws:cloudfront::${var.aws_account_id}:distribution/E301SUJKLJO7A7"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:UpdateFunctionConfiguration",
        ]
        Resource = [
          "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:MealPlannerSave",
          "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:meal-planner-alexa",
          "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:meal-planner-groups",
          "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:meal-planner-nutrition",
          "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:meal-planner-kroger",
          "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:meal-planner-share",
          "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:meal-planner-plan",
          "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:meal-planner-feedback",
        ]
      }
    ]
  })
}

# ── Auto-generated AWSLambdaBasicExecutionRole policy on the Save role ──
# AWS Lambda console auto-created this when the Save function was first deployed.
# Imported here to keep its existing name (the random suffix) stable.

resource "aws_iam_policy" "save_basic_exec" {
  name = "AWSLambdaBasicExecutionRole-acdb24f8-51a5-4a00-9ddd-a2dc51abc0cb"
  path = "/service-role/"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "logs:CreateLogGroup"
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"
      },
      {
        Effect = "Allow"
        Action = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/MealPlannerSave:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-groups:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-nutrition:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-kroger:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-alexa:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-share:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-plan:*",
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "save_basic_exec" {
  role       = aws_iam_role.save.name
  policy_arn = aws_iam_policy.save_basic_exec.arn
}

# ── feedback Lambda execution role ────────────────────────────────────────

resource "aws_iam_role" "feedback" {
  name               = "meal-planner-feedback-role"
  description        = "Execution role for feedback Lambda (Standard 11)"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

resource "aws_iam_role_policy" "feedback_logs" {
  name = "logs"
  role = aws_iam_role.feedback.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "logs:CreateLogGroup"
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/meal-planner-feedback:*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "feedback_secrets" {
  name = "github-token-access"
  role = aws_iam_role.feedback.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = aws_secretsmanager_secret.github_token.arn
      }
    ]
  })
}