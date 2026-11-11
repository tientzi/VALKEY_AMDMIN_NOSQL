# Thiết kế cơ sở dữ liệu Valkey NoSQL

Ứng dụng không sử dụng bảng quan hệ và không có JDBC/JPA/SQL Server. Dữ liệu được mô hình hóa bằng các kiểu dữ liệu gốc của Valkey.

| Nhóm dữ liệu | Kiểu Valkey | Mẫu key | Mục đích |
|---|---|---|---|
| Người dùng | Hash, Set | `user:{id}`, `user:ids` | Hồ sơ, vai trò, điểm thành viên |
| Phiên đăng nhập | Hash + TTL | `session:{token}` | Xác thực và tự hết hạn |
| Sản phẩm | Hash, Set | `product:{id}`, `product:ids` | Danh mục hàng và tồn kho |
| Giỏ hàng | Hash | `cart:{userId}` | Ánh xạ mã sản phẩm sang số lượng |
| Đơn hàng | Hash, Set | `order:{id}`, `orders:status:{status}` | Nội dung đơn và chỉ mục trạng thái |
| Hàng đợi | Stream | `mm:queue:orders` | Worker xử lý đơn bất đồng bộ |
| Dead-letter | Stream | `mm:queue:orders:dead` | Lưu job lỗi để quan sát/thử lại |
| Trạng thái job | Hash, Set | `mm:job:{jobId}`, `mm:job:ids` | Tiến độ và lỗi của worker |
| Hạn thanh toán | Sorted Set | `mm:orders:payment_expiry` | Scheduler hủy đơn quá hạn |
| Nhật ký hoạt động | Stream | `mm:activity:logs` | Theo dõi sự kiện hệ thống |
| Đồng bộ thời gian thực | Pub/Sub, Stream | `mm:realtime:changes`, `mm:realtime:events` | Phát và lưu mọi thao tác ghi từ giao diện |
| Chống gửi trùng | String + TTL | `idempotency:{userId}:{key}` | Một yêu cầu checkout chỉ tạo một đơn |

## Luồng đặt hàng

1. API ghi đơn và job vào Valkey, sau đó đẩy job vào Stream.
2. Worker đọc Stream và chạy Lua script để kiểm tra rồi trừ tồn kho nguyên tử.
3. Đơn thanh toán trực tuyến được thêm vào Sorted Set theo thời điểm hết hạn.
4. Khi quá hạn, scheduler hủy đơn và hoàn kho nếu hàng đã được giữ.
5. Admin theo dõi Stream, job, DLQ, thời hạn thanh toán và nhật ký ngay trên giao diện cũ.

Mọi yêu cầu `POST`, `PUT`, `PATCH` và `DELETE` thành công đều được ghi trực tiếp vào Valkey, phát lên kênh `mm:realtime:changes` và lưu tại Stream `mm:realtime:events`. Trong Valkey Admin, bật tự động làm mới để theo dõi key thay đổi theo thời gian thực.

