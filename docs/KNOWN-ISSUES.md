# KNOWN-ISSUES

## Có từ trước (giữ nguyên, không sửa theo quy tắc đặc tả)
1. Đồng bộ chéo thiết bị đôi khi chập chờn trong thăm dò 2 thiết bị (xảy ra ở cả bản gốc và bản mới). Kết quả "A thấy trạng thái" chỉ ghi nhận, không dùng để so sánh. Cần điều tra riêng với Firebase thật.

## Sai khác so với đặc tả
- Không dùng ES modules; không có `event-bus.js`, `DataTable.js`; CSS chưa gom theo tokens/layout/components/responsive (xem ARCHITECTURE.md §3, §8).

## Chưa kiểm
- Build Android/Windows; Firebase thật (xem TEST-REPORT.md §4).
