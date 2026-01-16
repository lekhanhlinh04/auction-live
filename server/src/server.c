#define _WINSOCK_DEPRECATED_NO_WARNINGS

#include <winsock2.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "db.h"
#include "user.h"
#include "room.h"
#include "item.h"
#include "auction.h"

#pragma comment(lib, "ws2_32.lib")

#define PORT 8081
#define MAX_CLIENTS  FD_SETSIZE

void trim_newline(char *s) {
    size_t len = strlen(s);
    while (len > 0 && (s[len - 1] == '\n' || s[len - 1] == '\r')) {
        s[--len] = '\0';
    }
}

void broadcast_to_room(int room_id,
                       const char *msg,
                       size_t len,
                       SOCKET *clientSockets,
                       int *clientRoomIds) {
    if (room_id <= 0) return;
    for (int i = 0; i < MAX_CLIENTS; i++) {
        SOCKET cs = clientSockets[i];
        if (cs != INVALID_SOCKET && clientRoomIds[i] == room_id) {
            send(cs, msg, (int)len, 0);
        }
    }
}

int main(void) {
    WSADATA wsa;
    SOCKET listenSock, clientSock;
    SOCKET clientSockets[MAX_CLIENTS];
    int    clientUserIds[MAX_CLIENTS];   
    int    clientRoomIds[MAX_CLIENTS];   

    char  *clientBuffers[MAX_CLIENTS];
    int    clientBufLen[MAX_CLIENTS];
    int    clientBufCap[MAX_CLIENTS];

    struct sockaddr_in serverAddr, clientAddr;
    int addrlen = sizeof(clientAddr);
    fd_set readfds;
    int i;

    for (i = 0; i < MAX_CLIENTS; i++) {
        clientSockets[i] = INVALID_SOCKET;
        clientUserIds[i] = 0;
        clientRoomIds[i] = 0;
        
        clientBuffers[i] = NULL;
        clientBufLen[i] = 0;
        clientBufCap[i] = 0;
    }

    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        printf("WSAStartup failed: %d\n", WSAGetLastError());
        printf("Nhấn phím bất kỳ để thoát...\n");
        getchar();
        return 1;
    }

    if (!db_init()) {
        printf("Không kết nối được MySQL, thoát.\n");
        printf("Nhấn phím bất kỳ để thoát...\n");
        getchar();
        WSACleanup();
        return 1;
    }

    {
        MYSQL *conn = db_get_conn();
        if (conn) {
            const char *alter_query = "ALTER TABLE items MODIFY description MEDIUMTEXT";
            if (mysql_query(conn, alter_query) != 0) {

            } else {
                printf("✅ Database schema updated: items.description -> MEDIUMTEXT\n");
            }
        }
    }

    listenSock = socket(AF_INET, SOCK_STREAM, 0);
    if (listenSock == INVALID_SOCKET) {
        printf("socket() failed: %d\n", WSAGetLastError());
        db_close();
        WSACleanup();
        printf("Nhấn phím bất kỳ để thoát...\n");
        getchar();
        return 1;
    }

    int opt = 1;
    setsockopt(listenSock, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(PORT);

    if (bind(listenSock, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        printf("bind() failed: %d\n", WSAGetLastError());
        closesocket(listenSock);
        db_close();
        WSACleanup();
        printf("Nhấn phím bất kỳ để thoát...\n");
        getchar();
        return 1;
    }

    if (listen(listenSock, SOMAXCONN) == SOCKET_ERROR) {
        printf("listen() failed: %d\n", WSAGetLastError());
        closesocket(listenSock);
        db_close();
        WSACleanup();
        printf("Nhấn phím bất kỳ để thoát...\n");
        getchar();
        return 1;
    }

    printf("Server listening on port %d...\n", PORT);

    while (1) {
        FD_ZERO(&readfds);
        FD_SET(listenSock, &readfds);
        SOCKET maxfd = listenSock;

        for (i = 0; i < MAX_CLIENTS; i++) {
            SOCKET s = clientSockets[i];
            if (s != INVALID_SOCKET) {
                FD_SET(s, &readfds);
                if (s > maxfd) maxfd = s;
            }
        }

        struct timeval tv;
tv.tv_sec = 1;   
tv.tv_usec = 0;

int activity = select((int)maxfd + 1, &readfds, NULL, NULL, &tv);
        if (activity == SOCKET_ERROR) {
            printf("select() error: %d\n", WSAGetLastError());
            break;
        }

        {
            int finished_items[64];
            int finished_count = 0;

            finished_count = auction_get_finished_items(
                    finished_items,
                    64);

for (int k = 0; k < finished_count; k++) {
    int item_id = finished_items[k];

    int room_id = 0;
    int winner_id = 0;
    long long final_price = 0;
    int has_winner = 0;
    char err[256];

    int ok = auction_finish_if_needed(
                item_id,
                &room_id,
                &winner_id,
                &final_price,
                &has_winner,
                err, sizeof(err));

    if (ok != 1) {
        continue; 
    }

    if (has_winner) {
        char notify[256];
        snprintf(notify, sizeof(notify),
                 "AUCTION_FINISHED %d %d %lld\n",
                 item_id, winner_id, final_price);
        broadcast_to_room(room_id, notify, strlen(notify),
                          clientSockets, clientRoomIds);

        char details[64];
        snprintf(details, sizeof(details), "item %d won by %d price %lld",
                 item_id, winner_id, final_price);
        log_activity(winner_id > 0 ? winner_id : 0, "AUCTION_WON", details);

    } else {
        char notify[256];
        snprintf(notify, sizeof(notify),
                 "AUCTION_FINISHED %d 0 0\n", item_id);
        broadcast_to_room(room_id, notify, strlen(notify),
                          clientSockets, clientRoomIds);
    }
}
        }

if (FD_ISSET(listenSock, &readfds)) {
    clientSock = accept(listenSock,
                        (struct sockaddr*)&clientAddr,
                        &addrlen);
    if (clientSock == INVALID_SOCKET) {
        printf("accept() failed: %d\n", WSAGetLastError());
    } else {
        printf("New connection: socket %d, ip %s, port %d\n",
               (int)clientSock, inet_ntoa(clientAddr.sin_addr), ntohs(clientAddr.sin_port));
        for (i = 0; i < MAX_CLIENTS; i++) {
            if (clientSockets[i] == INVALID_SOCKET) {
                clientSockets[i] = clientSock;
                clientUserIds[i] = 0;
                clientRoomIds[i] = 0;

                clientBufCap[i] = 1024;
                clientBufLen[i] = 0;
                clientBuffers[i] = (char*)malloc(clientBufCap[i]);
                if (clientBuffers[i]) clientBuffers[i][0] = '\0';
                
                break;
            }
        }
        if (i == MAX_CLIENTS) {
            printf("Too many clients, rejecting.\n");
            closesocket(clientSock);
        }
    }
}

        for (i = 0; i < MAX_CLIENTS; i++) {
            SOCKET s = clientSockets[i];
            if (s != INVALID_SOCKET && FD_ISSET(s, &readfds)) {

                char clientBufTemp[65536]; 
                int bytes = recv(s, clientBufTemp, sizeof(clientBufTemp) - 1, 0);

                if (bytes <= 0) {

                    printf("Client %d disconnected.\n", (int)s);

                    if (clientUserIds[i] > 0 && clientRoomIds[i] > 0) {
                        char err[256];

                        char notify[256];
                        snprintf(notify, sizeof(notify), "USER_LEFT %d\n", clientUserIds[i]);
                        broadcast_to_room(clientRoomIds[i], notify, strlen(notify),
                                          clientSockets, clientRoomIds);

                        room_leave(clientUserIds[i], clientRoomIds[i],
                                   err, sizeof(err));
                    }

                    closesocket(s);
                    clientSockets[i] = INVALID_SOCKET;
                    clientUserIds[i] = 0;
                    clientRoomIds[i] = 0;

                    if (clientBuffers[i]) free(clientBuffers[i]);
                    clientBuffers[i] = NULL;
                    clientBufLen[i] = 0;
                    clientBufCap[i] = 0;
                } else {

                    if (clientBufLen[i] + bytes + 1 > clientBufCap[i]) {
                        int newCap = clientBufCap[i] * 2;
                        if (newCap < clientBufLen[i] + bytes + 1) newCap = clientBufLen[i] + bytes + 1;
                        if (newCap > 8 * 1024 * 1024) newCap = 8 * 1024 * 1024;
                        
                        char *newBuf = (char*)realloc(clientBuffers[i], newCap);
                        if (!newBuf) {
                            clientBufLen[i] = 0; 
                        } else {
                            clientBuffers[i] = newBuf;
                            clientBufCap[i] = newCap;
                        }
                    }

                    if (clientBuffers[i] && (clientBufLen[i] + bytes < clientBufCap[i])) {
                        memcpy(clientBuffers[i] + clientBufLen[i], clientBufTemp, bytes);
                        clientBufLen[i] += bytes;
                        clientBuffers[i][clientBufLen[i]] = '\0';

                        while (1) {
                            char *newline = strchr(clientBuffers[i], '\n');
                            if (!newline) break; 
                            
                            *newline = '\0';
                            char *buf = clientBuffers[i];
                            trim_newline(buf);

                            if (strlen(buf) > 0 && strlen(buf) < 200) printf("From %d: %s\n", (int)s, buf);

                            char cmd[32], arg1[128], arg2[128];

                            cmd[0] = '\0'; arg1[0] = '\0'; arg2[0] = '\0';
                            int n = sscanf(buf, "%31s %127s %127s", cmd, arg1, arg2);

                            if (n <= 0) {
                        const char *msg = "ERROR Empty command\n";
                        send(s, msg, (int)strlen(msg), 0);
                        continue;
                    }

                    if (strcmp(cmd, "REGISTER") == 0) {
                        if (n != 3) {
                            const char *msg =
                                "ERROR REGISTER usage: REGISTER username password\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        char err[256];
                        int new_id = 0;
                        int ok = user_register(arg1, arg2, &new_id, err, sizeof(err));
                        if (ok == 1) {
                            char resp[128];
                            snprintf(resp, sizeof(resp), "OK REGISTER %d\n", new_id);
                            send(s, resp, (int)strlen(resp), 0);
                            log_activity(new_id, "REGISTER", arg1);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR REGISTER %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "LOGIN") == 0) {
                        if (n != 3) {
                            const char *msg =
                                "ERROR LOGIN usage: LOGIN username password\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        char err[256];
                        int user_id = 0;
                        int ok = user_login(arg1, arg2, &user_id, err, sizeof(err));
                        if (ok == 1) {
                            clientUserIds[i] = user_id;
                            char resp[128];
                            snprintf(resp, sizeof(resp), "OK LOGIN %d\n", user_id);
                            send(s, resp, (int)strlen(resp), 0);
                            log_activity(user_id, "LOGIN", arg1);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR LOGIN %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "CHANGE_PASS") == 0) {
                        if (clientUserIds[i] <= 0) {
                            const char *msg = "ERROR Not logged in\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        if (n != 3) {
                            const char *msg =
                                "ERROR CHANGE_PASS usage: CHANGE_PASS old_pass new_pass\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        int user_id = clientUserIds[i];
                        int ok = user_change_password(user_id, arg1, arg2, err, sizeof(err));
                        
                        if (ok == 1) {
                            char resp[128];
                            snprintf(resp, sizeof(resp), "OK CHANGE_PASS\n");
                            send(s, resp, (int)strlen(resp), 0);
                            log_activity(user_id, "CHANGE_PASS", "Success");
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp), "ERROR CHANGE_PASS %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }
                    else if (strcmp(cmd, "MY_STATS") == 0) {
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR MY_STATS must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char stats_buf[4096];
                        char err[256];
                        int ok = user_get_stats(clientUserIds[i], stats_buf, sizeof(stats_buf), err, sizeof(err));
                        if (ok == 1) {
                            send(s, stats_buf, (int)strlen(stats_buf), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp), "ERROR MY_STATS %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "CREATE_ROOM") == 0) {
                        if (n != 2) {
                            const char *msg =
                                "ERROR CREATE_ROOM usage: CREATE_ROOM room_name\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR CREATE_ROOM must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        int room_id = 0;
                        int ok = room_create(clientUserIds[i], arg1, &room_id,
                                             err, sizeof(err));
                        if (ok == 1) {
                            char resp[128];
                            snprintf(resp, sizeof(resp),
                                     "OK CREATE_ROOM %d\n", room_id);
                            send(s, resp, (int)strlen(resp), 0);

                            clientRoomIds[i] = room_id;
                            log_activity(clientUserIds[i], "CREATE_ROOM", arg1);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR CREATE_ROOM %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "LIST_ROOMS") == 0) {
                        char err[256];
                        char bufRooms[4096];

                        int ok = room_list(bufRooms, sizeof(bufRooms),
                                           err, sizeof(err));
                        if (ok == 1) {
                            send(s, bufRooms, (int)strlen(bufRooms), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR LIST_ROOMS %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "LIST_ROOM_MEMBERS") == 0) {
                        if (n != 2) {
                            const char *msg =
                                "ERROR LIST_ROOM_MEMBERS usage: LIST_ROOM_MEMBERS room_id\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int room_id = atoi(arg1);
                        if (room_id <= 0) {
                            const char *msg =
                                "ERROR LIST_ROOM_MEMBERS invalid room_id\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        char bufMembers[4096];
                        int ok = room_list_members(room_id, bufMembers, sizeof(bufMembers),
                                                   err, sizeof(err));
                        if (ok == 1) {
                            send(s, bufMembers, (int)strlen(bufMembers), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR LIST_ROOM_MEMBERS %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "JOIN_ROOM") == 0) {
                        if (n != 2) {
                            const char *msg =
                                "ERROR JOIN_ROOM usage: JOIN_ROOM room_id\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR JOIN_ROOM must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int room_id = atoi(arg1);
                        if (room_id <= 0) {
                            const char *msg =
                                "ERROR JOIN_ROOM invalid room_id\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        if (clientRoomIds[i] != 0 && clientRoomIds[i] != room_id) {
                            const char *msg =
                                "ERROR JOIN_ROOM already in another room\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        int member_id = 0;
                        int ok = room_join(clientUserIds[i], room_id,
                                           &member_id, err, sizeof(err));
                        if (ok == 1) {
                            clientRoomIds[i] = room_id;
                            char resp[128];
                            snprintf(resp, sizeof(resp),
                                     "OK JOIN_ROOM %d\n", room_id);
                            send(s, resp, (int)strlen(resp), 0);
                            char details[32];
                            snprintf(details, sizeof(details), "room %d", room_id);
                            log_activity(clientUserIds[i], "JOIN_ROOM", details);

                            char notify[256];
                            char username[64] = "User";

                            char uq[128];
                            snprintf(uq, sizeof(uq), 
                                     "SELECT username FROM users WHERE id = %d", 
                                     clientUserIds[i]);
                            if (mysql_query(db_get_conn(), uq) == 0) {
                                MYSQL_RES *ures = mysql_store_result(db_get_conn());
                                if (ures) {
                                    MYSQL_ROW urow = mysql_fetch_row(ures);
                                    if (urow && urow[0]) {
                                        strncpy(username, urow[0], sizeof(username)-1);
                                    }
                                    mysql_free_result(ures);
                                }
                            }
                            snprintf(notify, sizeof(notify),
                                     "USER_JOINED %d %s\n",
                                     clientUserIds[i], username);
                            broadcast_to_room(room_id, notify, strlen(notify),
                                              clientSockets, clientRoomIds);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR JOIN_ROOM %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "LEAVE_ROOM") == 0) {
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR LEAVE_ROOM must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int target_room_id = clientRoomIds[i];
                        if (n >= 2) {
                            int rid = atoi(arg1);
                            if (rid > 0) target_room_id = rid;
                        }

                        if (target_room_id <= 0) {
                            const char *msg =
                                "ERROR LEAVE_ROOM not in any room\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        int ok = room_leave(clientUserIds[i],
                                            target_room_id,
                                            err, sizeof(err));
                        if (ok == 1) {

                            char notify[256];
                            snprintf(notify, sizeof(notify),
                                     "USER_LEFT %d\n", clientUserIds[i]);
                            broadcast_to_room(target_room_id, notify, strlen(notify),
                                              clientSockets, clientRoomIds);

                            if (clientRoomIds[i] == target_room_id) {
                                clientRoomIds[i] = 0;
                            }
                            const char *msg = "OK LEAVE_ROOM\n";
                            send(s, msg, (int)strlen(msg), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR LEAVE_ROOM %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "CLOSE_ROOM") == 0) {
                        if (n != 2) {
                            const char *msg =
                                "ERROR CLOSE_ROOM usage: CLOSE_ROOM room_id\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR CLOSE_ROOM must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int room_id = atoi(arg1);
                        if (room_id <= 0) {
                            const char *msg =
                                "ERROR CLOSE_ROOM invalid room_id\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        int ok = room_close(clientUserIds[i], room_id,
                                            err, sizeof(err));
                        if (ok == 1) {
                            if (clientRoomIds[i] == room_id) {
                                clientRoomIds[i] = 0;
                            }
                            char resp[128];
                            snprintf(resp, sizeof(resp),
                                     "OK CLOSE_ROOM %d\n", room_id);
                            send(s, resp, (int)strlen(resp), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR CLOSE_ROOM %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "OPEN_ROOM") == 0) {
                        if (n != 2) {
                            const char *msg =
                                "ERROR OPEN_ROOM usage: OPEN_ROOM room_id\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR OPEN_ROOM must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int room_id = atoi(arg1);
                        if (room_id <= 0) {
                            const char *msg =
                                "ERROR OPEN_ROOM invalid room_id\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        int ok = room_open(clientUserIds[i], room_id,
                                           err, sizeof(err));
                        if (ok == 1) {
                            char resp[128];
                            snprintf(resp, sizeof(resp),
                                     "OK OPEN_ROOM %d\n", room_id);
                            send(s, resp, (int)strlen(resp), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR OPEN_ROOM %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "CREATE_ITEM") == 0) {
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR CREATE_ITEM must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        if (clientRoomIds[i] <= 0) {
                            const char *msg =
                                "ERROR CREATE_ITEM must JOIN_ROOM first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        long long start_price = 0, buy_now_price = 0;
                        char *name_ptr = NULL;
                        char *image_ptr = NULL;

                        char *p = buf;

                        while (*p && !isspace(*p)) p++;
                        while (*p && isspace(*p)) p++;

                        if (*p) {
                            name_ptr = p;
                            while (*p && !isspace(*p)) p++;
                            if (*p) *p++ = '\0';
                            while (*p && isspace(*p)) p++;
                        }

                        if (*p) {
                            char *price_str = p;
                            while (*p && !isspace(*p)) p++;
                            if (*p) *p++ = '\0';
                            while (*p && isspace(*p)) p++;
                            start_price = atoll(price_str);
                        }

                        if (*p) {
                            char *bn_str = p;
                            while (*p && !isspace(*p)) p++;
                            if (*p) *p++ = '\0';
                            while (*p && isspace(*p)) p++;
                            buy_now_price = atoll(bn_str);
                        }

                        if (*p) {
                             image_ptr = p;

                             char *end = image_ptr + strlen(image_ptr) - 1;
                             while (end > image_ptr && isspace(*end)) *end-- = '\0';
                        }
                        
                        if (!name_ptr || start_price <= 0) {
                            const char *msg = "ERROR CREATE_ITEM invalid parameters\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        int item_id = 0;

                        int ok = item_create(clientUserIds[i], clientRoomIds[i], name_ptr,
                                             start_price, buy_now_price,
                                             image_ptr, 
                                             &item_id, err, sizeof(err));
                        if (ok == 1) {
                            char resp[128];
                            snprintf(resp, sizeof(resp),
                                     "OK CREATE_ITEM %d\n", item_id);
                            send(s, resp, (int)strlen(resp), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR CREATE_ITEM %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }

                    }

                    else if (strcmp(cmd, "LIST_ITEMS") == 0) {
                        int room_id = 0;

                        if (n == 2) {
                            room_id = atoi(arg1);
                            if (room_id < 0) {
                                const char *msg =
                                    "ERROR LIST_ITEMS invalid roomId\n";
                                send(s, msg, (int)strlen(msg), 0);
                                continue;
                            }
                        } else if (n > 2) {
                            const char *msg =
                                "ERROR LIST_ITEMS usage: LIST_ITEMS [roomId]\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];

                        size_t outCap = 8 * 1024 * 1024;
                        char *out = (char*)malloc(outCap);
                        if (!out) {
                             const char *msg = "ERROR Server out of memory\n";
                             send(s, msg, (int)strlen(msg), 0);
                             continue;
                        }
                        
                        int ok = item_list_by_room(room_id,
                                                   out, outCap,
                                                   err, sizeof(err));
                        if (ok == 1) {
                            send(s, out, (int)strlen(out), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR LIST_ITEMS %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                        
                        free(out);
                    }

                    else if (strcmp(cmd, "DELETE_ITEM") == 0) {
                        if (n != 2) {
                            const char *msg =
                                "ERROR DELETE_ITEM usage: DELETE_ITEM itemId\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR DELETE_ITEM must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int item_id = atoi(arg1);
                        if (item_id <= 0) {
                            const char *msg =
                                "ERROR DELETE_ITEM invalid itemId\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        int ok = item_delete(clientUserIds[i],
                                             item_id,
                                             err, sizeof(err));
                        if (ok == 1) {
                            const char *msg = "OK DELETE_ITEM\n";
                            send(s, msg, (int)strlen(msg), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR DELETE_ITEM %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "SEARCH_ITEMS") == 0) {
                        if (n != 2) {
                            const char *msg =
                                "ERROR SEARCH_ITEMS usage: SEARCH_ITEMS keyword\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        char out[4096];

                        int ok = item_search(arg1, out, sizeof(out),
                                             err, sizeof(err));
                        if (ok == 1) {
                            send(s, out, (int)strlen(out), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR SEARCH_ITEMS %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "SEARCH_ITEMS_TIME") == 0) {
                        if (n != 3) {
                            const char *msg =
                                "ERROR SEARCH_ITEMS_TIME usage: "
                                "SEARCH_ITEMS_TIME fromTime toTime "
                                "(format: YYYY-MM-DD_HH:MM:SS)\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char from[64], to[64];
                        strncpy(from, arg1, sizeof(from)-1);
                        from[sizeof(from)-1] = '\0';
                        strncpy(to, arg2, sizeof(to)-1);
                        to[sizeof(to)-1] = '\0';

                        for (char *p = from; *p; ++p) {
                            if (*p == '_') *p = ' ';
                        }
                        for (char *p = to; *p; ++p) {
                            if (*p == '_') *p = ' ';
                        }

                        char err[256];
                        char out[4096];

                        int ok = item_search_time(from, to,
                                                  out, sizeof(out),
                                                  err, sizeof(err));
                        if (ok == 1) {
                            send(s, out, (int)strlen(out), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR SEARCH_ITEMS_TIME %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "START_AUCTION") == 0) {
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR START_AUCTION must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int item_id = 0;
                        int duration = 0;

                        int num = sscanf(buf, "%*s %d %d", &item_id, &duration);
                        if (num < 1) {
                            const char *msg =
                                "ERROR START_AUCTION usage: "
                                "START_AUCTION itemId [durationSeconds]\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }
                        if (duration <= 0) duration = 120; 

                        char err[256];
                        int room_id = 0;
                        long long start_price = 0;
                        long long buy_now_price = 0;
                        int seconds_left = 0;

                        int ok = auction_start(clientUserIds[i],
                                                    item_id,
                                                    duration,
                                                    &room_id,
                                                    &start_price,
                                                    &buy_now_price,
                                                    &seconds_left,
                                                    err, sizeof(err));
                        if (ok == 1) {

                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "OK START_AUCTION %d %d\n",
                                     item_id, seconds_left);
                            send(s, resp, (int)strlen(resp), 0);

                            char *notify = NULL;
                            char q[128];
                            snprintf(q, sizeof(q), "SELECT description FROM items WHERE id = %d", item_id);

                            if (mysql_query(db_get_conn(), q) == 0) {
                                MYSQL_RES *res = mysql_store_result(db_get_conn());
                                if (res) {
                                    MYSQL_ROW row = mysql_fetch_row(res);
                                    const char *img = (row && row[0]) ? row[0] : "NOIMG";

                                    size_t msgLen = 256 + strlen(img) + 1;
                                    notify = (char*)malloc(msgLen);
                                    if (notify) {
                                        snprintf(notify, msgLen,
                                                 "AUCTION_STARTED %d %lld %lld %d %s\n",
                                                 item_id, start_price, buy_now_price,
                                                 seconds_left, img);
                                    }
                                    mysql_free_result(res);
                                }
                            }

                            if (notify) {
                                broadcast_to_room(room_id, notify, strlen(notify),
                                                  clientSockets, clientRoomIds);
                                free(notify);
                            } else {

                                char fallback[256];
                                snprintf(fallback, sizeof(fallback),
                                         "AUCTION_STARTED %d %lld %lld %d NOIMG\n",
                                         item_id, start_price, buy_now_price,
                                         seconds_left);
                                broadcast_to_room(room_id, fallback, strlen(fallback),
                                                  clientSockets, clientRoomIds);
                            }
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR START_AUCTION %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

else if (strcmp(cmd, "BID") == 0) {
    if (clientUserIds[i] <= 0) {
        const char *msg = "ERROR BID must LOGIN first\n";
        send(s, msg, (int)strlen(msg), 0);
        continue;
    }

    if (n != 3) {
        const char *msg = "ERROR BID usage: BID itemId amount\n";
        send(s, msg, (int)strlen(msg), 0);
        continue;
    }

    int item_id = atoi(arg1);
    long long amount = atoll(arg2);

    if (item_id <= 0 || amount <= 0) {
        const char *msg = "ERROR BID invalid itemId or amount\n";
        send(s, msg, (int)strlen(msg), 0);
        continue;
    }

    printf("[DEBUG BID] user=%d item=%d amount=%lld\n",
           clientUserIds[i], item_id, amount);

    char err[256];
    long long current_price = 0;
    int room_id = 0;
    int seconds_left = 0;

    int ok = auction_bid(clientUserIds[i],
                      clientRoomIds[i],   
                      item_id,
                      amount,
                      &current_price,
                      &room_id,
                      &seconds_left,
                      err, sizeof(err));
    if (ok == 1) {
        char resp[256];
        snprintf(resp, sizeof(resp),
                 "OK BID %d %lld %d\n",
                 item_id, current_price, seconds_left);
        send(s, resp, (int)strlen(resp), 0);

        char notify[256];
        snprintf(notify, sizeof(notify),
                 "NEW_BID %d %d %lld %d\n",
                 item_id, clientUserIds[i],
                 current_price, seconds_left);
        broadcast_to_room(room_id, notify, strlen(notify),
                          clientSockets, clientRoomIds);

        if (seconds_left <= 30) {
            char tmsg[128];
            snprintf(tmsg, sizeof(tmsg),
                     "TIME_LEFT %d %d\n",
                     item_id, seconds_left);
            broadcast_to_room(room_id, tmsg, strlen(tmsg),
                              clientSockets, clientRoomIds);
        }

        char details[64];
        snprintf(details, sizeof(details), "item %d amount %lld", item_id, amount);
        log_activity(clientUserIds[i], "BID", details);
    } else {
        char resp[256];
        snprintf(resp, sizeof(resp),
                 "ERROR BID %s\n", err);
        send(s, resp, (int)strlen(resp), 0);
    }
}

                    else if (strcmp(cmd, "BUY_NOW") == 0) {
                        if (clientUserIds[i] <= 0) {
                            const char *msg =
                                "ERROR BUY_NOW must LOGIN first\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        if (n != 2) {
                            const char *msg =
                                "ERROR BUY_NOW usage: BUY_NOW itemId\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int item_id = atoi(arg1);
                        if (item_id <= 0) {
                            const char *msg =
                                "ERROR BUY_NOW invalid itemId\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        long long final_price = 0;
                        int room_id = 0;

                        int ok = auction_buy_now(clientUserIds[i],
                                              item_id,
                                              &final_price,
                                              &room_id,
                                              err, sizeof(err));
                        if (ok == 1) {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "OK BUY_NOW %d %lld\n",
                                     item_id, final_price);
                            send(s, resp, (int)strlen(resp), 0);

                            char notify[256];
                            snprintf(notify, sizeof(notify),
                                     "ITEM_SOLD %d %d %lld\n",
                                     item_id, clientUserIds[i], final_price);
                            broadcast_to_room(room_id, notify, strlen(notify),
                                              clientSockets, clientRoomIds);

                            char details[64];
                            snprintf(details, sizeof(details), "item %d price %lld", item_id, final_price);
                            log_activity(clientUserIds[i], "BUY_NOW", details);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR BUY_NOW %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else if (strcmp(cmd, "LIST_BIDS") == 0) {
                        if (n != 2) {
                            const char *msg =
                                "ERROR LIST_BIDS usage: LIST_BIDS itemId\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        int item_id = atoi(arg1);
                        if (item_id <= 0) {
                            const char *msg =
                                "ERROR LIST_BIDS invalid itemId\n";
                            send(s, msg, (int)strlen(msg), 0);
                            continue;
                        }

                        char err[256];
                        char out[4096];
                        int ok = auction_list_bids(item_id,
                                                   out, sizeof(out),
                                                   err, sizeof(err));
                        if (ok == 1) {
                            send(s, out, (int)strlen(out), 0);
                        } else {
                            char resp[256];
                            snprintf(resp, sizeof(resp),
                                     "ERROR LIST_BIDS %s\n", err);
                            send(s, resp, (int)strlen(resp), 0);
                        }
                    }

                    else {
                        const char *msg = "UNKNOWN COMMAND\n";
                        send(s, msg, (int)strlen(msg), 0);
                    }

                    int processed_len = (newline - clientBuffers[i]) + 1;
                    int remaining = clientBufLen[i] - processed_len;
                    if (remaining > 0) {
                        memmove(clientBuffers[i], newline + 1, remaining);
                    }
                    clientBufLen[i] = remaining;
                    clientBuffers[i][clientBufLen[i]] = '\0';
                 } 
              } 
           } 
        } 
     }

    }

    closesocket(listenSock);
    for (i = 0; i < MAX_CLIENTS; i++) {
        if (clientSockets[i] != INVALID_SOCKET) {
            closesocket(clientSockets[i]);
        }
    }
    db_close();
    WSACleanup();
    return 0;
}
