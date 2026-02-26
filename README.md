# KubeLearn - Kubernetes Learning Platform

Projet pedagogique microservices (Node.js/Express) avec PostgreSQL et Redis, deploye sur Kubernetes.

---

## Architecture

L'architecture comprend un API Gateway comme point d'entree unique et plusieurs microservices.

### Diagramme de l'Architecture

```
                                    ┌─────────────────────────────────────┐
                                    │         Gateway Service           │
                                    │            (Port 3000)             │
                                    │   Point d'entree, gestion session │
                                    │         LoadBalancer :80           │
                                    └─────────────────┬───────────────────┘
                                                      │
                          ┌───────────────────────────┼───────────────────────────┐
                          │                           │                           │
                 ┌────────▼─────────┐        ┌────────▼─────────┐        ┌────────▼─────────┐
                 │  Auth Service   │        │  Frontend Service│        │  User Service    │
                 │   (Port 3001)   │        │   (Port 3003)    │        │   (Port 3002)    │
                 │ Authentification│        │   Rendu EJS      │        │  Gestion utilisateurs│
                 └────────┬────────┘        └────────┬─────────┘        └────────┬─────────┘
                          │                          │                           │
                          └──────────────────────────┼───────────────────────────┘
                                                   │
                    ┌──────────────────────────────┴──────────────────────────────┐
                    │                                                           │
           ┌────────▼─────────┐                                     ┌────────────▼────────┐
           │    PostgreSQL    │                                     │       Redis         │
           │    (Port 5432)   │                                     │     (Port 6379)     │
           │   Base de donnees│                                     │  Sessions & Cache   │
           └──────────────────┘                                     └─────────────────────┘
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Gateway Service | 3000 (ext: 80) | Point d'entree, routage, gestion de session centralisee |
| Frontend Service | 3003 | Rendu des vues EJS (pages HTML) |
| Auth Service | 3001 | Authentification (login, signup, logout), verification utilisateurs |
| User Service | 3002 | API de gestion des utilisateurs |
| PostgreSQL | 5432 | Base de donnees relationnelle |
| Redis | 6379 | Stockage des sessions et cache |

---

## Structure du Projet

```
.
├── app/                           # Application monolithique (version originale/reference)
│   ├── src/
│   │   ├── modules/              # Modules (auth, users, pages)
│   │   ├── shared/               # Code partage (database, redis, middlewares)
│   │   └── ...
│   ├── views/                    # Vues EJS
│   └── index.js                 # Point d'entree
│
├── services/                     # Code source des microservices
│   ├── gateway-service/         # Service Gateway (port 3000)
│   │   └── index.js             # Routage, session centralisee
│   │
│   ├── frontend-service/        # Service Frontend (port 3003)
│   │   ├── views/               # Vues EJS (home, login, signup, dashboard)
│   │   └── index.js             # Rendu des pages
│   │
│   ├── auth-service/            # Service Authentification (port 3001)
│   │   └── src/
│   │       ├── modules/auth/    # Routes et controleur auth
│   │       └── shared/          # Database, Redis, middlewares
│   │
│   └── user-service/            # Service Utilisateurs (port 3002)
│       └── src/
│           ├── modules/users/    # Routes et service utilisateurs
│           └── shared/          # Database, middlewares
│
├── k8s/                          # Manifests Kubernetes
│   ├── auth-deployment.yaml     # Deploiement Auth Service
│   ├── auth-service.yaml        # Service Auth
│   ├── frontend-deployment.yaml # Deploiement Frontend
│   ├── frontend-service.yaml    # Service Frontend
│   ├── gateway-deployment.yaml  # Deploiement Gateway
│   ├── gateway-service.yaml     # Service Gateway
│   ├── user-deployment.yaml     # Deploiement User Service
│   ├── user-service.yaml        # Service User
│   ├── postgres-*.yaml          # PostgreSQL (StatefulSet)
│   ├── redis-*.yaml             # Redis (Deployment)
│   ├── app-secret.yaml          # Secrets applicatifs
│   └── network-policies.yaml    # Politiques reseau
│
├── setup.sh                      # Script de demarrage automatique
└── README.md
```

---



### Processus de connexion:

1. L'utilisateur soumet le formulaire de login/signup
2. Le gateway recoit la requete et appelle l'auth-service via API REST
3. L'auth-service verifie les identifiants et retourne les donnees utilisateur en JSON
4. Le gateway definit la session utilisateur
5. Le gateway transmet les infos utilisateur au frontend via des headers (x-user-id, x-user-name, x-user-role)
6. Le frontend lit ces headers et affiche le header connecte

### Headers transmis:

| Header | Description |
|--------|-------------|
| x-user-id | ID de l'utilisateur |
| x-user-name | Nom d'utilisateur |
| x-user-role | Role (user/admin) |

---

## Prerequisites

- Docker
- kubectl
- Minikube ou Kind (ou cluster Kubernetes)
- Node.js et npm (developpement local)

---

## Script de Demarrage (setup.sh)

Le projet inclut un script `setup.sh` qui automatise toute la configuration:

```bash
./setup.sh
```

Ce script:
1. Demarre Minikube
2. Configure Docker pour Minikube
3. Construit toutes les images Docker
4. Cree les secrets Kubernetes
5. Deploie tous les services Kubernetes

---

## Construction des Images Docker

### Avec Minikube:

```bash
eval $(minikube docker-env)
```

### Construire chaque service:

```bash
# Gateway Service
cd services/gateway-service
docker build -t gateway-service:latest .

# Frontend Service
cd services/frontend-service
docker build -t frontend-service:latest .

# Auth Service
cd services/auth-service
docker build -t auth-service:latest .

# User Service
cd services/user-service
docker build -t user-service:latest .
```

### Avec Kind:

```bash
# Construire
docker build -t gateway-service:latest ./services/gateway-service
docker build -t frontend-service:latest ./services/frontend-service
docker build -t auth-service:latest ./services/auth-service
docker build -t user-service:latest ./services/user-service

# Charger dans Kind
kind load docker-image gateway-service:latest --name kind
kind load docker-image frontend-service:latest --name kind
kind load docker-image auth-service:latest --name kind
kind load docker-image user-service:latest --name kind
```

---

## Deploiement Kubernetes

### 1. Creer les Secrets

```bash
# Secret PostgreSQL
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=postgres \
  --from-literal=POSTGRES_DB=kubelearn

# Secret Application
kubectl create secret generic app-secret \
  --from-literal=SESSION_SECRET=votre_clef_secrete_securisee
```

### 2. Deployer PostgreSQL et Redis

```bash
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/redis-service.yaml
```

### 3. Deployer les Microservices

```bash
kubectl apply -f k8s/auth-deployment.yaml

```

### 4. Acceder a l'application

```bash
minikube service gateway-service
```

---

## Routage

| Route | Service | Description |
|-------|---------|-------------|
| GET / | Gateway -> Frontend | Page d'accueil |
| GET /login | Gateway -> Frontend | Page connexion |
| GET /signup | Gateway -> Frontend | Page inscription |
| POST /login | Gateway -> Auth (API) | Traitement connexion |
| POST /signup | Gateway -> Auth (API) | Traitement inscription |
| GET /logout | Gateway | Deconnexion |
| GET /dashboard | Gateway -> Frontend | Tableau de bord (protege) |
| /api/* | Gateway -> User Service | API utilisateurs |

---

## Variables d'Environnement

### Gateway Service

| Variable | Defaut | Description |
|----------|--------|-------------|
| PORT | 3000 | Port du service |
| AUTH_SERVICE_URL | http://auth-service:3001 | URL auth service |
| USER_SERVICE_URL | http://user-service:3002 | URL user service |
| FRONTEND_URL | http://frontend-service:3003 | URL frontend service |
| SESSION_SECRET | - | Secret de session |

### Frontend Service

| Variable | Defaut | Description |
|----------|--------|-------------|
| PORT | 3003 | Port du service |
| REDIS_URL | redis://redis-service:6379 | URL Redis |

### Auth Service

| Variable | Defaut | Description |
|----------|--------|-------------|
| PORT | 3001 | Port du service |
| POSTGRES_USER | postgres | Utilisateur PostgreSQL |
| POSTGRES_PASSWORD | postgres | Mot de passe PostgreSQL |
| POSTGRES_DB | kubelearn | Nom de la base |
| REDIS_URL | redis://redis-service:6379 | URL Redis |
| SESSION_SECRET | - | Secret de session |

---


## Depannage

### Voir les logs:

```bash
kubectl logs <pod-name>
```

### Redemarrer un service:

```bash
kubectl rollout restart deployment/<nom-deployment>
```

### Verifier les evenements:

```bash
kubectl get events --sort-by='.lastTimestamp'
```

---

## Notes

- Le Gateway gere centralement les sessions - c'est le seul point qui definit req.session.user
- Le Frontend Service lit les infos utilisateur depuis les headers transmis par le gateway
- L'Auth Service ne fait que verifier les identifiants et retourner les donnees utilisateur en JSON
- Le monolith (app/) est fourni pour reference et peut etre utilise independamment

