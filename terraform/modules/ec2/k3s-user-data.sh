#!/bin/bash
set -euxo pipefail

LOG_FILE="/var/log/k3s-setup.log"

# Log everything
exec > >(tee -a "$LOG_FILE" | logger -t user-data -s 2>/dev/console) 2>&1

on_error() {
  local exit_code=$?
  echo "ERROR: user-data script failed with exit code $${exit_code} at line ${BASH_LINENO[0]}"
}

trap on_error ERR

echo "================================================="
echo "K3S INSTALLATION STARTED AT $(date -Is)"
echo "================================================="

# Wait for network
until ping -c1 amazon.com >/dev/null 2>&1; do
  echo "Waiting for network..."
  sleep 5
done

echo "Network is available."

# Update system
dnf update -y

# Install required packages
dnf install -y \
  docker \
  jq \
  git \
  curl \
  tar

# Enable Docker
systemctl enable docker
systemctl start docker

# Disable swap
swapoff -a || true
sed -i '/ swap / s/^/#/' /etc/fstab || true

# Required kernel modules
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

# Required sysctl params
cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF

sysctl --system

echo "Installing K3s..."

# Install K3s
curl -sfL https://get.k3s.io | sh -s - server \
  --write-kubeconfig-mode 644 \
  --disable servicelb \
  --disable local-storage \
  --tls-san $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Wait for k3s service
echo "Waiting for k3s service..."

until systemctl is-active --quiet k3s; do
  sleep 5
done

echo "k3s service is active."

# Configure kubectl
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Wait for Kubernetes node readiness
echo "Waiting for Kubernetes node to become Ready..."

until kubectl get nodes 2>/dev/null | grep -q " Ready "; do
  kubectl get nodes || true
  sleep 10
done

echo "Kubernetes cluster is ready."

# Configure kubeconfig for ec2-user
mkdir -p /home/ec2-user/.kube

cp /etc/rancher/k3s/k3s.yaml /home/ec2-user/.kube/config

chown -R ec2-user:ec2-user /home/ec2-user/.kube

chmod 600 /home/ec2-user/.kube/config

# Helper function
wait_for() {
  local timeout="$${WAIT_TIMEOUT:-600s}"

  echo "Waiting for: kubectl $* (timeout=$timeout)"

  timeout "$timeout" bash -c "until kubectl $*; do sleep 5; done"
}

echo "Cloning infrastructure repository..."

git clone https://github.com/cyber-pnl/k8sproject.git /tmp/k8sproject

# Wait for API server
echo "Waiting for Kubernetes API..."

until kubectl cluster-info >/dev/null 2>&1; do
  sleep 5
done

echo "Installing cert-manager..."

kubectl apply -f /tmp/k8sproject/infra/cert-manager.yaml

echo "Waiting for cert-manager deployments..."

kubectl wait \
  --for=condition=available deployment \
  --all \
  -n cert-manager \
  --timeout=300s || true

echo "Installing ClusterIssuer..."

kubectl apply -f /tmp/k8sproject/infra/cluster-issuer.yaml

wait_for "get clusterissuers"

echo "Installing ArgoCD..."

kubectl apply -f /tmp/k8sproject/infra/install-argocd.yaml

echo "Waiting for ArgoCD server deployment..."

kubectl wait \
  --for=condition=available deployment/argocd-server \
  -n argocd \
  --timeout=600s || true

echo "Waiting for ArgoCD server pod..."

wait_for "-n argocd get pods -l app.kubernetes.io/name=argocd-server --field-selector=status.phase=Running"

echo "Deploying ArgoCD application..."

kubectl apply -f /tmp/k8sproject/argocd-app.yaml

echo "Cleaning temporary files..."

rm -rf /tmp/k8sproject

echo "================================================="
echo "K3S + CERT-MANAGER + ARGOCD INSTALLATION COMPLETED"
echo "DATE: $(date -Is)"
echo "================================================="