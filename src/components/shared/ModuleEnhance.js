// src/components/shared/ModuleEnhance.js — Giai đoạn 3: cơ chế gắn "dải thông tin" vào các tab có sẵn
// ────────────────────────────────────────────────────────────────────
// Bọc một hàm render toàn cục (renderDorDang, renderKeHoach, …): chạy NGUYÊN hàm gốc trước,
// rồi chạy hàm gắn thêm trong try/catch. Hàm gốc không bị sửa; nếu phần gắn thêm lỗi thì tab
// vẫn hiển thị như cũ (chỉ có cảnh báo trong console). Chỉ ĐỌC DB, không ghi.
// Router (renderTab) tra cứu hàm theo tên toàn cục lúc gọi nên nhận được bản bọc.
// ────────────────────────────────────────────────────────────────────
function dpEnhanceRender(name, injector){
  const orig = window[name];
  if(typeof orig !== 'function' || orig.__dpEnh) return false;
  const wrapped = function(){
    const r = orig.apply(this, arguments);
    try{ injector(); }catch(e){ console.warn('[enhance]', name, e); }
    return r;
  };
  wrapped.__dpEnh = true;
  window[name] = wrapped;
  return true;
}
// Gắn/thay 1 khối HTML (id cố định, không bao giờ tạo trùng) vào #mc: 'first' = đầu trang, hoặc sau phần tử khớp selector
function dpMountStrip(id, html, afterSelector){
  const mc = document.getElementById('mc'); if(!mc) return;
  const old = document.getElementById(id); if(old) old.remove();
  if(!html) return;
  const el = document.createElement('div'); el.id = id; el.className = 'dp-strip'; el.innerHTML = html;
  const anchor = afterSelector ? mc.querySelector(afterSelector) : null;
  if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
  else mc.insertBefore(el, mc.firstChild);
}
// Số ngày từ hôm nay tới ngày giao (0 = hôm nay, âm = trễ). null nếu không có/không hợp lệ.
function dpDaysTo(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr); if(isNaN(d)) return null;
  const t0 = new Date(); t0.setHours(0,0,0,0);
  return Math.round((d - t0)/86400000);
}
