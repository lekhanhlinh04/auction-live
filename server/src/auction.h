#ifndef AUCTION_H
#define AUCTION_H

#include <stddef.h> // size_t

// Bắt đầu đấu giá
int auction_start(int user_id, int item_id, int duration_seconds,
                  int *out_room_id,
                  long long *out_start_price,
                  long long *out_buy_now_price,
                  int *out_seconds_left,
                  char *errMsg, size_t errSize);

// Đặt giá (BID)
int auction_bid(int user_id, int current_room_id,
                int item_id, long long bid_amount,
                long long *out_current_price,
                int *out_room_id,
                int *out_seconds_left,
                char *errMsg, size_t errSize);

// Mua ngay (BUY_NOW)
int auction_buy_now(int user_id, int item_id,
                    long long *out_final_price,
                    int *out_room_id,
                    char *errMsg, size_t errSize);

// Lấy danh sách item ONGOING đã hết hạn
int auction_get_finished_items(int *item_ids, int max_items);

// Kết thúc đấu giá nếu đã hết thời gian
int auction_finish_if_needed(int item_id,
                             int *out_room_id,
                             int *out_winner_id,
                             long long *out_final_price,
                             int *out_has_winner,
                             char *errMsg, size_t errSize);

#endif
