variable "project_name" {
  type        = string
  description = "Project slug used in tags and resource names."
  default     = "meal-planner"
}

variable "env" {
  type        = string
  description = "Deployment environment label."
  default     = "prod"
}

variable "aws_region" {
  type        = string
  description = "AWS region for this environment."
  default     = "us-east-2"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account ID."
  default     = "214599503944"
}

variable "cloudfront_acm_cert_arn" {
  type        = string
  description = "ACM certificate ARN for meals.jaetill.com (must be in us-east-1 for CloudFront)."
  # Pulled at first import: aws acm list-certificates --region us-east-1
  # TODO: set after running `aws acm list-certificates --region us-east-1`
  default     = "arn:aws:acm:us-east-1:214599503944:certificate/e0222a7e-ef94-4b0a-9bed-7b3de6dc0dd3"
}