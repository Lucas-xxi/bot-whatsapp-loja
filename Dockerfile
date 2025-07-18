# Usa imagem oficial Node
FROM node:18-slim

# Instala dependências do sistema (incluindo git)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    git \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Define diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Pula download do Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Instala dependências
RUN npm install

# Copia todo restante
COPY . .

# Expõe a porta (ajuste se precisar)
EXPOSE 3000

# Inicia
CMD ["npm", "start"]
