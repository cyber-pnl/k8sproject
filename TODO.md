- [x] Mettre à jour terraform/modules/ec2/k3s-user-data.sh pour rendre l’installation idempotente/robuste (set -euo pipefail, logs, trap)

- [ ] Attendre que cert-manager soit installé (apply infra/cert-manager.yaml + infra/cluster-issuer.yaml)
- [ ] Attendre que les CRDs cert-manager soient disponibles avant de continuer
- [ ] Installer ArgoCD (apply infra/install-argocd.yaml)
- [ ] Attendre que les CRDs ArgoCD (applications.argoproj.io) soient prêtes et que le namespace argocd + deployment argocd-server soient disponibles
- [ ] Appliquer argocd-app.yaml
- [ ] Nettoyer le clone (rm -rf /tmp/k8sproject)
- [ ] Exécuter terraform validate/plan puis apply
- [ ] Vérifier après boot : kubectl get pods -n argocd, kubectl get clusterissuer, kubectl get certificates

