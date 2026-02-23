# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /workspace
COPY package.json tsconfig.base.json jest.preset.cjs ./
COPY packages ./packages
COPY services/orders/package.json ./services/orders/
COPY services/catalog/package.json ./services/catalog/
COPY services/inventory/package.json ./services/inventory/
COPY services/group-commerce/package.json ./services/group-commerce/
RUN npm install
COPY services/group-commerce ./services/group-commerce
RUN npm run build --workspace @fusioncommerce/group-commerce-service
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/services/group-commerce/dist ./dist
COPY services/group-commerce/package.json ./package.json
EXPOSE 3003
CMD ["node", "dist/index.js"]