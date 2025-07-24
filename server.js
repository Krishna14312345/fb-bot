require('dotenv').config();
const fs = require('fs');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
let bot = { running: false, cookie: null, prefix: '!', adminId: null, abuseMessages: [], settings: {} };

function broadcast(data) {
  wss.clients.forEach(ws => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(data)));
}

function log(msg) {
  broadcast({ type: 'log', message: msg });
  console.log(msg);
}

function updateStatus() {
  broadcast({ type: 'status', running: bot.running });
}

function updateSettings() {
  broadcast({ type: 'settings', ...bot.settings });
}

async function startBot() {
  bot.running = true;
  updateStatus();
  log('Bot started ✨');
  bot.timer = setInterval(() => {
    log(\`BOT> [\${bot.prefix}] Checking inbox...\`);
    if (bot.abuseMessages.length) {
      log('BOT> Sending abuse message: ' + bot.abuseMessages[Math.floor(Math.random() * bot.abuseMessages.length)]);
    }
  }, 5000);
}

function stopBot() {
  clearInterval(bot.timer);
  bot.running = false;
  updateStatus();
  log('Bot stopped 🔴');
}

wss.on('connection', ws => {
  log('Client connected');
  updateStatus();
  updateSettings();

  ws.on('message', msg => {
    let data = JSON.parse(msg);
    switch (data.type) {
      case 'start':
        bot.cookie = data.cookieContent;
        bot.prefix = data.prefix;
        bot.adminId = data.adminId;
        log('Cookie, prefix and admin ID received.');
        startBot();
        break;
      case 'stop':
        stopBot();
        break;
      case 'uploadAbuse':
        bot.abuseMessages = data.content.split(/\r?\n/).filter(l => l.trim());
        log(\`Abuse messages loaded: \${bot.abuseMessages.length}\`);
        break;
      case 'saveSettings':
        bot.settings.autoSpamAccept = data.autoSpamAccept;
        bot.settings.autoMessageAccept = data.autoMessageAccept;
        log(\`Settings saved: autoSpam=\${bot.settings.autoSpamAccept}, autoMsg=\${bot.settings.autoMessageAccept}\`);
        updateSettings();
        break;
      default:
        log(\`Unknown command: \${data.type}\`);
    }
  });

  ws.on('close', () => log('Client disconnected'));
});

log(\`WebSocket server running on port \${process.env.PORT || 8080}\`);