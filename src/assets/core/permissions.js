// src/core/permissions.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

function roleIcon(role){ return role==='admin'?'👑':role==='staff'?'⚙️':role==='solieu'?'📊':'👁'; }
function roleLabel(role){ return role==='admin'?'Quản trị viên':role==='staff'?'Nhân viên SX':role==='solieu'?'Chỉ nhập Số liệu':'Chỉ xem'; }

function roleColor(role){ return role==='admin'?'#7c3aed':role==='staff'?'#2563eb':role==='solieu'?'#0d9488':'#64748b'; }
function isAdmin(){ return currentUser?.role==='admin'; }
function isStaff(){ return currentUser?.role==='admin'||currentUser?.role==='staff'; }
// Vai trò "solieu" (Chỉ nhập Số liệu) được coi như tài khoản Xem ở TẤT CẢ
// các tab khác — chỉ được nhập/sửa/xóa riêng trong tab 📊 Số liệu (xem
// isSlEditor()/guardSlEdit() bên dưới, dùng thay guardViewer() trong các
// hàm CRUD của tab Số liệu).
function isViewer(){ return currentUser?.role==='viewer' || currentUser?.role==='solieu'; }
// Chốt chặn quyền cuối cùng cho tài khoản "Xem" (và "Chỉ nhập Số liệu" ở
// mọi nơi NGOÀI tab Số liệu): gọi ở ĐẦU mọi hàm có thao tác ghi/sửa/xóa dữ
// liệu hoặc mở form thêm/sửa. Trả về true = đã chặn (hàm gọi phải return
// ngay), false = được phép chạy tiếp.
function guardViewer(){
  if(!isViewer()) return false;
  showToast('🔒 Tài khoản này chỉ được xem và trò chuyện, không có quyền thao tác', true);
  return true;
}
// Chốt quyền riêng cho tab 📊 Số liệu: Admin, Nhân viên và tài khoản "Chỉ
// nhập Số liệu" đều được thêm/sửa/xóa ở đây; tài khoản Xem thì không.
function isSlEditor(){ const r=currentUser?.role; return r==='admin'||r==='staff'||r==='solieu'; }
function guardSlEdit(){
  if(isSlEditor()) return false;
  showToast('🔒 Tài khoản Xem chỉ được xem, không có quyền thao tác', true);
  return true;
}

// Chốt chặn TẠO ĐƠN HÀNG MỚI: CHỈ ADMIN. Trước đây chỉ dùng guardViewer()
// (chỉ chặn viewer/solieu) nên tài khoản Nhân viên SX (staff) vẫn thấy nút
// và tạo được đơn. Sửa đơn có sẵn vẫn theo quyền cũ (guardViewer).
function canCreateOrder(){ return isAdmin(); }
function guardCreateOrder(){
  if(canCreateOrder()) return false;
  showToast('🔒 Chỉ Quản trị viên (Admin) mới có quyền tạo đơn hàng mới', true);
  return true;
}

// Chốt chặn riêng cho khu vực Quản lý Khuôn (Tổng hợp khuôn / Số lượng khuôn):
// CHỈ ADMIN mới được thêm/sửa/xóa, kể cả tài khoản "staff" cũng chỉ được xem.
function guardNotAdmin(){
  if(isAdmin()) return false;
  showToast('🔒 Chỉ Quản trị viên (Admin) mới có quyền thêm/sửa/xóa dữ liệu Khuôn', true);
  return true;
}
