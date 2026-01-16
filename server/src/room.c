#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <mysql.h>

#include "db.h"
#include "room.h"

static void escape_string(MYSQL *conn, const char *src,
                          char *dst, size_t dstSize) {
    unsigned long len = (unsigned long)strlen(src);
    if (dstSize < 2 * len + 1) {

        strncpy(dst, src, dstSize - 1);
        dst[dstSize - 1] = '\0';
        return;
    }
    mysql_real_escape_string(conn, dst, src, len);
}

int room_create(int owner_id, const char *name,
                int *out_room_id,
                char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (owner_id <= 0) {
        snprintf(errMsg, errSize, "Not logged in");
        return 0;
    }
    if (!name || name[0] == '\0') {
        snprintf(errMsg, errSize, "Room name is empty");
        return 0;
    }

    char query[1024];
    MYSQL_RES *res;
    MYSQL_ROW row;

    snprintf(query, sizeof(query),
             "SELECT room_id FROM room_members "
             "WHERE user_id = %d AND left_at IS NULL LIMIT 1",
             owner_id);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    row = mysql_fetch_row(res);
    if (row) {
        int current_room = atoi(row[0]);
        mysql_free_result(res);
        snprintf(errMsg, errSize,
                 "Already in room %d (leave first)", current_room);
        return 0;
    }
    mysql_free_result(res);

    char nameEsc[256];
    escape_string(conn, name, nameEsc, sizeof(nameEsc));

    snprintf(query, sizeof(query),
             "INSERT INTO rooms(name, owner_id, status, created_at) "
             "VALUES('%s', %d, 1, NOW())",
             nameEsc, owner_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    int room_id = (int)mysql_insert_id(conn);

    snprintf(query, sizeof(query),
             "INSERT INTO room_members(room_id, user_id, is_owner, joined_at, left_at) "
             "VALUES(%d, %d, 1, NOW(), NULL)",
             room_id, owner_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize,
                 "DB error (add owner to room_members): %s",
                 mysql_error(conn));
        return 0;
    }

    if (out_room_id) *out_room_id = room_id;
    return 1;
}

int room_list(char *out_buf, size_t buf_size,
              char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }

    const char *query =
        "SELECT r.id, r.name, r.owner_id, r.status, COALESCE(u.username, 'Unknown') "
        "FROM rooms r "
        "LEFT JOIN users u ON r.owner_id = u.id "
        "ORDER BY r.id ASC";

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_RES *res = mysql_store_result(conn);
    if (res == NULL) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_ROW row;
    size_t used = 0;
    if (buf_size == 0) {
        mysql_free_result(res);
        return 0;
    }
    out_buf[0] = '\0';

    while ((row = mysql_fetch_row(res)) != NULL) {
        int id             = atoi(row[0]);
        const char *name   = row[1] ? row[1] : "";
        int owner_id       = atoi(row[2]);
        int status         = atoi(row[3]);
        const char *owner_name = row[4] ? row[4] : "Unknown";

        char line[512];

        snprintf(line, sizeof(line),
                 "ROOM %d %s %d %s %d\n",
                 id, name, owner_id, owner_name, status);

        size_t len = strlen(line);
        if (used + len + 1 >= buf_size) {

            break;
        }

        memcpy(out_buf + used, line, len);
        used += len;
        out_buf[used] = '\0';
    }

    mysql_free_result(res);

    if (used == 0) {
        const char *msg = "NO_ROOMS\n";
        strncpy(out_buf, msg, buf_size - 1);
        out_buf[buf_size - 1] = '\0';
    }

    return 1;
}

int room_join(int user_id, int room_id,
              int *out_member_id,
              char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (user_id <= 0) {
        snprintf(errMsg, errSize, "Not logged in");
        return 0;
    }
    if (room_id <= 0) {
        snprintf(errMsg, errSize, "Invalid room id");
        return 0;
    }

    char query[1024];

    snprintf(query, sizeof(query),
             "SELECT status FROM rooms WHERE id = %d", room_id);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    MYSQL_RES *res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    MYSQL_ROW row = mysql_fetch_row(res);
    if (!row) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "Room not found");
        return 0;
    }
    int status = atoi(row[0]);
    mysql_free_result(res);
    if (status != 1) { 
        snprintf(errMsg, errSize, "Room is not open");
        return 0;
    }

    snprintf(query, sizeof(query),
             "SELECT room_id FROM room_members "
             "WHERE user_id = %d AND left_at IS NULL LIMIT 1",
             user_id);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    row = mysql_fetch_row(res);
    if (row) {
        int current_room = atoi(row[0]);
        mysql_free_result(res);

        if (current_room == room_id) {

            snprintf(query, sizeof(query),
                     "SELECT id FROM room_members "
                     "WHERE user_id = %d AND room_id = %d AND left_at IS NULL LIMIT 1",
                     user_id, room_id);
            if (mysql_query(conn, query) == 0) {
                res = mysql_store_result(conn);
                if (res) {
                    row = mysql_fetch_row(res);
                    if (row && out_member_id) {
                        *out_member_id = atoi(row[0]);
                    }
                    mysql_free_result(res);
                }
            }
            return 1; 
        }

        snprintf(errMsg, errSize,
                 "Already in room %d (leave first)", current_room);
        return 0;
    }
    mysql_free_result(res);

    snprintf(query, sizeof(query),
             "INSERT INTO room_members(room_id, user_id, is_owner, joined_at, left_at) "
             "VALUES(%d, %d, 0, NOW(), NULL)",
             room_id, user_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    int member_id = (int)mysql_insert_id(conn);
    if (out_member_id) *out_member_id = member_id;
    return 1;
}

int room_leave(int user_id, int room_id,
               char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (user_id <= 0 || room_id <= 0) {
        snprintf(errMsg, errSize, "Invalid user or room");
        return 0;
    }

    char query[512];
    snprintf(query, sizeof(query),
             "UPDATE room_members "
             "SET left_at = NOW() "
             "WHERE user_id = %d AND room_id = %d AND left_at IS NULL",
             user_id, room_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    my_ulonglong affected = mysql_affected_rows(conn);
    if (affected == 0) {
        snprintf(errMsg, errSize, "Not in this room or already left");
        return 0;
    }

    return 1;
}

int room_close(int user_id, int room_id,
               char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (user_id <= 0 || room_id <= 0) {
        snprintf(errMsg, errSize, "Invalid user or room");
        return 0;
    }

    char query[512];

    snprintf(query, sizeof(query),
             "SELECT owner_id, status FROM rooms WHERE id = %d",
             room_id);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    MYSQL_RES *res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    MYSQL_ROW row = mysql_fetch_row(res);
    if (!row) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "Room not found");
        return 0;
    }
    int owner_id = atoi(row[0]);
    int status   = atoi(row[1]);
    mysql_free_result(res);

    if (owner_id != user_id) {
        snprintf(errMsg, errSize, "Not room owner");
        return 0;
    }
    if (status == 0) {
        snprintf(errMsg, errSize, "Room already closed");
        return 0;
    }

    snprintf(query, sizeof(query),
             "UPDATE rooms SET status = 0 WHERE id = %d", room_id);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    snprintf(query, sizeof(query),
             "UPDATE room_members "
             "SET left_at = NOW() "
             "WHERE room_id = %d AND left_at IS NULL",
             room_id);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize,
                 "DB error (update members): %s", mysql_error(conn));
        return 0;
    }

    return 1;
}

int room_open(int user_id, int room_id,
              char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (user_id <= 0 || room_id <= 0) {
        snprintf(errMsg, errSize, "Invalid user or room");
        return 0;
    }

    char query[512];

    snprintf(query, sizeof(query),
             "SELECT owner_id, status FROM rooms WHERE id = %d",
             room_id);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    MYSQL_RES *res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }
    MYSQL_ROW row = mysql_fetch_row(res);
    if (!row) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "Room not found");
        return 0;
    }
    int owner_id = atoi(row[0]);
    int status   = atoi(row[1]);
    mysql_free_result(res);

    if (owner_id != user_id) {
        snprintf(errMsg, errSize, "Not room owner");
        return 0;
    }
    if (status == 1) {
        snprintf(errMsg, errSize, "Room already open");
        return 0;
    }

    snprintf(query, sizeof(query),
             "UPDATE rooms SET status = 1 WHERE id = %d", room_id);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    return 1;
}

int room_list_members(int room_id,
                      char *out_buf, size_t buf_size,
                      char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (room_id <= 0) {
        snprintf(errMsg, errSize, "Invalid room id");
        return 0;
    }

    char query[512];
    snprintf(query, sizeof(query),
             "SELECT rm.user_id, u.username "
             "FROM room_members rm "
             "JOIN users u ON rm.user_id = u.id "
             "WHERE rm.room_id = %d AND rm.left_at IS NULL "
             "ORDER BY rm.joined_at ASC",
             room_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_RES *res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_ROW row;
    size_t used = 0;
    if (buf_size == 0) {
        mysql_free_result(res);
        return 0;
    }
    out_buf[0] = '\0';

    while ((row = mysql_fetch_row(res)) != NULL) {
        int user_id = atoi(row[0]);
        const char *username = row[1] ? row[1] : "Unknown";

        char line[256];
        snprintf(line, sizeof(line), "MEMBER %d %s\n", user_id, username);

        size_t len = strlen(line);
        if (used + len + 1 >= buf_size) break;

        memcpy(out_buf + used, line, len);
        used += len;
        out_buf[used] = '\0';
    }

    mysql_free_result(res);

    if (used == 0) {
        const char *msg = "NO_MEMBERS\n";
        strncpy(out_buf, msg, buf_size - 1);
        out_buf[buf_size - 1] = '\0';
    }

    return 1;
}
