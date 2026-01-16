

const userJson = localStorage.getItem("user");
if (!userJson) window.location.href = "index.html";
const currentUser = JSON.parse(userJson);

const urlParams = new URLSearchParams(window.location.search);
const roomIdParam = urlParams.get('id'); 

if (!roomIdParam) {
    alert("Thiếu ID phòng!");
    window.location.href = "home.html";
}

const roomId = parseInt(roomIdParam, 10);

let roomOwnerId = 0;
if (isNaN(roomId) || roomId <= 0) {
    alert("ID phòng không hợp lệ!");
    window.location.href = "home.html";
}

let hasJoinedRoom = false;
function joinRoomAndLoadItems() {
    if (hasJoinedRoom) return; 
    hasJoinedRoom = true;
    console.log("📦 Gửi lệnh JOIN_ROOM và LIST_ITEMS...");
    sendPacket({ type: "JOIN_ROOM", roomId: roomId });
    loadItems();
    loadRoomInfo(); 
}

function loadRoomInfo() {
    sendPacket({ type: "LIST_ROOMS" });
    sendPacket({ type: "LIST_ROOM_MEMBERS", roomId: roomId });
}

window.onLoginSuccess = function () {
    console.log("🎉 onLoginSuccess callback - joining room...");
    joinRoomAndLoadItems();
};

setTimeout(() => {
    joinRoomAndLoadItems();
}, 1500);

document.getElementById("user-name").innerText = currentUser.username;
document.getElementById("user-avatar").src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`;
document.getElementById("room-id-display").innerText = "R" + String(roomId).padStart(3, '0');

let timerInterval = null;     
let currentStageItemId = 0;   
let allItems = [];            

function initToastContainer() {
    if (!document.querySelector('.toast-container')) {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}
initToastContainer();

function showToast(message, type = 'info', duration = 4000) {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };

    toast.innerHTML = `
        <span class="toast-icon"><i class="fa-solid ${icons[type] || icons.info}"></i></span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function playBidSound() {

}

function loadItems() {
    sendPacket({ type: "LIST_ITEMS", roomId: roomId });
}

window.onChatMessage = function (data) {
    const container = document.getElementById("chat-messages");
    if (!container) return;

    const welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const isMe = (data.userId == currentUser.id);
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isMe ? 'me' : 'other'}`;
    msgDiv.innerHTML = `
        <div class="chat-msg-header">
            <span class="chat-username">${isMe ? 'Bạn' : data.username}</span>
            <span class="chat-time">${data.timestamp}</span>
        </div>
        <div class="chat-msg-content">${escapeHtml(data.message)}</div>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight; 
};

function sendChatMessage() {
    const input = document.getElementById("chat-input");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    sendPacket({
        type: "CHAT",
        userId: currentUser.id,
        username: currentUser.username,
        message: message
    });

    input.value = "";
}

function handleChatKeyPress(event) {
    if (event.key === "Enter") {
        sendChatMessage();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.onServerMessage = function (msg) {

    if (msg.startsWith("ITEM") || msg.startsWith("NO_ITEMS")) {
        processItemList(msg);
    }

    else if (msg.startsWith("ITEM_DELETED")) {
        const parts = msg.split(" ");
        const itemId = parseInt(parts[1]);
        console.log("🗑️ Item deleted:", itemId);
        allItems = allItems.filter(i => i.id !== itemId);
        rerenderQueue();
        if (currentStageItemId === itemId) {
            clearStage();
        }
    }
    else if (msg.startsWith("OK DELETE_ITEM")) {
        showToast("Đã xóa vật phẩm!", "success");
        loadItems();
    }
    else if (msg.startsWith("ERROR DELETE_ITEM")) {
        const err = msg.substring("ERROR DELETE_ITEM".length).trim();
        showToast("Lỗi xóa: " + err, 'error');
    }

    else if (msg.startsWith("AUCTION_STARTED")) {
        const parts = msg.split(" ");
        const itemId = parseInt(parts[1]);
        const startPrice = parseInt(parts[2]);
        const seconds = parseInt(parts[4]);

        let imageUrl = "";

        if (parts.length >= 6) {
            imageUrl = parts[5];
            if (imageUrl === "NOIMG") imageUrl = "";
        }

        console.log("📢 AUCTION_STARTED Raw Msg:", msg);
        console.log("   - Parts count:", parts.length);
        console.log("   - ImageUrl found:", imageUrl ? (imageUrl.substring(0, 50) + "...") : "EMPTY");

        let item = allItems.find(i => i.id === itemId);

        if (item) {

            item.status = "ONGOING";
            item.price = startPrice;
            if (imageUrl) item.imageUrl = imageUrl;
        } else {

            item = {
                id: itemId,
                name: "Sản phẩm #" + itemId,
                price: startPrice,
                status: "ONGOING",
                sellerId: "?",
                imageUrl: imageUrl
            };
            allItems.push(item);
        }

        renderMainStage(item, seconds);

        rerenderQueue();

        loadItems();
    }

    else if (msg.startsWith("NEW_BID")) {
        const parts = msg.split(" ");
        const itemId = parseInt(parts[1]);
        const userId = parts[2];
        const newPrice = parseInt(parts[3]);
        const seconds = parseInt(parts[4]);

        console.log("📣 NEW_BID received:", { itemId, userId, newPrice, seconds, currentStageItemId });

        if (itemId === currentStageItemId) {
            console.log("✅ Updating UI with new price:", newPrice);
            updateLiveAuctionUI(newPrice, userId, seconds);

            if (userId != currentUser.id) {
                showToast(`🔥 User #${userId} đặt giá ${newPrice.toLocaleString()}đ`, 'warning', 3000);
                playBidSound();
            }
        } else {
            console.log("⚠️ ItemId mismatch! Not updating UI. itemId:", itemId, "vs currentStageItemId:", currentStageItemId);
        }

        const localItem = allItems.find(i => i.id === itemId);
        if (localItem) {
            localItem.price = newPrice;
            rerenderQueue(); 
        }
    }

    else if (msg.startsWith("TIME_LEFT")) {
        const parts = msg.split(" ");
        const itemId = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);

        if (itemId === currentStageItemId) {
            startCountdown(seconds);
            if (seconds <= 10) {
                showToast(`⚠️ Chỉ còn ${seconds} giây!`, 'error', 2000);
            }
        }
    }

    else if (msg.startsWith("AUCTION_FINISHED") || msg.startsWith("ITEM_SOLD")) {

        const parts = msg.split(" ");
        const winnerId = parts[2];
        const finalPrice = parseInt(parts[3]) || 0;

        if (winnerId == currentUser.id) {
            showToast(`🎉 Chúc mừng! Bạn đã thắng với giá ${finalPrice.toLocaleString()}đ!`, 'success', 6000);
            showConfetti(); 
        } else {
            showToast(`🔔 Phiên đấu giá kết thúc! Người thắng: User #${winnerId}`, 'info', 5000);
        }

        bidHistory = []; 
        loadItems(); 
        clearStage();
    }

    else if (msg.startsWith("AUCTION_EXPIRED")) {
        const itemId = parseInt(msg.split(" ")[1]);

        if (itemId === currentStageItemId) {
            showToast("⏰ Hết giờ! Vật phẩm không có người mua.", 'warning', 5000);
            clearStage();
        }

        loadItems(); 
    }

    else if (msg.startsWith("OK CREATE_ITEM")) {
        showToast("✅ Đăng bán vật phẩm thành công!", 'success', 3000);
        loadItems();
        closeModalItem();
    }
    else if (msg.startsWith("OK START_AUCTION")) {

        const parts = msg.split(" ");
        const itemId = parseInt(parts[2]);
        const seconds = parseInt(parts[3]);

        console.log("📢 OK START_AUCTION received:", { itemId, seconds });
        showToast("🔔 Phiên đấu giá đã bắt đầu!", 'info', 3000);

        loadItems();
    }
    else if (msg.startsWith("OK BID")) {
        showToast("Đặt giá thành công!", 'success', 2000);
        console.log("Đặt giá thành công (chờ NEW_BID để update UI)");
    }
    else if (msg.startsWith("OK BUY_NOW")) {

        const parts = msg.split(" ");
        const itemId = parseInt(parts[2]);
        const price = parseInt(parts[3]);
        showToast(`Mua ngay thành công! Giá: ${price.toLocaleString()} đ`, 'success', 4000);
        showConfetti();
        clearStage();
        loadItems();
    }

    else if (msg.startsWith("BID_RECORD") || msg.startsWith("NO_BIDS")) {
        processBidHistory(msg);
    }

    else if (msg.startsWith("ROOM ")) {
        processRoomInfo(msg);
    }

    else if (msg.startsWith("MEMBER ") || msg.startsWith("NO_MEMBERS")) {
        processRoomMembers(msg);
    }

    else if (msg.startsWith("USER_JOINED ")) {
        const parts = msg.split(" ");
        const userId = parseInt(parts[1]);
        const username = parts[2] || "User";
        addMemberToList(userId, username);
        showToast(`${username} đã vào phòng`, 'info', 2000);
    }

    else if (msg.startsWith("USER_LEFT ")) {
        const parts = msg.split(" ");
        const userId = parseInt(parts[1]);
        removeMemberFromList(userId);
    }

    else if (msg.startsWith("OK CLOSE_ROOM")) {
        showToast("🔒 Đã đóng phòng đấu giá", 'info', 3000);
        roomStatus = 0;
        document.getElementById("room-owner-display").innerText += " (ĐÃ ĐÓNG)";
        closeSettingsModal();
        if (roomOwnerId !== currentUser.id) {
            alert("Phòng đấu giá đã bị chủ phòng đóng.");
        }
    }
    else if (msg.startsWith("OK OPEN_ROOM")) {
        showToast("🔓 Đã mở lại phòng đấu giá", 'success', 3000);
        roomStatus = 1;
        const ownerElem = document.getElementById("room-owner-display");
        if (ownerElem) ownerElem.innerText = ownerElem.innerText.replace(" (ĐÃ ĐÓNG)", "");
        closeSettingsModal();
    }

    else if (msg.startsWith("ERROR")) {
        showToast(msg.replace("ERROR ", ""), 'error', 4000);
    }
};

function openSettingsModal() {
    const modal = document.getElementById("modal-settings");
    if (!modal) return;

    modal.style.display = "flex";

    const statusText = document.getElementById("room-status-text");
    const btnClose = document.getElementById("btn-close-room");
    const btnOpen = document.getElementById("btn-open-room");

    if (roomStatus === 1) {
        statusText.innerHTML = "Trạng thái: <strong style='color:#38ef7d'>ĐANG MỞ</strong>";
        if (btnClose) btnClose.style.display = "block";
        if (btnOpen) btnOpen.style.display = "none";
    } else {
        statusText.innerHTML = "Trạng thái: <strong style='color:#ff416c'>ĐÃ ĐÓNG</strong>";
        if (btnClose) btnClose.style.display = "none";
        if (btnOpen) btnOpen.style.display = "block";
    }
}

function closeSettingsModal() {
    const modal = document.getElementById("modal-settings");
    if (modal) modal.style.display = "none";
}

function sendCloseRoom() {
    if (confirm("Bạn có chắc muốn ĐÓNG phòng đấu giá? Người khác sẽ không thể tham gia.")) {
        sendPacket({ type: "CLOSE_ROOM", roomId: roomId });
    }
}

function sendOpenRoom() {
    if (confirm("Bạn có chắc muốn MỞ lại phòng đấu giá?")) {
        sendPacket({ type: "OPEN_ROOM", roomId: roomId });
    }
}

function processItemList(textData) {
    const queueContainer = document.getElementById("queue-list-container");
    if (!queueContainer) return;

    queueContainer.innerHTML = "";
    allItems = [];
    let hasRunningItem = false;

    if (textData.trim() !== "NO_ITEMS") {
        const lines = textData.split("\n");
        lines.forEach(line => {
            line = line.trim();
            if (!line.startsWith("ITEM")) return;

            const parts = line.split(" ");

            if (parts.length >= 9) {

                let imageUrl = "";
                let endTimeStr = null;

                if (parts.length >= 13) {
                    imageUrl = parts[parts.length - 1];
                    if (imageUrl === "NOIMG") imageUrl = "";
                }

                if (parts.length >= 15) {
                    endTimeStr = parts[12] + " " + parts[13];
                } else if (parts.length === 13) {

                } else {

                    if (parts.length >= 13 && parts[11] !== "NULL") {

                    }
                }

                const item = {
                    id: parseInt(parts[1]),
                    sellerId: parts[3],
                    sellerName: parts[4].replace(/_/g, ' '),
                    name: parts[5].replace(/_/g, ' '),
                    price: parseInt(parts[6]),
                    buyNowPrice: parseInt(parts[7]) || 0, 
                    status: parts[8], 
                    endTime: endTimeStr,
                    imageUrl: imageUrl
                };
                allItems.push(item);

                if (item.status === 'ONGOING' || item.status === 'WAIT') {
                    renderQueueItem(item, queueContainer);
                }

                if (item.status === 'ONGOING') {

                    if (currentStageItemId === item.id && timerInterval) {
                        console.log("⏳ Item đang hiển thị với timer, bỏ qua render");
                        hasRunningItem = true;
                    } else {

                        let secondsLeft = 120; 
                        if (item.endTime) {
                            const end = new Date(item.endTime);
                            const now = new Date();
                            const diff = Math.floor((end - now) / 1000);
                            console.log("📅 endTime:", item.endTime, "diff:", diff);
                            if (!isNaN(diff) && diff > 0) {
                                secondsLeft = diff;
                            }
                        }

                        renderMainStage(item, secondsLeft);
                        hasRunningItem = true;
                    }
                }
            }
        });
    }

    const countElem = document.getElementById("item-count");
    if (countElem) countElem.innerText = allItems.length;

    if (!hasRunningItem) {
        clearStage();
    }
}

function renderQueueItem(item, container) {
    const div = document.createElement("div");
    div.className = "queue-item";

    let statusHtml = "";
    let actionHtml = "";

    if (item.status === 'ONGOING') {
        statusHtml = `<span class="q-status running">LIVE</span>`;
        actionHtml = `<span class="q-live-indicator"><i class="fa-solid fa-circle"></i></span>`;
        div.style.backgroundColor = "rgba(255, 65, 108, 0.1)";
    }

    else if (item.status === 'WAIT') {
        statusHtml = `<span class="q-status waiting">CHỜ</span>`;
        actionHtml = `<div class="q-actions">
                        <button class="btn-icon btn-play" onclick="startAuction(${item.id})" title="Bắt đầu đấu giá">
                            <i class="fa-solid fa-play"></i>
                        </button>`;
        if (item.sellerId == currentUser.id || roomOwnerId == currentUser.id) {
            actionHtml += `<button class="btn-icon btn-trash" onclick="event.stopPropagation(); deleteItem(${item.id})" title="Xóa">
                            <i class="fa-solid fa-trash"></i>
                          </button>`;
        }
        actionHtml += `</div>`;
    }

    else {
        statusHtml = `<span class="q-status finished">${item.status}</span>`;
        actionHtml = `<div class="q-actions">
                        <button class="btn-icon btn-info-icon" onclick="showItemInfo(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.status}')" title="Xem chi tiết">
                            <i class="fa-solid fa-circle-info"></i>
                        </button>
                      </div>`;
    }

    div.innerHTML = `
        <div class="q-name" title="${item.name}">${item.name}</div>
        ${statusHtml}
        <div class="q-time">${actionHtml}</div>
    `;
    container.appendChild(div);
}

let roomStatus = 1;

function processRoomInfo(textData) {
    const lines = textData.split("\n");
    lines.forEach(line => {
        line = line.trim();
        if (!line.startsWith("ROOM ")) return;

        const parts = line.split(" ");
        if (parts.length >= 5) {
            const id = parseInt(parts[1]);
            const name = parts[2].replace(/_/g, ' ');
            const ownerId = parseInt(parts[3]);
            const ownerName = parts[4].replace(/_/g, ' ');
            const status = parts.length >= 6 ? parseInt(parts[5]) : 1;

            if (id === roomId) {
                roomOwnerId = ownerId; 
                roomStatus = status;   

                const ownerElem = document.getElementById("room-owner-display");
                if (ownerElem) {
                    ownerElem.innerText = ownerName + (status === 0 ? " (ĐÃ ĐÓNG)" : "");
                }

                const actionsBtn = document.querySelector(".room-actions-btn");
                if (actionsBtn && roomOwnerId === currentUser.id && !document.getElementById("btn-room-settings")) {
                    const btn = document.createElement("button");
                    btn.id = "btn-room-settings";
                    btn.className = "btn-icon";
                    btn.style.cssText = "background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; width:40px; height:40px; border-radius:8px; margin-left:10px; cursor:pointer;";
                    btn.innerHTML = '<i class="fa-solid fa-cog"></i>';
                    btn.onclick = openSettingsModal;
                    btn.title = "Cài đặt phòng";
                    actionsBtn.appendChild(btn);
                }

                rerenderQueue();
            }
        }
    });
}

let roomMembers = [];

function processRoomMembers(textData) {
    const list = document.getElementById("participant-list");
    if (!list) return;

    roomMembers = [];
    list.innerHTML = "";

    if (textData.trim() === "NO_MEMBERS") {
        list.innerHTML = '<div class="no-participants">Chưa có ai trong phòng</div>';
        updateUserCount();
        return;
    }

    const lines = textData.split("\n");
    lines.forEach(line => {
        line = line.trim();
        if (!line.startsWith("MEMBER ")) return;

        const parts = line.split(" ");
        if (parts.length >= 3) {
            const userId = parseInt(parts[1]);
            const username = parts[2];
            roomMembers.push({ userId, username });
        }
    });

    renderMembersList();
    updateUserCount();
}

function renderMembersList() {
    const list = document.getElementById("participant-list");
    if (!list) return;

    list.innerHTML = "";

    if (roomMembers.length === 0) {
        list.innerHTML = '<div class="no-participants">Chưa có ai trong phòng</div>';
        return;
    }

    roomMembers.forEach((member, index) => {
        const isMe = member.userId == currentUser.id;
        const html = `
            <div class="user-card ${isMe ? 'me' : ''}" data-user-id="${member.userId}">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(member.username)}&background=random">
                <div class="u-info">
                    <span class="u-name">${member.username}${isMe ? ' (Bạn)' : ''}</span>
                    <span class="u-role">Thành viên</span>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

function addMemberToList(userId, username) {

    if (roomMembers.find(m => m.userId === userId)) return;

    roomMembers.push({ userId, username });
    renderMembersList();
    updateUserCount();
}

function removeMemberFromList(userId) {
    roomMembers = roomMembers.filter(m => m.userId !== userId);
    renderMembersList();
    updateUserCount();
}

function updateUserCount() {
    const userCountElem = document.getElementById("user-count");
    if (userCountElem) {
        userCountElem.innerText = roomMembers.length;
    }
}

function rerenderQueue() {
    const queueContainer = document.getElementById("queue-list-container");
    if (!queueContainer) return;

    queueContainer.innerHTML = "";
    allItems.forEach(item => {
        renderQueueItem(item, queueContainer);
    });
}

function renderMainStage(item, secondsLeft) {
    currentStageItemId = item.id;

    const stage = document.getElementById("auction-stage");
    if (!stage) return;

    const itemNameKey = item.name.replace(/\s+/g, '_');
    let imageUrl = getItemImage(itemNameKey) || item.imageUrl;

    if (imageUrl && imageUrl.startsWith('uploads/')) {
        const apiUrl = window.getApiUrl ? window.getApiUrl() : "http://localhost:3000";
        imageUrl = `${apiUrl}/${imageUrl}`;
    }

    if (!imageUrl) {
        imageUrl = 'https://thumbs.dreamstime.com/b/no-image-available-icon-flat-vector-no-image-available-icon-flat-vector-illustration-132482953.jpg';
    }

    stage.innerHTML = `
        <div class="product-image-area">
            <img src="${imageUrl}" alt="${item.name}" onerror="this.src='https://thumbs.dreamstime.com/b/no-image-available-icon-flat-vector-no-image-available-icon-flat-vector-illustration-132482953.jpg'">
        </div>
        <div class="bidding-area">
            <div class="auction-header">
                <div>
                    <h2 style="margin:0; color:#333; font-size:1.5rem">${item.name}</h2>
                    <span class="item-code">Người bán: ${item.sellerName || 'User #' + item.sellerId}</span>
                </div>
                <div class="timer-box" id="timer-display">
                    <i class="fa-regular fa-clock"></i> <span>--:--</span>
                </div>
            </div>

            <div class="price-box">
                <div class="current-price-label">Giá hiện tại:</div>
                <div class="current-price-val" id="live-price">${item.price.toLocaleString()} VND</div>
            </div>

            ${(item.buyNowPrice > 0 && parseInt(item.price) < parseInt(item.buyNowPrice)) ? `
            <div class="buy-now-box" style="background:linear-gradient(135deg,#ff416c,#ff4b2b);padding:15px;border-radius:12px;margin-bottom:20px;text-align:center;">
                <div style="color:#fff;font-size:0.9rem;margin-bottom:5px;">Mua ngay với giá:</div>
                <div style="color:#fff;font-weight:700;font-size:1.3rem;margin-bottom:10px;">${item.buyNowPrice.toLocaleString()} VND</div>
                <button class="btn-buy-now" onclick="buyNow(${item.id}, ${item.buyNowPrice})" style="background:#fff;color:#ff416c;border:none;padding:10px 30px;border-radius:25px;font-weight:700;cursor:pointer;font-size:1rem;transition:all 0.3s;">
                    <i class="fa-solid fa-bolt"></i> MUA NGAY
                </button>
            </div>
            ` : ''}

            <div class="bid-control">
                <label>Đặt giá nhanh:</label>
                <div class="quick-bid-buttons">
                    <button class="quick-bid-btn" onclick="quickBid(${item.id}, 10000)">+10K</button>
                    <button class="quick-bid-btn" onclick="quickBid(${item.id}, 50000)">+50K</button>
                    <button class="quick-bid-btn" onclick="quickBid(${item.id}, 100000)">+100K</button>
                    <button class="quick-bid-btn" onclick="quickBid(${item.id}, 500000)">+500K</button>
                </div>
                
                <label style="margin-top:15px;">Hoặc nhập số tiền:</label>
                <div class="bid-input-group">
                    <input type="number" id="inp-bid-amount" placeholder="Gợi ý: ${item.price + 10000}">
                    <button class="btn-place-bid" onclick="placeBid(${item.id})">Đặt giá</button>
                </div>
            </div>
            
            <div class="bid-history-panel">
                <div class="bid-history-header">
                    <i class="fa-solid fa-history"></i> Lịch sử đặt giá
                </div>
                <div class="bid-history-list" id="bid-history-list">
                    <div class="bid-history-empty">Chưa có lượt đặt giá</div>
                </div>
            </div>
        </div>
    `;

    if (secondsLeft !== null) {
        startCountdown(secondsLeft);
    }

    loadBidHistory(item.id);
}

function updateLiveAuctionUI(newPrice, userId, secondsLeft) {

    const priceElem = document.getElementById("live-price");
    if (priceElem) {
        priceElem.innerText = newPrice.toLocaleString() + " VND";

        priceElem.style.transform = "scale(1.1)";
        priceElem.style.transition = "transform 0.3s";
        setTimeout(() => priceElem.style.transform = "scale(1)", 300);
    }

    const inp = document.getElementById("inp-bid-amount");
    if (inp) inp.placeholder = `Gợi ý: ${newPrice + 10000}`;

    addBidToHistory(userId, newPrice);

    updateParticipantsList(userId, newPrice);

    startCountdown(secondsLeft);

    const item = allItems.find(i => i.id === currentStageItemId);
    if (item && item.buyNowPrice > 0) {
        if (newPrice >= item.buyNowPrice) {
            const buyNowBox = document.querySelector(".buy-now-box");
            if (buyNowBox) {
                buyNowBox.style.display = 'none'; 
            }
        }
    }
}

function quickBid(itemId, amount) {
    const priceElem = document.getElementById("live-price");
    if (!priceElem) return;

    const priceText = priceElem.innerText;
    const currentPrice = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
    const newBid = currentPrice + amount;

    console.log("🔍 quickBid DEBUG:", {
        priceText: priceText,
        currentPrice: currentPrice,
        addAmount: amount,
        newBid: newBid
    });

    sendPacket({ type: "BID", itemId: itemId, amount: newBid });
    showToast(`💰 Đặt giá ${newBid.toLocaleString()}đ`, 'info', 2000);
}

let bidHistory = [];

function addBidToHistory(userId, price) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN');

    const username = (userId == currentUser.id) ? currentUser.username : null;

    bidHistory.unshift({
        userId: userId,
        username: username,
        price: price,
        time: timeStr
    });

    if (bidHistory.length > 10) bidHistory.pop();

    renderBidHistory();

    clearTimeout(window.bidHistoryReloadTimer);
    window.bidHistoryReloadTimer = setTimeout(() => {
        if (currentStageItemId > 0) {
            loadBidHistory(currentStageItemId);
        }
    }, 500);
}

function renderBidHistory() {
    const container = document.getElementById("bid-history-list");
    if (!container) return;

    if (bidHistory.length === 0) {
        container.innerHTML = '<div class="bid-history-empty">Chưa có lượt đặt giá</div>';
        return;
    }

    container.innerHTML = bidHistory.map((bid, index) => {
        let displayName = bid.username || `User #${bid.userId}`;
        if (bid.userId == currentUser.id) displayName = '🏆 Bạn';

        return `
        <div class="bid-history-item ${index === 0 ? 'latest' : ''}">
            <span class="bid-user">${displayName}</span>
            <span class="bid-price">${bid.price.toLocaleString()}đ</span>
            <span class="bid-time">${bid.time}</span>
        </div>
    `}).join('');
}

function processBidHistory(textData) {
    console.log("📜 Processing bid history:", textData);

    if (textData.trim() === "NO_BIDS") {
        bidHistory = [];
        renderBidHistory();
        return;
    }

    const lines = textData.split("\n");
    bidHistory = [];

    lines.forEach(line => {
        line = line.trim();
        if (!line.startsWith("BID_RECORD")) return;

        const parts = line.split(" ");
        if (parts.length >= 5) {
            const userId = parts[1];
            const username = parts[2];
            const amount = parseInt(parts[3]);

            const time = parts.slice(4).join(" ");

            bidHistory.push({
                userId: userId,
                username: username,
                price: amount,
                time: time
            });
        }
    });

    renderBidHistory();

    updateParticipantsFromHistory();
}

function loadBidHistory(itemId) {
    if (itemId <= 0) return;
    console.log("📜 Loading bid history for item:", itemId);
    sendPacket({ type: "LIST_BIDS", itemId: itemId });
}

function updateParticipantsFromHistory() {
    const list = document.getElementById("participant-list");
    if (!list) return;

    list.innerHTML = "";

    const seenUsers = new Set();
    bidHistory.forEach((bid, index) => {
        if (seenUsers.has(bid.userId)) return;
        seenUsers.add(bid.userId);

        const isHighest = index === 0;
        const displayName = bid.username || `User #${bid.userId}`;

        const html = `
            <div class="user-card ${isHighest ? 'highest' : ''}">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random">
                <div class="u-info">
                    <span class="u-name">${displayName}</span>
                    <span class="u-role">${isHighest ? 'Đang dẫn đầu' : 'Đã tham gia'}</span>
                    <span class="u-price" style="color:#0066ff">${bid.price.toLocaleString()}</span>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });

    const userCountElem = document.getElementById("user-count");
    if (userCountElem) {
        userCountElem.innerText = seenUsers.size;
    }

    if (bidHistory.length === 0) {
        list.innerHTML = '<div class="no-participants">Chưa có ai tham gia</div>';
    }
}

function showConfetti() {
    const colors = ['#667eea', '#764ba2', '#f5576c', '#38ef7d', '#4facfe'];
    const container = document.body;

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -10px;
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            animation: confettiFall ${2 + Math.random() * 2}s ease-out forwards;
            z-index: 9999;
        `;
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
    }
}

function updateParticipantsList(userId, price) {
    const list = document.getElementById("participant-list");
    if (!list) return;

    const html = `
        <div class="user-card highest">
            <img src="https://ui-avatars.com/api/?name=User${userId}&background=random">
            <div class="u-info">
                <span class="u-name">User #${userId}</span>
                <span class="u-role">Vừa đặt giá</span>
                <span class="u-price" style="color:#0066ff">${price.toLocaleString()}</span>
            </div>
        </div>
    `;
    list.insertAdjacentHTML('afterbegin', html);

    while (list.children.length > 5) {
        list.removeChild(list.lastChild);
    }
}

function clearStage() {
    currentStageItemId = 0;
    if (timerInterval) clearInterval(timerInterval);

    const stage = document.getElementById("auction-stage");
    if (stage) {
        stage.innerHTML = `
            <div class="empty-stage">
                <img src="https://cdni.iconscout.com/illustration/premium/thumb/waiting-room-4438795-3718469.png" style="width:150px; opacity:0.6">
                <h3>Chưa có phiên đấu giá nào đang diễn ra</h3>
                <p>Vui lòng chọn vật phẩm trong hàng đợi để bắt đầu.</p>
            </div>
        `;
    }
    const list = document.getElementById("participant-list");
    if (list) list.innerHTML = "";
}

function startCountdown(seconds) {

    if (timerInterval) clearInterval(timerInterval);

    const timerElem = document.getElementById("timer-display");
    if (!timerElem) return;

    let timeLeft = seconds;

    const updateDisplay = () => {
        if (timeLeft < 0) timeLeft = 0;
        const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const sec = (timeLeft % 60).toString().padStart(2, '0');

        timerElem.innerHTML = `<i class="fa-regular fa-clock"></i> ${min}:${sec}`;

        if (timeLeft <= 30) {
            timerElem.classList.add("warning");
        } else {
            timerElem.classList.remove("warning");
        }
    };

    updateDisplay(); 

    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);

        }
    }, 1000);
}

function startAuction(itemId) {

    const durationStr = prompt("Nhập thời gian đấu giá (giây):", "120");

    if (durationStr === null) {

        return;
    }

    const duration = parseInt(durationStr, 10);

    if (isNaN(duration) || duration < 30) {
        alert("Thời gian phải là số và ít nhất 30 giây!");
        return;
    }

    if (duration > 3600) {
        alert("Thời gian tối đa là 1 giờ (3600 giây)!");
        return;
    }

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const timeStr = minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;

    if (confirm(`Bắt đầu đấu giá vật phẩm này trong ${timeStr}?`)) {
        sendPacket({ type: "START_AUCTION", itemId: itemId, duration: duration });
    }
}

function placeBid(itemId) {
    const inp = document.getElementById("inp-bid-amount");
    const amountStr = inp.value.trim();

    if (!amountStr) {
        alert("Vui lòng nhập số tiền");
        return;
    }

    const amount = parseInt(amountStr.replace(/[^\d]/g, ''), 10);

    if (isNaN(amount) || amount <= 0) {
        alert("Vui lòng nhập số tiền hợp lệ");
        return;
    }

    sendPacket({ type: "BID", itemId: itemId, amount: amount });
    inp.value = ""; 
}

function buyNow(itemId, buyNowPrice) {
    const item = allItems.find(i => i.id === itemId);
    const itemName = item ? item.name : `Item #${itemId}`;
    const price = buyNowPrice || (item ? item.buyNowPrice : 0);

    if (price <= 0) {
        showToast("Vật phẩm này không có giá mua ngay", "error");
        return;
    }

    if (confirm(`Xác nhận mua ngay "${itemName}" với giá ${price.toLocaleString()} đ?`)) {
        sendPacket({ type: "BUY_NOW", itemId: itemId });
    }
}

function backToLobby() {
    if (confirm("Rời khỏi phòng đấu giá?")) {
        sendPacket({ type: "LEAVE_ROOM" });
        window.location.href = "home.html";
    }
}

function openCreateItemModal() {
    const modal = document.getElementById("modal-create-item");
    if (modal) modal.style.display = "flex";
}
function closeModalItem() {
    const modal = document.getElementById("modal-create-item");
    if (modal) modal.style.display = "none";

    document.getElementById("image-preview").style.display = "none";
    document.getElementById("preview-img").src = "";
}

let selectedImageBase64 = "";

function handleFileUpload(input) {
    const preview = document.getElementById("image-preview");
    const previewImg = document.getElementById("preview-img");

    if (input.files && input.files[0]) {
        const file = input.files[0];

        if (file.size > 5 * 1024 * 1024) {
            showToast("❌ Ảnh quá lớn! Tối đa 5MB", "error");
            input.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {

            previewImg.src = e.target.result;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = "none";
    }
}

async function confirmCreateItem() {
    const name = document.getElementById("inp-item-name").value.trim();
    const price = document.getElementById("inp-item-price").value;
    const buyNowPrice = document.getElementById("inp-item-buynow").value || 0;
    const fileInput = document.getElementById("inp-item-image");

    if (!name) {
        showToast("⚠️ Vui lòng nhập tên sản phẩm!", "warning");
        return;
    }
    if (!price || parseInt(price) <= 0) {
        showToast("⚠️ Vui lòng nhập giá khởi điểm hợp lệ!", "warning");
        return;
    }

    const itemKey = name.replace(/\s+/g, '_');
    let imageUrl = "";

    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("image", file);

        showToast("⏳ Đang tải ảnh lên...", "info");

        try {

            const apiUrl = window.getApiUrl ? window.getApiUrl() : "http://localhost:3000";
            const response = await fetch(`${apiUrl}/upload`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            imageUrl = data.url; 
            console.log("✅ Upload success:", imageUrl);

        } catch (err) {
            console.error("Upload error:", err);
            showToast("❌ Lỗi tải ảnh: " + err.message, "error");
            return; 
        }
    }

    console.log("📤 CREATE_ITEM: Sending...", { name: itemKey, price, imageUrl });
    showToast("⏳ Đang tạo phiên đấu giá...", "info");

    sendPacket({
        type: "CREATE_ITEM",
        name: itemKey,
        startPrice: parseInt(price),
        buyNowPrice: parseInt(buyNowPrice) || 0,
        imageUrl: imageUrl
    });

    document.getElementById("inp-item-name").value = '';
    document.getElementById("inp-item-image").value = '';
    document.getElementById("inp-item-price").value = '';
    document.getElementById("inp-item-buynow").value = '';
    document.getElementById("image-preview").style.display = "none";

    closeModalItem();
}

function getItemImage(itemName) {
    const itemImages = JSON.parse(localStorage.getItem("itemImages") || "{}");
    return itemImages[itemName] || null;
}

function deleteItem(itemId) {
    if (confirm("Bạn có chắc muốn xóa vật phẩm này?")) {
        sendPacket({ type: "DELETE_ITEM", itemId: itemId });
    }
}

function showItemInfo(itemId, itemName, price, status) {
    const statusText = status === 'SOLD' ? 'Đã bán' : 'Hết hạn';
    const priceText = price.toLocaleString() + ' đ';
    showToast(`Tên: ${itemName}<br>Giá: ${priceText}<br>Trạng thái: ${statusText}`, 'info', 4000);
}

function showAllAuctions() {
    const modal = document.getElementById("modal-all-auctions");
    const list = document.getElementById("all-auctions-list");
    if (!modal || !list) return;

    list.innerHTML = "";

    if (allItems.length === 0) {
        list.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">Chưa có phiên đấu giá nào</p>';
    } else {
        allItems.forEach(item => {
            let statusClass = '';
            let statusText = '';
            switch (item.status) {
                case 'ONGOING':
                    statusClass = 'running';
                    statusText = 'ĐANG DIỄN RA';
                    break;
                case 'WAIT':
                    statusClass = 'waiting';
                    statusText = 'CHỜ ĐẤU GIÁ';
                    break;
                case 'SOLD':
                    statusClass = 'finished';
                    statusText = 'ĐÃ BÁN';
                    break;
                case 'EXPIRED':
                    statusClass = 'finished';
                    statusText = 'HẾT HẠN';
                    break;
                default:
                    statusClass = '';
                    statusText = item.status;
            }

            let imgUrl = item.imageUrl;
            if (imgUrl && imgUrl.startsWith('uploads/')) {
                const apiUrl = window.getApiUrl ? window.getApiUrl() : "http://localhost:3000";
                imgUrl = `${apiUrl}/${imgUrl}`;
            }

            if (!imgUrl || imgUrl.length <= 5) {
                imgUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=667eea&color=fff&size=60`;
            }

            const html = `
                <div class="auction-detail-item" style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:10px;">
                    <img src="${imgUrl}" 
                         style="width:50px;height:50px;min-width:50px;object-fit:cover;border-radius:8px;border:2px solid rgba(102,126,234,0.3);"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=667eea&color=fff&size=50'">
                    <div style="flex:1;min-width:0;overflow:hidden;">
                        <div style="font-weight:600;color:#fff;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.name}">${item.name}</div>
                        <div style="font-size:0.8rem;color:#a8b5ff;">
                            ${item.status === 'SOLD' ? 'Giá bán:' : (item.status === 'EXPIRED' ? 'Giá KĐ:' : 'Giá hiện tại:')} <strong style="color:#38ef7d;">${item.price.toLocaleString()} đ</strong>
                            ${item.buyNowPrice > 0 && item.status !== 'SOLD' ? `<span style="color:#ff6b8a;margin-left:8px;font-size:0.7rem;">(Mua ngay: ${item.buyNowPrice.toLocaleString()}đ)</span>` : ''}
                        </div>
                        <div style="font-size:0.75rem;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Người bán: ${item.sellerName}</div>
                    </div>
                    <span class="q-status ${statusClass}" style="padding:5px 10px;font-size:0.7rem;flex-shrink:0;">${statusText}</span>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', html);
        });
    }

    modal.style.display = "flex";
}

function closeAllAuctionsModal() {
    const modal = document.getElementById("modal-all-auctions");
    if (modal) modal.style.display = "none";
}