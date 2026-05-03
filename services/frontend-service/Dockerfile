# Étape 1 : Installation des dépendances
FROM node:18-alpine AS deps
WORKDIR /app

# On copie les fichiers qu'on vient de coller dans le dossier
COPY package.json package-lock.json ./

# Installation stricte des dépendances de production
RUN npm ci --omit=dev

# Étape 2 : Image finale
FROM node:18-alpine
WORKDIR /app

# On récupère les modules et le code
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3003
CMD ["node", "index.js"]