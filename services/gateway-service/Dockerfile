FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --force

# Copy source code
COPY index.js ./

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "index.js"]

