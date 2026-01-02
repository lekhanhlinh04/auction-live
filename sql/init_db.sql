-- Tạo database
CREATE DATABASE IF NOT EXISTS auction_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE auction_db;

-- Bảng users: tài khoản người dùng
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NULL
) ENGINE=InnoDB;

-- Bảng rooms: phòng đấu giá
CREATE TABLE rooms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  owner_id INT UNSIGNED NOT NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,  -- 1 = OPEN, 0 = CLOSED
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
DESCRIBE rooms;
ALTER TABLE rooms
  ADD CONSTRAINT fk_rooms_owner
  FOREIGN KEY (owner_id) REFERENCES users(id);

-- Bảng room_members: người tham gia phòng
CREATE TABLE room_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  is_owner TINYINT(1) NOT NULL DEFAULT 0, -- 1 nếu là chủ phòng
  joined_at DATETIME NOT NULL,
  left_at DATETIME NULL
) ENGINE=InnoDB;

ALTER TABLE room_members
  ADD CONSTRAINT fk_rm_room
    FOREIGN KEY (room_id) REFERENCES rooms(id),
  ADD CONSTRAINT fk_rm_user
    FOREIGN KEY (user_id) REFERENCES users(id);

-- Index hỗ trợ kiểm tra user đang ở phòng nào (left_at IS NULL)
CREATE INDEX idx_room_members_user_open
  ON room_members(user_id, left_at);

-- Bảng items: vật phẩm đấu giá
CREATE TABLE items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id INT UNSIGNED NOT NULL,
  seller_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  start_price BIGINT NOT NULL,
  buy_now_price BIGINT NULL,
  auction_start DATETIME NULL, -- thời gian bắt đầu đấu giá
  auction_end DATETIME NULL,   -- thời gian kết thúc hiện tại (dùng cho 30 giây cuối + reset)
  queue_order INT NOT NULL,    -- thứ tự trong hàng đợi của phòng
  status ENUM('WAIT','ONGOING','SOLD','CANCELLED') NOT NULL DEFAULT 'WAIT',
  winner_id INT UNSIGNED NULL,   -- người thắng (nếu có)
  final_price BIGINT NULL,       -- giá bán cuối cùng (nếu có)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE items
  ADD CONSTRAINT fk_items_room
    FOREIGN KEY (room_id) REFERENCES rooms(id),
  ADD CONSTRAINT fk_items_seller
    FOREIGN KEY (seller_id) REFERENCES users(id),
  ADD CONSTRAINT fk_items_winner
    FOREIGN KEY (winner_id) REFERENCES users(id);

-- Index hỗ trợ:
-- Lấy danh sách item theo phòng + trạng thái + thứ tự hàng đợi
CREATE INDEX idx_items_room_queue
  ON items(room_id, status, queue_order);

-- (Tuỳ chọn) Index hỗ trợ tìm kiếm theo tên + thời gian
CREATE INDEX idx_items_search_time
  ON items(name, auction_start, auction_end);

-- Bảng bids: các lần trả giá
CREATE TABLE bids (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  amount BIGINT NOT NULL,
  bid_time DATETIME NOT NULL
) ENGINE=InnoDB;

ALTER TABLE bids
  ADD CONSTRAINT fk_bids_item
    FOREIGN KEY (item_id) REFERENCES items(id),
  ADD CONSTRAINT fk_bids_user
    FOREIGN KEY (user_id) REFERENCES users(id);

-- Index hỗ trợ lấy bid mới nhất của 1 item
CREATE INDEX idx_bids_item_time
  ON bids(item_id, bid_time);

-- Bảng activity_logs: ghi log hoạt động
CREATE TABLE activity_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(50) NOT NULL,  -- LOGIN, CREATE_ROOM, BID, BUY_NOW, ...
  details TEXT NULL,            -- nội dung chi tiết (có thể dạng JSON text)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE activity_logs
  ADD CONSTRAINT fk_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id);

-- Thêm dữ liệu mẫu
INSERT INTO users (username, password_hash, full_name) VALUES
('admin', 'admin123', 'Administrator'),
('user1', 'pass1', 'User One'),
('user2', 'pass2', 'User Two'),
('seller1', 'sell1', 'Seller One');

INSERT INTO rooms (name, owner_id, status) VALUES
('General Auction Room', 1, 1),
('Tech Gadgets Room', 4, 1);

INSERT INTO room_members (room_id, user_id, is_owner, joined_at) VALUES
(1, 1, 1, NOW()),
(1, 2, 0, NOW()),
(2, 4, 1, NOW());

INSERT INTO items (room_id, seller_id, name, description, start_price, buy_now_price, queue_order, status) VALUES
(1, 1, 'Vintage Watch', 'A beautiful vintage watch', 100000, 500000, 1, 'WAIT'),
(1, 2, 'Laptop', 'Gaming laptop', 2000000, 3000000, 2, 'WAIT'),
(2, 4, 'Smartphone', 'Latest smartphone', 500000, 1000000, 1, 'WAIT');

INSERT INTO activity_logs (user_id, action, details) VALUES
(1, 'LOGIN', 'User logged in'),
(2, 'CREATE_ROOM', 'Created room General Auction Room');