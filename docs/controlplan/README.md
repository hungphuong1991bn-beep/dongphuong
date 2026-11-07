# ControlPlan – Hệ thống kiểm soát chất lượng (tab trong "Chất lượng")

Tích hợp trực tiếp vào source hiện tại: menu **Chất lượng ▸ ControlPlan QC**. Nhân viên điền phiếu ngay trên phần mềm; Excel chỉ là nguồn nhập lịch sử và đối chiếu.

> **Lưu ý quan trọng:** phân hệ "Chất lượng/QC" mà tài liệu yêu cầu nhắc tới **chưa tồn tại** trong source (thư mục `modules/quality` là kiểm thành phẩm cũ). Vì vậy ControlPlan được tạo mới làm tab trong nhóm "Chất lượng", không sửa/ghi đè chức năng quality cũ.

## 1. Danh sách file

**Tạo mới** (`src/modules/quality/`)
| File | Vai trò |
|---|---|
| `cp-seed.js` | Danh mục chuẩn sinh từ workbook: 13 dòng Control Plan, 7 PFMEA, 13 mã lỗi, bảng AQL, 9 bước 8D |
| `cp-core.js` | Dữ liệu, phân quyền, hàng đợi đồng bộ, liên kết đơn/lô/QR, tra AQL, KPI/lọc |
| `cp-view.js` | Điều hướng, Tổng quan (KPI, bộ lọc, 13 thẻ), danh sách phiếu, xuất Excel/PDF |
| `cp-forms.js` | Form nhập (Đùn/Rút/Đánh bóng/Cắt/Độ thẳng, FQC, NCR, HOLD, 8D), kiểm tra dữ liệu, quy trình NG |
| `cp-master.js` | Control Plan, PFMEA, AQL, mã lỗi, "Cần kiểm tra", Quản trị, **engine nhập Excel** |
| `cp-reports.js` | Báo cáo OK/NG nhiều chiều, HOLD/NCR/8D, xu hướng, xuất Excel/PDF |
| `cp.css` | Giao diện (mobile/tablet/desktop) |
| `data/cp-import-dataset.json` | Bộ dữ liệu 1.726 phiếu lịch sử (sinh từ Excel, ~800KB, tải khi bấm Nhập) |
| `tools/controlplan/build_dataset.py` | Script đọc Excel → kiểm tra header → sinh seed + dataset + báo cáo |
| `tests/e2e/controlplan.js` | Kiểm thử trình duyệt (83 mục) |
| `docs/controlplan/*` | Tài liệu này, IMPORT-REPORT.md, TEST-RESULTS.md, import-run-log.txt |

**Sửa nhỏ (chỉ thêm dòng)**: `index.html` (CSS + 6 script), `sw.js` (ASSETS), `src/core/router.js` (tiêu đề + hàm vẽ tab), `src/components/Sidebar.js` (1 mục menu), `src/services/sync.js` (1 dòng `cpOnBoot`), `src/services/sync-realtime.js` (2 dòng: poll + SSE `/data/cpRecords`).

## 2. Cấu trúc dữ liệu

```
Firebase  /data/cpRecords/{id}   (từng bản ghi riêng; không bao giờ ghi đè cả nhánh /data)
localStorage  sx_cp_v1 (bản đệm) · sx_cp_q_v1 (hàng đợi chờ gửi) · sx_cp_conf_v1 (xung đột)

Bản ghi chung: id, type, rev, createdAt/By, updatedAt/By, hist[] (nhật ký: ai, lúc nào, làm gì, lý do, thay đổi gì)
                 source: 'excel' (lịch sử nhập) | 'app' (nhập trên phần mềm)   src:{sheet,row} với bản Excel

type=chk  (form: dun|rut|danhbong|cat|dothang)  ── lines[ {n,time,thick,width,length,appearance,result,...} ]
type=fqc  ── lotQty, level, aqlMajor/Minor/Critical, majorNG/minorNG/criticalNG, result (tự tính)
type=hold ── status: HOLD → Đang điều tra → Chờ phê duyệt → RELEASE | Phế phẩm ;  verifyId, ncrId
type=ncr  ── status: Mở → Đang xử lý → Chờ phê duyệt → Đã đóng ;  holdId, sourceId, eightdId
type=eightd ── steps[D0..D8 {owner,due,evidence,status}], w5h2
type=cp | pfmea | defect | aql  (danh mục)      type=importLog (nhật ký nhập)

Liên kết:  Đơn hàng (orderId) ─ Mã SP (productCode / qrProducts) ─ Mã lô (lot / sổ máy) ─ Phiếu chk/FQC
              └─ NG ─▶ HOLD ◀─▶ NCR ◀─▶ 8D        (chỉ nối theo KHOÁ; không ghép theo tên khách/quy cách)
```

Đánh đổi: `/data/cpRecords` nằm trong nhánh `/data` nên mỗi lần app đọc `/data` sẽ tải thêm ~1,7MB dữ liệu lịch sử. Nếu chậm trên mạng yếu, nên tách nhánh riêng (cần mở Rule mới).

## 3. Quy tắc nhập Excel (xem IMPORT-REPORT.md và import-run-log.txt)
- Chỉ **thêm** bản ghi còn thiếu; mã cố định theo `sheet + dòng` → chạy lại không trùng, không ghi đè phiếu đã có/đã sửa.
- Trước khi nhập: tải file sao lưu JSON; sau khi nhập: đối chiếu số lượng từng sheet, lấy mẫu 12 phiếu so với máy chủ, ghi nhật ký.
- Giá trị gốc luôn được giữ. Dòng không chắc chắn (kết luận lạ, ngày/lô lệch, số không đọc được…) vào mục **🔍 Cần kiểm tra**; không xoá, không suy đoán. 68 dòng không đủ dữ liệu (dòng mẫu trống) được liệt kê trong IMPORT-REPORT.md, không nhập.
- "Mã SP" trong Excel thực chất là Xưởng (Xưởng 1/2/3) nên nhập vào trường Xưởng; cột "Lô" là mã ngày (ddmmyyyy), không coi là mã lô liên kết sổ máy → các phiếu lịch sử đều ở trạng thái **CHƯA XÁC ĐỊNH** liên kết đơn hàng.

## 4. Hướng dẫn nhân viên
1. Menu **Chất lượng ▸ ControlPlan QC** → thẻ biểu mẫu cần dùng (Đùn, Rút, Đánh bóng, Cắt, Độ thẳng, FQC) → **Mở biểu mẫu** → **➕ Tạo phiếu**.
2. Ngày, giờ, ca, tên bạn được điền sẵn. Chọn đơn hàng (gõ để tìm) **hoặc quét/dán mã đơn, mã lô, mã QR rồi bấm Tra** – phần mềm điền khách hàng, quy cách, mã SP, lô. Không tìm thấy thì để **CHƯA XÁC ĐỊNH**, đừng đoán.
3. Nhập số đo (dấu phẩy hay chấm đều được), chọn mã lỗi ngoại quan từ danh sách (tự hiện tiêu chuẩn đạt + phản ứng), bấm **OK/NG** cho từng dòng. Bấm **➕ Thêm dòng đo** cho mẫu tiếp theo.
4. Ô đỏ = chưa hợp lệ. **💾 Lưu nháp** bất cứ lúc nào; **✔ Hoàn tất** khi đủ.
5. Nếu có NG, hộp thoại **PHÁT HIỆN NG** hiện ra: nhập **số lượng ảnh hưởng**, chọn QA/QC phụ trách, tick **HOLD / NCR / 8D** cần mở rồi **Xác nhận**. Phần mềm không tự kết luận nguyên nhân và không tự Release.
6. Phiếu đã hoàn tất chỉ Trưởng QC/QA sửa được và **bắt buộc ghi lý do**. Mất mạng vẫn lưu được (góc phải hiện "chờ đồng bộ"); có mạng tự gửi lên.

## 5. Hướng dẫn Trưởng QC / QA / Quản trị
- **Phân quyền** (Quản trị ▸ Phân quyền QC): Tài khoản nhân viên (staff) đang dùng trong sản xuất **mặc định có TOÀN QUYỀN trong tab ControlPlan** (nhập, sửa có lý do, xác nhận NCR, RELEASE/phế phẩm, duyệt NCR, đóng 8D, sửa danh mục). Riêng **Quản trị** (phân quyền, nhập Excel) chỉ Admin. Có thể hạ từng tài khoản xuống "hạn chế" hoặc "chỉ xem".
- Nhân viên hạn chế: tạo phiếu, mở HOLD/NCR/8D, điều tra. Mức mặc định (toàn quyền nhập/sửa): + sửa phiếu hoàn tất (có lý do), xác nhận hiệu lực NCR, xử lý "Cần kiểm tra", sửa Control Plan/PFMEA. **QA/Admin: RELEASE, phế phẩm, duyệt NCR, đóng 8D.**
- **RELEASE lô** cần: trạng thái "Chờ phê duyệt", quyết định = RELEASE, có kết quả điều tra, đã xác định lô, **đã gắn phiếu kiểm tra lại đạt (OK) đúng lô và sau thời điểm HOLD**, NCR liên quan đã xử lý xong. Thiếu điều kiện nào, nút báo rõ lý do.
- **NCR**: Mở → Đang xử lý → (xác nhận hiệu lực) → Chờ phê duyệt → QA đóng.
- **8D**: D0–D8 mỗi bước có người phụ trách, hạn, bằng chứng, trạng thái; bước quá hạn được báo ở Báo cáo; chỉ đóng khi D0–D7 xong và D8 có kết luận.
- **Xung đột đồng bộ** (bấm nhãn đồng bộ): nếu hai người sửa cùng phiếu, bản máy chủ được giữ, bản của người sau được cất để khôi phục thủ công.
- **Nhập Excel**: Quản trị ▸ **Nhập dữ liệu Excel vào phần mềm** (tự sao lưu trước, xem log từng bước). Nút **Tải sao lưu** tải JSON bất kỳ lúc nào.
- Chức năng sao lưu Firebase tự động của app vẫn tắt theo cấu hình của bạn; ControlPlan không dùng nó.

## 6. Giới hạn đã biết / cần anh chị quyết
- Bảng AQL trong workbook là **bảng rút gọn Level II**, không có quy tắc chuyển cỡ mẫu; Level khác II bị chặn, không suy diễn. Critical không chọn AQL = không chấp nhận lỗi nào (quy tắc an toàn của phần mềm). Nên đối chiếu bảng với tiêu chuẩn được duyệt.
- 118 dòng Check_Cat có kết luận "Dương kích thước" — không rõ là OK hay NG; hiện **không tính OK/NG** (hiện ở "Cần kiểm tra"). Cần QC lead xác nhận nghĩa.
- Cột RPN trong Excel PFMEA để trống; phần mềm tự tính S×O×D nhưng không tự đặt ngưỡng hành động.
- Chưa có mã biểu mẫu cho một số dòng Control Plan (hiển thị "chưa quy định").
