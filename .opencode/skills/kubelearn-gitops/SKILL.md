---
name: kubelearn-gitops
description: Workflow GitOps de déploiement KubeLearn (ArgoCD). Use when pushing code to reach production, deploying changes to kubelearn.duckdns.org, waiting for CI, checking ArgoCD sync, or knowing whether a commit reached prod.
---

# Workflow de déploiement KubeLearn (GitOps)

KubeLearn est déployé via **GitOps** : aucune action manuelle sur le cluster n'est nécessaire ni souhaitée. La seule façon d'atteindre la prod est un `git push` sur `main`.

## Pipeline complet

1. **Commit conventionnel** obligatoire : `fix(...)`, `feat(...)`, `chore(...)`, `docs(...)`.
   Signature type : `fix(auth): redirect users to dashboard after login or signup`.
   Vérifier `git log --oneline -10` pour le style avant de committer.

2. **Push sur `main`**. La CI (`.github/workflows/CI.yml`) s'exécute en cascade :

   | Job | Rôle |
   |-----|------|
   | `lint` | eslint (se termine à 0, non bloquant) |
   | `test` | Jest + coverage par service (auth, user, gateway) |
   | `security` | `npm audit --audit-level=moderate` |
   | `build-push` | images GHCR `ghcr.io/cyber-pnl/k8sproject/<service>:<sha>` |
   | `delivery` | commit `chore: update images to <sha> [skip ci]` qui met à jour `k8s/*-deployment.yaml` |

3. **ArgoCD** (`argocd-app.yaml`) est en auto-sync/selfHeal/prune sur le dossier `k8s/` du repo (branche `main`, HEAD). Dès que `delivery` a poussé les nouveaux tags, ArgoCD redéploie les pods (RollingUpdate).

4. **Vérifier en prod** uniquement après le sync ArgoCD (voir `kubelearn-prod-debug`).

## Délais
- CI complète : ~5-8 min (builds Docker).
- Sync ArgoCD : < 1 min après le commit `delivery`.
- Temps total avant de tester : ≥ 6-9 min après le push. Attendre que les pods tournent **sans** `ImagePullBackOff`.

## Pièges
- **Ne jamais modifier `k8s/*.yaml` dans l'UI du cluster** : self-heal écraserait. Toute modif passe par git.
- Ne pas commenter le commit `delivery` généré par la CI (il est authentique et nécessaire).
- Si un pod reste en `CreateContainerConfigError`, c'est un Secret manquant — pas un problème de code.
- Le check final côté serveur : l'auth-service doit exécuter le code avec les nouveaux logs (`Auth Service running on port 3001`, `Session store ready (Redis)`) présents dans `services/auth-service/index.js`. Le routage se vérifie via le Gateway : `kubectl get gateway kubelearn-gateway` (listeners `Accepted=True`) et `kubectl get httproute kubelearn-routes`.