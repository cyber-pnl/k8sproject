#!/bin/bash
set -e

# Install prerequisites
yum update -y
yum install -y docker containerd jq

systemctl enable --now docker
systemctl enable --now containerd

# Disable swap
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab

# Install k3s server
curl -sfL https://get.k3s.io | sh -s - server --write-kubeconfig-mode 644 --enable traefik

# Copy kubeconfig
mkdir -p /home/ec2-user/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ec2-user/.kube/config
chown ec2-user:ec2-user /home/ec2-user/.kube/config

# Install ArgoCD automatically
git clone https://github.com/cyber-pnl/k8sproject.git /tmp/k8sproject
kubectl apply -f /tmp/k8sproject/infra/install-argocd.yaml
kubectl apply -f /tmp/k8sproject/argocd-app.yaml
rm -rf /tmp/k8sproject

echo "K3s + ArgoCD installed. Apps will auto-sync k8s/ manifests."


