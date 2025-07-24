const express = require('express');
const { WebSocketServer } = require('ws');
const fs = require('fs-extra');
const http = require('http');
const path = require('path');

const app = express();
const PORT = 6969;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let running = false;
let settings = {
  autoSpamAccept: false,
  autoMessageAccept: false,
  autoConvo: false
};

// Serve HTML
app.use(express.static('public'));

wss.on('connection', (ws) => {
  console.log("🔌 New WebSocket connection");
  ws.send(JSON.stringify({ type: 'status', running }));
  ws.send(JSON.stringify({ type: 'settings', ...settings }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'start':
          await fs.outputFile('./uploads/cookie.txt', data.cookieContent);
          settings.prefix = data.prefix || '!';
          settings.adminId = data.adminId || '';
          running = true;
          ws.send(JSON.stringify({ type: 'status', running }));
          sendLog(ws, '✅ Bot started');
          break;

        case 'stop':
          running = false;
          ws.send(JSON.stringify({ type: 'status', running }));
          sendLog(ws, '⛔ Bot stopped');
          break;

        case 'uploadAbuse':
          await fs.outputFile('./uploads/abuse.txt', data.content);
          sendLog(ws, '📁 Abuse file uploaded');
          break;

        case 'saveWelcome':
          await fs.outputFile('./welcome.txt', data.content);
          sendLog(ws, '💬 Welcome messages saved');
          break;

        case 'saveSettings':
          settings.autoSpamAccept = data.autoSpamAccept;
          settings.autoMessageAccept = data.autoMessageAccept;
          settings.autoConvo = data.autoConvo;
          await fs.outputJson('./settings.json', settings, { spaces: 2 });
          sendLog(ws, '⚙️ Settings saved');
          break;
      }
    } catch (e) {
      sendLog(ws, '❌ Error: ' + e.message);
    }
  });
});

function sendLog(ws, msg) {
  ws.send(JSON.stringify({ type: 'log', message: msg }));
}

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
