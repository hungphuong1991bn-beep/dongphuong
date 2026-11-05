# DATA-FLOW — luồng dữ liệu (không đổi so với bản gốc)

Danh sách đường dẫn Firebase và khoá localStorage đầy đủ, kèm file tham chiếu: **`INVENTORY.md`** (sinh tự động).

## 1. Khởi động
`core/app.js` (DOMContentLoaded) → đọc cấu hình Firebase (`localStorage sx_fb_url` hoặc mặc định) → `services/firebase.js` → màn hình đăng nhập (`modules/auth`) → sau đăng nhập: tải dữ liệu, bật đồng bộ, hiển thị tab theo quyền (`core/permissions.js`, `core/router.js`).

## 2. Lưu trữ
- **Firebase Realtime Database** (REST): nút chính `/data/*` (orders, users, workers, khuonCatalog, khuonQty, lichLamViec, attendance, baoTri, nghiPhep, kyLuat, csTemplates, csData, qrProducts, nguyenLieuLog, mayRutLog, mayDanhBongLog, ordersTrash…), `/presence/`, `/backups/`.
- **localStorage**: bản sao cục bộ (offline) + cấu hình; xem INVENTORY.md.

## 3. Đồng bộ
1. Ghi: thao tác người dùng → cập nhật `DB` trong bộ nhớ → lưu localStorage → đẩy lên Firebase (đơn hàng dùng ETag/If-Match; 412 → gộp lại rồi thử lại, nên không mất bản ghi).
2. Nhận: SSE (`services/sync-realtime.js`) khi có; nếu SSE không dùng được → polling (`services/sync.js`). Gộp theo id/version.
3. Mất mạng: ghi vào hàng đợi cục bộ, tự gửi lại khi online (đã kiểm: B chưa thấy khi offline, nhận lại khi online).
4. Sao lưu: `services/backup.js` ghi bản chụp vào `/backups/` — không ghi đè dữ liệu gốc (đã kiểm).

## 4. Phân quyền
`core/permissions.js` + `modules/auth`: vai trò (Admin/Nhân viên/…) quyết định tab hiển thị và thao tác. Không đổi.

## 5. Thông báo / nhật ký / truy xuất
`services/notification.js` + `components/NotificationCenter.js`; `modules/audit` ghi nhật ký thao tác; `services/traceability.js` truy xuất thành phẩm/QR.
