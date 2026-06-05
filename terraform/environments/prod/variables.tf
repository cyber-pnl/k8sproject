variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "k3s_server_instance_type" {
  description = "EC2 instance type pour le noeud k3s"
  type        = string
  default     = "t3.medium"
}

variable "project_name" {
  description = "Nom du projet"
  type        = string
}

variable "environment" {
  description = "Environnement (prod/dev)"
  type        = string
}

variable "default_tags" {
  description = "Tags par défaut"
  type        = map(string)
  default     = {}
}

variable "key_name" {
  description = "EC2 Key Pair name (optionnel si tu utilises SSM)"
  type        = string
  default     = ""
}

variable "github_repo_url" {
  description = "URL du repo GitHub pour ArgoCD"
  type        = string
  default     = "https://github.com/cyber-pnl/k8sproject.git"
}

variable "acme_email" {
  description = "Email pour Let's Encrypt cert-manager"
  type        = string
}
