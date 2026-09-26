# KubeLearn - Kubernetes Learning Platform

Plateforme pédagogique microservices (Node.js/Express) avec PostgreSQL et Redis, déployée sur Kubernetes via **GitOps avec ArgoCD** et **CI/CD GitHub Actions**.

---

##  Architecture

L'architecture comprend un API Gateway comme point d'entrée unique et plusieurs microservices, orchestrés par Kubernetes avec déploiement continu via ArgoCD.

### Diagramme de l'Architecture

```
                                    ┌─────────────────────────────────────┐
                                    │         Ingress (Traefik)           │
                                    │         HTTPS / HTTP :80            │
                                    └─────────────────┬───────────────────┘
                                                      │
                                    ┌─────────────────▼───────────────────┐
                                    │         Gateway Service             │
                                    │            (Port 3000)              │
                                    │   Point d'entrée, gestion session   │
                                    │         LoadBalancer                │
                                    └─────────────────┬───────────────────┘
                                                      │
                          ┌───────────────────────────┼───────────────────────────┐
                          │                           │                           │
                 ┌────────▼────────┐        ┌────────▼─────────┐        ┌───────▼─────────┐
                 │  Auth Service   │        │  Frontend Service│        │  User Service    │
                 │   (Port 3001)   │        │   (Port 3003)    │        │   (Port 3002)    │
                 │ Authentification│        │   Rendu EJS      │        │Gestion utilisateurs│
                 └────────┬────────┘        └────────┬─────────┘        └────────┬─────────┘
                          │                          │                           │
                          └──────────────────────────┼───────────────────────────┘
                                                   │
                    ┌──────────────────────────────┴──────────────────────────────┐
                    │                                                           │
           ┌────────▼─────────┐                                     ┌────────────▼────────┐
           │    PostgreSQL    │                                     │       Redis         │
           │    (Port 5432)   │                                     │     (Port 6379)     │
           │   Base de données│                                     │  Sessions & Cache   │
           └──────────────────┘                                     └─────────────────────┘
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Auth Service | 3001 | Authentification (login, signup, logout), sessions Redis, cible ForwardAuth |
| Frontend Service | 3003 | Rendu des vues EJS (pages HTML), lit les en-têtes `x-user-*` |
| User Service | 3002 | API de gestion des utilisateurs |
| Course Service | 3004 | Catalogue de cours (S3/Markdown) + progression |
| PostgreSQL | 5432 | Base de données relationnelle |
| Redis | 6379 | Stockage des sessions et cache |
| API Gateway K8s | 80/443 | Remplaçait le gateway-service : Kubernetes Gateway API (Traefik), routing + ForwardAuth |

---

## Structure du Projet

```
├── .github/workflows/
│   └── CI.yml                    # Pipeline CI/CD complète
│
├── services/                     # Code source des microservices
│   ├── frontend-service/        # Service Frontend (port 3003)
│   ├── auth-service/            # Service Authentification (port 3001) — sessions
│   ├── user-service/            # Service Utilisateurs (port 3002)
│   └── course-service/          # Service Cours (port 3004)
│
├── k8s/                          # Manifests Kubernetes (GitOps via ArgoCD)
│   ├── auth-deployment.yaml     # Déploiement Auth Service
│   ├── auth-service.yaml        # Service Auth
│   ├── frontend-deployment.yaml # Déploiement Frontend
│   ├── frontend-service.yaml    # Service Frontend
│   ├── user-deployment.yaml     # Déploiement User Service
│   ├── user-service.yaml        # Service User
│   ├── course-deployment.yaml   # Déploiement Course Service
│   ├── course-service.yaml      # Service Course
│   ├── network-gateway.yaml     # Gateway (Kubernetes Gateway API / Traefik)
│   ├── http-routes.yaml         # HTTPRoute de routage + ForwardAuth
│   ├── middleware-forward-auth.yaml # ForwardAuth (injection x-user-*)
│   ├── certificate.yaml         # Certificat TLS (cert-manager)
│   ├── postgres-*.yaml          # PostgreSQL (StatefulSet + ConfigMap)
│   ├── redis-*.yaml             # Redis (Deployment + Service)
│   └── scan-node-app-cronjob.yaml # Scan sécurité Trivy
│
├── infra/                        # Infrastructure K8s (appliquée à la main)
│   ├── install-argocd.yaml      # Configuration ArgoCD
│   ├── cert-manager.yaml        # Gestionnaire de certificats TLS
│   ├── cluster-issuer.yaml      # Émetteur de certificats Let's Encrypt
│   └── traefik-gateway.yaml     # HelmChartConfig Traefik (provider kubernetesgateway)
│
├── argocd-app.yaml              # Application ArgoCD (GitOps)
└── README.md
```

---

## Flux de Connexion

1. L'utilisateur soumet le formulaire de login/signup (`POST /login`, `/signup`)
2. L'API Gateway (Traefik, HTTPRoute) route la requête vers l'auth-service (chemin préservé)
3. L'auth-service vérifie les identifiants et définit la session utilisateur dans Redis (`Set-Cookie`)
4. À chaque requête des pages/APIs, le middleware **ForwardAuth** de Traefik appelle `GET /auth/session`
5. Si la session est valide, l'auth-service renvoie les en-têtes `x-user-id`, `x-user-name`, `x-user-role` que Traefik copie vers le backend
6. Le frontend lit ces headers et affiche l'interface connectée

### Headers transmis par ForwardAuth

| Header | Description |
|--------|-------------|
| `x-user-id` | ID de l'utilisateur |
| `x-user-name` | Nom d'utilisateur |
| `x-user-role` | Rôle (user/admin) |

---

## 🚀 CI/CD GitHub Actions

Le projet utilise un pipeline CI/CD complet sur **GitHub Actions** avec publication des images sur **GitHub Container Registry (GHCR)**.

### Pipeline CI

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Lint   │ -> │  Tests  │ -> │ Security │ -> │ Build &  │ -> │ Delivery │
│         │    │Coverage │    │  Scan    │    │  Push    │    │  (K8s)   │
│ 3 svcs  │    │ 3 svcs  │    │ 3 svcs   │    │ 4 images │    │ 4 svcs   │
│         │    │         │    │          │    │  GHCR    │    │  Git     │
└─────────┘    └─────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Jobs du workflow

| Job | Description |
|-----|-------------|
| `lint` | Linting ESLint sur auth-service, user-service, course-service |
| `test` | Tests Jest avec couverture de code et rapports JUnit |
| `security` | Audit npm (`npm audit`) sur chaque service |
| `build-push` | Build et push des images Docker vers GHCR avec tag `sha` + `latest` |
| `delivery` | Mise à jour automatique des tags d'image dans les manifests K8s |

### Images Docker (GHCR)

Les images sont publiées sur `ghcr.io/cyber-pnl/k8sproject/` :

- `ghcr.io/cyber-pnl/k8sproject/auth-service:latest`
- `ghcr.io/cyber-pnl/k8sproject/user-service:latest`
- `ghcr.io/cyber-pnl/k8sproject/course-service:latest`
- `ghcr.io/cyber-pnl/k8sproject/frontend-service:latest`

### Déclenchement

```bash
# Manuellement via workflow_dispatch
# Depuis GitHub : Actions > CI Pipeline - Test > Run workflow
```

---

##  Déploiement GitOps avec ArgoCD

Le projet utilise **ArgoCD** pour le déploiement continu GitOps. Les manifests Kubernetes dans le dossier `k8s/` sont synchronisés automatiquement avec le cluster.

### Configuration ArgoCD

- **Repository** : `https://github.com/cyber-pnl/k8sproject.git`
- **Chemin** : `k8s/`
- **Namespace** : `default`
- **Auto-sync** : Activé avec `prune` et `selfHeal`

### Annotations de Synchronisation

Chaque manifest inclut l'annotation `argocd.argoproj.io/sync-wave` pour contrôler l'ordre de déploiement :

```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "4"
```

Les ressources sont déployées en vague 4, permettant un contrôle précis de l'ordre d'application des manifests.

### Déploiement d'ArgoCD

```bash
# Installer ArgoCD
kubectl apply -f infra/install-argocd.yaml

# Appliquer l'application ArgoCD
kubectl apply -f argocd-app.yaml

# Accéder à l'UI ArgoCD
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

---

##  Gestion des Secrets

### GitHub Secrets (Codespaces / Actions)

Les secrets suivants sont configurés dans **GitHub Settings > Secrets and variables > Actions** et injectés automatiquement par la CI/CD :

| Secret | Description |
|--------|-------------|
| `POSTGRES_USER` | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL |
| `POSTGRES_DB` | Nom de la base de données |
| `SESSION_SECRET` | Secret pour les sessions |
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `ADMIN_PASSWORD` | Mot de passe administrateur (hashé bcrypt) |
| `GITHUB_TOKEN` | Token pour push GHCR et commit delivery |

### Création des Secrets Kubernetes (manuel)

Si nécessaire en local ou hors ArgoCD :

```bash
# Secret PostgreSQL
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=postgres \
  --from-literal=POSTGRES_DB=kubelearn

# Secret Application
kubectl create secret generic app-secret \
  --from-literal=SESSION_SECRET="your-super-secret-session-key" \
  --from-literal=database-url="postgresql://postgres:postgres@postgres-service:5432/kubelearn"

# Secret Admin (mot de passe hashé en bcrypt)
kubectl create secret generic admin-credentials \
  --from-literal=admin-password="$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'Adminappli@123', bcrypt.gensalt(10)).decode())")"
```

---

## 🛡️ Sécurité

### Scan de vulnérabilités (Trivy)

Un CronJob Kubernetes scan quotidiennement les images Docker :

```yaml
# k8s/scan-node-app-cronjob.yaml
schedule: "0 2 * * *"  # Tous les jours à 2h du matin
```

Le scan analyse l'image `frontend-service` sur GHCR à la recherche de CVEs.

### Network Policies (à implémenter)

Les communications entre services sont restreintes via des NetworkPolicies Kubernetes.

---

## 🌐 API Gateway et TLS

Le projet utilise **Traefik** comme API Gateway (Kubernetes Gateway API) avec **cert-manager** pour les certificats TLS automatiques (Let's Encrypt).

### Composants Infrastructure

| Fichier | Description |
|---------|-------------|
| `cluster/traefik-gateway.yaml` | HelmChartConfig Traefik (provider `kubernetesgateway`) |
| `k8s/network-gateway.yaml` | Gateway (listeners web/websecure) |
| `k8s/http-routes.yaml` | HTTPRoute (routage + ForwardAuth) |
| `infra/cert-manager.yaml` | Gestionnaire de certificats TLS |
| `infra/cluster-issuer.yaml` | Émetteur Let's Encrypt |
| `infra/install-argocd.yaml` | Installation ArgoCD |

---

##  Construction Locale (Développement)

### Prérequis

- Docker
- kubectl
- Minikube ou Kind
- Node.js 20+ et npm

### Construction des Images

```bash
# Avec Docker standard (développement local)
docker build -t auth-service:latest ./services/auth-service
docker build -t user-service:latest ./services/user-service
docker build -t course-service:latest ./services/course-service
docker build -t frontend-service:latest ./services/frontend-service

# Avec Minikube
eval $(minikube docker-env)
docker build -t auth-service:latest ./services/auth-service
# ... etc

# Avec Kind
docker build -t auth-service:latest ./services/auth-service
kind load docker-image auth-service:latest --name kind
```

### Déploiement Local

```bash
# 1. Créer les secrets (voir section Gestion des Secrets)

# 2. Déployer les services
kubectl apply -f k8s/

# 3. Vérifier les pods
kubectl get pods -w

# 4. Accéder au site
kubectl get svc traefik -n kube-system   # LoadBalancer (ports 80/443)
```

---

## ⚙️ Variables d'Environnement

### Gateway Service

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | 3000 | Port du service |
| `AUTH_SERVICE_URL` | http://auth-service:3001 | URL auth service |
| `USER_SERVICE_URL` | http://user-service:3002 | URL user service |
| `FRONTEND_URL` | http://frontend-service:3003 | URL frontend service |
| `REDIS_URL` | redis://redis-service:6379 | URL Redis |
| `SESSION_SECRET` | - | Secret de session (depuis app-secret) |
| `NODE_ENV` | production | Environnement d'exécution |

### Frontend Service

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | 3003 | Port du service |
| `REDIS_URL` | redis://redis-service:6379 | URL Redis |
| `SESSION_SECRET` | - | Secret de session (depuis app-secret) |

### Auth Service

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | 3001 | Port du service |
| `POSTGRES_USER` | postgres | Utilisateur PostgreSQL (depuis postgres-secret) |
| `POSTGRES_PASSWORD` | postgres | Mot de passe PostgreSQL (depuis postgres-secret) |
| `POSTGRES_DB` | kubelearn | Nom de la base (depuis postgres-secret) |
| `REDIS_URL` | redis://redis-service:6379 | URL Redis |
| `SESSION_SECRET` | - | Secret de session (depuis app-secret) |
| `COOKIE_SECURE` | true | Cookie de session Secure (false en dev local) |

### User Service

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | 3002 | Port du service |
| `POSTGRES_USER` | postgres | Utilisateur PostgreSQL (depuis postgres-secret) |
| `POSTGRES_PASSWORD` | postgres | Mot de passe PostgreSQL (depuis postgres-secret) |
| `POSTGRES_DB` | kubelearn | Nom de la base (depuis postgres-secret) |
| `REDIS_URL` | redis://redis-service:6379 | URL Redis |

---

##  Dépannage

### Voir les logs

```bash
kubectl logs -f deployment/auth-service
kubectl logs -f deployment/user-service
kubectl logs -f deployment/frontend-service
kubectl logs -f deployment/traefik -n kube-system   # API Gateway (routage, ForwardAuth)
```

### Redémarrer un service

```bash
kubectl rollout restart deployment/<nom-deployment>
```

### Vérifier les événements

```bash
kubectl get events --sort-by='.lastTimestamp'
```

### Vérifier les ressources ArgoCD

```bash
kubectl get applications -n argocd
kubectl describe application kubelearn-app -n argocd
```

---

##  Tests

Chaque service dispose de tests unitaires et d'intégration avec Jest :

```bash
# Auth Service (sessions + ForwardAuth)
cd services/auth-service
npm install
npm run test:coverage

# User Service
cd services/user-service
npm install
npm run test:coverage

# Course Service
cd services/course-service
npm install
npm run test:coverage
```

---

##  Notes Importantes

- **Sessions** : L'auth-service est la source de vérité des sessions (Redis), via l'API Gateway Kubernetes (ex-gateway-service supprimé)
- **Frontend sans session propre** : Le Frontend Service lit les infos utilisateur depuis les headers HTTP `x-user-*` injectés par le ForwardAuth de Traefik
- **Auth Service** : vérifie les identifiants, gère les sessions et répond sur `GET /auth/session` (cible ForwardAuth)
- **Images GHCR** : Les manifests K8s pointent vers `ghcr.io/cyber-pnl/k8sproject/...` pour le déploiement via ArgoCD
- **Auto-delivery** : Le job `delivery` de la CI met à jour automatiquement les tags d'images dans les manifests K8s
- **Skip CI** : Les commits de delivery incluent `[skip ci]` pour éviter les boucles infinies

---

##  Licence

Projet pédagogique - KubeLearn Platform

