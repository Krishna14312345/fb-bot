const express = require('express');
const multer = require('multer');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  default: makeWASocket,
  Browsers,
  delay,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

let sock;

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  sock = makeWASocket({
    printQRInTerminal: true,
    browser: Browsers.macOS('Sonu Bot'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    },
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('connection closed due to', lastDisconnect.error, ', reconnecting', shouldReconnect);
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === 'open') {
      console.log('Connection opened ✅');
    }
  });

  return sock;
}

startSock();

app.get('/', (req, res) => {
  res.render('index', { status: "Upload credential JSON and message file to send." });
});

app.post('/send', upload.fields([
  { name: 'credentials', maxCount: 1 },
  { name: 'message', maxCount: 1 }
]), async (req, res) => {
  const { delayMs, phoneNumber, mode } = req.body;
  const credsFile = req.files['credentials'][0];
  const msgFile = req.files['message'][0];
  const msgText = fs.readFileSync(msgFile.path, 'utf8');

  try {
    const numbers = phoneNumber.split(',').map(n => n.trim());

    for (let number of numbers) {
      await delay(parseInt(delayMs) || 1000);

      const jid = mode === 'group'
        ? number.includes('@g.us') ? number : number + '@g.us'
        : number.includes('@s.whatsapp.net') ? number : number + '@s.whatsapp.net';

      await sock.sendMessage(jid, { text: msgText });
      console.log(`✅ Message sent to: ${jid}`);
    }

    res.render('index', { status: `✅ Messages sent to ${numbers.length} numbers.` });
  } catch (err) {
    console.error(err);
    res.render('index', { status: `❌ Error: ${err.message}` });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server started at http://localhost:${port}`);
});
