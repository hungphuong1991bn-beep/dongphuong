// src/modules/qr/qr-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── Tạo hàng loạt QR khi 1 đơn hàng hoàn thành ──────────────────────
let _qrGenOrderId = null;
let _qrGenIsCoil = false;
function openQrGenForOrder(orderId){if(guardViewer())return;
  const o = DB.orders.find(x=>x.id===orderId);
  if(!o) return;
  _qrGenOrderId = orderId;
  _qrGenIsCoil = !!o.isCoil;
  const specStr = o.isRound ? `Φ${o.phi}×${o.length}mm` : `${o.thickness}×${o.width}×${o.length}mm`;
  $('qrGenOrderInfo').innerHTML = `Đơn: <b>${o.customer}</b> · ${specStr} · Mác: ${o.material||'—'} · Số lượng đơn: <b>${o.qty||0}</b> ${o.isCoil?'cuộn':'thanh'}`;
  const unit = o.isCoil ? 'cuộn' : 'thanh';
  $('qgQtyLabelTxt').textContent = `Tổng số ${unit} của đơn`;
  $('qgGroupLabelTxt').textContent = `Số ${unit} gộp / 1 mã QR`;
  $('qgQty').value = o.qty||1;
  // Đơn dạng cuộn: mặc định MỖI CUỘN 1 mã QR riêng (in 1 tem/cuộn) — vì mỗi
  // cuộn là 1 đơn vị vật lý độc lập, không gộp chung như bó thanh.
  // Đơn dạng thanh: vẫn gộp toàn bộ số thanh của đơn vào 1 mã QR như trước
  // (đỡ tốn tem khi bó thanh dán chung 1 tem).
  $('qgGroupSize').value = o.isCoil ? 1 : (o.qty||1);
  $('qgLabelsPerCode').value = o.isCoil ? 1 : 2;
  $('qgGrade').value = 'C1100';
  $('qgMachine').value = '';
  $('qgShift').value = 'Ca 1';
  $('qgProducer').value = '';
  $('qgOperator').value = currentUser?.name||'';
  $('qrGenErr').style.display = 'none';
  updateQrGenPreview();
  openModal('qrGenModal');
}
function updateQrGenPreview(){
  const unit = _qrGenIsCoil ? 'cuộn' : 'thanh';
  const totalQty = parseInt($('qgQty').value)||0;
  const groupSize = Math.max(1, parseInt($('qgGroupSize').value)||1);
  const labelsPerCode = Math.max(1, parseInt($('qgLabelsPerCode').value)||1);
  const codeCount = totalQty>0 ? Math.ceil(totalQty/groupSize) : 0;
  const el = $('qrGenPreview');
  if(!el) return;
  el.textContent = codeCount>0
    ? `→ Sẽ tạo ${codeCount} mã QR (mỗi mã ${groupSize} ${unit}) · In ${codeCount*labelsPerCode} tem`
    : '';
}
function confirmGenQr(){if(guardViewer())return;
  const o = DB.orders.find(x=>x.id===_qrGenOrderId);
  if(!o){ closeModal('qrGenModal'); return; }
  const unit = o.isCoil ? 'cuộn' : 'thanh';
  const qty = parseInt($('qgQty').value)||0;
  if(qty<1){ $('qrGenErr').textContent=`Nhập số lượng ${unit} hợp lệ (≥1)`; $('qrGenErr').style.display='block'; return; }
  const groupSize = Math.max(1, parseInt($('qgGroupSize').value)||qty);
  const labelsPerCode = Math.max(1, parseInt($('qgLabelsPerCode').value)||2);
  const opts = {
    copperGrade: $('qgGrade').value,
    machine: $('qgMachine').value.trim(),
    shift: $('qgShift').value, producer: $('qgProducer').value.trim(),
    operator: $('qgOperator').value.trim()
  };
  const created = createQrBatch(o, qty, opts, groupSize, labelsPerCode);
  closeModal('qrGenModal');
  showToast(`✅ Đã tạo ${created.length} mã QR (${qty} ${unit}) cho ${o.customer} · In ${created.length*labelsPerCode} tem`);
  goTab('qrCode');
}
// groupSize: số thanh gộp chung vào 1 mã QR (mặc định = toàn bộ đơn, tức
// chỉ tạo 1 mã QR cho cả đơn). labelsPerCode: số tem cần in cho mỗi mã QR
// (mặc định 2 — dán 2 đầu bó hàng — thay vì in 1 tem cho từng thanh).
function createQrBatch(order, qty, opts, groupSize, labelsPerCode){if(guardViewer())return;
  groupSize = Math.max(1, groupSize||qty||1);
  labelsPerCode = Math.max(1, labelsPerCode||2);
  _qrBatchCounter = 0;
  const now = Date.now();
  const unit = order.isCoil ? 'cuộn' : 'thanh';
  const specStr = order.isRound ? `Φ${order.phi}×${order.length}mm` : `${order.thickness}×${order.width}×${order.length}mm`;
  const created = [];
  let remaining = qty;
  let i = 0;
  let coveredSoFar = 0; // số thanh/cuộn đã gán vào các mã QR trước đó (dùng đánh số thứ tự cuộn)
  while(remaining>0){
    const thisQty = Math.min(groupSize, remaining);
    const code = genUniqueQrCode();
    // Mã sản phẩm: tự sinh ngay khi tạo mã QR (không dùng PO/ngày tháng của
    // đơn hàng như trước — vì PO nhiều khi được nhập dưới dạng ngày tháng,
    // gây nhầm lẫn khi hiển thị ở trang tra cứu công khai).
    const productCode = 'SP-' + code.replace(/^DP-/, '');
    // Đánh số thứ tự cuộn trong đơn (VD: "Cuộn 3/15" hoặc "Cuộn 4-6/15" nếu gộp nhiều cuộn/mã)
    const rangeStart = coveredSoFar+1, rangeEnd = coveredSoFar+thisQty;
    const coilLabel = order.isCoil ? (rangeStart===rangeEnd?`${rangeStart}/${qty}`:`${rangeStart}-${rangeEnd}/${qty}`) : '';
    const rec = {
      id: 'qr'+now+'_'+i+Math.random().toString(36).slice(2,5),
      qrCode: code,
      orderId: order.id, orderPO: order.po||'', productCode,
      materialCode: (order.matCodes&&order.matCodes.length)?order.matCodes.join(', '):'', productName: order.type||specStr,
      customer: order.customer||'',
      spec:{ thickness:order.thickness||0, width:order.width||0, length:order.length||0, isRound:!!order.isRound, phi:order.phi||0,
             isCoil:!!order.isCoil, meterPerCoil:order.meterPerCoil||0 },
      copperGrade: opts.copperGrade||'C1100',
      status:'producing', currentStage:'dun',
      machine: opts.machine||'', shift: opts.shift||'', producer: opts.producer||'',
      operator: opts.operator||'', prodDate: new Date().toISOString().slice(0,10),
      startTime: fmtDateTime ? fmtDateTime(now) : new Date(now).toLocaleString('vi-VN'),
      endTime:'', qcInspector:'', qcResult:'pending',
      hardness:'', conductivity:'', weight:'',
      // quantity: số thanh/cuộn gộp trong mã này. labelCount: số tem mặc định
      // in ra cho mã này khi bấm "In tem" (đỡ tốn tem dán so với 1 tem/thanh;
      // đơn dạng cuộn mặc định 1 tem/cuộn vì mỗi cuộn là 1 đơn vị vật lý riêng).
      quantity:thisQty, labelCount:labelsPerCode, location:'',
      coilLabel, coilTotal: order.isCoil?qty:0,
      note:'', images:[],
      history:[{stage:'dun',label:'Đùn',time:now,by:currentUser?.name||'?',note:`Bắt đầu sản xuất — cấp mã QR (${thisQty} ${unit})`}],
      createdAt:now, createdBy:currentUser?.id, updatedAt:now, updatedBy:currentUser?.id
    };
    DB.qrProducts.push(rec);
    created.push(rec);
    remaining -= thisQty;
    coveredSoFar += thisQty;
    i++;
  }
  log('Tạo mã QR', `${created.length} mã QR (${qty} ${unit}, ${groupSize}/mã) cho đơn ${order.customer}`, order.id, null, {qty, groupSize, labelsPerCode, codes: created.map(c=>c.qrCode).slice(0,5)});
  saveQrProducts();
  return created;
}

// ── Tìm kiếm & lọc (mục 7) ──────────────────────────────────────────
let qrSearchQ = '';
let qrFilterStatus = 'all';
function matchQr(p, q){
  if(!q) return true;
  q = q.toLowerCase();
  return [p.qrCode,p.productCode,p.customer,p.orderPO,p.machine,p.operator,p.prodDate,p.status,p.coilLabel]
    .some(v=>(''+(v||'')).toLowerCase().includes(q));
}
function setQrFilter(f){ qrFilterStatus=f; renderQR(); }

// ── Dashboard (mục 6) ────────────────────────────────────────────────
function qrDashboardCounts(){
  const list = DB.qrProducts;
  const codeCount = {};
  list.forEach(p=>{ codeCount[p.qrCode]=(codeCount[p.qrCode]||0)+1; });
  const trung = Object.values(codeCount).filter(n=>n>1).length;
  return {
    total: list.length,
    producing: list.filter(p=>p.status==='producing').length,
    qc: list.filter(p=>p.status==='qc_pending').length,
    inStock: list.filter(p=>p.status==='in_stock').length,
    outStock: list.filter(p=>p.status==='out_stock').length,
    error: list.filter(p=>p.status==='error').length,
    trung
  };
}
function qrDailyChart(){
  const days=[];
  for(let i=13;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const label=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    const n = DB.qrProducts.filter(p=>new Date(p.createdAt).toISOString().slice(0,10)===key).length;
    days.push({key,label,n});
  }
  const W=320,H=110,padB=20,padT=8,innerW=W,innerH=H-padT-padB;
  const gap=3, barW=Math.max(4,(innerW/14)-gap), max=Math.max(1,...days.map(d=>d.n));
  let bars='',labels='';
  days.forEach((d,i)=>{
    const x=i*(innerW/14)+((innerW/14-barW)/2);
    const h=d.n>0?Math.max(2,(d.n/max)*innerH):0;
    const y=padT+innerH-h;
    bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="var(--brand3)" opacity="${d.n>0?1:.18}"><title>${d.label}: ${d.n} QR</title></rect>`;
    if(i%3===0||i===13) labels+=`<text x="${(x+barW/2).toFixed(1)}" y="${H-6}" font-size="8" fill="var(--text4)" text-anchor="middle">${d.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">${bars}${labels}</svg>`;
}

// ── Render tab chính "Quản lý mã QR" ─────────────────────────────────
function renderQR(){
  const c = qrDashboardCounts();
  const searchInp = $('qrSearchInp');
  if(searchInp) qrSearchQ = searchInp.value;
  let list = DB.qrProducts.slice().sort((a,b)=>b.createdAt-a.createdAt);
  if(qrFilterStatus!=='all') list = list.filter(p=>p.status===qrFilterStatus);
  if(qrSearchQ) list = list.filter(p=>matchQr(p,qrSearchQ));
  const shown = list.slice(0,60);

  $('mc').innerHTML = `
    ${!fbOk()?`<div class="qr-stat-card" style="text-align:left;margin-bottom:10px;background:var(--red-l);cursor:pointer" onclick="$('fbSetup').style.display='flex';$('fbUrlInp').value=localStorage.getItem(FB_KEY)==='__skip__'?'':(localStorage.getItem(FB_KEY)||'')">
      <b style="color:var(--red)">⚠️ Chưa kết nối Firebase (cơ sở dữ liệu đám mây)</b><br>
      <span style="font-size:11.5px;color:var(--text3)">Các mã QR tạo lúc này sẽ KHÔNG quét được từ điện thoại khách hàng vì dữ liệu chỉ lưu trên máy này. Bấm vào đây để thiết lập kết nối.</span>
    </div>`:''}
    <div class="qr-stats-grid">
      <div class="qr-stat-card" onclick="setQrFilter('all')"><div class="qr-stat-n">${c.total}</div><div class="qr-stat-lbl">Tổng số QR</div></div>
      <div class="qr-stat-card" onclick="setQrFilter('producing')"><div class="qr-stat-n">${c.producing}</div><div class="qr-stat-lbl">Đang sản xuất</div></div>
      <div class="qr-stat-card" onclick="setQrFilter('qc_pending')"><div class="qr-stat-n">${c.qc}</div><div class="qr-stat-lbl">Chờ QC</div></div>
      <div class="qr-stat-card" onclick="setQrFilter('in_stock')"><div class="qr-stat-n">${c.inStock}</div><div class="qr-stat-lbl">Đã nhập kho</div></div>
      <div class="qr-stat-card" onclick="setQrFilter('out_stock')"><div class="qr-stat-n">${c.outStock}</div><div class="qr-stat-lbl">Đã xuất kho</div></div>
      <div class="qr-stat-card" onclick="setQrFilter('error')"><div class="qr-stat-n" style="color:var(--red-m)">${c.error}</div><div class="qr-stat-lbl">QR lỗi</div></div>
    </div>
    ${c.trung>0?`<div class="qr-stat-card" style="text-align:left;margin-bottom:10px;background:var(--red-l)" onclick="void 0"><b style="color:var(--red)">⚠️ ${c.trung} mã QR bị trùng</b> — vui lòng kiểm tra lại (mục Nhật ký thao tác)</div>`:''}
    ${fbOk()?`<div id="qrDonHangScanStats" style="margin-bottom:10px">${scanStatCardHtml('👀 Lượt khách quét tra cứu Thông tin đơn hàng', null)}</div>`:''}
    <div class="sec-title">Số QR tạo mới theo ngày (14 ngày gần nhất)</div>
    <div style="background:var(--card);border-radius:var(--r);padding:10px;box-shadow:var(--sh);margin-bottom:10px">${qrDailyChart()}</div>
    <div class="qr-actions-row">
      <button class="qr-action-btn" onclick="openBatchPrint()"><span class="ico">🖨</span>In tem hàng loạt</button>
      <button class="qr-action-btn" onclick="exportQrExcel()"><span class="ico">📊</span>Xuất Excel</button>
      ${isAdmin()?`<button class="qr-action-btn" style="color:var(--red-m)" onclick="deleteQrProductsBulk(DB.qrProducts.slice().filter(p=>qrFilterStatus==='all'||p.status===qrFilterStatus).filter(p=>!qrSearchQ||matchQr(p,qrSearchQ)).map(p=>p.id))"><span class="ico">🗑</span>Xóa theo bộ lọc</button>`:''}
    </div>
    <div class="search-wrap" style="margin-bottom:8px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input class="search-inp" id="qrSearchInp" type="search" placeholder="🔍 Tìm theo mã QR, mã hàng, khách hàng, đơn hàng, máy, người vận hành, ngày SX..." value="${qrSearchQ}" autocomplete="off">
    </div>
    <div class="qr-search-filters">
      <div class="qr-filter-chip ${qrFilterStatus==='all'?'active':''}" onclick="setQrFilter('all')">Tất cả</div>
      <div class="qr-filter-chip ${qrFilterStatus==='producing'?'active':''}" onclick="setQrFilter('producing')">Đang SX</div>
      <div class="qr-filter-chip ${qrFilterStatus==='qc_pending'?'active':''}" onclick="setQrFilter('qc_pending')">Chờ QC</div>
      <div class="qr-filter-chip ${qrFilterStatus==='in_stock'?'active':''}" onclick="setQrFilter('in_stock')">Trong kho</div>
      <div class="qr-filter-chip ${qrFilterStatus==='out_stock'?'active':''}" onclick="setQrFilter('out_stock')">Đã xuất</div>
      <div class="qr-filter-chip ${qrFilterStatus==='error'?'active':''}" onclick="setQrFilter('error')">Lỗi</div>
    </div>
    <div class="sec-title">Danh sách (${list.length}${list.length>60?' — hiển thị 60 mới nhất':''})</div>
    ${shown.length ? shown.map(qrCardHTML).join('') : `<div class="empty"><div class="empty-icon">🏷</div>Chưa có mã QR nào${qrSearchQ?` khớp "${qrSearchQ}"`:''}</div>`}
  `;
  const si=document.getElementById('qrSearchInp');
  if(si){ si.focus(); const v=si.value; si.value=''; si.value=v; si.addEventListener('input',()=>renderQR()); }
  if(fbOk()){
    fetchScanStats('donhang').then(stats=>{
      const box = document.getElementById('qrDonHangScanStats');
      if(box) box.innerHTML = scanStatCardHtml('👀 Lượt khách quét tra cứu Thông tin đơn hàng', stats);
    });
  }
}
function qrCardHTML(p){
  const si = qrStatusInfo(p.status);
  const specStr = p.spec.isRound?`Φ${p.spec.phi}×${p.spec.length}mm`:`${p.spec.thickness}×${p.spec.width}×${p.spec.length}mm`;
  const coilTxt = p.spec.isCoil ? ` · 📀 Cuộn ${p.coilLabel||''}${p.spec.meterPerCoil?` (${p.spec.meterPerCoil}m/cuộn)`:''}` : '';
  return `<div class="qr-card" onclick="openQrDetail('${p.id}')">
    <div class="qr-card-top">
      <span class="qr-code-txt">${p.qrCode}</span>
      <span class="qr-badge ${si.cls}">${si.label}</span>
    </div>
    <div class="qr-card-info">
      <b>${p.customer||'—'}</b> · ${specStr}${coilTxt} · Mác ${p.copperGrade}<br>
      Công đoạn: <b>${QR_STAGE_LABEL[p.currentStage]||p.currentStage}</b> · SX ngày ${fmtDate(p.prodDate)}
    </div>
  </div>`;
}

// ── Chi tiết QR (quét / xem trong danh sách) ─────────────────────────
let _qrDetailId = null;
