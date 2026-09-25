output "bucket_name" {
  description = "Nom du bucket S3 du contenu des cours"
  value       = aws_s3_bucket.content.id
}

output "bucket_arn" {
  description = "ARN du bucket S3 du contenu des cours"
  value       = aws_s3_bucket.content.arn
}

output "iam_user_name" {
  description = "Nom du IAM user d'accès au contenu"
  value       = aws_iam_user.content.name
}

output "access_key_id" {
  description = "Access key ID (Secret k8s s3-secret)"
  value       = aws_iam_access_key.content.id
}

output "secret_access_key" {
  description = "Secret access key (Secret k8s s3-secret) — sensible"
  value       = aws_iam_access_key.content.secret
  sensitive   = true
}