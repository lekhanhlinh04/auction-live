#ifndef ITEM_H
#define ITEM_H

#include <stddef.h> 

int item_create(int seller_id, int room_id, const char *name,
                long long start_price, long long buy_now_price,
                const char *image_url,
                int *out_item_id,
                char *errMsg, size_t errSize);

int item_list_by_room(int room_id,
                      char *out_buf, size_t buf_size,
                      char *errMsg, size_t errSize);

int item_delete(int user_id, int item_id,
                char *errMsg, size_t errSize);

int item_search(const char *keyword,
                char *out_buf, size_t buf_size,
                char *errMsg, size_t errSize);

int item_search_time(const char *from_time, const char *to_time,
                     char *out_buf, size_t buf_size,
                     char *errMsg, size_t errSize);

#endif

