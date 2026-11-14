# BÀN GIAO GIAI ĐOẠN 1 — v2.6.0 (Ổn định dữ liệu & nâng cấp Chấm công)

## 1. Trạng thái so với yêu cầu
| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| **1** | Ổn định dữ liệu chấm công + nâng cấp tab Chấm công | ✅ **Hoàn thành, đã kiểm thử** |
| 1 (phụ) | Lỗi an toàn dữ liệu ở Nhân sự / Lịch làm việc / đồng bộ | ✅ Đã sửa (xem CHANGELOG mục 4, 5, 10) |
| **2** | Lịch làm việc: 3 chế độ xem (ngày/tuần/tháng), quản lý ca, nhân lực tối thiểu, đổi ca, dashboard nhân lực | ✅ **Hoàn thành v2.7.0, đã kiểm thử** (xem `docs/HANDOVER-GD2.md`) |
| **3** | Nhân sự: dashboard biểu đồ, hồ sơ mở rộng, hợp đồng, điều chuyển/chức vụ, nhập Excel, thống kê | ⏳ **Chưa làm** |
| 4–5 | Liên kết 3 phân hệ theo mã nhân viên; UI/UX toàn bộ | ⏳ Một phần (Chấm công đã liên kết với nghỉ phép đã duyệt + ca theo lịch) |

Lý do dừng ở GĐ1: yêu cầu nêu rõ "mỗi giai đoạn phải chạy ổn định trước khi sang giai đoạn tiếp theo". GĐ2 cần **mô hình dữ liệu mới** (lịch theo ngày, danh mục ca, quân số tối thiểu) — cần bạn chốt hướng ở mục 5 trước khi làm.

## 2. Sơ đồ luồng dữ liệu (hiện trạng sau GĐ1)
```
HR (workers[]  — dữ liệu gốc, khoá = worker.id)
   │  danh sách NV, bộ phận, chức vụ, ngày vào làm, trạng thái
   ├──────────────► CHẤM CÔNG  attendance/{YYYY-MM}/{workerId}/{ngày}
   │                  ▲   dùng: danh sách NV (lọc theo trạng thái/bộ phận hiện tại)
   │                  │   dùng: ca = Lịch làm việc (khớp TÊN — chưa khớp theo id, xem mục 5)
   │                  └── dùng: nghỉ phép ĐÃ DUYỆT (khớp workerId; đơn cũ khớp tên)
   ├──────────────► LỊCH LÀM VIỆC lichLamViec[].rows[{name,time,leave,...}]  (khớp theo TÊN)
   └──────────────► NGHỈ PHÉP nghiPhep[] / KỶ LUẬT kyLuat[]  (khoá workerId)

Ghi chấm công:  ô → attSetCell → outbox (localStorage, bền) → PATCH /data/attendance/{ym}/{wid}
                                         └→ audit → POST /attAudit/{ym}
Nhận:  SSE/poll → attOnRealtime / attOnSnapshot → chuẩn hoá → áp lại outbox → giao diện
Khoá kỳ: /data/attMeta/months/{ym}/lock   ·  Ghi chú: .../notes/{wid}  ·  Ngày lễ: /data/attMeta/holidays/{YYYY-MM-DD}
```
Quy tắc đã bảo đảm: công khoá theo `workerId` ⇒ chuyển bộ phận không mất lịch sử; nghỉ việc không xóa dữ liệu (xem `deleteWorker`); kỳ đã chốt không bị thay đổi do đổi ca/lịch (lịch làm việc không ghi vào công).

## 3. File đã sửa / thêm
**Thêm:** `src/modules/attendance/attendance-core.js` (logic thuần) · `attendance-bulk.js` (hộp thoại) · `src/styles/attendance.css` · `tests/static/attendance-data.test.js` · `attendance-view.test.js` · `hr-delete-sync.test.js` · `docs/HANDOVER-GD1.md`
**Viết lại:** `attendance-service.js` · `attendance-view.js` (giữ nguyên văn `parseCongValue`, `computeCongTotalStr`, `computeTotal`) · `attendance-export.js`
**Sửa nhỏ:** `src/services/sync.js` (khởi tạo snapshot mảng, chuẩn hoá mảng, móc chấm công) · `sync-realtime.js` (móc SSE/snapshot) · `hr-workers.js` (`deleteWorker`) · `attendance-schedule.js` (tắt seed) · `index.html` · `sw.js` (v20, bỏ 4 file ma) · `version.json` · `tests/run-all.sh` · `docs/CHANGELOG.md`

## 4. Kết quả kiểm thử
- **Mới:** `attendance-data` 37 nhóm · `attendance-view` 25 nhóm · `hr-delete-sync` 6 nhóm — đều đạt.
- **Cũ:** dp-step3, dp-ui, machine-assign, manual-cleanup, phase3-insight, phase4-notif-tv, quality-alerts, trace-engine, trace-timeline — đều đạt. `verify-sw` **từ FAIL → đạt**.
- Đối chứng lỗi: test chạy mã **gốc** và tái hiện (a) mất ô khi 2 máy sửa khác ngày, (b) xóa bản ghi bị sống lại.
- Đã phủ các tình huống bắt buộc: chấm công qua nhiều tháng/năm · tổng công & tăng ca · khoá/mở khoá · 2 thiết bị · mất mạng rồi có lại · tải lại khi chưa gửi · phân quyền Admin/Nhân viên/Viewer · chuyển bộ phận · nghỉ phép đã duyệt · xuất/in.
- **CHƯA kiểm thử được trong môi trường này:** chạy trên trình duyệt/thiết bị thật (Chrome Android, PWA cài đặt, Windows), Firebase thật, SheetJS ghi file .xlsx thật (test dùng Firebase giả lập + jsdom). **Cần thử thực tế trước khi dùng chính thức** (mục 6).
- Bộ `tools/refactor/verify.js` (so với tag `baseline-v2.5.141`) và các test `materials-*`, `prodlots-core` trong `run-all.sh` **không chạy được** vì ZIP không có `.git` và thiếu các file tương ứng.

## 5. Cần bạn xác nhận (không tự suy diễn)
1. **4 file bị thiếu trong ZIP** — `src/services/dp-store.js`, `src/modules/materials/{materials-core,prodlots-core,materials-view}.js` — CHANGELOG cũ nói chúng tồn tại nhưng ZIP không có và `index.html` không nạp. Nếu bản đang chạy thật CÓ các file này thì **đừng ghi đè** bằng ZIP này; hãy gộp riêng các file sửa ở mục 3. Mình đã bỏ chúng khỏi `sw.js` để `verify-sw` đạt — nếu chúng có thật, thêm lại vào `sw.js` và `index.html`.
2. **Ngưỡng cảnh báo** `ATT_RULES` (đầu `attendance-core.js`): tăng ca >4h/ngày, >40h/tháng, >1 công/ngày — chỉ cảnh báo, không chặn. Cần quy định của công ty.
3. **Chủ nhật & ngày lễ không tính là "thiếu dữ liệu"**; ngày lễ do Admin khai báo (nút "4 ngày lễ dương lịch cố định" chỉ thêm 1/1, 30/4, 1/5, 2/9; lễ âm lịch tự nhập). Nếu nhà máy làm Chủ nhật bình thường, cho mình biết để đổi.
4. **"Thiếu công"** = thiếu DỮ LIỆU chấm công. Chưa có định mức công chuẩn/tháng nên không đánh giá thiếu theo số công. File "Số liệu lương" chỉ tổng hợp, **không có công thức lương**.
5. **"Sao chép mẫu theo ca"** mình hiểu là "Điền theo ca": điền một giá trị cho các nhân viên thuộc ca đã chọn (ca lấy từ Lịch làm việc). Nếu ý bạn là sao chép cả mẫu nhiều ngày từ một người sang cả ca, báo mình.
6. **Lịch làm việc đang khớp nhân viên theo TÊN**, không theo mã (hiện dữ liệu `rows[]` chỉ có tên). Đổi sang mã cần thêm trường `workerId` vào từng dòng — thay đổi cấu trúc, cần bạn đồng ý (GĐ2 sẽ thêm trường tương thích, không xoá trường cũ). Trường hợp trùng tên/đổi tên sẽ khớp sai cho tới khi làm.
7. **Firebase Rules**: nhánh mới `/attAudit` (cấp cao nhất) và `/data/attMeta`. Nếu Rules của bạn chỉ cho phép đường dẫn cụ thể thì cần thêm; nếu chưa thêm, chấm công vẫn chạy bình thường, nhật ký chi tiết nằm trong hàng đợi cục bộ (tối đa 3000 bản ghi) và nhật ký chung `log()` vẫn ghi. **Khoá kỳ chỉ được chặn ở giao diện và tầng JS** — người có quyền ghi trực tiếp Firebase vẫn sửa được; chặn tuyệt đối cần Rules phía máy chủ (nằm ngoài mã nguồn).
8. **Sao lưu**: `backup.js` chưa gồm `attMeta` (khoá kỳ/ghi chú/ngày lễ). Nên thêm khi bạn đồng ý.

## 6. Hướng dẫn triển khai
1. **Sao lưu Firebase** (xuất JSON `/data`) trước khi triển khai.
2. Gộp mã nguồn mới vào repo (xem cảnh báo mục 5.1), chạy `NODE_PATH=tests/node_modules node tests/static/attendance-data.test.js` (và 2 test mới còn lại) để chắc chắn.
3. Đẩy lên GitHub Pages. Người dùng mở app sẽ tự nhận cache SW `v20` + `version.json 2.6.0` (APK Android nạp từ web nên **không cần build lại APK**).
4. **Kiểm tra thực tế (30 phút):** ① 2 điện thoại cùng sửa 2 ngày khác nhau của 1 người, xem cả hai còn ② tắt mạng, nhập 3 ô, tải lại trang, bật mạng, xem ô còn và tự lên ③ chốt kỳ bằng tài khoản nhân viên, thử mở khoá bằng nhân viên (phải bị chặn) và bằng Admin ④ tài khoản Viewer chỉ xem ⑤ xuất Excel và in A4 trên Windows ⑥ nhìn bảng trên điện thoại (cột tên phải cố định khi cuộn ngang).
5. **Dữ liệu cũ tương thích 100%:** không di chuyển/đổi dữ liệu. Nếu cần quay lại: khôi phục mã cũ; `attMeta`/`attAudit` là nhánh riêng, không ảnh hưởng bản cũ (bản cũ bỏ qua nhánh này, nhưng cũng sẽ không biết kỳ đã chốt).

## 7. Đề xuất cho GĐ2 (chờ xác nhận)
Thêm nhánh **mới, tương thích**: `/data/shiftCatalog` (danh mục ca + giờ + nghỉ giữa ca + quân số tối thiểu), `/data/shiftAssign/{YYYY-MM-DD}/{workerId}` (phân ca theo ngày, ghi theo từng ô như chấm công), thêm `workerId` tùy chọn vào `lichLamViec[].rows[]`. Giữ nguyên `lichLamViec` hiện có để các màn hình khác (dashboard, QR, điều hành SX) không vỡ; 3 chế độ xem ngày/tuần/tháng đọc từ nhánh mới, rơi về `lichLamViec` khi chưa có.
