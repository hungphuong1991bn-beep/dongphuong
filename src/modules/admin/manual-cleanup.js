// src/modules/admin/manual-cleanup.js — DỌN DỮ LIỆU CŨ THỦ CÔNG (chỉ Admin)
// ────────────────────────────────────────────────────────────────────
// Thay cho cơ chế TỰ XOÁ (đơn hoàn thành >30 ngày, sổ >32 ngày) đã bị tắt trong sync.js.
// • Không có lệnh nào tự chạy: chỉ chạy khi Admin bấm nút và xác nhận.
// • Xoá đúng các dòng quá hạn như quy tắc cũ (AUTOCLEAN_DAYS / SL_AUTOCLEAN_DAYS), dùng lại
//   đường ghi sẵn có (saveOrders / slDoSave → ghi từng dòng theo ID), không đụng dữ liệu khác.
// • Ghi Nhật ký thao tác: người dọn, số dòng, loại (deletedBy:'MANUAL_ADMIN').
// Hàm *List thuần (không ghi) để kiểm thử độc lập.

function dpCleanupDoneOrdersList(nowMs){
  const cutoff = (nowMs||Date.now()) - AUTOCLEAN_DAYS*24*60*60*1000;
  return (DB.orders||[]).filter(o=>o && o.status==='done' && Number(o.doneAt)>0 && Number(o.doneAt)<=cutoff);
}
function dpCleanupSlCutoffStr(nowMs){
  const d = new Date(nowMs||Date.now()); d.setDate(d.getDate()-SL_AUTOCLEAN_DAYS);
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
// → {nguyenLieu:n, mayRut:n, mayDanhBong:n, total:n}. Dòng thiếu Ngày được giữ nguyên (không xoá nhầm).
function dpCleanupSlCounts(nowMs){
  const cut = dpCleanupSlCutoffStr(nowMs), out={total:0};
  Object.keys(SL_META).forEach(tab=>{
    const n = (DB[SL_META[tab].field]||[]).filter(r=>r && r.ngay && r.ngay<cut).length;
    out[tab]=n; out.total+=n;
  });
  return out;
}

function dpSlCleanupBtnHTML(){
  if(typeof isAdmin!=='function' || !isAdmin()) return '';
  const c = dpCleanupSlCounts(); if(!c.total) return '';
  return `<button class="khm-add-btn" style="background:#b91c1c;margin-left:6px" onclick="dpCleanupSlManual()">🗑 Dọn ${c.total} dòng quá ${SL_AUTOCLEAN_DAYS} ngày (Admin)</button>`;
}
function dpOrdersCleanupBtnHTML(){
  if(typeof isAdmin!=='function' || !isAdmin()) return '';
  const n = dpCleanupDoneOrdersList().length; if(!n) return '';
  return `<button class="khm-add-btn" style="background:#b91c1c;margin-left:6px" onclick="event.stopPropagation();dpCleanupOrdersManual()">🗑 Dọn ${n} đơn quá ${AUTOCLEAN_DAYS} ngày (Admin)</button>`;
}

function dpCleanupBusy(){
  if(_pendingSaves>0 || getDirtyFields().length>0){ showToast('⏳ Đang đồng bộ dữ liệu — thử lại sau vài giây', true); return true; }
  return false;
}
function dpCleanupOrdersManual(){
  if(!isAdmin()){ showToast('🔒 Chỉ Quản trị viên (Admin) mới được dọn dữ liệu', true); return; }
  const n = dpCleanupDoneOrdersList().length;
  if(!n){ showToast('Không có đơn nào quá hạn'); return; }
  confirm2('🗑 Dọn đơn hoàn thành quá hạn?',
    `Sẽ xoá VĨNH VIỄN ${n} đơn hoàn thành đã quá ${AUTOCLEAN_DAYS} ngày (không qua Thùng rác, không khôi phục được). Hãy xuất Excel lưu trữ trước. Việc này được ghi vào Nhật ký thao tác.`,
    ()=>{
      if(!isAdmin() || dpCleanupBusy()) return;
      const rm = dpCleanupDoneOrdersList(); if(!rm.length) return;
      const ids = new Set(rm.map(o=>o.id));
      DB.orders = DB.orders.filter(o=>!ids.has(o.id));
      log('Admin dọn thủ công đơn hoàn thành quá '+AUTOCLEAN_DAYS+' ngày',
        `${rm.length} đơn: ${rm.map(o=>o.customer||o.id).slice(0,10).join(', ')}${rm.length>10?'…':''}`,
        null, null, {ids:[...ids], deletedBy:'MANUAL_ADMIN'});
      saveOrders();
      if(currentTab==='hoanThanh') renderTab(currentTab);
      updateBadges();
      showToast(`🗑 Đã dọn ${rm.length} đơn`);
    });
}
function dpCleanupSlManual(){
  if(!isAdmin()){ showToast('🔒 Chỉ Quản trị viên (Admin) mới được dọn dữ liệu', true); return; }
  const c = dpCleanupSlCounts();
  if(!c.total){ showToast('Không có dòng nào quá hạn'); return; }
  const parts = Object.keys(SL_META).filter(t=>c[t]).map(t=>`${SL_META[t].label}: ${c[t]}`).join('; ');
  confirm2('🗑 Dọn dòng sổ quá hạn?',
    `Sẽ xoá VĨNH VIỄN ${c.total} dòng có Ngày quá ${SL_AUTOCLEAN_DAYS} ngày (${parts}). Hãy xuất Excel/PDF lưu trữ trước. Việc này được ghi vào Nhật ký thao tác.`,
    ()=>{
      if(!isAdmin() || dpCleanupBusy()) return;
      const cut = dpCleanupSlCutoffStr(); let total=0; const by=[];
      Object.keys(SL_META).forEach(tab=>{
        const f = SL_META[tab].field, arr = DB[f]||[];
        const kept = arr.filter(r=>!(r && r.ngay && r.ngay<cut)), rm = arr.length-kept.length;
        if(rm>0){ DB[f]=kept; total+=rm; by.push(`${SL_META[tab].label}: ${rm}`); slDoSave(tab); }
      });
      if(total>0){
        log('Admin dọn thủ công Số liệu quá '+SL_AUTOCLEAN_DAYS+' ngày', `${total} dòng — ${by.join('; ')}`, null, null, {deletedBy:'MANUAL_ADMIN'});
        if(currentTab==='soLieu') renderSoLieu();
        showToast(`🗑 Đã dọn ${total} dòng`);
      }
    });
}
