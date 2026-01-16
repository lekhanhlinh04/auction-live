#ifndef ROOM_H
#define ROOM_H

#include <stddef.h> 

int room_create(int owner_id, const char *name,
                int *out_room_id,
                char *errMsg, size_t errSize);

int room_list(char *out_buf, size_t buf_size,
              char *errMsg, size_t errSize);

int room_join(int user_id, int room_id,
              int *out_member_id,
              char *errMsg, size_t errSize);

int room_leave(int user_id, int room_id,
               char *errMsg, size_t errSize);

int room_close(int user_id, int room_id,
               char *errMsg, size_t errSize);

int room_open(int user_id, int room_id,
              char *errMsg, size_t errSize);

int room_list_members(int room_id,
                      char *out_buf, size_t buf_size,
                      char *errMsg, size_t errSize);

#endif

