provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(
      var.default_tags,
      {
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "Terraform"
      }
    )
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}