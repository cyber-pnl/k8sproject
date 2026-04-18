FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN apk add --no-cache python3 make g++ \
  && npm install --omit=dev \
  && apk del python3 make g++

FROM node:18-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY index.js ./
EXPOSE 3002
CMD ["node", "index.js"]

