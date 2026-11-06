# CHANGELOG

## [Chưa phát hành] Giai đoạn 5 — Dọn dẹp, kiểm thử, bàn giao
- Xoá 164 file thừa trong `src/assets/` (bản sao cũ của `modules/ components/ services/ core/ styles/ utils/ vendor/`; 154 file trùng y hệt bản chính, 9 file là bản CŨ hơn bản chính, 1 file `modules/dashboard/dashboard` trùng `dashboard.css`). Không file nào được `index.html`/`sw.js` nạp. **Giữ** `src/assets/brand-logo.js` (đang dùng). Danh sách file đã xoá: `docs/REMOVED-STALE-COPIES.txt`. Không ảnh hưởng chạy ứng dụng; chỉ giảm kích thước kho.
- `tests/run-all.sh` thêm mục [5] chạy các bài kiểm thử mới (jsdom). `tests/package.json` thêm `jsdom`.
- **Không** thay đổi hiệu năng chạy: chưa đo được trên trình duyệt thật nên không tối ưu theo cảm tính (xem KNOWN-ISSUES).

## [Chưa phát hành] Giai đoạn 4 — TV Mode, thông báo
- **Sửa lỗi bảo mật** `src/components/NotificationCenter.js` (`renderNotifList`): tiêu đề, nội dung và tên người gửi thông báo trước đây được chèn thẳng vào HTML (gồm tên khách hàng và nội dung broadcast do người dùng khác nhập, đồng bộ qua Firebase). Nay được escape; mã thông báo truyền qua `data-nid` thay vì nối vào chuỗi `onclick`. Ngoại lệ có chủ đích đã khai báo trong `tools/refactor/patches.json` (`renderNotifList`). Đối chứng: bản cũ không qua bài kiểm thử mới, bản vá qua.
- `src/modules/tv-mode/tv-wakelock.js`: giữ màn hình TV không tắt khi đang ở TV Mode (Screen Wake Lock API; xin lại khi tab hiện lại; trình duyệt không hỗ trợ/từ chối thì bỏ qua). Không sửa `tv-mode.js`.
- Chưa làm (chưa có cơ sở đo): chỉnh bố cục responsive các tab cũ, thay đổi giao diện TV Mode. Dải mới của Giai đoạn 3 có CSS riêng cho mobile (≤640px).

## [Chưa phát hành] Giai đoạn 3 — Đơn hàng, Kế hoạch, Sổ liệu, Truy xuất (CHỈ ĐỌC)
Cơ chế: `src/components/shared/ModuleEnhance.js` bọc hàm render gốc, chạy hàm gốc rồi gắn thêm dải; lỗi ở dải không làm mất nội dung tab. Không ghi DB, không đổi schema, không sửa file nghiệp vụ gốc. CSS: `src/styles/modules-insight.css`. Cache SW v7.
- **Đơn hàng** (`orders-insight.js`): dải "Cần chú ý": đến hạn giao ≤3 ngày, ưu tiên GẤP 1–3 chưa lập kế hoạch, chưa có ngày giao, chưa có khách hàng; bấm chip mở ngăn danh sách.
- **Kế hoạch** (`planning-insight.js`): "Tải giao hàng 7 ngày tới" (số đơn, kg theo hạn giao; trễ hạn / sau 7 ngày / chưa có ngày giao). Đơn thiếu kg được báo riêng, không cộng bừa.
- **Sổ liệu** (`inventory-insight.js`): độ phủ liên kết truy xuất của sổ đang xem (% dòng gắn Đơn hàng / Heat-Lot / Mã lô SX) và danh sách dòng chưa gắn đơn. Không tự ghép dòng.
- **Truy xuất** (`trace-export.js`): nút "Xuất kết quả CSV" (liên kết trực tiếp + nhóm dùng chung lô; UTF-8 BOM; chống chèn công thức Excel).
- **Điều hành SX, QC / Hoàn thành**: chưa thay đổi. Tab Hoàn thành đã có sẵn cảnh báo đơn sắp bị tự xoá; Điều hành SX đã có bố cục TV riêng.
- Kiểm thử: `tests/static/phase3-insight.test.js` (14 nhóm, jsdom).

## [Chưa phát hành] Giai đoạn 2 (phần 1) — Tổng quan điều hành nhà máy
- `src/modules/dashboard/dashboard-factory.{js,css}`: widget CHỈ ĐỌC gắn vào `renderDashboard` (giữ nguyên toàn bộ widget cũ): Truy xuất nhanh (→ tab Truy xuất, có quét QR), 5 KPI bổ sung, bảng công đoạn Nguyên liệu→Đùn→Rút→Đánh bóng→Cắt→Thành phẩm (bấm mở danh sách), tình trạng máy (dùng `machineRuntimeStatus`), cảnh báo quan trọng.
- Chỉ số chưa có nguồn (OEE, NG theo công đoạn, sổ máy đùn, tồn nguyên liệu, thời gian chạy/dừng) hiện CHƯA CÓ DỮ LIỆU. Cache SW v6.
- Chưa làm: nâng cấp trang Điều hành SX, biểu đồ sản lượng so kế hoạch.

## [Chưa phát hành] Giai đoạn 1 — Design System, Header, Sidebar
- `src/styles/design-system.css` (nạp cuối): token + class `.ds-*` (button, badge, card/KPI, input, table + chế độ thẻ mobile, tabs, empty/error/skeleton, drawer, tooltip). Cache SW v5.
- Sidebar: 18 mục giữ nguyên ID/handler, gom 7 nhóm (Điều hành, Kinh doanh, Sản xuất, Kho & nguyên liệu, Chất lượng, Quản lý nhà máy, Hệ thống); icon theo nhóm; thu gọn desktop (`dp_sb_collapsed`, chỉ là sở thích hiển thị); tự cuộn tới mục đang chọn. Nhãn "Số liệu" → "Sổ nguyên liệu & máy".
- Header: tên công ty (≥1560px hoặc khi sidebar thu gọn), nút chuông thông báo, thu gọn theo bề rộng; mobile có thêm đồng bộ/thông báo/tài khoản.
- Notification Center: thêm `openNotifPanel()`; sửa CSS panel (calc sai cú pháp làm panel lệch màn hình).
- Tab Truy xuất dùng `.ds-table` (thẻ trên mobile) và `.ds-na`.

## [Chưa phát hành] Phân hệ TRUY XUẤT & KHIẾU NẠI — Bước 1–2
- **Bước 1**: thêm trường TUỲ CHỌN `donHangId`, `maLoSX` (3 sổ) và `heatLot` (Sổ máy rút / đánh bóng+cắt) vào form + màn chi tiết. Dòng cũ không đổi (hiện CHƯA XÁC ĐỊNH).
- **Bước 2**: tab mới `truyXuat` (🔎 Truy xuất & Khiếu nại), CHỈ ĐỌC: tìm theo ID đơn/PO/Heat-Lot/mã lô SX/mã QR/mã SP/khách/quy cách; quét QR camera (BarcodeDetector); mở bản ghi gốc; liệt kê đơn dùng chung lô. Liên kết chỉ bằng khóa, không ghép theo tên/quy cách. Files: `src/modules/trace/*`, sửa nhẹ `Sidebar.js`, `router.js`, `index.html`, `sw.js` (cache v4).
- Giữ nguyên: tự xoá sổ >32 ngày và đơn hoàn thành >30 ngày (theo quyết định của chủ hệ thống).
- Test: `node tests/static/trace-engine.test.js` (17 ca).


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
- **Chuyển kho phục vụ app sang `hungphuong1991bn-beep/dongphuong`** (Pages: `https://hungphuong1991bn-beep.github.io/dongphuong/`): `electron-app/main.js` (APP_URL), `electron-app/package.json` (publish owner/repo), hai `capacitor.config.json`, `src/services/update.js` (REPO kiểm tra bản APK), README. Lý do: app build trỏ tới kho cũ `hungphuong1990bn-create/test` nên không nhận bản cập nhật đưa lên `dongphuong`; đồng thời sửa lỗi 403 khi đăng Release (token chỉ có quyền ở kho đang chạy workflow). **Cần build + cài lại app Android/Windows một lần.**
- Thêm `tests/e2e/sync-stress.js` và mục [4] trong `tests/run-all.sh`.

### Không đổi
`electron-app/`, `android-app/`, `manifest.json`, `version.json`.

### Xoá
Không xoá tính năng nào. Các khối `<style>/<script>` inline gốc được thay bằng file tương ứng trong `src/`.
