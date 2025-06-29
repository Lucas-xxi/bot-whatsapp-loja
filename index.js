const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fotos = require('./fotos.json');

const client = new Client({
  authStrategy: new LocalAuth()
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Bot pronto!');
});

client.on('message', async msg => {
  const texto = msg.body.toLowerCase();

  if (texto.includes('corolla')) {
    const fotosCarro = fotos['corolla2020'];
    for (const foto of fotosCarro) {
      await client.sendMessage(msg.from, foto);
    }
    client.sendMessage(msg.from, '🚗 Seguem as fotos do Corolla 2020!');
  } else if (texto.includes('preço')) {
    client.sendMessage(msg.from, '💰 O Corolla 2020 está por R$ 95.000. Quer agendar uma visita?');
  } else {
    client.sendMessage(msg.from, 'Olá! Posso te ajudar com fotos, preços ou agendamento. Me fala o modelo!');
  }
});

client.initialize();
