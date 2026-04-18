FROM node:20-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json ./
COPY turbo.json ./

# Copy all package manifests first (for better layer caching)
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai/package.json ./packages/ai/
COPY packages/recorder/package.json ./packages/recorder/
COPY apps/api/package.json ./apps/api/

# Install all dependencies from root (resolves local packages)
RUN npm install

# Copy all source files
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

# Build the API
RUN cd apps/api && npx tsc

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
