# Phase 6 Slice 1 import blocks - Terraform 1.5+ syntax.
# Process: add import { ... }, run tofu plan, adjust config until zero diff,
# tofu apply, then remove the import block from this file.
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
