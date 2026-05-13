#!/bin/bash
set -uo pipefail  # Pas de -e au début pour ne pas arrêter sur les checks

exec > >(tee /var/log/k3s-setup.log | logger -t k3s-userdata -s 2>/dev/console) 2>&1

echo "=== K3S INSTALL START $(date -Is) ==="

# ====================== VARIABLES TERRAFORM ======================
REGION="${region}"
PROJECT="${project_name}"

if [[ -z "$REGION" || -z "$PROJECT" ]]; then
  echo "❌ ERREUR: REGION ou PROJECT non défini par Terraform"
  exit 1
fi

# ====================== ATTENTE RÉSEAU ======================
echo "Waiting for network..."
for i in {1..30}; do
  if ip route | grep -q default; then
    echo "✅ Network ready"
    break
  fi
  echo "Tentative $i/30 - Pas encore de route par défaut..."
  sleep 3
done

# ====================== RÉCUPÉRATION IP PUBLIQUE (IMDSv2) ======================
echo "Retrieving public IP..."
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)

if [[ -z "$PUBLIC_IP" ]]; then
  echo "❌ Impossible de récupérer l'IP publique"
  exit 1
fi

echo "Public IP: $PUBLIC_IP"

# ====================== MISE À JOUR SYSTÈME ======================
dnf update -y
dnf install -y curl jq aws-cli
# ====================== CONFIG KERNEL ======================
cat <<EOF > /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

cat <<EOF > /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF

sysctl --system

# ====================== INSTALLATION K3S ======================
echo "Installing K3s..."

curl -sfL https://get.k3s.io | sh -s - server \
  --write-kubeconfig-mode 644 \
  --disable servicelb \
  --tls-san "$PUBLIC_IP" \
  --node-external-ip "$PUBLIC_IP" \
  --node-name "$(hostname)"

# ====================== ATTENTE K3S ======================
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

echo "Waiting for K3s to be ready..."
for i in {1..60}; do
  if kubectl get nodes 2>/dev/null | grep -q " Ready "; then
    echo "✅ K3s node is Ready"
    break
  fi
  echo "Tentative $i/60 - K3s pas encore prêt..."
  sleep 8
done

# ====================== CONFIGURATION POUR EC2-USER ======================
mkdir -p /home/ec2-user/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ec2-user/.kube/config
chown -R ec2-user:ec2-user /home/ec2-user/.kube
chmod 600 /home/ec2-user/.kube/config

# ====================== PUBLICATION DANS SSM ======================
echo "Saving K3s info to SSM Parameter Store..."

K3S_TOKEN=$(cat /var/lib/rancher/k3s/server/node-token)
CA_CERT=$(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')

aws ssm put-parameter --region "$REGION" \
  --name "/$PROJECT/k3s/token" \
  --value "$K3S_TOKEN" \
  --type SecureString --overwrite

aws ssm put-parameter --region "$REGION" \
  --name "/$PROJECT/k3s/ca-certificate" \
  --value "$CA_CERT" \
  --type SecureString --overwrite

echo "=== K3S INSTALLATION FINISHED SUCCESSFULLY $(date -Is) ==="