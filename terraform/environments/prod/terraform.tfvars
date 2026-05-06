# terraform/environments/prod/terraform.tfvars
aws_region               = "us-west-2"
environment              = "prod"
vpc_cidr                 = "10.0.0.0/16"
k3s_server_instance_type = "m7i-flex.large"
k3s_agent_instance_type  = "t3.small"
k3s_server_asg_min       = 1
k3s_agent_asg_min        = 1

project_name = "k8sproject"

