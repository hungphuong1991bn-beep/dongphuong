// src/modules/quality/quality-actions.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Ngày giao hiển thị: đã giao thì lấy ngày giao thực tế, chưa thì lấy hạn giao dự kiến

// Mở rộng tìm kiếm: thêm mã QR / mã sản phẩm / số phiếu xuất gắn với đơn
function htQrTokens(o){
  return (DB.qrProducts||[]).filter(p=>p.orderId===o.id).map(p=>p.qrCode+' '+(p.productCode||'')).join(' ');
}
function htMatchSearch(o, q){
  if(!q) return true;
  if(matchSearch(o,q)) return true;
  const s=_stripDiacritics(q.toLowerCase()).trim();
  const extra = htQrTokens(o)+' '+(o.exportSlipNo||'');
  return _stripDiacritics(extra.toLowerCase()).includes(s);
}

// Sắp xếp theo ngày hoàn thành mới nhất lên đầu — LUÔN theo đúng 1 tiêu chí
// duy nhất (doneAt giảm dần). Trước đây sort ưu tiên "đơn vừa hoàn thành
// (<48h, chưa xem)" lên đầu TRƯỚC rồi mới xếp theo ngày, khiến 1 đơn hoàn
// thành cũ hơn nhưng "còn mới/chưa xem" nhảy lên trên các đơn hoàn thành gần
// đây hơn — nhìn giống như thứ tự bị xáo trộn/lộn xộn theo ngày. Đơn "mới
// hoàn thành" vẫn được đánh dấu bằng nhãn "🟢 Mới" ở mỗi dòng (xem htIsFresh
// trong htRow), không cần đảo cả vị trí trong danh sách nữa.
function htSmartSort(list){
  return [...list].sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
}

function htResetFilters(){
  htSearchQ=''; htFilterStatus='all'; htDoneFrom=''; htDoneTo=''; htCustomerFilter='all'; htFilterPriority='all'; htFilterSpec='all'; htMobDateTab='all'; htMobPage=1;
  renderHoanThanh();
}
function htSetFilter(key){
  htFilterStatus = (htFilterStatus===key) ? 'all' : key;
  htMobPage = 1;
  renderHoanThanh();
}


function htToggleMenu(id, ev){
  if(ev) ev.stopPropagation();
  const menu = document.getElementById('globalActionMenu');
  if(!menu) return;
  const wasOpenForThis = menu.classList.contains('open') && menu.dataset.forId === 'ht-'+id;
  closeAllActionMenus();
  if(wasOpenForThis) return;
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  const st = htStage(o);
  const canStatus = isStaff();
  const canDel = isAdmin();
  menu.innerHTML = `
    <button onclick="closeAllActionMenus();htViewDetail('${o.id}')">👁 Xem chi tiết</button>
    <button onclick="closeAllActionMenus();htPrintOrder('${o.id}',event)">📄 In phiếu</button>
    ${canStatus&&st.key==='new'?`<button onclick="closeAllActionMenus();htMarkWarehouse('${o.id}',event)">📦 Xác nhận nhập kho</button>`:''}
    ${canStatus&&st.key==='shipping'?`<button onclick="closeAllActionMenus();htMarkDelivered('${o.id}',event)">🚚 Xác nhận giao hàng</button>`:''}
    <button onclick="closeAllActionMenus();htGoToOrderInDonHang('${o.id}',event)">📋 Xem ở Đơn Hàng</button>
    ${canStatus&&o.whIn&&!o.delivered?`<button onclick="closeAllActionMenus();htUndoWarehouse('${o.id}',event)">↩️ Bỏ đánh dấu nhập kho</button>`:''}
    ${canStatus&&o.delivered?`<button onclick="closeAllActionMenus();htUndoDelivered('${o.id}',event)">↩️ Bỏ đánh dấu đã giao</button>`:''}
    ${canStatus?`<button onclick="closeAllActionMenus();htToggleReturn('${o.id}',event)">${o.returned?'↩️ Bỏ đánh dấu hoàn trả':'🔄 Đánh dấu hoàn trả'}</button>`:''}
    ${canDel?`<button onclick="closeAllActionMenus();htRevertToPending('${o.id}',event)">↩️ Đưa về Chưa sản xuất (SX nhầm)</button>`:''}
    ${canDel?`<button class="danger" onclick="event.stopPropagation();closeAllActionMenus();deleteOrder('${o.id}')">🗑 Xóa đơn</button>`:''}
  `;
  menu.dataset.forId = 'ht-'+id;
  const btn = ev && ev.target && ev.target.closest('button');
  if(btn) openActionMenu(menu, btn);
}

// ── Xác nhận nhập kho ──
function htMarkWarehouse(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  if(o.status!=='done'){ showToast('Chỉ đơn đã hoàn thành mới nhập kho được', true); return; }
  if(o.whIn){ showToast('Đơn này đã nhập kho', true); return; }
  const loc = prompt('Nhập vị trí lưu kho (không bắt buộc, VD: Kho A - Kệ 3):','');
  if(loc===null) return;
  o.whIn=true; o.whAt=Date.now(); o.whBy=currentUser?.name||'—'; o.whLocation=loc.trim();
  log('Nhập kho thành phẩm', `${o.customer||''} · ${htCode(o)}`, id, {}, {});
  saveOrders();
  showToast('📦 Đã xác nhận nhập kho');
  renderHoanThanh();
}
function htUndoWarehouse(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  if(o.delivered){ showToast('Đơn đã giao — không thể bỏ đánh dấu nhập kho', true); return; }
  o.whIn=false; o.whAt=null;
  log('Bỏ đánh dấu nhập kho', `${o.customer||''} · ${htCode(o)}`, id, {}, {});
  saveOrders();
  showToast('Đã bỏ đánh dấu nhập kho');
  renderHoanThanh();
}

// ── Xác nhận giao hàng ──
function htMarkDelivered(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  if(o.status!=='done'){ showToast('Chỉ đơn đã hoàn thành mới giao được', true); return; }
  if(!o.whIn){ showToast('Đơn chưa nhập kho — hãy nhập kho trước khi giao', true); return; }
  const slip = prompt('Số phiếu xuất kho (không bắt buộc):', o.exportSlipNo||'');
  if(slip===null) return;
  o.delivered=true; o.deliveredAt=Date.now(); o.deliveredBy=currentUser?.name||'—'; o.exportSlipNo=slip.trim();
  log('Xác nhận giao hàng', `${o.customer||''} · ${htCode(o)}`, id, {}, {});
  saveOrders();
  showToast('🚚 Đã xác nhận giao hàng');
  renderHoanThanh();
}
function htUndoDelivered(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  o.delivered=false; o.deliveredAt=null;
  log('Bỏ đánh dấu đã giao', `${o.customer||''} · ${htCode(o)}`, id, {}, {});
  saveOrders();
  showToast('Đã bỏ đánh dấu giao hàng');
  renderHoanThanh();
}

// ── Hoàn trả ──
function htToggleReturn(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  confirm2(o.returned?'Bỏ đánh dấu hoàn trả':'Đánh dấu hoàn trả', `${o.customer||'—'} · ${htCode(o)}`, ()=>{
    o.returned = !o.returned; o.returnedAt = o.returned?Date.now():null;
    log(o.returned?'Đánh dấu hoàn trả':'Bỏ đánh dấu hoàn trả', `${o.customer||''} · ${htCode(o)}`, id, {}, {});
    saveOrders();
    showToast(o.returned?'🔄 Đã đánh dấu hoàn trả':'Đã bỏ đánh dấu hoàn trả');
    renderHoanThanh();
  });
}

// ── Đưa đơn đã Hoàn thành về lại "Chưa sản xuất" (pending) ──
// Dùng khi nhân viên bấm nhầm nút "Hoàn thành" ở tab Kế hoạch SX. Chỉ Admin
// mới có quyền này. Xóa sạch toàn bộ dữ liệu đã ghi nhận lúc hoàn thành/nhập
// kho/giao hàng (doneAt, whIn, delivered...) để đơn quay lại đúng trạng thái
// "Chưa sản xuất" như chưa từng chạy, tránh còn sót dữ liệu rác gây nhầm lẫn.
function htRevertToPending(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  if(!isAdmin()){ showToast('Chỉ quản trị viên mới có quyền đưa đơn về Chưa sản xuất', true); return; }
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  confirm2('Đưa đơn về "Chưa sản xuất"?',
    `${o.customer||'—'} · ${htCode(o)} — Toàn bộ dữ liệu hoàn thành/nhập kho/giao hàng của đơn này sẽ bị xóa và đơn quay về trạng thái Chờ sản xuất. Dùng khi nhân viên bấm nhầm nút "Hoàn thành".`,
    ()=>{
      const before={status:o.status,doneAt:o.doneAt,whIn:o.whIn,delivered:o.delivered};
      o.status='pending';
      delete o.doneAt; delete o.doneBy;
      delete o.startedAt; delete o.stage;
      delete o.whIn; delete o.whAt; delete o.whBy; delete o.whLocation;
      delete o.delivered; delete o.deliveredAt; delete o.deliveredBy; delete o.exportSlipNo;
      delete o.returned; delete o.returnedAt;
      delete o.viewedDoneAt;
      log('Đưa về Chưa sản xuất', `${o.customer||''} · ${htCode(o)} · (Admin sửa lỗi bấm nhầm)`, id, before, {status:'pending'});
      saveOrders();
      showToast('↩️ Đã đưa đơn về Chưa sản xuất');
      updateBadges();
      goTab('keHoach');
    });
}

// ── Xem chi tiết (chỉ thông tin quản lý, không có tiến độ SX) ──
function htViewDetail(id){
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  if(htIsFresh(o)){ o.viewedDoneAt=Date.now(); saveOrders(); }
  const st = htStage(o);

  // Đúng hạn / trễ hạn — so hạn giao (deliveryDate) với thời điểm hoàn
  // thành thực tế (doneAt), dùng đúng công thức đã dùng để tính "Hiệu suất
  // đúng hạn" ở Tổng quan (chừa 1 ngày, tính đủ cả ngày giao hàng).
  let onTimeInfo = '';
  if(o.deliveryDate && o.doneAt){
    const late = o.doneAt > new Date(o.deliveryDate).getTime()+86400000;
    onTimeInfo = late
      ? `<span class="dd-status-pill" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5">⚠️ Trễ hạn giao</span>`
      : `<span class="dd-status-pill" style="background:#E3F5EE;color:#0C7A54;border-color:#86EFAC">✅ Đúng hạn giao</span>`;
  }

  // Thời gian sản xuất thực tế (bắt đầu → hoàn thành)
  const prodDuration = (o.startedAt && o.doneAt) ? fmtDuration(o.doneAt-o.startedAt) : null;

  // Số lượng kế hoạch vs thực tế — chỉ hiện dòng riêng khi có sự khác biệt
  // đáng chú ý (đơn thiếu/dư so với kế hoạch ban đầu), tránh lặp thông tin
  // khi 2 số bằng nhau (trường hợp phổ biến nhất).
  const qtyPlan = Number(o.qty)||0, qtyDone = Number(o.doneQty)||0;
  const qtyDiffRow = (qtyPlan && qtyDone && qtyDone!==qtyPlan)
    ? `<div><b>Số lượng thực tế:</b> ${qtyDone.toLocaleString('vi-VN')} / kế hoạch ${qtyPlan.toLocaleString('vi-VN')}${o.unit?' '+o.unit:''}</div>` : '';

  $('htDetailTitle').textContent = `${o.customer||'—'} · ${htCode(o)}`;
  $('htDetailBody').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
      <span class="dd-status-pill" style="background:${st.bg};color:${st.color};border-color:${st.border}">${st.icon} ${st.label}</span>
      ${htIsFresh(o)?'<span class="ht-fresh-pill">🆕 Mới hoàn thành</span>':''}
      ${o.priority?`<span class="dd-status-pill" style="background:var(--purple-l);color:var(--purple-m);border-color:transparent">⭐ ${o.priority}</span>`:''}
      ${onTimeInfo}
    </div>
    <div><b>Mã đơn:</b> ${htCode(o)}</div>
    <div><b>Khách hàng:</b> ${o.customer||'—'}</div>
    <div><b>Sản phẩm:</b> ${o.type||'—'}</div>
    <div><b>Nguyên liệu:</b> ${ddMaterialLabel(o.material)}</div>
    <div><b>Quy cách:</b> ${specStr(o)}</div>
    <div><b>Số lượng:</b> ${qtyLabel(o)}${o.kg?' · ⚖️ '+o.kg+'kg':''}</div>
    ${qtyDiffRow}
    ${o.po?`<div><b>Số PO:</b> ${o.po}</div>`:''}
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <div><b>Ngày đặt đơn:</b> ${fmtDateTime(o.createdAt)}${ddOwner(o)!=='—'?` · người tạo: <b>${ddOwner(o)}</b>`:''}</div>
      ${o.deliveryDate?`<div><b>Hạn giao:</b> ${fmtDate(o.deliveryDate)}</div>`:''}
      ${prodDuration?`<div><b>Thời gian sản xuất:</b> ${prodDuration}${o.startedAt?` (bắt đầu ${fmtDateTime(o.startedAt)})`:''}</div>`:''}
      ${o.address?`<div><b>Địa chỉ giao:</b> ${o.address}</div>`:''}
    </div>
    <div class="ht-timeline" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <div class="ht-timeline-row">✅ Hoàn thành: <b>${fmtDateTime(o.doneAt)}</b>${o.doneBy?` · người xác nhận: <b>${o.doneBy}</b>`:''}</div>
      <div class="ht-timeline-row">📦 Nhập kho: <b>${o.whIn?fmtDateTime(o.whAt):'Chưa nhập kho'}</b>${o.whBy?` · <b>${o.whBy}</b>`:''}${o.whLocation?` · vị trí: <b>${o.whLocation}</b>`:''}</div>
      <div class="ht-timeline-row">🚚 Giao hàng: <b>${o.delivered?fmtDateTime(o.deliveredAt):'Chưa giao'}</b>${o.deliveredBy?` · <b>${o.deliveredBy}</b>`:''}${o.exportSlipNo?` · phiếu xuất: <b>${o.exportSlipNo}</b>`:''}</div>
      ${o.returned?`<div class="ht-timeline-row" style="color:var(--red-m)">🔄 Hoàn trả: <b>${fmtDateTime(o.returnedAt)}</b></div>`:''}
    </div>
    ${o.progressNote?`<div style="margin-top:8px;padding:8px 10px;background:var(--card2,#f5f6f8);border-left:3px solid var(--border);border-radius:0 8px 8px 0;line-height:1.5"><b>🛠 Ghi chú tiến độ SX:</b> ${o.progressNote}</div>`:''}
    ${o.note?`<div style="margin-top:8px;padding:8px 10px;background:var(--amber-l);border-left:3px solid var(--amber-m);border-radius:0 8px 8px 0;line-height:1.5"><b>📝 Ghi chú:</b> ${o.note}</div>`:''}
  `;
  const pb = $('htDetailPrintBtn');
  if(pb) pb.onclick = ()=>{ closeModal('htDetailModal'); htPrintOrder(id); };
  const rb = $('htDetailRevertBtn');
  if(rb){
    if(isAdmin()){
      rb.style.display='';
      rb.onclick = ()=>{ closeModal('htDetailModal'); htRevertToPending(id); };
    } else {
      rb.style.display='none';
    }
  }
  openModal('htDetailModal');
}

// ── In phiếu 1 đơn thành phẩm ──
function htPrintOrder(id, ev){
  if(ev) ev.stopPropagation();
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  const st = htStage(o);
  const w = window.open('', '_blank', 'width=720,height=920');
  if(!w){ showToast('Trình duyệt đang chặn cửa sổ in, vui lòng cho phép popup', true); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${htCode(o)}</title>
  <style>body{font-family:Inter,Arial,sans-serif;padding:28px;color:#151924}
  h1{font-size:19px;margin:0 0 10px}
  .pill{display:inline-block;padding:4px 12px;border-radius:20px;font-weight:700;font-size:12px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  td{padding:7px 8px;border-bottom:1px solid #e4e7ee;font-size:13.5px}
  td.lbl{color:#646c7c;width:170px;font-weight:600}</style></head><body>
  <h1>PHIẾU ĐƠN HÀNG ĐÃ HOÀN THÀNH — ${htCode(o)}</h1>
  <div class="pill" style="background:${st.bg};color:${st.color}">${st.icon} ${st.label}</div>
  <table>
    <tr><td class="lbl">Khách hàng</td><td>${o.customer||'—'}</td></tr>
    ${o.po?`<tr><td class="lbl">Số PO</td><td>${o.po}</td></tr>`:''}
    <tr><td class="lbl">Sản phẩm</td><td>${o.type||'—'}</td></tr>
    <tr><td class="lbl">Nguyên liệu</td><td>${ddMaterialLabel(o.material)}</td></tr>
    <tr><td class="lbl">Quy cách</td><td>${specStr(o)}</td></tr>
    <tr><td class="lbl">Số lượng</td><td>${qtyLabel(o)}${o.kg?' · '+o.kg+'kg':''}</td></tr>
    ${o.priority?`<tr><td class="lbl">Mức ưu tiên</td><td>${o.priority}</td></tr>`:''}
    <tr><td class="lbl">Ngày đặt đơn</td><td>${fmtDateTime(o.createdAt)}${ddOwner(o)!=='—'?' · người tạo: '+ddOwner(o):''}</td></tr>
    ${o.deliveryDate?`<tr><td class="lbl">Hạn giao</td><td>${fmtDate(o.deliveryDate)}</td></tr>`:''}
    ${(o.startedAt&&o.doneAt)?`<tr><td class="lbl">Thời gian sản xuất</td><td>${fmtDuration(o.doneAt-o.startedAt)} (bắt đầu ${fmtDateTime(o.startedAt)})</td></tr>`:''}
    <tr><td class="lbl">Ngày hoàn thành</td><td>${fmtDateTime(o.doneAt)}${o.doneBy?' · '+o.doneBy:''}</td></tr>
    <tr><td class="lbl">Ngày nhập kho</td><td>${o.whIn?fmtDateTime(o.whAt)+(o.whBy?' · '+o.whBy:''):'Chưa nhập kho'}${o.whLocation?' · vị trí: '+o.whLocation:''}</td></tr>
    <tr><td class="lbl">Ngày giao</td><td>${o.delivered?fmtDateTime(o.deliveredAt)+(o.deliveredBy?' · '+o.deliveredBy:''):'Chưa giao'}</td></tr>
    ${o.exportSlipNo?`<tr><td class="lbl">Số phiếu xuất</td><td>${o.exportSlipNo}</td></tr>`:''}
    ${o.address?`<tr><td class="lbl">Địa chỉ giao</td><td>${o.address}</td></tr>`:''}
    ${o.returned?`<tr><td class="lbl">Hoàn trả</td><td>${fmtDateTime(o.returnedAt)}</td></tr>`:''}
    ${o.progressNote?`<tr><td class="lbl">Ghi chú tiến độ SX</td><td>${o.progressNote}</td></tr>`:''}
    ${o.note?`<tr><td class="lbl">Ghi chú</td><td>${o.note}</td></tr>`:''}
  </table>
  </body></html>`);
  w.document.close(); w.focus();
  setTimeout(()=>w.print(), 300);
}
