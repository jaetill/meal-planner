# Phase 6 Slice 1 import blocks — Terraform 1.5+ syntax.
# Process: add import { ... }, run `tofu plan`, adjust config until zero diff,
# `tofu apply`, then remove the import block.
#
# CloudFront imports are temporarily disabled below — the jaetill-dev IAM user
# is missing `cloudfront:ListTagsForResource`, which Terraform requires when
# importing aws_cloudfront_distribution. Fix:
#   aws iam put-user-policy --user-name jaetill-dev --policy-name TerraformCloudFront `
#     --policy-document '{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"cloudfront:ListTagsForResource\",\"cloudfront:GetOriginAccessControl\",\"cloudfront:GetDistribution\",\"cloudfront:GetDistributionConfig\"],\"Resource\":\"*\"}]}'
# Then uncomment the two CloudFront imports below and re-plan.

import {
  to = aws_s3_bucket.main
  id = "jaetill-meal-planner"
}

import {
  to = aws_s3_bucket_public_access_block.main
  id = "jaetill-meal-planner"
}

import {
  to = aws_s3_bucket_cors_configuration.main
  id = "jaetill-meal-planner"
}

import {
  to = aws_s3_bucket_policy.main
  id = "jaetill-meal-planner"
}

# Pending IAM fix above:
# import {
#   to = aws_cloudfront_origin_access_control.main
#   id = "EKC2MRJ7AU5FD"
# }
#
# import {
#   to = aws_cloudfront_distribution.main
#   id = "E301SUJKLJO7A7"
# }