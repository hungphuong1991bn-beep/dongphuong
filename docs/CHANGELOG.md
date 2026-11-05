# CHANGELOG

## Tái cấu trúc module hoá (nhánh `refactor/modular`, từ tag `baseline-v2.5.141`)
Không đổi tính năng, giao diện, dữ liệu, schema Firebase.

### Thêm / chuyển
- Tách `index.html` (25.6k dòng) thành `src/` (~123 JS, 40 CSS, 1 vendor, 1 asset). Mã chuyển **nguyên văn**.
- Thêm `tools/refactor/` (manifest, build, verify, inventory) để tái sinh và kiểm chứng việc tách.
- Thêm `tests/` (mock Firebase, chụp/so sánh UI, kiểm chức năng/đồng bộ, kiểm SW) và `tests/run-all.sh`.
- Thêm `docs/` (6 tài liệu bắt buộc + INVENTORY + KNOWN-ISSUES).

### Sửa đổi (có chủ đích, tối thiểu)
- `sw.js`: cache `v3`, liệt kê đủ tài nguyên mới; CSS chuyển sang network-first (vì CSS không còn inline).
- `.github/workflows/bump-version.yml`: đọc `APP_VERSION` từ `index.html` **và** `src/core/constants.js`.
- `index.html`: thay khối `<style>/<script>` bằng `<link>/<script src>`; head/meta/icon giữ nguyên.
- `.gitignore`: `node_modules/`, `.baseline/`.

### Sửa lỗi (khác bản gốc có chủ đích)
- **Đồng bộ chéo thiết bị: đơn vừa nhận bị "biến mất" trên máy kia.** `src/services/sync-realtime.js`: `doPoll` và `handleRealtimeChange` + biến `_rtSeq`. Khi A thêm đơn, Firebase đẩy tới B hai sự kiện sát nhau (`/notif` rồi `/data/orders/<id>`). `/notif` kích hoạt `doPoll()` đọc cả `/data`; sự kiện đơn được áp ngay, rồi bản đọc `/data` (bắt đầu trước khi đơn lên server) về sau và ghi đè bằng danh sách cũ. SSE đang sống nên không có polling nào sửa lại. Sửa: nếu trong lúc đọc có sự kiện dữ liệu realtime được áp thì bỏ bản đọc đó và đọc lại (tối đa 3 lần). Không đổi schema/đường dẫn Firebase. Ngoại lệ được khai báo tại `tools/refactor/patches.json`.
- Thêm `tests/e2e/sync-stress.js` và mục [4] trong `tests/run-all.sh`.

### Không đổi
`electron-app/`, `android-app/`, `manifest.json`, `version.json`.

### Xoá
Không xoá tính năng nào. Các khối `<style>/<script>` inline gốc được thay bằng file tương ứng trong `src/`.
