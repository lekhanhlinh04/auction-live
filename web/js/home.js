
const userJson = localStorage.getItem("user");
if (!userJson) {
    alert("Bạn chưa đăng nhập!");
    window.location.href = "index.html";
}
const currentUser = JSON.parse(userJson);

const userNameElem = document.getElementById("user-name");
const userAvatarElem = document.getElementById("user-avatar");

if (userNameElem) userNameElem.innerText = currentUser.username || "User " + currentUser.id;
if (userAvatarElem) userAvatarElem.src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`;

function loadRoomList() {
    console.log("Đang tải danh sách phòng...");
    sendPacket({ type: "LIST_ROOMS" });
}

function loadItemList() {
    console.log("Đang tải danh sách vật phẩm...");

    sendPacket({ type: "LIST_ITEMS", roomId: 0 });
}

function loadStats() {
    console.log("Đang tải thống kê...");
    sendPacket({ type: "MY_STATS" });
}

window.onServerMessage = function (msg) {
    console.log("Server trả về:", msg);

    if (msg.startsWith("OK LOGIN")) {
        console.log("✅ Login thành công, bắt đầu load dữ liệu...");
        loadRoomList();
        loadItemList();
        return;
    }

    if (msg.startsWith("ROOM") || msg.startsWith("NO_ROOMS")) {
        renderRooms(msg);
    }

    else if (msg.startsWith("SEARCH_RESULT") || (msg.includes("ITEM") && document.getElementById("tab-search").style.display !== "none")) {

        const tabSearch = document.getElementById("tab-search");
        if (tabSearch && tabSearch.style.display !== "none") {
            renderSearchResults(msg);
        } else if (msg.startsWith("ITEM") || msg.startsWith("NO_ITEMS")) {
            renderItems(msg);
        }
    }
    else if (msg.startsWith("ITEM") || msg.startsWith("NO_ITEMS")) {
        renderItems(msg);
    }

    else if (msg.startsWith("STATS") || msg.startsWith("WON")) {
        renderStats(msg);
    }

    else if (msg.startsWith("OK CHANGE_PASS")) {
        alert("Đổi mật khẩu thành công!");
        closeProfileModal();
    }
    else if (msg.startsWith("ERROR CHANGE_PASS")) {
        const err = msg.substring("ERROR CHANGE_PASS".length).trim();
        alert("Lỗi đổi mật khẩu: " + err);
    }

    else if (msg.startsWith("OK CREATE_ROOM")) {
        alert("Tạo phòng thành công!");
        loadRoomList(); 
    }

    else if (msg.startsWith("OK JOIN_ROOM")) {
        const roomId = msg.split(" ")[2];

        window.location.href = `room.html?id=${roomId}`;
    }
    else if (msg.startsWith("ERROR")) {
        alert("Lỗi: " + msg);
    }
};

function renderRooms(textData) {
    const tbody = document.getElementById("room-list");
    if (!tbody) return;

    tbody.innerHTML = ""; 

    if (textData.trim() === "NO_ROOMS") {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Chưa có phòng nào.</td></tr>";
        return;
    }

    const lines = textData.split("\n");

    lines.forEach(line => {
        line = line.trim();
        if (!line.startsWith("ROOM")) return;

        const parts = line.split(" ");

        if (parts.length >= 6) {
            const id = parts[1];
            const name = parts[2].replace(/_/g, ' ');
            const ownerId = parts[3];
            const ownerName = parts[4].replace(/_/g, ' ');
            const status = parts[5]; 

            const tr = document.createElement("tr");

            let statusHtml = (status == '1')
                ? '<span class="status-open">Đang mở</span>'
                : '<span class="status-closed">Đã đóng</span>';

            let actionBtn = "";
            if (currentUser.id == ownerId) {

                actionBtn = `<button class="btn-primary" style="background:#e67e22" onclick="joinRoom(${id})">Quản lý</button>`;
            } else if (status == '1') {
                actionBtn = `<button class="btn-primary" onclick="joinRoom(${id})">Tham gia</button>`;
            } else {
                actionBtn = `<button disabled style="opacity:0.5; cursor:not-allowed">Đã khoá</button>`;
            }

            tr.innerHTML = `
                <td>#${id}</td>
                <td><strong>${name}</strong></td>
                <td>${ownerName}</td>
                <td>${statusHtml}</td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function renderItems(textData) {
    const container = document.getElementById("item-list");
    if (!container) return;

    container.innerHTML = "";

    if (textData.trim() === "NO_ITEMS") {
        container.innerHTML = "<p style='text-align:center; width:100%'>Chưa có vật phẩm nào.</p>";
        return;
    }

    const lines = textData.split("\n");

    lines.forEach(line => {
        line = line.trim();
        if (!line.startsWith("ITEM")) return;

        const parts = line.split(" ");

        if (parts.length >= 9) {
            const id = parts[1];
            const roomId = parts[2];
            const name = parts[5]; 
            const price = parseInt(parts[6]).toLocaleString(); 
            const status = parts[8]; 

            let actionBtn = "";
            if (status === 'RUN') {
                actionBtn = `<button class="btn-bid" onclick="joinRoom(${roomId})">Vào phòng đấu</button>`;
            } else if (status === 'WAIT') {
                actionBtn = `<button class="btn-wait" disabled>Chưa bắt đầu</button>`;
            } else {
                actionBtn = `<button class="btn-wait" disabled>Đã kết thúc</button>`;
            }

            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="card-img">
                    <i class="fa-solid fa-gavel"></i>
                </div>
                <div class="card-body">
                    <div class="card-title">${name}</div>
                    <div class="card-info">Phòng #${roomId} • ${status}</div>
                    <div class="card-price">${price} VNĐ</div>
                    ${actionBtn}
                </div>
            `;
            container.appendChild(card);
        }
    });
}

function switchTab(tab) {
    const tabs = document.querySelectorAll(".tab-item");
    const tabRooms = document.getElementById("tab-rooms");
    const tabItems = document.getElementById("tab-items");
    const tabStats = document.getElementById("tab-stats");

    tabs.forEach(t => t.classList.remove("active"));
    if (tabRooms) tabRooms.style.display = "none";
    if (tabItems) tabItems.style.display = "none";
    if (tabStats) tabStats.style.display = "none";

    const tabSearch = document.getElementById("tab-search");
    if (tabSearch) tabSearch.style.display = "none";

    if (tab === 'rooms') {
        if (tabRooms) tabRooms.style.display = "block";
        if (tabs[0]) tabs[0].classList.add("active");
        loadRoomList();
    } else if (tab === 'items') {
        if (tabItems) tabItems.style.display = "block";
        if (tabs[1]) tabs[1].classList.add("active");
        loadItemList();
    } else if (tab === 'search') {
        if (tabSearch) tabSearch.style.display = "block";
        if (tabs[2]) tabs[2].classList.add("active");
    } else if (tab === 'stats') {
        if (tabStats) tabStats.style.display = "block";
        if (tabs[3]) tabs[3].classList.add("active");
        loadStats();
    }
}

function handleSearchKeyPress(event) {
    if (event.key === "Enter") {
        performSearch();
    }
}

function performSearch() {
    const input = document.getElementById("search-input");
    if (input && input.value.trim()) {
        switchTab('search');
        document.getElementById("search-keyword").value = input.value.trim();
        searchByKeyword();
    }
}

function searchByKeyword() {
    const keyword = document.getElementById("search-keyword").value.trim();
    if (!keyword) {
        alert("Vui lòng nhập từ khóa tìm kiếm!");
        return;
    }
    console.log("Tìm kiếm:", keyword);
    sendPacket({ type: "SEARCH_ITEMS", keyword: keyword });
}

function searchByTime() {
    const from = document.getElementById("search-from").value;
    const to = document.getElementById("search-to").value;

    if (!from || !to) {
        alert("Vui lòng chọn khung giờ bắt đầu và kết thúc!");
        return;
    }

    const fromStr = from.replace("T", " ") + ":00";
    const toStr = to.replace("T", " ") + ":00";

    console.log("Tìm kiếm từ", fromStr, "đến", toStr);
    sendPacket({ type: "SEARCH_ITEMS_TIME", from: fromStr, to: toStr });
}

function renderSearchResults(textData) {
    const tbody = document.getElementById("search-results-list");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (textData.trim() === "NO_ITEMS" || !textData.trim()) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#888'>Không tìm thấy kết quả</td></tr>";
        return;
    }

    const lines = textData.split("\n");
    let found = false;

    lines.forEach(line => {
        line = line.trim();
        if (!line.startsWith("ITEM")) return;

        found = true;

        const parts = line.split(" ");
        if (parts.length >= 9) {
            const id = parts[1];
            const roomId = parts[2];
            const name = parts[5].replace(/_/g, ' ');
            const price = parseInt(parts[6]).toLocaleString();
            const status = parts[8];

            let statusHtml = '';
            if (status === 'ONGOING') {
                statusHtml = '<span class="status-open">Đang đấu</span>';
            } else if (status === 'WAIT') {
                statusHtml = '<span style="color:#f39c12; font-weight:bold">Chờ</span>';
            } else {
                statusHtml = '<span class="status-closed">' + status + '</span>';
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${name}</strong></td>
                <td>Phòng #${roomId}</td>
                <td>${price} đ</td>
                <td>${statusHtml}</td>
                <td><button class="btn-primary" onclick="joinRoom(${roomId})">Vào phòng</button></td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (!found) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#888'>Không tìm thấy kết quả</td></tr>";
    }
}

function renderStats(textData) {
    const lines = textData.split("\n");

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.startsWith("STATS ")) {
            const parts = line.split(" ");
            if (parts.length >= 6) {
                const joined = parts[1];
                const won = parts[2];
                const spent = parseInt(parts[3]).toLocaleString();
                const sold = parts[4];
                const earned = parseInt(parts[5]).toLocaleString();

                const elJoined = document.getElementById("stat-joined");
                const elWon = document.getElementById("stat-won");
                const elSpent = document.getElementById("stat-spent");
                const elSold = document.getElementById("stat-sold");
                const elEarned = document.getElementById("stat-earned");

                if (elJoined) elJoined.innerText = joined;
                if (elWon) elWon.innerText = won;
                if (elSpent) elSpent.innerText = spent + " đ";
                if (elSold) elSold.innerText = sold;
                if (elEarned) elEarned.innerText = earned + " đ";
            }
        }

        else if (line.startsWith("WON ")) {
            const parts = line.split(" ");
            if (parts.length >= 4) {
                const itemId = parts[1];
                const name = parts[2].replace(/_/g, ' ');
                const price = parseInt(parts[3]).toLocaleString();
                const date = parts.slice(4).join(" ") || "";

                const tbody = document.getElementById("won-items-list");
                if (tbody) {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>#${itemId}</td>
                        <td>${name}</td>
                        <td>${price} đ</td>
                        <td>${date}</td>
                    `;
                    tbody.appendChild(tr);
                }
            }
        }
    });
}

function logout() {
    localStorage.removeItem("user");
    sessionStorage.removeItem("loginPassword"); 
    window.location.href = "index.html";
}

function requestCreateRoom() {
    const modal = document.getElementById("modal-create-room");
    if (modal) {
        modal.style.display = "flex";
        document.getElementById("inp-room-name").focus();
    }
}

function closeModal() {
    const modal = document.getElementById("modal-create-room");
    if (modal) {
        modal.style.display = "none";
        document.getElementById("inp-room-name").value = "";
        document.getElementById("inp-room-desc").value = "";
    }
}

function confirmCreateRoom() {
    const name = document.getElementById("inp-room-name").value.trim();
    if (!name) {
        alert("Vui lòng nhập tên phòng!");
        return;
    }

    sendPacket({ type: "CREATE_ROOM", roomName: name.replace(/\s+/g, '_') });
    closeModal();
}

function joinRoom(id) {

    const roomId = parseInt(id, 10);
    if (isNaN(roomId) || roomId <= 0) {
        alert("ID phòng không hợp lệ!");
        return;
    }
    console.log("Gửi yêu cầu tham gia phòng:", roomId);
    sendPacket({ type: "JOIN_ROOM", roomId: roomId });
}