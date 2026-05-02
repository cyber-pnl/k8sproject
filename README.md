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
| Gateway Service | 3000 | Point d'entrée, routage, gestion de session centralisée |
| Frontend Service | 3003 | Rendu des vues EJS (pages HTML) |
| Auth Service | 3001 | Authentification (login, signup, logout), vérification utilisateurs |
| User Service | 3002 | API de gestion des utilisateurs |
| PostgreSQL | 5432 | Base de données relationnelle |
| Redis | 6379 | Stockage des sessions et cache |

---

## Structure du Projet

```
├── .github/workflows/
│   └── CI.yml                    # Pipeline CI/CD complète
│
├── services/                     # Code source des microservices
│   ├── gateway-service/         # Service Gateway (port 3000)
│   ├── frontend-service/        # Service Frontend (port 3003)
│   ├── auth-service/            # Service Authentification (port 3001)
│   └── user-service/            # Service Utilisateurs (port 3002)
│
├── k8s/                          # Manifests Kubernetes
│   ├── auth-deployment.yaml     # Déploiement Auth Service
│   ├── auth-service.yaml        # Service Auth
│   ├── frontend-deployment.yaml # Déploiement Frontend
│   ├── frontend-service.yaml    # Service Frontend
│   ├── gateway-deployment.yaml  # Déploiement Gateway
│   ├── gateway-service.yaml     # Service Gateway (LoadBalancer)
│   ├── user-deployment.yaml     # Déploiement User Service
│   ├── user-service.yaml        # Service User
│   ├── postgres-*.yaml          # PostgreSQL (StatefulSet + ConfigMap)
│   ├── redis-*.yaml             # Redis (Deployment + Service)
│   └── scan-node-app-cronjob.yaml # Scan sécurité Trivy
│
├── infra/                        # Infrastructure K8s
│   ├── install-argocd.yaml      # Configuration ArgoCD
│   ├── traefik.yaml             # Ingress Controller
│   ├── cert-manager.yaml        # Gestionnaire de certificats TLS
│   └── cluster-issuer.yaml      # Émetteur de certificats Let's Encrypt
│
├── argocd-app.yaml              # Application ArgoCD (GitOps)
└── README.md
```

---

## Flux de Connexion

1. L'utilisateur soumet le formulaire de login/signup
2. Le gateway reçoit la requête et appelle l'auth-service via API REST
3. L'auth-service vérifie les identifiants et retourne les données utilisateur en JSON
4. Le gateway définit la session utilisateur dans Redis
5. Le gateway transmet les infos utilisateur au frontend via des headers (`x-user-id`, `x-user-name`, `x-user-role`)
6. Le frontend lit ces headers et affiche l'interface connectée

### Headers transmis par le Gateway

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
| `lint` | Linting ESLint sur auth-service, user-service, gateway-service |
| `test` | Tests Jest avec couverture de code et rapports JUnit |
| `security` | Audit npm (`npm audit`) sur chaque service |
| `build-push` | Build et push des images Docker vers GHCR avec tag `sha` + `latest` |
| `delivery` | Mise à jour automatique des tags d'image dans les manifests K8s |

### Images Docker (GHCR)

Les images sont publiées sur `ghcr.io/cyber-pnl/k8sproject/` :

- `ghcr.io/cyber-pnl/k8sproject/auth-service:latest`
- `ghcr.io/cyber-pnl/k8sproject/user-service:latest`
- `ghcr.io/cyber-pnl/k8sproject/gateway-service:latest`
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

## 🌐 Ingress et TLS

Le projet utilise **Traefik** comme Ingress Controller avec **cert-manager** pour les certificats TLS automatiques (Let's Encrypt).

### Composants Infrastructure

| Fichier | Description |
|---------|-------------|
| `infra/traefik.yaml` | Ingress Controller Traefik |
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
docker build -t gateway-service:latest ./services/gateway-service
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

# 4. Accéder au Gateway
minikube service gateway-service
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
kubectl logs -f deployment/gateway-service
kubectl logs -f deployment/auth-service
kubectl logs -f deployment/user-service
kubectl logs -f deployment/frontend-service
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
# Auth Service
cd services/auth-service
npm install
npm run test:coverage

# User Service
cd services/user-service
npm install
npm run test:coverage

# Gateway Service
cd services/gateway-service
npm install
npm run test:coverage
```

---

##  Notes Importantes

- **Gateway unique source de vérité** : Seul le Gateway gère les sessions utilisateur (`req.session.user`)
- **Frontend sans session propre** : Le Frontend Service lit les infos utilisateur depuis les headers HTTP transmis par le Gateway
- **Auth Service stateless** : L'Auth Service ne fait que vérifier les identifiants et retourner des données JSON
- **Images GHCR** : Les manifests K8s pointent vers `ghcr.io/cyber-pnl/k8sproject/...` pour le déploiement via ArgoCD
- **Auto-delivery** : Le job `delivery` de la CI met à jour automatiquement les tags d'images dans les manifests K8s
- **Skip CI** : Les commits de delivery incluent `[skip ci]` pour éviter les boucles infinies

---

##  Licence

Projet pédagogique - KubeLearn Platform

