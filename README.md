# 🚀 Bot WhatsApp Loja — Multi-instância persistente

Cada número de WhatsApp roda na **sua própria instância**, com sessão de
autenticação separada e **persistente**: depois de escanear o QR uma vez, a
instância reconecta sozinha em quedas de conexão e religa automaticamente
quando o serviço reinicia.

## ✨ Como funciona

- **1 telefone = 1 instância**, com perfil próprio (nome, dono, finalidade e
  consentimento registrado antes do QR).
- **Sessões fora do Git**: tudo fica em `data/` (registro de perfis em
  `data/instances.json`, credenciais em `data/instances/<id>/auth/`, histórico
  de mensagens em `data/instances/<id>/messages.jsonl`).
- **Reconexão automática** com backoff exponencial; se o número for
  desconectado pelo celular (logout), a instância pede um novo QR.
- **Painel web** para criar instâncias, ver status em tempo real, escanear o
  QR e parar/desparear/remover cada número.
- **Bot da loja por instância**: responde "oi" e envia as fotos do
  `fotos.json` quando o cliente manda a chave (ex: `corolla2020`). Pode ser
  desligado por instância (modo somente leitura).

## ✅ Passo a passo (Railway)

1. Suba este repositório no GitHub e conecte ao Railway.
2. **Crie um volume** no serviço com mount path `/app/data` — é isso que faz
   as sessões sobreviverem a deploys e reinícios.
3. Defina as variáveis de ambiente:
   - `PANEL_TOKEN` — **obrigatório em produção**: senha do painel (o QR dá
     acesso ao WhatsApp, não deixe aberto!).
   - `PERMITIR_ENVIO=1` — opcional, habilita o endpoint de envio manual.
   - `QR_TERMINAL=0` — opcional, desliga o QR nos logs (o painel já mostra).
4. Abra a URL pública do serviço → painel web.
5. Informe o token, clique em **Conectar novo WhatsApp**, confirme o
   consentimento e escaneie o QR que aparece no cartão:
   *WhatsApp > Aparelhos conectados > Conectar aparelho*.
6. Repita para cada número da loja. Pronto! 🚗💬

> ⚠️ **Aviso obrigatório antes do QR:** o pareamento pode baixar as conversas
> acessíveis pelo WhatsApp Web para o ambiente local do bot. Conecte apenas
> números cujo dono autorizou, com finalidade clara, e gere o QR só quando o
> operador estiver pronto para escanear (QR antigo é descartado).

## 🖥️ Rodando local

```bash
npm install
PANEL_TOKEN=minha-senha npm start
# abra http://localhost:3000
```

## 🔌 API

Todas as rotas exigem o header `x-panel-token` (ou `?token=`) quando
`PANEL_TOKEN` está definido.

| Rota | Descrição |
|---|---|
| `GET /api/instances` | Lista instâncias com status, telefone e QR atual |
| `POST /api/instances` | Cria instância `{nome, dono, finalidade, consentimento: true}` e já gera o QR |
| `POST /api/instances/:id/start` | Conecta / gera novo QR |
| `POST /api/instances/:id/stop` | Para a instância (sessão continua salva) |
| `POST /api/instances/:id/logout` | Desconecta o aparelho e apaga a sessão |
| `DELETE /api/instances/:id` | Remove instância, sessão e histórico |
| `GET /api/instances/:id/messages?q=&limit=&since=` | Busca no histórico local |
| `POST /api/instances/:id/send` | Envio manual `{numero, texto}` (requer `PERMITIR_ENVIO=1`) |
| `GET /health` | Verificação de saúde |

## 💡 Fotos

Edite `fotos.json` com as chaves e links `raw` das fotos no GitHub. Quando o
cliente enviar a chave (ex: `corolla2020` ou `corolla 2020`), o bot responde
com as imagens.

## ♻️ Migração da versão antiga

Se existir a pasta `auth_info/` da versão de instância única, ela é migrada
automaticamente no primeiro boot para a instância `principal` — sem precisar
escanear o QR de novo.

## ✉️ Suporte

Se precisar, é só chamar! 🚀
