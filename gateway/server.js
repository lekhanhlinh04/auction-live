const { connectTCP, sendToServer } = require('./tcpClient');
const { startWebSocket, broadcast } = require('./wsServer');

// LOG ĐỂ XÁC NHẬN BẠN ĐANG CHẠY PHIÊN BẢN FULL
console.log('*** DA NAP SERVER.JS PHIEN BAN FULL (HOME + ROOMS + ITEMS) ***');

//TCP → WS: Nhận tin nhắn từ C Server (Text) -> Gửi về Web
connectTCP((msg) => {
    // C Server trả về text (VD: "ROOM 1 PhongVip..." hoặc "OK LOGIN...")
    // Gateway chỉ việc chuyển tiếp nguyên văn về Web để JS xử lý
    if (msg) {
        // Trim để loại bỏ khoảng trắng thừa nếu có
        broadcast(msg.toString().trim()); 
    }
});

//WS → TCP: Nhận JSON từ Web -> Dịch sang lệnh Text cho C Server
startWebSocket((msg, ws) => {
    try {
        const msgString = msg.toString();
        const data = JSON.parse(msgString);

        console.log('[Web Request]', data); // Log để debug

        // --- XỬ LÝ CÁC LOẠI LỆNH ---

        if (data.type === 'LOGIN') {
            // Cú pháp C: LOGIN username password
            sendToServer(`LOGIN ${data.username} ${data.password}`);
        }
        else if (data.type === 'REGISTER') {
            // Cú pháp C: REGISTER username password
            sendToServer(`REGISTER ${data.username} ${data.password}`);
        }
        else if (data.type === 'LIST_ROOMS') {
            // Cú pháp C: LIST_ROOMS
            sendToServer('LIST_ROOMS');
        }
        else if (data.type === 'LIST_ITEMS') {
            // Cú pháp C: LIST_ITEMS [roomId]
            // Nếu web không gửi roomId (lấy tất cả), mặc định là 0
            const roomId = data.roomId || 0;
            sendToServer(`LIST_ITEMS ${roomId}`);
        }
        else if (data.type === 'CREATE_ROOM') {
            // Cú pháp C: CREATE_ROOM roomName
            // Lưu ý: C code dùng scanf %s nên tên phòng không được có dấu cách nếu chưa xử lý kỹ
            sendToServer(`CREATE_ROOM ${data.roomName}`);
        }
        else if (data.type === 'JOIN_ROOM') {
            // Cú pháp C: JOIN_ROOM roomId
            sendToServer(`JOIN_ROOM ${data.roomId}`);
        }
        else if (data.type === 'LEAVE_ROOM') {
            // Cú pháp C: LEAVE_ROOM
            sendToServer('LEAVE_ROOM');
        }
        // ... các lệnh khác ...

    // ================== CREATE_ITEM==================
    else if (data.type === 'CREATE_ITEM') {
        console.log("[Gateway] Yêu cầu tạo vật phẩm:", data);

        const name = data.name;
        const startPrice = data.startPrice;
        const buyNow = data.buyNowPrice || 0; // Mặc định là 0 nếu không có

        if (!name || !startPrice) {
            console.error("LỖI: Thiếu thông tin tạo vật phẩm");
            return;
        }

        // Gửi lệnh xuống Server C theo đúng format:
        // CREATE_ITEM <tên> <giá_khởi_điểm> <giá_mua_ngay>
        sendToServer(`CREATE_ITEM ${name} ${startPrice} ${buyNow}`);
    }

    // ... (các lệnh khác hoặc phần đóng ngoặc)
        else if (data.type === 'BID') {
            // Cú pháp C: BID itemId amount
            sendToServer(`BID ${data.itemId} ${data.amount}`);
        }
        else if (data.type === 'START_AUCTION') {
    // C Server: START_AUCTION itemId duration
    sendToServer(`START_AUCTION ${data.itemId} ${data.duration}`);
}
else if (data.type === 'BUY_NOW') {
            // Bổ sung thêm cho đầy đủ tính năng
            sendToServer(`BUY_NOW ${data.itemId}`);
        }
        else {
            console.log('[Gateway] Lệnh không xác định:', data.type);
        }
        
    } catch (e) {
        console.error("Lỗi xử lý tin nhắn từ Web (Format JSON sai):", e.message);
    }
});

console.log('[GATEWAY] Ready - Đang lắng nghe...');