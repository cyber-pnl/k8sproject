data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  project_name      = var.project_name
  environment       = var.environment
  default_tags      = var.default_tags
}

module "networking" {
  source = "../../modules/networking"

  vpc_cidr     = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  project_name = local.project_name
  environment  = local.environment
  default_tags = local.default_tags
}

module "ec2_k3s" {
  source = "../../modules/ec2"

  project_name    = local.project_name
  environment     = local.environment
  vpc_id          = module.networking.vpc_id
  subnet_id       = module.networking.public_subnets[0]
  instance_type   = var.k3s_server_instance_type
  key_name        = var.key_name
  default_tags    = local.default_tags
}

