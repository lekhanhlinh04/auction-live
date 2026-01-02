// ============================================================
// 1. CẤU HÌNH & KHỞI TẠO
// ============================================================

// Kiểm tra đăng nhập
const userJson = localStorage.getItem("user");
if (!userJson) window.location.href = "index.html";
const currentUser = JSON.parse(userJson);

// Đoạn code ở đầu file js/room.js
const urlParams = new URLSearchParams(window.location.search);
const roomIdParam = urlParams.get('id'); // Lấy số từ URL

if (!roomIdParam) {
    alert("Thiếu ID phòng!");
    window.location.href = "home.html";
}

// Đảm bảo roomId là số
const roomId = parseInt(roomIdParam, 10);
if (isNaN(roomId) || roomId <= 0) {
    alert("ID phòng không hợp lệ!");
    window.location.href = "home.html";
}

setTimeout(() => {
    // Gửi packet: tên thuộc tính phải là "roomId" để khớp với server.js ở trên
    sendPacket({ type: "JOIN_ROOM", roomId: roomId });
    loadItems();
}, 500);

// Hiển thị thông tin người dùng và phòng
document.getElementById("user-name").innerText = currentUser.username;
document.getElementById("user-avatar").src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`;
document.getElementById("room-id-display").innerText = "R" + String(roomId).padStart(3, '0');

// Biến toàn cục
let timerInterval = null;     // ID của bộ đếm thời gian
let currentStageItemId = 0;   // ID vật phẩm đang trên sân khấu
let allItems = [];            // Lưu danh sách vật phẩm cục bộ

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
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

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Sound effects (optional - uncomment if you have audio files)
// const bidSound = new Audio('sounds/bid.mp3');
// const winSound = new Audio('sounds/win.mp3');

function playBidSound() {
    // bidSound.currentTime = 0;
    // bidSound.play().catch(() => {});
}


function loadItems() {
    sendPacket({ type: "LIST_ITEMS", roomId: roomId });
}

// ============================================================
// CHAT FUNCTIONALITY
// ============================================================

// Xử lý nhận tin nhắn chat
window.onChatMessage = function (data) {
    const container = document.getElementById("chat-messages");
    if (!container) return;

    // Xóa welcome message nếu có
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
    container.scrollTop = container.scrollHeight; // Auto-scroll xuống cuối
};

// Gửi tin nhắn chat
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

// Xử lý Enter để gửi tin nhắn
function handleChatKeyPress(event) {
    if (event.key === "Enter") {
        sendChatMessage();
    }
}

// Escape HTML để tránh XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// 2. XỬ LÝ TIN NHẮN TỪ SERVER (CORE LOGIC)
// ============================================================

window.onServerMessage = function (msg) {
    // console.log("Room nhận:", msg); // Bật log này nếu muốn debug

    // --- A. DANH SÁCH VẬT PHẨM (Load khi vào phòng hoặc F5) ---
    if (msg.startsWith("ITEM") || msg.startsWith("NO_ITEMS")) {
        processItemList(msg);
    }
    // --- ITEM DELETED ---
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

    // --- B. BẮT ĐẦU ĐẤU GIÁ (Broadcast) ---
    // Format: AUCTION_STARTED itemId startPrice buyNow seconds
    else if (msg.startsWith("AUCTION_STARTED")) {
        const parts = msg.split(" ");
        const itemId = parseInt(parts[1]);
        const startPrice = parseInt(parts[2]);
        const seconds = parseInt(parts[4]);

        console.log("📢 AUCTION_STARTED received:", { itemId, startPrice, seconds });

        // Tìm hoặc tạo item trong allItems
        let item = allItems.find(i => i.id === itemId);

        if (item) {
            // Item đã có trong local -> cập nhật
            item.status = "ONGOING";
            item.price = startPrice;
        } else {
            // Item chưa có trong local -> tạo item tạm
            item = {
                id: itemId,
                name: "Sản phẩm #" + itemId,
                price: startPrice,
                status: "ONGOING",
                sellerId: "?"
            };
            allItems.push(item);
        }

        // Render sân khấu ngay lập tức
        renderMainStage(item, seconds);

        // Re-render hàng đợi ngay lập tức
        rerenderQueue();

        // Gọi loadItems để lấy thông tin đầy đủ từ server
        loadItems();
    }


    // --- C. CÓ NGƯỜI ĐẶT GIÁ MỚI (Broadcast) ---
    // Format: NEW_BID itemId userId price seconds
    else if (msg.startsWith("NEW_BID")) {
        const parts = msg.split(" ");
        const itemId = parseInt(parts[1]);
        const userId = parts[2];
        const newPrice = parseInt(parts[3]);
        const seconds = parseInt(parts[4]);

        // Chỉ cập nhật nếu vật phẩm đó đang hiển thị trên sân khấu
        if (itemId === currentStageItemId) {
            updateLiveAuctionUI(newPrice, userId, seconds);

            // Toast notification cho bid mới
            if (userId != currentUser.id) {
                showToast(`🔥 User #${userId} đặt giá ${newPrice.toLocaleString()}đ`, 'warning', 3000);
                playBidSound();
            }
        }
    }

    // --- D. ĐỒNG BỘ THỜI GIAN (Server gửi khi < 30s) ---
    // Format: TIME_LEFT itemId seconds
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

    // --- E. KẾT THÚC / ĐÃ BÁN ---
    else if (msg.startsWith("AUCTION_FINISHED") || msg.startsWith("ITEM_SOLD")) {
        // Format: AUCTION_FINISHED itemId winnerId finalPrice
        const parts = msg.split(" ");
        const winnerId = parts[2];
        const finalPrice = parseInt(parts[3]) || 0;

        if (winnerId == currentUser.id) {
            showToast(`🎉 Chúc mừng! Bạn đã thắng với giá ${finalPrice.toLocaleString()}đ!`, 'success', 6000);
            showConfetti(); // Hiệu ứng pháo hoa
        } else {
            showToast(`🔔 Phiên đấu giá kết thúc! Người thắng: User #${winnerId}`, 'info', 5000);
        }

        bidHistory = []; // Reset lịch sử
        loadItems(); // Load lại để hiển thị trạng thái SOLD
        clearStage();
    }

    // --- F. HẾT GIỜ (KHÔNG AI MUA) ---
    else if (msg.startsWith("AUCTION_EXPIRED")) {
        const itemId = parseInt(msg.split(" ")[1]);

        if (itemId === currentStageItemId) {
            showToast("⏰ Hết giờ! Vật phẩm không có người mua.", 'warning', 5000);
            clearStage();
        }

        loadItems(); //BẮT BUỘC
    }


    // --- G. CÁC PHẢN HỒI THÀNH CÔNG ---
    else if (msg.startsWith("OK CREATE_ITEM")) {
        showToast("✅ Đăng bán vật phẩm thành công!", 'success', 3000);
        loadItems();
        closeModalItem();
    }
    else if (msg.startsWith("OK START_AUCTION")) {
        // Format: OK START_AUCTION itemId seconds
        const parts = msg.split(" ");
        const itemId = parseInt(parts[2]);
        const seconds = parseInt(parts[3]);

        console.log("📢 OK START_AUCTION received:", { itemId, seconds });
        showToast("🔔 Phiên đấu giá đã bắt đầu!", 'info', 3000);

        // Load items ngay để lấy thông tin mới nhất và hiển thị
        loadItems();
    }
    else if (msg.startsWith("OK BID")) {
        showToast("✅ Đặt giá thành công!", 'success', 2000);
        console.log("Đặt giá thành công (chờ NEW_BID để update UI)");
    }

    // --- H. LỖI ---
    else if (msg.startsWith("ERROR")) {
        showToast("❌ " + msg.replace("ERROR ", ""), 'error', 4000);
    }
};

// ============================================================
// 3. XỬ LÝ DỮ LIỆU & RENDER HÀNG ĐỢI (QUEUE)
// ============================================================

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

            // Format C: ITEM id room sellerId sellerName name start buy status queue start_time end_time imageUrl
            const parts = line.split(" ");

            if (parts.length >= 9) {
                // Xử lý ngày tháng: Server C gửi "YYYY-MM-DD HH:MM:SS" (có khoảng trắng)
                // Nên parts[11] là ngày, parts[12] là giờ, parts[13] là imageUrl
                let endTimeStr = null;
                if (parts.length >= 13) {
                    endTimeStr = parts[11] + " " + parts[12];
                }

                // imageUrl ở vị trí cuối cùng (sau datetime)
                let imageUrl = "";
                if (parts.length >= 14) {
                    imageUrl = parts[13];
                    if (imageUrl === "NOIMG") imageUrl = "";
                }

                const item = {
                    id: parseInt(parts[1]),
                    sellerId: parts[3],
                    sellerName: parts[4].replace(/_/g, ' '),
                    name: parts[5].replace(/_/g, ' '),
                    price: parseInt(parts[6]),
                    status: parts[8], // 'ONGOING', 'WAIT', 'SOLD', 'EXPIRED'
                    endTime: endTimeStr,
                    imageUrl: imageUrl
                };
                allItems.push(item);

                // 1. Render vào cột phải
                renderQueueItem(item, queueContainer);

                // 2. Nếu đang ONGOING -> Đưa lên sân khấu ngay (Fix lỗi F5)
                if (item.status === 'ONGOING') {
                    // Nếu item này đang hiển thị và timer đang chạy -> không render lại
                    if (currentStageItemId === item.id && timerInterval) {
                        console.log("⏳ Item đang hiển thị với timer, bỏ qua render");
                        hasRunningItem = true;
                    } else {
                        // Tính thời gian còn lại dựa trên endTime
                        let secondsLeft = 120; // Default 2 phút nếu không tính được
                        if (item.endTime) {
                            const end = new Date(item.endTime);
                            const now = new Date();
                            const diff = Math.floor((end - now) / 1000);
                            console.log("📅 endTime:", item.endTime, "diff:", diff);
                            if (!isNaN(diff) && diff > 0) {
                                secondsLeft = diff;
                            }
                        }

                        // Render item ONGOING lên sân khấu
                        renderMainStage(item, secondsLeft);
                        hasRunningItem = true;
                    }
                }
            }
        });
    }

    // Cập nhật số lượng
    const countElem = document.getElementById("item-count");
    if (countElem) countElem.innerText = allItems.length;

    // Nếu không còn cái nào đang chạy -> Xóa sân khấu
    if (!hasRunningItem) {
        clearStage();
    }
}

function renderQueueItem(item, container) {
    const div = document.createElement("div");
    div.className = "queue-item";

    let statusHtml = "";
    let actionHtml = "";

    // Trạng thái đang đấu
    if (item.status === 'ONGOING') {
        statusHtml = `<span class="q-status running">Đang đấu</span>`;
        actionHtml = `<span style="color:red; font-weight:bold"><i class="fa-solid fa-circle-play"></i> LIVE</span>`;
        div.style.backgroundColor = "#fff0f0"; // Highlight nhẹ
    }
    // Trạng thái chờ
    else if (item.status === 'WAIT') {
        statusHtml = `<span class="q-status waiting">Hàng chờ</span>`;
        // Nút Bắt đầu cho chủ phòng (Demo: Ai cũng thấy, server check quyền)
        actionHtml = `<button class="btn-start-now" onclick="startAuction(${item.id})">
                        <i class="fa-solid fa-play"></i> Bắt đầu
                      </button>`;
        // Chỉ hiện nút Xóa nếu mình là chủ sở hữu
        if (item.sellerId == currentUser.id) {
            actionHtml += `<button class="btn-delete" onclick="event.stopPropagation(); deleteItem(${item.id})" title="Xóa">
                            <i class="fa-solid fa-trash"></i>
                          </button>`;
        }
    }
    // Trạng thái kết thúc
    else {
        statusHtml = `<span class="q-status finished">${item.status}</span>`;
        actionHtml = `<span style="color:green; font-weight:800">${item.price.toLocaleString()} đ</span>`;
    }

    div.innerHTML = `
        <div class="q-name" title="${item.name}">${item.name}</div>
        ${statusHtml}
        <div class="q-time">${actionHtml}</div>
    `;
    container.appendChild(div);
}

// Re-render hàng đợi từ allItems local (không cần gọi server)
function rerenderQueue() {
    const queueContainer = document.getElementById("queue-list-container");
    if (!queueContainer) return;

    queueContainer.innerHTML = "";
    allItems.forEach(item => {
        renderQueueItem(item, queueContainer);
    });
}

// ============================================================
// 4. HIỂN THỊ SÂN KHẤU CHÍNH (MAIN STAGE)
// ============================================================

function renderMainStage(item, secondsLeft) {
    currentStageItemId = item.id;

    const stage = document.getElementById("auction-stage");
    if (!stage) return;

    // Lấy ảnh: ưu tiên localStorage, sau đó server, cuối cùng placeholder
    const itemNameKey = item.name.replace(/\s+/g, '_');
    const imageUrl = getItemImage(itemNameKey) || item.imageUrl || `https://via.placeholder.com/400x300.png?text=${encodeURIComponent(item.name)}`;

    stage.innerHTML = `
        <div class="product-image-area">
            <img src="${imageUrl}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/400x300.png?text=No+Image'">
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

    // Nếu có thời gian, chạy đồng hồ ngay
    if (secondsLeft !== null) {
        startCountdown(secondsLeft);
    }
}

function updateLiveAuctionUI(newPrice, userId, secondsLeft) {
    // 1. Cập nhật giá với animation
    const priceElem = document.getElementById("live-price");
    if (priceElem) {
        priceElem.innerText = newPrice.toLocaleString() + " VND";
        // Hiệu ứng pulse
        priceElem.style.transform = "scale(1.1)";
        priceElem.style.transition = "transform 0.3s";
        setTimeout(() => priceElem.style.transform = "scale(1)", 300);
    }

    // 2. Cập nhật placeholder
    const inp = document.getElementById("inp-bid-amount");
    if (inp) inp.placeholder = `Gợi ý: ${newPrice + 10000}`;

    // 3. Cập nhật lịch sử đặt giá
    addBidToHistory(userId, newPrice);

    // 4. Cập nhật danh sách người tham gia
    updateParticipantsList(userId, newPrice);

    // 5. Reset đồng hồ
    startCountdown(secondsLeft);
}

// Quick bid - đặt giá nhanh với số tiền cố định
function quickBid(itemId, amount) {
    const priceElem = document.getElementById("live-price");
    if (!priceElem) return;

    const currentPrice = parseInt(priceElem.innerText.replace(/[^\d]/g, '')) || 0;
    const newBid = currentPrice + amount;

    sendPacket({ type: "BID", itemId: itemId, amount: newBid });
    showToast(`💰 Đặt giá ${newBid.toLocaleString()}đ`, 'info', 2000);
}

// Lịch sử đặt giá
let bidHistory = [];

function addBidToHistory(userId, price) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN');

    bidHistory.unshift({
        userId: userId,
        price: price,
        time: timeStr
    });

    // Giữ tối đa 10 bids
    if (bidHistory.length > 10) bidHistory.pop();

    renderBidHistory();
}

function renderBidHistory() {
    const container = document.getElementById("bid-history-list");
    if (!container) return;

    if (bidHistory.length === 0) {
        container.innerHTML = '<div class="bid-history-empty">Chưa có lượt đặt giá</div>';
        return;
    }

    container.innerHTML = bidHistory.map((bid, index) => `
        <div class="bid-history-item ${index === 0 ? 'latest' : ''}">
            <span class="bid-user">${bid.userId == currentUser.id ? '🏆 Bạn' : 'User #' + bid.userId}</span>
            <span class="bid-price">${bid.price.toLocaleString()}đ</span>
            <span class="bid-time">${bid.time}</span>
        </div>
    `).join('');
}

// Confetti animation khi thắng đấu giá
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

    // Thêm người dẫn đầu lên đầu danh sách
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

    // Giới hạn 5 người
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

// ============================================================
// 5. LOGIC ĐỒNG HỒ ĐẾM NGƯỢC
// ============================================================

function startCountdown(seconds) {
    // Xóa timer cũ
    if (timerInterval) clearInterval(timerInterval);

    const timerElem = document.getElementById("timer-display");
    if (!timerElem) return;

    let timeLeft = seconds;

    const updateDisplay = () => {
        if (timeLeft < 0) timeLeft = 0;
        const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const sec = (timeLeft % 60).toString().padStart(2, '0');

        timerElem.innerHTML = `<i class="fa-regular fa-clock"></i> ${min}:${sec}`;

        // Cảnh báo màu đỏ nếu < 30s
        if (timeLeft <= 30) {
            timerElem.classList.add("warning");
        } else {
            timerElem.classList.remove("warning");
        }
    };

    updateDisplay(); // Chạy ngay lập tức

    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Hết giờ thì chờ Server gửi AUCTION_FINISHED
        }
    }, 1000);
}

// ============================================================
// 6. CÁC HÀNH ĐỘNG (ACTIONS)
// ============================================================

function startAuction(itemId) {
    // Cho phép chủ phòng nhập thời gian đấu giá (tính bằng giây)
    const durationStr = prompt("Nhập thời gian đấu giá (giây):", "120");

    if (durationStr === null) {
        // User cancelled
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

    // Convert thành số và loại bỏ ký tự không phải số
    const amount = parseInt(amountStr.replace(/[^\d]/g, ''), 10);

    if (isNaN(amount) || amount <= 0) {
        alert("Vui lòng nhập số tiền hợp lệ");
        return;
    }

    // Gửi amount dưới dạng số
    sendPacket({ type: "BID", itemId: itemId, amount: amount });
    inp.value = ""; // Xóa input
}

function backToLobby() {
    if (confirm("Rời khỏi phòng đấu giá?")) {
        sendPacket({ type: "LEAVE_ROOM" });
        window.location.href = "home.html";
    }
}

// --- MODAL ---
function openCreateItemModal() {
    const modal = document.getElementById("modal-create-item");
    if (modal) modal.style.display = "flex";
}
function closeModalItem() {
    const modal = document.getElementById("modal-create-item");
    if (modal) modal.style.display = "none";
    // Reset preview
    document.getElementById("image-preview").style.display = "none";
    document.getElementById("preview-img").src = "";
}

// Biến lưu base64 của ảnh đã chọn
let selectedImageBase64 = "";

// Preview ảnh khi chọn file
function previewImage(input) {
    const preview = document.getElementById("image-preview");
    const previewImg = document.getElementById("preview-img");

    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Giới hạn kích thước 2MB
        if (file.size > 2 * 1024 * 1024) {
            showToast("❌ Ảnh quá lớn! Tối đa 2MB", "error");
            input.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            selectedImageBase64 = e.target.result; // Data URL (base64)
            previewImg.src = selectedImageBase64;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = "none";
        selectedImageBase64 = "";
    }
}

function confirmCreateItem() {
    const name = document.getElementById("inp-item-name").value.trim();
    const price = document.getElementById("inp-item-price").value;
    const buyNowPrice = document.getElementById("inp-item-buynow").value || 0;

    if (!name) {
        showToast("⚠️ Vui lòng nhập tên sản phẩm!", "warning");
        return;
    }
    if (!price || parseInt(price) <= 0) {
        showToast("⚠️ Vui lòng nhập giá khởi điểm hợp lệ!", "warning");
        return;
    }

    // Lưu ảnh base64 vào localStorage (vì server chưa hỗ trợ lưu file lớn)
    const itemKey = name.replace(/\s+/g, '_');
    if (selectedImageBase64) {
        const itemImages = JSON.parse(localStorage.getItem("itemImages") || "{}");
        itemImages[itemKey] = selectedImageBase64;
        localStorage.setItem("itemImages", JSON.stringify(itemImages));
    }

    // Gửi lên server (không gửi base64 vì quá lớn)
    sendPacket({
        type: "CREATE_ITEM",
        name: itemKey,
        startPrice: parseInt(price),
        buyNowPrice: parseInt(buyNowPrice) || 0,
        imageUrl: '' // Server không lưu base64
    });

    // Clear form
    document.getElementById("inp-item-name").value = '';
    document.getElementById("inp-item-image").value = '';
    document.getElementById("inp-item-price").value = '';
    document.getElementById("inp-item-buynow").value = '';
    document.getElementById("image-preview").style.display = "none";
    selectedImageBase64 = "";
}

// Lấy ảnh từ localStorage
function getItemImage(itemName) {
    const itemImages = JSON.parse(localStorage.getItem("itemImages") || "{}");
    return itemImages[itemName] || `https://via.placeholder.com/400x300.png?text=${encodeURIComponent(itemName.replace(/_/g, ' '))}`;
}

// Xóa vật phẩm
function deleteItem(itemId) {
    if (confirm("Bạn có chắc muốn xóa vật phẩm này?")) {
        sendPacket({ type: "DELETE_ITEM", itemId: itemId });
    }
}