#ifndef MYSQL_H
#define MYSQL_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stddef.h>

typedef struct st_mysql MYSQL;
typedef struct st_mysql_res MYSQL_RES;
typedef char **MYSQL_ROW;
typedef unsigned long my_ulonglong;

// MySQL connection functions
MYSQL *mysql_init(MYSQL *mysql);
MYSQL *mysql_real_connect(MYSQL *mysql, const char *host, const char *user,
                         const char *passwd, const char *db, unsigned int port,
                         const char *unix_socket, unsigned long client_flag);
void mysql_close(MYSQL *mysql);

// Query functions
int mysql_query(MYSQL *mysql, const char *q);
const char *mysql_error(MYSQL *mysql);
MYSQL_RES *mysql_store_result(MYSQL *mysql);
MYSQL_ROW mysql_fetch_row(MYSQL_RES *result);
void mysql_free_result(MYSQL_RES *result);

// String escaping
unsigned long mysql_real_escape_string(MYSQL *mysql, char *to, const char *from, unsigned long length);

// Other functions
my_ulonglong mysql_insert_id(MYSQL *mysql);
my_ulonglong mysql_affected_rows(MYSQL *mysql);
my_ulonglong mysql_num_rows(MYSQL_RES *res);

#ifdef __cplusplus
}
#endif

#endif /* MYSQL_H */


