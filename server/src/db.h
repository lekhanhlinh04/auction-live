#ifndef DB_H
#define DB_H

#include <mysql.h>

int  db_init(void);
void db_close(void);

MYSQL *db_get_conn(void);

int log_activity(int user_id, const char *action, const char *details);

#endif
