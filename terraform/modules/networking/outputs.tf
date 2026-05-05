output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnets" {
  value = aws_subnet.public[*].id
}

output "private_subnets" {
  value = aws_subnet.private[*].id
}

output "public_subnet_arns" {
  value = aws_subnet.public[*].arn
}

output "private_subnet_arns" {
  value = aws_subnet.private[*].arn
}

output "availability_zones" {
  value = var.availability_zones
}
