// src/modules/hr/hr-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────



// SỬA: trước đây saveWorkers() ghi đè NGUYÊN CẢ mảng /data/workers bằng
// fbSaveField (không merge) — 2 admin cùng thêm/xoá công nhân gần như đồng
// thời trên 2 thiết bị sẽ ghi đè mất thay đổi của nhau, y hệt lỗi gốc đã sửa
// cho orders/users/attendance/lịch làm việc/kỷ luật/nghỉ phép/bảo trì. Đổi
// sang dùng chung cơ chế merge-theo-id (mergeAndSaveArrField) như các nhánh
// còn lại để nhất quán và an toàn khi nhiều người cùng thao tác.
function saveWorkers(){if(guardViewer())return;
  // v2.9.0: lương KHÔNG được nằm trong hồ sơ chung (/data/workers). Admin: chép lương cũ còn sót sang nhánh riêng
  // trước; mọi vai trò: gỡ luongCoBan để máy cũ không đẩy ngược lương lên vùng ai cũng đọc được.
  try{ if(typeof hrSalaryCaptureLegacy === 'function') hrSalaryCaptureLegacy(); if(typeof hrSalaryStripWorkers === 'function') hrSalaryStripWorkers(); }catch(e){ console.error('hrSalary', e); }
  // v2.8.0: HR là nguồn duy nhất → tự đồng bộ sang Lịch làm việc (Chấm công đọc thẳng DB.workers)
  try{ if(typeof hrLinkSyncSchedule === 'function') hrLinkSyncSchedule({prune:true}); }catch(e){ console.error('hrLinkSync', e); }
  lsSave();
  syncArrFieldToServer('workers', '/data/workers');
}
