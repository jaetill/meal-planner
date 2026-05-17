# Remote state per platform Standard 08 / ADR-0007.
# State backend bootstrapped under jaetill-tfstate per game-night-pwa precedent.

terraform {
  required_version = ">= 1.6"

  backend "s3" {
    bucket         = "jaetill-tfstate"
    key            = "meal-planner/prod/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}