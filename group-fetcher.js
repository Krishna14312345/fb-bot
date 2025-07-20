const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
            console.log("\n✅ Login successful!");

            const groups = await sock.groupFetchAllParticipating();
            console.log("\n📂 WhatsApp Groups & UIDs:\n");
            for (let id in groups) {
                const group = groups[id];
                console.log(`🟢 ${group.subject} => ${id}`);
            }

            console.log("\n✅ Fetch complete. Exiting...");
            process.exit(0);
        }

        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log("❌ Connection closed. Reconnecting:", shouldReconnect);
            if (shouldReconnect) startSock();
        }
    });
}

startSock();
