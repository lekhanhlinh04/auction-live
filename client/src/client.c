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

// Thread nhận dữ liệu từ server và in ra ngay lập tức
unsigned __stdcall recv_thread(void *arg) {
    SOCKET s = (SOCKET)(uintptr_t)arg;
    char buf[1024];

    while (1) {
        int bytes = recv(s, buf, sizeof(buf) - 1, 0);
        if (bytes <= 0) {
            printf("\n[Server closed connection]\n");
            break;
        }
        buf[bytes] = '\0';
        printf("\nServer: %s", buf);
        printf("\n> ");
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

    while (1) {
        printf("> ");
        if (!fgets(sendbuf, sizeof(sendbuf), stdin)) {
            break; // EOF
        }

        // Cho phép gõ QUIT để thoát
        if (_stricmp(sendbuf, "QUIT\n") == 0 ||
            _stricmp(sendbuf, "quit\n") == 0) {
            break;
        }

        int len = (int)strlen(sendbuf);
        if (len == 0) continue;

        if (send(g_sock, sendbuf, len, 0) == SOCKET_ERROR) {
            printf("send() failed: %d\n", WSAGetLastError());
            break;
        }
    }

    // Đóng socket -> thread recv sẽ nhận bytes <= 0 và tự thoát
    closesocket(g_sock);
    WSACleanup();
    return 0;
}
