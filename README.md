# 🚀 Bot WhatsApp Loja

O sistema inteiro de WhatsApp vive no módulo **[`wpp_monitor/`](wpp_monitor/)** —
uma pasta autocontida com multi-instância persistente: cada número com sua
própria instância, sessão salva e reconexão automática. Para levar para outro
sistema, basta copiar a pasta `wpp_monitor/`.

## ✅ Rodando

```bash
npm install        # instala as dependências do wpp_monitor automaticamente
PANEL_TOKEN=minha-senha npm start
# abra http://localhost:3000 → aba "📡 WPP Monitor"
```

## ☁️ Deploy (Railway)

1. Conecte o repositório ao Railway (builda pelo `Dockerfile`).
2. **Crie um volume com mount path `/app/wpp_monitor/data`** — é isso que faz
   as sessões sobreviverem a deploys e reinícios.
3. Defina `PANEL_TOKEN` nas variáveis (obrigatório: o QR dá acesso ao WhatsApp).
4. Abra a URL pública → aba **⚙️ Configurar** → conecte cada número escaneando
   o QR (*WhatsApp > Aparelhos conectados > Conectar aparelho*).
5. Acompanhe tudo na aba **📡 WPP Monitor**. 🚗💬

## 💡 Fotos

Edite `wpp_monitor/fotos.json` com as chaves e links `raw` das fotos da pasta
`images/`. Quando o cliente enviar a chave (ex: `corolla2020`), o bot responde
com as imagens.

## 📖 Documentação completa

Veja [`wpp_monitor/README.md`](wpp_monitor/README.md) — API, variáveis de
ambiente, como embutir em outro app Node e avisos de privacidade.

## ✉️ Suporte

Se precisar, é só chamar! 🚀
