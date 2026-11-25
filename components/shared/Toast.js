// src/components/shared/Toast.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- TOAST -->
<div id="toast" aria-live="polite"></div>`);

let _toastT;

// Poll notif từ Firebase (khi thiết bị khác thêm đơn)
function showToast(msg, isErr){
  const t=$('toast'); if(!t) return;
  // Clear text và thêm nội dung
  t.innerHTML='';
  const span=document.createElement('span');
  span.textContent=msg;
  t.appendChild(span);
  t.className=(isErr?'err':'show');
  if(!isErr) t.classList.add('show');
  clearTimeout(_toastT);
  _toastT=setTimeout(()=>t.classList.remove('show'),2800);
}
