let isLoggedIn = false; 

const host = window.location.hostname || "localhost";
window.WS_URL = `ws://${host}:8080`;

window.getApiUrl = function () {

    if (window.location.protocol === 'file:') {
        return "http://localhost:3000";
    }
    return `http://${window.location.hostname}:3000`;
};

let ws = null;
let pendingCommands = []; 

function connectWS() {
    ws = new WebSocket(window.WS_URL);

    ws.onopen = () => {
        console.log("✅ WS connected");

        setTimeout(() => {

            const userJson = localStorage.getItem("user");
            const savedPassword = sessionStorage.getItem("loginPassword");

            if (userJson && savedPassword) {
                try {
                    const user = JSON.parse(userJson);
                    console.log("🔄 Tự động login lại với user:", user.username);

                    sendPacket({
                        type: "LOGIN",
                        username: user.username,
                        password: savedPassword
                    });
                } catch (e) {
                    console.error("Error parsing user info:", e);
                }
            }
        }, 500); 
    };

    ws.onmessage = (e) => {

        const rawData = e.data;
        console.log("📩 WS received:", rawData);

        const messages = rawData.split("\n").filter(m => m.trim() !== "");

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

        for (const msg of otherMessages) {

            if (msg.startsWith("OK LOGIN")) {
                isLoggedIn = true;
                console.log("✅ Login thành công, gửi các lệnh đang chờ...");

                while (pendingCommands.length > 0) {
                    const cmd = pendingCommands.shift();
                    ws.send(JSON.stringify(cmd));
                    console.log("📤 Sent queued:", cmd);
                }

                if (typeof window.onLoginSuccess === "function") {
                    window.onLoginSuccess();
                }
            }

            if (msg.startsWith("{")) {
                try {
                    const jsonData = JSON.parse(msg);
                    if (jsonData.type === "CHAT_MSG" && typeof window.onChatMessage === "function") {
                        window.onChatMessage(jsonData);
                        continue;
                    }
                } catch (e) {

                }
            }

            if (typeof window.onServerMessage === "function") {
                window.onServerMessage(msg);
            }
        }

        if (bidRecords.length > 0 && typeof window.onServerMessage === "function") {
            window.onServerMessage(bidRecords.join("\n"));
        }

        if (itemRecords.length > 0 && typeof window.onServerMessage === "function") {
            window.onServerMessage(itemRecords.join("\n"));
        }

        if (memberRecords.length > 0 && typeof window.onServerMessage === "function") {
            window.onServerMessage(memberRecords.join("\n"));
        }

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

function sendPacket(dataObject) {
    if (ws && ws.readyState === WebSocket.OPEN) {

        if (dataObject.type === "LOGIN" || dataObject.type === "REGISTER") {
            ws.send(JSON.stringify(dataObject));
            console.log("📤 Sent:", dataObject);

            if (dataObject.type === "LOGIN") {
                isLoggedIn = false;
            }
        }

        else {
            if (isLoggedIn) {
                ws.send(JSON.stringify(dataObject));
                console.log("📤 Sent:", dataObject);
            } else {

                pendingCommands.push(dataObject);
                console.log("⏳ Queued command (chờ login):", dataObject);
            }
        }
    } else {
        alert("Chưa kết nối được đến máy chủ!");
    }
}

connectWS();