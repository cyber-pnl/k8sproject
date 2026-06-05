output "instance_id" {
  value = aws_instance.k3s_server.id
}

output "ec2_public_ip" {
  value = aws_instance.k3s_server.public_ip
}

output "kubeconfig_command" {
  value = "ssh -i ${var.key_name}.pem ec2-user@${aws_instance.k3s_server.public_ip}"
}

output "k3s_token" {
  value     = data.aws_ssm_parameter.k3s_token.value
  sensitive = true
}

output "cluster_ca_certificate" {
  value     = data.aws_ssm_parameter.k3s_ca.value
  sensitive = true
}
