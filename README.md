# Projet Kubernetes — Microservices

Ce dépôt contient une application microservices (Node.js/Express) avec PostgreSQL et Redis, déployée sur Kubernetes. Le projet a été conçu comme un projet pédagogique pour apprendre les microservices et Kubernetes.

L'objectif : construire les images Docker, déployer les composants dans Kubernetes, et faire tourner chaque service avec 2 réplicas.

---

## Architecture Microservices

L'**API Gateway** est le point d'entrée unique de l'application. Il reçoit toutes les requêtes des utilisateurs et les redirige vers les services appropriés.

### Pourquoi un Gateway ?

1. **Point d'entrée unique** - Les utilisateurs accèdent à un seul endpoint (port 80/3000) au lieu de connaître tous les services
2. **Routage** - Dirige les requêtes vers Auth Service ou User Service selon l'URL
3. **Gestion de session** - Gère les sessions utilisateur avec express-session
4. **Propagation des headers** - Transmet les infos utilisateur (x-user-id, x-user-role) aux services backend
5. **Sécurité** - Cache l'architecture interne aux clients externes

### Fonctionnement du Gateway

```
                                    ┌─────────────────────┐
                                    │   Gateway Service  │
                                    │      (Port 3000)   │
                                    │   LoadBalancer :80 │
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    │                                                         │
           ┌────────▼─────────┐                                    ┌────────▼─────────┐
           │   Auth Service   │                                    │   User Service   │
           │    (Port 3001)  │                                    │    (Port 3002)  │
           │   2 Réplicas    │                                    │   2 Réplicas    │
           └────────┬────────┘                                    └────────┬─────────┘
                    │                                                      │
                    └──────────────────────┬──────────────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                               │
           ┌────────▼─────────┐                            ┌───────▼────────┐
           │    PostgreSQL    │                            │     Redis     │
           │    (Port 5432)   │                            │   (Port 6379) │
           └──────────────────┘                            └───────────────┘
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Gateway Service | 3000 (ext: 80) | API Gateway, routage vers les microservices |
| Auth Service | 3001 | Authentification (login, signup, logout) |
| User Service | 3002 | Gestion des utilisateurs |
| PostgreSQL | 5432 | Base de données relationnelle |
| Redis | 6379 | Cache session |

---

## Structure du Projet

```
.
├── app/                      # Application monolithique originale (référence)
├── services/                 # Code source des microservices
│   ├── gateway-service/      # Service Gateway (port 3000)
│   ├── auth-service/         # Service Authentification (port 3001)
│   └── user-service/         # Service Utilisateurs (port 3002)
├── k8s/                      # Manifests Kubernetes
│   ├── services/             # Deployments et Services des microservices
│   ├── postgres-*.yaml       # PostgreSQL (StatefulSet)
│   ├── redis-*.yaml         # Redis (Deployment)
│   └── network-policies.yaml # Politiques réseau
└── README.md
```

---

## Prérequis

- Docker
- `kubectl`
- Minikube ou Kind (ou un cluster Kubernetes accessible)
- Node.js et npm (pour exécuter localement)

---

## Construction des Images Docker

### Avec Minikube (recommandé) :

```bash
eval $(minikube docker-env)
```

### Construire chaque service :

```bash
# Auth Service
cd services/auth-service
docker build -t auth-service:latest .

# User Service
cd services/user-service
docker build -t user-service:latest .

# Gateway Service
cd services/gateway-service
docker build -t gateway-service:latest .
```

### Avec Kind :

```bash
# Construire les images
docker build -t auth-service:latest ./services/auth-service
docker build -t user-service:latest ./services/user-service
docker build -t gateway-service:latest ./services/gateway-service

# Charger dans Kind
kind load docker-image auth-service:latest --name kind
kind load docker-image user-service:latest --name kind
kind load docker-image gateway-service:latest --name kind
```

---

## Installation de Minikube

Minikube permet de créer un **cluster Kubernetes local**.

### Prérequis

- Virtualisation activée (VirtualBox, HyperKit, Hyper-V, KVM…)
- `kubectl` installé :

```bash
kubectl version --client
```

### Installation

#### Linux (Ubuntu/Debian)

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
minikube version
```

#### macOS (Homebrew)

```bash
brew install minikube
minikube version
```

#### Windows (Chocolatey)

```powershell
choco install minikube
minikube version
```

### Démarrer le cluster

```bash
minikube start
kubectl get nodes
```

### Accéder au dashboard

```bash
minikube dashboard
```

### Arrêter et supprimer

```bash
minikube stop
minikube delete
```

---

## Déploiement Kubernetes

### 1. Créer les Secrets

```bash
# Secret PostgreSQL
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=postgres \
  --from-literal=POSTGRES_DB=testdb

# Secret Application
kubectl create secret generic app-secret \
  --from-literal=SESSION_SECRET=ma_clef_ultra_complexe_123
```

### 2. Déployer PostgreSQL et Redis

```bash
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/redis-service.yaml
```

### 3. Déployer les Microservices

```bash
kubectl apply -f k8s/services/auth-service.yaml
kubectl apply -f k8s/services/user-service.yaml
kubectl apply -f k8s/services/gateway-service.yaml
```

### 4. (Optionnel) Appliquer les Politiques Réseau

```bash
kubectl apply -f k8s/network-policies.yaml
```

### 5. Vérifier le déploiement

```bash
# Vérifier les ReplicaSets
kubectl get rs

# Vérifier les pods
kubectl get pods

# Vérifier les services
kubectl get svc
```

> Vous devriez voir 2 réplicas par service microservice.

### 6. Accéder à l'application

```bash
minikube service gateway-service
```

---

## Politiques Réseau (Network Policies)

Le projet inclut des politiques réseau avancées pour la sécurité :

| Politique | Description |
|-----------|-------------|
| `deny-all` | Bloque tout trafic par défaut |
| `allow-dns` | Autorise les requêtes DNS |
| `allow-gateway-to-backend` | Gateway → Auth & User services |
| `allow-backend-to-db` | Services → PostgreSQL |
| `allow-ingress-postgres` | PostgreSQL accepte les connexions internes |
| `allow-backend-to-redis` | Services → Redis |
| `allow-ingress-redis` | Redis accepte les connexions internes |

---

## Variables d'Environnement

### Gateway Service

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | 3000 | Port du service |
| `AUTH_SERVICE_URL` | http://auth-service:3001 | URL du service auth |
| `USER_SERVICE_URL` | http://user-service:3002 | URL du service user |
| `SESSION_SECRET` | gateway-secret | Secret de session |

### Auth Service / User Service

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | 3001/3002 | Port du service |
| `POSTGRES_USER` | postgres | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | postgres | Mot de passe PostgreSQL |
| `POSTGRES_DB` | testdb | Nom de la base |
| `SESSION_SECRET` | ma_clef_ultra_complexe_123 | Secret de session |

---

## Routage

| Route | Service | Description |
|-------|---------|-------------|
| `/` | Gateway → Auth | Page d'accueil |
| `/login` | Gateway → Auth | Connexion |
| `/signup` | Gateway → Auth | Inscription |
| `/logout` | Gateway → Auth | Déconnexion |
| `/dashboard` | Gateway → Auth | Tableau de bord (protégé) |
| `/api/users` | Gateway → User | API utilisateurs |

---

## Dépannage

### Voir les logs d'un pod

```bash
kubectl logs <pod-name>
```

### Décrire une ressource

```bash
kubectl describe pod <pod-name>
```

### Supprimer et ré-appliquer

```bash
kubectl delete -f <fichier>
kubectl apply -f <fichier>
```

### Redémarrer un service

```bash
kubectl rollout restart deployment/<nom-du-deployment>
```

### Vérifier les événements

```bash
kubectl get events --sort-by='.lastTimestamp'
```

---

## Notes & Conseils

- **ReplicaSet** gère la réplication, mais pas les rollouts automatiques. Utilisez **Deployment** pour cela.
- **StatefulSet** est utilisé pour PostgreSQL (données persistantes).
- Les mots de passe doivent toujours être gérés via **Kubernetes Secrets**.
- Configurez la persistence Redis si vous avez besoin de données durables.
- Les politiques réseau nécessitent un plugin CNI compatible (Calico, Cilium, etc.).

