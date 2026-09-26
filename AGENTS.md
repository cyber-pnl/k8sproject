# Règles du projet KubeLearn

## Contexte
- Monorepo Node.js 20 (Express) avec workspaces npm. Microservices :
  - **Pas de gateway-service** : remplacé par l'API Gateway Kubernetes (Traefik, provider `kubernetesgateway`) + logique de session dans l'auth-service.
  - `services/auth-service` (3001) — vérif credentials (`/auth/verify`, `/auth/register`), **sessions Redis** (`/auth/login`, `/auth/signup`, `/auth/logout` + alias racine `/login`, `/signup`, `/logout` que les forms du frontend postent), et cible **ForwardAuth** `GET /auth/session` qui renvoie les headers `X-User-*`.
  - `services/user-service` (3002) — API métier, table `users`
  - `services/course-service` (3004) — catalogue de cours + progression. Contenu des leçons en Markdown dans un bucket **S3** (`courses/<courseId>/<lessonId>.md`) lu via `@aws-sdk/client-s3`, rendu `marked`. Endpoints : liste/détail cours (public), leçons (auth), CRUD admin, `/api/progress*` (auth). Tables `courses`, `lessons`, `enrollments`, `lesson_progress`.
  - `services/frontend-service` (3003) — EJS, lit les headers `x-user-*` injectés par le ForwardAuth de Traefik
- Infra de prod : k3s + ArgoCD + Traefik (API Gateway) sur EC2. Domaine : `https://kubelearn.duckdns.org` (HTTPS).

## Git & GitOps (IMPORTANT)
- **Tout changement qui doit atteindre la prod passe par `git push` sur `main`.** ArgoCD (`argocd-app.yaml`, targetRevision `HEAD`) est en auto-sync/selfHeal/prune sur le dossier `k8s/`. Aucun autre moyen de déployer.
- **Commits conventionnels obligatoires** : `fix(...)`, `feat(...)`, `chore(...)`, `docs(...)`, `test(...)`. Ex. : `fix(auth): redirect users to dashboard after login or signup`. Regarder le style des commits récents avant de committer.
- Le CI (`.github/workflows/CI.yml`) sur push→main exécute lint → test → security → `build-push` (images GHCR taggées par SHA) → `delivery` qui met à jour les tags dans `k8s/*-deployment.yaml` via un commit `chore: update images to <sha> [skip ci]`. Ce commit ne déclenche pas la CI (`[skip ci]`). Matrices : auth, user, course (+ frontend pour build-push). Si les tags sont déjà identiques, `delivery` se termine sans nouveau commit.
- **Ne JAMAIS modifier à la main** les manifests `k8s/` déployés au cluster : ArgoCD self-heal les écraserait. Toute modif passe par git. Même remarque pour les MiddlewareTraefik/HTTPRoute/Gateway.
- Après un push, attendre tout le pipeline CI + le sync ArgoCD avant de vérifier en prod (voir le skill `kubelearn-gitops`). Si ArgoCD ne voit pas un nouveau commit, forcer : `kubectl patch app kubelearn-app -n argocd --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'`.

## Secrets k8s (créés via `kubectl create secret`, JAMAIS dans git)
- `app-secret` — `SESSION_SECRET`
- `postgres-secret` — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `s3-secret` — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` (via le module terraform `terraform/modules/s3`, IAM user **`k8sproject-content-prod`** ; bucket privé **`k8sproject-content-prod-764214840598`** (us-west-2) ; creds récupérables dans le cluster via `kubectl get secret s3-secret` )
- `admin-credentials` — seed du user admin

## Sécurité
- Ne jamais committer de secrets : clés AWS (les creds AWS fournies par l'utilisateur, compte `764214840598`, région `us-west-2`), `SESSION_SECRET`, `.pem`, `*.tfplan`, `tfplan`. Ils sont (ou doivent être) dans `.gitignore`.
- Ne pas afficher de secrets dans les logs. Ne pas logger les mots de passe.

## Tests & lint
- Tests unitaires Jest par service (`services/*/jest.config.js`), supertest + nock.
- Lancer les tests : `npm test --workspace <service>`. La CI couvre auth, user, course.
- Le lint local est cassé (eslint 8 + `eslint.config.mjs` → `ERR_PACKAGE_PATH_NOT_EXPORTED`) et non bloquant en CI (le job lint se termine toujours à `0`). Ne pas y consacrer du temps inutile.

## Pièges connus
- **API Gateway Kubernetes (Traefik)** : les **ports des listeners du Gateway DOIVENT matcher les ports des entrypoints** Traefik (k3s : `web`=8000, `websecure`=8443 en interne ; l'LB externe expose 80/443). Sinon `PortUnavailable`. L'enum des path types est `PathPrefix` (pas `Prefix`) sur les CRD k3s v1.2+. Les noms courts de services (`auth-service`) ne sont **pas résolubles** depuis le pod traefik (ns kube-system) : utiliser le FQDN (`auth-service.default.svc.cluster.local`) dans les `ForwardAuth`/backends HTTP.
- Les rôles sont en lowercase partout (`role='data'`→ non, `'admin'`/`'user'`) : comparer avec `String(role).toLowerCase()`. Migrations idempotentes (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `UPDATE users SET role = LOWER(role)`) dans auth/user/course services.
- Les routes de l'HTTPRoute sont ordonnées par spécificité dans le manifest `k8s/http-routes.yaml` (ex : `/api/courses` avant `/api`). Traefik garde le chemin du backend (pas de rewrite) : les services doivent répondre sur les mêmes chemins qu'exposés (`/login` etc. sur l'auth-service).
- Le frontend décide l'authentification uniquement via les headers `x-user-id`/`x-user-role`/`x-user-name` injectés par le ForwardAuth de Traefik (jamais par cookie direct). Si le dashboard renvoie vers `/login`, c'est que ces headers ne sont pas injectés (vérifier `GET /auth/session`).
- Session dispo dans Redis (`sess:<sid>`) même quand le bug headers se produit : cookie+Rédis ne sont pas forcément en cause.

## Accès prod (résumé, détails dans le skill `kubelearn-prod-debug`)
- SSH : `ssh -i terraform/environments/prod/k8sproject-key.pem -o StrictHostKeyChecking=no ec2-user@35.87.120.208`
- Sur le nœud : `export KUBECONFIG=/etc/rancher/k3s/k3s.yaml` (souvent besoin de `sudo`).