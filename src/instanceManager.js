const fs = require('fs')
const path = require('path')
const pino = require('pino')
const QRCode = require('qrcode')
const qrcodeTerminal = require('qrcode-terminal')
const { Boom } = require('@hapi/boom')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    Browsers,
} = require('@whiskeysockets/baileys')
const MessageStore = require('./store')
const { handleMessage, extractText } = require('./botHandler')

// Tudo que é sensível (sessões, histórico, registro de perfis) fica em DATA_DIR,
// fora do Git. Em produção, monte um volume neste caminho para persistir.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')

// Depois de N ciclos de QR sem ninguém escanear, a instância para de gerar QR
// (QR antigo deve ser descartado; o operador reconecta pelo painel quando estiver pronto).
const MAX_CICLOS_QR = 3
const RECONNECT_MAX_MS = 30_000

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' })

class ApiError extends Error {
    constructor(statusCode, message) {
        super(message)
        this.statusCode = statusCode
    }
}

function slugify(texto) {
    return String(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
}

class InstanceManager {
    constructor() {
        this.registryFile = path.join(DATA_DIR, 'instances.json')
        this.profiles = []
        this.runtime = new Map()
    }

    async init() {
        fs.mkdirSync(DATA_DIR, { recursive: true })
        this._loadRegistry()
        this._migrateLegacyAuth()
        for (const profile of this.profiles) {
            if (profile.autoStart !== false) {
                await this.start(profile.id).catch((err) =>
                    console.error(`[${profile.id}] Falha ao iniciar:`, err.message)
                )
            }
        }
    }

    _loadRegistry() {
        try {
            const raw = JSON.parse(fs.readFileSync(this.registryFile, 'utf8'))
            this.profiles = Array.isArray(raw.instances) ? raw.instances : []
        } catch {
            this.profiles = []
        }
    }

    _saveRegistry() {
        const tmp = this.registryFile + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify({ instances: this.profiles }, null, 2))
        fs.renameSync(tmp, this.registryFile)
    }

    // Se existir a pasta auth_info da versão antiga (instância única) e nenhum
    // perfil registrado, migra a sessão para a instância "principal".
    _migrateLegacyAuth() {
        const legacy = path.join(process.cwd(), 'auth_info')
        if (this.profiles.length > 0 || !fs.existsSync(legacy)) return
        const id = 'principal'
        const destino = path.join(this._instanceDir(id), 'auth')
        fs.mkdirSync(path.dirname(destino), { recursive: true })
        fs.cpSync(legacy, destino, { recursive: true })
        this.profiles.push({
            id,
            nome: 'Principal',
            dono: '',
            finalidade: 'vendas',
            consentimento: true,
            consentimentoEm: new Date().toISOString(),
            criadoEm: new Date().toISOString(),
            autoStart: true,
            responderAutomatico: true,
            ignorarGrupos: true,
            phone: null,
            observacoes: 'Migrada automaticamente da pasta auth_info (versão de instância única).',
        })
        this._saveRegistry()
        console.log('♻️  Sessão antiga de auth_info migrada para a instância "principal".')
    }

    _instanceDir(id) {
        return path.join(DATA_DIR, 'instances', id)
    }

    _getProfile(id) {
        const profile = this.profiles.find((p) => p.id === id)
        if (!profile) throw new ApiError(404, `Instância "${id}" não encontrada.`)
        return profile
    }

    _getRuntime(id) {
        if (!this.runtime.has(id)) {
            this.runtime.set(id, {
                sock: null,
                status: 'parado',
                qr: null,
                qrDataUrl: null,
                qrCycles: 0,
                retries: 0,
                timer: null,
                stopping: false,
                phone: null,
                msgCount: 0,
                lastMessageAt: null,
                store: new MessageStore(this._instanceDir(id)),
            })
        }
        return this.runtime.get(id)
    }

    list() {
        return this.profiles.map((profile) => {
            const rt = this._getRuntime(profile.id)
            return {
                ...profile,
                status: rt.status,
                phone: profile.phone || rt.phone,
                qrDataUrl: rt.status === 'aguardando_qr' ? rt.qrDataUrl : null,
                msgCount: rt.msgCount,
                lastMessageAt: rt.lastMessageAt,
            }
        })
    }

    // Registro 1:1 — cada telefone precisa de perfil com dono, finalidade e
    // consentimento explícito ANTES de gerar QR.
    create(input = {}) {
        const nome = String(input.nome || '').trim()
        if (!nome) throw new ApiError(400, 'Informe o nome da instância.')
        if (input.consentimento !== true) {
            throw new ApiError(
                400,
                'Consentimento obrigatório: confirme que o dono do número autoriza o pareamento e sabe que as conversas acessíveis pelo WhatsApp Web podem ser baixadas para o ambiente local.'
            )
        }
        let id = slugify(input.id || nome) || 'instancia'
        if (this.profiles.some((p) => p.id === id)) {
            throw new ApiError(409, `Já existe uma instância com o id "${id}".`)
        }
        const agora = new Date().toISOString()
        const profile = {
            id,
            nome,
            dono: String(input.dono || '').trim(),
            finalidade: String(input.finalidade || 'vendas').trim(),
            consentimento: true,
            consentimentoEm: agora,
            criadoEm: agora,
            autoStart: input.autoStart !== false,
            responderAutomatico: input.responderAutomatico !== false,
            ignorarGrupos: input.ignorarGrupos !== false,
            phone: null,
            observacoes: String(input.observacoes || '').trim(),
        }
        this.profiles.push(profile)
        this._saveRegistry()
        return profile
    }

    async start(id) {
        const profile = this._getProfile(id)
        const rt = this._getRuntime(id)
        if (['conectando', 'aguardando_qr', 'conectado', 'reconectando'].includes(rt.status)) {
            return rt.status
        }
        rt.stopping = false
        rt.retries = 0
        rt.qrCycles = 0
        if (profile.autoStart !== true) {
            profile.autoStart = true
            this._saveRegistry()
        }
        await this._connect(profile, rt)
        return rt.status
    }

    async stop(id) {
        const profile = this._getProfile(id)
        const rt = this._getRuntime(id)
        // Parada explícita vale também depois de um reinício do serviço.
        if (profile.autoStart !== false) {
            profile.autoStart = false
            this._saveRegistry()
        }
        rt.stopping = true
        if (rt.timer) {
            clearTimeout(rt.timer)
            rt.timer = null
        }
        if (rt.sock) {
            try {
                rt.sock.end(undefined)
            } catch {}
            rt.sock = null
        }
        rt.status = 'parado'
        rt.qr = null
        rt.qrDataUrl = null
        return rt.status
    }

    // Desconecta o aparelho do WhatsApp e apaga a sessão local.
    async logout(id) {
        const profile = this._getProfile(id)
        const rt = this._getRuntime(id)
        rt.stopping = true
        if (rt.timer) {
            clearTimeout(rt.timer)
            rt.timer = null
        }
        if (rt.sock) {
            try {
                await rt.sock.logout()
            } catch {}
            try {
                rt.sock.end(undefined)
            } catch {}
            rt.sock = null
        }
        this._clearAuth(id)
        profile.phone = null
        profile.autoStart = false
        this._saveRegistry()
        rt.status = 'desconectado_logout'
        rt.qr = null
        rt.qrDataUrl = null
        rt.phone = null
        return rt.status
    }

    async remove(id) {
        this._getProfile(id)
        await this.stop(id).catch(() => {})
        this.profiles = this.profiles.filter((p) => p.id !== id)
        this._saveRegistry()
        this.runtime.delete(id)
        fs.rmSync(this._instanceDir(id), { recursive: true, force: true })
    }

    searchMessages(id, opts) {
        this._getProfile(id)
        return this._getRuntime(id).store.search(opts)
    }

    async sendText(id, numero, texto) {
        this._getProfile(id)
        const rt = this._getRuntime(id)
        if (rt.status !== 'conectado' || !rt.sock) {
            throw new ApiError(409, 'Instância não está conectada.')
        }
        const digitos = String(numero).replace(/\D/g, '')
        if (!digitos) throw new ApiError(400, 'Número inválido.')
        const jid = `${digitos}@s.whatsapp.net`
        await rt.sock.sendMessage(jid, { text: String(texto) })
        return jid
    }

    _clearAuth(id) {
        fs.rmSync(path.join(this._instanceDir(id), 'auth'), { recursive: true, force: true })
    }

    _scheduleReconnect(profile, rt, delayMs) {
        rt.status = 'reconectando'
        if (rt.timer) clearTimeout(rt.timer)
        rt.timer = setTimeout(() => {
            rt.timer = null
            this._connect(profile, rt).catch((err) => {
                console.error(`[${profile.id}] Erro ao reconectar:`, err.message)
            })
        }, delayMs)
    }

    async _connect(profile, rt) {
        const authDir = path.join(this._instanceDir(profile.id), 'auth')
        fs.mkdirSync(authDir, { recursive: true })
        rt.status = 'conectando'

        let state, saveCreds
        try {
            ;({ state, saveCreds } = await useMultiFileAuthState(authDir))
        } catch (err) {
            console.error(`[${profile.id}] Erro ao carregar sessão:`, err.message)
            rt.status = 'erro'
            return
        }

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            logger,
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
        })
        rt.sock = sock
        const sockRef = sock

        sock.ev.on('creds.update', saveCreds)

        // Watchdog: se ficar preso em "conectando" (rede travada, proxy, DNS),
        // força o fim do socket — o tratador de close agenda a reconexão.
        const watchdog = setTimeout(() => {
            if (rt.sock === sockRef && rt.status === 'conectando' && !rt.stopping) {
                console.log(`⏱️  [${profile.id}] Conexão travada há 60s — reiniciando socket.`)
                try {
                    // 408 (timedOut) para não colidir com badSession (500).
                    sockRef.end(new Boom('timeout de conexão', { statusCode: DisconnectReason.timedOut }))
                } catch {}
            }
        }, 60_000)

        sock.ev.on('connection.update', async (update) => {
            if (rt.sock !== sockRef) return
            const { connection, lastDisconnect, qr } = update
            if (qr || connection === 'open' || connection === 'close') clearTimeout(watchdog)

            if (qr) {
                rt.qr = qr
                rt.status = 'aguardando_qr'
                try {
                    rt.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 })
                } catch (err) {
                    rt.qrDataUrl = null
                    console.error(`[${profile.id}] Erro ao gerar imagem do QR:`, err.message)
                }
                if (process.env.QR_TERMINAL !== '0') {
                    console.log(`\n📱 [${profile.id}] Escaneie o QR abaixo (WhatsApp > Aparelhos conectados > Conectar aparelho):`)
                    qrcodeTerminal.generate(qr, { small: true })
                }
            }

            if (connection === 'open') {
                rt.status = 'conectado'
                rt.qr = null
                rt.qrDataUrl = null
                rt.retries = 0
                rt.qrCycles = 0
                rt.badSessionCount = 0
                const phone = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : null
                rt.phone = phone
                if (phone && profile.phone !== phone) {
                    profile.phone = phone
                    this._saveRegistry()
                }
                console.log(`✅ [${profile.id}] Conectado como ${phone || 'desconhecido'}.`)
            }

            if (connection === 'close') {
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
                rt.sock = null
                const estavaPareando = rt.qr !== null || rt.status === 'aguardando_qr'
                rt.qr = null
                rt.qrDataUrl = null

                if (rt.stopping) {
                    if (rt.status !== 'desconectado_logout') rt.status = 'parado'
                    return
                }

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`🔌 [${profile.id}] Sessão encerrada no aparelho (logout). Pareie novamente pelo painel.`)
                    this._clearAuth(profile.id)
                    profile.phone = null
                    profile.autoStart = false
                    this._saveRegistry()
                    rt.phone = null
                    rt.status = 'desconectado_logout'
                    return
                }

                if (statusCode === DisconnectReason.badSession) {
                    // Erros genéricos também chegam como 500 — só limpa a sessão
                    // se o problema se repetir, para nunca desparear por engano.
                    rt.badSessionCount = (rt.badSessionCount || 0) + 1
                    if (rt.badSessionCount >= 2) {
                        console.log(`⚠️  [${profile.id}] Sessão corrompida — limpando para parear de novo.`)
                        this._clearAuth(profile.id)
                        rt.badSessionCount = 0
                    }
                    this._scheduleReconnect(profile, rt, 2000)
                    return
                }

                if (statusCode === DisconnectReason.restartRequired) {
                    // Normal logo após parear: o socket precisa reiniciar.
                    this._scheduleReconnect(profile, rt, 500)
                    return
                }

                if (estavaPareando) {
                    rt.qrCycles += 1
                    if (rt.qrCycles >= MAX_CICLOS_QR) {
                        console.log(`⏳ [${profile.id}] QR expirou ${MAX_CICLOS_QR}x sem scan. Clique em "Conectar" no painel quando o operador estiver pronto.`)
                        rt.status = 'qr_expirado'
                        return
                    }
                    this._scheduleReconnect(profile, rt, 1000)
                    return
                }

                const delay = Math.min(RECONNECT_MAX_MS, 1000 * 2 ** rt.retries)
                rt.retries += 1
                console.log(`🔁 [${profile.id}] Conexão caiu (código ${statusCode || '?'}). Reconectando em ${Math.round(delay / 1000)}s...`)
                this._scheduleReconnect(profile, rt, delay)
            }
        })

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (rt.sock !== sockRef) return
            if (type !== 'notify') return
            for (const msg of messages) {
                if (!msg.message) continue
                const from = msg.key.remoteJid
                const isGroup = typeof from === 'string' && from.endsWith('@g.us')
                const entry = {
                    ts: Date.now(),
                    iso: new Date().toISOString(),
                    from,
                    fromMe: !!msg.key.fromMe,
                    pushName: msg.pushName || null,
                    type: Object.keys(msg.message)[0],
                    text: extractText(msg),
                }
                rt.store.append(entry)
                rt.msgCount += 1
                rt.lastMessageAt = entry.iso

                if (msg.key.fromMe) continue
                if (isGroup && profile.ignorarGrupos !== false) continue
                if (profile.responderAutomatico === false) continue
                try {
                    await handleMessage(sock, msg, profile)
                } catch (err) {
                    console.error(`[${profile.id}] Erro no tratador de mensagens:`, err.message)
                }
            }
        })
    }
}

module.exports = { InstanceManager, ApiError, DATA_DIR }
