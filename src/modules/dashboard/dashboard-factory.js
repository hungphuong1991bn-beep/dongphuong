// src/modules/dashboard/dashboard-factory.js — Giai đoạn 2: widget điều hành nhà máy trên Tổng quan
// ────────────────────────────────────────────────────────────────────
// CHỈ ĐỌC dữ liệu có sẵn (DB.orders, DB.baoTri, DB.qrProducts, 3 sổ). Không ghi DB.
// Chỉ số nào nguồn chưa có (OEE, NG theo công đoạn, tồn nguyên liệu, thời gian chạy/dừng
// máy) → hiện "CHƯA CÓ DỮ LIỆU", không ước lượng, không bịa số.
// Mọi builder bọc try/catch: lỗi 1 widget không làm hỏng cả trang Tổng quan.
// ────────────────────────────────────────────────────────────────────
const DP_NA = '<span class="ds-na">CHƯA CÓ DỮ LIỆU</span>';
function dpSafe(fn, ...a){ try{ return fn(...a); }catch(e){ console.warn('[dashboard-factory]', fn.name, e); return ''; } }
function dpActive(o){ return o && o.status!=='done'; }

// ── G. Truy xuất nhanh ───────────────────────────────────────────────
function buildDpQuickTrace(){
  return `<div class="dp-quick">
    <div class="dp-quick-t">🔎 Truy xuất nhanh</div>
    <div class="dp-quick-row">
      <input id="dpQuickInput" class="ds-input" type="search" autocomplete="off"
        placeholder="Nhập mã đơn / PO / mã lô / Heat-Lot / mã sản phẩm / mã QR…"
        onkeydown="if(event.key==='Enter')dpQuickTrace()">
      <button class="ds-btn primary" onclick="dpQuickTrace()">Tra cứu</button>
      <button class="ds-btn" onclick="dpQuickScan()">📷 Quét QR</button>
    </div>
  </div>`;
}
function dpQuickTrace(){
  const v = (($('dpQuickInput')||{}).value||'').trim();
  if(!v){ showToast('Nhập mã cần truy xuất', true); return; }
  _trQ = v; goTab('truyXuat');   // renderTraceTab() tự chạy truy xuất với _trQ
}
function dpQuickScan(){ goTab('truyXuat'); setTimeout(()=>{ if(typeof trStartScan==='function') trStartScan(); }, 250); }

// ── A. KPI bổ sung (chỉ số thật; thiếu nguồn → CHƯA CÓ DỮ LIỆU) ───────
function buildDpExtraKpis(orders){
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const done = orders.filter(o=>o.status==='done');
  const doneToday = done.filter(o=>(o.doneAt||0)>=today0.getTime());
  const kgToday = doneToday.reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
  const onTime = done.filter(o=>!o.deliveryDate || (o.doneAt||0)<=new Date(o.deliveryDate).getTime()+86400000).length;
  const qr = (DB.qrProducts||[]);
  const pass = qr.filter(p=>p.qcResult==='pass'), fail = qr.filter(p=>p.qcResult==='fail');
  const qcN = pass.length + fail.length;
  const ngQty = fail.reduce((s,p)=>s+(Number(p.quantity)||0),0);
  const cards = [
    {ic:'⚖️', lbl:'Khối lượng hoàn thành hôm nay', val: doneToday.length ? ovFmtKg(kgToday)+' kg' : '0 kg', sub: `${doneToday.length} đơn hoàn thành`, click:'goToDorDangToday()'},
    {ic:'🎯', lbl:'Tỷ lệ đơn đúng hạn', val: done.length ? Math.round(onTime/done.length*100)+'%' : DP_NA, sub: done.length ? `${onTime}/${done.length} đơn đã hoàn thành` : 'Chưa có đơn hoàn thành', click:"goTab('hoanThanh')"},
    {ic:'✅', lbl:'Tỷ lệ đạt chuẩn QC', val: qcN ? Math.round(pass.length/qcN*100)+'%' : DP_NA, sub: qcN ? `${pass.length} đạt / ${fail.length} không đạt (mã QR)` : 'Chưa có kết quả QC trên mã QR', click:"goTab('qrCode')"},
    {ic:'⛔', lbl:'Hàng NG (QC không đạt)', val: qcN ? fmtNum(ngQty) : DP_NA, sub: qcN ? `${fail.length} mã QR không đạt` : 'Chưa có kết quả QC', click:"goTab('qrCode')"},
    {ic:'📊', lbl:'OEE toàn nhà máy', val: DP_NA, sub:'Chưa ghi nhận thời gian chạy/dừng và tốc độ chuẩn của máy', click:''}
  ];
  return `<div class="dp-kpi-grid">${cards.map(c=>`
    <div class="ov-kpi-card dp-kpi" ${c.click?`onclick="${c.click}"`:'style="cursor:default"'}>
      <div class="ov-kpi-top"><div class="ov-kpi-ic" style="background:var(--ds-info-bg);color:var(--ds-info)">${c.ic}</div><div class="ov-kpi-lbl">${c.lbl}</div></div>
      <div class="ov-kpi-val">${c.val}</div>
      <div class="ov-kpi-delta flat">${c.sub}</div>
    </div>`).join('')}</div>`;
}

// ── B. Tình trạng sản xuất theo công đoạn ────────────────────────────
// Định nghĩa (đọc từ dữ liệu có sẵn):
//  Đang chạy = đơn chưa xong đang ở công đoạn này (o.stage, status running/cutting)
//  Chờ vào   = Đùn: đơn chưa chạy (pending) · công đoạn sau: đơn đang ở công đoạn liền trước
//  Đã qua    = đơn đã hoàn thành, hoặc đã sang công đoạn sau
function dpStageStats(orders){
  const today = todayStr();
  const ledger = {rut: DB.mayRutLog||[], cat:[], danhbong:[]};
  (DB.mayDanhBongLog||[]).forEach(r=>{ (trText(r.congDoan||'').indexOf('cat')>=0 ? ledger.cat : ledger.danhbong).push(r); });
  return STAGES.map((s,i)=>{
    const at = o => (o.stage||'dun');
    const running = orders.filter(o=>(o.status==='running'||o.status==='cutting') && at(o)===s.key);
    const passed  = orders.filter(o=>o.status==='done' || (o.status!=='pending' && STAGES.findIndex(x=>x.key===at(o))>i));
    const incoming = i===0 ? orders.filter(o=>o.status==='pending')
                           : orders.filter(o=>(o.status==='running'||o.status==='cutting') && at(o)===STAGES[i-1].key);
    const rows = (ledger[s.key]||[]).filter(r=>r.ngay===today);
    const hasLedger = s.key!=='dun';
    const thanh = rows.reduce((t,r)=>t+(Number(r.soThanh)||0),0);
    return {key:s.key, label:s.label, icon:s.icon, running, passed, incoming, hasLedger, ledgerRows:rows.length, thanh, kgRunning: running.reduce((t,o)=>t+(parseFloat(o.kg)||0),0)};
  });
}
function buildDpStageBoard(orders){
  const st = dpStageStats(orders);
  const today = todayStr();
  const nlToday = (DB.nguyenLieuLog||[]).filter(r=>r.ngay===today && r.heatLot);
  const nlKg = nlToday.reduce((t,r)=>t+(parseFloat(r.soLuong)||0),0);
  const doneN = orders.filter(o=>o.status==='done').length;
  const node = (cls, icon, title, badge, lines, click) => `
    <div class="dp-node ${cls}" ${click?`onclick="${click}"`:''}>
      <div class="dp-node-h"><span>${icon}</span><b>${title}</b></div>
      ${badge}
      <div class="dp-node-l">${lines.join('')}</div>
    </div>`;
  const ln = (k,v)=>`<div><span>${k}</span><b>${v}</b></div>`;
  let html = node('nl','🧪','Nguyên liệu',
      `<span class="ds-badge ${nlToday.length?'ok':''} dot">${nlToday.length?'Có nhập hôm nay':'Chưa nhập hôm nay'}</span>`,
      [ln('Dòng nhập hôm nay',nlToday.length), ln('Khối lượng (kg)',nlToday.length?ovFmtKg(nlKg):'0')], "goTab('soLieu')");
  st.forEach(s=>{
    const lines=[ ln('Chờ vào',s.incoming.length), ln('Đã qua',s.passed.length) ];
    lines.push(s.hasLedger ? ln('Sổ hôm nay', s.ledgerRows? `${s.ledgerRows} dòng · ${fmtNum(s.thanh)} thanh` : '0') : ln('Sổ máy', '<span class="ds-na">CHƯA CÓ SỔ</span>'));
    html += '<div class="dp-arrow">›</div>' + node(s.running.length?'st run':'st', s.icon, s.label,
      `<span class="ds-badge ${s.running.length?'ok':''} dot">${s.running.length?s.running.length+' đơn đang chạy':'Không có đơn chạy'}</span>`, lines, `dpOpenStageList('${s.key}')`);
  });
  html += '<div class="dp-arrow">›</div>' + node('fin','📦','Thành phẩm',
      `<span class="ds-badge info dot">${doneN} đơn hoàn thành</span>`,
      [ln('Mã QR đã tạo',(DB.qrProducts||[]).length), ln('NG công đoạn','<span class="ds-na">CHƯA GHI</span>')], "goTab('hoanThanh')");
  return `<div class="ov-panel dp-board"><div class="ov-panel-title">🏭 Tình trạng sản xuất theo công đoạn <span class="ov-sub2">(bấm công đoạn để xem danh sách)</span></div>
    <div class="dp-flow">${html}</div>
    <div class="dp-note">Sản lượng lỗi (NG) chưa được ghi theo từng công đoạn trong các sổ → hiển thị CHƯA CÓ DỮ LIỆU; chỉ có kết quả QC trên mã QR thành phẩm.</div></div>`;
}

// ── C. Tình trạng máy móc ────────────────────────────────────────────
function dpMachineSnapshot(){
  const list = MACHINES.map(m=>({m, st: machineRuntimeStatus(m.id)}));
  const by = c => list.filter(x=>x.st.code===c);
  return {list, run:by('run'), cho:by('cho'), sang:by('sang'), bt:by('bt'), sc:by('sc')};
}
function buildDpMachinePanel(){
  const s = dpMachineSnapshot(), total = s.list.length||1;
  const seg = [['#16a34a',s.run.length],['#f59e0b',s.cho.length],['#3b82f6',s.sang.length],['#8b5cf6',s.bt.length],['#dc2626',s.sc.length]];
  let acc=0; const stops = seg.map(([c,n])=>{ const a=acc/total*100; acc+=n; return `${c} ${a}% ${acc/total*100}%`; }).join(',');
  const stat = (cls,lab,arr,key)=>`<div class="dp-mstat ${cls}" onclick="dpOpenMachineList('${key}')"><b>${arr.length}</b><span>${lab}</span></div>`;
  const problems = [...s.sc, ...s.bt];
  return `<div class="ov-panel"><div class="ov-panel-title">⚙️ Tình trạng máy móc <span class="ov-sub2">(${s.list.length} máy)</span></div>
    <div class="dp-mwrap">
      <div class="dp-donut" style="background:conic-gradient(${stops})"><div><b>${s.list.length}</b><span>máy</span></div></div>
      <div class="dp-mstats">
        ${stat('run','Đang chạy',s.run,'run')}${stat('cho','Chờ sản xuất',s.cho,'cho')}${stat('sang','Sẵn sàng',s.sang,'sang')}
        ${stat('bt','Bảo trì',s.bt,'bt')}${stat('sc','Dừng / sự cố',s.sc,'sc')}
      </div>
    </div>
    <div class="dp-mprob-t">Máy có vấn đề</div>
    ${problems.length ? problems.map(x=>`<div class="dp-mprob" onclick="goTab('baoTriMay')"><span>${x.st.dot}</span><b>${esc(x.m.name)}</b><em>${x.st.code==='sc'?'Sự cố':'Bảo trì'}</em></div>`).join('')
      : '<div class="dp-ok">✅ Không có máy sự cố hoặc đang bảo trì.</div>'}
    <div class="dp-note">Trạng thái lấy từ tab Bảo trì máy + phân công đơn hàng. Thời gian chạy/dừng từng máy chưa được ghi nhận → ${DP_NA}.</div></div>`;
}

// ── F. Cảnh báo quan trọng ───────────────────────────────────────────
function buildDpAlerts(orders){
  const items=[]; const add=(lv,ic,text,click)=>items.push({lv,ic,text,click});
  const act = orders.filter(dpActive);
  const overdue = act.filter(ddOverdue);
  if(overdue.length) add('danger','⏰',`${overdue.length} đơn đã quá hạn giao`,"goToKeHoachFilter('overdue')");
  const t0=new Date(new Date().toDateString()).getTime();
  const soon = act.filter(o=>!ddOverdue(o) && !o.delivered && o.deliveryDate && new Date(o.deliveryDate).getTime()-t0<=2*86400000);
  if(soon.length) add('warn','⚠️',`${soon.length} đơn có nguy cơ trễ (hạn giao trong 48 giờ, chưa hoàn thành)`,"goTab('keHoach')");
  const snap = dpMachineSnapshot();
  if(snap.sc.length) add('danger','🔴',`Máy sự cố: ${snap.sc.map(x=>esc(x.m.name)).join(', ')}`,"goTab('baoTriMay')");
  if(snap.bt.length) add('warn','🟣',`Máy đang bảo trì: ${snap.bt.map(x=>esc(x.m.name)).join(', ')}`,"goTab('baoTriMay')");
  const due = MACHINES.map(m=>({m,s:getMaintTonState(m.id)})).filter(x=>x.s && x.s.level!=='ok');
  if(due.length) add(due.some(x=>x.s.level==='due')?'danger':'warn','🛠️',`Bảo trì đến hạn / sắp đến hạn: ${due.map(x=>esc(x.m.name)).join(', ')}`,"goTab('baoTriMay')");
  const qcFail = (DB.qrProducts||[]).filter(p=>p.qcResult==='fail');
  if(qcFail.length) add('danger','❌',`${qcFail.length} mã QR / lô QC không đạt`,"goTab('qrCode')");
  const src = trSource();
  const noTrace = orders.filter(o=>(o.status==='running'||o.status==='cutting'||o.status==='done') && trCoverage(o.id,{},src).level==='none');
  if(noTrace.length) add('info','🧩',`${noTrace.length} đơn đã/đang sản xuất chưa có dòng sổ nào liên kết truy xuất`,"goTab('truyXuat')");
  const rowsHtml = items.length ? items.map(a=>`<div class="dp-alert ${a.lv}" onclick="${a.click}"><span>${a.ic}</span><p>${a.text}</p><i>Xem ›</i></div>`).join('')
    : '<div class="dp-ok">✅ Không có cảnh báo.</div>';
  return `<div class="ov-panel"><div class="ov-panel-title">🚨 Cảnh báo quan trọng <span class="ov-sub2">(${items.length})</span></div>${rowsHtml}
    <div class="dp-note">Chưa có dữ liệu tồn kho nên chưa cảnh báo "nguyên liệu tồn thấp"; chưa ghi nhận thời gian dừng nên chưa cảnh báo "máy dừng bất thường" ngoài sự cố/bảo trì.</div></div>`;
}

// ── Drawer danh sách chi tiết ────────────────────────────────────────
function dpDrawer(title, bodyHtml){
  let ov=$('dpDrawer'); if(!ov){ ov=document.createElement('div'); ov.id='dpDrawer'; ov.className='ds-drawer-ov'; ov.onclick=e=>{ if(e.target===ov) dpCloseDrawer(); }; document.body.appendChild(ov); }
  ov.innerHTML=`<aside class="ds-drawer"><div class="ds-drawer-h"><span>${title}</span><button class="ds-btn sm" onclick="dpCloseDrawer()">✕</button></div><div class="ds-drawer-b">${bodyHtml}</div></aside>`;
  ov.classList.add('open');
}
function dpCloseDrawer(){ const ov=$('dpDrawer'); if(ov) ov.classList.remove('open'); }
function dpOrderRows(list){
  if(!list.length) return `<div class="ds-empty">Không có đơn nào.</div>`;
  return list.map(o=>`<div class="dp-li" onclick="dpCloseDrawer();ddViewDetail('${esc(o.id)}')"><b>${esc(o.customer||'—')}</b><span>PO ${esc(o.po||'—')} · ${esc(o.type||'')}</span><em>${o.deliveryDate?'Hạn '+fmtDate(o.deliveryDate):'Chưa có hạn giao'}</em></div>`).join('');
}
function dpOpenStageList(key){
  const s = dpStageStats(DB.orders).find(x=>x.key===key); if(!s) return;
  dpDrawer(`${s.icon} ${esc(s.label)}`,
    `<div class="dp-sec">Đang chạy (${s.running.length})</div>${dpOrderRows(s.running)}
     <div class="dp-sec">Chờ vào (${s.incoming.length})</div>${dpOrderRows(s.incoming)}`);
}
function dpOpenMachineList(code){
  const s = dpMachineSnapshot(); const arr = s[code]||[];
  const names={run:'Đang chạy',cho:'Chờ sản xuất',sang:'Sẵn sàng',bt:'Bảo trì',sc:'Dừng / sự cố'};
  dpDrawer(`⚙️ Máy — ${names[code]} (${arr.length})`, arr.length ? arr.map(x=>`<div class="dp-li" onclick="dpCloseDrawer();goTab('dieuHanh')"><b>${esc(x.m.name)}</b><span>${esc(x.m.group)}</span><em>${x.st.order?esc((x.st.order.customer||'—')+' · '+(x.st.order.type||'')):'Không có đơn'}</em></div>`).join('') : '<div class="ds-empty">Không có máy ở trạng thái này.</div>');
}

// Ghép các widget vào trang Tổng quan (gọi từ renderDashboard)
function buildDpFactoryBlock(orders){
  return dpSafe(buildDpExtraKpis,orders)
    + dpSafe(buildDpStageBoard,orders)
    + `<div class="dp-row2">${dpSafe(buildDpMachinePanel)}${dpSafe(buildDpAlerts,orders)}</div>`;
}
