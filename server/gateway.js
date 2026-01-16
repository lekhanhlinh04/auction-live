const WebSocket = require('ws');
const net = require('net');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const WS_PORT = 8080;  // Port cho WebSocket
const HTTP_PORT = 3000; // Port cho API Upload

const UPLOAD_DIR = path.join(__dirname, '../web/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================================
// 1. EXPRESS SERVER (API UPLOAD)
// ============================================================
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (entire web client)
// Users can access http://<IP>:3000 to view the site
app.use(express.static(path.join(__dirname, '../web')));

// Serve uploads specifically (redundant if inside web, but safe to keep)
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        // Giữ đuôi file, thêm timestamp để tránh trùng
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Upload Endpoint
app.post('/upload', (req, res, next) => {
    console.log(`📥 Upload request received. Content-Type: ${req.headers['content-type']}`);
    next();
}, upload.single('image'), (req, res) => {
    if (!req.file) {
        console.error('❌ Upload failed: No file received by Multer');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // URL relative: uploads/filename
    // Client sẽ lưu string này và gửi vào CREATE_ITEM
    const fileUrl = `uploads/${req.file.filename}`;
    console.log(`📸 Image uploaded: ${fileUrl}`);
    res.json({ url: fileUrl });
});

app.listen(HTTP_PORT, () => {
    console.log(`🌍 Upload Server running on http://localhost:${HTTP_PORT}`);
});


// ============================================================
// 2. WEBSOCKET GATEWAY
// ============================================================
const TCP_SERVER_HOST = 'localhost';
const TCP_SERVER_PORT = 8081;  // Port cho TCP server C

const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`🚀 WebSocket Gateway đang chạy trên port ${WS_PORT}`);
console.log(`📡 Kết nối đến TCP server tại ${TCP_SERVER_HOST}:${TCP_SERVER_PORT}`);

wss.on('connection', function (ws) {
    console.log('✅ Web client đã kết nối');

    // Tạo kết nối TCP đến server C
    const tcpClient = new net.Socket();
    let connected = false;
    let userInfo = null; // Lưu thông tin user đã login
    let commandQueue = []; // Queue các lệnh khi chưa kết nối

    function connectTCP() {
        tcpClient.connect(TCP_SERVER_PORT, TCP_SERVER_HOST, function () {
            console.log('✅ Đã kết nối đến TCP server C');
            connected = true;

            // Gửi tất cả lệnh trong queue
            while (commandQueue.length > 0) {
                const cmd = commandQueue.shift();
                tcpClient.write(cmd);
            }

            // Nếu đã có user info, tự động login lại
            if (userInfo) {
                console.log('🔄 Tự động login lại với user:', userInfo.username);
                tcpClient.write(`LOGIN ${userInfo.username} ${userInfo.password}\n`);
            }
        });
    }

    // Thử kết nối ngay
    connectTCP();

    // Nhận dữ liệu từ TCP server C và chuyển tiếp đến WebSocket client
    tcpClient.on('data', function (data) {
        const message = data.toString();
        // Log ngắn gọn
        if (message.length < 500) console.log('📥 TCP → WS:', message.trim());
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });

    // Nhận dữ liệu từ WebSocket client và chuyển đổi sang lệnh TCP
    ws.on('message', function (jsonData) {
        try {
            const data = JSON.parse(jsonData);

            // Chuyển đổi JSON thành lệnh text cho server C
            let command = '';

            if (data.type === 'LOGIN') {
                command = `LOGIN ${data.username} ${data.password}\n`;
                userInfo = { username: data.username, password: data.password };
            } else if (data.type === 'REGISTER') {
                command = `REGISTER ${data.username} ${data.password}\n`;
            } else if (data.type === 'LIST_ROOMS') {
                command = `LIST_ROOMS\n`;
            } else if (data.type === 'MY_STATS') {
                command = `MY_STATS\n`;
            } else if (data.type === 'CREATE_ROOM') {
                command = `CREATE_ROOM ${data.roomName}\n`;
            } else if (data.type === 'JOIN_ROOM') {
                if (data.roomId === undefined || data.roomId === null) {
                    ws.send('ERROR JOIN_ROOM missing room_id\n');
                    return;
                }
                const roomIdNum = parseInt(data.roomId, 10);
                if (isNaN(roomIdNum) || roomIdNum <= 0) {
                    ws.send('ERROR JOIN_ROOM invalid room_id\n');
                    return;
                }
                command = `JOIN_ROOM ${roomIdNum}\n`;
            } else if (data.type === 'LEAVE_ROOM') {
                command = `LEAVE_ROOM\n`;
            } else if (data.type === 'LIST_ITEMS') {
                if (data.roomId !== undefined && data.roomId !== null) {
                    const roomIdNum = parseInt(data.roomId, 10);
                    if (!isNaN(roomIdNum) && roomIdNum > 0) {
                        command = `LIST_ITEMS ${roomIdNum}\n`;
                    } else {
                        command = `LIST_ITEMS\n`;
                    }
                } else {
                    command = `LIST_ITEMS\n`;
                }
            } else if (data.type === 'CREATE_ITEM') {
                const name = String(data.name).trim().replace(/\s+/g, '_');
                const imageUrl = data.imageUrl ? String(data.imageUrl).trim() : '';

                // Log create item (shortened)
                console.log(`🔍 Gateway CREATE_ITEM: Name=${name}, Img=${imageUrl}`);

                if (imageUrl) {
                    command = `CREATE_ITEM ${name} ${data.startPrice} ${data.buyNowPrice} ${imageUrl}\n`;
                } else {
                    command = `CREATE_ITEM ${name} ${data.startPrice} ${data.buyNowPrice}\n`;
                }
            } else if (data.type === 'START_AUCTION') {
                const itemId = String(data.itemId).trim();
                command = data.duration ?
                    `START_AUCTION ${itemId} ${data.duration}\n` :
                    `START_AUCTION ${itemId}\n`;
            } else if (data.type === 'BID') {
                const itemId = parseInt(data.itemId, 10);
                const amount = parseInt(data.amount, 10);
                command = `BID ${itemId} ${amount}\n`;
                console.log('🔧 BID command:', command.trim());
            } else if (data.type === 'BUY_NOW') {
                const itemId = String(data.itemId).trim();
                command = `BUY_NOW ${itemId}\n`;
            } else if (data.type === 'DELETE_ITEM') {
                const itemId = String(data.itemId).trim();
                command = `DELETE_ITEM ${itemId}\n`;
                console.log('🗑️ Delete item:', itemId);
            } else if (data.type === 'SEARCH_ITEMS') {
                const keyword = String(data.keyword).trim().replace(/\s+/g, '_');
                command = `SEARCH_ITEMS ${keyword}\n`;
            } else if (data.type === 'SEARCH_ITEMS_TIME') {
                const from = String(data.from).trim();
                const to = String(data.to).trim();
                command = `SEARCH_ITEMS_TIME ${from} ${to}\n`;
            } else if (data.type === 'CHANGE_PASS') {
                const oldPass = String(data.oldPass).trim();
                const newPass = String(data.newPass).trim();
                command = `CHANGE_PASS ${oldPass} ${newPass}\n`;
            } else if (data.type === 'LIST_BIDS') {
                const itemId = parseInt(data.itemId, 10);
                command = `LIST_BIDS ${itemId}\n`;
            } else if (data.type === 'CHAT') {
                const chatMessage = {
                    type: 'CHAT_MSG',
                    userId: data.userId,
                    username: data.username,
                    message: data.message,
                    timestamp: new Date().toLocaleTimeString('vi-VN')
                };
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify(chatMessage));
                    }
                });
                return;
            } else if (data.type === 'CLOSE_ROOM') {
                const roomId = parseInt(data.roomId, 10);
                command = `CLOSE_ROOM ${roomId}\n`;
            } else if (data.type === 'OPEN_ROOM') {
                const roomId = parseInt(data.roomId, 10);
                command = `OPEN_ROOM ${roomId}\n`;
            } else {
                console.warn('⚠️ Unknown command type:', data.type);
                return;
            }

            // Gửi lệnh đến TCP server C
            if (connected) {
                tcpClient.write(command);
            } else {
                commandQueue.push(command);
                if (!tcpClient.connecting && !connected) {
                    connectTCP();
                }
            }
        } catch (err) {
            console.error('❌ Lỗi parse JSON:', err);
            ws.send('ERROR Invalid JSON format\n');
        }
    });

    ws.on('close', function () {
        console.log('❌ Web client đã ngắt kết nối');
        if (connected) {
            tcpClient.end();
        }
    });

    tcpClient.on('close', function () {
        console.log('❌ TCP server đã ngắt kết nối, sẽ kết nối lại...');
        connected = false;
        setTimeout(function () {
            if (ws.readyState === WebSocket.OPEN) {
                connectTCP();
            }
        }, 2000);
    });

    tcpClient.on('error', function (err) {
        console.error('❌ TCP error:', err.message);
        connected = false;
        setTimeout(function () {
            if (ws.readyState === WebSocket.OPEN && !connected) {
                connectTCP();
            }
        }, 2000);
    });

    ws.on('error', function (err) {
        console.error('❌ WebSocket error:', err.message);
    });
});

console.log('✅ Gateway sẵn sàng nhận kết nối!');
