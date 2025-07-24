const express = require('express');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const { login } = require('facebook-chat-api');

const app = express();
const wss = new WebSocket.Server({ noServer: true });

let api = null;
let wsClient = null;
let abuseMessages = [];
let isRunning = false;
let cookieData = null;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Upload cookie
app.post('/upload-cookie', (req, res) => {
    cookieData = req.body;
    res.send('Cookie uploaded.');
});

// Upload abuse messages
app.post('/upload-abuse', (req, res) => {
    abuseMessages = req.body.abuse.split('\n');
    res.send('Abuse messages uploaded.');
});

// WebSocket upgrade
const server = app.listen(21165, () => console.log('Ultimate Devil Bot running on port 21165'));
server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, socket => {
        wsClient = socket;
        socket.on('message', msg => handleWSCommand(msg));
    });
});

function handleWSCommand(msg) {
    if (msg === 'start') return startBot();
    if (msg === 'stop') return stopBot();
    if (msg === 'status') return wsClient.send(isRunning ? 'Bot is running' : 'Bot is stopped');
}

function startBot() {
    if (isRunning || !cookieData) return;
    isRunning = true;
    login({ userID: cookieData.c_user, access_token: cookieData.xs }, { forceLogin: true }, (err, _api) => {
        if (err) {
            wsClient.send('Login failed: ' + err.error || err);
            isRunning = false;
            return;
        }
        api = _api;
        wsClient.send('Bot started.');

        api.listenMqtt((err, message) => {
            if (err || !isRunning) return;
            if (message.body && abuseMessages.length > 0) {
                const reply = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                api.sendMessage(reply, message.threadID);
                wsClient.send(`Replied with abuse: "${reply}" to thread ${message.threadID}`);
            }
        });
    });
}

function stopBot() {
    if (!isRunning || !api) return;
    isRunning = false;
    api.logout(err => {
        if (err) wsClient.send('Logout failed.');
        else wsClient.send('Bot stopped.');
    });
}