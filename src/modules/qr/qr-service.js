// src/modules/qr/qr-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Lưu danh sách thành phẩm QR — dùng cơ chế merge-theo-id (mergeAndSaveArrField)
// thay vì ghi đè nguyên mảng, để tránh 2 thiết bị cùng tạo/xoá QR gần như đồng
// thời ghi đè mất dữ liệu của nhau (cùng lớp lỗi đã sửa cho các nhánh khác).
function saveQrProducts(){if(guardViewer())return;
  lsSave();
  syncArrFieldToServer('qrProducts', '/data/qrProducts');
}
