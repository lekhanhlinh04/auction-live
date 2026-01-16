# 📚 Câu Hỏi Vấn Đáp - Môn Lập Trình Mạng Máy Tính
## Đồ Án: Hệ Thống Đấu Giá Trực Tuyến (AuctionZone)

---

# PHẦN I: CÂU HỎI LÝ THUYẾT

## 1. Mô Hình OSI và TCP/IP

### **Câu 1: Mô hình OSI có bao nhiêu tầng? Đồ án này hoạt động ở những tầng nào?**

**Trả lời:**
Mô hình OSI có **7 tầng**:
1. Physical (Vật lý)
2. Data Link (Liên kết dữ liệu)
3. Network (Mạng)
4. Transport (Vận chuyển)
5. Session (Phiên)
6. Presentation (Trình diễn)
7. Application (Ứng dụng)

**Đồ án hoạt động ở:**
- **Tầng 7 (Application)**: HTTP, WebSocket, custom protocol
- **Tầng 4 (Transport)**: TCP (reliable, connection-oriented)
- **Tầng 3 (Network)**: IP (định tuyến packet)

---

### **Câu 2: TCP và UDP khác nhau như thế nào? Tại sao đồ án chọn TCP?**

**Trả lời:**

| Tiêu chí | TCP | UDP |
|----------|-----|-----|
| Kết nối | Connection-oriented | Connectionless |
| Độ tin cậy | Reliable (ACK, retransmit) | Unreliable |
| Thứ tự gói tin | Đảm bảo thứ tự | Không đảm bảo |
| Flow control | Có | Không |
| Overhead | Cao hơn | Thấp |
| Use case | Web, email, file transfer | Streaming, gaming, DNS |

**Lý do chọn TCP:**
- Đấu giá cần **độ tin cậy tuyệt đối**: lệnh BID không được mất
- Cần **đảm bảo thứ tự**: bid phải đến đúng thứ tự thời gian
- Latency nhỏ không quan trọng bằng data integrity

---

### **Câu 3: Giải thích cơ chế 3-way handshake của TCP?**

**Trả lời:**
```
Client                    Server
   |                         |
   |-------- SYN --------→   |  (1) Client gửi SYN, seq=x
   |                         |
   |←----- SYN+ACK ------    |  (2) Server gửi SYN+ACK, seq=y, ack=x+1
   |                         |
   |-------- ACK --------→   |  (3) Client gửi ACK, ack=y+1
   |                         |
   |    Connection Established    |
```

Khi client connect đến server qua `socket()` và `connect()`, TCP tự động thực hiện 3-way handshake.

---

### **Câu 4: Port là gì? Tại sao cần port? Các port trong đồ án là gì?**

**Trả lời:**
- **Port** là số 16-bit (0-65535) dùng để **định danh tiến trình/service** trên một host
- **Tại sao cần**: Một IP có thể chạy nhiều service, port giúp phân biệt

**Các port trong đồ án:**
| Port | Service | Mô tả |
|------|---------|-------|
| 8080 | WebSocket Gateway | Browser kết nối vào |
| 8081 | TCP Server C | Gateway kết nối vào |
| 3000 | HTTP Express | Upload file, serve static |
| 3306 | MySQL | Database (mặc định) |

---

### **Câu 5: IP Address là gì? Phân biệt IPv4 và IPv6?**

**Trả lời:**
- **IP Address**: Địa chỉ logic để định danh thiết bị trên mạng

| Tiêu chí | IPv4 | IPv6 |
|----------|------|------|
| Độ dài | 32-bit | 128-bit |
| Biểu diễn | 192.168.1.1 | 2001:0db8:85a3::8a2e |
| Số địa chỉ | ~4.3 tỷ | ~3.4×10³⁸ |
| NAT | Phổ biến | Không cần thiết |

Đồ án dùng **IPv4** (AF_INET), bind `INADDR_ANY` để listen trên tất cả interface.

---

### **Câu 6: NAT là gì? Ảnh hưởng như thế nào đến ứng dụng mạng?**

**Trả lời:**
- **NAT (Network Address Translation)**: Chuyển đổi IP private thành IP public
- **Ảnh hưởng**:
  - Client sau NAT có thể kết nối ra ngoài bình thường
  - Server sau NAT cần **port forwarding** để client ngoài kết nối vào
  - WebSocket/TCP persistent connection giúp duy trì kết nối qua NAT

---

### **Câu 7: Socket là gì? Các loại socket?**

**Trả lời:**
- **Socket**: Endpoint cho giao tiếp 2 chiều giữa 2 chương trình qua mạng. Được định danh bởi (IP, Port, Protocol)

**Các loại socket:**
| Loại | Hằng số | Protocol | Đặc điểm |
|------|---------|----------|----------|
| Stream Socket | SOCK_STREAM | TCP | Reliable, connection-oriented |
| Datagram Socket | SOCK_DGRAM | UDP | Unreliable, connectionless |
| Raw Socket | SOCK_RAW | IP | Truy cập trực tiếp network layer |

Đồ án dùng **SOCK_STREAM** (TCP).

---

### **Câu 8: Blocking I/O và Non-blocking I/O khác nhau như thế nào?**

**Trả lời:**

**Blocking I/O:**
- Hàm (recv, send, accept) **chờ** cho đến khi hoàn thành
- Thread bị block, không làm gì khác được
- Đơn giản nhưng cần nhiều thread

**Non-blocking I/O:**
- Hàm return ngay lập tức (EAGAIN/EWOULDBLOCK nếu không có data)
- Thread có thể làm việc khác
- Cần kết hợp với select/poll/epoll

**Đồ án dùng**: Blocking socket + `select()` để multiplexing

---

### **Câu 9: I/O Multiplexing là gì? select(), poll(), epoll() khác nhau như thế nào?**

**Trả lời:**
- **I/O Multiplexing**: Một thread monitor nhiều file descriptor cùng lúc

| Cơ chế | Mô tả | Độ phức tạp | Platform |
|--------|-------|-------------|----------|
| select() | Kiểm tra fd_set | O(n) mỗi lần gọi | Cross-platform |
| poll() | Không giới hạn fd | O(n) | UNIX |
| epoll() | Event-based, hiệu quả | O(1) per event | Linux only |
| IOCP | Completion-based | Tốt nhất | Windows |

**Đồ án dùng `select()`** vì cross-platform và đơn giản.

---

### **Câu 10: Giải thích mô hình Client-Server?**

**Trả lời:**
```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
│             │                    │             │
│  - Khởi tạo │    Request         │  - Lắng nghe│
│    kết nối  │ ─────────────────→ │    (listen) │
│  - Gửi yêu  │                    │  - Xử lý    │
│    cầu      │    Response        │    request  │
│  - Nhận kết │ ←───────────────── │  - Gửi kết  │
│    quả      │                    │    quả      │
└─────────────┘                    └─────────────┘
```

**Đặc điểm:**
- Server chạy liên tục, chờ client
- Client khởi tạo kết nối
- Server có thể phục vụ nhiều client

---

### **Câu 11: WebSocket khác gì HTTP thông thường?**

**Trả lời:**

| Tiêu chí | HTTP | WebSocket |
|----------|------|-----------|
| Kết nối | Short-lived | Persistent |
| Giao tiếp | Request-Response | Full-duplex |
| Server Push | Không (phải polling) | Có |
| Header overhead | Mỗi request | Chỉ handshake |
| Use case | Static content, REST API | Real-time (chat, game, auction) |

**WebSocket handshake:**
```
GET /chat HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
```

---

### **Câu 12: Stateful vs Stateless protocol?**

**Trả lời:**

| Loại | Mô tả | Ví dụ |
|------|-------|-------|
| Stateless | Server không lưu thông tin client giữa các request | HTTP |
| Stateful | Server duy trì state của client | TCP connection, WebSocket |

**Đồ án**: Server C duy trì state trong mảng:
```c
int clientUserIds[MAX_CLIENTS];  // User đang login
int clientRoomIds[MAX_CLIENTS];  // Room đang ở
```

---

### **Câu 13: Serialization là gì? Đồ án dùng format nào?**

**Trả lời:**
- **Serialization**: Chuyển đổi object/data thành format có thể truyền qua mạng

**Các format phổ biến:**
| Format | Ưu điểm | Nhược điểm |
|--------|---------|------------|
| JSON | Human-readable, phổ biến | Verbose |
| XML | Flexible, schema | Rất verbose |
| Protocol Buffers | Compact, fast | Binary, cần compile |
| Plain Text | Simple | Khó parse complex data |

**Đồ án dùng:**
- **Browser ↔ Gateway**: JSON
- **Gateway ↔ Server C**: Plain text (`COMMAND arg1 arg2\n`)

---

### **Câu 14: Concurrent vs Parallel?**

**Trả lời:**

| Khái niệm | Mô tả | Ví dụ |
|-----------|-------|-------|
| Concurrent | Nhiều task cùng tiến triển (có thể luân phiên) | select() xử lý nhiều client |
| Parallel | Nhiều task chạy đồng thời thực sự | Multi-thread, multi-core |

**Đồ án**: Concurrent (single-threaded với select), không parallel.

---

### **Câu 15: Race condition là gì? Làm sao tránh?**

**Trả lời:**
- **Race condition**: Kết quả phụ thuộc vào thứ tự thực thi không xác định của các thread/process

**Cách tránh:**
1. Mutex/Lock
2. Semaphore
3. Single-threaded (như đồ án này)
4. Atomic operations
5. Message queue

**Đồ án**: Single-threaded nên không có race condition ở application level.

---

---

# PHẦN II: CÂU HỎI THỰC HÀNH (LIÊN QUAN ĐẾN CODE)

## 1. Kiến Trúc Hệ Thống

### **Câu 16: Kiến trúc tổng thể của hệ thống là gì?**

**Trả lời:**
Hệ thống sử dụng kiến trúc **3 tầng (3-tier)**:

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     TCP        ┌─────────────────┐
│   Web Browser   │ ←───────────────→  │  Gateway (Node) │ ←───────────→  │   Server (C)    │
│   (Frontend)    │      Port 8080     │   (Middleware)  │   Port 8081    │   (Backend)     │
└─────────────────┘                    └─────────────────┘                └────────┬────────┘
                                              │                                    │
                                              │ HTTP (Port 3000)                   │ MySQL
                                              │ (Upload files)                     │
                                              ↓                                    ↓
                                       ┌─────────────┐                    ┌─────────────────┐
                                       │   /uploads  │                    │     MySQL DB    │
                                       └─────────────┘                    └─────────────────┘
```

---

### **Câu 17: Tại sao cần Gateway? Có thể bỏ không?**

**Trả lời:**
**Không thể bỏ** vì:
1. Browser không hỗ trợ TCP socket thuần, chỉ có WebSocket
2. Server C viết bằng C, không có thư viện WebSocket đơn giản
3. Gateway làm **protocol translation**: JSON ↔ Text

**Gateway còn có vai trò:**
- Quản lý reconnect
- Queue commands khi TCP chưa sẵn sàng
- Broadcast chat messages (không qua Server C)

---

### **Câu 18: Các bước khởi tạo TCP Server trong code?**

**Trả lời:**
```c
// 1. Khởi tạo Winsock (Windows only)
WSAStartup(MAKEWORD(2, 2), &wsa);

// 2. Tạo socket
listenSock = socket(AF_INET, SOCK_STREAM, 0);

// 3. Set socket option (reuse address)
setsockopt(listenSock, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

// 4. Bind địa chỉ
serverAddr.sin_family = AF_INET;
serverAddr.sin_addr.s_addr = INADDR_ANY;
serverAddr.sin_port = htons(PORT);
bind(listenSock, (struct sockaddr*)&serverAddr, sizeof(serverAddr));

// 5. Listen
listen(listenSock, SOMAXCONN);

// 6. Accept trong vòng lặp
clientSock = accept(listenSock, &clientAddr, &addrlen);
```

---

### **Câu 19: select() hoạt động như thế nào trong code?**

**Trả lời:**
```c
while (1) {
    // 1. Reset fd_set mỗi vòng lặp
    FD_ZERO(&readfds);
    FD_SET(listenSock, &readfds);
    
    // 2. Add tất cả client socket
    for (i = 0; i < MAX_CLIENTS; i++) {
        if (clientSockets[i] != INVALID_SOCKET) {
            FD_SET(clientSockets[i], &readfds);
        }
    }
    
    // 3. Gọi select() với timeout 1 giây
    struct timeval tv = {1, 0};
    int activity = select(maxfd + 1, &readfds, NULL, NULL, &tv);
    
    // 4. Kiểm tra có connection mới
    if (FD_ISSET(listenSock, &readfds)) {
        accept(listenSock, ...);
    }
    
    // 5. Kiểm tra data từ mỗi client
    for (i = 0; i < MAX_CLIENTS; i++) {
        if (FD_ISSET(clientSockets[i], &readfds)) {
            recv(clientSockets[i], ...);
            // Process command
        }
    }
}
```

---

### **Câu 20: Broadcast message đến tất cả user trong room như thế nào?**

**Trả lời:**
```c
void broadcast_to_room(int room_id, const char *msg, size_t len,
                       SOCKET *clientSockets, int *clientRoomIds) {
    if (room_id <= 0) return;
    
    for (int i = 0; i < MAX_CLIENTS; i++) {
        SOCKET cs = clientSockets[i];
        // Gửi cho client đang ở trong room
        if (cs != INVALID_SOCKET && clientRoomIds[i] == room_id) {
            send(cs, msg, (int)len, 0);
        }
    }
}
```

Sử dụng khi: bid mới, user join/leave, auction kết thúc.

---

### **Câu 21: Giao thức tự định nghĩa có format như thế nào?**

**Trả lời:**

**Request format:** `COMMAND arg1 arg2 ... argN\n`

**Response format:**
- Success: `OK COMMAND data\n`
- Error: `ERROR COMMAND message\n`

**Ví dụ:**
```
→ REGISTER user123 pass456
← OK REGISTER 1

→ LOGIN user123 pass456
← OK LOGIN 1

→ CREATE_ROOM MyRoom
← OK CREATE_ROOM 5

→ BID 10 150000
← OK BID 10 150000 25    (itemId, newPrice, secondsLeft)

→ LIST_ROOMS
← ROOM 1 Room1 1 owner1 1
← ROOM 2 Room2 2 owner2 1
```

---

### **Câu 22: Gateway chuyển đổi JSON → Text như thế nào?**

**Trả lời:**
```javascript
ws.on('message', function (jsonData) {
    const data = JSON.parse(jsonData);
    let command = '';
    
    if (data.type === 'LOGIN') {
        command = `LOGIN ${data.username} ${data.password}\n`;
    } else if (data.type === 'BID') {
        command = `BID ${data.itemId} ${data.amount}\n`;
    } else if (data.type === 'CREATE_ROOM') {
        command = `CREATE_ROOM ${data.roomName}\n`;
    }
    // ... more commands
    
    tcpClient.write(command);
});
```

---

### **Câu 23: Xử lý client disconnect đột ngột?**

**Trả lời:**
```c
int bytes = recv(s, buffer, sizeof(buffer), 0);

if (bytes <= 0) {
    // Client đã disconnect (bytes=0) hoặc lỗi (bytes<0)
    
    // 1. Auto leave room trong DB
    if (clientUserIds[i] > 0 && clientRoomIds[i] > 0) {
        room_leave(clientUserIds[i], clientRoomIds[i], err, sizeof(err));
        
        // 2. Broadcast USER_LEFT
        snprintf(notify, "USER_LEFT %d\n", clientUserIds[i]);
        broadcast_to_room(clientRoomIds[i], notify, ...);
    }
    
    // 3. Cleanup
    closesocket(s);
    clientSockets[i] = INVALID_SOCKET;
    clientUserIds[i] = 0;
    clientRoomIds[i] = 0;
    free(clientBuffers[i]);
}
```

---

### **Câu 24: Cơ chế auto-reconnect hoạt động như thế nào?**

**Trả lời:**

**Browser side (ws.js):**
```javascript
ws.onclose = () => {
    console.warn("WS closed, retry in 2s...");
    setTimeout(connectWS, 2000);
};
```

**Gateway side (gateway.js):**
```javascript
tcpClient.on('close', function () {
    connected = false;
    setTimeout(function () {
        if (ws.readyState === WebSocket.OPEN) {
            connectTCP();  // Reconnect to C Server
        }
    }, 2000);
});
```

---

### **Câu 25: Auto-extend thời gian đấu giá khi có bid phút cuối?**

**Trả lời:**
```c
// Trong auction_bid()
if (seconds_left <= 30) {
    // Reset về 30 giây nếu bid trong 30s cuối
    snprintf(query, 
        "UPDATE items SET auction_end = DATE_ADD(NOW(), INTERVAL 30 SECOND) "
        "WHERE id = %d", item_id);
    mysql_query(conn, query);
    seconds_left = 30;
}
```

**Mục đích**: Tránh "sniping" - đặt giá vào giây cuối mà người khác không kịp phản ứng.

---

## 2. Bảo Mật

### **Câu 26: SQL Injection được phòng chống như thế nào?**

**Trả lời:**
```c
// Hàm escape ký tự đặc biệt
static void escape_string(MYSQL *conn, const char *src, 
                          char *dst, size_t dstSize) {
    mysql_real_escape_string(conn, dst, src, strlen(src));
}

// Sử dụng
char nameEsc[256];
escape_string(conn, userInput, nameEsc, sizeof(nameEsc));
snprintf(query, "INSERT INTO rooms(name) VALUES('%s')", nameEsc);
```

**Ký tự được escape**: `'`, `"`, `\`, `\0`, `\n`, `\r`, etc.

---

### **Câu 27: Session management thực hiện như thế nào?**

**Trả lời:**
Server duy trì session trong memory (RAM):
```c
int clientUserIds[MAX_CLIENTS];  // Map socket index → user_id
int clientRoomIds[MAX_CLIENTS];  // Map socket index → room_id

// Khi login thành công
clientUserIds[i] = user_id;

// Khi join room
clientRoomIds[i] = room_id;

// Khi disconnect
clientUserIds[i] = 0;
clientRoomIds[i] = 0;
```

---

### **Câu 28: Authorization được check như thế nào?**

**Trả lời:**
```c
// Check 1: Phải login
if (clientUserIds[i] <= 0) {
    send(s, "ERROR must LOGIN first\n", ...);
    continue;
}

// Check 2: Phải ở trong room
if (clientRoomIds[i] <= 0) {
    send(s, "ERROR must JOIN_ROOM first\n", ...);
    continue;
}

// Check 3: Chỉ owner mới được start auction
if (user_id != seller_id && user_id != owner_id) {
    snprintf(errMsg, "Not allowed to start auction");
    return 0;
}
```

---

## 3. Database

### **Câu 29: Server detect phiên đấu giá hết hạn như thế nào?**

**Trả lời:**
Server chạy vòng lặp với timeout 1 giây:
```c
struct timeval tv = {1, 0};  // 1 second timeout
select(maxfd + 1, &readfds, NULL, NULL, &tv);

// Mỗi giây, check items đã hết hạn
char query[] = "SELECT id FROM items "
               "WHERE status='ONGOING' AND auction_end <= NOW()";
mysql_query(conn, query);

// Với mỗi item hết hạn
auction_finish_if_needed(item_id, ...);
```

---

### **Câu 30: Buffer overflow được xử lý như thế nào khi nhận ảnh Base64?**

**Trả lời:**
Sử dụng **dynamic buffer** với realloc:
```c
char *clientBuffers[MAX_CLIENTS];
int clientBufCap[MAX_CLIENTS];

// Khi nhận data
if (clientBufLen[i] + bytes + 1 > clientBufCap[i]) {
    int newCap = clientBufCap[i] * 2;
    if (newCap > 8 * 1024 * 1024) newCap = 8 * 1024 * 1024;  // Max 8MB
    
    char *newBuf = (char*)realloc(clientBuffers[i], newCap);
    if (newBuf) {
        clientBuffers[i] = newBuf;
        clientBufCap[i] = newCap;
    }
}
```

---

## 4. Câu Hỏi Tổng Hợp

### **Câu 31: Nếu cần scale hệ thống lên 10,000 users, cần thay đổi gì?**

**Trả lời:**
1. **Thay select() bằng epoll (Linux) hoặc IOCP (Windows)**: O(1) thay vì O(n)
2. **Multi-process/Multi-thread**: Mỗi process xử lý một nhóm connection
3. **Load balancer**: Nginx/HAProxy phía trước nhiều server instance
4. **Database**: MySQL Clustering hoặc sharding
5. **Caching**: Redis cho session và realtime data
6. **Message Queue**: RabbitMQ/Kafka cho async processing

---

### **Câu 32: So sánh kiến trúc này với REST API truyền thống?**

**Trả lời:**

| Tiêu chí | REST API | WebSocket (đồ án) |
|----------|----------|-------------------|
| Protocol | HTTP | WebSocket over TCP |
| Connection | Mỗi request tạo mới | Persistent |
| Server Push | Không (phải polling) | Có |
| Realtime | Kém (delay = polling interval) | Tốt (instant) |
| Stateless | Có | Không |
| Scalability | Dễ scale (stateless) | Khó hơn (stateful) |

---

### **Câu 33: Điểm yếu của hệ thống hiện tại là gì?**

**Trả lời:**
1. **Single-threaded**: Nếu một operation chậm (DB query), block tất cả client
2. **In-memory session**: Mất khi server restart
3. **select() limit**: FD_SETSIZE = 64 trên Windows
4. **Không mã hóa**: Plain text, không SSL/TLS
5. **Không có authentication token**: Password gửi mỗi lần reconnect

---

### **Câu 34: Đề xuất cải tiến bảo mật?**

**Trả lời:**
1. **HTTPS/WSS**: Mã hóa traffic với SSL/TLS
2. **JWT Token**: Thay vì gửi password mỗi lần
3. **Rate Limiting**: Chống brute force, DDoS
4. **Input Validation**: Kiểm tra kỹ hơn các input
5. **Prepared Statements**: Thay vì string concatenation

---

### **Câu 35: Giải thích luồng xử lý khi user đặt giá (BID)?**

**Trả lời:**
```
1. Browser gửi JSON:
   {"type": "BID", "itemId": 5, "amount": 150000}

2. Gateway chuyển thành text:
   "BID 5 150000\n"

3. Server C nhận và xử lý:
   a. Parse command
   b. Check user đã login
   c. Check user đang ở room
   d. Query DB: item có đang ONGOING?
   e. Query DB: bid >= current + 10000?
   f. Insert bid vào table bids
   g. Nếu còn <= 30s, extend thời gian
   h. Gửi response: "OK BID 5 150000 25\n"

4. Gateway forward response về Browser

5. Server broadcast đến tất cả user trong room:
   "BID 5 user123 150000 25\n"

6. Các browser cập nhật UI realtime
```

---

# PHẦN III: CÂU HỎI NÂNG CAO

### **Câu 36: Heartbeat/Keepalive hoạt động như thế nào?**

**Trả lời:**
- **TCP Keepalive**: Level OS, gửi packet định kỳ để check connection còn sống
- **WebSocket Ping/Pong**: Application level heartbeat
- **Đồ án**: Dựa vào TCP keepalive mặc định và WebSocket reconnect khi connection drop

---

### **Câu 37: Deadlock có thể xảy ra không? Khi nào?**

**Trả lời:**
- **Không** trong đồ án này vì:
  - Single-threaded, không có lock/mutex
  - Mỗi operation thực hiện tuần tự
- **Có thể xảy ra** ở database level nếu 2 transaction lock row theo thứ tự khác nhau

---

### **Câu 38: Nếu Gateway crash, chuyện gì xảy ra?**

**Trả lời:**
1. Tất cả WebSocket connection từ browser bị đóng
2. Browser tự động reconnect sau 2 giây
3. TCP connection đến Server C cũng đóng
4. Server C detect disconnect, cleanup user session
5. Khi Gateway restart, browser reconnect và auto-login lại

---

### **Câu 39: Làm sao test hiệu năng hệ thống?**

**Trả lời:**
1. **Load testing tools**: Apache Benchmark, wrk, k6
2. **WebSocket load test**: Artillery, ws-benchmark
3. **Metrics to measure**:
   - Concurrent connections
   - Requests per second
   - Latency (p50, p95, p99)
   - Memory usage
   - CPU usage

---

### **Câu 40: Tại sao chọn C cho server thay vì Node.js hoặc Python?**

**Trả lời:**
1. **Hiệu năng**: C nhanh hơn interpreted languages
2. **Memory control**: Quản lý bộ nhớ thủ công
3. **Low-level access**: Trực tiếp dùng Winsock API
4. **Mục đích học tập**: Hiểu sâu về socket programming
5. **Nhược điểm**: Code dài hơn, dễ có bug memory

---

# PHẦN IV: CÂU HỎI VỀ WEB CLIENT

## 1. WebSocket Client

### **Câu 41: Cách khởi tạo kết nối WebSocket từ Browser?**

**Trả lời:**
```javascript
// ws.js
const host = window.location.hostname || "localhost";
window.WS_URL = `ws://${host}:8080`;

let ws = null;

function connectWS() {
    ws = new WebSocket(window.WS_URL);
    
    ws.onopen = () => {
        console.log("✅ WS connected");
        // Auto-login nếu đã có session
        const userJson = localStorage.getItem("user");
        const savedPassword = sessionStorage.getItem("loginPassword");
        if (userJson && savedPassword) {
            const user = JSON.parse(userJson);
            sendPacket({ type: "LOGIN", username: user.username, password: savedPassword });
        }
    };
    
    ws.onclose = () => {
        console.warn("⚠️ WS closed, retry in 2s...");
        setTimeout(connectWS, 2000);  // Auto-reconnect
    };
}
connectWS();
```

---

### **Câu 42: Hàm sendPacket() gửi dữ liệu như thế nào?**

**Trả lời:**
```javascript
let isLoggedIn = false;
let pendingCommands = [];  // Queue lệnh chờ login

function sendPacket(dataObject) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        // LOGIN/REGISTER gửi ngay, không cần chờ
        if (dataObject.type === "LOGIN" || dataObject.type === "REGISTER") {
            ws.send(JSON.stringify(dataObject));
            if (dataObject.type === "LOGIN") isLoggedIn = false;
        }
        // Các lệnh khác: chỉ gửi nếu đã login
        else {
            if (isLoggedIn) {
                ws.send(JSON.stringify(dataObject));
            } else {
                pendingCommands.push(dataObject);  // Queue lại
            }
        }
    } else {
        alert("Chưa kết nối được đến máy chủ!");
    }
}
```

**Đặc điểm**:
- Dữ liệu gửi dưới dạng **JSON string**
- Có **command queue** để chờ login xong mới gửi

---

### **Câu 43: Cơ chế auto-login và command queue hoạt động như thế nào?**

**Trả lời:**
```javascript
// Khi nhận "OK LOGIN" từ server
if (msg.startsWith("OK LOGIN")) {
    isLoggedIn = true;
    
    // Gửi tất cả lệnh đang chờ
    while (pendingCommands.length > 0) {
        const cmd = pendingCommands.shift();
        ws.send(JSON.stringify(cmd));
    }
    
    // Callback cho các trang khác
    if (typeof window.onLoginSuccess === "function") {
        window.onLoginSuccess();
    }
}
```

**Lý do cần queue**:
- WebSocket kết nối thành công ≠ đã login
- Gateway cần thời gian kết nối TCP đến Server C
- Các lệnh như LIST_ROOMS cần user_id (từ login)

---

### **Câu 44: Xử lý nhiều message cùng lúc từ server như thế nào?**

**Trả lời:**
```javascript
ws.onmessage = (e) => {
    const rawData = e.data;
    
    // Server có thể gửi nhiều dòng cùng lúc
    const messages = rawData.split("\n").filter(m => m.trim() !== "");
    
    // Gom các message cùng loại
    let bidRecords = [];
    let itemRecords = [];
    let otherMessages = [];
    
    for (const msg of messages) {
        if (msg.startsWith("BID_RECORD") || msg === "NO_BIDS") {
            bidRecords.push(msg);
        } else if (msg.startsWith("ITEM") || msg === "NO_ITEMS") {
            itemRecords.push(msg);
        } else {
            otherMessages.push(msg);
        }
    }
    
    // Xử lý từng nhóm
    for (const msg of otherMessages) {
        if (typeof window.onServerMessage === "function") {
            window.onServerMessage(msg);
        }
    }
    
    // Gửi cả batch BID_RECORD/ITEM cùng lúc
    if (bidRecords.length > 0) {
        window.onServerMessage(bidRecords.join("\n"));
    }
};
```

---

## 2. Giao Diện Phòng Đấu Giá

### **Câu 45: Cấu trúc giao diện room.html gồm những phần nào?**

**Trả lời:**
```
┌────────────────────────────────────────────────────────────┐
│                      HEADER (Top Bar)                       │
├──────────┬─────────────────────────────┬───────────────────┤
│          │                             │                   │
│  LEFT    │       MAIN STAGE            │     SIDEBAR       │
│  PANEL   │    (Sân khấu chính)         │    (Cột phải)     │
│          │                             │                   │
│  📝 Chat │  🖼️ Product Image           │ 📋 Room Info      │
│  Box     │  💰 Current Price           │ 📦 Item Queue     │
│          │  ⏱️ Countdown Timer         │ 👥 Members        │
│          │  🔨 Bid Controls            │                   │
│          │  📜 Bid History             │                   │
│          │                             │                   │
└──────────┴─────────────────────────────┴───────────────────┘
```

**Layout**: CSS Grid/Flexbox với 3 cột responsive

---

### **Câu 46: Render sân khấu đấu giá (Main Stage) như thế nào?**

**Trả lời:**
```javascript
function renderMainStage(item, secondsLeft) {
    currentStageItemId = item.id;  // Lưu ID item đang hiển thị
    
    const stage = document.getElementById("auction-stage");
    
    stage.innerHTML = `
        <div class="product-image-area">
            <img src="${imageUrl}" alt="${item.name}">
        </div>
        <div class="bidding-area">
            <h2>${item.name}</h2>
            <div class="timer-box" id="timer-display">⏱️ --:--</div>
            
            <div class="price-box">
                <div class="current-price-val" id="live-price">
                    ${item.price.toLocaleString()} VND
                </div>
            </div>
            
            <!-- Quick bid buttons -->
            <div class="quick-bid-buttons">
                <button onclick="quickBid(${item.id}, 10000)">+10K</button>
                <button onclick="quickBid(${item.id}, 50000)">+50K</button>
            </div>
            
            <!-- Custom bid input -->
            <input type="number" id="inp-bid-amount">
            <button onclick="placeBid(${item.id})">Đặt giá</button>
            
            <!-- Bid history panel -->
            <div id="bid-history-list"></div>
        </div>
    `;
    
    // Bắt đầu đồng hồ đếm ngược
    if (secondsLeft) startCountdown(secondsLeft);
    
    // Load lịch sử đấu giá
    loadBidHistory(item.id);
}
```

---

### **Câu 47: Xử lý danh sách vật phẩm từ server?**

**Trả lời:**
```javascript
function processItemList(textData) {
    allItems = [];  // Reset local cache
    
    if (textData.trim() === "NO_ITEMS") {
        renderEmptyQueue();
        return;
    }
    
    const lines = textData.split("\n");
    lines.forEach(line => {
        if (!line.startsWith("ITEM")) return;
        
        // Parse: ITEM id room sellerId sellerName name price buyNow status ...
        const parts = line.split(" ");
        
        const item = {
            id: parseInt(parts[1]),
            sellerId: parts[3],
            sellerName: parts[4].replace(/_/g, ' '),
            name: parts[5].replace(/_/g, ' '),
            price: parseInt(parts[6]),
            buyNowPrice: parseInt(parts[7]) || 0,
            status: parts[8],  // 'ONGOING', 'WAIT', 'SOLD', 'EXPIRED'
            imageUrl: parts[parts.length - 1]
        };
        
        allItems.push(item);
        
        // Nếu ONGOING → đưa lên sân khấu
        if (item.status === 'ONGOING') {
            renderMainStage(item, calculateSecondsLeft(item));
        }
    });
    
    rerenderQueue();  // Re-render sidebar
}
```

---

## 3. Hiển Thị Real-time

### **Câu 48: Đồng hồ đếm ngược (Countdown) hoạt động như thế nào?**

**Trả lời:**
```javascript
let timerInterval = null;

function startCountdown(seconds) {
    // Xóa timer cũ
    if (timerInterval) clearInterval(timerInterval);
    
    const timerElem = document.getElementById("timer-display");
    let timeLeft = seconds;
    
    const updateDisplay = () => {
        const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const sec = (timeLeft % 60).toString().padStart(2, '0');
        timerElem.innerHTML = `⏱️ ${min}:${sec}`;
        
        // Cảnh báo màu đỏ nếu < 30s
        if (timeLeft <= 30) {
            timerElem.classList.add("warning");
        }
    };
    
    updateDisplay();  // Hiển thị ngay
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Chờ server gửi AUCTION_FINISHED
        }
    }, 1000);
}
```

**Đặc điểm**:
- Client tự đếm ngược, không phụ thuộc server mỗi giây
- Server có thể gửi **TIME_LEFT** để sync lại nếu cần
- Khi có bid mới, countdown được reset theo `secondsLeft` từ server

---

### **Câu 49: Cập nhật giá real-time khi có bid mới?**

**Trả lời:**
```javascript
// Server broadcast: NEW_BID itemId userId price seconds
else if (msg.startsWith("NEW_BID")) {
    const parts = msg.split(" ");
    const itemId = parseInt(parts[1]);
    const userId = parts[2];
    const newPrice = parseInt(parts[3]);
    const seconds = parseInt(parts[4]);
    
    // Chỉ update nếu item đang hiển thị trên sân khấu
    if (itemId === currentStageItemId) {
        updateLiveAuctionUI(newPrice, userId, seconds);
        
        // Toast notification
        if (userId != currentUser.id) {
            showToast(`🔥 User #${userId} đặt giá ${newPrice.toLocaleString()}đ`);
        }
    }
}

function updateLiveAuctionUI(newPrice, userId, secondsLeft) {
    // 1. Cập nhật giá với animation
    const priceElem = document.getElementById("live-price");
    priceElem.innerText = newPrice.toLocaleString() + " VND";
    priceElem.style.transform = "scale(1.1)";  // Pulse effect
    setTimeout(() => priceElem.style.transform = "scale(1)", 300);
    
    // 2. Cập nhật lịch sử đặt giá
    addBidToHistory(userId, newPrice);
    
    // 3. Reset đồng hồ
    startCountdown(secondsLeft);
    
    // 4. Ẩn nút Mua Ngay nếu giá vượt buyNowPrice
    const item = allItems.find(i => i.id === currentStageItemId);
    if (item && newPrice >= item.buyNowPrice) {
        document.querySelector(".buy-now-box")?.remove();
    }
}
```

---

### **Câu 50: Lịch sử đấu giá (Bid History) được xử lý như thế nào?**

**Trả lời:**
```javascript
let bidHistory = [];

// Load từ server
function loadBidHistory(itemId) {
    sendPacket({ type: "LIST_BIDS", itemId: itemId });
}

// Xử lý response từ server
function processBidHistory(textData) {
    if (textData.trim() === "NO_BIDS") {
        bidHistory = [];
        renderBidHistory();
        return;
    }
    
    bidHistory = [];
    const lines = textData.split("\n");
    
    lines.forEach(line => {
        if (!line.startsWith("BID_RECORD")) return;
        
        // Format: BID_RECORD userId username amount time
        const parts = line.split(" ");
        bidHistory.push({
            userId: parts[1],
            username: parts[2],
            price: parseInt(parts[3]),
            time: parts.slice(4).join(" ")
        });
    });
    
    renderBidHistory();
}

// Render danh sách
function renderBidHistory() {
    const container = document.getElementById("bid-history-list");
    
    if (bidHistory.length === 0) {
        container.innerHTML = '<div class="empty">Chưa có lượt đặt giá</div>';
        return;
    }
    
    container.innerHTML = bidHistory.map((bid, index) => {
        const isMe = bid.userId == currentUser.id;
        return `
            <div class="bid-history-item ${index === 0 ? 'latest' : ''}">
                <span class="bid-user">${isMe ? '🏆 Bạn' : bid.username}</span>
                <span class="bid-price">${bid.price.toLocaleString()}đ</span>
                <span class="bid-time">${bid.time}</span>
            </div>
        `;
    }).join('');
}
```

---

### **Câu 51: Xử lý sự kiện kết thúc đấu giá?**

**Trả lời:**
```javascript
// Server broadcast: AUCTION_FINISHED itemId winnerId finalPrice
else if (msg.startsWith("AUCTION_FINISHED")) {
    const parts = msg.split(" ");
    const itemId = parseInt(parts[1]);
    const winnerId = parts[2];
    const finalPrice = parseInt(parts[3]) || 0;
    
    if (winnerId == currentUser.id) {
        showToast(`🎉 Chúc mừng! Bạn đã thắng với giá ${finalPrice.toLocaleString()}đ!`, 'success');
        showConfetti();  // Hiệu ứng pháo hoa
    } else if (winnerId == "0") {
        showToast("⏰ Hết giờ! Không có người mua.", 'warning');
    } else {
        showToast(`🔔 Phiên đấu giá kết thúc! Người thắng: User #${winnerId}`, 'info');
    }
    
    bidHistory = [];
    clearStage();      // Xóa sân khấu
    loadItems();       // Load lại danh sách
}

function clearStage() {
    currentStageItemId = 0;
    if (timerInterval) clearInterval(timerInterval);
    
    document.getElementById("auction-stage").innerHTML = `
        <div class="empty-stage">
            <h3>Chưa có phiên đấu giá nào đang diễn ra</h3>
        </div>
    `;
}
```

---

## 4. Các Chức Năng Khác

### **Câu 52: Quick Bid (đặt giá nhanh) hoạt động như thế nào?**

**Trả lời:**
```javascript
function quickBid(itemId, amount) {
    // Lấy giá hiện tại từ UI
    const priceText = document.getElementById("live-price").innerText;
    const currentPrice = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
    
    // Tính giá mới = giá hiện tại + amount
    const newBid = currentPrice + amount;
    
    // Gửi lệnh BID
    sendPacket({ type: "BID", itemId: itemId, amount: newBid });
    
    showToast(`💰 Đặt giá ${newBid.toLocaleString()}đ`, 'info');
}
```

**UI**: 4 nút +10K, +50K, +100K, +500K tự động tính toán

---

### **Câu 53: Chức năng chat realtime hoạt động như thế nào?**

**Trả lời:**
```javascript
// Gửi tin nhắn
function sendChatMessage() {
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message) return;
    
    sendPacket({
        type: "CHAT",
        userId: currentUser.id,
        username: currentUser.username,
        message: message
    });
    
    input.value = "";
}

// Nhận tin nhắn (callback từ ws.js)
window.onChatMessage = function (data) {
    const container = document.getElementById("chat-messages");
    const isMe = (data.userId == currentUser.id);
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isMe ? 'me' : 'other'}`;
    msgDiv.innerHTML = `
        <div class="chat-msg-header">
            <span class="chat-username">${isMe ? 'Bạn' : data.username}</span>
            <span class="chat-time">${data.timestamp}</span>
        </div>
        <div class="chat-msg-content">${escapeHtml(data.message)}</div>
    `;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;  // Auto-scroll
};

// XSS prevention
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

**Đặc điểm**: Chat được Gateway broadcast trực tiếp đến tất cả clients (không qua Server C)

---

### **Câu 54: Hiển thị danh sách thành viên phòng (realtime)?**

**Trả lời:**
```javascript
let roomMembers = [];

// Xử lý danh sách thành viên từ server
function processRoomMembers(textData) {
    roomMembers = [];
    
    if (textData.trim() === "NO_MEMBERS") {
        renderMembersList();
        return;
    }
    
    const lines = textData.split("\n");
    lines.forEach(line => {
        if (!line.startsWith("MEMBER ")) return;
        const parts = line.split(" ");
        roomMembers.push({
            userId: parseInt(parts[1]),
            username: parts[2]
        });
    });
    
    renderMembersList();
}

// Realtime: USER_JOINED userId username
else if (msg.startsWith("USER_JOINED ")) {
    const parts = msg.split(" ");
    const userId = parseInt(parts[1]);
    const username = parts[2];
    
    if (!roomMembers.find(m => m.userId === userId)) {
        roomMembers.push({ userId, username });
        renderMembersList();
        showToast(`${username} đã vào phòng`, 'info');
    }
}

// Realtime: USER_LEFT userId
else if (msg.startsWith("USER_LEFT ")) {
    const userId = parseInt(msg.split(" ")[1]);
    roomMembers = roomMembers.filter(m => m.userId !== userId);
    renderMembersList();
}
```

---

### **Câu 55: Toast Notification System?**

**Trả lời:**
```javascript
function showToast(message, type = 'info', duration = 4000) {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;  // success, error, info, warning
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    toast.innerHTML = `
        <span class="toast-icon"><i class="fa-solid ${icons[type]}"></i></span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove sau duration ms
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
```

**CSS Animation**: slideIn từ phải, slideOut ra phải

---

*Tài liệu này phục vụ mục đích ôn tập vấn đáp môn Lập Trình Mạng Máy Tính.*
