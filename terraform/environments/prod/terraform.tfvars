                    # terraform/environments/prod/terraform.tfvars
aws_region= "us-west-2"
environment             = "prod"
vpc_cidr                = "10.0.0.0/16"
k3s_server_instance_type = "t3.medium"
k3s_agent_instance_type  = "t3.small"
k3s_server_asg_min      = 3
k3s_agent_asg_min       = 2

key_name = ""
project_name = "k8sproject"

