FROM node:18-alpine

WORKDIR /app

# Copy shared package files
COPY ../../shared/package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY index.js ./
COPY views ./views
COPY public ./public

# Expose port
EXPOSE 3003

# Start command
CMD ["node", "index.js"]

