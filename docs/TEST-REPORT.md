# TEST-REPORT

Chạy bằng `bash tests/run-all.sh` (EXIT 0). Nhật ký gốc: `docs/test-run-log.txt`.
Môi trường: Playwright + Chromium, **Firebase giả lập cục bộ** (REST, ETag/412, SSE), đồng hồ cố định, `Math.random` có hạt giống. So sánh bản gốc (tag `baseline-v2.5.141`) với bản mới.

## 1. Kiểm chứng tĩnh — ĐẠT
- 1148 khối mã JS trùng từng ký tự với bản gốc; phần đuôi script khớp.
- 39 file CSS nối lại = CSS gốc (335.202 ký tự); `#dh4-style` khớp.
- 26 khối markup, script logo, thư viện QR khớp nguyên văn.
- 163 tham chiếu trong `index.html` đều tồn tại; không file nạp 2 lần; mọi file JS đều được nạp.
- Thứ tự nạp: 284 lệnh chạy-ngay, 283 phụ thuộc, không bị đảo; không có `let/const` trùng.
- 24 listener / 13 cặp giữ nguyên thứ tự đăng ký.
- `sw.js`: 165 tài nguyên khớp, CSS network-first.

## 2. Giao diện trước/sau — ĐẠT 160 mục, KHÁC 0
Đăng nhập, 17 tab (Tổng quan … Cài đặt), modal thêm đơn, panel thông báo ở 3 kích thước (desktop 1440, tablet 820, mobile 390): DOM, computed-style mọi phần tử (desktop), thứ tự luật CSSOM, ảnh chụp. Ảnh lệch lớn nhất **0,0441%** (ngưỡng 0,1%). Lỗi console: **0**; request Firebase ghi: trùng.

## 3. Chức năng & đồng bộ — trùng bản gốc
Đăng nhập; thêm/đổi trạng thái/tìm/xoá đơn (ghi đúng lên Firebase + nhật ký); đồng bộ 2 thiết bị (không trùng id, offline→online, sửa trùng bản ghi hội tụ, không mất bản ghi); sao lưu; thông báo; tạo QR; bật/tắt TV Mode; trang công khai (khuôn, nhân sự, chấm công) không cần đăng nhập. Lỗi JS: 0 ở mọi nhóm.

## 4. Chưa kiểm — nói rõ
- Build Android (Capacitor) và Windows (Electron) **chưa chạy** ở đây (không có toolchain/mạng); chỉ xác nhận thư mục native không đổi và chúng nạp URL GitHub Pages.
- **Chưa thử với Firebase thật** và dữ liệu thật; chỉ dùng mock.
- Chỉ kiểm các luồng nêu trên; các tab/nghiệp vụ khác được bảo đảm bằng việc mã chuyển nguyên văn + so sánh DOM/CSS, không phải bằng thao tác thủ công từng tính năng.
- Thăm dò đồng bộ 2 thiết bị đôi khi chập chờn ở **cả bản gốc lẫn bản mới** (xem KNOWN-ISSUES.md).
