data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  project_name = var.project_name
  environment  = var.environment
  default_tags = var.default_tags
}

# ── 0. GÉNÉRATION DE LA CLÉ SSH AUTOMATIQUE ─────────────────
# Génère une clé privée RSA de 4096 bits en mémoire
resource "tls_private_key" "ec2_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Crée la Key Pair sur AWS avec la clé publique générée
resource "aws_key_pair" "k3s_key_pair" {
  key_name   = "${local.project_name}-${local.environment}-ssh-key"
  public_key = tls_private_key.ec2_key.public_key_openssh
  tags       = local.default_tags
}

# Sauvegarde la clé privée dans un fichier local pour tes connexions futures
resource "local_file" "ssh_key_file" {
  content         = tls_private_key.ec2_key.private_key_pem
  filename        = "${path.module}/${local.project_name}-key.pem"
  file_permission = "0400" # Configure automatiquement les droits en lecture seule
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

# ── 2. EC2 + K3S (Installe K3s, Helm, Cert-Manager et ArgoCD) ──
module "ec2_k3s" {
  source = "../../modules/ec2"

  depends_on = [module.networking] 
  
  project_name  = local.project_name
  environment   = local.environment
  vpc_id        = module.networking.vpc_id
  subnet_id     = module.networking.public_subnets[0]
  instance_type = var.k3s_server_instance_type
  
  # MODIFICATION ICI : On passe le nom de la Key Pair générée dynamiquement
  key_name      = aws_key_pair.k3s_key_pair.key_name
  
  default_tags  = local.default_tags
}

# ── 3. ATTENDRE QUE L'API K3S ET ARGOCD SOIENT PRÊTS ─────────
resource "null_resource" "wait_for_k3s" {
  depends_on = [module.ec2_k3s]

  provisioner "local-exec" {
    # On utilise nc (netcat) pour s'assurer que le port 6443 répond depuis Internet
    command = "until nc -zv ${module.ec2_k3s.ec2_public_ip} 6443; do echo 'Waiting for K3s API and Bootstrap to finish...'; sleep 5; done"
  }
}