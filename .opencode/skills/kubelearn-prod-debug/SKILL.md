---
name: kubelearn-prod-debug
description: Débogage et vérification en production de KubeLearn (SSH + kubectl + curl). Use when debugging kubelearn.duckdns.org issues, checking pods/logs/secrets on the k3s node, reproducing the login/signup flow with curl, or verifying a deployment reached the cluster.
---

# Débogage prod KubeLearn (SSH + kubectl + curl)

## Accès au nœud k3s
- Instance EC2 : `35.87.120.208` (`i-0054dad59b580acc0`), user `ec2-user`.
- Clé : `terraform/environments/prod/k8sproject-key.pem` (dans le repo, ignorer avec 0400).
- Connexion :
  ```bash
  ssh -i terraform/environments/prod/k8sproject-key.pem -o StrictHostKeyChecking=no ec2-user@35.87.120.208
  ```
- Sur le nœud, à chaque session :
  ```bash
  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml   # sudo si "connection refused"
  ```

## Commands utiles
- Récupérer un pod par service (labels `app` : auth-service/frontend-service/user-service/course-service) :
  ```bash
  kubectl get deploy -o name
  kubectl get pods -l app=auth-service -o jsonpath="{.items[0].metadata.name}"
  ```
- Logs de l'API Gateway (Traefik, ns kube-system) — erreurs ForwardAuth, routage, `Accepted`/`PortUnavailable` :
  ```bash
  kubectl logs -n kube-system deploy/traefik --tail=50
  kubectl get gateway kubelearn-gateway -o yaml                 # listeners Accepted=True
  kubectl get httproute kubelearn-routes -o yaml                # route attachée
  ```
- Check secrets déployés :
  ```bash
  kubectl get secrets -n default
  kubectl get secret app-secret -o jsonpath="{.data}" 
  ```
  Secrets existants : `app-secret` (contient `SESSION_SECRET`), `postgres-secret`, `s3-secret`, `admin-credentials`.
- Cible ForwardAuth `GET /auth/session` (injection des headers `X-User-*` depuis le cluster) :
  ```bash
  kubectl exec -n kube-system deploy/traefik -- \
    wget -qO- http://auth-service.default.svc.cluster.local:3001/auth/session   # {"authenticated":false}
  ```
- Reproduire le flux complet depuis le nœud (ou la machine locale, via le domaine public) :
  ```bash
  curl -sk --resolve kubelearn.duckdns.org:443:127.0.0.1 -c /tmp/jar.txt -X POST https://kubelearn.duckdns.org/signup \
    -d "username=u$(date +%s)&password=password123&confirmPassword=password123" -D - -o /dev/null
  curl -sk -b /tmp/jar.txt -D - https://kubelearn.duckdns.org/dashboard -o /tmp/dash.html
  grep -o "Welcome back[^<]*" /tmp/dash.html   # signe que les headers x-user-* sont injectés
  ```
  **Piège curl** : le cookie stocké dans le jar commence par `#HttpOnly_...` (cookie `Secure`) — ne pas le filtrer avec `grep -v '^#'` sinon on le perd.

## Vérifier la session dans Redis
- La session est dans Redis (`sess:<sid>`), même quand le bug headers se produit. Un flux sain = session existe + `GET /auth/session` renvoie les headers.
- Lister les sessions et en lire une :
  ```bash
  kubectl exec deploy/redis -- redis-cli KEYS 'sess:*'
  kubectl exec deploy/redis -- redis-cli GET sess:<sid>
  ```
- Le secret de signature des cookies est `app-secret.SESSION_SECRET` (le même qu'utilise l'auth-service).

## Diagnostic rapide "dashboard renvoie vers /login"
1. `POST /signup` → doit être `302 /dashboard` + `Set-Cookie connect.sid=...`.
2. `GET /dashboard` avec ce cookie → si `302 /login`, le frontend n'a pas reçu les headers `x-user-*`.
3. Vérifier que la session existe en Redis puis que `GET /auth/session` (via le pod traefik, FQDN) renvoie `{"authenticated":true}` + `X-User-*`.
4. Regarder les logs Traefik (`kubectl logs -n kube-system deploy/traefik`) : une erreur `Error calling http://auth-service...` côté ForwardAuth = l'auth-service n'a pas validé la session (cookie Redis/secret) ou l'adresse n'est pas le FQDN `auth-service.default.svc.cluster.local:3001`.