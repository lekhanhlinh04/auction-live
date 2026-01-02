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

    // Gửi JSON sang Gateway
    // Hàm sendPacket() được định nghĩa bên file ws.js
    sendPacket({
        type: "REGISTER",
        username: u,
        password: p
    });
}

function goLogin() {
    window.location.href = "index.html";
}

// Xử lý phản hồi từ Server
window.onServerMessage = function(msg) {
    console.log("Server Register response:", msg);

    // Server C trả về: "OK REGISTER <id>" (Ví dụ: OK REGISTER 5)
    // Sửa lại điều kiện để khớp với log thực tế
    if (msg.startsWith("OK REGISTER")) {
        alert("Đăng ký thành công! Mời bạn đăng nhập.");
        window.location.href = "index.html";
    }
    // Trường hợp lỗi (Ví dụ: FAIL REGISTER ...)
    else if (msg.startsWith("FAIL") || msg.includes("ERROR")) {
        // Nếu server trả về "FAIL REGISTER Username exist"
        // Ta có thể lấy phần lỗi để hiển thị
        const errorMsg = msg.replace("FAIL REGISTER", "").trim(); 
        document.getElementById("register-error").innerText = errorMsg || "Đăng ký thất bại";
    }
    else {
        // Các lỗi không xác định khác
        document.getElementById("register-error").innerText = "Lỗi hệ thống: " + msg;
    }
};