FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src
COPY index.js ./

# Expose port
EXPOSE 3002

# Start command
CMD ["node", "index.js"]

