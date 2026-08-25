FROM node:24-bookworm-slim

WORKDIR /app

# Dependências necessárias para algumas libs nativas
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl \
    && rm -rf /var/lib/apt/lists/*

# Copia primeiro os arquivos de dependência
COPY package*.json ./

# Instala exatamente o que está no package-lock
RUN npm ci

# Copia o projeto
COPY . .

# Compila o TypeScript
RUN npm run build

# Diretórios persistentes
RUN mkdir -p /app/auth /app/data

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]