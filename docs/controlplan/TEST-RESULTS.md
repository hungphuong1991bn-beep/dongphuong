# Kết quả kiểm thử ControlPlan

Chạy: `node tests/e2e/controlplan.js . <thư-mục-xuất>` (Playwright + Firebase giả có SSE/ETag, 3 thiết bị: desktop, tablet 820px, điện thoại 390px).

**Tổng: 83/83 đạt.**

Đã chạy thêm bộ kiểm thử cũ: `tests/static/verify-sw.js` (đạt) và `tests/e2e/functional.js` (đăng nhập, phân quyền, đơn hàng, đồng bộ 2 thiết bị — không có mục lỗi).

## 1 Tab

| Kết quả | Nội dung |
|---|---|
| ✅ | tab ControlPlan hiển thị |
| ✅ | có mục menu Chất lượng |
| ✅ | 13 thẻ biểu mẫu |
| ✅ | 4 nhóm A-D |
| ✅ | không lỗi JS khi mở |

## 2 Dashboard

| Kết quả | Nội dung |
|---|---|
| ✅ | KPI tổng = số phiếu đã nhập |
| ✅ | KPI OK+NG+UNK = tổng |
| ✅ | lọc theo công đoạn Đùn |
| ✅ | lọc ngày + OK/NG |
| ✅ | lọc theo khách hàng (gộp hoa/thường) |
| ✅ | không lỗi JS |

## 3 Import

| Kết quả | Nội dung |
|---|---|
| ✅ | số phiếu theo sheet khớp báo cáo |
| ✅ | máy chủ có đủ bản ghi |
| ✅ | nhật ký nhập ok |
| ✅ | danh mục: CP 13 / PFMEA 7 / mã lỗi 13 / AQL 1 |
| ✅ | chạy lại không trùng/không thêm (idempotent) |
| ✅ | số bản ghi chk trên máy chủ không đổi sau chạy lại |
| ✅ | nhập lại không ghi đè phiếu đã sửa |
| ✅ | phiếu Excel gắn nhãn nguồn + vị trí gốc |
| ✅ | dữ liệu lạ không bị suy diễn (UNK giữ dạng gốc) |

## 4 Phiếu

| Kết quả | Nội dung |
|---|---|
| ✅ | tự điền ngày/nhân viên/ca/giờ |
| ✅ | chặn hoàn tất khi thiếu dữ liệu |
| ✅ | báo lỗi ngay khi nhập chữ vào ô số |
| ✅ | chấp nhận số thập phân dấu phẩy |
| ✅ | nhiều dòng đo trên 1 phiếu |
| ✅ | lưu nháp |
| ✅ | nháp không tính vào KPI |
| ✅ | hoàn tất: có mã phiếu tự cấp + kết luận OK |
| ✅ | nhật ký thay đổi trên phiếu |
| ✅ | chưa liên kết đơn → CHƯA XÁC ĐỊNH (không tự ghép) |
| ✅ | phiếu đã hoàn tất mở ở chế độ chỉ đọc |
| ✅ | sửa phiếu hoàn tất bắt buộc lý do |
| ✅ | sửa có lý do → ghi nhật ký |

## 5 NG

| Kết quả | Nội dung |
|---|---|
| ✅ | NG có mã lỗi → hợp lệ & kết luận NG |
| ✅ | hộp thoại NG tự hiện |
| ✅ | bắt buộc nhập số lượng ảnh hưởng |
| ✅ | tự tạo HOLD + NCR + 8D, liên kết nhau |
| ✅ | NCR tự cấp số, KHÔNG tự điền nguyên nhân |
| ✅ | phiếu NG không bị tự đổi thành OK |

## 6 HOLD

| Kết quả | Nội dung |
|---|---|
| ✅ | RELEASE bị chặn khi chưa có phiếu kiểm tra lại đạt |
| ✅ | có phiếu OK cùng lô → chỉ còn điều kiện NCR chưa đóng |
| ✅ | nhân viên QC không có quyền RELEASE |
| ✅ | QC tự RELEASE → bị từ chối |
| ✅ | nhân viên sản xuất (không qcRole) chỉ xem |
| ✅ | QA phê duyệt & đóng NCR |
| ✅ | QA RELEASE khi đủ điều kiện |

## 7 8D

| Kết quả | Nội dung |
|---|---|
| ✅ | 9 bước D0–D8 có đủ trường |
| ✅ | không đóng khi chưa xong các bước |
| ✅ | bước quá hạn được đếm |

## 8 AQL

| Kết quả | Nội dung |
|---|---|
| ✅ | tra theo bảng workbook (lô 500) |
| ✅ | Level khác II → cảnh báo, không suy diễn |
| ✅ | lô ngoài bảng → báo lỗi |
| ✅ | Critical không chọn AQL → không chấp nhận lỗi nào |

## 9 FQC

| Kết quả | Nội dung |
|---|---|
| ✅ | kết luận tự tính từ AQL (NG khi vượt Ac) |
| ✅ | đạt khi số lỗi ≤ Ac |
| ✅ | số lỗi lớn hơn cỡ mẫu bị báo lỗi |
| ✅ | lưu FQC đạt |

## 10 Danh mục

| Kết quả | Nội dung |
|---|---|
| ✅ | 13 mã lỗi, mã lỗi tự điền tiêu chuẩn/phản ứng |
| ✅ | PFMEA RPN = S×O×D |
| ✅ | RPN rỗng khi thiếu S/O/D (không tự bịa) |
| ✅ | Control Plan có nút mở đúng phiếu |
| ✅ | mọi màn hình danh mục/báo cáo vẽ được không lỗi |

## 11 Báo cáo

| Kết quả | Nội dung |
|---|---|
| ✅ | tổng theo công đoạn = tổng phiếu |
| ✅ | có thống kê khách hàng/mã lỗi/nhân viên/HOLD/8D quá hạn |
| ✅ | xuất Excel |
| ✅ | xuất PDF (cửa sổ in) |

## 12 Đồng bộ

| Kết quả | Nội dung |
|---|---|
| ✅ | thiết bị B nhận đủ dữ liệu từ máy chủ |
| ✅ | phiếu mới ở A hiện trên B (realtime) |
| ✅ | B giao diện tablet không tràn ngang |
| ✅ | mất mạng: vẫn lưu được và báo chờ đồng bộ |
| ✅ | chưa có trên máy chủ khi offline |
| ✅ | có mạng lại: tự gửi lên máy chủ |
| ✅ | đồng bộ không ghi đè nhánh khác (orders còn nguyên) |
| ✅ | xung đột sửa đồng thời: giữ bản máy chủ, cất bản của B (không mất âm thầm) |
| ✅ | máy chủ giữ bản A |

## 13 UI

| Kết quả | Nội dung |
|---|---|
| ✅ | điện thoại: form không tràn ngang |
| ✅ | nút bấm đủ lớn cho cảm ứng (≥40px) |

## 13 Hồi quy

| Kết quả | Nội dung |
|---|---|
| ✅ | các tab cũ vẫn mở bình thường, không lỗi JS |
| ✅ | quay lại ControlPlan sau khi đi tab khác |
| ✅ | đơn hàng cũ không bị ảnh hưởng |
| ✅ | không lỗi JS toàn phiên (A,B,mobile) |

## 13 Quyền

| Kết quả | Nội dung |
|---|---|
| ✅ | nhân viên SX (chưa gán qcRole): xem được, không có nút tạo phiếu |
| ✅ | nhân viên SX không thấy mục Quản trị |

## Chưa kiểm thử được
- Quét mã vạch bằng camera/đầu đọc thật (chỉ kiểm thử tra mã nhập tay qua `cpResolveCode`).
- Máy in/xuất PDF thật (chỉ kiểm thử mở cửa sổ in).
- Firebase thật với Rules của công ty (kiểm thử trên Firebase giả; đường ghi `/data/cpRecords/{id}` nằm trong nhánh `/data` đã có Rules).
- Chưa có dữ liệu thật cho FQC / NCR / HOLD (3 sheet Excel chỉ có tiêu đề) nên không có gì để nhập cho các biểu mẫu này.
