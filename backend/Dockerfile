FROM node:22-alpine

WORKDIR /app

# Só as dependências de produção (sem nodemon)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
