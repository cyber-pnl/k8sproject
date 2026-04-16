FROM node:18-alpine

WORKDIR /app

# Copy shared package files
COPY ../shared/package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY src ./src
COPY index.js ./

# Expose port
EXPOSE 3002

# Start command
CMD ["node", "index.js"]

