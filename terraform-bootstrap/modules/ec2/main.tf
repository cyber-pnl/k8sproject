resource "aws_security_group" "k3s" {
  name_prefix = "${var.project_name}-k3s-sg-${var.environment}-"
  vpc_id      = var.vpc_id

  ingress {
    description = "K3s API"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "NodePorts"
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH uniquement si key_name fourni
  dynamic "ingress" {
    for_each = var.key_name != "" ? [1] : []
    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.default_tags, {
    Name = "${var.project_name}-k3s-sg-${var.environment}"
  })
}

data "aws_ami" "amazon_linux" {
  most_recent = true

  filter {
    name   = "name"
    values = ["al2023-ami-*-kernel-6.1-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["amazon"]
}

# ── IAM ────────────────────────────────────────────────────

resource "aws_iam_role" "ec2_k3s" {
  name = "${var.project_name}-ec2-k3s-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = var.default_tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2_k3s.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "k3s_custom" {
  name = "${var.project_name}-k3s-custom-${var.environment}"
  role = aws_iam_role.ec2_k3s.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Publier les credentials k3s dans SSM Parameter Store
        Effect = "Allow"
        Action = [
          "ssm:PutParameter",
          "ssm:GetParameter",
          "ssm:DeleteParameter"
        ]
        Resource = "arn:aws:ssm:*:*:parameter/${var.project_name}/k3s/*"
      },
      {
        # Pull images ECR public
        Effect   = "Allow"
        Action   = ["ecr-public:GetLoginPassword", "ecr-public:Pull*"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2_k3s" {
  name = "${var.project_name}-ec2-k3s-profile-${var.environment}"
  role = aws_iam_role.ec2_k3s.name
  tags = var.default_tags
}

# ── EC2 ────────────────────────────────────────────────────

resource "aws_instance" "k3s_server" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type

  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.k3s.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_k3s.name
  # AJOUTE CETTE LIGNE
  associate_public_ip_address = true
  key_name               = var.key_name != "" ? var.key_name : null

  user_data = templatefile("${path.module}/k3s-user-data.sh", {
    project_name = var.project_name
    region       = var.aws_region
  })

  user_data_replace_on_change = true

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  tags = merge(var.default_tags, {
    Name = "${var.project_name}-k3s-${var.environment}"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# ── Lire les credentials depuis SSM (publiés par le user-data) ──

resource "null_resource" "wait_for_ssm_params" {
  depends_on = [aws_instance.k3s_server]

  triggers = {
    instance_id = aws_instance.k3s_server.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "Waiting for k3s credentials in SSM..."
      for i in $(seq 1 40); do
        if aws ssm get-parameter \
          --region ${var.aws_region} \
          --name "/${var.project_name}/k3s/token" \
          --with-decryption >/dev/null 2>&1; then
          echo "SSM parameters are ready!"
          exit 0
        fi
        echo "Attempt $i/40 — waiting 15s..."
        sleep 15
      done
      echo "Timeout: SSM parameters not found"
      exit 1
    EOT
  }
}

data "aws_ssm_parameter" "k3s_token" {
  depends_on      = [null_resource.wait_for_ssm_params]
  name            = "/${var.project_name}/k3s/token"
  with_decryption = true
}

data "aws_ssm_parameter" "k3s_ca" {
  depends_on      = [null_resource.wait_for_ssm_params]
  name            = "/${var.project_name}/k3s/ca-certificate"
  with_decryption = true
}

