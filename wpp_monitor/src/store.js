const fs = require('fs')
const path = require('path')

// Histórico local por perfil, em JSONL, sempre fora do Git (fica em data/).
class MessageStore {
    constructor(dir) {
        this.dir = dir
        this.file = path.join(dir, 'messages.jsonl')
        fs.mkdirSync(dir, { recursive: true })
    }

    append(entry) {
        try {
            fs.appendFileSync(this.file, JSON.stringify(entry) + '\n')
        } catch (err) {
            console.error('Erro ao gravar histórico:', err.message)
        }
    }

    count() {
        if (!fs.existsSync(this.file)) return 0
        const data = fs.readFileSync(this.file, 'utf8')
        let n = 0
        for (let i = 0; i < data.length; i++) if (data[i] === '\n') n++
        return n
    }

    // Busca simples: termo (q), período (since/until em ms) e limite.
    // Retorna as mais recentes primeiro.
    search({ q, since, until, limit = 50 } = {}) {
        if (!fs.existsSync(this.file)) return []
        const lines = fs.readFileSync(this.file, 'utf8').split('\n').filter(Boolean)
        const term = q ? String(q).toLowerCase() : null
        const out = []
        for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
            let entry
            try {
                entry = JSON.parse(lines[i])
            } catch {
                continue
            }
            if (since && entry.ts < since) break
            if (until && entry.ts > until) continue
            if (term) {
                const alvo = `${entry.text || ''} ${entry.pushName || ''} ${entry.from || ''}`.toLowerCase()
                if (!alvo.includes(term)) continue
            }
            out.push(entry)
        }
        return out
    }
}

module.exports = MessageStore
