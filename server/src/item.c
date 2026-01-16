#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <mysql.h>

#include "db.h"
#include "item.h"

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

int item_create(int seller_id, int room_id, const char *name,
                long long start_price, long long buy_now_price,
                const char *image_url,
                int *out_item_id,
                char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (seller_id <= 0 || room_id <= 0) {
        snprintf(errMsg, errSize, "Invalid user or room");
        return 0;
    }
    if (!name || name[0] == '\0') {
        snprintf(errMsg, errSize, "Item name is empty");
        return 0;
    }
    if (start_price <= 0) {
        snprintf(errMsg, errSize, "Start price must be > 0");
        return 0;
    }
    if (buy_now_price > 0 && buy_now_price < start_price) {
        snprintf(errMsg, errSize, "Buy-now price must be >= start price");
        return 0;
    }

    char query[2048];
    MYSQL_RES *res;
    MYSQL_ROW row;

    snprintf(query, sizeof(query),
             "SELECT status FROM rooms WHERE id = %d", room_id);
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
    if (!row) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "Room not found");
        return 0;
    }
    {
        int room_status = atoi(row[0]);
        mysql_free_result(res);
        if (room_status != 1) { 
            snprintf(errMsg, errSize, "Room is not open");
            return 0;
        }
    }

    int next_order = 1;
    snprintf(query, sizeof(query),
             "SELECT COALESCE(MAX(queue_order), 0) + 1 "
             "FROM items WHERE room_id = %d",
             room_id);
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
    if (row && row[0]) {
        next_order = atoi(row[0]);
        if (next_order <= 0) next_order = 1;
    }
    mysql_free_result(res);

    char nameEsc[512];
    char imgEsc[512];
    
    escape_string(conn, name, nameEsc, sizeof(nameEsc));

    if (image_url && image_url[0]) {
        escape_string(conn, image_url, imgEsc, sizeof(imgEsc));
    } else {
        imgEsc[0] = '\0';
    }

    if (buy_now_price > 0) {
        snprintf(query, sizeof(query),
                 "INSERT INTO items("
                 "room_id, seller_id, name, description, "
                 "start_price, buy_now_price, "
                 "auction_start, auction_end, "
                 "queue_order, status, winner_id, final_price, created_at"
                 ") VALUES("
                 "%d, %d, '%s', '%s', "
                 "%lld, %lld, "
                 "NULL, NULL, "
                 "%d, 'WAIT', NULL, NULL, NOW())",
                 room_id, seller_id, nameEsc, imgEsc,
                 start_price, buy_now_price,
                 next_order);
    } else {
        snprintf(query, sizeof(query),
                 "INSERT INTO items("
                 "room_id, seller_id, name, description, "
                 "start_price, buy_now_price, "
                 "auction_start, auction_end, "
                 "queue_order, status, winner_id, final_price, created_at"
                 ") VALUES("
                 "%d, %d, '%s', '%s', "
                 "%lld, NULL, "
                 "NULL, NULL, "
                 "%d, 'WAIT', NULL, NULL, NOW())",
                 room_id, seller_id, nameEsc, imgEsc,
                 start_price,
                 next_order);
    }

    printf("DEBUG SQL (len=%zu): %s\n", strlen(query), query);

    int ret = 0;
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        ret = 0;
    } else {
        int item_id = (int)mysql_insert_id(conn);
        if (out_item_id) *out_item_id = item_id;
        ret = 1;
    }
    
    return ret;
}

int item_list_by_room(int room_id,
                      char *out_buf, size_t buf_size,
                      char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (buf_size == 0) {
        snprintf(errMsg, errSize, "Buffer too small");
        return 0;
    }

    char query[1024];

    if (room_id > 0) {
        snprintf(query, sizeof(query),
                 "SELECT i.id, i.room_id, i.seller_id, i.name, "
                 "       i.start_price, COALESCE(i.buy_now_price, 0), "
                 "       i.status, i.queue_order, "
                 "       i.auction_start, i.auction_end, i.description, "
                 "       COALESCE(u.username, 'Unknown'), "
                 "       COALESCE(i.final_price, 0) "
                 "FROM items i "
                 "LEFT JOIN users u ON i.seller_id = u.id "
                 "WHERE i.room_id = %d "
                 "ORDER BY i.queue_order ASC, i.id ASC",
                 room_id);
    } else {
        snprintf(query, sizeof(query),
                 "SELECT i.id, i.room_id, i.seller_id, i.name, "
                 "       i.start_price, COALESCE(i.buy_now_price, 0), "
                 "       i.status, i.queue_order, "
                 "       i.auction_start, i.auction_end, i.description, "
                 "       COALESCE(u.username, 'Unknown'), "
                 "       COALESCE(i.final_price, 0) "
                 "FROM items i "
                 "LEFT JOIN users u ON i.seller_id = u.id "
                 "ORDER BY i.room_id ASC, i.queue_order ASC, i.id ASC");
    }

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_RES *res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    out_buf[0] = '\0';
    size_t used = 0;
    MYSQL_ROW row;

    while ((row = mysql_fetch_row(res)) != NULL) {
        int id           = atoi(row[0]);
        int r_id         = atoi(row[1]);
        int seller_id    = atoi(row[2]);
        const char *name = row[3] ? row[3] : "";
        long long start_price = atoll(row[4]);
        long long buy_now     = atoll(row[5]);   
        const char *status    = row[6] ? row[6] : "WAIT";
        int queue_order       = atoi(row[7]);
        const char *auction_start = row[8] ? row[8] : "NULL";
        const char *auction_end   = row[9] ? row[9] : "NULL";
        const char *image_url     = row[10] ? row[10] : "";
        const char *seller_name   = row[11] ? row[11] : "Unknown";
        long long final_price = atoll(row[12]);

        long long display_price = start_price;
        if ((strcmp(status, "SOLD") == 0 || strcmp(status, "EXPIRED") == 0) && final_price > 0) {
            display_price = final_price;
        }

        char *line = (char*)malloc(7 * 1024 * 1024); 
        if (!line) break; 
        
        snprintf(line, 7 * 1024 * 1024,
                 "ITEM %d %d %d %s %s %lld %lld %s %d %s %s %s\n",
                 id, r_id, seller_id, seller_name, name,
                 display_price, buy_now, status, queue_order,
                 auction_start, auction_end, 
                 (image_url[0] ? image_url : "NOIMG"));

        size_t len = strlen(line);
        if (used + len + 1 >= buf_size) {
            break;
        }

        memcpy(out_buf + used, line, len);
        used += len;
        out_buf[used] = '\0';
        free(line);
    }

    mysql_free_result(res);

    if (used == 0) {
        const char *msg = "NO_ITEMS\n";
        strncpy(out_buf, msg, buf_size - 1);
        out_buf[buf_size - 1] = '\0';
    }

    return 1;
}

int item_delete(int user_id, int item_id,
                char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (user_id <= 0 || item_id <= 0) {
        snprintf(errMsg, errSize, "Invalid user or item");
        return 0;
    }

    char query[512];

    snprintf(query, sizeof(query),
             "SELECT i.seller_id, i.status, r.owner_id "
             "FROM items i "
             "JOIN rooms r ON i.room_id = r.id "
             "WHERE i.id = %d",
             item_id);

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
        snprintf(errMsg, errSize, "Item not found");
        return 0;
    }

    int seller_id = atoi(row[0]);
    const char *status = row[1] ? row[1] : "WAIT";
    int owner_id  = atoi(row[2]);
    mysql_free_result(res);

    if (user_id != seller_id && user_id != owner_id) {
        snprintf(errMsg, errSize, "Not allowed to delete this item");
        return 0;
    }

    if (strcmp(status, "WAIT") != 0) {
        snprintf(errMsg, errSize, "Item already started or finished");
        return 0;
    }

    snprintf(query, sizeof(query),
             "DELETE FROM items WHERE id = %d", item_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    return 1;
}

int item_search(const char *keyword,
                char *out_buf, size_t buf_size,
                char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (buf_size == 0) {
        snprintf(errMsg, errSize, "Buffer too small");
        return 0;
    }

    if (!keyword || keyword[0] == '\0') {
        snprintf(errMsg, errSize, "Keyword is empty");
        return 0;
    }

    char kwEsc[256];
    char pattern[300];
    char query[1024];

    escape_string(conn, keyword, kwEsc, sizeof(kwEsc));
    snprintf(pattern, sizeof(pattern), "%%%s%%", kwEsc);

    snprintf(query, sizeof(query),
             "SELECT id, room_id, seller_id, name, "
             "       start_price, COALESCE(buy_now_price, 0), "
             "       status, queue_order, auction_start, auction_end "
             "FROM items "
             "WHERE name LIKE '%s' "
             "ORDER BY auction_start IS NULL, auction_start ASC",
             pattern);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_RES *res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    out_buf[0] = '\0';
    size_t used = 0;
    MYSQL_ROW row;

    while ((row = mysql_fetch_row(res)) != NULL) {
        int id           = atoi(row[0]);
        int room_id      = atoi(row[1]);
        int seller_id    = atoi(row[2]);
        const char *name = row[3] ? row[3] : "";
        long long start_price = atoll(row[4]);
        long long buy_now     = atoll(row[5]);
        const char *status    = row[6] ? row[6] : "WAIT";
        int queue_order       = atoi(row[7]);
        const char *auction_start = row[8] ? row[8] : "NULL";
        const char *auction_end   = row[9] ? row[9] : "NULL";

        char line[512];
        snprintf(line, sizeof(line),
                 "ITEM %d %d %d %s %lld %lld %s %d %s %s\n",
                 id, room_id, seller_id, name,
                 start_price, buy_now, status, queue_order,
                 auction_start, auction_end);

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
        const char *msg = "NO_ITEMS\n";
        strncpy(out_buf, msg, buf_size - 1);
        out_buf[buf_size - 1] = '\0';
    }

    return 1;
}

int item_search_time(const char *from_time, const char *to_time,
                     char *out_buf, size_t buf_size,
                     char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (!from_time || !to_time || !from_time[0] || !to_time[0]) {
        snprintf(errMsg, errSize, "Invalid time range");
        return 0;
    }
    if (buf_size == 0) {
        snprintf(errMsg, errSize, "Buffer too small");
        return 0;
    }

    char query[1024];

    snprintf(query, sizeof(query),
             "SELECT id, room_id, seller_id, name, "
             "       start_price, COALESCE(buy_now_price, 0), "
             "       status, queue_order, "
             "       auction_start, auction_end "
             "FROM items "
             "WHERE auction_start IS NOT NULL "
             "  AND auction_start >= '%s' "
             "  AND auction_start <= '%s' "
             "ORDER BY auction_start ASC",
             from_time, to_time);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_RES *res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    out_buf[0] = '\0';
    size_t used = 0;
    MYSQL_ROW row;

    while ((row = mysql_fetch_row(res)) != NULL) {
        int id           = atoi(row[0]);
        int room_id      = atoi(row[1]);
        int seller_id    = atoi(row[2]);
        const char *name = row[3] ? row[3] : "";
        long long start_price = atoll(row[4]);
        long long buy_now     = atoll(row[5]);
        const char *status    = row[6] ? row[6] : "WAIT";
        int queue_order       = atoi(row[7]);
        const char *auction_start = row[8] ? row[8] : "NULL";
        const char *auction_end   = row[9] ? row[9] : "NULL";

        char line[512];
        snprintf(line, sizeof(line),
                 "ITEM_TIME %d %d %d %s %lld %lld %s %d %s %s\n",
                 id, room_id, seller_id, name,
                 start_price, buy_now, status, queue_order,
                 auction_start, auction_end);

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
        const char *msg = "NO_ITEMS\n";
        strncpy(out_buf, msg, buf_size - 1);
        out_buf[buf_size - 1] = '\0';
    }

    return 1;
}
