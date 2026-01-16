
function login() {
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value.trim();
    const err = document.getElementById("login-error");

    if (!u || !p) {
        err.innerText = "Vui lòng nhập đầy đủ username và mật khẩu";
        return;
    }

    err.innerText = "";

    sendPacket({
        type: "LOGIN",
        username: u,
        password: p
    });
}

function goRegister() {
    window.location.href = "register.html";
}

window.onServerMessage = function(msg) {
    console.log("Server Login response:", msg);

    if (msg.startsWith("OK LOGIN")) {

        const parts = msg.split(" "); 

        
        const userId = parts[2];

        const usernameInput = document.getElementById("login-username").value;
        const passwordInput = document.getElementById("login-password").value;

        localStorage.setItem("user", JSON.stringify({ 
            id: userId, 
            username: usernameInput 
        }));

        sessionStorage.setItem("loginPassword", passwordInput);
        
        alert("Đăng nhập thành công!");
        window.location.href = "home.html"; 
    }

    else if (msg.startsWith("FAIL") || msg.includes("ERROR")) {

        document.getElementById("login-error").innerText = "Đăng nhập thất bại. Kiểm tra lại tài khoản/mật khẩu.";
    }
    else {
        document.getElementById("login-error").innerText = "Phản hồi lạ từ server: " + msg;
    }
};