# KNOWN-ISSUES

## Có từ trước (giữ nguyên, không sửa theo quy tắc đặc tả)
(Không còn mục mở nào đã biết.)

## Đã xử lý
- Đồng bộ chéo thiết bị chập chờn (đơn vừa nhận bị ghi đè bởi bản đọc `/data` cũ): đã tái hiện bằng trace, nguyên nhân và cách sửa ở CHANGELOG.md. Bản gốc 34/40 vòng đạt (lỗi ~15%), bản đã sửa 40/40 và 80/80 ở hai lượt thử thêm. **Chỉ kiểm trên Firebase giả lập.** Cần theo dõi thêm trên Firebase thật: nhật ký thật (ETag/412, SSE) chưa có.
- Chưa kiểm chứng riêng: sự kiện bị bỏ khi máy nhận đang có lượt ghi dở (`_pendingSaves>0`). Trong các lượt thử không thấy gây mất đơn vì `endSave()` đọc lại sau 500ms, nhưng chưa có bài kiểm riêng.

## Sai khác so với đặc tả
- Không dùng ES modules; không có `event-bus.js`, `DataTable.js`; CSS chưa gom theo tokens/layout/components/responsive (xem ARCHITECTURE.md §3, §8).

## Mở sau Giai đoạn 5
- **Chưa rà soát chèn HTML không escape ở các nơi khác.** Chỉ `renderNotifList` được rà và sửa. Phần còn lại của mã dùng `innerHTML` với nội dung nối chuỗi ở nhiều file (ít nhất 12 file khớp mẫu một dòng; mẫu nhiều dòng chưa đếm) và `esc()` trong `helpers.js` chỉ thay `<` và `"` (không thay `&`, `'`, `>`). Dữ liệu như tên khách hàng, ghi chú đến từ người dùng và đồng bộ Firebase. Khuyến nghị rà từng tab trước khi cho nhiều người dùng bên ngoài nhập liệu.
- **Hiệu năng chưa đo.** Trang nạp 133 thẻ `<script src>` và 45 `<link rel=stylesheet>` đồng bộ (trước Giai đoạn 3–5: 127 và 44); chưa có số đo thời gian khởi động hay bộ nhớ trên thiết bị thật nên chưa thay đổi gì. `defer`/gộp file có thể làm đổi thứ tự thực thi (mã dựa vào `document.write` và phạm vi toàn cục), cần đo + chạy e2e trước.
- **e2e chưa chạy lại** sau Giai đoạn 3–5 (xem TEST-REPORT §6).
- Chỉ số "CHƯA CÓ DỮ LIỆU" ở Tổng quan (OEE, NG theo công đoạn, tồn nguyên liệu, thời gian chạy/dừng) vẫn thiếu nguồn dữ liệu — không phải lỗi mã.

## Chưa kiểm
- Build Android/Windows; Firebase thật (xem TEST-REPORT.md §4).
