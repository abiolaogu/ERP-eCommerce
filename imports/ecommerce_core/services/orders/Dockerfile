# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /workspace
COPY package.json tsconfig.base.json jest.preset.cjs ./
COPY packages ./packages
COPY services/orders/package.json ./services/orders/
COPY services/catalog/package.json ./services/catalog/
COPY services/inventory/package.json ./services/inventory/
RUN npm install
COPY services/orders ./services/orders
RUN npm run build --workspace @fusioncommerce/orders-service
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/services/orders/dist ./dist
COPY services/orders/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/index.js"]
