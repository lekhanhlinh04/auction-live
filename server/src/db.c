#include <stdio.h>
#include <string.h>
#include "db_config.h"
#include "db.h"

static MYSQL *g_db = NULL;

static void escape_string(MYSQL *conn, const char *src, char *dst, size_t dstSize);   

int db_init(void) {
    g_db = mysql_init(NULL);
    if (g_db == NULL) {
        printf("mysql_init() failed\n");
        return 0;
    }

    if (mysql_real_connect(
            g_db,
            DB_HOST,
            DB_USER,
            DB_PASS,
            DB_NAME,
            DB_PORT,
            NULL,
            0) == NULL) {

        printf("mysql_real_connect() failed: %s\n", mysql_error(g_db));
        mysql_close(g_db);
        g_db = NULL;
        return 0;
    }

    printf("Connected to MySQL database '%s'\n", DB_NAME);
    return 1;
}

void db_close(void) {
    if (g_db != NULL) {
        mysql_close(g_db);
        g_db = NULL;
    }
}

MYSQL *db_get_conn(void) {
    return g_db;
}

int log_activity(int user_id, const char *action, const char *details) {
    MYSQL *conn = db_get_conn();
    if (!conn) return 0;

    char query[1024];
    char aEsc[256], dEsc[512];
    escape_string(conn, action, aEsc, sizeof(aEsc));
    if (details) {
        escape_string(conn, details, dEsc, sizeof(dEsc));
    } else {
        dEsc[0] = '\0';
    }

    if (user_id > 0) {
        snprintf(query, sizeof(query),
                 "INSERT INTO activity_logs(user_id, action, details) VALUES(%d, '%s', '%s')",
                 user_id, aEsc, dEsc);
    } else {
        snprintf(query, sizeof(query),
                 "INSERT INTO activity_logs(action, details) VALUES('%s', '%s')",
                 aEsc, dEsc);
    }

    return mysql_query(conn, query) == 0;
}

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
