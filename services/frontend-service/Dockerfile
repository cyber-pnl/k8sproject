# ── STAGE 1 : INSTALLATION DES DÉPENDANCES STRICTES ──
FROM node:18-alpine AS deps
WORKDIR /app

# On ne copie QUE les fichiers de dépendances pour maximiser le cache Docker
COPY package.json package-lock.json ./

# npm ci (Clean Install) force l'utilisation stricte du package-lock.json,
# ignore le node_modules local et est beaucoup plus rapide.
RUN npm install --omit=dev && npm install ejs

# ── STAGE 2 : EXÉCUTION DE L'APPLICATION ──
FROM node:18-alpine
WORKDIR /app

# On récupère les node_modules propres et isolés du premier stage
COPY --from=deps /app/node_modules ./node_modules

# On copie le reste du code source
COPY index.js ./
COPY public ./public
COPY views ./views

EXPOSE 3003

# Sécurité : On n'exécute pas l'application en root (fourni par l'image alpine)
USER node

CMD ["node", "index.js"]