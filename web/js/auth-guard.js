(function () {
  const user = localStorage.getItem("user");

  if (!user) {
    alert("Vui lòng đăng nhập trước");
    window.location.href = "index.html";
  }
})();
