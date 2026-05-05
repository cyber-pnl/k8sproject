variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "k3sproject"
}

variable "environment" {
  description = "Environment (dev/prod)"
  type        = string
}

variable "default_tags" {
  description = "Default tags"
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "k3s_server_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "k3s_agent_instance_type" {
  type    = string
  default = "t3.small"
}

variable "k3s_server_asg_min" {
  type    = number
  default = 3
}

variable "k3s_agent_asg_min" {
  type    = number
  default = 2
}
