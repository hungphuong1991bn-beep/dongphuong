# Báo cáo nhập dữ liệu Excel → ControlPlan

- File nguồn: `ControlPlan_AQL_Checksheet.xlsx` (SHA-256 `7e31822ac8e8f19a3a9448bc1770c3c287a7809d16baa2f0f2d3b61bd2cb10ca`)
- Công cụ: `tools/controlplan/build_dataset.py` (chạy lại cho kết quả giống hệt)

## 1. Số dòng theo sheet

| Sheet Excel | Dòng có dữ liệu | Đã chuẩn bị nhập | Bỏ qua (dòng mẫu trống) | Cần kiểm tra |
|---|---:|---:|---:|---:|
| Check_Dun | 172 | 169 | 3 | 6 |
| Check_Rut | 769 | 748 | 21 | 24 |
| Check_DanhBong | 514 | 478 | 36 | 13 |
| Check_Cat | 189 | 189 | 0 | 118 |
| ĐỘ thẳng | 150 | 142 | 8 | 4 |
| Control Plan | 13 | 13 | 0 | 0 |
| PFMEA | 7 | 7 | 0 | 0 |
| AQL | 15 mã × 16 mức AQL | bảng đầy đủ | 0 | 1 (xem §4) |
| Danh_muc_ma_loi | 13 | 13 | 0 | 0 |
| 8D | 9 | 9 (mẫu 9 bước) | 0 | 0 |
| 00_MUC_LUC | 12 | điều hướng | 0 | 0 |
| FQC_AQL, NCR, HOLD_RELEASE | 0 | 0 | 0 | 0 |  ← chỉ có dòng tiêu đề trong workbook, **không có dữ liệu lịch sử** |

**Tổng 5 sheet phiếu: 1794 dòng = 1726 nhập + 68 bỏ qua.** (Kiểm tra đẳng thức: True)

## 2. Ánh xạ cột (đã xác minh tiêu đề từng sheet, không dựa số thứ tự mù)

**Check_Dun**

| Cột Excel | Trường ứng dụng |
|---|---|
| Ngày | date |
| Khách Hàng | customer |
| Quy Cách | spec |
| Ca | shift |
| Mã SP | **workshop** (xưởng) — cột này chứa "Xưởng 1/2/3", KHÔNG phải mã sản phẩm; không có productCode/orderId/mã lô SX → liên kết = CHƯA XÁC ĐỊNH |
| Lô | lot (mã ngày ddmmyyyy; Excel đã đổi thành số/ngày nên chuẩn hoá lại 8 chữ số; KHÔNG phải mã lô sản xuất thật) |
| Giờ | lines[].time (+ t = HH:MM) |
| Mẫu | lines[].n |
| Dày | lines[].thick |
| Rộng | lines[].width |
| Ngoại quan | lines[].appearance (OK) hoặc appearanceNote (mô tả tự do) |
| Kết luận | lines[].result (OK/NG/UNK) + resultRaw |
| QC | inspector |

**Check_Rut**

| Cột Excel | Trường ứng dụng |
|---|---|
| Ngày | date |
| Khách Hàng | customer |
| Quy cách | spec |
| Ca | shift |
| Mã SP | **workshop** (xưởng) — cột này chứa "Xưởng 1/2/3", KHÔNG phải mã sản phẩm; không có productCode/orderId/mã lô SX → liên kết = CHƯA XÁC ĐỊNH |
| Lô | lot (mã ngày ddmmyyyy; Excel đã đổi thành số/ngày nên chuẩn hoá lại 8 chữ số; KHÔNG phải mã lô sản xuất thật) |
| Giờ | lines[].time (+ t = HH:MM) |
| Mẫu | lines[].n |
| Dày | lines[].thick |
| Rộng | lines[].width |
| Dài | lines[].length |
| Ngoại quan | lines[].appearance (OK) hoặc appearanceNote (mô tả tự do) |
| Kết luận | lines[].result (OK/NG/UNK) + resultRaw |
| QC | inspector |

**Check_DanhBong**

| Cột Excel | Trường ứng dụng |
|---|---|
| Ngày | date |
| Khách hàng | customer |
| Quy cách | spec |
| Ca | shift |
| Mã SP | **workshop** (xưởng) — cột này chứa "Xưởng 1/2/3", KHÔNG phải mã sản phẩm; không có productCode/orderId/mã lô SX → liên kết = CHƯA XÁC ĐỊNH |
| Lô | lot (mã ngày ddmmyyyy; Excel đã đổi thành số/ngày nên chuẩn hoá lại 8 chữ số; KHÔNG phải mã lô sản xuất thật) |
| Giờ | lines[].time (+ t = HH:MM) |
| Mẫu | lines[].n |
| Dày | lines[].thick |
| Rộng | lines[].width |
| Dài | lines[].length |
| Ngoại quan | lines[].appearance (OK) hoặc appearanceNote (mô tả tự do) |
| Kết luận | lines[].result (OK/NG/UNK) + resultRaw |
| QC | inspector |

**Check_Cat**

| Cột Excel | Trường ứng dụng |
|---|---|
| Ngày | date |
| Khách Hàng | customer |
| Quy cách | spec |
| Ca | shift |
| Mã SP | **workshop** (xưởng) — cột này chứa "Xưởng 1/2/3", KHÔNG phải mã sản phẩm; không có productCode/orderId/mã lô SX → liên kết = CHƯA XÁC ĐỊNH |
| Lô | lot (mã ngày ddmmyyyy; Excel đã đổi thành số/ngày nên chuẩn hoá lại 8 chữ số; KHÔNG phải mã lô sản xuất thật) |
| Giờ | lines[].time (+ t = HH:MM) |
| Mẫu | lines[].n |
| Dày | lines[].thick |
| Rộng | lines[].width |
| Dài | lines[].length |
| Ngoại quan | lines[].appearance (OK) hoặc appearanceNote (mô tả tự do) |
| Kết luận | lines[].result (OK/NG/UNK) + resultRaw |
| QC | inspector |

**ĐỘ thẳng**

| Cột Excel | Trường ứng dụng |
|---|---|
| Ngày | date |
| Xưởng Sản Xuất | workshop nếu là "Xưởng N"; nếu là số/ngày thì là mã ngày → lot |
| Khách Hàng | customer |
| Quy cách | spec |
| Độ thẳng cạnh | lines[].edge |
| Độ thẳng mặt | lines[].face |
| Độ vểnh | lines[].warp |
| Độ vặn | lines[].twist |
| Tiêu chuẩn | standard |
| OK/NG | lines[].result |
| Người kiểm | inspector |

## 3. Chuẩn hoá đã áp dụng (không đổi ý nghĩa; chữ gốc vẫn lưu ở `rawDiff` / `lines[].raw` / `resultRaw`)

- Ca: `Ca1`, `ca 1`, `Ca 1 ` → `Ca 1`. Xưởng: `xưởng  1` → `Xưởng 1`. Tên QC: gộp chỉ khác hoa/thường (`Hà văn Tú` → `Hà Văn Tú`).
- Số đo ghi dấu phẩy (`7,10`) → 7.1 (chữ gốc giữ trong `lines[].raw`). Số đo không đọc được (`4*87`, `.124.98`, `302+3`) → để trống, giữ chữ gốc, gắn cờ cần kiểm tra.
- Tên khách hàng: chỉ cắt khoảng trắng thừa; **không** sửa chính tả. Phần mềm gộp khi thống kê bằng khoá không phân biệt hoa/thường/khoảng trắng.
- Kết luận: `Đạt/ĐẠT/OK` → OK; `NG/Không Đạt` → NG; còn lại → UNK (**không suy diễn**).

## 4. Điểm cần người có thẩm quyền xác nhận

- 120 dòng: Kết luận không phải Đạt/NG: "…"
- 33 dòng: Ngoại quan ghi tự do (chưa gán mã NG-xx): "…"
- 4 dòng: Ngày YYYY-MM-DD không khớp mã ngày ở cột Lô (…)
- 3 dòng: Ngày YYYY-MM-DD ở tương lai so với ngày lập dữ liệu (YYYY-MM-DD)
- 2 dòng: Số đo không đọc được (Dày): "…"
- 2 dòng: Số đo không đọc được (Dài): "…"
- 1 dòng: Giờ không đọc được: "…"
- 1 dòng: Thiếu kết luận
- 1 dòng: Số đo không đọc được (Rộng): "…"
- 1 dòng: Chưa có kết luận OK/NG

- **AQL**: workbook chỉ có Level II (suy ra từ khoảng quy mô lô 2–8=A … 500.001+=Q); bảng AQL 0.25–10 ghép với bảng AQL 0.01–0.15 theo thứ tự dòng; workbook tự ghi "bảng rút gọn". Giá trị Ac/Re được giữ nguyên, **chưa đối chiếu với ISO 2859-1 gốc**.
- **Control Plan** dòng "Nguyên liệu" (FR-IN-01) không có biểu mẫu tương ứng trong 13 mục nghiệp vụ → hiển thị nhưng không có nút mở.
- **PFMEA**: cột RPN trong workbook để trống → phần mềm tự tính S×O×D; "Hạn hoàn thành" để trống.

## 5. Dòng bỏ qua (không nhập — kèm nội dung gốc, không bị xoá khỏi workbook)

| Sheet | Dòng | Lý do | Nội dung gốc |
|---|---:|---|---|
| Check_Dun | 174 | Dòng mẫu trống: chỉ có ngày/kết luận/tên QC điền sẵn, không có khách hàng, quy cách hay số đo | 2026-11-06 ‖ Hà Văn Tú |
| Check_Dun | 175–176 | Dòng mẫu trống: chỉ có ngày/kết luận/tên QC điền sẵn, không có khách hàng, quy cách hay số đo | Đạt ‖ Đạt ‖ Hà Văn Tú |
| Check_Rut | 755–775 | Dòng mẫu trống: chỉ có ngày/kết luận/tên QC điền sẵn, không có khách hàng, quy cách hay số đo | Hà Văn Tú |
| Check_DanhBong | 483–518 | Dòng mẫu trống: chỉ có ngày/kết luận/tên QC điền sẵn, không có khách hàng, quy cách hay số đo | Hà Văn Tú |
| ĐỘ thẳng | 146–150 | Dòng mẫu trống: chỉ có giá trị mặc định (Tiêu chuẩn/Người kiểm), không có ngày hay kết quả đo | 0,50 - 1mm ‖ Hà Văn Tú |
| ĐỘ thẳng | 151–153 | Dòng mẫu trống: chỉ có giá trị mặc định (Tiêu chuẩn/Người kiểm), không có ngày hay kết quả đo | Hà Văn Tú |

## 6. Dòng cần kiểm tra (đã nhập, gắn cờ `review`)

- `Check_Dun` dòng 11 (2026-09-28, LSvn, 6.35*195): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Có tạp chất"
- `Check_Dun` dòng 33 (2026-10-02, Hải Nam, 10*80): Giờ không đọc được: "13.h10"
- `Check_Dun` dòng 37 (2026-10-03, Á Châu, 8*50): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Xước BM+Bóng khí"
- `Check_Dun` dòng 42 (2026-10-03, Seojin VN, Ø71): Kết luận không phải Đạt/NG: "Dương Kích Thước"
- `Check_Dun` dòng 52 (2026-10-05, Hải Nam, 8*30): Kết luận không phải Đạt/NG: "Dương chiều dày"
- `Check_Dun` dòng 53 (2026-10-05, Hải Nam, 8*30): Kết luận không phải Đạt/NG: "Dương chiều dày"
- `Check_Rut` dòng 9 (2026-09-28, Vietstar, 5*20): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Rut` dòng 36 (2026-09-30, Á Châu, 10*60 BC): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Vênh Nhẹ"
- `Check_Rut` dòng 41 (2026-09-30, LS Electric, 10*160 BC): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Xước BM"
- `Check_Rut` dòng 59 (2026-10-03, LS VN, 6.35*195): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Lõm bề mặt + ra dầu"
- `Check_Rut` dòng 60 (2026-10-03, Á Châu, 8*50 BC): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Vênh 1mm"
- `Check_Rut` dòng 71 (2026-10-04, SeoJin VN, 10*55): Kết luận không phải Đạt/NG: "Dương Chiều Dài"
- `Check_Rut` dòng 74 (2026-10-04, Á Châu, 8*50 BC): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Vênh"
- `Check_Rut` dòng 301 (2026-10-17, Bình Minh, 3*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Vênh 0.20"
- `Check_Rut` dòng 302 (2026-10-17, Bình Minh, 3*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Vênh 0.20"
- `Check_Rut` dòng 303 (2026-10-17, Bình Minh, 3*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Vênh 0.20"
- `Check_Rut` dòng 304 (2026-10-17, Bình Minh, 3*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Vênh 0.20"
- `Check_Rut` dòng 305 (2026-10-17, Bình Minh, 3*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Vênh 0.20"
- `Check_Rut` dòng 423 (2026-10-23, Hải Nam, 5*125): Thiếu kết luận
- `Check_Rut` dòng 500 (2026-10-29, LS Electric, 12*75): Ngoại quan ghi tự do (chưa gán mã NG-xx): "vênh 0.50"
- `Check_Rut` dòng 501 (2026-10-29, LS Electric, 12*75): Ngoại quan ghi tự do (chưa gán mã NG-xx): "vênh 0.50"
- `Check_Rut` dòng 502 (2026-10-29, LS Electric, 12*75): Ngoại quan ghi tự do (chưa gán mã NG-xx): "vênh 0.50"
- `Check_Rut` dòng 503 (2026-10-29, LS Electric, 12*75): Ngoại quan ghi tự do (chưa gán mã NG-xx): "vênh 0.50"
- `Check_Rut` dòng 504 (2026-10-29, LS Electric, 12*75): Ngoại quan ghi tự do (chưa gán mã NG-xx): "vênh 0.50"
- `Check_Rut` dòng 573 (2026-10-31, Á Châu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_Rut` dòng 574 (2026-10-31, Á Châu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_Rut` dòng 575 (2026-10-31, Á Châu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_Rut` dòng 576 (2026-10-31, Á Châu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_Rut` dòng 577 (2026-10-31, Á Châu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_Rut` dòng 663 (2026-11-03, Hải Nam, 5*60): Ngoại quan ghi tự do (chưa gán mã NG-xx): "E"
- `Check_DanhBong` dòng 79 (2026-10-09, HaWee, 5*80): Số đo không đọc được (Dày): "4*87"
- `Check_DanhBong` dòng 80 (2026-10-09, HaWee, 5*80): Số đo không đọc được (Dày): "4*89"
- `Check_DanhBong` dòng 118 (2026-10-11, LS Electric, 12*125 BC): Số đo không đọc được (Rộng): ".124.98"
- `Check_DanhBong` dòng 339 (2026-10-29, Hải Nam, 5*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích tước"
- `Check_DanhBong` dòng 340 (2026-10-29, Hải Nam, 5*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích tước"
- `Check_DanhBong` dòng 341 (2026-10-29, Hải Nam, 5*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích tước"
- `Check_DanhBong` dòng 342 (2026-10-29, Hải Nam, 5*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích tước"
- `Check_DanhBong` dòng 343 (2026-10-29, Hải Nam, 5*30): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích tước"
- `Check_DanhBong` dòng 374 (2026-10-31, Á CHâu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_DanhBong` dòng 375 (2026-10-31, Á CHâu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_DanhBong` dòng 376 (2026-10-31, Á CHâu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_DanhBong` dòng 377 (2026-10-31, Á CHâu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_DanhBong` dòng 378 (2026-10-31, Á CHâu, 10*100): Ngoại quan ghi tự do (chưa gán mã NG-xx): "Dương kích thước"
- `Check_Cat` dòng 23 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 24 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 25 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 26 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 27 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 28 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 29 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 30 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 31 (2026-10-03, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 32 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 33 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 34 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 35 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 36 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 37 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 38 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 39 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 40 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 41 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 42 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 43 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 44 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 45 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 46 (2026-10-04, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 47 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 48 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 49 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 50 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 51 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 52 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 53 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 54 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 55 (2026-10-05, SEOJIN VN, Ø 71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 56 (2026-10-05, —, 10*150): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 57 (2026-10-05, —, Ø 6): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 58 (2026-10-05, —, 15*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 59 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 60 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 61 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 62 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 63 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 64 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 65 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 66 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 67 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 68 (2026-10-06, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 69 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 70 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 71 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 72 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 73 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 74 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 75 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 76 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 77 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 78 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 79 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 80 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 81 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 82 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 83 (2026-10-07, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 84 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 85 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 86 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 87 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 88 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 89 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 90 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 91 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 92 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 93 (2026-10-08, SEOJIN VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 94 (2026-10-09, Kim Ưng, 15*200): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 95 (2026-10-09, Kim Ưng, 15*200): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 96 (2026-10-09, Kim Ưng, 15*200): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 97 (2026-10-09, Kim Ưng, 15*200): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 98 (2026-10-09, Kim Ưng, 15*200): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 99 (2026-10-09, Kim Ưng, 15*200): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 100 (2026-10-09, Kim Ưng, 15*200): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 101 (2026-10-09, Kim Ưng, 12*60): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 102 (2026-10-09, Kim Ưng, 12*60): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 103 (2026-10-09, Kim Ưng, 12*60): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 104 (2026-10-09, Kim Ưng, 12*60): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 105 (2026-10-09, Kim Ưng, 12*60): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 106 (2026-10-09, Kim Ưng, 12*60): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 107 (2026-10-09, Kim Ưng, 12*60): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 108 (2026-10-14, Kim Ưng, 6*25): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 109 (2026-10-14, LS VN, 6.35*177.8): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 110 (2026-10-14, LS VN, 6.35*177.8): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 111 (2026-10-14, LS VN, 6.35*177.8): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 112 (2026-10-14, LS VN, 6.35*177.8): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 113 (2026-10-22, LS VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 114 (2026-10-22, LS VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 115 (2026-10-22, LS VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 116 (2026-10-22, LS VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 117 (2026-10-22, LS VN, Ø71): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 118 (2026-10-24, Kim Ưng, 5*100): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 119 (2026-10-24, Kim Ưng, 5*100): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 120 (2026-10-24, Kim Ưng, 5*100): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 121 (2026-10-24, Kim Ưng, 5*100): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 122 (2026-10-24, Kim Ưng, 5*100): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 123 (2026-10-24, Kim Ưng, 5*100): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 124 (2026-10-24, ThiBiDi, 12*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 125 (2026-10-24, ThiBiDi, 12*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 126 (2026-10-24, ThiBiDi, 12*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 127 (2026-10-24, ThiBiDi, 12*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 128 (2026-10-25, SEOJIN VN, 5*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 129 (2026-10-25, SEOJIN VN, 5*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 130 (2026-10-25, SEOJIN VN, 5*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 131 (2026-10-25, SEOJIN VN, 5*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 132 (2026-10-25, SEOJIN VN, 5*80): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 133 (2026-10-27, SEOJIN VN, Ø71*190): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 134 (2026-10-27, SEOJIN VN, Ø71*190): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 135 (2026-10-27, SEOJIN VN, Ø71*190): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 136 (2026-10-27, SEOJIN VN, Ø71*190): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 137 (2026-10-27, SEOJIN VN, Ø71*190): Kết luận không phải Đạt/NG: "Dương kích thước"
- `Check_Cat` dòng 153 (2026-10-30, SEOJIN VN, Ø71*190): Ngày 2026-10-30 không khớp mã ngày ở cột Lô (31102026 = 2026-10-31)
- `Check_Cat` dòng 163 (2026-10-31, Kim Ưng, 8*200): Số đo không đọc được (Dài): "302+3"
- `Check_Cat` dòng 164 (2026-10-31, Kim Ưng, 8*200): Số đo không đọc được (Dài): "402+5"
- `ĐỘ thẳng` dòng 79 (2026-12-13, Hải Nam, 10*120): Ngày 2026-12-13 ở tương lai so với ngày lập dữ liệu (2026-11-06); Ngày 2026-12-13 không khớp mã ngày ở cột Lô (13102026 = 2026-10-13)
- `ĐỘ thẳng` dòng 80 (2026-12-13, Hải Nam, 10*120): Ngày 2026-12-13 ở tương lai so với ngày lập dữ liệu (2026-11-06); Ngày 2026-12-13 không khớp mã ngày ở cột Lô (13102026 = 2026-10-13)
- `ĐỘ thẳng` dòng 81 (2026-12-13, Hải Nam, 10*120): Ngày 2026-12-13 ở tương lai so với ngày lập dữ liệu (2026-11-06); Ngày 2026-12-13 không khớp mã ngày ở cột Lô (13102026 = 2026-10-13)
- `ĐỘ thẳng` dòng 145 (2026-11-06, CTC, 5*40): Chưa có kết luận OK/NG
