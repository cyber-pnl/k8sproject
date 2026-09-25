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

output "content_bucket_name" {
  value       = module.content_s3.bucket_name
  description = "Bucket S3 du contenu des cours"
}

output "content_s3_access_key_id" {
  value       = module.content_s3.access_key_id
  description = "Access key ID (Secret k8s s3-secret)"
}

output "content_s3_secret_access_key" {
  value       = module.content_s3.secret_access_key
  sensitive   = true
  description = "Secret access key (Secret k8s s3-secret) — sensible"
}
