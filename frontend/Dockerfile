FROM node:22-slim

WORKDIR /app

# Install dependencies only (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

EXPOSE 5173

# Set Docker environment for HMR configuration
ENV DOCKER_ENV=true

# Run Vite dev server with proper HMR settings
CMD ["npm", "run", "dev"]
