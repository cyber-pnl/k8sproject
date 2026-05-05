output "vpc_id" {
  value = module.networking.vpc_id
}

output "k3s_public_ip" {
  value = module.ec2_k3s.ec2_public_ip
}
