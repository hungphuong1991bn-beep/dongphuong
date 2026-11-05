# KNOWN-ISSUES

## Có từ trước (giữ nguyên, không sửa theo quy tắc đặc tả)
(Không còn mục mở nào đã biết.)

## Đã xử lý
- Đồng bộ chéo thiết bị chập chờn (đơn vừa nhận bị ghi đè bởi bản đọc `/data` cũ): đã tái hiện bằng trace, nguyên nhân và cách sửa ở CHANGELOG.md. Bản gốc 34/40 vòng đạt (lỗi ~15%), bản đã sửa 40/40 và 80/80 ở hai lượt thử thêm. **Chỉ kiểm trên Firebase giả lập.** Cần theo dõi thêm trên Firebase thật: nhật ký thật (ETag/412, SSE) chưa có.
- Chưa kiểm chứng riêng: sự kiện bị bỏ khi máy nhận đang có lượt ghi dở (`_pendingSaves>0`). Trong các lượt thử không thấy gây mất đơn vì `endSave()` đọc lại sau 500ms, nhưng chưa có bài kiểm riêng.

## Sai khác so với đặc tả
- Không dùng ES modules; không có `event-bus.js`, `DataTable.js`; CSS chưa gom theo tokens/layout/components/responsive (xem ARCHITECTURE.md §3, §8).

## Chưa kiểm
- Build Android/Windows; Firebase thật (xem TEST-REPORT.md §4).
