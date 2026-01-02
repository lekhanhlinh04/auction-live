#ifndef ROOM_H
#define ROOM_H

#include <stddef.h> // size_t

// Tạo phòng mới. owner_id phải là user đã LOGIN.
// out_room_id: id phòng mới nếu thành công.
// errMsg: thông báo lỗi (nếu có).
// return: 1 = OK, 0 = lỗi.
int room_create(int owner_id, const char *name,
                int *out_room_id,
                char *errMsg, size_t errSize);

// Liệt kê tất cả phòng.
// out_buf: text nhiều dòng, mỗi dòng: "ROOM id name owner_id status\n"
// Nếu không có phòng nào -> "NO_ROOMS\n".
// return: 1 = OK, 0 = lỗi DB.
int room_list(char *out_buf, size_t buf_size,
              char *errMsg, size_t errSize);

// Tham gia phòng.
// Bảo đảm 1 user chỉ active trong 1 phòng tại 1 thời điểm
// (check room_members với left_at IS NULL trong DB).
// out_member_id: id bản ghi room_members mới nếu OK.
// return: 1 = OK, 0 = lỗi.
int room_join(int user_id, int room_id,
              int *out_member_id,
              char *errMsg, size_t errSize);

// Rời phòng.
// Cập nhật room_members.left_at = NOW() nếu còn đang ở phòng.
// return: 1 = OK, 0 = lỗi.
int room_leave(int user_id, int room_id,
               char *errMsg, size_t errSize);

// Đóng phòng (chỉ chủ phòng).
// - Kiểm tra owner_id == user_id
// - Set rooms.status = 0 (CLOSED)
// - Set left_at = NOW() cho tất cả room_members còn active của phòng.
// return: 1 = OK, 0 = lỗi.
int room_close(int user_id, int room_id,
               char *errMsg, size_t errSize);

#endif

