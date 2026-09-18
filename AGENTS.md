# Règles du projet KubeLearn

## Contexte
- Monorepo Node.js 20 (Express) avec workspaces npm. Microservices :
  - `services/gateway-service` (port 3000) — session, `/login`, `/signup`, `/logout`, proxies `/api` (→ user:3002) et `/` (→ frontend:3003)
  - `services/auth-service` (3001) — `/auth/verify`, `/auth/register`
  - `services/user-service` (3002) — API métier
  - `services/frontend-service` (3003) — EJS, lit les headers `x-user-*` injectés par le gateway
- Infra de prod : k3s + ArgoCD + Traefik sur EC2. Domaine : `https://kubelearn.duckdns.org` (HTTPS).

## Git & GitOps (IMPORTANT)
- **Tout changement qui doit atteindre la prod passe par `git push` sur `main`.** ArgoCD (`argocd-app.yaml`) est en auto-sync/selfHeal/prune sur le dossier `k8s/`. Aucun autre moyen de déployer.
- **Commits conventionnels obligatoires** : `fix(...)`, `feat(...)`, `chore(...)`, `docs(...)`, `test(...)`. Ex. : `fix(auth): redirect users to dashboard after login or signup`. Regarder le style des commits récents avant de committer.
- Le CI (`.github/workflows/CI.yml`) sur push→main exécute lint → test → security → `build-push` (images GHCR taggées par SHA) → `delivery` qui met à jour les tags dans `k8s/*-deployment.yaml` via un commit `chore: update images to <sha> [skip ci]`. Ce commit ne déclenche pas la CI (`[skip ci]`).
- **Ne JAMAIS modifier à la main** les manifests `k8s/` déployés au cluster : ArgoCD self-heal les écraserait. Toute modif passe par git.
- Après un push, attendre tout le pipeline CI + le sync ArgoCD avant de vérifier en prod (voir le skill `kubelearn-gitops`).

## Sécurité
- Ne jamais committer de secrets : clés AWS (les creds AWS fournies par l'utilisateur, compte `764214840598`, région `us-west-2`), `SESSION_SECRET`, `.pem`, `*.tfplan`, `tfplan`. Ils sont (ou doivent être) dans `.gitignore`.
- Ne pas afficher de secrets dans les logs. Ne pas logger les mots de passe.

## Tests & lint
- Tests unitaires Jest par service (`services/*/jest.config.js`), supertest + nock.
- Lancer les tests : `npm test --workspace <service>`. La CI couvre auth, user, gateway.
- Le lint local est cassé (eslint 8 + `eslint.config.mjs` → `ERR_PACKAGE_PATH_NOT_EXPORTED`) et non bloquant en CI (le job lint se termine toujours à `0`). Ne pas y consacrer du temps inutile.
- **Important** : `jest.mock('connect-redis')` dans les tests gateway utilise un mock avec factory (voir `services/gateway-service/tests/index.test.js`). Ne pas casser le mock du store de session.

## Pièges connus
- `http-proxy-middleware` v3+ **ignore l'option legacy `onProxyReq`**. Utiliser l'API v3 : `on: { proxyReq: (proxyReq, req, res) => {} }`. Déjà corrigé dans `services/gateway-service/index.js`. Toujours vérifier la version installée avec `node -p "require('http-proxy-middleware/package.json').version"` avant d'ajouter des options de proxy.
- Le frontend décide l'authentification uniquement via les headers `x-user-id`/`x-user-role`/`x-user-name` injectés par le gateway (jamais par cookie direct). Si le dashboard renvoie vers `/login`, c'est que ces headers ne sont pas injectés.
- Session dispo dans Redis (`sess:<sid>`) même quand le bug headers se produit : cookie+Rédis ne sont pas forcément en cause.

## Accès prod (résumé, détails dans le skill `kubelearn-prod-debug`)
- SSH : `ssh -i terraform/environments/prod/k8sproject-key.pem -o StrictHostKeyChecking=no ec2-user@35.87.120.208`
- Sur le nœud : `export KUBECONFIG=/etc/rancher/k3s/k3s.yaml` (souvent besoin de `sudo`).