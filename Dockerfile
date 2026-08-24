# Usa imagem oficial Node
FROM node:20-slim

# Dependências mínimas do sistema (Baileys não precisa de Chromium)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    git \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala as dependências do módulo wpp_monitor primeiro (melhor cache de build)
COPY wpp_monitor/package*.json ./wpp_monitor/
RUN npm install --omit=dev --prefix wpp_monitor

# Copia o restante do código
COPY . .

ENV NODE_ENV=production

# Sessões e histórico ficam em /app/wpp_monitor/data — monte um volume aqui
# para persistir entre deploys (Railway: Settings > Volumes).

EXPOSE 3000

CMD ["node", "wpp_monitor/index.js"]
