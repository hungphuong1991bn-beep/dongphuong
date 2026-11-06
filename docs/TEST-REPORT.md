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
- Đồng bộ chéo thiết bị: chỉ trên Firebase giả lập (xem §5).

## 5. Độ ổn định đồng bộ A↔B (`tests/e2e/sync-stress.js`, 40 vòng, hai thiết bị luân phiên thêm đơn)
| | Đạt | Lỗi |
|---|---:|---:|
| Bản gốc (đối chứng, lượt trong `run-all`) | 34/40 | 6 |
| Bản đã sửa | 40/40 | 0 |
Thêm hai lượt riêng trên bản đã sửa: 40/40 và 40/40. Phần kiểm chứng tĩnh chạy với ngoại lệ có chủ đích trong `tools/refactor/patches.json` (1146 khối trùng nguyên văn, 3 khối sửa/thêm).

## 6. Giai đoạn 3–5 — những gì đã và CHƯA kiểm (cập nhật)
**Đã chạy** (`node tests/static/*.js`; kết quả đạt):
- `verify-sw.js`: 178 tài nguyên khớp `index.html`. `trace-engine.test.js`: 17 ca. Cú pháp mọi file `src/**/*.js`: 0 lỗi (`node --check`).
- `phase3-insight.test.js` (14 nhóm) và `phase4-notif-tv.test.js` (8 nhóm), chạy bằng **jsdom, không phải trình duyệt thật**. Mã THẬT của utils, dashboard-factory, các file `*-insight`, `trace-export`, `tv-wakelock`, và hàm `renderNotifList` đọc nguyên từ file. Hàm render gốc của các tab (renderDorDang, renderKeHoach, renderSoLieu, trRun) được **thay bằng hàm giả** chỉ ghi `#mc`. Nên các bài này kiểm logic đếm/ghép, escape, CSV, wake lock và tính chỉ-đọc, **không** kiểm bố cục thật.
- Đối chứng: bản `renderNotifList` cũ không qua bài kiểm thử; bản vá qua.

**CHƯA chạy / chưa kiểm** (môi trường này không tải được Chromium nên không chạy Playwright):
- `tests/e2e/*` (so sánh giao diện trước/sau, chức năng, đồng bộ) **chưa chạy lại** sau các thay đổi Giai đoạn 3–5. Kết quả "160 mục, KHÁC 0" ở §2 là của Giai đoạn 1 và **không còn áp dụng** cho các tab Đơn hàng, Kế hoạch, Sổ liệu, Truy xuất (có thêm dải mới) và panel thông báo (đổi HTML).
- Hiển thị thật của các dải mới trên desktop/tablet/mobile; TV Mode thật; wake lock trên TV/Android/Electron thật.
- `tools/refactor/verify.js` (so khối mã với bản gốc) cần thư mục baseline không có trong gói; chưa chạy.
- Build Android/Windows; Firebase thật (như §4).

