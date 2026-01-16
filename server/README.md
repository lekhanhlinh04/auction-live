# Hướng Dẫn Cài Đặt & Chạy Server AuctionZone

Tài liệu này hướng dẫn cách cấu hình database, build và chạy server đấu giá.

## 1. Yêu Cầu Hệ Thống

*   **OS**: Windows
*   **Database**: MySQL (đã cài đặt và đang chạy)
*   **Runtime**: Node.js (cho Gateway), GCC (cho Server C)

## 2. Cấu Hình Database

Thông tin kết nối database được lưu trong file mã nguồn C. Nếu bạn muốn thay đổi user/password, bạn cần sửa file và build lại server.

### Bước 1: Sửa thông tin kết nối
Mở file `src/db_config.h` bằng Text Editor (Notepad, VS Code...) và sửa các dòng sau:

```c
#define DB_HOST "localhost"
#define DB_USER "root"         // Tên đăng nhập MySQL của bạn
#define DB_PASS "Hantieu0301"  // Mật khẩu MySQL của bạn
#define DB_NAME "auction_db"   // Tên database
```

### Bước 2: Tạo dữ liệu (Lần đầu hoặc khi muốn reset)
Nếu bạn chưa có database hoặc muốn xóa trắng dữ liệu để test lại từ đầu:

1.  Đảm bảo MySQL service đang chạy.
2.  Chạy file `reset_db.bat`.
    *   Script này sẽ xóa sạch các bảng cũ (bids, rooms, items...) nhưng GIỮ LẠI tài khoản user.
    *   Nếu muốn tạo mới hoàn toàn cả database, bạn cần vào MySQL Workbench hoặc command line để `CREATE DATABASE auction_db;` trước.

## 3. Build Server (Quan Trọng)

**Lưu ý:** Bất cứ khi nào bạn sửa file trong thư mục `src/` (bao gồm cả `db_config.h`), bạn **PHẢI** build lại server.

1.  Chạy file `build.bat`.
2.  Nếu thành công, nó sẽ báo "Build successful!" và tạo ra file `server.exe`.
3.  Nếu lỗi, kiểm tra lại xem GCC đã cài chưa hoặc `server.exe` có đang chạy ẩn không (nếu đang chạy thì không ghi đè được).

## 4. Cách Chạy Server

Có 2 cách để chạy hệ thống.

### Cách 1: Chạy tự động (Khuyên dùng)
Chạy file `start_all.bat`.
*   Script này sẽ tự động mở 2 cửa sổ cmd:
    1.  **Server C**: Xử lý logic đấu giá, kết nối MySQL (Port 8081).
    2.  **Gateway**: WebSocket server để browser kết nối (Port 8080).

### Cách 2: Chạy thủ công
Nếu `start_all.bat` bị lỗi hoặc bạn muốn xem log chi tiết từng cái:

1.  **Chạy Gateway**:
    *   Mở CMD tại thư mục `server`.
    *   Gõ: `node gateway.js`
2.  **Chạy Server C**:
    *   Mở một cửa sổ CMD khác cũng tại thư mục `server`.
    *   Gõ: `server.exe`

## Kiểm Tra Hoạt Động
Sau khi chạy, mở trình duyệt vào file `web/index.html` để bắt đầu sử dụng.