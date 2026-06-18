# CloudFront distribution E301SUJKLJO7A7 fronting the meal-planner SPA bucket.
# Origin Access Control EKC2MRJ7AU5FD restricts S3 access to this distribution.
#
# Cache policies (AWS-managed) referenced by ID:
#   4135ea2d-6df8-44a3-9df3-4b5a84be39ad = Managed-CachingOptimized
#   658327ea-f89d-4fab-a63d-7e88639e58f6 = Managed-CachingOptimizedForUncompressedObjects
#   5cc3b908-e619-4b99-88e5-2cf7f45965bd = response headers policy (project-specific)
#
# deny_feedback_contacts — CloudFront Function that returns 403 at the edge for
# feedback-contacts/* before the request reaches the origin. Complements the
# explicit-deny bucket policy statement (s3.tf) added in #121: using a CF Function
# here ensures the client receives a genuine HTTP 403 rather than the SPA fallback
# (the custom_error_response 403→200/index.html transform applies only to origin
# errors, not to CF-generated responses).

resource "aws_cloudfront_function" "deny_feedback_contacts" {
  name    = "meal-planner-deny-feedback-contacts"
  runtime = "cloudfront-js-2.0"
  comment = "Block public read of feedback-contacts/ — email PII prefix (issue #120)"
  publish = true
  code    = "function handler(event) { return { statusCode: 403, statusDescription: 'Forbidden' }; }"
}

resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "meal-planner-oac"
  description                       = "OAC for meals.jaetill.com"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  comment             = "meal-planner"
  price_class         = "PriceClass_100"
  is_ipv6_enabled     = true
  aliases             = ["meals.jaetill.com"]
  default_root_object = "index.html"
  http_version        = "http2and3"

  origin {
    domain_name              = aws_s3_bucket.main.bucket_regional_domain_name
    origin_id                = "s3-meal-planner"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  default_cache_behavior {
    target_origin_id           = "s3-meal-planner"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    response_headers_policy_id = "5cc3b908-e619-4b99-88e5-2cf7f45965bd"
  }

  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "s3-meal-planner"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  ordered_cache_behavior {
    path_pattern           = "feedback-contacts/*"
    target_origin_id       = "s3-meal-planner"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.deny_feedback_contacts.arn
    }
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

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = var.cloudfront_acm_cert_arn
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Origin updates (cert rotation, S3 bucket changes) handled outside Terraform
  # to avoid churning the distribution on routine deploys.
  lifecycle {
    ignore_changes = [origin]
  }
}