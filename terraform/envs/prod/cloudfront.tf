# CloudFront distribution E301SUJKLJO7A7 fronting the meal-planner SPA bucket.
# Origin Access Control EKC2MRJ7AU5FD restricts S3 access to this distribution.

resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "meal-planner-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
  description                       = "OAC for meals.jaetill.com"
}

resource "aws_cloudfront_distribution" "main" {
  enabled         = true
  comment         = "meal-planner"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true
  aliases         = ["meals.jaetill.com"]

  origin {
    domain_name              = aws_s3_bucket.main.bucket_regional_domain_name
    origin_id                = "s3-meal-planner"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-meal-planner"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  viewer_certificate {
    # ACM cert ARN for meals.jaetill.com — must exist in us-east-1 for CloudFront.
    # TODO Jason: confirm ACM cert ARN here; placeholder uses default.
    cloudfront_default_certificate = false
    acm_certificate_arn            = var.cloudfront_acm_cert_arn
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }


  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Lambda code deploys + invalidations are managed outside Terraform.
  lifecycle {
    ignore_changes = [origin]
  }
}