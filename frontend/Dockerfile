# Etapa 1: gera o build do React com o Vite
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# O Vite grava estas variáveis dentro do build, por isso
# elas entram como argumentos de build e não em tempo de execução
ARG VITE_API_URL=/api
ARG VITE_ENTRA_TENANT_ID=
ARG VITE_ENTRA_CLIENT_ID=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_ENTRA_TENANT_ID=$VITE_ENTRA_TENANT_ID \
    VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID

RUN npm run build

# Etapa 2: só os arquivos prontos, servidos pelo nginx
FROM nginx:1.27-alpine

# nginx.conf (teste local, HTTP) ou nginx.prod.conf (servidor, HTTPS)
ARG NGINX_CONF=nginx.conf

COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
