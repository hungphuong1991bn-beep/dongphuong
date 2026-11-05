// src/modules/planning/planning-detail.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── 1 dòng bảng Kế hoạch sản xuất (ERP/MES table style, đồng bộ Tab Đơn hàng) ──
// Tiến độ theo CÔNG ĐOẠN sản xuất hiện tại (0-100%), độc lập với số lượng đã chạy —
// dùng để cột "Tiến độ" luôn cập nhật ngay khi đổi công đoạn, kể cả khi chưa nhập doneQty.
function khStageProgressPct(o){
  const s=o.status==='cutting'?'running':o.status;
  if(s==='done') return 100;
  if(s==='pending') return 0;
  const curIdx=STAGES.findIndex(x=>x.key===o.stage);
  const activeIdx=curIdx<0?0:curIdx;
  return Math.round((activeIdx/STAGES.length)*100);
}

function khQuickProgress(id, ev){ if(ev) ev.stopPropagation(); openProgress(id); }
function khEditRow(id, ev){ if(ev) ev.stopPropagation(); editOrder(id); }
function khDeleteRow(id, ev){ if(ev) ev.stopPropagation(); deleteOrder(id); }
// Chuyển đơn đang chạy về lại "Chờ sản xuất" — dùng khi bấm "Bắt đầu" nhầm
// hoặc cần tạm dừng kế hoạch. Dùng lại đúng setStatus() + withPlanLock() như
// khPlanAction(), và dùng confirm2() (modal xác nhận riêng của hệ thống)
// thay vì confirm() gốc của trình duyệt — confirm() gốc không hoạt động
// trong môi trường chạy app này nên trước đó bấm không có phản ứng gì.
function khRevertToPending(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  confirm2('Chuyển về Chờ sản xuất',
    `Chuyển đơn "${o.customer||''}" về trạng thái Chờ sản xuất? Đồng hồ chạy máy hiện tại sẽ dừng lại.`,
    ()=>{ withPlanLock(id, ()=>setStatus(id, 'pending')); });
}
// Menu "⋯" thu gọn Xem chi tiết / Sửa / Xóa — dùng chung #globalActionMenu
// giống hệt cơ chế ddToggleMenu/htToggleMenu (openActionMenu/closeAllActionMenus).
function khToggleMenu(id, ev){
  if(ev) ev.stopPropagation();
  const menu = document.getElementById('globalActionMenu');
  if(!menu) return;
  const wasOpenForThis = menu.classList.contains('open') && menu.dataset.forId === 'kh-'+id;
  closeAllActionMenus();
  if(wasOpenForThis) return;
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  const s = o.status==='cutting'?'running':o.status;
  const canEdit = isAdmin();
  menu.innerHTML = `
    <button onclick="closeAllActionMenus();khViewDetail('${o.id}')">👁 Xem chi tiết</button>
    ${s==='running'?`<button onclick="closeAllActionMenus();khRevertToPending('${o.id}',event)">⏳ Chuyển về Chờ sản xuất</button>`:''}
    ${canEdit?`<button onclick="closeAllActionMenus();khEditRow('${o.id}',event)">✏️ Sửa đơn hàng</button>`:''}
    ${canEdit?`<button class="danger" onclick="closeAllActionMenus();khDeleteRow('${o.id}',event)">🗑 Xóa đơn hàng</button>`:''}
  `;
  menu.dataset.forId = 'kh-'+id;
  const btn = ev && ev.target && ev.target.closest('button');
  if(btn) openActionMenu(menu, btn);
}

// ── Timeline dạng ERP: Ngày tạo → Bắt đầu → các công đoạn → Hoàn thành ──
function khTimeline(o){
  const s = o.status==='cutting'?'running':o.status;
  const curIdx = STAGES.findIndex(x=>x.key===o.stage);
  const activeIdx = s==='done' ? STAGES.length : (curIdx<0?-1:curIdx);
  const items = [
    {label:'Ngày tạo', ts:o.createdAt, done:!!o.createdAt},
    {label:'Bắt đầu sản xuất', ts:o.startedAt, done:!!o.startedAt, active: !o.startedAt && s==='pending'},
  ];
  STAGES.forEach((st,i)=>{
    items.push({label:st.label, done: s==='done' || i<activeIdx, active: i===activeIdx && s!=='done'});
  });
  items.push({label:'Hoàn thành', ts:o.doneAt, done:s==='done'});
  return `<div class="kh-timeline">${items.map(it=>`
    <div class="kh-tl-item ${it.done?'done':''} ${it.active?'active':''}">
      <div class="kh-tl-dot"></div>
      <div class="kh-tl-body"><div class="kh-tl-lbl">${it.label}</div>${it.ts?`<div class="kh-tl-time">${fmtDateTime(it.ts)}</div>`:''}</div>
    </div>`).join('')}</div>`;
}

// ── Cảnh báo trong panel chi tiết: quá hạn / sắp quá hạn / AI cảnh báo ──
function khAlerts(o){
  let html='';
  if(khIsOverdue(o)){
    html += `<div class="kh-alert danger">🔴 Đơn hàng đã QUÁ HẠN giao (${fmtDate(o.deliveryDate)})</div>`;
  } else if(o.status!=='done' && o.deliveryDate && (new Date(o.deliveryDate)-new Date())<86400000*2){
    html += `<div class="kh-alert warn">🟡 Sắp đến hạn giao (${fmtDate(o.deliveryDate)})</div>`;
  }
  html += renderAIWarn(o);
  return html;
}

// ── Mã nguyên liệu: mỗi mã là 1 tag, có nút Copy + QR + trạng thái ──
function khMatCodeTags(o){
  if(!o.matCodes || !o.matCodes.length) return '<div class="empty" style="padding:6px 0;font-size:12.5px;color:var(--text4)">Chưa có mã nguyên liệu</div>';
  return `<div class="kh-mat-list">${o.matCodes.map(m=>{
    const safe = String(m).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `<div class="kh-mat-chip">
      <span class="kh-mat-chip-code">🏷 ${m}</span>
      <span class="kh-mat-chip-status">Đang dùng</span>
      <button class="kh-mat-chip-btn" title="Sao chép mã" onclick="khCopyMatCode('${safe}')">📋</button>
      <button class="kh-mat-chip-btn" title="Xem QR" onclick="khShowMatQR('${safe}')">▦</button>
    </div>`;
  }).join('')}</div>`;
}
function khCopyMatCode(code){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(()=>showToast('✅ Đã sao chép mã: '+code)).catch(()=>showToast('❌ Không thể sao chép, vui lòng tự chọn và copy', true));
  }
}
function khShowMatQR(code){
  $('khMatQRTitle').textContent = 'QR mã nguyên liệu: '+code;
  openModal('khMatQRModal');
  setTimeout(()=>{
    const canvas=$('khMatQRCanvas');
    if(canvas && typeof QRCode!=='undefined'){
      QRCode.toCanvas(canvas, code, {width:200,margin:1}, function(err){ if(err) console.error(err); });
    }
  }, 50);
}

// ── Nhật ký thao tác riêng của 1 kế hoạch sản xuất ──
function khOrderLogs(o){
  const logs = actLog.filter(l=>l.orderId===o.id).slice(0,20);
  if(!logs.length) return '<div class="empty" style="padding:6px 0;font-size:12.5px;color:var(--text4)">Chưa có nhật ký</div>';
  return `<div class="kh-log-list">${logs.map(l=>`
    <div class="kh-log-item">
      <div class="kh-log-top"><b>${l.user||'—'}</b><span>${vnDateTimeShort(new Date(l.ts))}</span></div>
      <div class="kh-log-txt">${l.action}${l.detail?' · '+l.detail:''}</div>
    </div>`).join('')}</div>`;
}

// ── Khối "Thống kê sản xuất" trong panel chi tiết: số lượng, tiến độ, thời gian chạy ──
function khProductionStats(o){
  const s = o.status==='cutting'?'running':o.status;
  if(s==='pending') return '<div class="empty" style="padding:4px 0;font-size:12.5px;color:var(--text4)">Chưa bắt đầu sản xuất nên chưa có thống kê</div>';
  const qty=o.qty||0, done=o.doneQty||0;
  const remain=Math.max(0, qty-done);
  const qtyPct = qty ? Math.min(100,Math.round(done/qty*100)) : 0;
  const stagePct = khStageProgressPct(o);
  const unit = o.isCoil ? 'cuộn' : (o.isRound?'cây':'thanh');
  const elapsedMs = o.startedAt ? (s==='done'&&o.doneAt ? o.doneAt-o.startedAt : Date.now()-o.startedAt) : 0;
  const curStage = STAGES.find(x=>x.key===o.stage);
  return `<div class="kh-detail-grid">
    <div><b>Đã hoàn thành</b><span>${done}/${qty||0} ${unit} (${qtyPct}%)</span></div>
    <div><b>Còn lại</b><span>${remain} ${unit}</span></div>
    <div><b>Tiến độ công đoạn</b><span>${s==='done'?'✓ 100%':stagePct+'%'}</span></div>
    <div><b>Công đoạn hiện tại</b><span>${s==='done'?'Đã hoàn tất':(curStage?curStage.icon+' '+curStage.label:'—')}</span></div>
    <div><b>Thời gian đã sản xuất</b><span>${elapsedMs?fmtDuration(elapsedMs):'—'}</span></div>
    <div><b>Ghi chú tiến độ</b><span>${o.progressNote||'—'}</span></div>
  </div>`;
}

// ── Mở Panel chi tiết (Drawer bên phải) cho 1 kế hoạch sản xuất ──
let _khDetailOpenId = null; // id của kế hoạch đang mở trong panel chi tiết (để biết cần refresh realtime hay không)

// Gọi hàm này ngay sau MỌI thao tác có thể đổi dữ liệu 1 đơn (trạng thái, công đoạn, tiến độ...)
// để panel chi tiết (nếu đang mở đúng đơn đó) tự vẽ lại NGAY LẬP TỨC — không cần đóng/mở lại hay F5.
function refreshKhDetailIfOpen(id){
  const modal = document.getElementById('khDetailModal');
  if(modal && modal.classList.contains('open') && _khDetailOpenId===id){
    khViewDetail(id);
  }
}

function khViewDetail(id){
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  _khDetailOpenId = id;
  const meta=ddStatusMeta(o);
  const pc=PRI_COLOR[o.priority]||'#64748b';
  $('khDetailTitle').textContent = `${o.customer||'—'} · ${ddCode(o)}`;
  $('khDetailBody').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">
      <span class="dd-status-pill" style="background:${meta.bg};color:${meta.color};border-color:${meta.border}">${meta.label}</span>
      <span class="ord-pri" style="background:${pc}1a;color:${pc};border-color:${pc}55">🚩 ${o.priority||'—'}</span>
    </div>
    ${khAlerts(o)}
    <div class="kh-detail-sec">
      <div class="kh-detail-sec-title">📦 Thông tin đơn</div>
      <div class="kh-detail-grid">
        <div><b>Khách hàng</b><span>${o.customer||'—'}</span></div>
        <div><b>PO</b><span>${o.po||'—'}</span></div>
        <div><b>Mã đơn</b><span>${ddCode(o)}</span></div>
        <div><b>Sản phẩm</b><span>${o.type||'—'}</span></div>
        <div><b>Nguyên liệu</b><span>${ddMaterialLabel(o.material)}</span></div>
        <div><b>Quy cách</b><span>${specStr(o)}</span></div>
        <div><b>Số lượng</b><span>${qtyLabel(o)}</span></div>
        <div><b>Khối lượng</b><span>${o.kg||0} kg</span></div>
        <div><b>Mức ưu tiên</b><span>🚩 ${o.priority||'—'}</span></div>
        <div><b>Người phụ trách</b><span>${ddOwner(o)}</span></div>
        <div><b>Ngày tạo</b><span>${fmtDateTime(o.createdAt)}</span></div>
        <div><b>Ngày Đặt</b><span>${o.createdAt?fmtDate(o.createdAt):'—'}</span></div>
        <div><b>Ngày bắt đầu</b><span>${o.startedAt?fmtDateTime(o.startedAt):'—'}</span></div>
        <div><b>Hạn giao</b><span>${fmtDate(o.deliveryDate)}</span></div>
      </div>
      ${o.note?`<div style="margin-top:10px;padding:8px 10px;background:var(--amber-l);border-left:3px solid var(--amber-m);border-radius:0 8px 8px 0;line-height:1.5"><b>📝 Ghi chú:</b> ${o.note}</div>`:''}
    </div>
    <div class="kh-detail-sec">
      <div class="kh-detail-sec-title">🧵 Nguyên liệu đầu vào</div>
      ${khMatCodeTags(o)}
    </div>
    <div class="kh-detail-sec">
      <div class="kh-detail-sec-title">📊 Tiến độ sản xuất</div>
      ${renderProgressBar(o)||'<div class="empty" style="padding:4px 0;font-size:12.5px;color:var(--text4)">Chưa bắt đầu sản xuất</div>'}
      ${renderStageTracker(o, isStaff())}
    </div>
    <div class="kh-detail-sec">
      <div class="kh-detail-sec-title">🏭 Phân công máy</div>
      ${khMachineAssignHTML(o)}
    </div>
    <div class="kh-detail-sec">
      <div class="kh-detail-sec-title">📈 Thống kê sản xuất</div>
      ${khProductionStats(o)}
    </div>
    <div class="kh-detail-sec">
      <div class="kh-detail-sec-title">🕐 Timeline</div>
      ${khTimeline(o)}
    </div>
    <div class="kh-detail-sec">
      <div class="kh-detail-sec-title">📋 Nhật ký</div>
      ${khOrderLogs(o)}
    </div>
  `;
  const progBtn=$('khDetailProgressBtn'); if(progBtn) progBtn.onclick=()=>{ closeModal('khDetailModal'); openProgress(id); };
  // Nút "Chỉnh sửa" chỉ dành cho admin — xem chú thích tương tự ở ddViewDetail().
  const editBtn=$('khDetailEditBtn');
  if(editBtn){
    if(isAdmin()){
      editBtn.style.display = '';
      editBtn.onclick = ()=>{ closeModal('khDetailModal'); editOrder(id); };
    } else {
      editBtn.style.display = 'none';
      editBtn.onclick = null;
    }
  }
  openModal('khDetailModal');
}
