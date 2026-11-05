# ARCHITECTURE — Kiến trúc sau tái cấu trúc (v2.5.141, nhánh `refactor/modular`)

## 1. Trước và sau
| | Trước | Sau |
|---|---|---|
| Cấu trúc | 1 file `index.html` ~25.6k dòng (CSS + HTML + JS + thư viện QR) | `index.html` ~230KB (head + khung trang) + `src/` (~123 file JS, 40 file CSS) |
| JS | 1 `<script>` lớn, 864 hàm, 243 biến top-level | cùng mã, chia theo vai trò vào `src/{core,services,components,modules,utils}` |
| CSS | 2 khối `<style>` | 39 file liên tiếp + `production-dh4.css` (`#dh4-style`) |
| Firebase / auth / sync / quyền | — | **không đổi** |
| `electron-app/`, `android-app/`, `manifest.json`, `version.json` | — | **không đổi** |

## 2. Cây thư mục
```
index.html            khung trang, nạp CSS rồi JS theo thứ tự đã kiểm chứng
sw.js                 service worker (cache v3, liệt kê đủ 165 tài nguyên)
src/core/             hằng số, trạng thái, phân quyền, router, khởi động (app.js)
src/services/         firebase, storage, sync, sync-realtime, backup, notification, presence, traceability, update
src/components/       GlobalHeader, Sidebar, BottomNav, NotificationCenter, SetupScreens, shared/*
src/modules/<tab>/    mã nghiệp vụ theo tab (xem MODULES.md)
src/utils/            helpers, date, format, validation, lib-loader
src/styles/           CSS (39 đoạn liên tiếp + production-dh4.css)
src/vendor/qrcode.js  thư viện QR (nhúng nguyên văn)
src/assets/           brand-logo.js
tools/refactor/       manifest.js, build.js, verify.js, inventory.js
tests/                e2e (mock Firebase, capture, functional), static, run-all.sh
docs/                 tài liệu
```

## 3. Vì sao KHÔNG chuyển sang ES modules
Đặc tả cho phép dùng ES modules "nếu môi trường hỗ trợ". Mã gốc dựa vào phạm vi toàn cục:
- hàng trăm `onclick="..."` inline gọi thẳng hàm toàn cục;
- trạng thái dùng chung (`currentUser`, `DB`, …) khai báo bằng `let` ở top-level và được đọc/ghi từ nhiều khu vực;
- 864 hàm gọi chéo nhau, nhiều chỗ thực thi ngay khi nạp.

Chuyển sang ES modules đòi hỏi viết lại hàng nghìn chỗ tham chiếu (import/export, gắn `window.*`) — thay đổi hành vi không thể chứng minh bằng máy, trái nguyên tắc "bảo toàn ứng dụng hơn tốc độ tái cấu trúc". Do đó chọn **`<script src>` cổ điển, cùng phạm vi toàn cục**, nạp theo thứ tự đã kiểm chứng. Đây là bước đệm: mỗi file đã có ranh giới rõ, có thể nâng dần lên ES module từng module một sau này.

## 4. Cơ chế giữ nguyên giao diện
- **CSS**: chia thành các đoạn *liên tiếp*, nạp bằng `<link>` đúng thứ tự gốc → thứ tự cascade không đổi. Kiểm chứng: nối lại = CSS gốc từng ký tự; thứ tự luật trong CSSOM trùng khớp.
- **HTML (26 "slot" markup)**: mỗi đoạn markup (header, sidebar, modal…) nằm trong file JS dưới dạng `document.write(...)` và được nạp **đúng vị trí cũ trong DOM**. Nhờ đó DOM sinh ra giống hệt gốc (so sánh từng tab).
- **Thanh PWA** tách thành `PwaBar-open` / `brand-logo.js` / `PwaBar-close`.

## 5. Thứ tự nạp
1. `<head>`: meta/icon, jsPDF (CDN), `src/vendor/qrcode.js`, các `<link>` CSS.
2. Nạp trước (chỉ khai báo): `core/constants`, `core/embedded-assets`, `utils/helpers|date|format|validation`.
3. Thân trang: xen kẽ markup-slot và các `<script>` đúng vị trí gốc.
4. Mã nghiệp vụ theo thứ tự trong `index.html` (danh sách: `tools/refactor/.load-order.json`), kết thúc bằng `core/app.js` (khởi động ở `DOMContentLoaded`).

`tools/refactor/verify.js` chứng minh: (a) 1148 khối mã trùng nguyên văn gốc, (b) không phụ thuộc nào bị đảo thứ tự khi chạy-ngay (kể cả IIFE, callback đồng bộ như `map/forEach`, gọi gián tiếp), (c) thứ tự đăng ký 24 listener trên 13 cặp (target, sự kiện) được giữ, (d) không có `let/const` trùng giữa các file.

## 6. Service worker
JS/HTML/JSON/**CSS** dùng network-first (CSS trước đây nằm trong HTML nên phải thêm). `CACHE = sx-thanh-cai-v3`, danh sách `ASSETS` đủ 165 tài nguyên (kiểm bằng `tests/static/verify-sw.js`).

## 7. Android / Windows
Cả hai nạp URL GitHub Pages (`https://hungphuong1991bn-beep.github.io/dongphuong/`) nên đường dẫn tương đối `src/...` hoạt động; thư mục native **không bị sửa**.

## 8. Chưa làm / sai khác so với đặc tả
- Không dùng ES modules (§3).
- Không có `core/event-bus.js` và `components/shared/DataTable.js`: bản gốc không có thành phần tương ứng; theo quy tắc "không tạo module rỗng" nên không tạo.
- CSS chia theo đoạn liên tiếp, chưa gom lại thành tokens/layout/components/responsive (gom lại sẽ đổi thứ tự cascade).
