FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY index.js ./
COPY views ./views
COPY public ./public

# Expose port
EXPOSE 3003

# Start command
CMD ["node", "index.js"]

