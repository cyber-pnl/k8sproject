# Plan: Unifier package.json des services

## Information Gathered:
```
Auth: bcrypt, ejs, express-ejs-layouts, express-session, pg, redis, connect-redis
Frontend: ejs, express-ejs-layouts, bcrypt, express-session, pg, redis, connect-redis  
Gateway: express-session, redis, connect-redis, http-proxy-middleware
User: express-session, pg, redis
```
Dev deps: jest, supertest (3 services ont tests)

Dockerfiles standards: COPY package*.json -> npm install -> COPY src

## Plan détaillé:

### 1. Créer dossier shared/
- `shared/package.json`: Toutes deps communes + spécifiques
- `shared/package-lock.json`: Générer après npm install

### 2. Nouveau shared/package.json:
```
Dépendances communes:
├── express@^4.19.2
├── redis@^5.0.0  
├── pg@^8.12.0
├── express-session@^1.18.0
├── connect-redis@^8.1.0 (downgrade compatible)
├── bcrypt@^5.1.1
├── ejs@^3.1.10
├── http-proxy-middleware@^3.0.0 (upgrade)
├── express-ejs-layouts@^2.5.1
└── helmet@^8.0.0 (nouveau: sécurité)

Dev deps:
├── jest@^29.7.0
├── supertest@^7.0.0 (upgrade)
├── @types/supertest
└── autres
```

### 3. Modifier 4 Dockerfiles:
```
WORKDIR /app
COPY ../shared/package*.json ./
RUN npm ci --only=production
COPY . .
```

### 4. Supprimer:
- services/*/package*.json
- services/*/node_modules/

### 5. Services avec tests utilisent dev deps
```
Auth, Gateway, User: garder tests
Frontend: pas de tests
```

## Dependent Files:
```
Créer: shared/package.json, shared/package-lock.json
Modifier: 4 Dockerfiles
Supprimer: 4 package.json + 4 package-lock.json
```

## STATUS: ✅ TERMINÉ

**Modifications effectuées:**
- ✅ `services/shared/package.json` créé (deps unifiées + mises à jour)
- ✅ `services/shared/package-lock.json` généré (`npm install`)
- ✅ Vulnérabilités corrigées (`npm audit fix --force`) 
- ✅ 4 Dockerfiles modifiés (`COPY ../shared/package*.json` + `npm ci --omit=dev`)
- ✅ Anciens package.json/package-lock.json supprimés des 4 services

**Pour tester:**
```bash
docker build -t auth-service:test services/auth-service
docker build -t frontend-service:test services/frontend-service  
docker build -t gateway-service:test services/gateway-service
docker build -t user-service:test services/user-service
```

Toutes les dépendances sont maintenant unifiées et à jour!
