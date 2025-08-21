import json
import os
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import requests
from typing import Dict, List
from pathlib import Path

# Logging setup for better debugging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()

# In-memory storage for settings and abuse messages
bot_settings = {
    "autoSpamAccept": False,
    "autoMessageAccept": False,
    "prefix": "!",
    "admin_id": "",
    "running": False
}
abuse_messages: List[str] = []

# File paths for persistent storage
SETTINGS_FILE = Path("settings.json")
ABUSE_FILE = Path("abuse.txt")

# Load settings from file if exists
def load_settings():
    global bot_settings
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                bot_settings.update(json.load(f))
            logger.info("Settings loaded from file")
        except Exception as e:
            logger.error(f"Failed to load settings: {e}")

# Save settings to file
def save_settings():
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(bot_settings, f, indent=2)
        logger.info("Settings saved to file")
    except Exception as e:
        logger.error(f"Failed to save settings: {e}")

# Load abuse messages from file
def load_abuse_messages():
    global abuse_messages
    if ABUSE_FILE.exists():
        try:
            with open(ABUSE_FILE, "r") as f:
                abuse_messages = [line.strip() for line in f if line.strip()]
            logger.info(f"Loaded {len(abuse_messages)} abuse messages")
        except Exception as e:
            logger.error(f"Failed to load abuse messages: {e}")

# Save abuse messages to file
def save_abuse_messages(content: str):
    global abuse_messages
    try:
        abuse_messages = [line.strip() for line in content.splitlines() if line.strip()]
        with open(ABUSE_FILE, "w") as f:
            f.write(content)
        logger.info(f"Saved {len(abuse_messages)} abuse messages")
    except Exception as e:
        logger.error(f"Failed to save abuse messages: {e}")

# Initialize on startup
load_settings()
load_abuse_messages()

# Placeholder for Facebook Bot Logic
class FacebookBot:
    def __init__(self, cookie: str, prefix: str, admin_id: str):
        self.cookie = cookie
        self.prefix = prefix
        self.admin_id = admin_id
        self.session = requests.Session()
        self.session.headers.update({"Cookie": cookie})
        self.running = False

    def start(self):
        # Placeholder: Add Facebook login logic here
        # Example: Make API call to verify cookie
        try:
            # Test cookie validity (replace with actual Facebook API endpoint)
            response = self.session.get("https://graph.facebook.com/me")
            if response.status_code == 200:
                self.running = True
                logger.info("Bot started successfully")
                return True
            else:
                logger.error("Invalid cookie")
                return False
        except Exception as e:
            logger.error(f"Bot start failed: {e}")
            return False

    def stop(self):
        self.running = False
        logger.info("Bot stopped")

    def handle_command(self, message: str, sender_id: str, group_id: str) -> str:
        # Example command handling
        if not message.startswith(self.prefix):
            return None
        command = message[len(self.prefix):].strip().split()
        if not command:
            return None

        cmd = command[0].lower()
        args = command[1:]

        if cmd == "help":
            return "Available commands: !help, !uid, !tid, !info, !antiout on/off, etc."
        elif cmd == "uid":
            if args and args[0].startswith("@"):
                return f"User ID: {args[0][1:]} (Placeholder)"
            return f"Your ID: {sender_id}"
        elif cmd == "tid":
            return f"Group ID: {group_id}"
        # Add more commands here (e.g., !antiout, !pair, !music)
        return None

# Global bot instance
bot_instance = None

# Serve HTML at root
@app.get("/")
async def get_root():
    try:
        with open("index.html", "r") as f:
            html = f.read()
        return HTMLResponse(html)
    except FileNotFoundError:
        logger.error("index.html not found")
        return HTMLResponse("Error: index.html not found", status_code=500)

# WebSocket endpoint
@app.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    global bot_instance

    # Send current settings to client
    await websocket.send_text(json.dumps({"type": "settings", **bot_settings}))

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "log", "message": "Invalid JSON data"}))
                continue

            # Handle WebSocket messages
            if msg["type"] == "start":
                cookie = msg.get("cookieContent", "")
                prefix = msg.get("prefix", "!")
                admin_id = msg.get("adminId", "")

                if not cookie:
                    await websocket.send_text(json.dumps({"type": "log", "message": "Cookie is required"}))
                    continue

                bot_settings["prefix"] = prefix
                bot_settings["admin_id"] = admin_id
                bot_instance = FacebookBot(cookie, prefix, admin_id)
                
                if bot_instance.start():
                    bot_settings["running"] = True
                    await websocket.send_text(json.dumps({"type": "log", "message": f"Bot started with prefix: {prefix}"}))
                    await websocket.send_text(json.dumps({"type": "status", "running": True}))
                else:
                    await websocket.send_text(json.dumps({"type": "log", "message": "Failed to start bot: Invalid cookie"}))
                    bot_settings["running"] = False

            elif msg["type"] == "stop":
                if bot_instance:
                    bot_instance.stop()
                bot_settings["running"] = False
                await websocket.send_text(json.dumps({"type": "log", "message": "Bot stopped"}))
                await websocket.send_text(json.dumps({"type": "status", "running": False}))

            elif msg["type"] == "uploadAbuse":
                content = msg.get("content", "")
                if content:
                    save_abuse_messages(content)
                    await websocket.send_text(json.dumps({"type": "log", "message": f"Abuse file uploaded with {len(abuse_messages)} messages"}))
                else:
                    await websocket.send_text(json.dumps({"type": "log", "message": "No content in abuse file"}))

            elif msg["type"] == "saveSettings":
                bot_settings["autoSpamAccept"] = msg.get("autoSpamAccept", False)
                bot_settings["autoMessageAccept"] = msg.get("autoMessageAccept", False)
                save_settings()
                await websocket.send_text(json.dumps({"type": "log", "message": "Settings saved"}))
                await websocket.send_text(json.dumps({"type": "settings", **bot_settings}))

            # Simulate bot logs (replace with real bot events)
            if bot_settings["running"]:
                # Example: Send periodic logs
                # await websocket.send_text(json.dumps({"type": "log", "message": "Bot is running..."}))
                pass

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.send_text(json.dumps({"type": "log", "message": f"Server error: {str(e)}"}))
