FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ git

# Copy package.json only (fresh lockfile generated in Docker)
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code (includes .env and .env.local for build)
COPY . .



# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start Next.js
CMD ["npm", "run", "start"]
