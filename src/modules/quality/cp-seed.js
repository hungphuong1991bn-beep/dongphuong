// src/modules/quality/cp-seed.js — SINH TỰ ĐỘNG bởi tools/controlplan/build_dataset.py từ ControlPlan_AQL_Checksheet.xlsx
// Danh mục chuẩn của ControlPlan (Control Plan, PFMEA, AQL, mã lỗi ngoại quan, bước 8D, mục lục). KHÔNG sửa tay.
const CP_SEED = {
 "controlPlan": [
  {
   "id": "cpx-cp-1",
   "type": "cp",
   "no": 1,
   "stage": "Nguyên liệu",
   "characteristic": "Mác/lô đồng",
   "standard": "PO/BOM/COA",
   "equipment": "Hồ sơ/nhận dạng",
   "method": "Đối chiếu",
   "sample": "1 lô",
   "frequency": "Mỗi lô",
   "class": "Critical",
   "control": "Traceability",
   "reaction": "HOLD + xác minh",
   "formCode": "FR-IN-01",
   "formKey": "",
   "sop": "",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 2
   }
  },
  {
   "id": "cpx-cp-2",
   "type": "cp",
   "no": 2,
   "stage": "Đùn",
   "characteristic": "Dày",
   "standard": "Bản vẽ ± dung sai",
   "equipment": "Panme",
   "method": "3 điểm/mẫu",
   "sample": "5 pcs",
   "frequency": "Đầu ca + 2h + sau chỉnh",
   "class": "Major",
   "control": "Trend/SPC nếu áp dụng",
   "reaction": "HOLD từ lần OK gần nhất",
   "formCode": "FR-EX-01",
   "formKey": "dun",
   "sop": "SOP-01",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 3
   }
  },
  {
   "id": "cpx-cp-3",
   "type": "cp",
   "no": 3,
   "stage": "Đùn",
   "characteristic": "Rộng",
   "standard": "Bản vẽ ± dung sai",
   "equipment": "Thước cặp",
   "method": "3 điểm/mẫu",
   "sample": "5 pcs",
   "frequency": "Đầu ca + 2h + sau chỉnh",
   "class": "Major",
   "control": "Trend/SPC nếu áp dụng",
   "reaction": "HOLD",
   "formCode": "FR-EX-01",
   "formKey": "dun",
   "sop": "SOP-01",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 4
   }
  },
  {
   "id": "cpx-cp-4",
   "type": "cp",
   "no": 4,
   "stage": "Đùn",
   "characteristic": "Ngoại quan",
   "standard": "Mẫu chuẩn/spec",
   "equipment": "Mắt thường",
   "method": "Quan sát",
   "sample": "Liên tục",
   "frequency": "100% quan sát",
   "class": "Minor/Major",
   "control": "Visual standard",
   "reaction": "HOLD/Sort",
   "formCode": "FR-EX-01",
   "formKey": "dun",
   "sop": "SOP-01",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 5
   }
  },
  {
   "id": "cpx-cp-5",
   "type": "cp",
   "no": 5,
   "stage": "Rút",
   "characteristic": "Dày",
   "standard": "Bản vẽ ± dung sai",
   "equipment": "Panme",
   "method": "3 điểm/mẫu",
   "sample": "5 pcs",
   "frequency": "Đầu ca + 1h + sau đổi khuôn",
   "class": "Major",
   "control": "Trend/SPC",
   "reaction": "HOLD",
   "formCode": "FR-RU-01",
   "formKey": "rut",
   "sop": "SOP-02",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 6
   }
  },
  {
   "id": "cpx-cp-6",
   "type": "cp",
   "no": 6,
   "stage": "Rút",
   "characteristic": "Rộng",
   "standard": "Bản vẽ ± dung sai",
   "equipment": "Thước cặp",
   "method": "3 điểm/mẫu",
   "sample": "5 pcs",
   "frequency": "Đầu ca + 1h + sau đổi khuôn",
   "class": "Major",
   "control": "Trend/SPC",
   "reaction": "HOLD",
   "formCode": "FR-RU-01",
   "formKey": "rut",
   "sop": "SOP-02",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 7
   }
  },
  {
   "id": "cpx-cp-7",
   "type": "cp",
   "no": 7,
   "stage": "Đánh bóng",
   "characteristic": "Dày/Rộng",
   "standard": "Bản vẽ ± dung sai",
   "equipment": "Panme/thước cặp",
   "method": "3 điểm/mẫu",
   "sample": "5 pcs",
   "frequency": "Đầu ca + 2h + sau thay đá",
   "class": "Major",
   "control": "Trend",
   "reaction": "HOLD",
   "formCode": "FR-PO-01",
   "formKey": "danhbong",
   "sop": "SOP-03",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 8
   }
  },
  {
   "id": "cpx-cp-8",
   "type": "cp",
   "no": 8,
   "stage": "Đánh bóng",
   "characteristic": "Ngoại quan",
   "standard": "Mẫu chuẩn",
   "equipment": "Mắt thường",
   "method": "Quan sát",
   "sample": "100%",
   "frequency": "Liên tục",
   "class": "Minor/Major",
   "control": "Visual standard",
   "reaction": "Sort/Rework/HOLD",
   "formCode": "FR-PO-01",
   "formKey": "danhbong",
   "sop": "SOP-03",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 9
   }
  },
  {
   "id": "cpx-cp-9",
   "type": "cp",
   "no": 9,
   "stage": "Cắt",
   "characteristic": "Dài",
   "standard": "Bản vẽ ± dung sai",
   "equipment": "Thước/dưỡng",
   "method": "Đầu–giữa–cuối",
   "sample": "5 pcs",
   "frequency": "Đầu ca + 1h + sau chỉnh cữ",
   "class": "Major",
   "control": "Trend",
   "reaction": "HOLD + kiểm cữ",
   "formCode": "FR-CT-01",
   "formKey": "cat",
   "sop": "SOP-04",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 10
   }
  },
  {
   "id": "cpx-cp-10",
   "type": "cp",
   "no": 10,
   "stage": "Cắt",
   "characteristic": "Dày/Rộng",
   "standard": "Bản vẽ ± dung sai",
   "equipment": "Panme/thước cặp",
   "method": "Đo",
   "sample": "5 pcs",
   "frequency": "Đầu ca + 1h",
   "class": "Major",
   "control": "Trend",
   "reaction": "HOLD",
   "formCode": "FR-CT-01",
   "formKey": "cat",
   "sop": "SOP-04",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 11
   }
  },
  {
   "id": "cpx-cp-11",
   "type": "cp",
   "no": 11,
   "stage": "Cắt",
   "characteristic": "Bavia/ngoại quan",
   "standard": "Mẫu chuẩn",
   "equipment": "Mắt thường",
   "method": "Quan sát",
   "sample": "5 pcs",
   "frequency": "Đầu ca + 1h",
   "class": "Minor/Major",
   "control": "Visual",
   "reaction": "HOLD/Sort",
   "formCode": "FR-CT-01",
   "formKey": "cat",
   "sop": "SOP-04",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 12
   }
  },
  {
   "id": "cpx-cp-12",
   "type": "cp",
   "no": 12,
   "stage": "FQC",
   "characteristic": "Dày/Rộng/Dài",
   "standard": "Bản vẽ/PO",
   "equipment": "Thiết bị hiệu chuẩn",
   "method": "AQL ngẫu nhiên",
   "sample": "Theo AQL",
   "frequency": "Mỗi lô",
   "class": "Major",
   "control": "AQL",
   "reaction": "HOLD/NCR",
   "formCode": "FR-FQC-01",
   "formKey": "fqc",
   "sop": "SOP-05",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 13
   }
  },
  {
   "id": "cpx-cp-13",
   "type": "cp",
   "no": 13,
   "stage": "FQC",
   "characteristic": "Ngoại quan",
   "standard": "Spec/mẫu chuẩn",
   "equipment": "Mắt thường",
   "method": "AQL/100% nếu yêu cầu",
   "sample": "Theo AQL",
   "frequency": "Mỗi lô",
   "class": "Minor/Major",
   "control": "AQL/Visual",
   "reaction": "HOLD/NCR",
   "formCode": "FR-FQC-01",
   "formKey": "fqc",
   "sop": "SOP-05",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Control Plan",
    "row": 14
   }
  }
 ],
 "pfmea": [
  {
   "id": "cpx-pfmea-1",
   "type": "pfmea",
   "no": 1,
   "stage": "Đùn",
   "requirement": "Dày đúng",
   "failureMode": "Dày thấp/cao",
   "effect": "Không đạt bản vẽ/chức năng",
   "S": 8,
   "cause": "Khuôn/thông số",
   "O": 5,
   "prevention": "Set-up + first-off",
   "detection": "Đo 5 pcs/2h",
   "D": 4,
   "rpnExcel": "",
   "action": "Khóa thông số + trend",
   "owner": "SX/QC",
   "due": "",
   "status": "Open",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "PFMEA",
    "row": 2
   }
  },
  {
   "id": "cpx-pfmea-2",
   "type": "pfmea",
   "no": 2,
   "stage": "Đùn",
   "requirement": "Rộng đúng",
   "failureMode": "Rộng thấp/cao",
   "effect": "Sai biên dạng",
   "S": 7,
   "cause": "Khuôn mòn/lệch",
   "O": 4,
   "prevention": "Kiểm khuôn",
   "detection": "Đo rộng",
   "D": 4,
   "rpnExcel": "",
   "action": "PM khuôn",
   "owner": "SX",
   "due": "",
   "status": "Open",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "PFMEA",
    "row": 3
   }
  },
  {
   "id": "cpx-pfmea-3",
   "type": "pfmea",
   "no": 3,
   "stage": "Rút",
   "requirement": "Dày/rộng ổn định",
   "failureMode": "Sai kích thước",
   "effect": "Không đạt spec",
   "S": 8,
   "cause": "Khuôn mòn/lực kéo",
   "O": 5,
   "prevention": "Kiểm khuôn",
   "detection": "5 pcs/1h",
   "D": 4,
   "rpnExcel": "",
   "action": "Quản lý tuổi khuôn",
   "owner": "SX/QC",
   "due": "",
   "status": "Open",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "PFMEA",
    "row": 4
   }
  },
  {
   "id": "cpx-pfmea-4",
   "type": "pfmea",
   "no": 4,
   "stage": "Đánh bóng",
   "requirement": "Bề mặt đạt",
   "failureMode": "Xước/lõm/cháy",
   "effect": "Ngoại quan NG",
   "S": 6,
   "cause": "Đá/bánh/áp lực",
   "O": 5,
   "prevention": "Kiểm vật tư",
   "detection": "Visual",
   "D": 4,
   "rpnExcel": "",
   "action": "Mẫu giới hạn + thay định kỳ",
   "owner": "SX/QC",
   "due": "",
   "status": "Open",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "PFMEA",
    "row": 5
   }
  },
  {
   "id": "cpx-pfmea-5",
   "type": "pfmea",
   "no": 5,
   "stage": "Cắt",
   "requirement": "Dài đúng",
   "failureMode": "Dài ngắn/sai",
   "effect": "Không lắp/không giao",
   "S": 9,
   "cause": "Cữ/dao lệch",
   "O": 4,
   "prevention": "First-off",
   "detection": "5 pcs/1h",
   "D": 3,
   "rpnExcel": "",
   "action": "Khóa cữ",
   "owner": "SX/QC",
   "due": "",
   "status": "Open",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "PFMEA",
    "row": 6
   }
  },
  {
   "id": "cpx-pfmea-6",
   "type": "pfmea",
   "no": 6,
   "stage": "Cắt",
   "requirement": "Cạnh sạch",
   "failureMode": "Bavia",
   "effect": "Ảnh hưởng lắp ráp/an toàn",
   "S": 8,
   "cause": "Dao cùn",
   "O": 4,
   "prevention": "Kiểm dao",
   "detection": "Visual",
   "D": 4,
   "rpnExcel": "",
   "action": "Giới hạn thay dao",
   "owner": "SX",
   "due": "",
   "status": "Open",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "PFMEA",
    "row": 7
   }
  },
  {
   "id": "cpx-pfmea-7",
   "type": "pfmea",
   "no": 7,
   "stage": "FQC",
   "requirement": "Đúng mã/lô",
   "failureMode": "Trộn mã/lô",
   "effect": "Giao nhầm",
   "S": 10,
   "cause": "Nhận diện sai",
   "O": 2,
   "prevention": "2 bước xác nhận",
   "detection": "Đối chiếu phiếu",
   "D": 3,
   "rpnExcel": "",
   "action": "Barcode/2 người",
   "owner": "QA",
   "due": "",
   "status": "Open",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "PFMEA",
    "row": 8
   }
  }
 ],
 "defects": [
  {
   "id": "cpx-defect-OK",
   "type": "defect",
   "code": "OK",
   "name": "Đạt yêu cầu ngoại quan",
   "accept": "Không có lỗi",
   "reaction": "—",
   "ref": "—",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 5
   }
  },
  {
   "id": "cpx-defect-NG-01",
   "type": "defect",
   "code": "NG-01",
   "name": "Xước bề mặt",
   "accept": "Không có xước; xước nhẹ chỉ ĐẠT khi nằm trong giới hạn mẫu chuẩn",
   "reaction": "HOLD/đánh bóng lại nếu được phép; sâu → phế theo bảng TP",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 6
   }
  },
  {
   "id": "cpx-defect-NG-02",
   "type": "defect",
   "code": "NG-02",
   "name": "Cong/răng cưa cạnh",
   "accept": "Không cong và không răng cưa ở cạnh",
   "reaction": "HOLD; nắn/sửa nếu được phê duyệt; không đạt → phế",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 7
   }
  },
  {
   "id": "cpx-defect-NG-03",
   "type": "defect",
   "code": "NG-03",
   "name": "Vểnh 2 đầu",
   "accept": "Không vểnh 2 đầu",
   "reaction": "Nắn lại; kiểm xác nhận; nếu không đạt → HOLD",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 8
   }
  },
  {
   "id": "cpx-defect-NG-04",
   "type": "defect",
   "code": "NG-04",
   "name": "Vặn 2 đầu",
   "accept": "Không bị vặn 2 đầu",
   "reaction": "HOLD; nắn/chỉnh nếu được phép",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 9
   }
  },
  {
   "id": "cpx-defect-NG-05",
   "type": "defect",
   "code": "NG-05",
   "name": "Sóng bề mặt nỉ không đều",
   "accept": "Không chấp nhận",
   "reaction": "Đánh bóng lại; xác nhận lại",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 10
   }
  },
  {
   "id": "cpx-defect-NG-06",
   "type": "defect",
   "code": "NG-06",
   "name": "Tạp chất ở mép sau Rút",
   "accept": "Không chấp nhận",
   "reaction": "Bỏ phế theo tiêu chuẩn TP (nguy cơ gãy khi uốn)",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 11
   }
  },
  {
   "id": "cpx-defect-NG-07",
   "type": "defect",
   "code": "NG-07",
   "name": "Tạp chất ở cạnh khi chạy TJ",
   "accept": "Không chấp nhận",
   "reaction": "Bỏ phế theo tiêu chuẩn TP",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 12
   }
  },
  {
   "id": "cpx-defect-NG-08",
   "type": "defect",
   "code": "NG-08",
   "name": "Tạp chất trên bề mặt",
   "accept": "Không chấp nhận",
   "reaction": "Bỏ phế theo tiêu chuẩn TP",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 13
   }
  },
  {
   "id": "cpx-defect-NG-09",
   "type": "defect",
   "code": "NG-09",
   "name": "Rạn nứt/gãy khi uốn",
   "accept": "Không rạn nứt/gãy",
   "reaction": "HOLD; bỏ phế; điều tra nguyên nhân",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 14
   }
  },
  {
   "id": "cpx-defect-NG-10",
   "type": "defect",
   "code": "NG-10",
   "name": "Nổ bề mặt",
   "accept": "Không chấp nhận",
   "reaction": "Bỏ phế; điều tra nguyên nhân",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 15
   }
  },
  {
   "id": "cpx-defect-NG-11",
   "type": "defect",
   "code": "NG-11",
   "name": "Cong",
   "accept": "Không cong; giới hạn cụ thể theo spec nếu có",
   "reaction": "Nắn thẳng; kiểm lại; không đạt → HOLD",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 16
   }
  },
  {
   "id": "cpx-defect-NG-12",
   "type": "defect",
   "code": "NG-12",
   "name": "Xước quá sâu",
   "accept": "Không chấp nhận",
   "reaction": "Bỏ phế",
   "ref": "Tieu_chuan_Ngoai_quan.docx",
   "source": "excel",
   "src": {
    "file": "ControlPlan_AQL_Checksheet.xlsx",
    "sheet": "Danh_muc_ma_loi",
    "row": 17
   }
  }
 ],
 "aql": {
  "id": "cpx-aql-table",
  "type": "aql",
  "title": "BẢNG AQL – NORMAL INSPECTION / SINGLE SAMPLING",
  "note1": "Tham khảo ISO 2859-1 / ANSI/ASQ Z1.4. Ac/Re = số chấp nhận / số từ chối.",
  "note2": "Lưu ý: bảng rút gọn; tiêu chuẩn gốc có quy tắc mũi tên/chuyển cỡ mẫu và cần dùng bản tiêu chuẩn được công ty áp dụng.",
  "inspectionLevel": "II",
  "codes": [
   {
    "range": "2–8",
    "code": "A",
    "n": 2
   },
   {
    "range": "9–15",
    "code": "B",
    "n": 3
   },
   {
    "range": "16–25",
    "code": "C",
    "n": 5
   },
   {
    "range": "26–50",
    "code": "D",
    "n": 8
   },
   {
    "range": "51–90",
    "code": "E",
    "n": 13
   },
   {
    "range": "91–150",
    "code": "F",
    "n": 20
   },
   {
    "range": "151–280",
    "code": "G",
    "n": 32
   },
   {
    "range": "281–500",
    "code": "H",
    "n": 50
   },
   {
    "range": "501–1,200",
    "code": "J",
    "n": 80
   },
   {
    "range": "1,201–3,200",
    "code": "K",
    "n": 125
   },
   {
    "range": "3,201–10,000",
    "code": "L",
    "n": 200
   },
   {
    "range": "10,001–35,000",
    "code": "M",
    "n": 315
   },
   {
    "range": "35,001–150,000",
    "code": "N",
    "n": 500
   },
   {
    "range": "150,001–500,000",
    "code": "P",
    "n": 800
   },
   {
    "range": "500,001+",
    "code": "Q",
    "n": 1250
   }
  ],
  "levels": [
   "0.01",
   "0.015",
   "0.025",
   "0.04",
   "0.065",
   "0.1",
   "0.15",
   "0.25",
   "0.4",
   "0.65",
   "1",
   "1.5",
   "2.5",
   "4",
   "6.5",
   "10"
  ],
  "table": {
   "A": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "B": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "C": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "D": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "E": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "F": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "G": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "H": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "J": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "K": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "0/1",
    "0.65": "0/1",
    "1": "0/1",
    "1.5": "0/1",
    "2.5": "0/1",
    "4": "0/1",
    "6.5": "0/1",
    "10": "0/1"
   },
   "L": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "1/2",
    "0.65": "2/3",
    "1": "3/4",
    "1.5": "5/6",
    "2.5": "7/8",
    "4": "10/11",
    "6.5": "14/15",
    "10": "21/22"
   },
   "M": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "2/3",
    "0.65": "3/4",
    "1": "5/6",
    "1.5": "7/8",
    "2.5": "10/11",
    "4": "14/15",
    "6.5": "21/22",
    "10": "21/22"
   },
   "N": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "3/4",
    "0.65": "5/6",
    "1": "7/8",
    "1.5": "10/11",
    "2.5": "14/15",
    "4": "21/22",
    "6.5": "21/22",
    "10": "21/22"
   },
   "P": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "0/1",
    "0.4": "5/6",
    "0.65": "7/8",
    "1": "10/11",
    "1.5": "14/15",
    "2.5": "21/22",
    "4": "21/22",
    "6.5": "21/22",
    "10": "21/22"
   },
   "Q": {
    "0.01": "0/1",
    "0.015": "0/1",
    "0.025": "0/1",
    "0.04": "0/1",
    "0.065": "0/1",
    "0.1": "0/1",
    "0.15": "0/1",
    "0.25": "3/4",
    "0.4": "7/8",
    "0.65": "10/11",
    "1": "14/15",
    "1.5": "21/22",
    "2.5": "21/22",
    "4": "21/22",
    "6.5": "21/22",
    "10": "21/22"
   }
  },
  "source": "excel",
  "src": {
   "file": "ControlPlan_AQL_Checksheet.xlsx",
   "sheet": "AQL",
   "rows": "A4:J19 (AQL 0.01–0.15) + A20:I35 (AQL 0.25–10)"
  },
  "caveat": "Bảng thứ hai (AQL 0.25–10, dòng 21–35) không có cột Code/Số mẫu; được ghép với bảng thứ nhất THEO THỨ TỰ DÒNG (dòng 21 = Code A … dòng 35 = Code Q)."
 },
 "eightD": [
  {
   "step": "D0",
   "title": "Tiếp nhận/đánh giá mức độ",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  },
  {
   "step": "D1",
   "title": "Lập nhóm liên chức năng",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  },
  {
   "step": "D2",
   "title": "Mô tả 5W2H",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  },
  {
   "step": "D3",
   "title": "Containment/HOLD/Sort",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  },
  {
   "step": "D4",
   "title": "Root cause + cause of escape",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  },
  {
   "step": "D5",
   "title": "Corrective action",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  },
  {
   "step": "D6",
   "title": "Verify effectiveness",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  },
  {
   "step": "D7",
   "title": "Prevent recurrence; cập nhật PFMEA/CP/SOP",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  },
  {
   "step": "D8",
   "title": "Đóng 8D/lessons learned",
   "owner": "",
   "due": "",
   "evidence": "",
   "status": "Open"
  }
 ],
 "toc": {
  "title": "BỘ BIỂU MẪU QA/QC — ĐỒNG THANH CÁI",
  "intro": "Mục lục điều hướng + bảng liên kết Công đoạn ↔ SOP ↔ Control Plan ↔ PFMEA ↔ Check Sheet ↔ Tiêu chuẩn ↔ NCR/HOLD. Bấm vào tên sheet để mở nhanh.",
  "flow": "SOP công đoạn (thao tác) → Control Plan (đặc tính/tần suất/cỡ mẫu) → Check Sheet (ghi số đo + chọn mã lỗi ngoại quan) → Nếu NG: Tiêu chuẩn ngoại quan (Danh_muc_ma_loi) xác định mức độ → HOLD_RELEASE (cách ly) → NCR (nếu cần điều tra) → 8D (nếu lỗi nghiêm trọng/khiếu nại) → RELEASE (giải phóng lô, có chữ ký QA)",
  "items": [
   {
    "no": 1,
    "sheet": "Control Plan",
    "content": "Kế hoạch kiểm soát — đặc tính, tiêu chuẩn, cỡ mẫu, tần suất, phản ứng NG. Cột 'Biểu mẫu' đã liên kết thẳng tới Check Sheet tương ứng.",
    "stages": "Tất cả công đoạn"
   },
   {
    "no": 2,
    "sheet": "PFMEA",
    "content": "Phân tích rủi ro quá trình — Failure mode / Effect / Cause / S-O-D / Action.",
    "stages": "Tất cả công đoạn"
   },
   {
    "no": 3,
    "sheet": "AQL",
    "content": "Bảng tra Code/Cỡ mẫu/Ac-Re theo ISO 2859-1 (Normal, Single Sampling).",
    "stages": "FQC"
   },
   {
    "no": 4,
    "sheet": "Check_Dun",
    "content": "Phiếu kiểm tra công đoạn Đùn (SOP-01). Cột Ngoại quan có dropdown mã lỗi NG-xx.",
    "stages": "Đùn"
   },
   {
    "no": 5,
    "sheet": "Check_Rut",
    "content": "Phiếu kiểm tra công đoạn Rút (SOP-02). Cột Ngoại quan có dropdown mã lỗi NG-xx.",
    "stages": "Rút"
   },
   {
    "no": 6,
    "sheet": "Check_DanhBong",
    "content": "Phiếu kiểm tra công đoạn Đánh bóng (SOP-03). Cột Ngoại quan có dropdown mã lỗi NG-xx.",
    "stages": "Đánh bóng"
   },
   {
    "no": 7,
    "sheet": "Check_Cat",
    "content": "Phiếu kiểm tra công đoạn Cắt (SOP-04). Cột Ngoại quan có dropdown mã lỗi NG-xx.",
    "stages": "Cắt"
   },
   {
    "no": 8,
    "sheet": "FQC_AQL",
    "content": "Phiếu đánh giá lô theo AQL trước khi Release (SOP-05).",
    "stages": "FQC / Xuất hàng"
   },
   {
    "no": 9,
    "sheet": "Danh_muc_ma_loi",
    "content": "Danh mục mã lỗi ngoại quan OK/NG-01..NG-12 — nguồn dữ liệu cho dropdown tất cả Check Sheet.",
    "stages": "Tất cả công đoạn"
   },
   {
    "no": 10,
    "sheet": "NCR",
    "content": "Sổ theo dõi NCR — sản phẩm không phù hợp.",
    "stages": "Toàn bộ hồ sơ"
   },
   {
    "no": 11,
    "sheet": "HOLD_RELEASE",
    "content": "Sổ theo dõi HOLD/RELEASE — cách ly và giải phóng lô hàng.",
    "stages": "Toàn bộ hồ sơ"
   },
   {
    "no": 12,
    "sheet": "8D",
    "content": "Theo dõi tiến độ xử lý 8D khi có lỗi nghiêm trọng/khiếu nại khách hàng.",
    "stages": "Toàn bộ hồ sơ"
   }
  ]
 },
 "sourceFile": "ControlPlan_AQL_Checksheet.xlsx",
 "sourceSha256": "7e31822ac8e8f19a3a9448bc1770c3c287a7809d16baa2f0f2d3b61bd2cb10ca"
};
