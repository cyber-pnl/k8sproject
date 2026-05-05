output "instance_id" {
  value = aws_instance.k3s_server.id
}

output "ec2_public_ip" {
  value = aws_instance.k3s_server.public_ip
}

output "kubeconfig_command" {
  value = "ssh -i key.pem ec2-user@${aws_instance.k3s_server.public_ip} sudo cat /etc/rancher/k3s/k3s.yaml"
}

