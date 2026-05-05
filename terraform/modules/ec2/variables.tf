variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "m7i.flex.large"
}

variable "key_name" {
  type    = string
  default = ""
}

variable "default_tags" {
  type    = map(string)
  default = {}
}

