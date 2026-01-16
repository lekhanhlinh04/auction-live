function register() {
    const u = document.getElementById("reg-username").value.trim();
    const p = document.getElementById("reg-password").value.trim();
    const c = document.getElementById("reg-confirm").value.trim();
    const err = document.getElementById("register-error");

    if (!u || !p || !c) {
        err.innerText = "Vui lòng nhập đầy đủ thông tin";
        return;
    }

    if (p !== c) {
        err.innerText = "Mật khẩu nhập lại không khớp";
        return;
    }

    err.innerText = "";

    sendPacket({
        type: "REGISTER",
        username: u,
        password: p
    });
}

function goLogin() {
    window.location.href = "index.html";
}

window.onServerMessage = function(msg) {
    console.log("Server Register response:", msg);

    if (msg.startsWith("OK REGISTER")) {
        alert("Đăng ký thành công! Mời bạn đăng nhập.");
        window.location.href = "index.html";
    }

    else if (msg.startsWith("FAIL") || msg.includes("ERROR")) {

        const errorMsg = msg.replace("FAIL REGISTER", "").trim(); 
        document.getElementById("register-error").innerText = errorMsg || "Đăng ký thất bại";
    }
    else {

        document.getElementById("register-error").innerText = "Lỗi hệ thống: " + msg;
    }
};