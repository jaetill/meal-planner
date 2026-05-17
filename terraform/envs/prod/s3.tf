# jaetill-meal-planner S3 bucket — hosts the SPA + per-user save data.
# Origin for CloudFront distribution E301SUJKLJO7A7 (meals.jaetill.com).
#
# Per-bucket configurations are split into their own resources per Terraform
# AWS provider 4.x+ convention (aws_s3_bucket_*).

resource "aws_s3_bucket" "main" {
  bucket = "jaetill-meal-planner"
}

resource "aws_s3_bucket_public_access_block" "main" {
  bucket                  = aws_s3_bucket.main.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://meals.jaetill.com", "http://localhost:5173"]
    expose_headers  = ["ETag"]
  }
}

resource "aws_s3_bucket_policy" "main" {
  bucket = aws_s3_bucket.main.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.main.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${var.aws_account_id}:distribution/E301SUJKLJO7A7"
          }
        }
      }
    ]
  })
}