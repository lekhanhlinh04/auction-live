#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <mysql.h>

#include "db.h"
#include "user.h"

// escape string để ghép vào SQL
static void escape_string(MYSQL *conn, const char *src,
                          char *dst, size_t dstSize) {
    unsigned long len = (unsigned long)strlen(src);
    if (dstSize < 2 * len + 1) {
        // nếu buffer quá nhỏ thì thôi 
        strncpy(dst, src, dstSize - 1);
        dst[dstSize - 1] = '\0';
        return;
    }
    mysql_real_escape_string(conn, dst, src, len);
}

int user_register(const char *username, const char *password,
                  int *out_user_id,
                  char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return 0;
    }

    char uEsc[256], pEsc[256], query[1024];
    escape_string(conn, username, uEsc, sizeof(uEsc));
    escape_string(conn, password, pEsc, sizeof(pEsc));

    // kiểm tra trùng username
    snprintf(query, sizeof(query),
             "SELECT id FROM users WHERE username = '%s' LIMIT 1", uEsc);
    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_RES *res = mysql_store_result(conn);
    if (res == NULL) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    MYSQL_ROW row = mysql_fetch_row(res);
    if (row != NULL) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "Username already exists");
        return 0;
    }
    mysql_free_result(res);

    // chèn user mới
    snprintf(query, sizeof(query),
             "INSERT INTO users(username, password_hash, full_name) "
             "VALUES('%s', '%s', NULL)", uEsc, pEsc);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return 0;
    }

    int new_id = (int)mysql_insert_id(conn);
    if (out_user_id) *out_user_id = new_id;
    return 1;
}

int user_login(const char *username, const char *password,
               int *out_user_id,
               char *errMsg, size_t errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errMsg, errSize, "DB not initialized");
        return -1;
    }

    char uEsc[256], query[512];
    escape_string(conn, username, uEsc, sizeof(uEsc));

    snprintf(query, sizeof(query),
             "SELECT id, password_hash FROM users "
             "WHERE username = '%s' LIMIT 1", uEsc);

    if (mysql_query(conn, query) != 0) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return -1;
    }

    MYSQL_RES *res = mysql_store_result(conn);
    if (res == NULL) {
        snprintf(errMsg, errSize, "DB error: %s", mysql_error(conn));
        return -1;
    }

    MYSQL_ROW row = mysql_fetch_row(res);
    if (row == NULL) {
        mysql_free_result(res);
        snprintf(errMsg, errSize, "User not found");
        return 0;
    }

    int id = atoi(row[0]);
    const char *db_pass = row[1];

    int ok = 0;
    if (strcmp(db_pass, password) == 0) {
        ok = 1;
        if (out_user_id) *out_user_id = id;
    } else {
        snprintf(errMsg, errSize, "Wrong password");
    }

    mysql_free_result(res);
    return ok;
}

// Lấy thống kê đấu giá của user
int user_get_stats(int user_id,
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
    MYSQL_RES *res;
    MYSQL_ROW row;

    out_buf[0] = '\0';
    size_t used = 0;

    // 1. Tổng số phiên đã tham gia (có đặt giá)
    snprintf(query, sizeof(query),
        "SELECT COUNT(DISTINCT item_id) FROM bids WHERE user_id = %d", user_id);
    mysql_query(conn, query);
    res = mysql_store_result(conn);
    int auctions_joined = 0;
    if (res && (row = mysql_fetch_row(res))) {
        auctions_joined = atoi(row[0]);
    }
    if (res) mysql_free_result(res);

    // 2. Số phiên thắng
    snprintf(query, sizeof(query),
        "SELECT COUNT(*) FROM items WHERE winner_id = %d", user_id);
    mysql_query(conn, query);
    res = mysql_store_result(conn);
    int auctions_won = 0;
    if (res && (row = mysql_fetch_row(res))) {
        auctions_won = atoi(row[0]);
    }
    if (res) mysql_free_result(res);

    // 3. Tổng tiền đã chi (mua được)
    snprintf(query, sizeof(query),
        "SELECT COALESCE(SUM(final_price), 0) FROM items WHERE winner_id = %d", user_id);
    mysql_query(conn, query);
    res = mysql_store_result(conn);
    long long total_spent = 0;
    if (res && (row = mysql_fetch_row(res))) {
        total_spent = atoll(row[0]);
    }
    if (res) mysql_free_result(res);

    // 4. Số vật phẩm đã bán
    snprintf(query, sizeof(query),
        "SELECT COUNT(*) FROM items WHERE seller_id = %d AND status = 'SOLD'", user_id);
    mysql_query(conn, query);
    res = mysql_store_result(conn);
    int items_sold = 0;
    if (res && (row = mysql_fetch_row(res))) {
        items_sold = atoi(row[0]);
    }
    if (res) mysql_free_result(res);

    // 5. Tổng tiền đã thu (bán được)
    snprintf(query, sizeof(query),
        "SELECT COALESCE(SUM(final_price), 0) FROM items WHERE seller_id = %d AND status = 'SOLD'", user_id);
    mysql_query(conn, query);
    res = mysql_store_result(conn);
    long long total_earned = 0;
    if (res && (row = mysql_fetch_row(res))) {
        total_earned = atoll(row[0]);
    }
    if (res) mysql_free_result(res);

    // Output: STATS joined won spent sold earned
    char line[256];
    snprintf(line, sizeof(line),
        "STATS %d %d %lld %d %lld\n",
        auctions_joined, auctions_won, total_spent, items_sold, total_earned);

    size_t len = strlen(line);
    if (len < buf_size) {
        strcpy(out_buf, line);
    }

    // 6. Danh sách vật phẩm đã thắng
    snprintf(query, sizeof(query),
        "SELECT id, name, final_price, auction_end FROM items "
        "WHERE winner_id = %d ORDER BY auction_end DESC LIMIT 10", user_id);
    mysql_query(conn, query);
    res = mysql_store_result(conn);
    used = strlen(out_buf);
    while (res && (row = mysql_fetch_row(res))) {
        char item_line[256];
        snprintf(item_line, sizeof(item_line),
            "WON %s %s %s %s\n",
            row[0], row[1] ? row[1] : "", row[2] ? row[2] : "0", row[3] ? row[3] : "");
        size_t item_len = strlen(item_line);
        if (used + item_len + 1 < buf_size) {
            strcat(out_buf, item_line);
            used += item_len;
        }
    }
    if (res) mysql_free_result(res);

    return 1;
}

// ============================================================
// Change password (by user_id)
// ============================================================
int user_change_password(int user_id, const char *old_pass,
                         const char *new_pass, char *errBuf, int errSize) {
    MYSQL *conn = db_get_conn();
    if (!conn) {
        snprintf(errBuf, errSize, "DB connection error");
        return 0;
    }

    char query[512];
    char oldEsc[100], newEsc[100];
    escape_string(conn, old_pass, oldEsc, sizeof(oldEsc));
    escape_string(conn, new_pass, newEsc, sizeof(newEsc));

    // 1. Verify old password
    snprintf(query, sizeof(query), 
             "SELECT id FROM users WHERE id=%d AND password_hash='%s'", 
             user_id, oldEsc);
    
    if (mysql_query(conn, query)) {
        snprintf(errBuf, errSize, "DB query error: %s", mysql_error(conn));
        return 0;
    }
    
    MYSQL_RES *res = mysql_store_result(conn);
    if (!res) {
        snprintf(errBuf, errSize, "Store result failed");
        return 0;
    }

    // Fixed implicit declaration by including prototype in mysql.h, or checking logic
    if (mysql_num_rows(res) == 0) {
        mysql_free_result(res);
        snprintf(errBuf, errSize, "Mật khẩu cũ không chính xác");
        return 0;
    }
    mysql_free_result(res);

    // 2. Update new password
    snprintf(query, sizeof(query),
             "UPDATE users SET password_hash='%s' WHERE id=%d",
             newEsc, user_id);

    if (mysql_query(conn, query)) {
        snprintf(errBuf, errSize, "Update failed: %s", mysql_error(conn));
        return 0;
    }

    return 1; // Success
}
