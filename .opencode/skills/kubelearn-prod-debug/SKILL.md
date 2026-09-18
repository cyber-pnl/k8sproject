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
- Récupérer un pod par rôle (labels `tier` : gateway/frontend/user/auth) :
  ```bash
  kubectl get pods -l tier=gateway -o jsonpath="{.items[0].metadata.name}"
  ```
- Logs du gateway (contenir les marqueurs `🔍 [PROXY /]`, `✅`, `❌`) :
  ```bash
  kubectl logs -n default $(kubectl get pods -l tier=gateway -o jsonpath="{.items[0].metadata.name}") | tail -50
  ```
- Check secrets déployés :
  ```bash
  kubectl get secrets -n default
  kubectl get secret app-secret -o jsonpath="{.data}" 
  ```
  Secrets existants : `app-secret` (contient `SESSION_SECRET`), `postgres-secret`, `admin-credentials`.
- Reproduire le flux complet depuis le nœud (ou la machine locale, via le domaine public) :
  ```bash
  curl -s -c /tmp/jar.txt -X POST https://kubelearn.duckdns.org/signup \
    -d "username=u$(date +%s)&password=password123&confirmPassword=password123" -D - -o /dev/null
  curl -s -b /tmp/jar.txt -D - https://kubelearn.duckdns.org/dashboard -o /tmp/dash.html
  grep -o "Welcome back[^<]*" /tmp/dash.html   # signe que les headers x-user-* sont injectés
  ```
  **Piège curl** : le cookie stocké dans le jar commence par `#HttpOnly_...` (cookie `Secure`) — ne pas le filtrer avec `grep -v '^#'` sinon on le perd.

## Vérifier la session dans Redis
- La session est dans Redis (`sess:<sid>`), même quand le bug headers se produit. Un flux sain = session existe + gateway injecte les headers.
- Dans le pod gateway : `requirement` de vérifier la version d'`http-proxy-middleware` dans le pod :
  ```bash
  kubectl exec -n default $(kubectl get pods -l tier=gateway -o jsonpath="{.items[0].metadata.name}") -- \
    node -p "require('http-proxy-middleware/package.json').version"
  ```
  v3+ → le proxy DOIT donc utiliser `on: { proxyReq }`, jamais `onProxyReq` (option legacy silencieusement ignorée).
- Validation cookie/signature dans le pod gateway (secret = valeur de `app-secret.SESSION_SECRET`) :
  ```bash
  kubectl exec ... -- node -e "
    const { sign, unsign } = require('cookie-signature');
    const sid = '<sid du cookie>', secret = '<SESSION_SECRET>';
    console.log(unsign(sid, secret) === '<sid décodé>');"
  ```

## Diagnostic rapide "dashboard renvoie vers /login"
1. `POST /signup` → doit être `302 /dashboard` + `Set-Cookie connect.sid=...`.
2. `GET /dashboard` avec ce cookie → si `302 /login`, le frontend n'a pas reçu les headers `x-user-*`.
3. Regarder les logs gateway : si le marqueur `❌ Pas de session` n'apparaît pas alors qu'on avait un cookie, le callback `on: { proxyReq }` ne s'exécute pas (mauvaise config proxy) ; s'il apparaît, la session n'est pas chargée (cookie/secret/Redis).
4. Que la session soit bien en Redis avant d'accuser le cookie : `redis-cli GET sess:<sid>`.