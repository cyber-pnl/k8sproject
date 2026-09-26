# Règles du projet KubeLearn

## Contexte
- Monorepo Node.js 20 (Express) avec workspaces npm. Microservices :
  - `services/gateway-service` (port 3000) — session, `/login`, `/signup`, `/logout`, proxies `/api` (→ user:3002), `/api/courses` et `/api/progress` (→ course:3004), `/` (→ frontend:3003)
  - `services/auth-service` (3001) — `/auth/verify`, `/auth/register`
  - `services/user-service` (3002) — API métier, table `users`
  - `services/course-service` (3004) — catalogue de cours + progression. Contenu des leçons en Markdown dans un bucket **S3** (`courses/<courseId>/<lessonId>.md`) lu via `@aws-sdk/client-s3`, rendu `marked`. Endpoints : liste/détail cours (public), leçons (auth), CRUD admin, `/api/progress*` (auth). Tables `courses`, `lessons`, `enrollments`, `lesson_progress`.
  - `services/frontend-service` (3003) — EJS, lit les headers `x-user-*` injectés par le gateway
- Infra de prod : k3s + ArgoCD + Traefik sur EC2. Domaine : `https://kubelearn.duckdns.org` (HTTPS).

## Git & GitOps (IMPORTANT)
- **Tout changement qui doit atteindre la prod passe par `git push` sur `main`.** ArgoCD (`argocd-app.yaml`) est en auto-sync/selfHeal/prune sur le dossier `k8s/`. Aucun autre moyen de déployer.
- **Commits conventionnels obligatoires** : `fix(...)`, `feat(...)`, `chore(...)`, `docs(...)`, `test(...)`. Ex. : `fix(auth): redirect users to dashboard after login or signup`. Regarder le style des commits récents avant de committer.
- Le CI (`.github/workflows/CI.yml`) sur push→main exécute lint → test → security → `build-push` (images GHCR taggées par SHA) → `delivery` qui met à jour les tags dans `k8s/*-deployment.yaml` via un commit `chore: update images to <sha> [skip ci]`. Ce commit ne déclenche pas la CI (`[skip ci]`). Matrices : auth, user, gateway, course (+ frontend pour build-push).
- **Ne JAMAIS modifier à la main** les manifests `k8s/` déployés au cluster : ArgoCD self-heal les écraserait. Toute modif passe par git.
- Après un push, attendre tout le pipeline CI + le sync ArgoCD avant de vérifier en prod (voir le skill `kubelearn-gitops`).

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
- Lancer les tests : `npm test --workspace <service>`. La CI couvre auth, user, gateway, course.
- Le lint local est cassé (eslint 8 + `eslint.config.mjs` → `ERR_PACKAGE_PATH_NOT_EXPORTED`) et non bloquant en CI (le job lint se termine toujours à `0`). Ne pas y consacrer du temps inutile.
- **Important** : `jest.mock('connect-redis')` dans les tests gateway utilise un mock avec factory (voir `services/gateway-service/tests/index.test.js`). Ne pas casser le mock du store de session.

## Pièges connus
- `http-proxy-middleware` v3+ **ignore l'option legacy `onProxyReq`**. Utiliser l'API v3 : `on: { proxyReq: (proxyReq, req, res) => {} }`. Déjà corrigé dans `services/gateway-service/index.js`. Toujours vérifier la version installée avec `node -p "require('http-proxy-middleware/package.json').version"` avant d'ajouter des options de proxy.
- Les rôles sont en lowercase partout (`role='data'`→ non, `'admin'`/`'user'`) : comparer avec `String(role).toLowerCase()`. Migrations idempotentes (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `UPDATE users SET role = LOWER(role)`) dans auth/user/course services.
- Les proxies `/api/courses` et `/api/progress` du gateway DOIVENT être déclarés AVANT le proxy `/api` (sinon matchés par erreur). Attention : `http-proxy-middleware` v3 monté via `app.use('/api/courses', …)` **retire le préfixe monté** (la cible reçoit `/` au lieu de `/api/courses`, → 404). Toujours utiliser le style `pathFilter: '/api/courses'` **sans** montage par préfixe (et jamais de `pathRewrite` qui casserait les routes `/api/...` de user/course-service).
- Le frontend décide l'authentification uniquement via les headers `x-user-id`/`x-user-role`/`x-user-name` injectés par le gateway (jamais par cookie direct). Si le dashboard renvoie vers `/login`, c'est que ces headers ne sont pas injectés.
- Session dispo dans Redis (`sess:<sid>`) même quand le bug headers se produit : cookie+Rédis ne sont pas forcément en cause.

## Accès prod (résumé, détails dans le skill `kubelearn-prod-debug`)
- SSH : `ssh -i terraform/environments/prod/k8sproject-key.pem -o StrictHostKeyChecking=no ec2-user@35.87.120.208`
- Sur le nœud : `export KUBECONFIG=/etc/rancher/k3s/k3s.yaml` (souvent besoin de `sudo`).