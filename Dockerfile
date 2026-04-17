FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY turbo.json ./

COPY packages/shared/package.json ./packages/shared/
COPY packages/ai/package.json ./packages/ai/
COPY packages/recorder/package.json ./packages/recorder/
COPY apps/api/package.json ./apps/api/

RUN npm install

COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

RUN cd apps/api && npx tsc

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
