FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY services/payments/package.json services/payments/
COPY packages/contracts/package.json packages/contracts/
COPY packages/event-bus/package.json packages/event-bus/
COPY packages/database/package.json packages/database/

RUN npm install

COPY . .

RUN npm run build -w packages/contracts
RUN npm run build -w packages/event-bus
RUN npm run build -w packages/database
RUN npm run build -w services/payments

CMD ["npm", "start", "-w", "services/payments"]
