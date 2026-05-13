variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "github_repo_url" {
  type    = string
  default = "https://github.com/cyber-pnl/k8sproject.git"
}

variable "acme_email" {
  description = "Email pour Let's Encrypt"
  type        = string
}
