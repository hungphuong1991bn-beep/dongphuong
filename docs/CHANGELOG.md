# CHANGELOG

## [Chưa phát hành] Sửa lỗi Phân công máy (Kế hoạch SX → Panel chi tiết đơn)
Lỗi báo từ xưởng (ảnh chụp màn hình 11/11/2026): trong Panel chi tiết đơn, Đùn/Rút hiện "— Chưa gán —", chỉ còn máy Đánh bóng; đóng panel thì hiện hộp thoại "Đóng biểu mẫu? Dữ liệu đã nhập chưa được lưu...".
- **Nguyên nhân 1 — hộp thoại sai**: `dp-ui.js` coi mọi `<select>` trong modal là "biểu mẫu đang nhập"; Panel chi tiết không phải biểu mẫu (phân công máy lưu ngay). Sửa: `data-dp-nodirty` trên `#khDetailBody` + khối phân công máy; `assignMachine()` gọi `dpUI.modal.markClean('khDetailModal')`.
- **Nguyên nhân 2 — máy "biến mất"**: bấm nhầm 1 bước ở thanh Công đoạn → `setStage()` đổi công đoạn ngay (không hỏi) và `dhReleaseEarlierMachines()` XOÁ máy các công đoạn đã qua. Sửa: (a) `requestSetStage()` hỏi xác nhận, nêu rõ bỏ qua công đoạn / quay lại / máy sẽ nhả; (b) nhả máy nay ghi vào `o.machineHistory[stage] = {machineId,startAt,endAt}`; (c) Panel hiện "✓ Đã qua — đã chạy trên <máy>" hoặc "ℹ️ chưa ghi nhận máy"; đơn đang chạy mà công đoạn hiện tại chưa gán máy → cảnh báo "⚠️ CHƯA gán máy".
- **Sửa phụ**: gán máy cho công đoạn hiện tại của đơn đang chạy nay ghi mốc "Chạy từ" riêng (trước đây lấy giờ bắt đầu cả đơn, có thể cách nhiều ngày); bỏ gán xoá dấu đang chạy của máy cũ; bấm đúp bị khoá 300ms nay vẽ lại để ô chọn không hiện giá trị sai so với dữ liệu.
- **Rà soát vòng 2 (nguyên nhân gốc thật của đơn DH48RK0U)**: `promoteQueuedOrderToRunning()` lấy `queue[0]` không kiểm tra đơn đã TỚI LƯỢT chưa → đơn Chờ chỉ cần được gán 1 máy Đánh bóng/Rút/Cắt trống là tự chuyển Đang chạy với `stage` = công đoạn của máy đó (bỏ qua Đùn, `startedAt` = lúc gán). Đơn đang chạy ở công đoạn trước mà gán trước máy công đoạn sau còn bị "Tự động chạy tiếp" lặp mỗi lần đồng bộ (spam nhật ký + ghi Firebase). Sửa bằng `dhIsOrderDueAtStage()`: đơn Chờ chỉ chạy ở công đoạn đầu; đơn Đang chạy chỉ khi `stage` đúng công đoạn của máy.
- `setStatus()`: đơn Hoàn thành / về Chờ nay nhả TẤT CẢ máy đang giữ (trước đây chỉ máy của công đoạn hiện tại) rồi đẩy đơn chờ lên.
- Test `machine-assign.test.js` nay 14 ca.
- **Treo app sau khi phân công máy (phải tắt mở lại)**: bản gốc có vòng lặp `promote → saveOrders → đồng bộ → dhAutoDispatchSweepAll → promote…` không bao giờ dừng với nhiều tổ hợp dữ liệu (fuzz 20.000 tổ hợp đơn/máy ngẫu nhiên: bản gốc 13.543 ca không hội tụ, bản sửa 0). Mỗi vòng vẽ lại tab + ghi Firebase nên giao diện đứng. Thêm **cầu dao** (cùng máy + cùng đơn không tự chạy tiếp quá 3 lần/10 giây), `try/catch` từng máy khi quét, và `try/catch` trong `assignMachine()` (lỗi bất ngờ → báo toast + vẽ lại màn hình thay vì kẹt).
- Dữ liệu cũ tương thích (trường mới `machineHistory` là tùy chọn). Cache SW v19. Test mới `tests/static/machine-assign.test.js` (9 ca, đạt). **Chưa thử trên trình duyệt/Firebase thật.**

## [Chưa phát hành] Giai đoạn B (phần 2) — Lô sản xuất, QR lô, chuỗi truy xuất nguyên liệu → máy → QC
- **Nhánh mới `/data/productionLots`** (`productionLotId`, mã `LSX-YYMMDD-NNN`) trên `dp-store.js`. Một đơn có nhiều lô SX. File `modules/materials/prodlots-core.js`.
- **Cấp phát nguyên liệu nay trỏ lô SX bằng ID** (gõ mã không phân biệt hoa/thường vẫn ra đúng lô): lô SX phải tồn tại, thuộc đúng đơn và còn mở. *Thay đổi so với B1: không còn nhận mã lô SX gõ tự do.*
- **Chuỗi lô SX (`plChain`)**: nguyên liệu đã cấp (NCC, COA, QC) → dòng 3 sổ máy có `maLoSX` == mã lô (khớp tuyệt đối sau chuẩn hoá, KHÔNG khớp gần đúng) → phiếu QC/NCR có `lot` == mã lô. Trả về danh sách chỗ THIẾU/MÂU THUẪN: chưa cấp nguyên liệu, công đoạn chưa có nhật ký, dòng sổ cùng đơn chưa ghi mã lô, dòng sổ cùng mã nhưng khác đơn, lô nguyên liệu rời Đạt QC, có NCR/HOLD. Chỉ ĐỌC sổ/QC cũ.
- **Huỷ lô SX** chỉ khi chưa có dữ liệu liên kết; đóng/mở lại/huỷ chỉ Admin + lý do.
- **QR lô** (nguyên liệu `DP-LOT:<mã>`, lô SX `DP-PL:<mã>`): chỉ chứa mã định danh — không URL, không địa chỉ CSDL, không dữ liệu sản xuất; mở được khi đã đăng nhập. Tab Truy xuất nhận tiền tố này (`trExtractQr`); QR thành phẩm cũ không đổi. Tải ảnh PNG từ chi tiết lô.
- **Giao diện**: tab "Lô nguyên liệu" có 2 chế độ (Lô nguyên liệu | Lô sản xuất); chi tiết lô SX hiển thị chuỗi + chỗ thiếu; Truy xuất hiển thị lô SX khi gõ mã. Ô "Mã lô sản xuất" ở Sổ máy đùn / rút / đánh bóng có **gợi ý** lô SX đang mở (lô cùng đơn lên đầu) — vẫn cho gõ tay như cũ, dữ liệu sổ không đổi.
- Sửa lỗi: làm mới đồng bộ không còn dựng lại biểu mẫu đang gõ dở (chỉ làm mới màn chi tiết); chuyển chế độ xem không lỗi khi modal chưa tạo.
- Cache SW v18. Test mới: `prodlots-core.test.js` (22 ca); `materials-view.test.js` mở rộng (27 kiểm tra).

## [Chưa phát hành] Giai đoạn B (phần 1) — Lô nguyên liệu, cấp phát nhiều–nhiều, truy xuất theo lô
- **Kho dùng chung `src/services/dp-store.js`** (mới): mô hình của ControlPlan tổng quát cho nhánh mới — id ổn định, `rev`, lịch sử từng bản ghi (có trước/sau), hàng đợi ngoại tuyến lưu bền, ghi theo id (gửi lại không trùng), phát hiện xung đột theo `rev` (giữ bản đến trước, cất bản của người đến sau), **không có xoá cứng** và tín hiệu xoá từ xa bị bỏ qua. Móc vào đồng bộ qua 3 dòng thêm trong `sync.js` / `sync-realtime.js` (cạnh các dòng ControlPlan).
- **Nhánh dữ liệu mới** `/data/materialLots` (`materialLotId`) và `/data/materialIssues` (cấp phát: lô ↔ đơn ↔ lô SX). Không sửa `nguyenLieuLog`, `mayRutLog`, `mayDanhBongLog`, `orders`, `cpRecords`.
- **`src/modules/materials/materials-core.js`**: trạng thái QC (Chờ kiểm tra / Đạt QC / Không đạt / Đang cách ly) tách khỏi Khóa, Đã nhập kho; "Đã cấp"/"Đã dùng hết" được TÍNH từ bản ghi cấp phát. Chỉ cấp khi Đạt QC + chưa khoá + còn tồn + đơn tồn tại. Duyệt Đạt QC cần kết quả kiểm đầu vào và số COA (hoặc lý do miễn COA); **Không đạt không đi thẳng sang Đạt** (phải qua Đang cách ly). Sửa thông tin lô đã duyệt/đã cấp: chỉ Admin + lý do + lưu trước/sau. Dùng thực tế < cấp → phần chênh ghi là "chưa đối soát", không tự coi là phế liệu. Truy xuất xuôi/ngược theo khoá. Migration "Tạo lô từ Heat-Lot cũ": chỉ gộp khi khoá chuẩn hoá trùng tuyệt đối (mã khác ở dấu/khoảng trắng chỉ được gợi ý, không tự gộp); lô tạo ra ở "Chờ kiểm tra", **không có khối lượng nhập suy diễn**.
- **Giao diện** `materials-view.js`: tab mới "Lô nguyên liệu" (Sidebar nhóm Số liệu và kho). Escape đầy đủ, thao tác qua `data-mat` + một listener uỷ quyền (không nối id vào `onclick`). Tab **Truy xuất** có thêm mục "Lô nguyên liệu (có quản lý)": gõ mã lô/số lô NCC → lô + xuôi ra đơn/khách (cảnh báo phạm vi ảnh hưởng nếu lô không ở Đạt QC); đơn → lô đã cấp, đơn chưa có bản ghi cấp phát được ghi rõ "CHƯA CÓ". `trSearch` không bị sửa.
- Quyền hiện theo 4 vai trò có sẵn (bảng `MAT_PERM`): staff tạo lô/cấp phát; chỉ Admin duyệt QC, khoá, huỷ cấp phát, migrate. Sẽ đổi khi chốt 6 vai trò.
- Cache SW v17. Test mới: `materials-core.test.js` (38 ca), `materials-view.test.js` (21 ca).

## [Chưa phát hành] Giai đoạn A (ERP/MES–QMS) — Tự xoá → dọn thủ công (Admin); Sổ nguyên liệu → Sổ máy đùn
Theo quyết định của chủ hệ thống (thay quyết định cũ "tự xoá 30/32 ngày"):
- **Tắt hoàn toàn tự xoá**: `src/services/sync.js` không còn gọi `autoCleanupDoneOrders()`, `autoCleanupSoLieu()`, `slRemindExportIfNeeded()` (3 điểm: sau đồng bộ, khi app hiện lại, mỗi giờ). Các hàm cũ vẫn nằm trong mã nhưng không còn nơi nào gọi.
- **Dọn thủ công, chỉ Admin**: file mới `src/modules/admin/manual-cleanup.js`. Nút "🗑 Dọn N … (Admin)" hiện ở tab Số liệu và tab Đơn hoàn thành (chỉ Admin thấy, chỉ khi có dòng/đơn quá hạn). Có hộp thoại xác nhận nêu số lượng; kiểm lại quyền Admin và trạng thái đồng bộ ngay trước khi xoá; ghi Nhật ký thao tác `deletedBy:'MANUAL_ADMIN'`. Quy tắc chọn dòng giữ như cũ (đơn done quá 30 ngày; dòng sổ có Ngày quá 32 ngày; dòng thiếu Ngày không xoá).
- Đổi chữ: bỏ banner/thông báo "sẽ tự động bị xoá"; đơn quá hạn nay hiện nhãn "Quá hạn lưu — chờ Admin dọn" (`htIsExpiringSoon` gồm cả đơn đã quá hạn vì không còn bị xoá nên không còn "biến mất").
- **Sổ nguyên liệu đổi tên hiển thị thành "Sổ máy đùn"** (nhãn, tiêu đề form, Sidebar, màn Truy xuất, xuất CSV, nhật ký). **Giữ nguyên** khoá dữ liệu `nguyenLieuLog` và mọi trường (heatLot, phế, phoi…) nên không cần migration. Chưa đổi form sang trường đùn (nhiệt độ/tốc độ/quy cách vào-ra) — chờ danh mục thông số được duyệt.
- Cache SW v16; thêm `tests/static/manual-cleanup.test.js` (12 ca). Kiểm: verify-sw, trace-engine (31), phase3-insight (14), dp-ui (23), dp-step3 (24) đạt. **Chưa chạy** e2e Playwright và chưa thử trên thiết bị thật / Firebase thật.
- Lưu ý vận hành: dữ liệu giờ tăng dần (không còn tự dọn) → cần theo dõi dung lượng Firebase và hiệu năng (chưa có phân trang).

## [Chưa phát hành] Bước 4 — Tối ưu tốc độ tải và chuyển tab
Phương pháp: đo trước/sau bằng `tests/e2e/perf-b4.js` (Chromium, Firebase giả lập chạy máy cục bộ nên **không có độ trễ mạng thật**): thời gian mở app, chuyển 19 tab × 4 vòng, số request Firebase mỗi lần chuyển tab, số SSE, listener/timer/DOM/bộ nhớ sau mỗi vòng. Chạy: `CHROMIUM_PATH=<nếu cần> node tests/e2e/perf-b4.js <thư-mục-gốc> [kết-quả.json]`.
- **Không phát hiện rò rỉ**: sau 4 vòng × 19 tab, listener trên window/document ổn định (62), timer ổn định (9), 0 listener trùng, DOM không tăng, bộ nhớ JS 5,8 → 6,1MB (giữ nguyên sau vòng 1), chỉ 1 kết nối SSE cho cả phiên. Tab cũ không rò sang tab mới (0 lỗi JS).
- **Sửa gọi Firebase thừa mỗi lần chuyển tab**: trước 3 request (1 ghi + 2 đọc cùng `/presence`), nay 2. Nguyên nhân: lần ghi heartbeat của chính thiết bị dội lại qua SSE và kích hoạt thêm một lần đọc `/presence` giống hệt. `sync-realtime.js` bỏ qua tiếng vọng của chính `_devId`; thay đổi từ thiết bị khác vẫn làm mới danh sách (đã kiểm: thiết bị thứ hai vào → thiết bị thứ nhất thấy "Đang truy cập (2)").
- **Giãn cách heartbeat khi dữ liệu đổi dồn dập**: mỗi lần vẽ lại do đồng bộ trước đây ghi + đọc presence; nay tối thiểu cách 5 giây (`updateOnlineThrottled`, `presence.js`). Chuyển tab và vòng heartbeat 20 giây giữ nguyên (hạn presence 30 giây).
- **ExcelJS (~900KB, CDN) không còn tải ngay lúc mở app**: nạp lúc máy rảnh sau khi trang tải xong (đo: yêu cầu lúc 982ms → 4018ms). Mọi hàm xuất Excel vẫn tự `await ensureExcelJs()`. Sửa kèm: nếu tải lỗi (mất mạng) trước đây lời hứa lỗi bị giữ mãi nên bấm lại cũng không thử lại; nay tự thử lại ở lần bấm sau.
- File sửa: `src/services/presence.js`, `src/services/sync-realtime.js`, `src/utils/lib-loader.js`; thêm `tests/e2e/perf-b4.js`.
- Kiểm thử: `functional.js` trùng khít bản trước khi sửa; `sync-stress.js` 40/40 vòng, 0 lỗi; `verify-sw`, `dp-ui` (23 nhóm), `dp-step3` (24 nhóm) đạt.
- **Chưa làm / chưa kiểm**: 142 thẻ `<script>` nạp đồng bộ (1,8MB JS) giữ nguyên — đổi sang `defer`/nạp theo module cần thử riêng vì kiến trúc dùng hàm toàn cục và `onclick` trong HTML; chưa đo bằng mạng chậm/điện thoại thật; chưa có phân trang cho dữ liệu lớn; số liệu thời gian là trên máy cục bộ, chỉ dùng so sánh trước/sau.

## [Chưa phát hành] Bước 2 — Responsive toàn ứng dụng (chỉ CSS)
Phương pháp: đo trước/sau bằng `tests/e2e/ui-audit-b2.js` (tràn ngang, 19 tab × 10 cỡ: 320/360/375/390/430/768/1024/1366/1440/1920px) và `tests/e2e/ui-audit-b2-extra.js` (chữ bị cắt âm thầm, bảng tràn khung, nút chạm < 32px, modal vượt khung; 19 tab × 6 cỡ). Chạy: `CHROMIUM_PATH=<đường dẫn Chromium nếu cần> node tests/e2e/ui-audit-b2.js <thư-mục-gốc>`.
- **Sửa tràn ngang 320px — Đơn hoàn thành**: lưới 2 ô thống kê dùng `1fr` nên ô có chữ `nowrap` đẩy rộng 355px > 320px. Đổi sang `minmax(0,1fr)` + `min-width:0` (`src/modules/quality/quality.css`). Trước: 1 vi phạm; sau: 0 ở cả 10 cỡ.
- **Sửa chữ bị cắt — Đơn hàng 761–1023px**: bảng 13 cột `table-layout:fixed` theo % làm cột Số lượng/Ngày giao chỉ còn 28–38px ("0 thanh", ngày bị cắt). Đặt `min-width:1000px` cho `#ddTable` ở dải này, khung `.dd-table-wrap` tự cuộn ngang. Trước: 5 ô/hàng bị cắt; sau: 0.
- **Vùng chạm ≥ 34–36px** trên ≤1024px hoặc màn cảm ứng: chip lọc, nút trang, nút thao tác dòng (Điều hành SX trước đây 17–21px), nút ⋮, xoá, "Bật" thông báo, "Xem tất cả", "Xoá log", ô chọn sắp xếp Khách hàng; ô nhập trong bảng Lịch làm việc (chỉ thiết bị cảm ứng). Số nút < 32px ở 320–768px: 35 nhóm tab/cỡ → 0 (trừ ô nhập Lịch làm việc, chỉ tính khi giả lập cảm ứng — đã đo riêng: 0).
- File: thêm `src/styles/responsive-b2.css` (đăng ký trong `index.html` và `sw.js`, cache `sx-thanh-cai-v15`), sửa `quality.css`. Gỡ lớp mới = bỏ dòng `<link>` responsive-b2.css.
- Không đổi DOM, id, onclick, dữ liệu, Firebase, phân quyền. `functional.js` bản mới trùng khít bản trước khi sửa; `dp-ui.test.js` (23 nhóm) và `dp-step3.test.js` (24 nhóm) đạt.
- **Chưa kiểm**: TV Mode ở Full HD/4K (không đổi trong bước này), iPhone/Android thật (chỉ giả lập Chromium), 430px chỉ đo tràn ngang. Nút nổi (robot, ＋) vẫn nằm đè lên cuối danh sách trên mobile — chưa xử lý.

## [Chưa phát hành] Nâng cấp ERP/MES — rà soát giao diện toàn hệ thống (Header, Sidebar, laptop 1180px)
Phương pháp: đo trước/sau bằng `tests/e2e/ui-audit.js` (19 tab × 5 kích thước: 1440, 1180, 820, 390, 360px) trên Firebase giả lập. Trước: 3 tab tràn ngang ở laptop 1180px; sau: 0.
- **Global Header (≥1024px)**: đổi thứ tự hiển thị thành Tên tab → Ngày → Giờ → Đồng bộ → Tìm kiếm (+ nút lọc) → Thông báo → Tài khoản bằng CSS `order` (không đổi DOM, id, onclick). Thông báo + Tài khoản dạt phải ở màn rộng. Dưới 1024px giữ nguyên bố cục tablet/mobile cũ. File: `src/styles/header-erp.css`.
- **Sidebar**: gộp nhóm "Hệ thống" vào "Quản lý nhà máy" và đặt tên nhóm là **Quản trị** (Nhật ký thao tác, Cài đặt nằm trong nhóm này). Không thêm/xoá menu, giữ nguyên id + onclick + phân quyền. File: `src/components/Sidebar.js`.
- **Sửa tràn ngang laptop 1180px**: (1) hàng 6 ô thống kê ở Đơn hàng / Đơn hoàn thành chỉ dùng 6 cột khi ≥1280px, dưới đó 3 cột (`src/modules/orders/orders.css`); (2) biểu đồ donut + chú thích ở Tổng quan tự xuống dòng khi khung hẹp (`dashboard.css`, thêm class `ov-donut-row` ở `dashboard-view.js`).
- **Bảng Đơn hàng**: cột Thao tác cố định 56px (trước 33px ở 1180px làm nút ⋮ bị cắt mép, tiêu đề rớt 4 dòng); ≤1360px nới 2 cột ngày, cho Loại/Nguyên liệu xuống dòng. Ô bị cắt chữ ở 1180px (3 dòng đầu): 27 → 16.
- Thêm `tests/e2e/ui-audit.js` (đo tràn ngang, thứ tự Header, nhóm Sidebar, lỗi console).

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

## Nâng cấp UI/UX – Bước 2
Thêm `dp-ui.js`/`dp-ui.css` (thông báo 4 loại + chống trùng + lịch sử, trạng thái Loading/Empty/Error/Offline, chặn đóng nhầm modal), trạng thái đồng bộ "Ngoại tuyến" ở Header. Chi tiết: `UPGRADE-BUOC-2.md`.
