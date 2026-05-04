terraform {
  backend "s3" {
    bucket         = "k3sproject-tfstate"  # Create this bucket manually
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "k3sproject-tfstate-lock"  # Create DynamoDB table
    encrypt        = true
  }
}
