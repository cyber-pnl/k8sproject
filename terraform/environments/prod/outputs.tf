output "vpc_id" {
  value = module.networking.vpc_id
}

output "k3s_public_ip" {
  value       = module.ec2_k3s.ec2_public_ip
  description = "IP publique de l'EC2 k3s"
}

output "kubeconfig_command" {
  value       = module.ec2_k3s.kubeconfig_command
  description = "Commande pour récupérer le kubeconfig"
}

output "argocd_url" {
  value       = "https://${module.ec2_k3s.ec2_public_ip}:30080"
  description = "URL ArgoCD (NodePort)"
}

output "ssh_command" {
  value       = "ssh -i ${var.key_name}.pem ec2-user@${module.ec2_k3s.ec2_public_ip}"
  description = "Commande SSH"
}
