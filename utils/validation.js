// src/utils/validation.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

// Chặn ký tự < > trong các trường hiển thị công khai (tên, tên đăng
// nhập...) NGAY LÚC LƯU, để không ai chèn được thẻ HTML/script vào các
// trường này rồi hiển thị cho CẢ NHÓM cùng thấy (kiểu tấn công XSS lưu
// trữ qua dữ liệu dùng chung trên Firebase — ví dụ tên hiển thị trong
// khung chat, danh sách tài khoản, danh sách người đang online...).
// Tên/tên đăng nhập vốn dĩ không cần ký tự < > nên chặn không ảnh
// hưởng gì tới người dùng bình thường.
function sanitizeDisplayText(s){ return (s||'').replace(/[<>]/g,'').trim().slice(0,120); }

// Đọc ô Dày/Rộng: cho phép ghi 1 số (6, 3.71) hoặc nhiều giá trị ngăn bởi / , -
// (VD 6/10, 6-10, 3.71/9.71). val = giá trị LƯU & HIỂN THỊ (số nếu chỉ 1 giá trị,
// chuỗi nếu nhiều giá trị); num = số dùng để TÍNH KG (trung bình các giá trị).
function parseDimInput(raw){
  const s = String(raw==null?'':raw).trim().replace(/\s+/g,'');
  if(!s) return {val:0,num:0,multi:false};
  const nums = s.split(/[\/,\-–—]+/).map(p=>parseFloat(p)).filter(n=>isFinite(n)&&n>0);
  if(!nums.length) return {val:0,num:0,multi:false};
  if(nums.length===1) return {val:nums[0],num:nums[0],multi:false};
  const avg = nums.reduce((a,b)=>a+b,0)/nums.length;
  const txt = s.replace(/[–—]/g,'-').replace(/[^\d.\/,\-]/g,'');
  return {val:txt, num:parseFloat(avg.toFixed(4)), multi:true};
}
