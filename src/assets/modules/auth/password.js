// src/modules/auth/password.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// BẢO MẬT MẬT KHẨU
// ────────────────────────────────────────────────────────────
// LỖI BẢO MẬT NGHIÊM TRỌNG TRƯỚC ĐÂY: mật khẩu của MỌI tài khoản
// (kể cả admin) được lưu THẲNG dạng chữ thường (plain text) trong
// DB.users, và nhánh /data/users này được đọc công khai (kể cả lúc
// CHƯA đăng nhập, xem đoạn fbRead('/data/users') trong doLogin bên
// dưới). Nghĩa là bất kỳ ai xem được nhánh dữ liệu đó cũng đọc được
// mật khẩu thật của tất cả mọi người ngay lập tức.
// CÁCH SỬA: băm (hash) mật khẩu bằng SHA-256 kèm "salt" (chuỗi ngẫu
// nhiên riêng cho từng tài khoản) trước khi lưu; từ nay chỉ lưu
// {passwordHash, salt}, KHÔNG bao giờ lưu mật khẩu gốc nữa. Các tài
// khoản cũ còn sót trường "password" (chữ thường) sẽ được tự động
// băm lại (migrate) ngay khi có ai đăng nhập.
// LƯU Ý QUAN TRỌNG: đây vẫn là hash tính phía TRÌNH DUYỆT (app này
// không có backend/server riêng), nên chỉ chống lại việc lộ mật khẩu
// gốc khi bị xem trộm dữ liệu — không chống được kẻ tấn công có toàn
// quyền ghi vào Firebase (xem ghi chú bảo mật ở fbRead/fbWrite phía
// dưới về việc cần khoá Rules + bật Firebase Authentication để bảo
// mật triệt để).
function genSalt(){
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256Hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashPassword(pw, salt){ return sha256Hex(salt+':'+pw); }
// Tạo cặp {passwordHash, salt} mới — dùng khi tạo TK mới / đổi mật khẩu
async function makePasswordFields(pw){
  const salt = genSalt();
  const passwordHash = await hashPassword(pw, salt);
  return {passwordHash, salt};
}
// So khớp mật khẩu nhập vào với 1 user. Hỗ trợ cả user CŨ chưa migrate
// (còn trường password chữ thường) để không khoá tài khoản ai giữa chừng.
async function verifyPassword(user, pw){
  if(!user) return false;
  if(user.passwordHash && user.salt) return (await hashPassword(pw, user.salt))===user.passwordHash;
  return user.password===pw; // tài khoản cũ chưa migrate
}
// Băm lại TẤT CẢ user còn mật khẩu dạng chữ thường thành passwordHash+salt,
// đồng thời dọn sạch ký tự < > trong tên/tên đăng nhập cũ (phòng trường
// hợp đã bị chèn từ trước). Trả về true nếu có thay đổi cần lưu lại.
async function migrateUserPasswords(users){
  let changed = false;
  for(const u of (users||[])){
    if(!u) continue;
    if(u.password && !u.passwordHash){
      const {passwordHash, salt} = await makePasswordFields(u.password);
      u.passwordHash = passwordHash; u.salt = salt;
      delete u.password;
      changed = true;
    }
    if(u.name && /[<>]/.test(u.name)){ u.name = sanitizeDisplayText(u.name); changed = true; }
    if(u.username && /[<>]/.test(u.username)){ u.username = sanitizeDisplayText(u.username); changed = true; }
  }
  return changed;
}
