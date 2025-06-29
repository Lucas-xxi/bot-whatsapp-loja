const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const qrcode = require("qrcode-terminal");

const app = express();
const port = process.env.PORT || 3000;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ Bot conectado!");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    console.log("📥 Nova mensagem: ", JSON.stringify(m, undefined, 2));
    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === "notify") {
      await sock.sendMessage(msg.key.remoteJid, { text: "Olá! Sou um bot 🤖🚀" });
    }
  });
}

startBot().catch(err => console.log("Erro ao iniciar bot:", err));

app.get("/", (req, res) => res.send("Bot WhatsApp está rodando! ✅"));

app.listen(port, () => {
  console.log(`Servidor web rodando em http://localhost:${port}`);
});
