# Usa imagem oficial Node
FROM node:20-slim

# Dependências mínimas do sistema (Baileys não precisa de Chromium)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    git \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências primeiro (melhor cache de build)
COPY package*.json ./
RUN npm install --omit=dev

# Copia o restante do código
COPY . .

ENV NODE_ENV=production

# Sessões e histórico ficam em /app/data — monte um volume aqui para persistir
# entre deploys (no Railway: Settings > Volumes > mount path /app/data).

EXPOSE 3000

CMD ["npm", "start"]
