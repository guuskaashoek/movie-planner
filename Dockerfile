FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ git curl unzip bash

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="~/.bun/bin:${PATH}"
RUN ln -s ~/.bun/bin/bun /usr/local/bin/bun

# Copy package files first for better caching
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies
RUN bun install || npm install

# Copy source code
COPY . .


ENV DATABASE_URL="file:./local.db"
ENV NEXTAUTH_SECRET="dummy_secret_for_build_purposes_only"
ENV NEXTAUTH_URL="http://localhost:3000"




# Build Next.js
RUN bun run build || npm run build

# Expose port
EXPOSE 3000

# Start
CMD ["bun", "run", "start"]
