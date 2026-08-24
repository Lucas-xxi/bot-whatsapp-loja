# 📡 WPP Monitor

Módulo **autocontido** de WhatsApp multi-instância: cada número roda na sua
própria instância, com sessão persistente que religa sozinha. Tudo (código,
dependências e dados) vive dentro desta pasta — **copie a pasta `wpp_monitor/`
para qualquer outro sistema e ela funciona**.

## 🚚 Levando para outro sistema

```bash
# 1. copie a pasta wpp_monitor/ para o projeto de destino
# 2. dentro dela:
npm install
PANEL_TOKEN=minha-senha npm start
# abra http://localhost:3000 → aba "WPP Monitor"
```

As sessões e o histórico ficam em `wpp_monitor/data/` — copiar a pasta leva as
sessões junto (sem precisar escanear QR de novo).

### Usando dentro de um app Node existente

```js
const wpp = require('./wpp_monitor')

// opção 1: servidor próprio numa porta
const { manager } = await wpp.start({ port: 3001 })

// opção 2: montar no seu Express
const manager = new wpp.InstanceManager()
await manager.init()
seuApp.use('/wpp', wpp.createApp(manager))
```

## 🖥️ Painel (aba WPP Monitor)

- **📡 WPP Monitor** — visão ao vivo: total de instâncias, conectadas,
  aguardando QR, feed de mensagens por instância com busca no histórico.
- **⚙️ Configurar** — conectar novo WhatsApp (com consentimento obrigatório
  antes do QR), escanear o QR, parar/desparear/remover cada número.

## 🔐 Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `PANEL_TOKEN` | **Defina em produção!** Senha do painel/API (o QR dá acesso ao WhatsApp) |
| `PORT` | Porta do painel (padrão 3000) |
| `DATA_DIR` | Onde salvar sessões/histórico (padrão `wpp_monitor/data/`) |
| `PERMITIR_ENVIO=1` | Habilita o endpoint de envio manual (bloqueado por padrão) |
| `QR_TERMINAL=0` | Não imprime QR nos logs (o painel já mostra) |

## 🔌 API

Com `PANEL_TOKEN` definido, envie o header `x-panel-token` (ou `?token=`).

| Rota | Descrição |
|---|---|
| `GET /api/instances` | Lista instâncias com status, telefone e QR atual |
| `POST /api/instances` | Cria instância `{nome, dono, finalidade, consentimento: true}` |
| `POST /api/instances/:id/start` | Conecta / gera novo QR |
| `POST /api/instances/:id/stop` | Para (a sessão continua salva; vale após reinício) |
| `POST /api/instances/:id/logout` | Desconecta o aparelho e apaga a sessão |
| `DELETE /api/instances/:id` | Remove instância, sessão e histórico |
| `GET /api/instances/:id/messages?q=&limit=&since=` | Busca no histórico local |
| `POST /api/instances/:id/send` | Envio manual `{numero, texto}` (requer `PERMITIR_ENVIO=1`) |
| `GET /health` | Verificação de saúde |

## 🤖 Bot da loja

Responde "oi" e envia as fotos de `fotos.json` quando o cliente manda a chave
(ex: `corolla2020`). Desligável por instância no cadastro (modo somente
leitura/monitoramento).

## ⚠️ Antes do QR

O pareamento pode baixar as conversas acessíveis pelo WhatsApp Web para o
ambiente local. Conecte apenas números cujo dono autorizou, com finalidade
clara — o painel exige essa confirmação antes de gerar o QR.
