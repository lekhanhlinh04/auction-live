

function openProfileModal() {
    const modal = document.getElementById("modal-profile");
    if (!modal) return;

    if (currentUser) {

        const elUsername = document.getElementById("profile-username");
        const elId = document.getElementById("profile-id");
        const elAvatar = document.getElementById("profile-avatar-img");

        if (elUsername) elUsername.innerText = currentUser.username;
        if (elId) elId.innerText = "#" + currentUser.id;
        if (elAvatar) elAvatar.src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=random&size=128`;

        const joined = document.getElementById("stat-joined")?.innerText || "0";
        const won = document.getElementById("stat-won")?.innerText || "0";

        const elPJoined = document.getElementById("p-stat-joined");
        const elPWon = document.getElementById("p-stat-won");

        if (elPJoined) elPJoined.innerText = joined;
        if (elPWon) elPWon.innerText = won;
    }

    modal.style.display = "flex";
    switchProfileTab('info');
}

function closeProfileModal() {
    const modal = document.getElementById("modal-profile");
    if (modal) modal.style.display = "none";

    const elOld = document.getElementById("old-pass");
    const elNew = document.getElementById("new-pass");
    const elConfirm = document.getElementById("confirm-pass");

    if (elOld) elOld.value = "";
    if (elNew) elNew.value = "";
    if (elConfirm) elConfirm.value = "";
}

function switchProfileTab(tabName) {
    const tabs = document.querySelectorAll(".p-tab");
    const contents = document.querySelectorAll(".p-tab-content");

    tabs.forEach(t => t.classList.remove("active"));
    contents.forEach(c => c.style.display = "none");

    if (tabName === 'info') {
        if (tabs[0]) tabs[0].classList.add("active");
        const tabInfo = document.getElementById("p-tab-info");
        if (tabInfo) tabInfo.style.display = "block";
    } else {
        if (tabs[1]) tabs[1].classList.add("active");
        const tabPass = document.getElementById("p-tab-password");
        if (tabPass) tabPass.style.display = "block";
    }
}

function changePassword() {
    const oldPass = document.getElementById("old-pass").value;
    const newPass = document.getElementById("new-pass").value;
    const confirmPass = document.getElementById("confirm-pass").value;

    if (!oldPass || !newPass || !confirmPass) {
        alert("Vui lòng điền đầy đủ thông tin!");
        return;
    }

    if (newPass !== confirmPass) {
        alert("Mật khẩu mới không trùng khớp!");
        return;
    }

    if (newPass.length < 6) {
        alert("Mật khẩu mới phải có ít nhất 6 ký tự!");
        return;
    }

    if (window.sendPacket) {
        sendPacket({
            type: "CHANGE_PASS",
            oldPass: oldPass,
            newPass: newPass
        });
    } else {
        console.error("sendPacket not defined");
    }
}
