#ifndef ITEM_H
#define ITEM_H

#include <stddef.h> // size_t

// Tạo vật phẩm đấu giá mới
// - seller_id: user tạo item
// - room_id: phòng chứa item
// - name: tên item (tạm 1 từ, không dấu cách để dễ gõ lệnh)
// - start_price, buy_now_price: giá (VND), dùng long long cho BIGINT
// - image_url: URL hình ảnh (lưu vào description)
// - out_item_id: trả về id item mới
int item_create(int seller_id, int room_id, const char *name,
                long long start_price, long long buy_now_price,
                const char *image_url,
                int *out_item_id,
                char *errMsg, size_t errSize);

// Liệt kê item trong 1 phòng
// room_id > 0  => chỉ item của phòng đó
// room_id == 0 => tất cả item của mọi phòng
// out_buf: nhiều dòng dạng:
//   ITEM id room_id seller_id name start_price buy_now_price status queue_order auction_start auction_end
// (auction_start/end có thể là "NULL")
int item_list_by_room(int room_id,
                      char *out_buf, size_t buf_size,
                      char *errMsg, size_t errSize);

// Xoá item (chỉ seller hoặc chủ phòng, và chỉ khi status='WAIT')
int item_delete(int user_id, int item_id,
                char *errMsg, size_t errSize);

// Tìm kiếm item theo tên (LIKE %keyword%) trên TOÀN HỆ THỐNG
// out_buf: nhiều dòng giống LIST_ITEMS
int item_search(const char *keyword,
                char *out_buf, size_t buf_size,
                char *errMsg, size_t errSize);

// Tìm kiếm item theo KHUNG GIỜ đấu giá trên TOÀN HỆ THỐNG
// from_time, to_time: "YYYY-MM-DD HH:MM:SS"
// out_buf: mỗi dòng:
//   ITEM_TIME id room_id seller_id name start_price buy_now_price status queue_order auction_start auction_end
int item_search_time(const char *from_time, const char *to_time,
                     char *out_buf, size_t buf_size,
                     char *errMsg, size_t errSize);

#endif

