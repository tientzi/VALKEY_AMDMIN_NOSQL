# MiniMart Valkey NoSQL

Ứng dụng bán hàng và quản trị siêu thị dùng **Valkey làm cơ sở dữ liệu duy nhất**. Backend là Node.js/Express, giao diện React/Vite; không cần SQL Server, MySQL, Java hay Maven.

## Chạy nhanh trên Windows

1. Cài và mở Docker Desktop.
2. Mở PowerShell trong thư mục project.
3. Chạy `docker compose up --build`.
4. Mở website tại <http://localhost:13000> và Valkey Admin tại <http://localhost:18080>.

Có thể nhấp đúp `run.bat` thay cho bước 3. Xem hướng dẫn chi tiết trong `HUONG_DAN_CHAY.md`.

## Tài khoản mẫu

| Vai trò | Tài khoản | Mật khẩu |
|---|---|---|
| Admin | `admin` | `pass1234` |
| Khách hàng | `user1` | `pass1234` |
| Shipper | `shipper1` | `pass1234` |

## Thành phần

- `backend/`: API Express, worker Valkey Stream, Firebase Admin.
- `frontend/`: mã nguồn React/Vite.
- `dist/`: giao diện production đã build.
- `uploads/`: ảnh sản phẩm và danh mục.
- `docker-compose.yml`: Valkey, backend và Valkey Admin.
- `THIET_KE_CSDL_VALKEY.md`: mô hình key NoSQL.

## Tính năng chính

- Đăng nhập mật khẩu và Google Firebase.
- Giỏ hàng hiển thị ảnh và tồn kho theo thời gian thực.
- Đặt hàng chống trùng, kiểm tra và giữ tồn kho bằng Valkey Lua/Stream.
- VietQR động theo đúng ngân hàng, tài khoản, số tiền và nội dung mã đơn.
- Voucher toàn đơn hoặc riêng từng danh mục.
- Hạng Đồng/Bạc/Vàng/Kim Cương tự động giảm 0%/2%/5%/8%.
- Quản lý đơn, thanh toán, kho, phiếu nhập, lô hàng và kiểm định QC.
- Phản hồi khách hàng, đánh giá chờ duyệt và chatbot hỗ trợ.
- Báo cáo doanh thu, sản phẩm bán chạy, trạng thái đơn và phương thức thanh toán.

## Lưu ý Firebase

File `backend/firebase-service-account.json` chỉ phục vụ chạy local. Không đăng file này lên GitHub hoặc chia sẻ công khai. Khi triển khai thật, dùng secret/biến môi trường và thay khóa nếu khóa đã bị lộ.
