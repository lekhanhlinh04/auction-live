#define _WINSOCK_DEPRECATED_NO_WARNINGS

#include <winsock2.h>
#include <windows.h>
#include <process.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#pragma comment(lib, "ws2_32.lib")

#define DEFAULT_PORT 5555

static SOCKET g_sock = INVALID_SOCKET;

// Thread nhận dữ liệu từ server và in ra
unsigned __stdcall recv_thread(void *arg) {
    SOCKET s = (SOCKET)(uintptr_t)arg;
    char buf[4096]; // Tăng buffer để nhận tin broadcast dài

    while (1) {
        int bytes = recv(s, buf, sizeof(buf) - 1, 0);
        if (bytes <= 0) {
            printf("\n[Server closed connection]\n");
            // Khi server ngắt, thoát luôn chương trình client
            exit(0); 
        }
        buf[bytes] = '\0';

        // XỬ LÝ HIỂN THỊ
        // Sử dụng \r để xóa dấu nhắc "> " hiện tại, in tin nhắn, rồi in lại dấu nhắc
        
        // 1. Nếu là thông báo đặc biệt từ Server (Cảnh báo thời gian hoặc Sự kiện đấu giá)
        if (strstr(buf, "!!!") || strstr(buf, ">>>")) {
            // In nguyên văn tin nhắn (Server đã format đẹp rồi)
            // Thêm màu sắc nếu muốn (nhưng C chuẩn console hơi khó, tạm thời in text)
            printf("\r%s\n> ", buf);
        } 
        // 2. Tin nhắn phản hồi lệnh bình thường
        else {
            printf("\rServer: %s\n> ", buf);
        }

        fflush(stdout);
    }

    return 0;
}

int main(int argc, char *argv[]) {
    WSADATA wsa;
    struct sockaddr_in serverAddr;
    char sendbuf[1024];
    const char *serverIp = "127.0.0.1";
    int port = DEFAULT_PORT;

    // Giữ nguyên logic parse tham số dòng lệnh cũ
    if (argc >= 2) {
        serverIp = argv[1];
    }
    if (argc >= 3) {
        port = atoi(argv[2]);
    }

    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        printf("WSAStartup failed: %d\n", WSAGetLastError());
        return 1;
    }

    g_sock = socket(AF_INET, SOCK_STREAM, 0);
    if (g_sock == INVALID_SOCKET) {
        printf("socket() failed: %d\n", WSAGetLastError());
        WSACleanup();
        return 1;
    }

    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = inet_addr(serverIp);
    serverAddr.sin_port = htons(port);

    if (connect(g_sock, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        printf("connect() failed: %d\n", WSAGetLastError());
        closesocket(g_sock);
        WSACleanup();
        return 1;
    }

    printf("Connected to %s:%d\n", serverIp, port);
    printf("Type message and press Enter (Ctrl+C or QUIT to exit)\n");
    printf("------------------------------------------------------\n");

    // Tạo thread nhận dữ liệu
    uintptr_t th = _beginthreadex(NULL, 0, recv_thread,
                                  (void*)(uintptr_t)g_sock,
                                  0, NULL);
    if (th == 0) {
        printf("Cannot create recv thread\n");
        closesocket(g_sock);
        WSACleanup();
        return 1;
    }

    // Vòng lặp chính: Nhập liệu từ bàn phím gửi lên Server
    while (1) {
        printf("> ");
        if (!fgets(sendbuf, sizeof(sendbuf), stdin)) {
            break; // EOF
        }

        // Loại bỏ ký tự xuống dòng thừa do fgets
        size_t len = strlen(sendbuf);
        while (len > 0 && (sendbuf[len - 1] == '\n' || sendbuf[len - 1] == '\r')) {
            sendbuf[--len] = '\0';
        }

        // Cho phép gõ QUIT để thoát
        if (_stricmp(sendbuf, "QUIT") == 0) {
            break;
        }

        if (len == 0) continue;

        if (send(g_sock, sendbuf, (int)len, 0) == SOCKET_ERROR) {
            printf("send() failed: %d\n", WSAGetLastError());
            break;
        }
        
        // Ngủ 1 chút để chờ phản hồi từ server hiển thị xong trước khi in lại dấu "> "
        // (Giúp giao diện đỡ bị nhảy lung tung)
        Sleep(50); 
    }

    // Đóng socket -> thread recv sẽ nhận bytes <= 0 và tự thoát
    closesocket(g_sock);
    WSACleanup();
    return 0;
}