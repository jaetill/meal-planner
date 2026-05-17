# Phase 6 import blocks — Terraform 1.5+ `import { ... }` syntax.
# These replace the older `terraform import` CLI workflow.
#
# Process per slice:
#   1. Add the `import` block alongside the resource definition.
#   2. Run `tofu plan` — Terraform compares the existing AWS state to the
#      resource config and shows the drift.
#   3. Adjust the resource config until `tofu plan` shows zero diff
#      (or only intentional changes you want to apply).
#   4. Run `tofu apply` to commit the import to state.
#   5. Remove the `import` block from this file once stable.
#
# Slice 1 (S3 + CloudFront) — ready to plan.
# Slices 2-5 (Lambdas, IAM, API Gateway, secrets) — see README.md.

# ── Slice 1: S3 + CloudFront ────────────────────────────────────────────

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

import {
  to = aws_cloudfront_origin_access_control.main
  id = "EKC2MRJ7AU5FD"
}

import {
  to = aws_cloudfront_distribution.main
  id = "E301SUJKLJO7A7"
}