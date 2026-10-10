# Tiệm Nhà Mình

Game quản lý tiệm tạp hóa Việt Nam trên trình duyệt, chơi một người hoặc hai người trên cùng máy. Chuẩn bị hàng, mở cửa, phục vụ khách và phát triển tiệm qua nhiều ngày.

Sử dụng TypeScript, Phaser 3, Three.js và Vite. Hình ảnh 3D được tạo bằng code; trình duyệt không hỗ trợ WebGL 2 dùng giao diện 2D dự phòng.

## Cài đặt và chạy

Yêu cầu **Node.js 22.12 trở lên** và npm.

```bash
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong Terminal. Không cần backend, tài khoản hay biến môi trường.

## Cách chơi

1. Chọn chơi một hoặc hai người. Mỗi ngày bắt đầu ở giai đoạn chuẩn bị.
2. Lấy hàng trong kho và xếp lên đúng kệ. Khi cần nhập thêm, đặt hàng tại bàn nhà cung cấp.
3. Xe giao hàng đến ngoài cửa: lấy thùng, mang tới **NHẬN HÀNG** để mở và nhập kho.
4. Tương tác tại cửa để mở tiệm. Khách tự chọn hàng, lấy từ kệ và xếp hàng thanh toán.
5. Đến quầy thu ngân để tính tiền. Doanh thu góp vào mục tiêu ngày; chi phí được ghi riêng.
6. Hết giờ, phục vụ nốt khách còn lại rồi xem tổng kết và sang ngày tiếp theo. Tiền và hàng tồn được giữ lại.

Trong **Quản lý**, bạn có thể thuê nhân viên, phân công công việc, đổi vị trí kệ, mở rộng và trang trí tiệm. Nhân viên nhận lương theo ngày; hàng có hạn dùng và sàn cần được dọn. Mua nâng cấp trong giai đoạn chuẩn bị.

## Điều khiển

| Thao tác | P1 | P2 |
| --- | --- | --- |
| Di chuyển | WASD | Phím mũi tên |
| Tương tác | E | Enter |
| Thả / nhặt hàng | F | / |
| Chạy nhanh | Shift trái | Shift phải |

- **C**: đổi camera góc xiên / thứ nhất / thứ ba trong chế độ một người.
- **Giữ chuột phải và kéo**: nhìn quanh trong góc thứ nhất / thứ ba.
- Hai người dùng chung camera góc xiên, tiền và kho; mỗi người giữ hàng riêng.
- Các bảng đặt hàng, quản lý, nâng cấp và cài đặt dùng chuột, tạm dừng mô phỏng cho cả hai người.
- **Esc**: đóng bảng đang mở hoặc về menu.

## Lưu và cài đặt

Tiến trình tự lưu định kỳ, khi về menu và khi rời trang. Bạn cũng có thể chọn **Lưu tiệm**, sau đó **Tiếp tục** ở menu. Dữ liệu nằm trong trình duyệt hiện tại; xóa dữ liệu trình duyệt sẽ xóa bản lưu. Khách chưa thanh toán không được khôi phục, hàng trong giỏ của họ được trả vào kho của bản lưu.

Mở **Tiệm mới** khi đã có bản lưu cần xác nhận thay thế tiến trình cũ. Nếu lưu thất bại, game hiện cảnh báo có thể bấm để thử lại và giữ bạn ở tiệm khi chọn về menu.

**Cài đặt** có âm thanh, âm lượng, độ nhạy camera và giảm chuyển động. Âm thanh được tổng hợp tại chỗ, không cần tải tài nguyên ngoài.

## Phát triển

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

Tests dùng test runner tích hợp của Node.js. Build xuất ra `dist/`; cấu hình triển khai Vercel nằm trong `vercel.json`.

```text
src/game/
  scenes/                 Khởi tạo, menu và điều phối tiệm
  entities/, components/  Nhân vật, đồ vật và điều khiển
  products/, inventory/   Sản phẩm và tồn kho
  customers/, navigation/ AI và A* trên lưới
  checkout/, economy/     Thanh toán, giao dịch và thống kê
  supplier/, operations/  Đặt hàng, giao nhận và vận hành
  day/, employees/        Chu kỳ ngày và nhân viên
  persistence/, settings/ Lưu tiến trình và tùy chọn
  presentation/, ui/      Hình ảnh 2D/3D và giao diện
  world/, config/         Bản đồ và cấu hình
tests/                    Kiểm thử domain và presentation logic
```

Quy tắc đóng góp nằm trong [AGENTS.md](AGENTS.md). Cấu hình và checklist kiểm tra trình duyệt nằm trong [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Giới hạn

Hình ảnh và âm thanh vẫn là tài nguyên tạo bằng code. Chưa hỗ trợ chơi online hoặc điều khiển di động. Tests không thay thế việc kiểm tra camera, bố cục và gameplay trong trình duyệt.

## Giấy phép

Dự án chưa chọn giấy phép phân phối.
