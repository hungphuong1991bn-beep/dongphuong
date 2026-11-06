# HANDOVER — bàn giao Giai đoạn 3–5

## Gồm gì
Giai đoạn 3 (dải thông tin Đơn hàng / Kế hoạch / Sổ liệu, xuất CSV Truy xuất), Giai đoạn 4 (vá thông báo, giữ màn hình TV), Giai đoạn 5 (dọn bản sao thừa, kiểm thử, tài liệu). Chi tiết: `CHANGELOG.md`.

## Triển khai
Như `MIGRATION.md`: đẩy toàn bộ repo (gồm `index.html`, `src/`, `sw.js`) lên Pages. Service worker v7 tự thay cache cũ. Android/Windows nạp URL Pages nên nhận bản mới khi Pages cập nhật; không cần build lại.

## Gỡ nhanh nếu có sự cố
Mỗi tính năng Giai đoạn 3–4 độc lập: xoá dòng `<script src=…>` của nó trong `index.html` (`orders-insight`, `planning-insight`, `inventory-insight`, `trace-export`, `tv-wakelock`) là tab trở lại như cũ. Bản vá thông báo nằm trong `NotificationCenter.js` (hàm `renderNotifList`).

## Việc cần làm TRƯỚC khi dùng cho cả nhà máy
1. Chạy `bash tests/run-all.sh` trên máy có Playwright + Chromium (mục 2–4 chưa chạy lại sau thay đổi; mục 2 sẽ báo KHÁC ở các tab có dải mới và panel thông báo — đó là thay đổi có chủ đích, cần cập nhật ảnh gốc sau khi xem).
2. Mở thủ công: Đơn hàng, Kế hoạch, Sổ liệu (3 sổ), Truy xuất (tìm + xuất CSV), thông báo, TV Mode trên màn hình thật — ở desktop và điện thoại.
3. Đọc `KNOWN-ISSUES.md` mục "Mở sau Giai đoạn 5" (rà escape HTML các tab khác; hiệu năng chưa đo).
