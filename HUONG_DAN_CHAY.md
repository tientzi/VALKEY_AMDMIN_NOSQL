# MiniMart Admin - Valkey NoSQL

Project này dùng **Valkey làm cơ sở dữ liệu duy nhất**. Không cần SQL Server, MySQL, Java hay Maven.

## Chạy trên Windows

1. Cài và mở Docker Desktop.
2. Mở thư mục project.
3. Nhấp đúp `run.bat` hoặc mở PowerShell tại thư mục project và chạy:

```powershell
docker compose up --build
```

4. Truy cập:
   - Website: http://localhost:13000
   - Valkey Admin: http://localhost:18080

## Tài khoản mẫu

| Vai trò | Tài khoản | Mật khẩu |
|---|---|---|
| Admin | `admin` | `pass1234` |
| Khách hàng | `user1` | `pass1234` |
| Shipper | `shipper1` | `pass1234` |

Trang đăng nhập còn hỗ trợ **Đăng nhập với Google** thông qua Firebase Authentication. Tài khoản Google lần đầu đăng nhập sẽ tự động được tạo trong Valkey với vai trò khách hàng.

## Xem dữ liệu thay đổi theo thời gian thực

Mở Valkey Admin tại http://localhost:18080 và bật chế độ tự động làm mới. Mọi thao tác thêm, sửa, xóa từ giao diện được ghi ngay vào Valkey. Stream `mm:realtime:events` lưu lịch sử thay đổi và kênh Pub/Sub `mm:realtime:changes` phát sự kiện tức thời.

Valkey Admin chỉ là công cụ quan sát nên nút tự làm mới thuộc giao diện của công cụ này. Dữ liệu ứng dụng vẫn được ghi vào Valkey ngay lập tức dù không mở Valkey Admin.

## Cấu hình nhận tiền VietQR

Đăng nhập Admin, mở **Thanh toán**, chọn **Chuyển khoản ngân hàng (VietQR)** và kiểm tra mã ngân hàng, số tài khoản, tên chủ tài khoản. Mã QR ở trang thanh toán được tạo động từ cấu hình này, số tiền cuối cùng của đơn và nội dung `MINIMART DH<mã đơn>`. Hệ thống không tự đánh dấu đã trả tiền; Admin phải đối chiếu giao dịch ngân hàng rồi nhấn duyệt.

## Dừng hoặc xóa dữ liệu mẫu

```powershell
docker compose down
docker compose down -v
```

Lệnh thứ hai xóa volume `valkey_data`; dữ liệu mẫu sẽ được tạo lại ở lần chạy tiếp theo.

## Chạy giao diện ở chế độ phát triển

Sau khi `docker compose up --build` đang chạy, có thể mở terminal khác:

```powershell
cd frontend
npm install
npm run dev
```

Giao diện dev chạy tại http://localhost:5173 và tự chuyển tiếp API sang backend tại cổng 3000 khi chạy backend trực tiếp. Khi chạy toàn bộ bằng Docker, dùng website tại cổng 13000.

