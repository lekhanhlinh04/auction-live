// Gửi yêu cầu đăng nhập
function login() {
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value.trim();
    const err = document.getElementById("login-error");

    if (!u || !p) {
        err.innerText = "Vui lòng nhập đầy đủ username và mật khẩu";
        return;
    }

    err.innerText = "";

    // Gửi JSON sang Gateway
    sendPacket({
        type: "LOGIN",
        username: u,
        password: p
    });
}

// Chuyển trang khi bấm nút Đăng ký
function goRegister() {
    window.location.href = "register.html";
}

// Xử lý phản hồi từ Server (được gọi từ ws.js)
window.onServerMessage = function(msg) {
    console.log("Server Login response:", msg);

    // Server C trả về: "OK LOGIN <id>" (Ví dụ: OK LOGIN 2)
    // Sửa lại điều kiện để khớp với log thực tế
    if (msg.startsWith("OK LOGIN")) {
        // Cắt chuỗi bằng khoảng trắng (space) thay vì dấu gạch đứng (|)
        const parts = msg.split(" "); 
        // parts[0] = "OK", parts[1] = "LOGIN", parts[2] = "2" (ID)
        
        const userId = parts[2];
        
        // Vì server C chỉ trả về ID, ta lấy username từ ô input để lưu
        const usernameInput = document.getElementById("login-username").value;
        const passwordInput = document.getElementById("login-password").value;

        // Lưu vào localStorage để dùng ở trang Home
        localStorage.setItem("user", JSON.stringify({ 
            id: userId, 
            username: usernameInput 
        }));
        
        // Lưu password tạm thời trong sessionStorage để auto-login khi reconnect
        // (sessionStorage sẽ tự xóa khi đóng tab, an toàn hơn localStorage)
        sessionStorage.setItem("loginPassword", passwordInput);
        
        alert("Đăng nhập thành công!");
        window.location.href = "home.html"; // Chuyển vào trang chủ
    }

    // Server C trả về lỗi (Ví dụ: FAIL LOGIN hoặc sai pass)
    else if (msg.startsWith("FAIL") || msg.includes("ERROR")) {
        // Hiển thị thông báo lỗi
        document.getElementById("login-error").innerText = "Đăng nhập thất bại. Kiểm tra lại tài khoản/mật khẩu.";
    }
    else {
        document.getElementById("login-error").innerText = "Phản hồi lạ từ server: " + msg;
    }
};