#ifndef USER_H
#define USER_H

#include <stddef.h>  // size_t

// Đăng ký user mới
// return: 1 = thành công, 0 = lỗi (trùng tên / DB error)
//  - out_user_id: id user mới nếu thành công
//  - errMsg: thông báo lỗi (nếu có)
int user_register(const char *username, const char *password,
                  int *out_user_id,
                  char *errMsg, size_t errSize);

// Đăng nhập
// return: 1 = ok, 0 = sai user/pass, -1 = lỗi DB
//  - out_user_id: id user nếu thành công
int user_login(const char *username, const char *password,
               int *out_user_id,
               char *errMsg, size_t errSize);

// Lấy thống kê đấu giá của user
// Output format: STATS joined won spent sold earned\n
//                WON itemId name price date\n (multiple lines)
int user_get_stats(int user_id,
                   char *out_buf, size_t buf_size,
                   char *errMsg, size_t errSize);

int user_change_password(int user_id, const char *old_pass,
                         const char *new_pass, char *errBuf, int errSize);

#endif
