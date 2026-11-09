# CHANGELOG

## [Chưa phát hành] Nâng cấp ERP/MES — Giai đoạn 2: Global Header duy nhất, gọn, responsive
- **Gỡ tên công ty khỏi Global Header** (khối `topbar-company` desktop ≥1560px và `topbar-mh-company` mobile), kèm các luật CSS tương ứng. Không thay bằng nội dung khác, không để khoảng trống. Sidebar và file xuất (Excel/PDF) **giữ nguyên**; TV Mode giữ nguyên.
- Header mobile (≤640px): tên tab + Làm mới + đồng bộ + thông báo + tài khoản + tìm kiếm trên 1 hàng, ngày • giờ (có giây) ở hàng 2; cao 66px (trước 130px, không có tên tab). Tablet (641–899px): 1 hàng chức năng + 1 hàng tìm kiếm, cao cố định 107px (trước 155–212px, rớt dòng theo tab).
- Nút Làm mới trên mobile trước đây chỉ có tác dụng ở Tổng quan; nay các tab khác vẽ lại từ dữ liệu đã đồng bộ (chỉ đọc, không ghi Firebase).
- **Điều hành SX (chế độ thường)**: ẩn Header riêng trùng lặp (logo/tên công ty, tiêu đề, Đồng bộ, chuông, tài khoản); giữ đồng hồ/ca và nút TV MODE. **TV MODE không đổi** (so điểm ảnh với bản gốc: 0 khác biệt ngoài chữ số đồng hồ).
- Sửa lỗi có sẵn: trên mobile/tablet hẹp 4 nhóm máy ở Điều hành SX chồng đè lên nhau → xếp dọc.
- **Gộp nút đồng bộ**: bỏ nút "Làm mới" riêng (chỉ ở Tổng quan); chỉ báo "Đồng bộ" nay là nút bấm duy nhất (chuột/Enter/Space; mobile: nút ⟳). Chỉ vẽ lại từ dữ liệu đã đồng bộ — bấm không phát sinh lượt ghi Firebase nào (đã đo qua nhật ký request của mock).
- **Gộp thông báo**: bỏ nút 📢 khỏi Header; nút **📢 Soạn** (chỉ admin, tái dùng id `annWriteBtn` nên logic phân quyền ở `login.js`/`app.js` giữ nguyên) nằm trong panel chuông 🔔. `openAnnounce()` và nút ở Cài đặt không đổi.
- **Sửa Header tràn**: ở 1024px Đồng bộ/Chuông/Tài khoản nằm ngoài mép phải (lỗi có sẵn). Bố cục 2 hàng áp dụng 641–1023px; 1024–1199px ẩn logo, ô tìm kiếm co lại, tên tab được ưu tiên. Kiểm bằng điều kiện "nằm trong khung màn hình" ở 10 kích thước × 8 tab.
- Gỡ dòng tên công ty trong dropdown Tài khoản (mở từ avatar trên Header).
- Điều hành SX dưới 1280px: các nhóm máy tự xuống dòng (trước đó chồng đè ở mobile, tablet và laptop 1024px).
- **Giữ nguyên theo quyết định**: tên công ty ở Sidebar và thanh riêng của TV MODE; tiêu đề file xuất Excel/PDF.
- Sửa: `GlobalHeader.js`, `NotificationCenter.js`, `account-menu.js`, `router.js`, `date.js`, `design-system.css`, `redesign-2026.css`, `index.html`, `sw.js`; thêm `src/styles/header-erp.css` (đã đăng ký trong `index.html` và `sw.js`). Gỡ lớp mới = bỏ dòng `<link>` header-erp.css.

## [Chưa phát hành] Lịch làm việc — 3 ô thông tin bộ phận chỉ Admin thấy và dùng
- Tab **Lịch làm việc**: ba ô **Tên bộ phận**, **📅 Thời gian áp dụng**, **⚠️ Ghi chú / cảnh báo chung** nay chỉ hiện với tài khoản **Admin**. Các tài khoản khác không còn thấy các ô nhập này (trước đây hiện ở dạng chỉ-đọc).
- Hàm `llvSetMeta` thêm chốt chặn `isAdmin()` nên không thể sửa 3 trường này bằng cách gọi trực tiếp.
- Giữ nguyên cho mọi người: bảng lịch (kèm tiêu đề, thời gian áp dụng và cảnh báo hiển thị phía trên bảng), nút In A4/A3, Chụp ảnh, Xuất Excel, Tạo mã QR. Dữ liệu và in/xuất không đổi.
- Sửa: `src/modules/attendance/attendance-schedule.js`. Kiểm thử jsdom: Admin thấy đủ; Staff/Viewer không thấy; gọi `llvSetMeta` trực tiếp bị chặn. **Chưa thử trên thiết bị thật.**

## [Chưa phát hành] ControlPlan QC — sửa lỗi Huỷ phiếu / Xoá phiếu bấm không phản ứng
- **Nguyên nhân**: các nút dùng `prompt()` / `confirm()` gốc của trình duyệt; trong app chạy thật (Android/WebView) hộp thoại gốc không hiện và trả về "huỷ" ngầm, nên bấm xong không có gì xảy ra (cùng nguyên nhân đã ghi ở `planning-detail.js`).
- **Sửa**: thêm hộp thoại riêng `cpAsk()` (`cp-view.js`, dựng trên `cpModal` sẵn có): có ô nhập lý do bắt buộc (báo "Cần nhập lý do" nếu để trống), nút xác nhận/quay lại, không phụ thuộc hộp thoại của trình duyệt.
- Áp dụng cho: **Huỷ phiếu**, **Xoá phiếu (Admin)**, **Xoá bản nháp**, HOLD ▸ **RELEASE** / **Phế phẩm**, **Xác nhận dữ liệu cần kiểm tra**, **Nhập dữ liệu Excel** (các nút này trước đó cũng bị cùng lỗi). Trong các file `cp-*.js` không còn `confirm()`/`prompt()` gốc.
- Chưa sửa (ngoài phạm vi ControlPlan, cùng kiểu lỗi): `prompt()`/`confirm()` ở tab Check Sheet thiết bị, Kho/QR (nhập vị trí lưu kho, số phiếu xuất kho), sổ liệu.
- Kiểm thử: chạy jsdom với `confirm`/`prompt` bị vô hiệu — huỷ phiếu, xoá phiếu, chặn khi thiếu lý do, chặn tài khoản không phải Admin đều đúng. **Chưa thử trên thiết bị thật.**

## [Chưa phát hành] ControlPlan QC nhóm B — Admin xoá phiếu
- Mở một phiếu Check Sheet nhóm B (Kiểm tra độ thẳng, Đùn, Rút, Đánh bóng, Cắt) bằng tài khoản **Admin** → có nút **🗑 Xoá phiếu (Admin)** ở chân trang, dùng được với phiếu nháp, đã hoàn tất hoặc đang sửa. Các vai trò khác (QA, Trưởng QC, QC, SX, chỉ xem) không thấy nút và bị chặn cả khi gọi trực tiếp.
- Bắt buộc nhập lý do + xác nhận lần 2; nếu phiếu đã có NCR/HOLD/8D lập từ nó thì cảnh báo trước (các hồ sơ đó vẫn giữ, chỉ mất liên kết).
- Xoá HẲN (khác "Huỷ phiếu" chỉ đánh dấu): bản ghi biến mất khỏi máy này và đồng bộ xoá trên máy chủ/máy khác (dùng hàng đợi xoá sẵn có, chưa có mạng thì chờ gửi lại). Dấu vết còn lại ở **Nhật ký thao tác**: mã phiếu, khách hàng, quy cách, lô, lý do, người xoá.
- Mã: `cp-core.js` (`CP_PERM.delete`, `cpCanDeleteRec`, `cpDeleteRecord`), `cp-forms.js` (`cpDeleteRec`, chân trang). Chỉ áp dụng loại phiếu `chk`; FQC / NCR / HOLD / 8D không đổi.
- Lưu ý: phiếu nhập từ Excel nếu bị xoá thì lần nhập lại Excel có thể nạp lại. Đã kiểm tra cú pháp và quyền/hàng đợi xoá bằng Node; **chưa thử trên trình duyệt thật**.

## [Chưa phát hành] ControlPlan QC — sửa lỗi hiện tiêu đề nhưng nội dung vẫn là tab cũ; bấm thẻ mở thẳng biểu mẫu
- **Sửa lỗi**: chuyển từ tab khác (vd Quản lý mã QR) sang ControlPlan QC, thanh trên cùng đã đổi nhưng nội dung vẫn là tab cũ. Nguyên nhân: `renderControlPlan()` thoát sớm khi cờ `cpUI.ed` (phiếu đang mở lần trước) còn sót hoặc khi một ô nhập đang được focus, dù trang ControlPlan lúc đó chưa hề được vẽ. Nay chỉ bỏ qua vẽ lại khi khung `#cpRoot` đang hiển thị; vừa chuyển từ tab khác sang thì luôn vẽ (phiếu đang soạn dở vẫn được giữ và mở lại).
- **Phòng lỗi ngược lại**: `cpRender()` không ghi đè nội dung khi đang ở tab khác (các lệnh đồng bộ chạy nền gọi vẽ lại sau khi người dùng đã rời tab).
- **Bấm thẻ mở luôn**: ở Tổng quan ControlPlan, bấm vào bất kỳ chỗ nào trên thẻ biểu mẫu (vd nhóm B ▸ Kiểm tra độ thẳng) là mở thẳng danh sách/phiếu của biểu mẫu đó; nút "Mở biểu mẫu" và "⬇ Excel" vẫn dùng như cũ (không bị mở đúp). Dùng được phím Enter/Space khi thẻ đang được chọn.
- Đã kiểm tra cú pháp và mô phỏng logic bằng Node; **chưa thử trên trình duyệt thật**.

## [Chưa phát hành] ControlPlan QC — ô Khách hàng dạng hộp chọn
- Các phiếu kiểm tra (ô **Khách hàng**: phiếu kiểm tra chuyền, FQC, 8D) nay có **mũi tên ▾** bấm để xổ toàn bộ danh sách khách hàng; gõ **chữ đầu** hoặc một phần tên (không cần dấu, không phân biệt hoa thường) thì danh sách tự lọc, tên bắt đầu bằng chữ gõ được xếp lên trước. Dùng được phím ↑ ↓ Enter Esc; vẫn gõ được tên khách mới.
- Nguồn danh sách: khách hàng trong tab Đơn hàng + khách đã có trong các phiếu QC (trùng tên khác dấu/hoa thường chỉ giữ 1). Bộ lọc Khách hàng ở danh sách phiếu cũng được dùng danh sách này.
- Sửa: `cp-core.js` (`cpCustomers`), `cp-forms.js` (`cpFld`, hàm `cpCb*`), `cp.css`. Chỉ ĐỌC dữ liệu, không đổi schema. Đã kiểm tra cú pháp và logic gộp/lọc bằng Node; **chưa thử trên trình duyệt thật / điện thoại**.

## [Chưa phát hành] Tổng quan & ControlPlan QC — gỡ Truy xuất nhanh, nhóm bấm-để-mở, xuất Excel chuyên nghiệp
- **Tổng quan**: bỏ khối "Truy xuất nhanh" (`buildDpQuickTrace`, `dpQuickTrace`, `dpQuickScan` + CSS `.dp-quick*`). Tab Truy xuất riêng vẫn dùng bình thường.
- **ControlPlan ▸ Tổng quan**: 4 nhóm A/B/C/D thành dạng accordion — bấm nhóm nào thì nhóm đó tự mở ra danh sách biểu mẫu (nhóm khác tự thu lại; bấm lại để đóng; có nút Mở/Thu gọn tất cả; phím Enter/Space dùng được). Đầu mỗi nhóm hiện sẵn tổng phiếu / hôm nay / NG. Vào biểu mẫu chỉ bằng nút "Mở biểu mẫu" trong thẻ; quay lại thì nhóm vẫn mở.
- **Xuất Excel** (file mới `src/modules/quality/cp-export.js`, nạp sau `cp-reports.js`; đã thêm vào `index.html` + `sw.js`): xuất toàn bộ / theo nhóm / theo biểu mẫu / danh sách đang lọc. Có trang Tổng quan (KPI, danh mục biểu mẫu có liên kết nhảy trang), mỗi biểu mẫu một trang tính, logo + tên công ty, mã hồ sơ, ngày/người xuất, phạm vi lọc, tô màu OK/NG và trạng thái, ngày dd/mm/yyyy thật, AutoFilter, đóng băng tiêu đề, in A4 + lặp tiêu đề + số trang, khối chữ ký. 8D có thêm trang chi tiết từng bước. Hàm `cpDownloadXlsx` cũ (Báo cáo, Control Plan, PFMEA) chuyển sang khung mới nên các nút ⬇ Excel cũ cũng ra file chuẩn.
- CHỈ ĐỌC dữ liệu, không ghi DB, không đổi schema.

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
