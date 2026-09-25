variable "project_name" {
  description = "Nom du projet"
  type        = string
}

variable "environment" {
  description = "Environnement (prod/dev)"
  type        = string
}

variable "default_tags" {
  description = "Tags par défaut"
  type        = map(string)
}