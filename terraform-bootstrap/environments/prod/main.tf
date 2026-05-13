data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  project_name = var.project_name
  environment  = var.environment
  default_tags = var.default_tags
}

# ── 1. RÉSEAU ──────────────────────────────────────────────
module "networking" {
  source = "../../modules/networking"

  vpc_cidr           = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  project_name       = local.project_name
  environment        = local.environment
  default_tags       = local.default_tags
}

# ── 2. EC2 + K3S (minimal user-data, juste installer k3s) ──
module "ec2_k3s" {
  source = "../../modules/ec2"

  depends_on = [module.networking] 
  project_name  = local.project_name
  environment   = local.environment
  vpc_id        = module.networking.vpc_id
  subnet_id     = module.networking.public_subnets[0]
  instance_type = var.k3s_server_instance_type
  key_name      = var.key_name
  default_tags  = local.default_tags
}

# ── 3. ATTENDRE QUE K3S SOIT PRÊT ──────────────────────────
resource "null_resource" "wait_for_k3s" {
  depends_on = [module.ec2_k3s]

  provisioner "local-exec" {
    command = "until nc -zv ${module.ec2_k3s.ec2_public_ip} 6443; do echo 'Waiting for K3s...'; sleep 5; done"
  }
}

# ── 4. BOOTSTRAP KUBERNETES ────────────────────────────────
module "k8s_bootstrap" {
  source = "../../modules/k8s-bootstrap"

  depends_on = [null_resource.wait_for_k3s]

  project_name    = local.project_name
  environment     = local.environment
  github_repo_url = var.github_repo_url
  acme_email      = var.acme_email
}
