#ifndef DB_H
#define DB_H

#include <mysql.h>

// Khởi tạo / đóng kết nối DB
int  db_init(void);
void db_close(void);

// Lấy con trỏ kết nối để module khác dùng (user.c, room.c, ...)
MYSQL *db_get_conn(void);

// Ghi log hoạt động
int log_activity(int user_id, const char *action, const char *details);

#endif
