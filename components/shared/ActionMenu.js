// src/components/shared/ActionMenu.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

// Đóng toàn bộ menu ⋯/⋮ đang mở (dùng chung cho dd-menu & ht-menu)
function closeAllActionMenus(){
  const menu = document.getElementById('globalActionMenu');
  if(menu){ menu.classList.remove('open'); menu.style.display='none'; menu.innerHTML=''; menu.dataset.forId=''; }
}
// Định vị menu ⋯/⋮ theo position:fixed để không bị Card/danh sách che/cắt,
// tự lật lên trên hoặc sang trái nếu không đủ chỗ phía dưới/phải màn hình
function openActionMenu(menuEl, btnEl){
  const r = btnEl.getBoundingClientRect();
  menuEl.style.left = '-9999px'; menuEl.style.top = '-9999px';
  menuEl.classList.add('open'); menuEl.style.display = 'block';
  const mw = menuEl.offsetWidth || 180, mh = menuEl.offsetHeight || 120;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = r.right - mw;
  if(left < 8) left = 8;
  if(left + mw > vw - 8) left = Math.max(8, vw - 8 - mw);
  let top = r.bottom + 4;
  if(top + mh > vh - 8) top = r.top - mh - 4;
  if(top < 8) top = 8;
  menuEl.style.left = left + 'px';
  menuEl.style.top = top + 'px';
}
document.addEventListener('click', closeAllActionMenus);
window.addEventListener('scroll', closeAllActionMenus, true);
window.addEventListener('resize', closeAllActionMenus);

// ── Menu ⋯/⋮ dùng chung (gắn cuối body, luôn nổi trên cùng, không bị danh sách
// làm mới đè mất giữa chừng như trước) ──
(function(){
  if(!document.getElementById('globalActionMenu')){
    const gm = document.createElement('div');
    gm.id = 'globalActionMenu';
    gm.className = 'dd-menu';
    document.body.appendChild(gm);
  }
})();
