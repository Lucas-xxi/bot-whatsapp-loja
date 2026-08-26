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

    // Métricas de disparo e recebimento.
    //
    //   disparos  = mensagens SAÍDAS (fromMe) — o que este número disparou
    //   recebidas = mensagens ENTRADAS — o que chegou de clientes
    //
    // `dia` é o dia local no formato YYYY-MM-DD (padrão: hoje).
    // Também devolve o total geral, a janela de 24h e a distribuição por hora
    // do dia (0-23), para o gráfico do monitor.
    stats({ dia } = {}) {
        const base = new Date()
        if (dia) {
            const [a, m, d] = String(dia).split('-').map(Number)
            if (a && m && d) base.setFullYear(a, m - 1, d)
        }
        base.setHours(0, 0, 0, 0)
        const inicioDia = base.getTime()
        const fimDia = inicioDia + 24 * 60 * 60 * 1000
        const t24 = Date.now() - 24 * 60 * 60 * 1000

        const out = {
            dia: new Date(inicioDia).toLocaleDateString('sv-SE'), // YYYY-MM-DD local
            disparos: 0,
            recebidas: 0,
            totalDia: 0,
            contatosDia: 0,
            contatosDisparadosDia: 0,
            disparos24h: 0,
            recebidas24h: 0,
            totalGeral: 0,
            primeiraDoDia: null,
            ultimaDoDia: null,
            porHora: Array.from({ length: 24 }, () => ({ disparos: 0, recebidas: 0 })),
        }
        if (!fs.existsSync(this.file)) return out

        const contatos = new Set()
        const contatosDisparados = new Set()
        for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
            if (!line) continue
            let e
            try {
                e = JSON.parse(line)
            } catch {
                continue
            }
            out.totalGeral += 1
            if (e.ts >= t24) {
                if (e.fromMe) out.disparos24h += 1
                else out.recebidas24h += 1
            }
            if (e.ts >= inicioDia && e.ts < fimDia) {
                out.totalDia += 1
                const hora = new Date(e.ts).getHours()
                if (e.fromMe) {
                    out.disparos += 1
                    out.porHora[hora].disparos += 1
                    if (e.from) contatosDisparados.add(e.from)
                } else {
                    out.recebidas += 1
                    out.porHora[hora].recebidas += 1
                    if (e.from) contatos.add(e.from)
                }
                if (out.primeiraDoDia === null || e.ts < out.primeiraDoDia) out.primeiraDoDia = e.ts
                if (out.ultimaDoDia === null || e.ts > out.ultimaDoDia) out.ultimaDoDia = e.ts
            }
        }
        out.contatosDia = contatos.size
        out.contatosDisparadosDia = contatosDisparados.size
        return out
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
