# Projet Kubernetes — Application Multi-Container

Ce dépôt contient une application Node.js (Express) avec PostgreSQL et Redis, pensée comme projet pédagogique pour apprendre Kubernetes.  

L'objectif : construire l'image Docker, déployer les composants dans Kubernetes, et faire tourner chaque application avec 2 réplicas (ReplicaSet ou StatefulSet selon le service).

---

## Architecture

- **Node.js (Express)** — `app/index.js`  
- **PostgreSQL** — base de données relationnelle  
- **Redis** — cache  
- **Kubernetes** — orchestration des microservices  
- **Service headless** pour PostgreSQL : `postgres-headless-service.yaml`  

---

## Prérequis

- Docker  
- `kubectl`  
- Minikube ou Kind (ou un cluster Kubernetes accessible)  
- Node.js et npm (pour exécuter l’app localement)

---

## Exécution locale (sans Kubernetes)

1. Aller dans le dossier de l'application :

```bash
cd app
npm init -y
npm install express pg redis
npm install ejs
npm install express-session
npm install bcrypt

````

---

## Construire l'image Docker

### Avec Minikube (recommandé pour dev) :

```bash
eval $(minikube docker-env)
docker build -t node-app .

```

### Avec Kind ou Docker local :

Dans le fichier où il ya le dockerfile

```bash
docker build -t node-app .

# si Kind :
kind load docker-image node-app . --name kind
```

---

## Installation de Minikube

Minikube permet de créer un **cluster Kubernetes local** pour le développement et les tests.

###  Prérequis

* Virtualisation activée (VirtualBox, HyperKit, Hyper-V, KVM…)
* `kubectl` installé :

```bash
kubectl version --client
```

* `curl` ou `wget` pour télécharger Minikube

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

###  Démarrer un cluster Minikube

```bash
minikube start
kubectl get nodes
```

###  Accéder au dashboard Minikube

```bash
minikube dashboard
```

###  Arrêter et supprimer Minikube

```bash
minikube stop
minikube delete
```

---

## Déploiement Kubernetes (avec 2 réplicas par service)

Nous utilisons **ReplicaSet** pour les services stateless et **StatefulSet** pour PostgreSQL (stateful).

### Créer un secret Kubernetes pour PostgreSQL

```bash
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=postgres \
  --from-literal=POSTGRES_DB=testdb

  kubectl create secret generic app-secret \
  --from-literal=SESSION_SECRET=ma_clef_ultra_complexe_123
```

### Appliquer les manifests Kubernetes

```bash
kubectl apply -f postgres-headless-service.yaml
kubectl apply -f postgres-statefulset.yaml
kubectl apply -f node-deployments.yaml
kubectl apply -f node-service.yaml  
kubectl apply -f redis-deployment.yaml
kubectl apply -f redis-service.yaml 
kubectl apply -f scan-node-app-cronjob.yaml
```

### Vérifier les pods et réplicas

```bash
kubectl get rs
kubectl get pods
kubectl get svc
```
> Vous devriez voir 2 réplicas par application Node et PostgreSQL.

### Pour lancer l'application

```bash
minikube service node-app
```

---

## Notes & conseils

* **ReplicaSet** gère la réplication, mais ne fournit pas les rollouts/rollbacks automatiques. Pour ça, préférez **Deployment**, qui crée et gère des ReplicaSets.
* **Service headless pour PostgreSQL** : permet le discovery entre réplicas si besoin ; attention : PostgreSQL en mode single-node ne se scale pas facilement.
* **Mots de passe** : toujours gérer via Kubernetes **Secrets**, jamais en clair dans les manifests.
* **Cache Redis** : configurez la persistence si vous avez besoin de données durables.

---

## Dépannage rapide

* Voir les logs d’un pod :

```bash
kubectl logs <pod-name>
```

* Décrire une ressource pour plus de détails :

```bash
kubectl describe pod <pod-name>
```

* Supprimer et ré-appliquer un manifest :

```bash
kubectl delete -f <file>
kubectl apply -f <file>



