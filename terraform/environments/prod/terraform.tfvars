# terraform/environments/prod/terraform.tfvars
aws_region               = "us-west-2"
environment              = "prod"
vpc_cidr                 = "10.0.0.0/16"
k3s_server_instance_type = "m7i-flex.large"

project_name = "k8sproject"

