FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev

FROM node:18-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY index.js ./
COPY public ./public
COPY views ./views
EXPOSE 3003
CMD ["node", "index.js"]

