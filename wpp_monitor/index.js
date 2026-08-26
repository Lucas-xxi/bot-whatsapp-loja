// WPP Monitor — WhatsApp multi-instância persistente, autocontido nesta pasta.
//
// Uso standalone:            node index.js   (ou: npm start)
// Uso dentro de outro app:   const wpp = require('./wpp_monitor')
//                            const { manager, app } = await wpp.start({ port: 3000 })
//                            // ou monte você mesmo: wpp.createApp(manager) num Express seu.
const { InstanceManager, DATA_DIR } = require('./src/instanceManager')
const { createApp } = require('./src/webServer')

async function start({ port } = {}) {
    console.log('🚀 WPP Monitor — WhatsApp multi-instância persistente')
    console.log(`📂 Dados (sessões e histórico) em: ${DATA_DIR}`)

    const manager = new InstanceManager()
    await manager.init()

    const p = port || process.env.PORT || 3000
    const app = createApp(manager)
    const server = app.listen(p, () => {
        console.log(`🌐 Painel WPP Monitor disponível na porta ${p}.`)
        if (manager.list().length === 0) {
            console.log('👉 Nenhuma instância ainda. Abra o painel e conecte o primeiro WhatsApp.')
        }
    })

    // Porta ocupada = já tem um WPP Monitor de pé. Saímos com código 3 para o
    // .bat supervisor reconhecer e NÃO ficar reiniciando num laço sem fim.
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`⚠️  A porta ${p} já está em uso — o WPP Monitor provavelmente já está rodando.`)
            if (require.main === module) process.exit(3)
            return
        }
        console.error('Erro no servidor:', err)
        if (require.main === module) process.exit(1)
    })

    return { manager, app, server }
}

module.exports = { start, createApp, InstanceManager, DATA_DIR }

if (require.main === module) {
    process.on('unhandledRejection', (err) => {
        console.error('Rejeição não tratada:', err)
    })
    start().catch((err) => {
        console.error('Erro fatal ao iniciar:', err)
        process.exit(1)
    })
}
