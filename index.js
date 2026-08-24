const { InstanceManager, DATA_DIR } = require('./src/instanceManager')
const { createApp } = require('./src/webServer')

async function main() {
    console.log('🚀 Bot WhatsApp Loja — multi-instância persistente')
    console.log(`📂 Dados (sessões e histórico) em: ${DATA_DIR}`)

    const manager = new InstanceManager()
    await manager.init()

    const port = process.env.PORT || 3000
    createApp(manager).listen(port, () => {
        console.log(`🌐 Painel disponível na porta ${port} (abra a URL do serviço no navegador).`)
        if (manager.list().length === 0) {
            console.log('👉 Nenhuma instância ainda. Abra o painel e conecte o primeiro WhatsApp.')
        }
    })
}

process.on('unhandledRejection', (err) => {
    console.error('Rejeição não tratada:', err)
})

main().catch((err) => {
    console.error('Erro fatal ao iniciar:', err)
    process.exit(1)
})
