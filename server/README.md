# AuctionZone - Hệ Thống Đấu Giá Trực Tiếp

## 🏗️ Kiến Trúc

```
┌──────────────┐     WebSocket      ┌──────────────┐      TCP       ┌──────────────┐
│  Web Browser │ ◄──── (8080) ────► │ Gateway.js   │ ◄── (8081) ──► │  Server C    │
│  (HTML/JS)   │                    │  (Node.js)   │                │  (MySQL)     │
└──────────────┘                    └──────────────┘                └──────────────┘
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### Yêu Cầu Hệ Thống
- **Node.js** >= 14.x
- **GCC/MinGW** hoặc **TDM-GCC**
- **MySQL** >= 5.7

### Bước 1: Clone & Cài Dependencies

```bash
cd server
npm install
```

### Bước 2: Cấu Hình Database

1. Tạo database MySQL:
```sql
CREATE DATABASE auction_db;
```

2. Chạy script tạo bảng (xem phần Database Schema bên dưới)

3. Cấu hình file `src/db_config.h`:
```c
#define DB_HOST "localhost"
#define DB_USER "root"
#define DB_PASS "your_password"
#define DB_NAME "auction_db"
```

### Bước 3: Build Server C

```bash
cd server
gcc -o server.exe src/server.c src/db.c src/user.c src/room.c src/item.c src/auction.c -I./include libmysql.dll -lws2_32 -Wno-format-truncation
```

### Bước 4: Chạy Hệ Thống

**Cách 1: Chạy từng thành phần**
```bash
# Terminal 1: Chạy Server C (port 8081)
cd server
./server.exe

# Terminal 2: Chạy Gateway (port 8080)
cd server
node gateway.js
```

**Cách 2: Chạy tất cả (Windows)**
```bash
cd server
start start_all.bat
```

### Bước 5: Mở Web

Mở file `web/index.html` trong trình duyệt hoặc dùng Live Server.

---

## 📋 Protocol Commands

| Lệnh | Format | Mô tả |
|------|--------|-------|
| `REGISTER` | `REGISTER username password` | Đăng ký tài khoản |
| `LOGIN` | `LOGIN username password` | Đăng nhập |
| `MY_STATS` | `MY_STATS` | Xem thống kê cá nhân |
| `LIST_ROOMS` | `LIST_ROOMS` | Danh sách phòng |
| `CREATE_ROOM` | `CREATE_ROOM name` | Tạo phòng mới |
| `JOIN_ROOM` | `JOIN_ROOM room_id` | Vào phòng |
| `LEAVE_ROOM` | `LEAVE_ROOM` | Rời phòng |
| `CREATE_ITEM` | `CREATE_ITEM name startPrice buyNowPrice [imageUrl]` | Đăng bán |
| `LIST_ITEMS` | `LIST_ITEMS [room_id]` | Danh sách vật phẩm |
| `START_AUCTION` | `START_AUCTION item_id [duration]` | Bắt đầu đấu giá |
| `BID` | `BID item_id amount` | Đặt giá (≥ giá hiện tại + 10.000đ) |
| `BUY_NOW` | `BUY_NOW item_id` | Mua ngay |

---

## 📁 Cấu Trúc Thư Mục

```
auction-live/
├── server/
│   ├── gateway.js          # WebSocket Gateway (Node.js)
│   ├── server.exe          # Server C (đã build)
│   ├── start_all.bat       # Script chạy tất cả
│   ├── src/                # Mã nguồn C
│   │   ├── server.c        # Main server & command handlers
│   │   ├── db.c/h          # Database connection
│   │   ├── user.c/h        # User management & stats
│   │   ├── room.c/h        # Room management
│   │   ├── item.c/h        # Item management
│   │   └── auction.c/h     # Auction logic (bid, buy now)
│   ├── include/            # MySQL headers
│   ├── lib/                # MySQL libraries
│   └── libmysql.dll        # MySQL runtime DLL
│
└── web/
    ├── index.html          # Trang đăng nhập
    ├── register.html       # Trang đăng ký
    ├── home.html           # Trang chủ (phòng + thống kê)
    ├── room.html           # Phòng đấu giá
    ├── js/
    │   ├── ws.js           # WebSocket connection
    │   ├── home.js         # Logic trang chủ
    │   └── room.js         # Logic phòng đấu giá
    └── css/
        ├── home.css        # Styles trang chủ
        └── room.css        # Styles phòng đấu giá
```

---

## 🗄️ Database Schema

```sql
CREATE DATABASE auction_db;
USE auction_db;

-- Bảng users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng rooms
CREATE TABLE rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner_id INT NOT NULL,
    status INT DEFAULT 1,  -- 1=OPEN, 0=CLOSED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng items
CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    seller_id INT NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    start_price BIGINT NOT NULL,
    buy_now_price BIGINT,
    auction_start DATETIME,
    auction_end DATETIME,
    queue_order INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'WAIT',  -- WAIT, ONGOING, SOLD, EXPIRED
    winner_id INT,
    final_price BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng room_members
CREATE TABLE room_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    is_owner TINYINT DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME
);

-- Bảng activity_log
CREATE TABLE activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(50),
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## ✨ Tính Năng

### Đấu Giá
- ⏱️ Đồng hồ đếm ngược real-time
- 🔄 Auto reset 30s khi có bid trong 30s cuối
- 💰 Bước giá tối thiểu: 10.000đ
- 🛒 Mua ngay (Buy Now)
- 🎯 Quick Bid buttons (+10K, +50K, +100K, +500K)

### Giao Diện
- 🎨 Dark theme với Glassmorphism
- 📱 Responsive 3-column layout
- 🔔 Toast notifications
- 🎉 Confetti animation khi thắng
- 📊 Bid history panel

### Tương Tác
- 💬 Chat real-time trong phòng
- 📈 Thống kê cá nhân (phiên tham gia, thắng, tiền chi/thu)
- 🖼️ Upload ảnh vật phẩm

---

## 🔧 Khắc Phục Lỗi

### Lỗi "Permission denied" khi build
→ Tắt server.exe đang chạy trước khi build

### Lỗi "Cannot connect to MySQL"
→ Kiểm tra MySQL service và cấu hình `db_config.h`

### Lỗi "WebSocket connection failed"
→ Đảm bảo gateway.js đang chạy ở port 8080