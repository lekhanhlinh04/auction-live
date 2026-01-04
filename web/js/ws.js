const WS_URL = "ws://localhost:8080";
let ws = null;
let isLoggedIn = false; // Flag để track trạng thái login
let pendingCommands = []; // Queue các lệnh chờ login xong

function connectWS() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("✅ WS connected");

        // Đợi một chút để gateway kết nối TCP trước
        setTimeout(() => {
            // Tự động login lại nếu đã có user info trong localStorage
            const userJson = localStorage.getItem("user");
            const savedPassword = sessionStorage.getItem("loginPassword");

            if (userJson && savedPassword) {
                try {
                    const user = JSON.parse(userJson);
                    console.log("🔄 Tự động login lại với user:", user.username);
                    // Tự động gửi lại lệnh LOGIN
                    sendPacket({
                        type: "LOGIN",
                        username: user.username,
                        password: savedPassword
                    });
                } catch (e) {
                    console.error("Error parsing user info:", e);
                }
            }
        }, 500); // Đợi 500ms để gateway kết nối TCP
    };

    ws.onmessage = (e) => {
        // C Server gửi về text, có thể nhiều dòng cùng lúc
        // Gateway chuyển tiếp nguyên xi text đó về đây.
        const rawData = e.data;
        console.log("📩 WS received:", rawData);

        // Split theo newline để xử lý từng message riêng
        const messages = rawData.split("\n").filter(m => m.trim() !== "");

        // Gom các message cùng loại lại (BID_RECORD, ITEM, MEMBER, ROOM etc.)
        let bidRecords = [];
        let itemRecords = [];
        let memberRecords = [];
        let roomRecords = [];
        let otherMessages = [];

        for (const msg of messages) {
            if (msg.startsWith("BID_RECORD") || msg === "NO_BIDS") {
                bidRecords.push(msg);
            } else if (msg.startsWith("ITEM") || msg === "NO_ITEMS") {
                itemRecords.push(msg);
            } else if (msg.startsWith("MEMBER") || msg === "NO_MEMBERS") {
                memberRecords.push(msg);
            } else if (msg.startsWith("ROOM ") || msg === "NO_ROOMS") {
                roomRecords.push(msg);
            } else {
                otherMessages.push(msg);
            }
        }

        // Xử lý các message độc lập trước
        for (const msg of otherMessages) {
            // Kiểm tra nếu LOGIN thành công
            if (msg.startsWith("OK LOGIN")) {
                isLoggedIn = true;
                console.log("✅ Login thành công, gửi các lệnh đang chờ...");
                // Gửi tất cả lệnh đang chờ
                while (pendingCommands.length > 0) {
                    const cmd = pendingCommands.shift();
                    ws.send(JSON.stringify(cmd));
                    console.log("📤 Sent queued:", cmd);
                }
                // Gọi callback nếu có định nghĩa (để các trang khác biết login xong)
                if (typeof window.onLoginSuccess === "function") {
                    window.onLoginSuccess();
                }
            }

            // Xử lý tin nhắn chat (JSON từ gateway)
            if (msg.startsWith("{")) {
                try {
                    const jsonData = JSON.parse(msg);
                    if (jsonData.type === "CHAT_MSG" && typeof window.onChatMessage === "function") {
                        window.onChatMessage(jsonData);
                        continue;
                    }
                } catch (e) {
                    // Không phải JSON, tiếp tục xử lý bình thường
                }
            }

            // Gọi hàm xử lý riêng ở từng trang
            if (typeof window.onServerMessage === "function") {
                window.onServerMessage(msg);
            }
        }

        // Gửi tất cả BID_RECORD cùng lúc (join lại thành 1 string)
        if (bidRecords.length > 0 && typeof window.onServerMessage === "function") {
            window.onServerMessage(bidRecords.join("\n"));
        }

        // Gửi tất cả ITEM cùng lúc (join lại thành 1 string)
        if (itemRecords.length > 0 && typeof window.onServerMessage === "function") {
            window.onServerMessage(itemRecords.join("\n"));
        }

        // Gửi tất cả MEMBER cùng lúc
        if (memberRecords.length > 0 && typeof window.onServerMessage === "function") {
            window.onServerMessage(memberRecords.join("\n"));
        }

        // Gửi tất cả ROOM cùng lúc
        if (roomRecords.length > 0 && typeof window.onServerMessage === "function") {
            window.onServerMessage(roomRecords.join("\n"));
        }
    };

    ws.onerror = (e) => {
        console.error("❌ WS error", e);
    };

    ws.onclose = () => {
        console.warn("⚠️ WS closed, retry in 2s...");
        setTimeout(connectWS, 2000);
    };
}

// Hàm dùng chung để gửi JSON sang Gateway
function sendPacket(dataObject) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        // LOGIN và REGISTER luôn được gửi ngay (không cần đợi login)
        if (dataObject.type === "LOGIN" || dataObject.type === "REGISTER") {
            ws.send(JSON.stringify(dataObject));
            console.log("📤 Sent:", dataObject);
            // Reset flag khi gửi LOGIN mới
            if (dataObject.type === "LOGIN") {
                isLoggedIn = false;
            }
        }
        // Các lệnh khác: chỉ gửi nếu đã login, nếu chưa thì thêm vào queue
        else {
            if (isLoggedIn) {
                ws.send(JSON.stringify(dataObject));
                console.log("📤 Sent:", dataObject);
            } else {
                // Chưa login, thêm vào queue
                pendingCommands.push(dataObject);
                console.log("⏳ Queued command (chờ login):", dataObject);
            }
        }
    } else {
        alert("Chưa kết nối được đến máy chủ!");
    }
}

connectWS();