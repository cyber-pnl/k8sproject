#!/bin/bash
set -uo pipefail

exec > >(tee /var/log/k3s-setup.log | logger -t k3s-userdata -s 2>/dev/console) 2>&1

echo "=== K3S INSTALL START $(date -Is) ==="

# ====================== VARIABLES TERRAFORM & CONFIG ======================
REGION="${region}"
PROJECT="${project_name}"
EMAIL_LETSENCRYPT="danhojeanbrice28@gmail.com" # ⚠️ À remplacer par ton email pour les alertes Let's Encrypt
      # ⚠️ Remplacer par ton sous-domaine (ex: "kubelearn-pnl" pour kubelearn-pnl.duckdns.org)

if [[ -z "$REGION" || -z "$PROJECT" ]]; then
  echo "❌ ERREUR: REGION ou PROJECT non défini par Terraform"
  exit 1
fi

set -e

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
# ====================== INSTALLATION ANTICIPÉE DES OUTILS AWS ======================
echo "Installing AWS CLI for secure token retrieval..."
dnf update -y
dnf install -y curl jq aws-cli iptables --allowerasing
dnf install -y python3 python3-pip
pip3 install bcrypt

# ====================== MISE À JOUR DUCKDNS ======================
echo "Retrieving DuckDNS token securely from AWS SSM..."
# Le script récupère le token de manière dynamique et invisible

# 🦆 CONFIGURATION DUCKDNS
DUCKDNS_DOMAIN="kubelearn.duckdns.org"  
DUCKDNS_TOKEN=$(aws ssm get-parameter --region "$REGION" --name "/kubelearn/duckdns/token" --with-decryption --query "Parameter.Value" --output text)

echo "Updating DuckDNS with the new public IP..."
DUCK_RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=$DUCKDNS_DOMAIN&token=$DUCKDNS_TOKEN&ip=$PUBLIC_IP")

if [[ "$DUCK_RESPONSE" == "OK" ]]; then
  echo "✅ DuckDNS mis à jour avec succès : $DUCKDNS_DOMAIN.duckdns.org pointe désormais vers $PUBLIC_IP"
else
  echo "❌ ÉCHEC de la mise à jour DuckDNS. Réponse API : $DUCK_RESPONSE"
  exit 1
fi

# ====================== MISE À ZONE & INSTALLATION DÉPENDANCES ======================
echo "Installing system dependencies..."
dnf update -y
dnf install -y curl jq aws-cli iptables --allowerasing

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

# ====================== INSTALLATION K3S (AVEC TRAEFIK ACTIF) ======================
echo "Installing K3s with Traefik..."
curl -sfL https://get.k3s.io | sh -s - server \
  --write-kubeconfig-mode 644 \
  --tls-san "$PUBLIC_IP" \
  --tls-san "$DUCKDNS_DOMAIN.duckdns.org" \
  --node-external-ip "$PUBLIC_IP" \
  --node-name "$(hostname)"

# ====================== ATTENTE K3S ======================
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

echo "Waiting for K3s to be ready..."
for i in {1..60}; do
  if kubectl get nodes 2>/dev/null | grep -q " Ready "; then
    echo " K3s node is Ready"
    break
  fi
  echo "Tentative $i/60 - K3s pas encore prêt..."
  sleep 5
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

aws ssm put-parameter --region "$REGION" --name "/$PROJECT/k3s/token" --value "$K3S_TOKEN" --type SecureString --overwrite
aws ssm put-parameter --region "$REGION" --name "/$PROJECT/k3s/ca-certificate" --value "$CA_CERT" --type SecureString --overwrite

# ====================== DEPLOIEMENT D'ARGOCD ======================
echo "=== Installing ArgoCD Core ==="
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply --server-side -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "Waiting for ArgoCD CRDs..."
kubectl wait --for=condition=established crd/applications.argoproj.io --timeout=120s

# ====================== DEPLOIEMENT DE CERT-MANAGER ======================
echo "=== Installing cert-manager ==="
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml

echo "Waiting for cert-manager to be ready..."
kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=120s

# ====================== DEPLOIEMENT DE BITNAMI SEALED SECRETS ======================
KUBESEAL_VERSION=$(curl -s https://api.github.com/repos/bitnami-labs/sealed-secrets/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')

echo "🔍 Version détectée : $KUBESEAL_VERSION"

kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.1/controller.yaml

# Télécharger le binaire
curl -sSL "https://github.com/bitnami-labs/sealed-secrets/releases/download/v$KUBESEAL_VERSION/kubeseal-$KUBESEAL_VERSION-linux-amd64.tar.gz" \
  -o kubeseal.tar.gz

# Extraire et installer
tar -xvzf kubeseal.tar.gz kubeseal
install -m 755 kubeseal /usr/local/bin/kubeseal
# Nettoyage
rm -f kubeseal.tar.gz kubeseal

# Vérification
echo "✅ kubeseal version : $(kubeseal --version)"
# ====================== CONFIGURATION DU CLUSTERISSUER (LET'S ENCRYPT) ======================
echo "=== Creating Let's Encrypt ClusterIssuer ==="
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: $EMAIL_LETSENCRYPT
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          ingressClassName: traefik
EOF

# ====================== DEPLOIEMENT DE TON APPLICATION INITIALE ======================
echo "=== Deploying initial ArgoCD Application ==="
cat <<EOF | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kubelearn-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/cyber-pnl/k8sproject.git
    targetRevision: HEAD
    path: 'k8s' 
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
EOF

echo "✅ Initial ArgoCD Application deployed"
echo "=== K3S, ARGOCD & CERT-MANAGER INSTALLATION FINISHED SUCCESSFULLY $(date -Is) ==="