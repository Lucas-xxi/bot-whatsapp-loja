const fs = require('fs')
const path = require('path')

const FOTOS_FILE = path.join(__dirname, '..', 'fotos.json')

function loadFotos() {
    try {
        return JSON.parse(fs.readFileSync(FOTOS_FILE, 'utf8'))
    } catch {
        return {}
    }
}

function extractText(msg) {
    const m = msg.message
    if (!m) return null
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.buttonsResponseMessage?.selectedDisplayText ||
        m.listResponseMessage?.title ||
        null
    )
}

// Resposta automática por instância. Cada perfil pode desligar isso
// com responderAutomatico=false (modo somente leitura/histórico).
async function handleMessage(sock, msg, profile) {
    const from = msg.key.remoteJid
    const text = extractText(msg)
    if (!from || !text) return

    const normalizado = text.toLowerCase().trim()

    if (normalizado === 'oi' || normalizado === 'ola' || normalizado === 'olá') {
        await sock.sendMessage(from, {
            text: `Oi! 🤖 Aqui é o atendimento de *${profile.nome}*. Estou online.`,
        })
        return
    }

    // fotos.json: se o texto for uma chave (ex: "corolla2020" ou "corolla 2020"),
    // envia as fotos cadastradas.
    const fotos = loadFotos()
    const chave = normalizado.replace(/\s+/g, '')
    const urls = fotos[chave]
    if (Array.isArray(urls) && urls.length > 0) {
        for (const url of urls) {
            await sock.sendMessage(from, { image: { url }, caption: chave })
        }
    }
}

module.exports = { handleMessage, extractText }
