# BÀN GIAO GIAI ĐOẠN 2 — v2.7.0 (Lịch làm việc theo ngày)

## 1. Đã làm
Xem `docs/CHANGELOG.md` mục 2.7.0. Tóm tắt: 3 chế độ xem Ngày/Tuần/Tháng, danh mục ca (tạo/sửa giờ, nghỉ giữa ca, quân số tối thiểu, cố định/luân phiên), phân ca 1 người/hàng loạt/sao chép tuần trước/sao chép tháng trước/luân phiên/đổi ca 2 người, nhận diện nghỉ phép đã duyệt, cảnh báo trùng nghỉ phép, đăng ký tăng ca + thống kê, dashboard nhân lực, lịch sử điều chỉnh. Bảng "theo bộ phận" cũ giữ nguyên là chế độ đầu tiên.

## 2. File
**Thêm:** `src/modules/attendance/schedule-core.js` · `schedule-service.js` · `schedule-view.js` · `src/styles/schedule.css` · `tests/static/schedule-data.test.js` (32 nhóm) · `schedule-view.test.js` (21 nhóm) · `tests/static/helpers/fake-firebase.js`
**Sửa nhỏ:** `attendance-schedule.js` (đổi tên `renderLichLamViec` → `llvRenderSheets`, nội dung không đổi) · `attendance-service.js` & `sync-realtime.js` (móc đồng bộ nhánh mới) · `attendance-bulk.js` (lọc lịch sử) · `index.html` · `sw.js` (cache v21) · `version.json` · `tests/run-all.sh`

## 3. Kiểm thử
Toàn bộ 15 bộ test tĩnh đạt (gồm 11 bộ cũ, 3 bộ GĐ1, 2 bộ GĐ2), `verify-sw` đạt (199 tài nguyên), không trùng tên toàn cục, mọi file JS qua kiểm tra cú pháp. **Chưa kiểm thử trên thiết bị/trình duyệt thật và Firebase thật** — làm theo checklist mục 5.

## 4. Cần bạn xác nhận (không tự suy diễn)
1. **Nghỉ giữa ca & quân số tối thiểu mặc định = 0** (chưa có quy định) → chưa có cảnh báo thiếu cho tới khi Admin nhập ở tab "⚙️ Ca làm việc". Giờ ca Tăng ca mặc định 06:00–17:00 lấy theo mục chọn sẵn trong bảng cũ ("Tăng ca : 6h – 17h"). Loại ca (cố định/luân phiên) để trống, Admin chọn.
2. **Quân số tối thiểu là con số chung cho cả ca**, chưa tách theo bộ phận. Nếu cần "ca 1 của bộ phận Lò tối thiểu 5, bộ phận Kéo 3", báo mình để thêm `minByDept`.
3. **Ca mặc định (suy từ bảng bộ phận cũ) KHÔNG áp cho Chủ nhật và ngày lễ**; ngày đó chỉ tính khi Admin phân riêng. Nếu nhà máy làm Chủ nhật bình thường, báo mình đổi.
4. **Bảng cũ vẫn khớp nhân viên theo TÊN.** Lịch mới khớp theo mã nhân viên (`workerId`) cho phần phân ca riêng, nhưng ca mặc định vẫn dò theo tên từ bảng cũ. Đổi tên/trùng tên có thể khớp sai ca mặc định; chưa thêm `workerId` vào `lichLamViec[].rows[]` vì cần bạn đồng ý thay đổi cấu trúc cũ.
5. **Chỉ Admin phân ca/đăng ký tăng ca** (giữ như Lịch làm việc hiện có). Nếu muốn trưởng bộ phận (nhân viên) cũng phân ca được, cần thêm vai trò/quyền theo bộ phận.
6. **Sao chép tháng trước** theo ngày-trong-tháng (ngày d → ngày d), không giữ thứ trong tuần; **sao chép tuần trước** giữ nguyên thứ.
7. **Chưa làm:** in/xuất Excel riêng cho 3 chế độ xem mới (bảng bộ phận cũ vẫn in/xuất được như trước); chế độ TV điều hành cỡ chữ lớn; xếp ca tự động; cảnh báo nghỉ tối thiểu giữa 2 ca liên tiếp (cần quy định).
8. **Firebase Rules:** thêm đường dẫn `/data/shiftCatalog`, `/data/shiftAssign`, `/data/otReg` (nằm dưới `/data` nên thường đã được phép). Dữ liệu phân ca tăng theo thời gian (~60 người × 365 ngày/năm); nếu thấy chậm sau vài năm, mình sẽ làm lưu trữ theo năm.
9. **Sao lưu:** `backup.js` chưa gồm `shiftCatalog/shiftAssign/otReg/attMeta`.

## 5. Kiểm tra thực tế trước khi dùng chính thức
① Tab Lịch làm việc → "Theo bộ phận": bảng cũ vẫn như trước, sửa được như trước. ② Tab "⚙️ Ca làm việc": đặt quân số tối thiểu Ca 1 = số người thật. ③ Chế độ Ngày: ca nào thiếu phải hiện đỏ. ④ 2 điện thoại cùng đổi ca 2 ngày khác nhau của 1 người, xem cả hai còn. ⑤ Tắt mạng, đổi ca, bật mạng: tự gửi. ⑥ Tài khoản nhân viên/Viewer: không có nút sửa. ⑦ Tạo đơn nghỉ phép "Đã duyệt" cho 1 người → ngày đó hiện 🏖 và rời khỏi nhân lực ca; đơn "Chờ duyệt" thì không. ⑧ Xem tháng trên điện thoại.

## 6. Triển khai
Như GĐ1: sao lưu `/data` → gộp mã nguồn → chạy `tests/run-all.sh` (hoặc 5 test GĐ1–2) → đẩy GitHub Pages. APK Android nạp từ web nên không cần build lại. Dữ liệu cũ không bị đổi; quay lại bản cũ an toàn (3 nhánh mới sẽ bị bản cũ bỏ qua).

## 7. Tiếp theo — GĐ3 (Quản lý nhân sự) đề xuất
Dashboard biểu đồ; hồ sơ mở rộng (ngày cấp CCCD, thường trú, quản lý trực tiếp, ca mặc định → thay việc dò ca theo tên); hợp đồng + cảnh báo hết hạn + lịch sử gia hạn; lịch sử điều chuyển/đổi chức vụ; nhập Excel có kiểm tra trùng mã; thống kê theo độ tuổi/thâm niên. Chỉ thêm trường mới vào `workers[]` (tương thích), không đổi trường cũ.
