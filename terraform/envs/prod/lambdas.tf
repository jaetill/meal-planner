# 7 Lambda functions making up the meal-planner backend.
#
# Each resource uses lifecycle.ignore_changes for filename/source_code_hash so
# `tofu apply` doesn't fight the manual `aws lambda update-function-code`
# deploys in .github/workflows/deploy.yml.
#
# Roles defined in iam.tf:
#   - aws_iam_role.nutrition_fn : meal-planner-nutrition-role (nutrition)
#   - aws_iam_role.kroger_fn    : meal-planner-kroger-role (kroger)
#   - aws_iam_role.share_fn     : meal-planner-share-role (share)
#   - aws_iam_role.save         : MealPlannerSave-role-c47ma2hi (groups, alexa, plan, save)

resource "aws_lambda_function" "share" {
  function_name = "meal-planner-share"
  role          = aws_iam_role.share_fn.arn
  handler       = "share.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 3

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = merge(local.observability_env, {
      FROM_EMAIL = "jason@jaetill.com"
    })
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "nutrition" {
  function_name = "meal-planner-nutrition"
  role          = aws_iam_role.nutrition_fn.arn
  handler       = "nutrition.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 30

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = local.observability_env
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "kroger" {
  function_name = "meal-planner-kroger"
  role          = aws_iam_role.kroger_fn.arn
  handler       = "kroger.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 3

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = local.observability_env
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "groups" {
  function_name = "meal-planner-groups"
  role          = aws_iam_role.save.arn
  handler       = "groups.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 3

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = local.observability_env
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "alexa" {
  function_name = "meal-planner-alexa"
  role          = aws_iam_role.save.arn
  handler       = "alexa.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 10

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = merge(local.observability_env, {
      ALEXA_USERNAME = "jaetill"
    })
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "plan" {
  function_name = "meal-planner-plan"
  role          = aws_iam_role.save.arn
  handler       = "plan.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 90

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = local.observability_env
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "save" {
  function_name = "MealPlannerSave"
  role          = aws_iam_role.save.arn
  handler       = "save.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 30

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = local.observability_env
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "feedback" {
  function_name = "meal-planner-feedback"
  role          = aws_iam_role.feedback.arn
  handler       = "feedback.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 256
  timeout       = 10

  filename = "${path.module}/placeholder.zip"

  environment {
    variables = merge(local.observability_env, {
      GITHUB_REPO_OWNER = "jaetill"
      GITHUB_REPO_NAME  = "meal-planner"
      GITHUB_SECRET_ID  = "meal-planner/github-token"
    })
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}