FROM node:22-alpine

WORKDIR /workspace

COPY package.json tsconfig.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["npm", "run", "smoke"]
