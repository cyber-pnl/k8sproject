data "aws_caller_identity" "current" {}

# ── Bucket de contenu des cours (privé) ──────────────────────────
resource "aws_s3_bucket" "content" {
  bucket = "${var.project_name}-content-${var.environment}-${data.aws_caller_identity.current.account_id}"
  tags   = var.default_tags
}

resource "aws_s3_bucket_versioning" "content" {
  bucket = aws_s3_bucket.content.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Le contenu des cours est privé : seul course-service y accède via le IAM user
resource "aws_s3_bucket_public_access_block" "content" {
  bucket = aws_s3_bucket.content.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── IAM user dédié au contenu des cours (creds injectées via le Secret k8s s3-secret) ──
resource "aws_iam_user" "content" {
  name = "${var.project_name}-content-${var.environment}"
  path = "/"
  tags = var.default_tags
}

resource "aws_iam_user_policy" "content_s3" {
  name = "kubelearn-content-s3-access"
  user = aws_iam_user.content.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListContentBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.content.arn]
      },
      {
        Sid      = "ContentObjectAccess"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.content.arn}/*"]
      }
    ]
  })
}

resource "aws_iam_access_key" "content" {
  user = aws_iam_user.content.name
}