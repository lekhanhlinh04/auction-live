const net = require('net');

let tcpSocket = null;

function connectTCP(onMessage) {
    tcpSocket = new net.Socket();

    tcpSocket.connect(5555, '127.0.0.1', () => {
        console.log('[TCP] Connected to C server');
    });

    tcpSocket.on('data', (data) => {
        const msg = data.toString();
        console.log('[TCP ←]', msg.trim());
        if (onMessage) onMessage(msg);
    });

    tcpSocket.on('close', () => {
        console.log('[TCP] Connection closed');
    });

    tcpSocket.on('error', (err) => {
        console.error('[TCP ERROR]', err.message);
    });
}

function sendToServer(msg) {
    if (tcpSocket) {
        console.log('[TCP →]', msg.trim());
        tcpSocket.write(msg + '\n');
    }
}

module.exports = {
    connectTCP,
    sendToServer
};
