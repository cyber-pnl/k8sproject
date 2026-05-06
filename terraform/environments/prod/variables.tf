variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "k3s_server_instance_type" {
  type    = string
}

variable "k3s_agent_instance_type" {
  type    = string
}

variable "k3s_server_asg_min" {
  type    = number
}

variable "k3s_agent_asg_min" {
  type    = number

  validation {
    condition     = var.k3s_agent_asg_min >= 1
    error_message = "Minimum 1 agent node."
  }
}

variable "project_name" {
  type    = string
}

variable "environment" {
  type = string
}

variable "default_tags" {
  description = "Default tags"
  type        = map(string)
  default     = {}
}

variable "key_name" {
  description = "EC2 Key Pair name"
  type        = string
  default     = ""
}

