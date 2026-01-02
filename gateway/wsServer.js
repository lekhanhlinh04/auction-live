const WebSocket = require('ws');

let wss = null;
let clients = new Set();

function startWebSocket(onClientMessage) {
    wss = new WebSocket.Server({ port: 8080 });

    wss.on('connection', (ws) => {
        console.log('[WS] Client connected');
        clients.add(ws);

        ws.on('message', (msg) => {
            console.log('[WS ←]', msg.toString());
            if (onClientMessage)
                onClientMessage(msg.toString(), ws);
        });

        ws.on('close', () => {
            console.log('[WS] Client disconnected');
            clients.delete(ws);
        });
    });

    console.log('[WS] Listening on ws://localhost:8080');
}

function broadcast(msg) {
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    }
}

module.exports = {
    startWebSocket,
    broadcast
};
