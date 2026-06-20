# ADR-0035 — read-only OIDC role for the iac-additive-guard.
#
# Plans terraform/envs/prod on PRs (and is available for a future drift
# detector) using a scoped inline plan-read-only policy + tfstate read.
# Trust gates assume-role on this repo's GitHub OIDC for the default branch
# (master) and pull_request.
# Created out-of-band 2026-06-05 (platform #280) and imported here so it is
# Terraform-managed. Mirrors game-night-pwa's iac_drift role.

resource "aws_iam_role" "iac_drift" {
  name               = "meal-planner-iac-drift"
  assume_role_policy = data.aws_iam_policy_document.iac_drift_trust.json
  description        = "Read-only OIDC role for the ADR-0035 iac-additive-guard (plan PR branches). Trusts master + pull_request."
}

data "aws_iam_policy_document" "iac_drift_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::${var.aws_account_id}:oidc-provider/token.actions.githubusercontent.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:jaetill/meal-planner:ref:refs/heads/master",
        "repo:jaetill/meal-planner:pull_request",
      ]
    }
  }
}

# Scoped plan-only policy: describe/list actions Terraform needs to run
# `tofu plan`. Excludes s3:GetObject and secretsmanager:GetSecretValue so
# PR workflows (public repo + OIDC) cannot read user data or secret values.
data "aws_iam_policy_document" "iac_drift_plan" {
  statement {
    sid     = "IAMRead"
    effect  = "Allow"
    actions = [
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListPolicyVersions",
      "iam:ListRolePolicies",
      "iam:ListRoleTags",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "LambdaRead"
    effect    = "Allow"
    actions   = ["lambda:ListFunctions"]
    resources = ["*"]
  }

  statement {
    sid       = "APIGatewayRead"
    effect    = "Allow"
    actions   = ["apigateway:GET"]
    resources = ["*"]
  }

  statement {
    sid     = "CloudFrontRead"
    effect  = "Allow"
    actions = [
      "cloudfront:GetDistribution",
      "cloudfront:GetDistributionConfig",
      "cloudfront:GetOriginAccessControl",
      "cloudfront:ListDistributions",
      "cloudfront:ListOriginAccessControls",
    ]
    resources = ["*"]
  }

  statement {
    sid     = "S3BucketMetaRead"
    effect  = "Allow"
    actions = [
      "s3:GetBucketCORS",
      "s3:GetBucketLocation",
      "s3:GetBucketObjectLockConfiguration",
      "s3:GetBucketPolicy",
      "s3:GetBucketPolicyStatus",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetBucketRequestPayment",
      "s3:GetBucketTagging",
      "s3:GetBucketVersioning",
      "s3:GetBucketWebsite",
      "s3:GetEncryptionConfiguration",
      "s3:GetLifecycleConfiguration",
      "s3:GetReplicationConfiguration",
      "s3:ListAllMyBuckets",
      "s3:ListBucket",
    ]
    resources = ["*"]
  }

  statement {
    sid     = "SecretsManagerDescribe"
    effect  = "Allow"
    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecrets",
      "secretsmanager:ListSecretVersionIds",
    ]
    resources = ["*"]
  }

  statement {
    sid     = "CloudWatchLogsRead"
    effect  = "Allow"
    actions = [
      "logs:DescribeLogGroups",
      "logs:ListTagsForResource",
      "logs:ListTagsLogGroup",
    ]
    resources = ["*"]
  }

  # Explicit belt-and-suspenders deny: overrides any future accidental Allow on
  # s3:GetObject in this role, ensuring user data is never readable via OIDC.
  statement {
    sid       = "DenyUserDataBucketRead"
    effect    = "Deny"
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::jaetill-meal-planner/*"]
  }
}

resource "aws_iam_role_policy" "iac_drift_plan" {
  name   = "plan-read-only"
  role   = aws_iam_role.iac_drift.id
  policy = data.aws_iam_policy_document.iac_drift_plan.json
}

data "aws_iam_policy_document" "iac_drift_tfstate" {
  statement {
    sid       = "TFStateRead"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = ["arn:aws:s3:::jaetill-tfstate", "arn:aws:s3:::jaetill-tfstate/*"]
  }
  statement {
    sid       = "TFStateLockRead"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem"]
    resources = ["arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/terraform-state-lock"]
  }
}

resource "aws_iam_role_policy" "iac_drift_tfstate" {
  name   = "tfstate-access"
  role   = aws_iam_role.iac_drift.id
  policy = data.aws_iam_policy_document.iac_drift_tfstate.json
}