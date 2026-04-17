FROM node:18-alpine

WORKDIR /app

# Copy shared package files
COPY ../../shared/package*.json ./
RUN npm ci --omit=dev

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src
COPY index.js ./
# Expose port
EXPOSE 3001

# Start command
CMD ["node", "index.js"]

