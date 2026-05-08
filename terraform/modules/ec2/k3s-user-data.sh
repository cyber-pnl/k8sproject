#!/bin/bash
set -euo pipefail

LOG_FILE="/var/log/k3s-setup.log"
exec > >(tee -a "$LOG_FILE") 2>&1

on_error() {
  local exit_code=$?
  echo "ERROR: user-data script failed with exit code $${exit_code} (line $BASH_LINENO)."
}
trap on_error ERR

echo "=== k3s-user-data starting at $(date -Is) ==="

# Install prerequisites
yum update -y
yum install -y docker containerd jq git curl
systemctl enable --now docker
systemctl enable --now containerd

# Disable swap
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab || true

# Install k3s server
curl -sfL https://get.k3s.io | sh -s - server \
  --write-kubeconfig-mode 644 \
  --enable traefik

# Wait for k3s
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

echo "Waiting for Kubernetes API / nodes to be Ready..."
until kubectl get nodes 2>/dev/null | grep -q "Ready"; do
  sleep 10
done

echo "Kubernetes is up."

# Make kubeconfig available for ec2-user
mkdir -p /home/ec2-user/.kube
cp -f /etc/rancher/k3s/k3s.yaml /home/ec2-user/.kube/config
chown ec2-user:ec2-user /home/ec2-user/.kube/config

# Helper: wait for a condition without failing the whole script too early
wait_for() {
  # Usage: wait_for <kubectl args...>
  local timeout="$${WAIT_TIMEOUT:-600s}"
  echo "Waiting for: kubectl $* (timeout=$timeout)"
  timeout "$timeout" bash -c "until kubectl $*; do sleep 5; done"
}

# --- Best practice: install cert-manager before applying TLS-related resources ---
# Install cert-manager + ClusterIssuer self-signed.
# (These YAMLs are in the repo at /infra)

# Clone repo once so we can apply infra manifests
git clone https://github.com/cyber-pnl/k8sproject.git /tmp/k8sproject

# cert-manager first
kubectl apply -f /tmp/k8sproject/infra/cert-manager.yaml
kubectl apply -f /tmp/k8sproject/infra/cluster-issuer.yaml

# Wait for cert-manager CRDs to exist (ClusterIssuer is cluster-scoped)
# If CRDs are not ready yet, ArgoCD/TLS objects may fail.
wait_for "get clusterissuers"

# Install ArgoCD
kubectl apply -f /tmp/k8sproject/infra/install-argocd.yaml

# Wait for namespace and server deployment
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s || true

# Additionally wait until the argocd-server pod is running
wait_for "-n argocd get pods -l app.kubernetes.io/name=argocd-server --field-selector=status.phase=Running"

# Apply the app
kubectl apply -f /tmp/k8sproject/argocd-app.yaml

rm -rf /tmp/k8sproject

echo "=== K3s + cert-manager + ArgoCD installed successfully at $(date -Is) ==="