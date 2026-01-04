#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <mysql.h>

#include "db.h"
#include "auction.h"

// escape string để ghép vào SQL an toàn hơn
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

// ============ BẮT ĐẦU ĐẤU GIÁ ============

int auction_start(int user_id, int item_id, int duration_seconds,
                  int *out_room_id,
                  long long *out_start_price,
                  long long *out_buy_now_price,
                  int *out_seconds_left,
                  char *errMsg, size_t errSize) {

    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }

    if (user_id <= 0 || item_id <= 0) {
        snprintf(errMsg, errSize, "Invalid user or item id");
        return 0;
    }

    if (duration_seconds <= 0)
        duration_seconds = 120;

    char query[512];
    MYSQL_RES *res;
    MYSQL_ROW row;

    snprintf(query, sizeof(query),
        "SELECT i.room_id, i.seller_id, i.status, r.owner_id, "
        "       i.start_price, COALESCE(i.buy_now_price, 0) "
        "FROM items i "
        "JOIN rooms r ON i.room_id = r.id "
        "WHERE i.id = %d",
        item_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    res = mysql_store_result(conn);
    row = mysql_fetch_row(res);
    if (!row) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "Item not found");
        return 0;
    }

    int room_id = atoi(row[0]);
    int seller_id = atoi(row[1]);
    const char *status = row[2] ? row[2] : "WAIT";
    int owner_id = atoi(row[3]);
    long long start_price = atoll(row[4]);
    long long buy_now_price = atoll(row[5]);
    mysql_free_result(res);

    if (user_id != seller_id && user_id != owner_id) {
        snprintf(errMsg, errSize, "Not allowed to start auction");
        return 0;
    }

    if (strcmp(status, "WAIT") != 0) {
        snprintf(errMsg, errSize, "Item is not in WAIT status");
        return 0;
    }

    // SEQUENTIAL CHECK: Check if any item in this room is ONGOING
    // Mỗi phòng chỉ được 1 item ONGOING
    char checkQ[256];
    snprintf(checkQ, sizeof(checkQ), 
             "SELECT COUNT(*) FROM items WHERE room_id=%d AND status='ONGOING'", room_id);
    if (mysql_query(conn, checkQ) == 0) {
        MYSQL_RES *res2 = mysql_store_result(conn);
        if (res2) {
            MYSQL_ROW row2 = mysql_fetch_row(res2);
            if (row2 && atoi(row2[0]) > 0) {
                mysql_free_result(res2);
                snprintf(errMsg, errSize, "Phòng đang có phiên đấu giá (chờ kết thúc)");
                return 0; // REJECT
            }
            mysql_free_result(res2);
        }
    }

    //Bắt đầu đấu giá - giữ lại buy_now_price để có thể mua ngay
    snprintf(query, sizeof(query),
        "UPDATE items "
        "SET status='ONGOING', "
        "    auction_start = NOW(), "
        "    auction_end = DATE_ADD(NOW(), INTERVAL %d SECOND), "
        "    winner_id = NULL, "
        "    final_price = NULL "
        "WHERE id = %d",
        duration_seconds, item_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    if (out_room_id) *out_room_id = room_id;
    if (out_start_price) *out_start_price = start_price;
    if (out_buy_now_price) *out_buy_now_price = buy_now_price;
    if (out_seconds_left) *out_seconds_left = duration_seconds;

    return 1;
}

// ============ ĐẶT GIÁ (BID) ============

int auction_bid(int user_id, int current_room_id,
                int item_id, long long bid_amount,
                long long *out_current_price,
                int *out_room_id,
                int *out_seconds_left,
                char *errMsg, size_t errSize) {

    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }

    if (user_id <= 0 || item_id <= 0 || bid_amount <= 0) {
        snprintf(errMsg, errSize, "Invalid parameters");
        return 0;
    }

    char query[512];
    MYSQL_RES *res;
    MYSQL_ROW row;

    //Lấy thông tin item
    snprintf(query, sizeof(query),
        "SELECT room_id, status, start_price, "
        "TIMESTAMPDIFF(SECOND, NOW(), auction_end) "
        "FROM items WHERE id = %d",
        item_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error");
        return 0;
    }

    res = mysql_store_result(conn);
    row = mysql_fetch_row(res);
    if (!row) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "Item not found");
        return 0;
    }

    int room_id = atoi(row[0]);
    const char *status = row[1];
    long long start_price = atoll(row[2]);
    int seconds_left = atoi(row[3]);
    mysql_free_result(res);

    if (current_room_id > 0 && room_id != current_room_id) {
        snprintf(errMsg, errSize, "Wrong room");
        return 0;
    }

    if (strcmp(status, "ONGOING") != 0) {
        snprintf(errMsg, errSize, "Auction not ongoing");
        return 0;
    }

    if (seconds_left <= 0) {
        snprintf(errMsg, errSize, "Auction ended");
        return 0;
    }

    //Lấy giá hiện tại cao nhất
    snprintf(query, sizeof(query),
        "SELECT COALESCE(MAX(amount), 0) "
        "FROM bids WHERE item_id = %d",
        item_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error");
        return 0;
    }

    res = mysql_store_result(conn);
    row = mysql_fetch_row(res);

    long long current_price = start_price;
    if (row && row[0])
        current_price = atoll(row[0]);
    mysql_free_result(res);

    //Kiểm tra bước giá ≥ 10.000
    // Bid phải cao hơn giá hiện tại ít nhất 10,000 VNĐ
    long long min_bid = current_price + 10000;
    if (bid_amount < min_bid) {
        snprintf(errMsg, errSize, "Bid too low. Minimum bid: %lld (current: %lld + 10000)", 
                 min_bid, current_price);
        return 0;
    }

    //Ghi bid
    snprintf(query, sizeof(query),
        "INSERT INTO bids(item_id, user_id, amount, bid_time) "
        "VALUES(%d, %d, %lld, NOW())",
        item_id, user_id, bid_amount);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error");
        return 0;
    }

    //RESET 30s nếu bid trong 30s cuối
    if (seconds_left <= 30) {
        snprintf(query, sizeof(query),
            "UPDATE items "
            "SET auction_end = DATE_ADD(NOW(), INTERVAL 30 SECOND) "
            "WHERE id = %d",
            item_id);
        mysql_query(conn, query);
        seconds_left = 30;
    }

    if (out_current_price) *out_current_price = bid_amount;
    if (out_room_id) *out_room_id = room_id;
    if (out_seconds_left) *out_seconds_left = seconds_left;

    return 1;
}


// ============ MUA NGAY (BUY NOW) ============

int auction_buy_now(int user_id, int item_id,
                    long long *out_final_price,
                    int *out_room_id,
                    char *errMsg, size_t errSize) {

    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }

    char query[512];
    MYSQL_RES *res;
    MYSQL_ROW row;

    snprintf(query, sizeof(query),
        "SELECT room_id, status, COALESCE(buy_now_price, 0) "
        "FROM items WHERE id = %d",
        item_id);

    mysql_query(conn, query);
    res = mysql_store_result(conn);
    row = mysql_fetch_row(res);

    if (!row) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "Item not found");
        return 0;
    }

    int room_id = atoi(row[0]);
    const char *status = row[1];
    long long buy_now_price = atoll(row[2]);
    mysql_free_result(res);

    if (buy_now_price <= 0) {
        snprintf(errMsg, errSize, "No buy-now price");
        return 0;
    }

    // Cho phép mua ngay khi đang CHỜ hoặc ĐANG ĐẤU GIÁ
    if (strcmp(status, "WAIT") != 0 && strcmp(status, "ONGOING") != 0) {
        snprintf(errMsg, errSize, "Buy-now not available");
        return 0;
    }

    snprintf(query, sizeof(query),
        "UPDATE items SET status='SOLD', winner_id=%d, "
        "final_price=%lld, auction_end=NOW() WHERE id=%d",
        user_id, buy_now_price, item_id);

    mysql_query(conn, query);

    if (out_final_price) *out_final_price = buy_now_price;
    if (out_room_id) *out_room_id = room_id;

    return 1;
}

// ============ KẾT THÚC ĐẤU GIÁ ============

int auction_finish_if_needed(int item_id,
                             int *out_room_id,
                             int *out_winner_id,
                             long long *out_final_price,
                             int *out_has_winner,
                             char *errMsg, size_t errSize) {

    MYSQL *conn = db_get_conn();
    if (!conn) return 0;

    char query[512];
    MYSQL_RES *res;
    MYSQL_ROW row;

    snprintf(query, sizeof(query),
        "SELECT room_id, status, start_price, "
        "TIMESTAMPDIFF(SECOND, NOW(), auction_end) "
        "FROM items WHERE id = %d",
        item_id);

    mysql_query(conn, query);
    res = mysql_store_result(conn);
    row = mysql_fetch_row(res);

    if (!row) {
        mysql_free_result(res);
        return 0;
    }

    int room_id = atoi(row[0]);
    const char *status = row[1];
    long long start_price = atoll(row[2]);
    int sec_left = atoi(row[3]);
    mysql_free_result(res);

    if (strcmp(status, "ONGOING") != 0 || sec_left > 0)
        return 0;

    //lấy đúng winner
    snprintf(query, sizeof(query),
        "SELECT user_id, amount FROM bids "
        "WHERE item_id = %d "
        "ORDER BY amount DESC LIMIT 1",
        item_id);

    mysql_query(conn, query);
    res = mysql_store_result(conn);
    row = mysql_fetch_row(res);

    int winner_id = -1;
    long long final_price = start_price;

    if (row) {
        winner_id = atoi(row[0]);
        final_price = atoll(row[1]);
    }
    mysql_free_result(res);

    if (winner_id > 0) {
        snprintf(query, sizeof(query),
            "UPDATE items SET status='SOLD', "
            "winner_id=%d, final_price=%lld WHERE id=%d",
            winner_id, final_price, item_id);
    } else {
        snprintf(query, sizeof(query),
            "UPDATE items SET status='EXPIRED' WHERE id=%d",
            item_id);
    }

    mysql_query(conn, query);

    if (out_room_id) *out_room_id = room_id;
    if (out_winner_id) *out_winner_id = winner_id;
    if (out_final_price) *out_final_price = final_price;
    if (out_has_winner) *out_has_winner = (winner_id > 0);

    return 1;
}

int auction_get_finished_items(int *item_ids, int max_items) {
    MYSQL *conn = db_get_conn();
    if (!conn || !item_ids || max_items <= 0)
        return 0;

    char query[256];
    MYSQL_RES *res;
    MYSQL_ROW row;

    snprintf(query, sizeof(query),
        "SELECT id FROM items "
        "WHERE status='ONGOING' "
        "AND auction_end <= NOW() "
        "LIMIT %d",
        max_items);

    if (mysql_query(conn, query) != 0)
        return 0;

    res = mysql_store_result(conn);
    if (!res)
        return 0;

    int count = 0;
    while ((row = mysql_fetch_row(res)) && count < max_items) {
        item_ids[count++] = atoi(row[0]);
    }

    mysql_free_result(res);
    return count;
}

// ============ LẤY LỊCH SỬ ĐẤU GIÁ ============

int auction_list_bids(int item_id,
                      char *out_buf, size_t buf_size,
                      char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }
    if (item_id <= 0) {
        snprintf(errMsg, errSize, "Invalid item id");
        return 0;
    }
    if (buf_size == 0) {
        snprintf(errMsg, errSize, "Buffer too small");
        return 0;
    }

    char query[512];
    MYSQL_RES *res;
    MYSQL_ROW row;

    // Lấy 10 bid gần nhất, join với users để lấy username
    snprintf(query, sizeof(query),
        "SELECT b.user_id, COALESCE(u.username, 'Unknown'), b.amount, b.bid_time "
        "FROM bids b "
        "LEFT JOIN users u ON b.user_id = u.id "
        "WHERE b.item_id = %d "
        "ORDER BY b.amount DESC "
        "LIMIT 10",
        item_id);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    res = mysql_store_result(conn);
    if (!res) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    out_buf[0] = '\0';
    size_t used = 0;

    while ((row = mysql_fetch_row(res)) != NULL) {
        int user_id = atoi(row[0]);
        const char *username = row[1] ? row[1] : "Unknown";
        long long amount = atoll(row[2]);
        const char *bid_time = row[3] ? row[3] : "";

        // Format: BID_RECORD userId username amount time
        char line[256];
        snprintf(line, sizeof(line),
                 "BID_RECORD %d %s %lld %s\n",
                 user_id, username, amount, bid_time);

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
        const char *msg = "NO_BIDS\n";
        strncpy(out_buf, msg, buf_size - 1);
        out_buf[buf_size - 1] = '\0';
    }

    return 1;
}
