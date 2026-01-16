#ifndef USER_H
#define USER_H

#include <stddef.h>  

int user_register(const char *username, const char *password,
                  int *out_user_id,
                  char *errMsg, size_t errSize);

int user_login(const char *username, const char *password,
               int *out_user_id,
               char *errMsg, size_t errSize);

int user_get_stats(int user_id,
                   char *out_buf, size_t buf_size,
                   char *errMsg, size_t errSize);

int user_change_password(int user_id, const char *old_pass,
                         const char *new_pass, char *errBuf, int errSize);

#endif
