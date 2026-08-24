const express = require('express')
const path = require('path')
const { ApiError } = require('./instanceManager')

const PANEL_TOKEN = process.env.PANEL_TOKEN || ''
const PERMITIR_ENVIO = process.env.PERMITIR_ENVIO === '1'

function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

function createApp(manager) {
    const app = express()
    app.use(express.json())

    app.get('/health', (req, res) => res.json({ ok: true }))
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'panel.html'))
    })

    // Guardrail: o QR e o histórico são sensíveis. Com PANEL_TOKEN definido,
    // toda a API exige o token (header x-panel-token ou ?token=).
    if (!PANEL_TOKEN) {
        console.warn('⚠️  PANEL_TOKEN não definido — a API do painel está aberta. Defina PANEL_TOKEN em produção!')
    }
    app.use('/api', (req, res, next) => {
        if (!PANEL_TOKEN) return next()
        const token = req.headers['x-panel-token'] || req.query.token
        if (token === PANEL_TOKEN) return next()
        res.status(401).json({ erro: 'Token inválido. Informe o token do painel.' })
    })

    app.get('/api/instances', (req, res) => {
        res.json({ instances: manager.list(), envioHabilitado: PERMITIR_ENVIO })
    })

    app.post(
        '/api/instances',
        asyncHandler(async (req, res) => {
            const profile = manager.create(req.body || {})
            await manager.start(profile.id)
            res.status(201).json({ instance: profile })
        })
    )

    app.post(
        '/api/instances/:id/start',
        asyncHandler(async (req, res) => {
            const status = await manager.start(req.params.id)
            res.json({ status })
        })
    )

    app.post(
        '/api/instances/:id/stop',
        asyncHandler(async (req, res) => {
            const status = await manager.stop(req.params.id)
            res.json({ status })
        })
    )

    app.post(
        '/api/instances/:id/logout',
        asyncHandler(async (req, res) => {
            const status = await manager.logout(req.params.id)
            res.json({ status })
        })
    )

    app.delete(
        '/api/instances/:id',
        asyncHandler(async (req, res) => {
            await manager.remove(req.params.id)
            res.json({ ok: true })
        })
    )

    app.get(
        '/api/instances/:id/qr',
        asyncHandler(async (req, res) => {
            const item = manager.list().find((p) => p.id === req.params.id)
            if (!item) throw new ApiError(404, 'Instância não encontrada.')
            res.json({ status: item.status, qrDataUrl: item.qrDataUrl })
        })
    )

    app.get(
        '/api/instances/:id/messages',
        asyncHandler(async (req, res) => {
            const { q, since, until, limit } = req.query
            const messages = manager.searchMessages(req.params.id, {
                q,
                since: since ? Number(since) : undefined,
                until: until ? Number(until) : undefined,
                limit: limit ? Math.min(Number(limit) || 50, 500) : 50,
            })
            res.json({ messages })
        })
    )

    // Envio manual desabilitado por padrão (foco é leitura e resposta automática).
    // Habilite com PERMITIR_ENVIO=1 se realmente precisar.
    app.post(
        '/api/instances/:id/send',
        asyncHandler(async (req, res) => {
            if (!PERMITIR_ENVIO) {
                throw new ApiError(403, 'Envio manual desabilitado. Defina PERMITIR_ENVIO=1 para habilitar.')
            }
            const { numero, texto } = req.body || {}
            if (!numero || !texto) throw new ApiError(400, 'Informe "numero" e "texto".')
            const jid = await manager.sendText(req.params.id, numero, texto)
            res.json({ ok: true, para: jid })
        })
    )

    app.use((err, req, res, next) => {
        const status = err.statusCode || 500
        if (status >= 500) console.error('Erro interno:', err)
        res.status(status).json({ erro: err.message || 'Erro interno.' })
    })

    return app
}

module.exports = { createApp }
