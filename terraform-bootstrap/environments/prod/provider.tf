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

# Ces providers sont configurés APRÈS que l'EC2 soit up
# Ils lisent le kubeconfig depuis SSM Parameter Store
provider "kubernetes" {
  host                   = "https://${module.ec2_k3s.ec2_public_ip}:6443"
  cluster_ca_certificate = base64decode(module.ec2_k3s.cluster_ca_certificate)
  token                  = module.ec2_k3s.k3s_token
}

provider "helm" {
  kubernetes {
    host                   = "https://${module.ec2_k3s.ec2_public_ip}:6443"
    cluster_ca_certificate = base64decode(module.ec2_k3s.cluster_ca_certificate)
    token                  = module.ec2_k3s.k3s_token
  }
}

provider "kubectl" {
  host                   = "https://${module.ec2_k3s.ec2_public_ip}:6443"
  cluster_ca_certificate = base64decode(module.ec2_k3s.cluster_ca_certificate)
  token                  = module.ec2_k3s.k3s_token
  load_config_file       = false
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
