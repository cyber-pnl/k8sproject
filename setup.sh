#!/bin/bash

set -e  # stop si une commande échoue

echo " Démarrage de Minikube..."
minikube start

echo "Configuration du Docker de Minikube..."
eval $(minikube docker-env)

echo "Build des images..."
docker build -t auth-service:latest services/auth-service
docker build -t user-service:latest services/user-service
eval $(minikube docker-env)
docker build -t gateway-service:latest services/gateway-service
docker build -t frontend-service:latest services/frontend-service

echo " Création des secrets..."

kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=postgres \
  --from-literal=POSTGRES_DB=testdb \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic app-secret \
  --from-literal=SESSION_SECRET=votre_clef_secrete_securisee
  --from-literal=session-secret="your-super-secret-session-key-change-in-production" \
  --from-literal=database-url="postgresql://postgres:postgres@postgres-service:5432/kubelearn"
  --dry-run=client -o yaml | kubectl apply -f -

echo " Déploiement Kubernetes..."
kubectl apply -f k8s/

echo " Setup terminé !"

