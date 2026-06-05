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

# Sauvegarde la clé privée dans un fichier local pour le tunnel automatique
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
  
  key_name      = aws_key_pair.k3s_key_pair.key_name
  
  default_tags  = local.default_tags
}

# ── 3. ATTENDRE QUE L'API K3S ET ARGOCD SOIENT PRÊTS ─────────
resource "null_resource" "wait_for_k3s" {
  depends_on = [module.ec2_k3s]

  provisioner "local-exec" {
    command = "until nc -zv ${module.ec2_k3s.ec2_public_ip} 6443; do echo 'Waiting for K3s API and Bootstrap to finish...'; sleep 5; done"
  }
}

# ── 4. AUTOMATISATION DU TUNNEL ET DU PORT-FORWARD ─────────
resource "null_resource" "auto_argocd_tunnel" {
  # On attend que K3s réponde ET que la clé .pem soit bien écrite sur ton disque
  depends_on = [null_resource.wait_for_k3s, local_file.ssh_key_file]

  provisioner "local-exec" {
    command = <<EOT
      echo " Initialisation automatique du tunnel SSH et du port-forward ArgoCD..."
      
      # Lancement du tunnel en tâche de fond (-f -N)
      # -o StrictHostKeyChecking=no empêche SSH de bloquer en attendant une validation manuelle
      ssh -i ${local_file.ssh_key_file.filename} \
          -f -N \
          -L 8080:localhost:8080 \
          -o StrictHostKeyChecking=no \
          ec2-user@${module.ec2_k3s.ec2_public_ip} \
          "sudo kubectl port-forward svc/argocd-server -n argocd 8080:443 --address 0.0.0.0"

      echo "====================================================================="
      echo " LE TUNNEL SSH EST OPÉRATIONNEL EN TÂCHE DE FOND !"
      echo " Ouvre ton navigateur sur ton PC : https://localhost:8080"
      echo "====================================================================="
    EOT
  }
}