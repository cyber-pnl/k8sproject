terraform {
  backend "s3" {
    bucket       = "k3sproject-tfstate" # Create this bucket manually
    key          = "prod/terraform.tfstate"
    region       = "us-west-2"
    use_lockfile = true # Create DynamoDB table
    encrypt      = true
  }
}
