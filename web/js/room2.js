

const userJson = localStorage.getItem("user");
if (!userJson) window.location.href = "index.html";
const currentUser = JSON.parse(userJson);

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("id");
if (!roomId) {
    alert("Thiếu ID phòng!");
    window.location.href = "home.html";
}

function sendCommand(cmd) {
    if (window.socket && socket.readyState === WebSocket.OPEN) {
        console.log("[SEND]", cmd);
        socket.send(cmd + "\n");
    }
}

document.getElementById("user-name").innerText = currentUser.username;
document.getElementById("user-avatar").src =
    `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`;
document.getElementById("room-id-display").innerText =
    "R" + roomId.padStart(3, "0");

let allItems = [];
let currentStageItemId = 0;
let timerInterval = null;

setTimeout(() => {
    sendCommand(`JOIN_ROOM ${roomId}`);
    sendCommand(`LIST_ITEMS ${roomId}`);
}, 500);

window.onServerMessage = function (msg) {
    console.log("[RECV]", msg);

    if (msg.startsWith("ITEM") || msg.startsWith("NO_ITEMS")) {
        processItemList(msg);
    }

    else if (msg.startsWith("AUCTION_STARTED")) {

        const p = msg.split(" ");
        const itemId = +p[1];
        const startPrice = +p[2];
        const seconds = +p[4];

        const item = allItems.find(i => i.id === itemId);
        if (item) {
            item.status = "ONGOING";
            item.price = startPrice;
            renderMainStage(item, seconds);
            sendCommand(`LIST_ITEMS ${roomId}`);
        }
    }

    else if (msg.startsWith("NEW_BID")) {

        const p = msg.split(" ");
        const itemId = +p[1];
        const userId = p[2];
        const price = +p[3];
        const seconds = +p[4];

        if (itemId === currentStageItemId) {
            updateLiveAuctionUI(price, userId, seconds);
        }
    }

    else if (msg.startsWith("TIME_LEFT")) {
        const p = msg.split(" ");
        if (+p[1] === currentStageItemId) {
            startCountdown(+p[2]);
        }
    }

    else if (
        msg.startsWith("AUCTION_FINISHED") ||
        msg.startsWith("ITEM_SOLD")
    ) {
        alert("Phiên đấu giá đã kết thúc!");
        clearStage();
        sendCommand(`LIST_ITEMS ${roomId}`);
    }

    else if (msg.startsWith("AUCTION_EXPIRED")) {
        alert("Hết giờ! Không có người mua.");
        clearStage();
    }

    else if (msg.startsWith("OK CREATE_ITEM")) {
        alert("Đăng bán thành công!");
        closeModalItem();
        sendCommand(`LIST_ITEMS ${roomId}`);
    }

    else if (msg.startsWith("ERROR")) {
        alert(msg);
    }
};

function processItemList(text) {
    const box = document.getElementById("queue-list-container");
    box.innerHTML = "";
    allItems = [];
    let hasOngoing = false;

    if (text.trim() === "NO_ITEMS") {
        clearStage();
        return;
    }

    text.split("\n").forEach(line => {
        if (!line.startsWith("ITEM")) return;
        const p = line.split(" ");

        const item = {
            id: +p[1],
            sellerId: p[3],
            name: p[4].replace(/_/g, " "),
            price: +p[5],
            status: p[7]
        };

        allItems.push(item);
        renderQueueItem(item, box);

        if (item.status === "ONGOING") {
            hasOngoing = true;
            if (currentStageItemId !== item.id) {
                renderMainStage(item, null);
            }
        }
    });

    document.getElementById("item-count").innerText = allItems.length;
    if (!hasOngoing) clearStage();
}

function renderQueueItem(item, box) {
    const div = document.createElement("div");
    div.className = "queue-item";

    let action = "";
    if (item.status === "WAIT") {
        action = `<button onclick="startAuction(${item.id})">Bắt đầu</button>`;
    } else if (item.status === "ONGOING") {
        action = `<b style="color:red">LIVE</b>`;
    } else {
        action = `<span>${item.price.toLocaleString()} đ</span>`;
    }

    div.innerHTML = `
        <div>${item.name}</div>
        <div>${item.status}</div>
        <div>${action}</div>
    `;
    box.appendChild(div);
}

function renderMainStage(item, secondsLeft) {
    currentStageItemId = item.id;

    document.getElementById("auction-stage").innerHTML = `
        <h2>${item.name}</h2>
        <div id="timer-display">--:--</div>
        <h1 id="live-price">${item.price.toLocaleString()} VND</h1>
        <input id="inp-bid-amount" placeholder="${item.price + 10000}">
        <button onclick="placeBid(${item.id})">Đặt giá</button>
    `;

    if (secondsLeft !== null) startCountdown(secondsLeft);
}

function updateLiveAuctionUI(price, userId, seconds) {
    document.getElementById("live-price").innerText =
        price.toLocaleString() + " VND";
    document.getElementById("inp-bid-amount").placeholder =
        price + 10000;
    startCountdown(seconds);
}

function clearStage() {
    currentStageItemId = 0;
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById("auction-stage").innerHTML =
        "<i>Chưa có phiên đấu giá</i>";
}

function startCountdown(sec) {
    if (timerInterval) clearInterval(timerInterval);
    let t = sec;
    const el = document.getElementById("timer-display");

    timerInterval = setInterval(() => {
        const m = String(Math.floor(t / 60)).padStart(2, "0");
        const s = String(t % 60).padStart(2, "0");
        el.innerText = `${m}:${s}`;
        if (--t < 0) clearInterval(timerInterval);
    }, 1000);
}

function startAuction(itemId) {
    if (confirm("Bắt đầu đấu giá 2 phút?")) {
        sendCommand(`START_AUCTION ${itemId} 120`);
    }
}

function placeBid(itemId) {
    const val = document.getElementById("inp-bid-amount").value;
    if (!val) return alert("Nhập giá");
    sendCommand(`BID ${itemId} ${val}`);
}

function backToLobby() {
    sendCommand("LEAVE_ROOM");
    window.location.href = "home.html";
}

function confirmCreateItem() {
    const name = document.getElementById("inp-item-name").value.trim();
    const price = document.getElementById("inp-item-price").value;
    if (name && price) {
        sendCommand(`CREATE_ITEM ${name.replace(/\s+/g, "_")} ${price} 0`);
    }
}

function closeModalItem() {
    document.getElementById("modal-create-item").style.display = "none";
}
