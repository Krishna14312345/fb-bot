const express = require('express');
const { Boom } = require('@hapi/boom');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });
app.use(express.static('public'));
app.use(express.json());

let sock;
let sessionPath = 'auth';

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });
}

startSock();

app.post('/send', upload.fields([
  { name: 'creds', maxCount: 1 },
  { name: 'sms', maxCount: 1 }
]), async (req, res) => {
  try {
    const target = req.body.target;
    const delay = parseInt(req.body.delay) || 2000;
    const isGroup = req.body.type === 'group';

    const messageLines = fs.readFileSync(req.files['sms'][0].path, 'utf-8').split('\n').filter(Boolean);

    for (let msg of messageLines) {
      await sock.sendMessage(target, { text: msg });
      console.log('Sent:', msg);
      await new Promise(r => setTimeout(r, delay));
    }

    res.send('📤 Messages sent successfully!');
  } catch (err) {
    console.error('❌ Error sending messages:', err);
    res.status(500).send('Internal error');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
