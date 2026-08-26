# Integração do WPP Monitor no Optimus Ads

Guia direto para colocar este módulo dentro do sistema Optimus Ads
(fb-manager-v2) com um item "WPP Monitor" no menu lateral.

## 1. Trazer a pasta

Copie a pasta `wpp_monitor/` deste repositório para a raiz do projeto Optimus
(ou baixe da branch `claude/whatsapp-persistent-instances-f81gy9`). Depois:

```bash
cd wpp_monitor && npm install
```

## 2. Ligar no servidor do Optimus

Se o servidor for Node/Express, no arquivo principal do servidor:

```js
const wpp = require('./wpp_monitor')

// dentro da inicialização (contexto async):
const wppManager = new wpp.InstanceManager()
await wppManager.init()
app.use('/wpp-monitor', wpp.createApp(wppManager))
```

O painel fica em `http://localhost:<porta-do-optimus>/wpp-monitor` e as
sessões do WhatsApp religam sozinhas junto com o Optimus.

**Alternativa sem mexer no servidor:** rode standalone em outra porta
(`PORT=3100 node wpp_monitor/index.js`) e aponte o menu para
`http://localhost:3100`.

## 3. Item no menu lateral

Adicione na seção RELATÓRIOS (junto de "Cliques WhatsApp") um item:

- **Rótulo:** `WPP Monitor`
- **Rota interna:** uma página que renderiza o painel em iframe ocupando a
  área de conteúdo:

```html
<iframe src="/wpp-monitor" style="width:100%;height:100%;border:0"></iframe>
```

Em app React, o componente da página é só isso dentro do layout padrão.
O painel abre na aba "📡 WPP Monitor" (status ao vivo + feed de mensagens) e
tem a aba "⚙️ Configurar" para parear números por QR.

## 4. Ajustes

| Variável | Para quê |
|---|---|
| `PANEL_TOKEN` | Senha da API do painel. Se o painel só roda no seu PC, é opcional; exposto na rede, defina. |
| `DATA_DIR` | Onde ficam sessões/histórico (padrão: `wpp_monitor/data/` — backup = copiar a pasta). |
| `QR_TERMINAL=0` | Não imprimir QR no console do Optimus. |
| `PERMITIR_ENVIO=1` | Liberar endpoint de envio manual de mensagens. |

## 5. Fazendo com o Claude Code

Se preferir que o Claude faça a integração, abra uma sessão do Claude Code
**no repositório `fb-manager-v2`** e cole:

> Integre o módulo WhatsApp deste repositório público:
> https://github.com/Lucas-xxi/bot-whatsapp-loja (branch
> `claude/whatsapp-persistent-instances-f81gy9`, pasta `wpp_monitor/`).
> Copie a pasta `wpp_monitor/` para a raiz deste projeto, monte-a no servidor
> em `/wpp-monitor` conforme `wpp_monitor/INTEGRACAO_OPTIMUS.md`, e adicione
> o item "WPP Monitor" no menu lateral, na seção RELATÓRIOS, abrindo o painel
> em iframe na área de conteúdo.
