// src/modules/trace/trace-view.js — TAB "TRUY XUẤT & KHIẾU NẠI" (Bước 2: tra cứu CHỈ ĐỌC)
// Không ghi DB. Không tạo dữ liệu. Thiếu khóa → hiện CHƯA XÁC ĐỊNH / CHƯA CÓ DỮ LIỆU.
let _trQ = '';
let _trScan = null; // {stream, raf, video}

const TR_NA = '<span class="ds-na">CHƯA CÓ DỮ LIỆU</span>';
const TR_UNK = '<span class="ds-na">CHƯA XÁC ĐỊNH</span>';
function trV(v){ return (v===undefined||v===null||v==='') ? TR_NA : esc(v); }

function renderTraceTab(){
  $('mc').innerHTML = `
  <div class="tr-wrap">
    <div class="tr-head">
      <div>
        <div class="tr-title">🔎 Truy xuất nguồn gốc &amp; Khiếu nại</div>
        <div class="tr-sub">Nhập mã đơn, PO, mã lô, Heat-Lot, mã sản phẩm hoặc quét QR — hệ thống tự tổng hợp từ Đơn hàng, QR và 3 sổ. Chỉ đọc, không sửa dữ liệu.</div>
      </div>
    </div>
    <div class="tr-search">
      <input id="trInput" class="tr-input" type="search" autocomplete="off" placeholder="Mã đơn / PO / Heat-Lot / Mã lô SX / Mã QR / Tên khách hàng / Quy cách…" value="${esc(_trQ)}"
        onkeydown="if(event.key==='Enter')trRun()">
      <button class="btn btn-primary" onclick="trRun()">Tìm</button>
      <button class="btn btn-ghost" onclick="trStartScan()">📷 Quét QR</button>
      <button class="btn btn-ghost" onclick="trClear()">Xoá</button>
    </div>
    <div id="trScanBox" style="display:none"></div>
    <div id="trResult"></div>
  </div>`;
  trRun(true);
}

function trClear(){ _trQ=''; const i=$('trInput'); if(i) i.value=''; trStopScan(); trRun(true); }
function trRun(silent){
  const i=$('trInput'); if(i) _trQ=i.value.trim();
  const box=$('trResult'); if(!box) return;
  if(!_trQ){
    box.innerHTML = `<div class="tr-empty">Nhập mã để bắt đầu truy xuất.<br><span>Nguồn dữ liệu: ${trSource().orders.length} đơn · ${trSource().qr.length} mã QR · ${trSource().nl.length} dòng Sổ nguyên liệu · ${trSource().rut.length} dòng Sổ máy rút · ${trSource().db.length} dòng Sổ máy đánh bóng+cắt</span></div>`;
    return;
  }
  let res;
  try{ res = trSearch(_trQ); }catch(e){ console.warn('[trace]',e); box.innerHTML='<div class="tr-empty">⚠️ Lỗi khi truy xuất. Dữ liệu nguồn không bị ảnh hưởng.</div>'; return; }
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
      <div><label>Quy cách</label>${trV(o.type)}</div>
      <div><label>Ngày đặt hàng</label>${o.createdAt?fmtDate(new Date(o.createdAt).toISOString().slice(0,10)):TR_NA}</div>
      <div><label>Hạn giao</label>${o.deliveryDate?fmtDate(o.deliveryDate):TR_NA}</div>
      <div><label>Số lượng đặt</label>${o.qty?fmtNum(o.qty)+(o.isCoil?' cuộn':' thanh'):TR_NA}</div>
      <div><label>Đã sản xuất / hoàn thành</label>${o.doneQty!=null&&o.doneQty!==''?fmtNum(o.doneQty):TR_NA}</div>
      <div><label>Giao hàng</label>${o.delivered?('Đã giao'+(o.deliveredAt?' · '+fmtDateTime(o.deliveredAt):'')):'Chưa giao / chưa có dữ liệu giao'}</div>
      <div><label>Số mã QR / lô nguyên liệu</label>${qrs.length} / ${lots.size}</div>
    </div>
    <div class="tr-chips">${chk(cov.parts.nguyenLieu,'Sổ nguyên liệu')}${chk(cov.parts.mayRut,'Sổ máy rút')}${chk(cov.parts.mayDanhBong,'Sổ máy đánh bóng')}${chk(cov.parts.qr,'QR / thành phẩm')}</div>
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

function trResultHTML(res){
  const P = res.primary;
  if(!P) return '';
  const total = P.orders.length+P.qr.length+P.nl.length+P.rut.length+P.db.length;
  if(!total) return `<div class="tr-empty">Không tìm thấy kết quả cho “${esc(res.query)}”.<br><span>Thử Mã PO, Heat-Lot, mã lô SX, mã QR hoặc mã sản phẩm. Lưu ý: dòng sổ quá 32 ngày và đơn hoàn thành quá 30 ngày đã được tự động dọn — tra file Excel đã xuất.</span></div>`;
  let h = '';
  // 1. Tổng quan đơn
  h += trSection('📦','Tổng quan đơn hàng', P.orders.length,
    P.orders.length ? `<div class="tr-cards">${P.orders.map(o=>trOrderCard(o,res)).join('')}</div>`
      : `<div class="tr-none">${TR_UNK} — kết quả khớp bản ghi sổ/QR nhưng chưa gắn được với đơn hàng nào bằng ID (đơn đã bị dọn hoặc dòng chưa liên kết).</div>`, '#1e40af');
  // 2. Chuỗi truy xuất xuôi: NL → Rút → Đánh bóng/Cắt → QR
  h += trSection('🧪','Sổ nguyên liệu', P.nl.length + ((res.material.nl||[]).filter(r=>!P.nl.some(x=>x.id===r.id)).length), 
    trLedgerTable('nguyenLieu', [...P.nl, ...(res.material.nl||[]).filter(r=>!P.nl.some(x=>x.id===r.id))]), '#059669');
  h += trSection('↘️','Sổ máy rút', P.rut.length, trLedgerTable('mayRut', P.rut), '#2563eb');
  h += trSection('✨','Sổ máy đánh bóng + cắt', P.db.length, trLedgerTable('mayDanhBong', P.db), '#7c3aed');
  h += trSection('🏷️','Thành phẩm / QR (QC, kho, công đoạn)', P.qr.length, trQrTable(P.qr,res), '#0f766e');
  // 3. Lô nguyên liệu liên quan
  if(res.material.heatLots.length || res.material.lotsSX.length){
    h += `<section class="tr-sec" style="--c:#b45309"><div class="tr-sec-h">🔗 Mã lô liên quan</div>
      <div class="tr-lots">${res.material.heatLots.map(x=>`<span class="tr-lot" onclick="trSet('${esc(x)}')">Heat-Lot ${esc(x)}</span>`).join('')}${res.material.lotsSX.map(x=>`<span class="tr-lot" onclick="trSet('${esc(x)}')">Lô SX ${esc(x)}</span>`).join('')}</div></section>`;
  }
  // 4. Dùng chung lô → nguy cơ ảnh hưởng (chỉ hiển thị, không kết luận nguyên nhân)
  const R = res.related, nRel = R.orders.length+R.rut.length+R.db.length+R.nl.length;
  if(nRel){
    h += trSection('⚠️','Đơn / dòng khác dùng chung lô nguyên liệu (có thể liên quan)', nRel,
      `<div class="tr-warn">Chỉ là danh sách để khoanh vùng — hệ thống không kết luận nguyên nhân và không tự cách ly hàng.</div>
       ${R.orders.length?`<div class="tr-cards">${R.orders.map(o=>trOrderCard(o,res)).join('')}</div>`:''}
       ${R.nl.length?`<div class="tr-sub2">Sổ nguyên liệu</div>${trLedgerTable('nguyenLieu',R.nl)}`:''}
       ${R.rut.length?`<div class="tr-sub2">Sổ máy rút</div>${trLedgerTable('mayRut',R.rut)}`:''}
       ${R.db.length?`<div class="tr-sub2">Sổ máy đánh bóng + cắt</div>${trLedgerTable('mayDanhBong',R.db)}`:''}`, '#b91c1c');
  }
  // 5. Khoảng trống dữ liệu — nêu rõ, không đoán
  const gaps = res.gaps;
  h += trSection('🧩','Tình trạng truy xuất dữ liệu', gaps.length,
    gaps.length ? `<ul class="tr-gaps">${gaps.map(g=>`<li>${g.orderId?`<b>${esc((DB.orders.find(o=>o.id===g.orderId)||{}).customer||g.orderId)}</b>: `:''}${esc(g.text)}</li>`).join('')}</ul>`
                : '<div class="tr-none" style="color:#047857">Không phát hiện thiếu khóa liên kết trong phạm vi kết quả này.</div>', '#64748b');
  h += `<div class="tr-foot">Chưa liên kết (dữ liệu nguồn chưa có mã): Máy đùn, Máy cắt (chỉ có trong Sổ đánh bóng+cắt), Kho nhập/xuất chi tiết, Phiếu giao hàng, Khuôn, Bảo trì. Các mục này sẽ hiện CHƯA CÓ DỮ LIỆU cho tới khi nguồn có khóa liên kết.</div>`;
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
