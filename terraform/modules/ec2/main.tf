resource "aws_security_group" "k3s" {
  name_prefix = "${var.project_name}-k3s-sg-${var.environment}-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Node ports
  ingress {
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.default_tags
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

  owners = ["amazon"] # official AMIs
}

resource "aws_iam_role" "ec2_k3s" {
  name = "${var.project_name}-ec2-k3s-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_k3s_ssm" {
  role       = aws_iam_role.ec2_k3s.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ec2_k3s_custom" {
  name = "${var.project_name}-k3s-custom-${var.environment}"
  role = aws_iam_role.ec2_k3s.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr-public:GetLoginPassword",
          "ecr-public:Pull*"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2_k3s" {
  name = "${var.project_name}-ec2-k3s-profile-${var.environment}"
  role = aws_iam_role.ec2_k3s.name
}

resource "aws_instance" "k3s_server" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type # m7i.flex.large

  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.k3s.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_k3s.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  key_name = var.key_name

 user_data = templatefile("${path.module}/k3s-user-data.sh", {
  cluster_name = var.project_name
})
  tags = var.default_tags

  lifecycle {
    create_before_destroy = true
  }
}

