const WebSocket = require('ws');
const net = require('net');

const WS_PORT = 8080;  // Port cho WebSocket (web client kết nối vào đây)
const TCP_SERVER_HOST = 'localhost';
const TCP_SERVER_PORT = 8081;  // Port cho TCP server C (server C sẽ chạy ở đây)

// Tạo WebSocket server
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
        console.log('📥 TCP → WS:', message);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });

    // Nhận dữ liệu từ WebSocket client và chuyển đổi sang lệnh TCP
    ws.on('message', function (jsonData) {
        try {
            const data = JSON.parse(jsonData);
            console.log('📤 WS → TCP:', data);
            console.log('📤 Data type:', typeof data.roomId, 'roomId:', data.roomId);

            // Chuyển đổi JSON thành lệnh text cho server C
            let command = '';

            if (data.type === 'LOGIN') {
                command = `LOGIN ${data.username} ${data.password}\n`;
                // Lưu thông tin user để tự động login lại khi reconnect
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
                // Đảm bảo roomId là số và loại bỏ khoảng trắng
                if (data.roomId === undefined || data.roomId === null) {
                    console.error('⚠️ Missing roomId:', data);
                    ws.send('ERROR JOIN_ROOM missing room_id\n');
                    return;
                }
                // Convert roomId thành số nguyên để đảm bảo format đúng
                const roomIdNum = parseInt(data.roomId, 10);
                if (isNaN(roomIdNum) || roomIdNum <= 0) {
                    console.error('⚠️ Invalid roomId:', data.roomId, 'type:', typeof data.roomId);
                    ws.send('ERROR JOIN_ROOM invalid room_id\n');
                    return;
                }
                // Tạo command với số nguyên, không có khoảng trắng thừa
                command = `JOIN_ROOM ${roomIdNum}\n`;
                console.log('🔧 JOIN_ROOM command:', JSON.stringify(command), 'roomId:', roomIdNum);
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
                // Loại bỏ khoảng trắng trong name và đảm bảo giá trị số
                const name = String(data.name).trim().replace(/\s+/g, '_');
                const imageUrl = data.imageUrl ? String(data.imageUrl).trim() : '';

                console.log(`🔍 Gateway CREATE_ITEM: Name=${name}, ImgLen=${imageUrl.length}`);

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
                if (isNaN(itemId) || itemId <= 0) {
                    console.error('⚠️ Invalid itemId:', data.itemId);
                    ws.send('ERROR BID invalid itemId\n');
                    return;
                }
                // Convert amount thành số nguyên lớn (long long)
                const amount = parseInt(data.amount, 10);
                if (isNaN(amount) || amount <= 0) {
                    console.error('⚠️ Invalid amount:', data.amount);
                    ws.send('ERROR BID invalid amount\n');
                    return;
                }
                command = `BID ${itemId} ${amount}\n`;
                console.log('🔧 BID command:', command.trim(), 'amount:', amount);
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
                console.log('🔍 Search command:', command.trim());
            } else if (data.type === 'SEARCH_ITEMS_TIME') {
                const from = String(data.from).trim();
                const to = String(data.to).trim();
                command = `SEARCH_ITEMS_TIME ${from} ${to}\n`;
                console.log('🔍 Search by time:', command.trim());
            } else if (data.type === 'SEARCH_ITEMS_TIME') {
                const from = String(data.from).trim();
                const to = String(data.to).trim();
                command = `SEARCH_ITEMS_TIME ${from} ${to}\n`;
                console.log('🔍 Search by time:', command.trim());
            } else if (data.type === 'CHANGE_PASS') {
                const oldPass = String(data.oldPass).trim();
                const newPass = String(data.newPass).trim();
                command = `CHANGE_PASS ${oldPass} ${newPass}\n`;
                console.log('🔐 Change password command sent');
            } else if (data.type === 'LIST_BIDS') {
                const itemId = parseInt(data.itemId, 10);
                if (isNaN(itemId) || itemId <= 0) {
                    console.error('⚠️ Invalid itemId for LIST_BIDS:', data.itemId);
                    ws.send('ERROR LIST_BIDS invalid itemId\n');
                    return;
                }
                command = `LIST_BIDS ${itemId}\n`;
                console.log('📜 List bids for item:', itemId);
            } else if (data.type === 'CHAT') {
                // Chat không cần gửi qua TCP server, broadcast trực tiếp qua WebSocket
                const chatMessage = {
                    type: 'CHAT_MSG',
                    userId: data.userId,
                    username: data.username,
                    message: data.message,
                    timestamp: new Date().toLocaleTimeString('vi-VN')
                };

                // Broadcast tới tất cả clients
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) { // WebSocket.OPEN
                        client.send(JSON.stringify(chatMessage));
                    }
                });
                console.log('💬 Chat broadcast:', chatMessage.username, ':', chatMessage.message);
                return; // Không gửi qua TCP
            } else {
                console.warn('⚠️ Unknown command type:', data.type);
                return;
            }

            // Gửi lệnh đến TCP server C
            if (connected) {
                console.log('📨 Sending TCP command:', JSON.stringify(command));
                tcpClient.write(command);
            } else {
                // Nếu chưa kết nối, thêm vào queue
                commandQueue.push(command);
                // Thử kết nối lại nếu socket đã đóng
                if (!tcpClient.connecting && !connected) {
                    connectTCP();
                }
            }
        } catch (err) {
            console.error('❌ Lỗi parse JSON:', err);
            ws.send('ERROR Invalid JSON format\n');
        }
    });

    // Xử lý đóng kết nối
    ws.on('close', function () {
        console.log('❌ Web client đã ngắt kết nối');
        if (connected) {
            tcpClient.end();
        }
    });

    tcpClient.on('close', function () {
        console.log('❌ TCP server đã ngắt kết nối, sẽ thử kết nối lại sau 2 giây...');
        connected = false;
        // Tự động reconnect sau 2 giây
        setTimeout(function () {
            if (ws.readyState === WebSocket.OPEN) {
                connectTCP();
            }
        }, 2000);
    });

    tcpClient.on('error', function (err) {
        console.error('❌ TCP error:', err.message);
        connected = false;
        // Thử kết nối lại sau 2 giây
        setTimeout(function () {
            if (ws.readyState === WebSocket.OPEN && !connected) {
                console.log('🔄 Đang thử kết nối lại đến TCP server...');
                connectTCP();
            }
        }, 2000);
    });

    ws.on('error', function (err) {
        console.error('❌ WebSocket error:', err.message);
    });
});

console.log('✅ Gateway sẵn sàng nhận kết nối!');

