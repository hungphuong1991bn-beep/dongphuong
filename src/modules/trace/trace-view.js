// src/modules/trace/trace-view.js — TAB "TRUY XUẤT & KHIẾU NẠI" (Bước 2: tra cứu CHỈ ĐỌC)
// Không ghi DB. Không tạo dữ liệu. Thiếu khóa → hiện CHƯA XÁC ĐỊNH / CHƯA CÓ DỮ LIỆU.
let _trQ = '';
let _trScan = null; // {stream, raf, video}
let _trScope = 'all';
const TR_SCOPES = [['all','Tất cả','Mã đơn / PO / Heat-Lot / Mã lô SX / Mã QR / Tên khách hàng / Quy cách (vd 10x100)…'],
  ['order','Mã đơn hàng','Mã đơn hàng (ID), mã PO hoặc tên khách hàng…'],
  ['lot','Mã lô nguyên liệu','Heat-Lot, mã cuộn nguyên liệu hoặc mã lô sản xuất…'],
  ['product','Mã sản phẩm','Mã sản phẩm / thành phẩm hoặc mã QR…'],
  ['spec','Quy cách','Quy cách kích thước, vd 10x100, 10*100x4000, Φ18…'],
  ['wo','Mã phiếu SX','Mã phiếu sản xuất (WO) hoặc mã lô sản xuất…']];

const TR_NA = '<span class="ds-na">CHƯA CÓ DỮ LIỆU</span>';
const TR_UNK = '<span class="ds-na">CHƯA XÁC ĐỊNH</span>';
function trV(v){ return (v===undefined||v===null||v==='') ? TR_NA : esc(v); }

function renderTraceTab(){
  $('mc').innerHTML = `
  <div class="tr-wrap">
    <div class="tr-head">
      <div>
        <div class="tr-title">🔎 Truy xuất nguồn gốc &amp; Khiếu nại</div>
        <div class="tr-sub">Tra ngược toàn bộ hành trình: Đơn hàng → Nguyên liệu/Đùn → Rút → Đánh bóng → Cắt → QC → Thành phẩm → Giao hàng. Chỉ nối bằng mã khóa có thật; chỗ nào thiếu sẽ ghi rõ. Chỉ đọc, không sửa dữ liệu.</div>
      </div>
    </div>
    <div class="tr-search">
      <input id="trInput" class="tr-input" type="search" autocomplete="off" placeholder="${esc((TR_SCOPES.find(s=>s[0]===_trScope)||TR_SCOPES[0])[2])}" aria-label="Ô tìm kiếm truy xuất" value="${esc(_trQ)}"
        onkeydown="if(event.key==='Enter')trRun()">
      <button class="btn btn-primary" onclick="trRun()">Tìm</button>
      <button class="btn btn-ghost" onclick="trStartScan()">📷 Quét QR</button>
      <button class="btn btn-ghost" onclick="trClear()">Xoá</button>
    </div>
    <div class="tr-scopes" role="group" aria-label="Tìm theo">${TR_SCOPES.map(s=>`<button type="button" class="tr-scope${_trScope===s[0]?' on':''}" aria-pressed="${_trScope===s[0]}" onclick="trSetScope('${s[0]}')">${s[1]}</button>`).join('')}</div>
    <div id="trScanBox" style="display:none"></div>
    <div id="trResult"></div>
  </div>`;
  trRun(true);
}

function trSetScope(k){ _trScope=k; renderTraceTab(); const i=$('trInput'); if(i&&_trQ) i.focus(); }
function trClear(){ _trQ=''; const i=$('trInput'); if(i) i.value=''; trStopScan(); trRun(true); }
function trRun(silent){
  const i=$('trInput'); if(i) _trQ=i.value.trim();
  const box=$('trResult'); if(!box) return;
  if(!_trQ){
    box.innerHTML = `<div class="tr-empty">Nhập mã để bắt đầu truy xuất.<br><span>Nguồn dữ liệu: ${trSource().orders.length} đơn · ${trSource().qr.length} mã QR · ${trSource().nl.length} dòng Sổ nguyên liệu · ${trSource().rut.length} dòng Sổ máy rút · ${trSource().db.length} dòng Sổ máy đánh bóng+cắt</span></div>`;
    return;
  }
  let res;
  try{ res = trSearch(_trQ, undefined, _trScope); }catch(e){ console.warn('[trace]',e); box.innerHTML='<div class="tr-empty">⚠️ Lỗi khi truy xuất. Dữ liệu nguồn không bị ảnh hưởng.</div>'; return; }
  box.innerHTML = trResultHTML(res);
}

// ── Bảng dòng sổ (bấm để mở bản ghi gốc) ───────────────────────────
// Bảng dùng Design System (.ds-table); trên mobile tự chuyển thành dạng THẺ (.ds-stack + data-label)
function trTable(cols, rows){
  const head = cols.map(c=>`<th>${c}</th>`).join('');
  const body = rows.map(r=>`<tr onclick="${r.open}">${r.cells.map((h,i)=>`<td data-label="${cols[i]}">${h}</td>`).join('')}</tr>`).join('');
  return `<div class="ds-table-wrap"><table class="ds-table ds-stack tr-clickable"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function trLedgerTable(tab, rows){
  if(!rows.length) return `<div class="tr-none">${TR_NA}</div>`;
  const nl = tab==='nguyenLieu';
  const sorted = rows.slice().sort((a,b)=>String(b.ngay||'').localeCompare(String(a.ngay||'')));
  if(nl){
    return trTable(['Ngày','Heat-Lot','Nguyên liệu','Số lượng (kg)','Máy','Mã lô SX','Đơn liên kết'],
      sorted.map(r=>({open:`slViewDetail('nguyenLieu','${esc(r.id)}')`,cells:[fmtDate(r.ngay), r.heatLot?esc(r.heatLot):TR_UNK, trV(r.nguyenLieu), r.soLuong?fmtNum(r.soLuong):TR_NA, trV(r.may), r.maLoSX?esc(r.maLoSX):TR_UNK, slOrderLabel(r.donHangId)]})));
  }
  return trTable(['Ngày','Ca','Công đoạn','Máy','Quy cách','Số thanh','Người SX','Heat-Lot nguồn','Mã lô SX','Đơn liên kết'],
    sorted.map(r=>({open:`slViewDetail('${tab}','${esc(r.id)}')`,cells:[fmtDate(r.ngay), trV(r.ca), trV(r.congDoan), trV(r.may), trV(r.quyCach), (r.soThanh!=null&&r.soThanh!==''?fmtNum(r.soThanh):TR_NA), trV(r.nguoiSanXuat), r.heatLot?esc(r.heatLot):TR_UNK, r.maLoSX?esc(r.maLoSX):TR_UNK, slOrderLabel(r.donHangId)]})));
}

function trSection(icon, title, count, inner, color){
  return `<section class="tr-sec" style="--c:${color||'#475569'}"><div class="tr-sec-h">${icon} ${title} <span class="tr-cnt">${count}</span></div>${inner}</section>`;
}

function trStatusLabel(o){
  try{ const m=ddStatusMeta(o); return `<span class="tr-pill" style="background:${m.bg};color:${m.color};border-color:${m.border}">${esc(m.label)}</span>`; }
  catch(e){ return trV(o.status); }
}

function trOrderCard(o, res){
  const src = trSource(), cov = trCoverage(o.id, res, src);
  const qrs = src.qr.filter(p=>p&&p.orderId===o.id);
  const lots = new Set(); [src.nl,src.rut,src.db].forEach(a=>a.forEach(r=>{ if(r&&r.donHangId===o.id&&r.heatLot) lots.add(trKey(r.heatLot)); }));
  const lvl = {full:['#047857','Đầy đủ liên kết'], partial:['#b45309','Liên kết một phần'], none:['#b91c1c','CHƯA XÁC ĐỊNH']}[cov.level];
  const chk = (ok,l)=>`<span class="tr-chip ${ok?'ok':'no'}">${ok?'✔':'✖'} ${l}</span>`;
  const reasons = (res.why['order:'+o.id]||[]);
  return `<div class="tr-card" onclick="ddViewDetail('${esc(o.id)}')" title="Bấm để mở đơn hàng gốc">
    <div class="tr-card-top"><b>${esc(o.customer||'—')}</b> ${trStatusLabel(o)}
      <span class="tr-trace" style="color:${lvl[0]}">● ${lvl[1]}</span></div>
    <div class="tr-grid">
      <div><label>Mã PO</label>${trV(o.po)}</div>
      <div><label>Quy cách</label>${trV([o.type, (typeof specStr==='function' && (o.thickness||o.width||o.phi||o.length)) ? specStr(o) : ''].filter(Boolean).join(' · '))}</div>
      <div><label>Ngày đặt hàng</label>${o.createdAt?fmtDate(new Date(o.createdAt).toISOString().slice(0,10)):TR_NA}</div>
      <div><label>Hạn giao</label>${o.deliveryDate?fmtDate(o.deliveryDate):TR_NA}</div>
      <div><label>Số lượng đặt</label>${o.qty?fmtNum(o.qty)+(o.isCoil?' cuộn':' thanh'):TR_NA}</div>
      <div><label>Đã sản xuất / hoàn thành</label>${o.doneQty!=null&&o.doneQty!==''?fmtNum(o.doneQty):TR_NA}</div>
      <div><label>Giao hàng</label>${o.delivered?('Đã giao'+(o.deliveredAt?' · '+fmtDateTime(o.deliveredAt):'')):'Chưa giao / chưa có dữ liệu giao'}</div>
      <div><label>Số mã QR / lô nguyên liệu</label>${qrs.length} / ${lots.size}</div>
    </div>
    <div class="tr-chips">${chk(cov.parts.nguyenLieu,'Sổ máy đùn')}${chk(cov.parts.mayRut,'Sổ máy rút')}${chk(cov.parts.mayDanhBong,'Sổ máy đánh bóng')}${chk(cov.parts.qr,'QR / thành phẩm')}</div>
    ${reasons.length?`<div class="tr-why">Khớp theo: ${[...new Set(reasons)].map(esc).join(', ')}</div>`:''}
  </div>`;
}

function trQrTable(list, res){
  if(!list.length) return `<div class="tr-none">${TR_NA}</div>`;
  return trTable(['Mã QR','Mã sản phẩm','Sản phẩm','SL','Công đoạn hiện tại','QC','Máy','Người SX','Vị trí kho','Mác đồng'],
    list.map(p=>({open:`openQrDetail('${esc(p.id)}')`,cells:[esc(p.qrCode), trV(p.productCode), trV(p.productName), (p.quantity?fmtNum(p.quantity):TR_NA),
      (p.currentStage?esc(QR_STAGE_LABEL[p.currentStage]||p.currentStage):TR_NA),
      (p.qcResult&&p.qcResult!=='pending'?esc(p.qcResult):'<span class="ds-na">CHƯA QC</span>'), trV(p.machine), trV(p.operator||p.producer), trV(p.location), trV(p.copperGrade)]})));
}

// ── Phiếu QC: kết quả OK/NG, người kiểm tra, thời gian ─────────────────────────
function trResBadge(r, draft, voided){
  if(voided) return '<span class="tr-res void">Đã huỷ</span>';
  if(draft)  return '<span class="tr-res unk">Nháp</span>';
  const m = {OK:['ok','OK'], NG:['ng','NG'], HOLD:['ng','HOLD'], NCR:['ng','NCR'], UNK:['unk','Chưa xác định']}[r||'UNK'] || ['unk','Chưa xác định'];
  return `<span class="tr-res ${m[0]}">${m[1]}</span>`;
}
function trQcTable(list, res){
  if(!list.length) return `<div class="tr-none">${TR_NA}</div>`;
  const sorted = list.slice().sort((a,b)=>trTs(b.createdAt)-trTs(a.createdAt));
  const label = q => (typeof CP_STAGE_LABEL!=='undefined' && CP_STAGE_LABEL[q.form]) || q.form || ({fqc:'FQC',ncr:'NCR',hold:'HOLD'}[q.type]||q.type);
  return trTable(['Thời gian','Số phiếu','Loại','Mã lô','Mã sản phẩm','Kết quả','Người kiểm tra','Liên kết theo'],
    sorted.map(q=>({open:(typeof cpOpen==='function')?`cpOpen('${esc(q.id)}')`:'void 0',
      cells:[q.createdAt?esc(fmtDateTime(q.createdAt)):(q.date?fmtDate(q.date):TR_NA), trV(q.code), esc(label(q)), trV(q.lot), trV(q.productCode),
        trResBadge(q.type==='hold'?'HOLD':q.type==='ncr'?'NCR':(q.result||'UNK'), q.status==='draft', q.void),
        trV(q.inspector||q.holdBy||q.createdBy), esc((res.qcVia||{})[q.id]||'—')]})));
}

// ── HÀNH TRÌNH TRUY XUẤT của 1 đơn: sơ đồ luồng + timeline ────────────────────
function trDomId(s){ return String(s).replace(/[^A-Za-z0-9_-]/g,'_'); }
function trJump(id){ const el=document.getElementById(id); if(!el) return; const d=el.closest('details'); if(d) d.open=true; el.scrollIntoView({behavior:'smooth',block:'start'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1400); }
const TR_MISSING_TXT = {
  order:'Không tìm thấy đơn hàng trong dữ liệu hiện tại (có thể đã bị tự động dọn).',
  material:'Chưa có dòng Sổ nguyên liệu/đùn nào gắn với đơn này bằng ID đơn hàng → chưa biết nguyên liệu đầu vào và máy đùn.',
  rut:'Chưa có dòng Sổ máy rút nào gắn với đơn này bằng ID đơn hàng.',
  polish:'Chưa có dòng Sổ đánh bóng nào gắn với đơn này bằng ID đơn hàng.',
  cut:'Chưa có dòng công đoạn cắt nào gắn với đơn này bằng ID đơn hàng.',
  qc:'Chưa có phiếu QC nào gắn với đơn này (theo ID đơn, hoặc mã lô / mã sản phẩm trùng khóa).',
  qr:'Đơn chưa có mã QR / thành phẩm nào.',
  delivery:'Đơn chưa được đánh dấu đã giao.'};
function trStatusText(s){
  if(s.status==='nodata') return 'KHÔNG CÓ TRƯỜNG DỮ LIỆU';
  if(s.status==='missing') return 'THIẾU DỮ LIỆU';
  const n = s.items.length; return n>1 ? `ĐÃ CÓ · ${n} bản ghi` : 'ĐÃ CÓ';
}
function trFlowHTML(tl){
  const oid = trDomId(tl.orderId);
  return `<div class="tr-flow" role="list">${tl.stages.map((s,i)=>`
    <button type="button" role="listitem" class="tr-node ${s.status}" onclick="trJump('trs-${oid}-${s.key}')" title="${esc(s.label)}">
      <span class="tr-node-n">${i+1}</span><span class="tr-node-ic">${s.icon}</span>
      <b>${esc(s.label)}</b>
      <small>${trStatusText(s)}</small>
      ${s.key==='qc'&&s.result?`<span class="tr-node-res">${trResBadge(s.result)}</span>`:''}
      ${s.machines&&s.machines.length?`<em>${esc(s.machines.slice(0,2).join(', '))}${s.machines.length>2?' +'+(s.machines.length-2):''}</em>`:''}
    </button>`).join('')}</div>`;
}
function trItemHTML(it){
  const NA = '<span class="ds-na">CHƯA GHI NHẬN</span>';
  const time = it.ts ? (it.exact ? esc(fmtDateTime(it.ts)) : esc(fmtDate(new Date(it.ts).toISOString().slice(0,10)))+' <span class="tr-sub-t">(chưa có giờ)</span>') : NA;
  const click = it.open ? ` onclick="${it.open}" tabindex="0" role="button"` : '';
  return `<li class="tr-it${it.open?' click':''}"${click}>
    <div class="tr-it-t">${time}</div>
    <div class="tr-it-b">
      ${it.result?`${trResBadge(it.result,it.draft,it.voided)} `:''}<span>${esc(it.detail||'')}</span>
      <div class="tr-it-m">
        <span><label>Người</label>${it.who?esc(it.who):NA}</span>
        ${it.machine!==undefined&&it.machine!==''?`<span><label>Máy</label>${esc(it.machine)}</span>`:''}
        ${it.lot?`<span><label>Lô</label>${esc(it.lot)}</span>`:''}
        ${it.via?`<span><label>Liên kết</label>${esc(it.via)}</span>`:''}
      </div>
    </div></li>`;
}
function trTimelineHTML(tl){
  const oid = trDomId(tl.orderId);
  return `<ol class="tr-tl">${tl.stages.map(s=>{
    let body;
    if(s.status==='ok') body = `<ul class="tr-its">${s.items.map(trItemHTML).join('')}</ul>`;
    else if(s.status==='nodata') body = `<div class="tr-miss nodata"><b>Không thể truy xuất.</b> ${esc(s.note)}</div>`;
    else body = `<div class="tr-miss"><b>CHƯA CÓ DỮ LIỆU.</b> ${esc(TR_MISSING_TXT[s.key]||'Không có bản ghi liên kết.')}</div>`;
    const meta = (s.status==='ok' && s.items.length>1 && ['material','rut','polish','cut'].includes(s.key))
      ? `<div class="tr-st-meta"><span><label>Máy</label>${s.machines.length?esc(s.machines.join(', ')):'<span class="ds-na">CHƯA GHI NHẬN</span>'}</span><span><label>Người thực hiện</label>${s.actors.length?esc(s.actors.join(', ')):'<span class="ds-na">CHƯA GHI NHẬN</span>'}</span></div>` : '';
    return `<li class="tr-st ${s.status}" id="trs-${oid}-${s.key}">
      <div class="tr-st-h"><span class="tr-st-ic">${s.icon}</span><b>${esc(s.label)}</b>${s.key==='qc'&&s.result?trResBadge(s.result):''}<span class="tr-st-badge ${s.status}">${trStatusText(s)}</span></div>${meta}${body}</li>`;
  }).join('')}</ol>`;
}
function trChainSection(o){
  let tl; try{ tl = trTimeline(o.id); }catch(e){ console.warn('[trace-timeline]',e); return `<div class="tr-none">⚠️ Không dựng được hành trình cho đơn này. Dữ liệu nguồn không bị ảnh hưởng.</div>`; }
  const pct = tl.total? Math.round(tl.have*100/tl.total):0;
  const lvl = pct>=80?'hi':pct>=40?'mid':'lo';
  return `<section class="tr-sec tr-chain" style="--c:#0f766e">
    <div class="tr-sec-h">🧭 Hành trình truy xuất · ${esc(o.customer||'—')} · PO ${o.po?esc(o.po):TR_NA}</div>
    <div class="tr-cov"><div class="tr-cov-bar ${lvl}"><i style="width:${pct}%"></i></div><span>Có dữ liệu ở <b>${tl.have}/${tl.total}</b> công đoạn (chưa tính Nhà cung cấp — hệ thống chưa có trường này)</span></div>
    ${trFlowHTML(tl)}
    ${trTimelineHTML(tl)}
  </section>`;
}

function trKpi(label, n, tone){ return `<div class="tr-kpi ${tone||''}"><b>${n}</b><span>${label}</span></div>`; }

function trResultHTML(res){
  const P = res.primary;
  if(!P) return '';
  const total = P.orders.length+P.qr.length+P.nl.length+P.rut.length+P.db.length+(P.qc||[]).length;
  if(!total) return `<div class="tr-empty"><div class="tr-empty-ic">🔍</div>Không tìm thấy kết quả cho “${esc(res.query)}”.<br><span>${_trScope!=='all'?`Đang tìm theo “${esc((TR_SCOPES.find(s=>s[0]===_trScope)||[])[1])}” — thử chọn <a href="javascript:void(0)" onclick="trSetScope('all')">Tất cả</a>. `:'Thử Mã PO, Heat-Lot, mã lô SX, mã QR hoặc mã sản phẩm. '}Lưu ý: dòng sổ quá 32 ngày và đơn hoàn thành quá 30 ngày đã được tự động dọn — tra file Excel đã xuất.</span></div>`;
  let h = '';
  const qcN = (P.qc||[]).length, ng = (P.qc||[]).filter(q=>!q.void&&q.status!=='draft'&&(q.result==='NG'||q.type==='hold'||q.type==='ncr')).length;
  // 0. Tóm tắt
  h += `<div class="tr-kpis">${trKpi('Đơn hàng',P.orders.length)}${trKpi('Dòng sổ SX',P.nl.length+P.rut.length+P.db.length)}${trKpi('Thành phẩm / QR',P.qr.length)}${trKpi('Phiếu QC',qcN)}${trKpi('QC không đạt',ng,ng?'bad':'')}${trKpi('Lô liên quan',res.material.heatLots.length+res.material.lotsSX.length)}</div>`;
  // 1. Tổng quan đơn
  h += trSection('📦','Tổng quan đơn hàng', P.orders.length,
    P.orders.length ? `<div class="tr-cards">${P.orders.map(o=>trOrderCard(o,res)).join('')}</div>`
      : `<div class="tr-none">${TR_UNK} — kết quả khớp bản ghi sổ/QR nhưng chưa gắn được với đơn hàng nào bằng ID (đơn đã bị dọn hoặc dòng chưa liên kết).</div>`, '#1e40af');
  // 2. Hành trình (timeline + sơ đồ) — tối đa 5 đơn để trang không quá dài
  const MAXC = 5;
  P.orders.slice(0,MAXC).forEach(o=>{ h += trChainSection(o); });
  if(P.orders.length>MAXC) h += `<div class="tr-note">Còn ${P.orders.length-MAXC} đơn nữa — tìm theo mã đơn hoặc PO cụ thể để xem hành trình đầy đủ của từng đơn.</div>`;
  // 3. Dữ liệu gốc từng sổ (giữ nguyên bảng cũ, gập lại)
  const nlAll = [...P.nl, ...(res.material.nl||[]).filter(r=>!P.nl.some(x=>x.id===r.id))];
  h += `<details class="tr-fold"><summary>📚 Dữ liệu gốc từng sổ <span class="tr-cnt" style="--c:#475569">${nlAll.length+P.rut.length+P.db.length+P.qr.length+qcN}</span></summary>`;
  h += trSection('🧪','Sổ máy đùn', nlAll.length, trLedgerTable('nguyenLieu', nlAll), '#059669');
  h += trSection('↘️','Sổ máy rút', P.rut.length, trLedgerTable('mayRut', P.rut), '#2563eb');
  h += trSection('✨','Sổ máy đánh bóng + cắt', P.db.length, trLedgerTable('mayDanhBong', P.db), '#7c3aed');
  h += trSection('✅','Phiếu QC (kết quả kiểm tra, người kiểm tra, thời gian)', qcN, trQcTable(P.qc||[],res), '#0369a1');
  h += trSection('🏷️','Thành phẩm / QR (QC, kho, công đoạn)', P.qr.length, trQrTable(P.qr,res), '#0f766e');
  h += `</details>`;
  // 4. Lô nguyên liệu liên quan
  if(res.material.heatLots.length || res.material.lotsSX.length){
    h += `<section class="tr-sec" style="--c:#b45309"><div class="tr-sec-h">🔗 Mã lô liên quan</div>
      <div class="tr-lots">${res.material.heatLots.map(x=>`<span class="tr-lot" role="button" tabindex="0" onclick="trSet('${esc(x)}')">Heat-Lot ${esc(x)}</span>`).join('')}${res.material.lotsSX.map(x=>`<span class="tr-lot" role="button" tabindex="0" onclick="trSet('${esc(x)}')">Lô SX ${esc(x)}</span>`).join('')}</div></section>`;
  }
  // 5. Dùng chung lô → nguy cơ ảnh hưởng (chỉ hiển thị, không kết luận nguyên nhân)
  const R = res.related, nRel = R.orders.length+R.rut.length+R.db.length+R.nl.length;
  if(nRel){
    h += trSection('⚠️','Đơn / dòng khác dùng chung lô nguyên liệu (có thể liên quan)', nRel,
      `<div class="tr-warn">Chỉ là danh sách để khoanh vùng — hệ thống không kết luận nguyên nhân và không tự cách ly hàng.</div>
       ${R.orders.length?`<div class="tr-cards">${R.orders.map(o=>trOrderCard(o,res)).join('')}</div>`:''}
       ${R.nl.length?`<div class="tr-sub2">Sổ máy đùn</div>${trLedgerTable('nguyenLieu',R.nl)}`:''}
       ${R.rut.length?`<div class="tr-sub2">Sổ máy rút</div>${trLedgerTable('mayRut',R.rut)}`:''}
       ${R.db.length?`<div class="tr-sub2">Sổ máy đánh bóng + cắt</div>${trLedgerTable('mayDanhBong',R.db)}`:''}`, '#b91c1c');
  }
  // 6. Khoảng trống dữ liệu — nêu rõ, không đoán
  const gaps = res.gaps;
  h += trSection('🧩','Tình trạng truy xuất dữ liệu', gaps.length,
    gaps.length ? `<ul class="tr-gaps">${gaps.map(g=>`<li>${g.orderId?`<b>${esc((DB.orders.find(o=>o.id===g.orderId)||{}).customer||g.orderId)}</b>: `:''}${esc(g.text)}</li>`).join('')}</ul>`
                : '<div class="tr-none" style="color:#047857">Không phát hiện thiếu khóa liên kết trong phạm vi kết quả này.</div>', '#64748b');
  h += `<div class="tr-foot">Chưa có dữ liệu nguồn để truy xuất: <b>Nhà cung cấp</b> (không có trường ở Đơn hàng / Sổ nguyên liệu / QR), Khuôn, Bảo trì, Kho nhập/xuất chi tiết. Các mục này hiện CHƯA CÓ DỮ LIỆU cho tới khi nguồn có khóa liên kết — hệ thống không tự suy đoán. Máy đùn lấy từ Sổ nguyên liệu/đùn; Máy cắt lấy từ dòng công đoạn cắt trong Sổ đánh bóng + cắt.</div>`;
  return h;
}

function trSet(v){ _trQ=v; const i=$('trInput'); if(i) i.value=v; trRun(); window.scrollTo&&$('mainWrap')&&($('mainWrap').scrollTop=0); }

// ── Quét QR bằng camera (BarcodeDetector — Chrome/Android/Edge). iOS Safari
// chưa hỗ trợ: dùng app Camera quét tem (mở trang tra cứu) hoặc dán mã/link.
async function trStartScan(){
  const box=$('trScanBox'); if(!box) return;
  if(!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showToast('Trình duyệt này chưa hỗ trợ quét QR trong app — hãy dán mã/link QR vào ô tìm kiếm', true); return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    box.style.display='block';
    box.innerHTML = `<div class="tr-scan"><video id="trVideo" playsinline muted></video><button class="btn btn-ghost" onclick="trStopScan()">✕ Đóng camera</button></div>`;
    const video=$('trVideo'); video.srcObject=stream; await video.play();
    const det = new BarcodeDetector({formats:['qr_code']});
    _trScan = {stream, raf:0, video};
    const tick = async()=>{
      if(!_trScan) return;
      try{
        const codes = await det.detect(video);
        if(codes.length){ const v=codes[0].rawValue; trStopScan(); trSet(trExtractQr(v)); return; }
      }catch(e){}
      _trScan.raf = requestAnimationFrame(tick);
    };
    tick();
  }catch(e){ trStopScan(); showToast('Không mở được camera: '+(e.message||e), true); }
}
function trStopScan(){
  if(_trScan){ try{ cancelAnimationFrame(_trScan.raf); _trScan.stream.getTracks().forEach(t=>t.stop()); }catch(e){} _trScan=null; }
  const box=$('trScanBox'); if(box){ box.style.display='none'; box.innerHTML=''; }
}
