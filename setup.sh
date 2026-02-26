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
  --from-literal=SESSION_SECRET=ma_clef_ultra_complexe_123 \
  --dry-run=client -o yaml | kubectl apply -f -

echo " Déploiement Kubernetes..."
kubectl apply -f k8s/

echo " Setup terminé !"

