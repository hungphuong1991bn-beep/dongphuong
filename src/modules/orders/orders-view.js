// src/modules/orders/orders-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── Mini card cột ĐƠN MỚI ──

// ── Mini card cột ƯU TIÊN ──

// ════════════════════════════════════════════════════════════════
// ĐƠN ĐANG LÀM v2 — Trung tâm quản lý đơn hàng (ERP/MES style)
// Chỉ quản lý & theo dõi đơn hàng — KHÔNG hiển thị tiến độ sản xuất
// (tiến độ đã có ở tab "Kế hoạch SX").
// ════════════════════════════════════════════════════════════════

// Đơn có phải "mới nhập" trong 24-48h gần nhất không (ẩn ngay khi người dùng đã xem)
function ddIsNew(o){
  if(!o.createdAt) return false;
  if(o.viewedNewAt && o.viewedNewAt>=o.createdAt) return false;
  return (Date.now()-o.createdAt) < 172800000; // 48h
}

// Đơn có quá hạn giao không (chỉ tính khi chưa xong/chưa giao)
function ddOverdue(o){
  return o.status!=='done' && !o.delivered && !!o.deliveryDate && new Date(o.deliveryDate) < new Date(new Date().toDateString());
}

// Trạng thái hiển thị theo đúng 5 mốc nghiệp vụ yêu cầu
function ddStatusMeta(o){
  const s = o.status==='cutting'?'running':o.status;
  if(s==='done'){
    return o.delivered
      ? {key:'delivered', label:'Đã giao', color:'#6D28D9', bg:'#F3E8FF', border:'#D8B4FE', dot:'#8B5CF6'}
      : {key:'completed', label:'Hoàn thành', color:'#0C7A54', bg:'#E3F5EE', border:'#86EFAC', dot:'#15966C'};
  }
  if(s==='running'){
    return {key:'producing', label:'Đang sản xuất', color:'#C2700A', bg:'#FCF0DE', border:'#FCD34D', dot:'#F59E0B'};
  }
  return o.planned
    ? {key:'planned', label:'Đã lập kế hoạch', color:'#2856D6', bg:'#DBEAFE', border:'#93C5FD', dot:'#3B82F6'}
    : {key:'unplanned', label:'Chưa lập kế hoạch', color:'#556072', bg:'#EEF0F3', border:'#CBD5E1', dot:'#94A3B8'};
}

// Người phụ trách = người đã tạo đơn (dữ liệu gần nhất hiện có cho việc này)
// Nhãn nguyên liệu thân thiện, lấy đúng từ lựa chọn khi thêm đơn (A/B*/B/Khác)
function ddMaterialLabel(mat){
  const map = {'A':'A (đồng tấm)', 'B*':'B* (onsan)', 'B':'B', 'Khác':'Khác'};
  return map[mat] || mat || '—';
}

function ddOwner(o){
  const u = (DB.users||[]).find(u=>u.id===o.createdBy);
  return u ? u.name : '—';
}

// Mã đơn hiển thị: ưu tiên số PO, không có thì sinh mã ngắn từ id
function ddCode(o){
  if(o.po) return o.po;
  return 'DH'+String(o.id||'').replace(/[^a-zA-Z0-9]/g,'').slice(-6).toUpperCase();
}

function ddInRange(ts, from, to){
  if(!ts) return !from && !to;
  // So sánh theo CHUỖI ngày địa phương (yyyy-mm-dd), KHÔNG qua Date object,
  // để tránh lỗi lệch múi giờ: "2026-08-18" bị JS hiểu là mốc UTC 00:00,
  // trong khi đơn ghi nhận theo giờ Việt Nam (UTC+7) — so bằng Date object
  // khiến đơn "hôm nay" luôn bị coi là "trước ngày lọc" và bị loại hết.
  const d = new Date(ts);
  const ds = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(from && ds < from) return false;
  if(to && ds > to) return false;
  return true;
}

// Sắp xếp thông minh: Đơn mới nhập lên đầu → sau đó theo ngày nhận đơn mới nhất
function ddSmartSort(list){
  // Đơn mới nhập luôn lên đầu danh sách — sắp xếp theo thời gian tạo giảm dần
  // để dễ theo dõi đơn nào vừa mới nhập, tránh lẫn với đơn cũ.
  return [...list].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}

function ddResetFilters(){
  searchQ=''; filterStatus='all'; ddRecvFrom=''; ddPriorityFilter='all'; ddCustomerFilter='all'; ddSpecFilter='all';
  renderDorDang();
}

function ddSetStatusFilter(key){
  filterStatus = (filterStatus===key) ? 'all' : key;
  renderDorDang();
}


let _ddVisibleIds = [];


function ddToggleMenu(id, ev){
  if(ev) ev.stopPropagation();
  const menu = document.getElementById('globalActionMenu');
  if(!menu) return;
  const wasOpenForThis = menu.classList.contains('open') && menu.dataset.forId === 'dd-'+id;
  closeAllActionMenus();
  if(wasOpenForThis) return;
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  const canEdit = isAdmin(), canPlan = isStaff() && o.status==='pending';
  menu.innerHTML = `
    <button onclick="closeAllActionMenus();ddViewDetail('${o.id}')">👁 Xem chi tiết</button>
    ${canEdit?`<button onclick="closeAllActionMenus();ddEditRow('${o.id}',event)">✏️ Chỉnh sửa</button>`:''}
    ${canPlan?`<button onclick="closeAllActionMenus();ddMarkPlanned('${o.id}',event)">📋 Lập kế hoạch</button>`:''}
    <button onclick="closeAllActionMenus();ddPrintOrder('${o.id}',event)">🖨 In phiếu</button>
    <button onclick="event.stopPropagation();closeAllActionMenus();goTab('keHoach')">🏭 Xem ở Kế hoạch SX</button>
    ${o.status==='done'?`<button onclick="closeAllActionMenus();ddToggleDelivered('${o.id}',event)">${o.delivered?'↩️ Bỏ đánh dấu đã giao':'🚚 Đánh dấu đã giao'}</button>`:''}
    ${canEdit?`<button class="danger" onclick="closeAllActionMenus();ddDeleteRow('${o.id}',event)">🗑 Xóa đơn</button>`:''}
  `;
  menu.dataset.forId = 'dd-'+id;
  const btn = ev && ev.target && ev.target.closest('button');
  if(btn) openActionMenu(menu, btn);
}

// ── Lập kế hoạch nhanh cho 1 đơn ──
function ddMarkPlanned(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  if(o.status!=='pending'){ showToast('Đơn này đã ở giai đoạn sản xuất/hoàn tất',true); return; }
  if(o.planned){ goToOrderInPlan(id); return; }
  o.planned=true; o.plannedAt=Date.now();
  log('Lập kế hoạch sản xuất', `${o.customer||''} · ${ddCode(o)}`, id, {planned:false}, {planned:true});
  saveOrders();
  showToast('📋 Đã lập kế hoạch — chuyển sang Kế hoạch SX');
  goToOrderInPlan(id);
}

// ── Đánh dấu / bỏ đánh dấu đã giao ──
function ddToggleDelivered(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  if(o.status!=='done'){ showToast('Chỉ đơn đã hoàn thành mới đánh dấu được là đã giao', true); return; }
  o.delivered = !o.delivered; o.deliveredAt = o.delivered?Date.now():null;
  log(o.delivered?'Đánh dấu đã giao hàng':'Bỏ đánh dấu đã giao', `${o.customer||''} · ${ddCode(o)}`, id, {}, {});
  saveOrders();
  showToast(o.delivered?'🚚 Đã đánh dấu giao hàng':'Đã bỏ đánh dấu giao hàng');
  renderDorDang();
}

function ddDeleteRow(id, ev){
  if(ev) ev.stopPropagation();
  deleteOrder(id);
}

function ddEditRow(id, ev){
  if(ev) ev.stopPropagation();
  editOrder(id);
}

// ── Xem chi tiết đơn (chỉ thông tin quản lý, không có tiến độ SX) ──
function ddViewDetail(id){
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  if(ddIsNew(o)){ o.viewedNewAt=Date.now(); saveOrders(); updateBadges(); }
  const meta = ddStatusMeta(o), overdue = ddOverdue(o);
  const s = o.status==='cutting'?'running':o.status;
  const pct = ddProgressPct(o);
  const tInfo = khTimeInfo(o, s);

  // Máy đang gán cho công đoạn hiện tại (nếu đơn đang chạy) — tra tên đầy
  // đủ từ danh mục MACHINES thay vì chỉ hiện mã máy khô khan.
  let machineTxt = '';
  if(s==='running' && o.stage && o.machineAssign && o.machineAssign[o.stage]){
    const m = MACHINES.find(x=>x.id===o.machineAssign[o.stage]);
    machineTxt = m ? `${m.icon} ${m.name}` : o.machineAssign[o.stage];
  }

  // Lịch sử thao tác RIÊNG của đơn này — lọc từ nhật ký chung theo orderId,
  // giúp biết đơn đã qua những bước nào, ai làm, lúc nào mà không cần rời
  // khỏi modal để mở tab Nhật ký thao tác rồi tự tìm kiếm theo mã đơn.
  const orderLog = actLog.filter(l=>l.orderId===id).slice(0,8);

  $('ddDetailTitle').textContent = `${o.customer||'—'} · ${ddCode(o)}`;
  $('ddDetailBody').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
      <span class="dd-status-pill" style="background:${meta.bg};color:${meta.color};border-color:${meta.border}">${meta.label}</span>
      ${ddIsNew(o)?'<span class="dd-new-pill">MỚI</span>':''}
      ${overdue?'<span class="dd-status-pill" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5">⚠️ Quá hạn giao</span>':''}
      ${o.priority?`<span class="dd-status-pill" style="background:var(--purple-l);color:var(--purple-m);border-color:transparent">⭐ ${o.priority}</span>`:''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-bottom:4px">
      <div><b>Mã đơn:</b> ${ddCode(o)}</div>
      <div><b>Khách hàng:</b> ${o.customer||'—'}</div>
      ${o.po?`<div><b>Số PO:</b> ${o.po}</div>`:''}
      <div><b>Người phụ trách:</b> ${ddOwner(o)}</div>
    </div>

    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📦 Sản phẩm</div>
      <div><b>Loại:</b> ${o.type||'—'}</div>
      <div><b>Nguyên liệu:</b> ${ddMaterialLabel(o.material)}</div>
      <div><b>Quy cách:</b> ${specStr(o)}</div>
      <div><b>Số lượng kế hoạch:</b> ${qtyLabel(o)}${o.kg?' · ⚖️ '+o.kg+'kg':''}</div>
    </div>

    ${s!=='pending' ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">🏭 Tiến độ sản xuất</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="flex:1;height:8px;border-radius:5px;background:var(--bg2);overflow:hidden">
          <div style="height:100%;width:${Math.max(2,pct)}%;background:${s==='done'?'var(--green-m)':'var(--brand)'};border-radius:5px"></div>
        </div>
        <span style="font-size:12px;font-weight:800;color:${s==='done'?'var(--green-m)':'var(--brand)'}">${pct}%</span>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:2px">${(o.doneQty||0).toLocaleString('vi-VN')} / ${(o.qty||0).toLocaleString('vi-VN')} ${o.isCoil?'cuộn':(o.isRound?'cây':'thanh')} đã hoàn thành${machineTxt?` · đang chạy tại ${machineTxt}`:''}</div>
      ${renderStageTracker(o, false)}
    </div>` : ''}

    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">🗓 Mốc thời gian</div>
      <div><b>Ngày đặt đơn:</b> ${fmtDateTime(o.createdAt)}</div>
      <div><b>Hạn giao:</b> ${fmtDate(o.deliveryDate)}${o.deliveryDate?` · <span style="font-weight:700">${tInfo.val}</span>`:''}</div>
      ${o.startedAt?`<div><b>Bắt đầu sản xuất:</b> ${fmtDateTime(o.startedAt)}</div>`:''}
      ${(s==='done'&&o.startedAt&&o.doneAt)?`<div><b>Thời gian sản xuất:</b> ${fmtDuration(o.doneAt-o.startedAt)}</div>`:''}
    </div>

    ${o.address?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><b>📍 Địa chỉ giao:</b> ${o.address}</div>`:''}
    ${o.progressNote?`<div style="margin-top:8px;padding:8px 10px;background:var(--card2,#f5f6f8);border-left:3px solid var(--border);border-radius:0 8px 8px 0;line-height:1.5"><b>🛠 Ghi chú tiến độ SX:</b> ${o.progressNote}</div>`:''}
    ${o.note?`<div style="margin-top:8px;padding:8px 10px;background:var(--amber-l);border-left:3px solid var(--amber-m);border-radius:0 8px 8px 0;line-height:1.5"><b>📝 Ghi chú:</b> ${o.note}</div>`:''}

    ${orderLog.length ? `
    <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">🕘 Lịch sử thao tác đơn này</div>
      ${orderLog.map(l=>{
        const t = vnDateTimeShort(new Date(l.ts));
        const bTxt = fmtLogChange(l.before), aTxt = fmtLogChange(l.after);
        return `<div class="act-row">
          <div class="act-icon-wrap">${ACT_ICO[l.action]||'📌'}</div>
          <div class="act-body">
            <div class="act-main">${l.action}</div>
            ${l.detail?`<div class="act-detail">${l.detail}</div>`:''}
            ${(bTxt||aTxt)?`<div style="margin-top:4px;display:flex;flex-direction:column;gap:3px">
              ${bTxt?`<div style="font-size:11px;background:var(--amber-l);padding:3px 8px;border-radius:5px;border-left:2px solid var(--amber-m);color:var(--amber)">← ${bTxt}</div>`:''}
              ${aTxt?`<div style="font-size:11px;background:var(--green-l);padding:3px 8px;border-radius:5px;border-left:2px solid var(--green-m);color:var(--green-m)">→ ${aTxt}</div>`:''}
            </div>`:''}
            <div class="act-meta" style="margin-top:3px">👤 <b>${l.user}</b> · 🕐 ${t}</div>
          </div>
        </div>`;
      }).join('')}
      ${actLog.filter(l=>l.orderId===id).length>8?`<div style="text-align:center;margin-top:4px"><button class="btn btn-ghost" style="font-size:12px;padding:6px 12px" onclick="closeModal('ddDetailModal');goTab('nhatKy');setTimeout(()=>{const si=document.getElementById('logSearch'); if(si){si.value='${id}'; si.dispatchEvent(new Event('input'));}},250)">Xem toàn bộ lịch sử →</button></div>`:''}
    </div>` : ''}
  `;
  // Nút "Chỉnh sửa" chỉ dành cho admin — TRƯỚC ĐÂY nút này luôn hiện & luôn
  // gán sẵn onclick trong modal xem chi tiết bất kể vai trò, trong khi ở
  // menu thao tác trên từng dòng (danh sách) đã ẩn đúng cho tài khoản
  // nhân viên/viewer (xem biến canEdit=isAdmin() ở trên). Vì vậy tài khoản
  // nhân viên bấm "Xem chi tiết" vẫn thấy và bấm sửa được đơn hàng dù ở
  // ngoài danh sách không hề thấy nút Sửa. Ẩn hẳn nút + không gán onclick
  // khi không phải admin để đồng bộ đúng quyền như ngoài danh sách.
  const editBtn = $('ddDetailEditBtn');
  if(editBtn){
    if(isAdmin()){
      editBtn.style.display = '';
      editBtn.onclick = ()=>{ closeModal('ddDetailModal'); editOrder(id); };
    } else {
      editBtn.style.display = 'none';
      editBtn.onclick = null;
    }
  }
  const planBtn = $('ddDetailPlanBtn');
  if(planBtn) planBtn.onclick = ()=>{ closeModal('ddDetailModal'); goToOrderInPlan(id); };
  openModal('ddDetailModal');
}

// ── In phiếu 1 đơn hàng ──
function ddPrintOrder(id, ev){
  if(ev) ev.stopPropagation();
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  const meta = ddStatusMeta(o);
  const w = window.open('', '_blank', 'width=720,height=920');
  if(!w){ showToast('Trình duyệt đang chặn cửa sổ in, vui lòng cho phép popup', true); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ddCode(o)}</title>
  <style>body{font-family:Inter,Arial,sans-serif;padding:28px;color:#151924}
  h1{font-size:19px;margin:0 0 10px}
  .pill{display:inline-block;padding:4px 12px;border-radius:20px;font-weight:700;font-size:12px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  td{padding:7px 8px;border-bottom:1px solid #e4e7ee;font-size:13.5px}
  td.lbl{color:#646c7c;width:170px;font-weight:600}</style></head><body>
  <h1>PHIẾU ĐƠN HÀNG — ${ddCode(o)}</h1>
  <div class="pill" style="background:${meta.bg};color:${meta.color}">${meta.label}</div>
  <table>
    <tr><td class="lbl">Khách hàng</td><td>${o.customer||'—'}</td></tr>
    <tr><td class="lbl">Sản phẩm</td><td>${o.type||'—'}</td></tr>
    <tr><td class="lbl">Nguyên liệu</td><td>${ddMaterialLabel(o.material)}</td></tr>
    <tr><td class="lbl">Quy cách</td><td>${specStr(o)}</td></tr>
    <tr><td class="lbl">Số lượng</td><td>${qtyLabel(o)}${o.kg?' · '+o.kg+'kg':''}</td></tr>
    <tr><td class="lbl">Mức ưu tiên</td><td>${o.priority||'—'}</td></tr>
    <tr><td class="lbl">Ngày đặt đơn</td><td>${fmtDate(o.createdAt)}</td></tr>
    <tr><td class="lbl">Hạn giao</td><td>${fmtDate(o.deliveryDate)}</td></tr>
    <tr><td class="lbl">Người phụ trách</td><td>${ddOwner(o)}</td></tr>
    ${o.note?`<tr><td class="lbl">Ghi chú</td><td>${o.note}</td></tr>`:''}
  </table>
  </body></html>`);
  w.document.close(); w.focus();
  setTimeout(()=>w.print(), 300);
}

// Ô "Ngày giao" của bảng Đơn hàng: ngày giao (đậm) + dòng phụ cho biết còn
// bao lâu / trễ bao lâu, tô màu theo mức khẩn cấp để nhìn lướt là nắm được.
// Tính theo NGÀY ĐỊA PHƯƠNG (không dùng new Date('yyyy-mm-dd') vì bị hiểu là
// UTC 00:00 → lệch múi giờ VN, đơn giao hôm nay sẽ bị tính nhầm là "còn 1 ngày").
function ddDueCellHTML(o){
  if(!o.deliveryDate) return '<span class="ord-due-none">—</span>';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(o.deliveryDate));
  const due = m ? new Date(+m[1], +m[2]-1, +m[3]) : new Date(o.deliveryDate);
  const t = new Date(); const today0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const d = Math.round((due - today0)/86400000);
  let cls, txt;
  if(o.delivered){ cls='ok'; txt='✓ Đã giao'; }
  else if(o.status==='done'){ cls='ok'; txt='✓ Đã xong SX'; }
  else if(d<0){ cls='late'; txt='⚠ Trễ '+(-d)+' ngày'; }
  else if(d===0){ cls='soon'; txt='Giao hôm nay'; }
  else if(d<=2){ cls='soon'; txt='Còn '+d+' ngày'; }
  else { cls='norm'; txt='Còn '+d+' ngày'; }
  return `<span class="ord-dt-main${cls==='late'?' ord-due-late-txt':''}">${fmtDate(o.deliveryDate)}</span><div class="ord-due-chip ${cls}">${txt}</div>`;
}

function ddRow(o, stt){
  const meta = ddStatusMeta(o);
  const isNew = ddIsNew(o);
  const overdue = ddOverdue(o);
  const pc = PRI_COLOR[o.priority]||'#64748b';
  const doneUnit = o.isCoil?'cuộn':(o.isRound?'cây':'thanh');
  const tAttr = s => s?` title="${String(s).replace(/"/g,'&quot;')}"`:'';
  return `<tr class="${isNew?'is-new':''}${overdue?' is-overdue':''} st-${meta.key}" data-order-id="${o.id}" onclick="ddViewDetail('${o.id}')">
    <td>${stt!=null?stt:''}</td>
    <td><div class="ord-cust-info"><div class="ord-cust-info-txt"><span class="ord-cust-name"${tAttr(o.customer)}>${o.customer||'—'}</span>${o.po?`<span class="ord-po-sub"${tAttr('PO '+o.po)}>PO ${o.po}</span>`:''}</div></div>${isNew?'<span class="pill-new" style="margin-top:3px" title="Đơn chưa xem chi tiết"><span class="pn-dot"></span>Mới</span>':''}</td>
    <td${tAttr(o.type)}>${o.type||'—'}</td>
    <td${tAttr(ddMaterialLabel(o.material))}>${ddMaterialLabel(o.material)}</td>
    <td><span class="spec-chip"${tAttr(specStr(o))}>${specStr(o)}</span></td>
    <td>${qtyLabel(o)}${o.kg?`<div style="font-size:10.5px;color:var(--text4);font-weight:600">⚖️ ${o.kg}kg</div>`:''}</td>
    <td>${o.doneQty||0} ${doneUnit}</td>
    <td class="ord-note-cell">${o.note?`<span class="ord-note-txt"${tAttr(o.note)}>${o.note}</span>`:'<span class="ord-note-none">—</span>'}</td>
    <td><span class="ord-dt-main">${fmtDate(o.createdAt)}</span>${o.createdAt?`<div class="ord-dt-sub">🕐 ${vnTimeHM(new Date(o.createdAt))}</div>`:''}</td>
    <td>${ddDueCellHTML(o)}</td>
    <td><span class="ord-pri"${tAttr(o.priority)} style="background:${pc}1a;color:${pc};border-color:${pc}55">🚩 ${o.priority||'—'}</span></td>
    <td><span class="dd-status-pill"${tAttr(meta.label)} style="background:${meta.bg};color:${meta.color};border-color:${meta.border}">${meta.label}</span></td>
    <td onclick="event.stopPropagation()" style="white-space:nowrap">
      <div class="dd-menu-wrap" style="display:inline-block"><button class="dd-act-btn icon-only" title="Thao tác" onclick="ddToggleMenu('${o.id}',event)">⋮</button></div>
    </td>
  </tr>`;
}

function renderDorDang(){
  // Ô #srchInp giờ luôn là input ẩn (type="hidden", xem usBarHTML) — người
  // dùng KHÔNG còn gõ trực tiếp vào đây được nữa, mọi tìm kiếm đều đi qua ô
  // tìm kiếm trung tâm ở Topbar (#tbGlobalSearch → tbGlobalSearchGo() gán
  // thẳng biến searchQ). TRƯỚC ĐÂY dòng "searchQ = inpOld.value" bên dưới đọc
  // lại giá trị CŨ còn sót trong DOM (vì innerHTML của #mc chỉ được ghi đè ở
  // cuối hàm này) rồi GHI ĐÈ LÊN searchQ vừa được tbGlobalSearchGo() gán —
  // khiến lần tìm thứ 2 trở đi bị "nuốt mất", quay về đúng từ khoá của lần
  // tìm ĐẦU TIÊN (hoặc một phần dở dang của nó) → đổi sang cỡ khác thì không
  // ăn/hiện lẫn cỡ cũ. Bỏ hẳn việc đọc lại này — input ẩn không thể được
  // người dùng focus/gõ nên không cần khôi phục caret/focus của nó nữa.
  const caretPos = null, hadFocus = false;
  // Đơn đã hoàn thành (status='done') chuyển hẳn sang tab "Hoàn thành", không còn hiện ở đây nữa
  const all = DB.orders.filter(o=>o.status!=='done');
  const doneCount = DB.orders.length - all.length;
  const total = all.length;
  const newCount   = all.filter(ddIsNew).length;
  const unplanned  = all.filter(o=>ddStatusMeta(o).key==='unplanned').length;
  const plannedCnt = all.filter(o=>ddStatusMeta(o).key==='planned').length;
  const producing  = all.filter(o=>ddStatusMeta(o).key==='producing').length;
  const overdueCnt = all.filter(ddOverdue).length;
  const waitingCnt = all.filter(o=>{const k=ddStatusMeta(o).key; return k==='unplanned'||k==='planned';}).length;
  const totalCustomers = new Set(all.map(o=>o.customer).filter(Boolean)).size;
  const totalKg = all.reduce((s,o)=>s+(Number(o.kg)||0),0);

  // Áp bộ lọc
  let list = all;
  if(searchQ) list = list.filter(o=>matchSearch(o,searchQ));
  if(filterStatus!=='all'){
    if(filterStatus==='new') list = list.filter(ddIsNew);
    else if(filterStatus==='waiting') list = list.filter(o=>{const k=ddStatusMeta(o).key; return k==='unplanned'||k==='planned';});
    else if(filterStatus==='overdue') list = list.filter(ddOverdue);
    else list = list.filter(o=>ddStatusMeta(o).key===filterStatus);
  }
  if(ddRecvFrom) list = list.filter(o=>ddInRange(o.createdAt, ddRecvFrom, ''));
  if(ddPriorityFilter!=='all') list = list.filter(o=>o.priority===ddPriorityFilter);
  if(ddCustomerFilter!=='all') list = list.filter(o=>o.customer===ddCustomerFilter);
  if(ddSpecFilter!=='all') list = list.filter(o=>specStr(o)===ddSpecFilter);
  list = ddSmartSort(list);

  // 6 thẻ KPI theo đúng bố cục ảnh tham chiếu (TẤT CẢ/ĐANG SẢN XUẤT/CHỜ SẢN
  // XUẤT/TRỄ HẠN/HOÀN THÀNH/TỔNG SỐ LƯỢNG) — toàn bộ số liệu tính trực tiếp
  // từ DB.orders ở trên (total/producing/waitingCnt/overdueCnt/doneCount/
  // totalKg), KHÔNG hard-code. "Chưa lập kế hoạch"+"Đã lập kế hoạch" gộp
  // chung vào "Chờ sản xuất" (waitingCnt) để khớp đúng số nhóm thẻ trong ảnh,
  // nhưng bộ lọc chi tiết theo từng trạng thái vẫn còn nguyên trong Bộ lọc.
  const stats = [
    {key:'all',        icon:'📄', ic:'#EEF2FF', col:'#3B4A66', n:total,      l:'TẤT CẢ'},
    {key:'producing',  icon:'▶️', ic:'#DCFCE7', col:'#16A34A', n:producing,  l:'ĐANG SẢN XUẤT'},
    {key:'waiting',    icon:'⏱️', ic:'#FEF3C7', col:'#D97706', n:waitingCnt, l:'CHỜ SẢN XUẤT'},
    {key:'overdue',    icon:'⚠️', ic:'#FEE2E2', col:'#DC2626', n:overdueCnt, l:'TRỄ HẠN'},
  ];

  const selIds = list.map(o=>o.id);
  _ddVisibleIds = selIds;
  const allChecked = selIds.length>0 && selIds.every(id=>ddSelected.has(id));

  // Dải KPI + tab lọc riêng cho giao diện thẻ mobile (xem mocMobileBlock) —
  // dùng đúng các số liệu/bộ lọc đã tính ở trên, không tạo dữ liệu mới.
  const mobStats = [
    {key:'all',       c:'#1E3A5F', l:'Tất cả',        n:total},
    {key:'producing', c:'#15966C', l:'Đang sản xuất', n:producing},
    {key:'overdue',   c:'#DC2626', l:'Trễ hạn',       n:overdueCnt},
    {key:'done',      c:'#7C3AED', l:'Hoàn thành',    n:doneCount, nav:true},
  ];
  const mobTabs = [
    {key:'all',       l:'TẤT CẢ'},
    {key:'producing', l:'ĐANG SX'},
    {key:'waiting',   l:'CHỜ SẢN XUẤT'},
    {key:'overdue',   l:'TRỄ HẠN'},
    {key:'done',      l:'HOÀN THÀNH', nav:true},
  ];
  const emptyMsg = searchQ||filterStatus!=='all'||ddRecvFrom||ddPriorityFilter!=='all'||ddCustomerFilter!=='all'||ddSpecFilter!=='all'?'🔍 Không tìm thấy đơn hàng phù hợp':'📦 Chưa có đơn hàng nào trong hệ thống';

  $('mc').innerHTML=`
    <div class="dd-page-head">
      <div>
        <div class="dd-page-title">📋 Đơn hàng</div>
        <div class="dd-page-sub">Quản lý và theo dõi tất cả đơn hàng từ khách hàng</div>
      </div>
      <div class="dd-page-actions">
        <button class="dd-page-btn" onclick="tbFilterBtnClick(this)">🔽 Bộ lọc</button>
        <button class="dd-page-btn" onclick="ddResetFilters()">↺ Đặt lại</button>
        <button class="dd-page-btn" onclick="ddExportExcel()">⬇️ Xuất Excel</button>
        ${canCreateOrder()?`<button class="dd-page-btn primary" onclick="openAddOrder()">＋ Tạo đơn hàng</button>`:''}
      </div>
    </div>
    <div class="dd-overview">
      <span><b>${total}</b>đơn đang quản lý</span>
      <span><b>${totalCustomers}</b>khách hàng</span>
      <span><b>${totalKg.toLocaleString('vi-VN')}kg</b>tổng sản lượng</span>
    </div>

    ${usBarHTML('dorDang', searchQ, 'srchInp', '🔍 Tìm mã đơn, PO, khách hàng, quy cách, sản phẩm...')}

    <div class="dd-filter-inline">${usSheetBody('dorDang')}</div>

    <div class="dd-stats-sticky"><div class="dd-stats">
      ${stats.map(s=>`<button class="dd-stat${filterStatus===s.key?' active':''}" onclick="ddSetStatusFilter('${s.key}')">
        <div class="dd-stat-ic" style="background:${s.ic};color:${s.col}">${s.icon}</div>
        <div class="dd-stat-txt"><div class="dd-stat-l">${s.l}</div><div class="dd-stat-n">${s.n}</div><div class="dd-stat-link">Xem chi tiết →</div></div>
      </button>`).join('')}
      <button class="dd-stat" title="Xem ở tab Hoàn thành" onclick="goTab('hoanThanh')">
        <div class="dd-stat-ic" style="background:#F3E8FF;color:#7C3AED">✅</div>
        <div class="dd-stat-txt"><div class="dd-stat-l">HOÀN THÀNH</div><div class="dd-stat-n">${doneCount}</div><div class="dd-stat-link">Xem chi tiết →</div></div>
      </button>
      <button class="dd-stat" style="cursor:default" onclick="void(0)">
        <div class="dd-stat-ic" style="background:#DBEAFE;color:#2856D6">⚖️</div>
        <div class="dd-stat-txt"><div class="dd-stat-l">TỔNG SỐ LƯỢNG</div><div class="dd-stat-n">${totalKg.toLocaleString('vi-VN')}</div><div class="dd-stat-link" style="color:var(--text4)">kg</div></div>
      </button>
    </div></div>

    <div class="dd-status-tabs">
      <button class="dd-status-tab${filterStatus==='all'?' active':''}" onclick="ddSetStatusFilter('all')">Tất cả</button>
      <button class="dd-status-tab${filterStatus==='producing'?' active':''}" onclick="ddSetStatusFilter('producing')">Đang sản xuất</button>
      <button class="dd-status-tab${filterStatus==='waiting'?' active':''}" onclick="ddSetStatusFilter('waiting')">Chờ sản xuất</button>
      <button class="dd-status-tab${filterStatus==='overdue'?' active':''}" onclick="ddSetStatusFilter('overdue')">Trễ hạn</button>
      <button class="dd-status-tab" onclick="goTab('hoanThanh')">Hoàn thành</button>
    </div>

    <div class="dd-mobile-only">
      <div class="mob-ord-stats">
        ${mobStats.map(s=>`<div class="mob-ord-stat${(!s.nav&&filterStatus===s.key)?' active':''}" style="--mob-c:${s.c}" onclick="${s.nav?`goTab('hoanThanh')`:`ddSetStatusFilter('${s.key}')`}">
          <div class="mob-ord-stat-lbl">${s.l}</div>
          <div class="mob-ord-stat-n">${s.n}</div>
          <div class="mob-ord-stat-sub">đơn</div>
        </div>`).join('')}
      </div>
      <div class="mob-ord-tabs">
        ${mobTabs.map(t=>`<div class="mob-ord-tab${(!t.nav&&filterStatus===t.key)?' active':''}" onclick="${t.nav?`goTab('hoanThanh')`:`ddSetStatusFilter('${t.key}')`}">${t.l}</div>`).join('')}
      </div>
      ${!list.length
        ? `<div class="mob-ord-empty">${emptyMsg}</div>`
        : `<div class="mob-ord-count">Hiển thị ${list.length} / ${total} đơn hàng</div>
           <div class="mob-ord-list">${list.map(o=>mocCard(o)).join('')}</div>`}
    </div>

    ${!list.length
      ? `<div class="ord-empty">${emptyMsg}</div>`
      : `<div class="ord-list-toolbar">
          <span class="ord-list-count">Hiển thị ${list.length} / ${total} đơn hàng</span>
        </div>
        <div class="dd-scrolltop" id="ddScrollTop"><div class="dd-scrolltop-inner" id="ddScrollTopInner"></div></div>
        <div class="dd-table-wrap" id="ddTableWrap"><table class="dd-table" id="ddTable"><thead><tr>
          <th>STT</th>
          <th>Khách hàng</th>
          <th>Loại</th>
          <th>Nguyên liệu</th>
          <th>Quy cách</th>
          <th>Số lượng</th>
          <th>Đã sản xuất</th>
          <th>Ghi chú</th>
          <th>Ngày nhận</th>
          <th>Ngày giao</th>
          <th>Ưu tiên</th>
          <th>Trạng thái</th>
          <th>Thao tác</th>
        </tr></thead><tbody>${list.map((o,i)=>ddRow(o,i+1)).join('')}</tbody></table></div>`}
  `;
  usAttachSearchInput(document.getElementById('srchInp'), v=>searchQ=v, renderDorDang, hadFocus, caretPos);
  initTopScroll('ddScrollTop','ddScrollTopInner','ddTableWrap','ddTable');
}

// ── Thẻ đơn hàng cho giao diện MOBILE của tab "Đơn hàng" (xem renderDorDang) ──
// Dùng lại nguyên dữ liệu/hàm đã có: ddCode, ddStatusMeta, ddOverdue, specStr...
// chỉ đổi cách trình bày thành thẻ card giống ảnh mẫu, tối ưu cho màn hình hẹp.
function mocRightHTML(o, meta, overdue){
  if(overdue){
    const days = o.deliveryDate ? Math.max(1,Math.ceil((new Date(new Date().toDateString())-new Date(o.deliveryDate))/86400000)) : '';
    return `<div class="moc-icon-plain" style="--mc:#DC2626">⚠️</div><div class="moc-sub">Trễ ${days} ngày</div>`;
  }
  if(meta.key==='producing'){
    const qty=o.qty||0, done=o.doneQty||0;
    const pct = qty ? Math.min(100,Math.round(done/qty*100)) : 0;
    const color = pct>=100?'#15966C':pct>=50?'#2856D6':'#F59E0B';
    const kgTotal = Number(o.kg)||0;
    const kgDone = Math.round(kgTotal*pct/100);
    return `<div class="moc-ring" style="--mp:${pct};--mc:${color}"><div class="moc-ring-inner">${pct}%</div></div>
      <div class="moc-sub">${kgDone.toLocaleString('vi-VN')} / ${kgTotal.toLocaleString('vi-VN')} kg</div>`;
  }
  // Chưa lập kế hoạch / đã lập kế hoạch (chờ sản xuất)
  let sub = '—';
  if(o.deliveryDate){
    const daysLeft = Math.ceil((new Date(o.deliveryDate)-new Date(new Date().toDateString()))/86400000);
    sub = daysLeft<=0 ? 'Hôm nay' : `Còn ${daysLeft} ngày`;
  }
  return `<div class="moc-icon-circle" style="--mc:#64748B">🕐</div><div class="moc-sub">${sub}</div>`;
}
function mocCard(o){
  const meta = ddStatusMeta(o);
  const overdue = ddOverdue(o);
  const badge = overdue ? {label:'Trễ hạn', bg:'#FEE2E2', color:'#B91C1C', border:'#FCA5A5'} : meta;
  const pc = PRI_COLOR[o.priority]||'#64748b';
  return `<div class="moc-card" data-order-id="${o.id}" onclick="ddViewDetail('${o.id}')">
    <div class="moc-head">
      <span class="moc-code">${o.customer||'—'}</span>
      <span class="moc-badge" style="background:${badge.bg};color:${badge.color};border-color:${badge.border}">${badge.label}</span>
      ${isAdmin()?`<button class="moc-del" title="Xóa đơn hàng" aria-label="Xóa đơn hàng" onclick="mocDeleteCard('${o.id}',event)">🗑</button>`:''}
    </div>
    <div class="moc-body">
      <div class="moc-left">
        ${o.priority?`<div class="moc-row"><span class="moc-lbl">Ưu tiên:</span><span class="moc-val"><span class="moc-pri-chip" style="background:${pc}1a;color:${pc};border-color:${pc}55">🚩 ${o.priority}</span></span></div>`:''}
        <div class="moc-row"><span class="moc-lbl">Nguyên liệu:</span><span class="moc-val">${ddMaterialLabel(o.material)}</span></div>
        <div class="moc-row"><span class="moc-lbl">Loại:</span><span class="moc-val">${o.type||'—'}</span></div>
        <div class="moc-row"><span class="moc-lbl">Sản phẩm:</span><span class="moc-val">${specStr(o)}</span></div>
        <div class="moc-row"><span class="moc-lbl">Số thanh đặt:</span><span class="moc-val">${qtyLabel(o)}</span></div>
        <div class="moc-row"><span class="moc-lbl">Ngày đặt:</span><span class="moc-val">${fmtDate(o.createdAt)}</span></div>
        <div class="moc-row"><span class="moc-lbl">Ngày giao:</span><span class="moc-val${overdue?' overdue':''}">${fmtDate(o.deliveryDate)}</span></div>
      </div>
      <div class="moc-right">${mocRightHTML(o, meta, overdue)}</div>
    </div>
    <div class="moc-chev">›</div>
  </div>`;
}

// ── Xóa đơn hàng ngay trên thẻ mobile (tab Đơn hàng) ──
// Chỉ Admin mới thấy nút 🗑 (xem mocCard), nhưng vẫn kiểm tra lại quyền ở đây
// để chặn trường hợp gọi trực tiếp từ console / thẻ cũ còn sót trong DOM sau
// khi đổi tài khoản. Dùng lại NGUYÊN deleteOrder() đã có (confirm2 + ghi
// nhật ký "Xóa đơn" + saveOrders + dò đơn trùng lặp), không tạo luồng xoá
// riêng để tránh lệch dữ liệu giữa mobile và desktop.
function mocDeleteCard(id, ev){
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  closeAllActionMenus();
  if(!isAdmin()){ showToast('Chỉ Admin mới được xóa đơn hàng', true); return; }
  deleteOrder(id);
}

function clearSearch(){
  searchQ='';
  renderDorDang();
}
