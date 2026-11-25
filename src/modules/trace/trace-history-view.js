// src/modules/trace/trace-history-view.js — v2.14.0: BẢNG CHI TIẾT TRUY XUẤT SẢN XUẤT (tab Đơn hoàn thành)
// Bấm vào 1 đơn ở tab Đơn hoàn thành → thOpen(id). Dữ liệu lấy từ thBuild() (chỉ đọc, liên kết theo ID đơn).
// Xuất: Excel nhiều trang (ExcelJS có sẵn của hệ thống) và PDF (hộp thoại in của trình duyệt → "Lưu thành PDF",
// cùng cách với "In phiếu" ở tab này, tránh lỗi font tiếng Việt của jsPDF).

const TH_NA = '<span class="ds-na">CHƯA CÓ DỮ LIỆU</span>';
const TH_STATE = {
  done:    {txt:'Hoàn thành',          cls:'is-done'},
  running: {txt:'Đang chạy',           cls:'is-run'},
  paused:  {txt:'Tạm dừng',            cls:'is-paused'},
  partial: {txt:'Thiếu dữ liệu chạy',  cls:'is-partial'},
  planned: {txt:'Chỉ có phân công',    cls:'is-planned'},
  missing: {txt:'Chưa có dữ liệu',     cls:'is-missing'}
};
const TH_SRC_TXT = {sessions:'Phiên chạy (chính xác)', history:'Lịch sử máy cũ', assigned:'Phân công máy', ledger:'Sổ máy', qc:'Phiếu QC', none:'—'};
let _thId = null, _thModel = null;

function thT(ts){ return ts ? esc(fmtDateTime(ts)) : TH_NA; }
function thV(v){ return (v===undefined||v===null||v==='') ? TH_NA : esc(v); }
function thList(a){ return a && a.length ? a.map(esc).join(', ') : TH_NA; }
function thDur(ms){ return ms==null ? TH_NA : `<b>${rcFmtHMS(ms,true)}</b>`; }
function thMach(ids){ return ids && ids.length ? ids.map(m=>esc(rcMachineName(m))).join(' → ') : TH_NA; }
function thQ(v, unit){ return v==null ? TH_NA : `<b>${esc(Number(v).toLocaleString('vi-VN'))}</b> ${esc(unit||'')}`; }
const TH_PLAN_VIA = {assign:'đang gán trong Kế hoạch SX', history:'đã lưu vết khi đơn đi qua công đoạn'};
function thPlanHTML(p){ return p ? `<b>${esc(rcMachineName(p.machineId))}</b> <small>(${TH_PLAN_VIA[p.via]||''})</small>` : `${TH_NA} <small>(Kế hoạch SX chưa phân máy)</small>`; }
const TH_QC_RES = {OK:['Đạt','ok'], NG:['Không đạt','ng'], HOLD:['HOLD','ng'], NCR:['NCR','ng'], UNK:['Chưa kết luận','unk']};

function thEnsureModal(){
  let m = document.getElementById('thModal');
  if(m) return m;
  m = document.createElement('div');
  m.className = 'modal th-modal'; m.id = 'thModal';
  m.setAttribute('onclick', "if(event.target===this)closeModal('thModal');");
  m.innerHTML = `<div class="modal-box th-box">
    <div class="modal-handle"></div>
    <div class="th-head"><div class="modal-title" id="thTitle">Truy xuất sản xuất</div>
      <div class="th-tools">
        <button class="btn btn-ghost th-tool" onclick="thExportExcel()" title="Xuất báo cáo truy xuất ra Excel">📊 Excel</button>
        <button class="btn btn-ghost th-tool" onclick="thPrint()" title="In / Lưu thành PDF">📄 PDF</button>
      </div></div>
    <div id="thBody" data-dp-nodirty="1"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('thModal')">Đóng</button>
      <button class="btn btn-ghost" id="thWhBtn" style="flex:1">📦 Nhập kho / giao hàng</button>
    </div></div>`;
  document.body.appendChild(m);
  return m;
}

function thOpen(id, ev){
  if(ev) ev.stopPropagation();
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  // Giữ đúng hành vi cũ: mở đơn "mới hoàn thành" lần đầu thì đánh dấu đã xem
  if(typeof htIsFresh==='function' && htIsFresh(o)){ o.viewedDoneAt = Date.now(); saveOrders(); }
  thEnsureModal();
  _thId = id;
  thRender();
  const wb = document.getElementById('thWhBtn');
  if(wb) wb.onclick = ()=>{ closeModal('thModal'); htViewDetail(id); };
  openModal('thModal');
}
function thRefreshIfOpen(){ const m=document.getElementById('thModal'); if(m && m.classList.contains('open') && _thId) thRender(); }

function thRender(){
  const model = thBuild(_thId);
  _thModel = model;
  const body = document.getElementById('thBody'), title = document.getElementById('thTitle');
  if(!model){ body.innerHTML = '<div class="rc-empty">Đơn không còn trong danh sách (có thể đã bị dọn).</div>'; return; }
  const ov = model.overview;
  title.textContent = `🔎 Truy xuất sản xuất · ${ov.customer||'—'} · ${ov.code}`;
  const srcNote = ov.runSource==='sessions' ? '' :
    `<div class="th-note">${ov.runSource==='none'?'Chưa có mốc bắt đầu.':'⚠️ Đơn hoàn thành trước khi có ghi phiên chạy: thời gian = khoảng từ bắt đầu đến hoàn thành, chưa loại trừ lúc nghỉ.'}</div>`;
  const statusTxt = ov.status==='done' ? (ov.delivered?'Hoàn thành · Đã giao':ov.whIn?'Hoàn thành · Đã nhập kho':'Hoàn thành') : (statusInfo(ov.status).label);
  body.innerHTML = `
    <div class="th-sec">
      <div class="th-sec-t">📦 Thông tin tổng quan</div>
      <div class="th-grid">
        <div><b>Mã đơn hàng</b><span>${esc(ov.code)}</span></div>
        <div><b>Khách hàng</b><span>${thV(ov.customer)}</span></div>
        <div><b>Số PO</b><span>${thV(ov.po)}</span></div>
        <div><b>Mã sản phẩm (QR)</b><span>${thList(ov.productCodes)}</span></div>
        <div><b>Quy cách</b><span>${thV(ov.spec)}</span></div>
        <div><b>Mác đồng (QR)</b><span>${thList(ov.copperGrades)}</span></div>
        <div><b>Số lượng đặt</b><span>${ov.qtyOrdered!=null?esc(ov.qtyOrdered.toLocaleString('vi-VN'))+' '+ov.unit:TH_NA}${ov.kg?' · '+esc(ov.kg)+' kg':''}</span></div>
        <div><b>Số lượng thực tế hoàn thành</b><span>${ov.qtyDone!=null?esc(ov.qtyDone.toLocaleString('vi-VN'))+' '+ov.unit:TH_NA}</span></div>
        <div><b>Bắt đầu sản xuất</b><span>${thT(ov.startedAt)}</span></div>
        <div><b>Hoàn thành</b><span>${thT(ov.doneAt)}</span></div>
        <div><b>Tổng thời gian chạy thực tế</b><span class="th-big">${ov.startedAt||ov.runMs?rcFmtHMS(ov.runMs,true):TH_NA}</span></div>
        <div><b>Tạm dừng</b><span>${ov.pauseCount} lần${ov.pausedMs?' · nghỉ '+esc(rcFmtDur(ov.pausedMs)):''}</span></div>
        <div><b>Người phụ trách</b><span>${thV(ov.owner)}</span></div>
        <div><b>Người xác nhận hoàn thành</b><span>${thV(ov.doneBy)}</span></div>
        <div><b>Trạng thái</b><span>${esc(statusTxt)}</span></div>
      </div>${srcNote}
    </div>

    <div class="th-sec">
      <div class="th-sec-t">🧭 Hành trình sản xuất theo công đoạn <small>(bấm vào khối để mở rộng)</small></div>
      <div class="th-legend"><i class="is-done"></i>Hoàn thành <i class="is-run"></i>Đang chạy <i class="is-paused"></i>Tạm dừng <i class="is-missing"></i>Thiếu dữ liệu</div>
      <div class="th-flow">${model.stages.map(thStageHTML).join('')}${thQcHTML(model.qc)}${thFinishHTML(model.finish, model)}</div>
    </div>

    <div class="th-sec">
      <div class="th-sec-t">🔁 Lịch sử chuyển máy và phiên chạy</div>
      ${thRunTableHTML(model)}
      <div class="th-foot">“Người vận hành” = tài khoản đã thao tác bắt đầu phiên. Người sản xuất theo Sổ máy được nêu riêng trong từng công đoạn.</div>
    </div>

    <div class="th-sec">
      <div class="th-sec-t">⏸ Lịch sử tạm dừng</div>
      ${thPauseTableHTML(model)}
    </div>
    ${model.machineChanges.length?`<div class="th-sec"><div class="th-sec-t">🔀 Lịch sử thay đổi máy</div>
      <div class="rc-tbl-wrap"><table class="rc-tbl"><thead><tr><th>Lúc</th><th>Công đoạn</th><th>Từ máy</th><th>Sang máy</th><th>Người thao tác</th></tr></thead><tbody>
      ${model.machineChanges.map(c=>`<tr><td>${thT(c.at)}</td><td>${esc(rcStageLabel(c.stage))}</td><td>${c.from?esc(rcMachineName(c.from)):'<span class="ds-na">Chưa gán máy</span>'}</td><td>${c.to?esc(rcMachineName(c.to)):'<span class="ds-na">Bỏ gán</span>'}</td><td>${thV(c.by)}</td></tr>`).join('')}
      </tbody></table></div></div>`:''}
    ${model.gaps.length?`<div class="th-sec th-gaps"><div class="th-sec-t">⚠️ Dữ liệu chưa được ghi nhận</div><ul>${model.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div>`:''}
    ${ov.progressNote||ov.note?`<div class="th-sec"><div class="th-sec-t">📝 Ghi chú</div>${ov.progressNote?`<div><b>Tiến độ SX:</b> ${esc(ov.progressNote)}</div>`:''}${ov.note?`<div><b>Đơn hàng:</b> ${esc(ov.note)}</div>`:''}</div>`:''}`;
}

function thStageHTML(st, i){
  const S = TH_STATE[st.state] || TH_STATE.missing;
  const machine = st.machineIds.length ? thMach(st.machineIds)
    : (st.assignedMachineId ? `<span class="th-warn">${esc(rcMachineName(st.assignedMachineId))} (chỉ phân công, chưa xác nhận đã chạy)</span>` : TH_NA);
  const qty = st.qty;
  const qtyHTML = st.key==='dun'
    ? `<div><b>Số lượng đầu vào</b><span>${thQ(qty.input, qty.inputUnit)}</span></div><div><b>Số lượng đầu ra</b><span>${thQ(qty.output, qty.outputUnit)}</span></div>`
    : `<div><b>Số lượng thực hiện</b><span>${thQ(qty.done, qty.doneUnit)}</span></div><div><b>Đầu vào / đầu ra</b><span>${TH_NA}</span></div>`;
  const runTxt = st.runMs!=null ? thDur(st.runMs) : (st.spanMs!=null ? `${TH_NA} <small>(khoảng ${esc(rcFmtDur(st.spanMs))} từ lúc vào đến lúc rời máy — không phải giờ chạy thực)</small>` : TH_NA);
  const inner = `
    <div class="th-grid th-grid-2">
      <div><b>Máy thực hiện</b><span>${machine}</span></div>
      <div><b>Máy theo Kế hoạch SX (phân máy)</b><span>${thPlanHTML(st.plan)}${st.planDiff?' <span class="th-warn">⚠️ khác máy đã chạy thực tế</span>':''}</span></div>
      <div><b>Máy ghi trong Sổ máy</b><span>${thList(st.ledgerMachines)}</span></div>
      <div><b>Ngày giờ bắt đầu</b><span>${thT(st.startAt)}</span></div>
      <div><b>Ngày giờ kết thúc</b><span>${st.open?'<span class="rc-live">● đang chạy</span>':thT(st.endAt)}</span></div>
      <div><b>Tổng thời gian chạy thực tế</b><span>${runTxt}</span></div>
      <div><b>Nguồn dữ liệu chạy</b><span>${esc(TH_SRC_TXT[st.source]||'—')}</span></div>
      ${qtyHTML}
      <div><b>Người vận hành (Sổ máy)</b><span>${thList(st.operatorsLedger)}</span></div>
      <div><b>Người thao tác (hệ thống)</b><span>${thList(st.actors)}</span></div>
      <div><b>Ca</b><span>${thList(st.shifts)}</span></div>
      <div><b>Lô / Heat-Lot</b><span>${thList(st.lots)}</span></div>
      <div class="th-span"><b>Ghi chú sản xuất</b><span>${thList(st.notes)}</span></div>
    </div>
    ${qty.note?`<div class="th-foot">${esc(qty.note)}</div>`:''}
    ${st.sessions.length?`<div class="rc-tbl-wrap"><table class="rc-tbl"><thead><tr><th>Lần</th><th>Máy</th><th>Bắt đầu</th><th>Kết thúc</th><th>Thời gian chạy</th><th>Người</th></tr></thead><tbody>
      ${st.sessions.map(s=>`<tr><td>${s.no||''}</td><td>${s.machineId?esc(rcMachineName(s.machineId)):'<span class="ds-na">Chưa gán máy</span>'}</td><td>${thT(s.startAt)}</td><td>${s.endAt==null?'<span class="rc-live">● đang chạy</span>':thT(s.endAt)}</td><td>${rcFmtHMS(s.endAt==null?Math.max(0,rcNow()-s.startAt):(s.runMs!=null?s.runMs:s.endAt-s.startAt),true)}</td><td>${thV(s.by)}</td></tr>`).join('')}
      </tbody></table></div>`:''}`;
  return `<details class="th-stage ${S.cls}" ${st.state==='running'||st.state==='paused'?'open':''}>
    <summary><span class="th-node"><i>${st.icon}</i></span>
      <span class="th-stg-main"><b>CÔNG ĐOẠN ${i+1} – ${esc(st.label)}</b><small>${st.machineIds.length?thMach(st.machineIds):(st.plan?'🗂 Kế hoạch: '+esc(rcMachineName(st.plan.machineId)):'Chưa có máy ghi nhận')}</small></span>
      <span class="th-stg-time">${st.runMs!=null?rcFmtHMS(st.runMs,true):'—'}</span>
      <span class="th-badge ${S.cls}">${S.txt}</span></summary>
    ${inner}</details>`;
}
function thQcHTML(qc){
  const S = qc.items.length ? TH_STATE.done : TH_STATE.missing;
  const R = TH_QC_RES[qc.result] || null;
  const inner = qc.items.length ? `<div class="rc-tbl-wrap"><table class="rc-tbl"><thead><tr><th>Số phiếu QC</th><th>Ngày giờ kiểm tra</th><th>Người kiểm tra</th><th>Kết quả</th><th>Ghi nhận lỗi / xử lý</th><th>Liên kết</th></tr></thead><tbody>
    ${qc.items.map(i=>{ const r = TH_QC_RES[i.result]||TH_QC_RES.UNK;
      return `<tr><td>${thV(i.code)}${i.draft?' <span class="rc-tag">nháp</span>':''}${i.voided?' <span class="rc-tag">đã huỷ</span>':''}</td><td>${i.at?(i.atExact?esc(fmtDateTime(i.at)):esc(fmtDate(i.at))):TH_NA}</td><td>${thV(i.inspector)}</td>
      <td><span class="th-qc ${r[1]}">${r[0]}</span></td>
      <td>${[i.disposition&&('Xử lý: '+i.disposition), i.cause&&('Nguyên nhân: '+i.cause), i.action&&('Khắc phục: '+i.action)].filter(Boolean).map(esc).join('<br>')||'—'}</td><td><small>${esc(i.via)}</small></td></tr>`; }).join('')}
    </tbody></table></div>` : `<div class="th-foot">${TH_NA} — chưa có phiếu QC nào gắn với đơn này bằng ID đơn hàng.</div>`;
  return `<details class="th-stage ${S.cls}"><summary><span class="th-node"><i>${qc.icon}</i></span>
    <span class="th-stg-main"><b>CÔNG ĐOẠN 5 – ${qc.label}</b><small>${qc.items.length} phiếu QC</small></span>
    <span class="th-stg-time">${R?`<span class="th-qc ${R[1]}">${R[0]}</span>`:'—'}</span><span class="th-badge ${S.cls}">${S.txt}</span></summary>${inner}</details>`;
}
function thFinishHTML(f, m){
  const S = f.state==='done' ? TH_STATE.done : TH_STATE.missing;
  return `<details class="th-stage ${S.cls}"><summary><span class="th-node"><i>${f.icon}</i></span>
    <span class="th-stg-main"><b>${f.label}</b><small>${f.at?esc(fmtDateTime(f.at)):'Chưa hoàn thành'}</small></span>
    <span class="th-stg-time">${rcFmtHMS(m.overview.runMs,true)}</span><span class="th-badge ${S.cls}">${S.txt}</span></summary>
    <div class="th-grid th-grid-2"><div><b>Thời điểm hoàn thành</b><span>${thT(f.at)}</span></div><div><b>Người xác nhận</b><span>${thV(f.by)}</span></div>
    <div><b>Số lượng đặt</b><span>${f.qtyOrdered!=null?esc(f.qtyOrdered):TH_NA}</span></div><div><b>Số lượng thực tế</b><span>${f.qtyDone!=null?esc(f.qtyDone):TH_NA}</span></div></div></details>`;
}
function thRunTableHTML(m){
  const rows = m.runTable.concat(m.legacyRows);
  if(!rows.length) return `<div class="rc-empty">${TH_NA} — đơn không có phiên chạy hay lịch sử máy nào được ghi nhận.</div>`;
  return `<div class="rc-tbl-wrap"><table class="rc-tbl"><thead><tr><th>Lần</th><th>Công đoạn</th><th>Máy</th><th>Bắt đầu</th><th>Kết thúc</th><th>Thời gian chạy</th><th>Người vận hành</th></tr></thead><tbody>
    ${rows.map((r,i)=>`<tr class="${r.open?'rc-open':''}"><td>${r.no||(i+1)}</td><td>${esc(rcStageLabel(r.stage))}</td>
      <td>${r.machineId?esc(rcMachineName(r.machineId)):'<span class="ds-na">Chưa gán máy</span>'}</td><td>${thT(r.startAt)}</td>
      <td>${r.open?'<span class="rc-live">● đang chạy</span>':thT(r.endAt)}</td>
      <td>${r.runMs==null?TH_NA:'<b>'+rcFmtHMS(r.runMs,true)+'</b>'}</td>
      <td>${thV(r.by)}${r.legacy?` <span class="rc-tag" title="${r.source==='history'?'Lịch sử máy cũ: chỉ có máy và mốc giờ':'Phiên khôi phục từ dữ liệu cũ'}">dữ liệu cũ</span>`:''}${r.endReason&&!r.open?` <small class="th-why">· ${esc(RC_END_LABEL[r.endReason]||r.endReason)}</small>`:''}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function thPauseTableHTML(m){
  if(!m.pauses.length) return `<div class="th-foot">Đơn chưa từng tạm dừng.</div>`;
  return `<div class="rc-tbl-wrap"><table class="rc-tbl"><thead><tr><th>Lần</th><th>Thời điểm tạm dừng</th><th>Thời điểm chạy lại</th><th>Thời gian nghỉ</th><th>Lý do</th><th>Máy</th><th>Người thao tác</th></tr></thead><tbody>
    ${m.pauses.map(p=>`<tr><td>${p.no||''}</td><td>${thT(p.at)}</td>
      <td>${p.resumeAt?thT(p.resumeAt):(p.closedReason?esc(p.closedReason==='revert'?'Hủy (về Chờ SX)':'Đóng khi hoàn thành'):'<span class="rc-live">● đang tạm dừng</span>')}</td>
      <td>${p.pausedMs!=null?esc(rcFmtDur(p.pausedMs)):'—'}</td><td>${p.reason?esc(p.reason):'<i>Không ghi lý do</i>'}${p.auto?' <span class="rc-tag">tự động</span>':''}</td>
      <td>${p.machineId?esc(rcMachineName(p.machineId)):'—'}</td><td>${esc(p.by||'—')}${p.resumeBy&&p.resumeBy!==p.by?' → '+esc(p.resumeBy):''}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// ── Xuất Excel (nhiều trang) ────────────────────────────────────────────────
function thPlain(ts){ return ts ? fmtDateTime(ts) : 'CHƯA CÓ DỮ LIỆU'; }
function thPlainList(a){ return a && a.length ? a.join(', ') : 'CHƯA CÓ DỮ LIỆU'; }
function thSheets(m){
  const ov = m.overview, NA = 'CHƯA CÓ DỮ LIỆU';
  const mn = ids => (ids&&ids.length) ? ids.map(rcMachineName).join(' → ') : NA;
  return {
    overview:[['Chỉ tiêu','Giá trị'],
      ['Mã đơn hàng',ov.code],['Khách hàng',ov.customer||NA],['Số PO',ov.po||NA],['Mã sản phẩm (QR)',thPlainList(ov.productCodes)],
      ['Quy cách',ov.spec||NA],['Mác đồng (QR)',thPlainList(ov.copperGrades)],
      ['Số lượng đặt',ov.qtyOrdered!=null?ov.qtyOrdered+' '+ov.unit:NA],['Số lượng thực tế hoàn thành',ov.qtyDone!=null?ov.qtyDone+' '+ov.unit:NA],
      ['Bắt đầu sản xuất',thPlain(ov.startedAt)],['Hoàn thành',thPlain(ov.doneAt)],
      ['Tổng thời gian chạy thực tế',rcFmtHMS(ov.runMs,true)],['Số lần tạm dừng',ov.pauseCount],['Tổng thời gian nghỉ',rcFmtDur(ov.pausedMs)],
      ['Người phụ trách',ov.owner||NA],['Người xác nhận hoàn thành',ov.doneBy||NA],
      ['Nguồn thời gian chạy',ov.runSource==='sessions'?'Phiên chạy (chính xác)':'Dữ liệu cũ (chưa loại trừ lúc nghỉ)']],
    stages:[['Công đoạn','Trạng thái','Máy thực hiện','Máy theo Kế hoạch SX (phân máy)','Máy theo Sổ máy','Bắt đầu','Kết thúc','Thời gian chạy','Nguồn dữ liệu','Số lượng đầu vào','Số lượng đầu ra','Số lượng thực hiện','Người vận hành (Sổ máy)','Người thao tác','Ghi chú sản xuất']]
      .concat(m.stages.map(st=>[st.label,(TH_STATE[st.state]||TH_STATE.missing).txt,
        st.machineIds.length?mn(st.machineIds):(st.assignedMachineId?rcMachineName(st.assignedMachineId)+' (chỉ phân công)':NA),st.plan?rcMachineName(st.plan.machineId)+' ('+(TH_PLAN_VIA[st.plan.via]||'')+')'+(st.planDiff?' — KHÁC máy chạy thực tế':''):NA,thPlainList(st.ledgerMachines),
        thPlain(st.startAt),st.open?'đang chạy':thPlain(st.endAt),st.runMs!=null?rcFmtHMS(st.runMs,true):NA,TH_SRC_TXT[st.source]||'',
        st.key==='dun'?(st.qty.input!=null?st.qty.input+' '+st.qty.inputUnit:NA):NA, st.key==='dun'?(st.qty.output!=null?st.qty.output+' '+st.qty.outputUnit:NA):NA,
        st.key!=='dun'?(st.qty.done!=null?st.qty.done+' '+st.qty.doneUnit:NA):NA,thPlainList(st.operatorsLedger),thPlainList(st.actors),thPlainList(st.notes)]))
      .concat(m.qc.items.length ? m.qc.items.map(i=>['KIỂM TRA – '+(i.code||''),(TH_QC_RES[i.result]||TH_QC_RES.UNK)[0],'','','',i.at?fmtDateTime(i.at):NA,'','','Phiếu QC','','','',i.inspector||NA,'',[i.disposition,i.cause,i.action].filter(Boolean).join(' | ')])
        : [['KIỂM TRA CHẤT LƯỢNG','Chưa có dữ liệu','','','','','','','','','','','','','CHƯA CÓ DỮ LIỆU']]),
    runs:[['Lần','Công đoạn','Máy','Bắt đầu','Kết thúc','Thời gian chạy','Người vận hành','Kết thúc do','Ghi chú']]
      .concat(m.runTable.concat(m.legacyRows).map((r,i)=>[r.no||(i+1),rcStageLabel(r.stage),r.machineId?rcMachineName(r.machineId):'Chưa gán máy',thPlain(r.startAt),r.open?'đang chạy':thPlain(r.endAt),
        r.runMs==null?NA:rcFmtHMS(r.runMs,true),r.by||NA,r.open?'':(RC_END_LABEL[r.endReason]||r.endReason||''),r.legacy?'Dữ liệu cũ':''])),
    pauses:[['Lần','Tạm dừng lúc','Chạy lại lúc','Thời gian nghỉ','Lý do','Máy','Người thao tác']]
      .concat(m.pauses.map(p=>[p.no||'',thPlain(p.at),p.resumeAt?thPlain(p.resumeAt):(p.closedReason||'đang tạm dừng'),p.pausedMs!=null?rcFmtDur(p.pausedMs):'',p.reason||'Không ghi lý do',p.machineId?rcMachineName(p.machineId):'',(p.by||'')+(p.resumeBy&&p.resumeBy!==p.by?' → '+p.resumeBy:'')]))
  };
}
async function thExportExcel(){
  const m = _thModel; if(!m){ showToast('Chưa có dữ liệu để xuất', true); return; }
  showToast('⏳ Đang tạo file Excel...');
  try{ await ensureExcelJs(); }catch(e){ showToast('❌ Không tải được thư viện xuất Excel — kiểm tra kết nối mạng rồi thử lại', true); return; }
  if(!window.ExcelJS){ showToast('⏳ Thư viện Excel chưa tải xong, vui lòng thử lại', true); return; }
  try{
    const sh = thSheets(m), wb = new ExcelJS.Workbook();
    wb.creator = actorName(); wb.created = new Date();
    const thin = {style:'thin', color:{argb:'FF9AA5B8'}}, border = {top:thin,left:thin,bottom:thin,right:thin};
    const add = (name, table, widths)=>{
      const ws = wb.addWorksheet(name, {views:[{state:'frozen', ySplit:3}], pageSetup:{orientation:'landscape', paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:0}});
      const nC = table[0].length;
      ws.mergeCells(1,1,1,nC); ws.getCell(1,1).value = 'BÁO CÁO TRUY XUẤT SẢN XUẤT — '+m.overview.code+' · '+(m.overview.customer||'');
      ws.getCell(1,1).font = {bold:true,size:13,name:'Arial',color:{argb:'FF1D3FAE'}};
      ws.mergeCells(2,1,2,nC); ws.getCell(2,1).value = 'CÔNG TY CỔ PHẦN CÔNG THƯƠNG ĐÔNG PHƯƠNG · Xuất bởi '+actorName()+' · '+fmtDateTime(Date.now());
      ws.getCell(2,1).font = {italic:true,size:9,name:'Arial'};
      table.forEach((row,ri)=>row.forEach((v,ci)=>{
        const c = ws.getCell(ri+3, ci+1); c.value = xlsClean(v==null?'':(typeof v==='number'?v:String(v)));
        c.border = border; c.alignment = {vertical:'middle', wrapText:true};
        if(ri===0){ c.font = {bold:true,color:{argb:'FFFFFFFF'},size:10,name:'Arial'}; c.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF1D3FAE'}}; }
        else c.font = {size:10,name:'Arial', color:{argb: v==='CHƯA CÓ DỮ LIỆU'?'FFB45309':'FF000000'}};
      }));
      (widths||[]).forEach((w,i)=>{ ws.getColumn(i+1).width = w; });
    };
    add('Tong quan', sh.overview, [34,60]);
    add('Cong doan', sh.stages, [22,16,28,32,24,18,18,14,22,22,22,20,24,22,34]);
    add('Phien chay', sh.runs, [7,14,24,18,18,14,20,18,14]);
    add('Tam dung', sh.pauses, [7,18,18,14,34,22,24]);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `Truy_xuat_${String(m.overview.code).replace(/[^A-Za-z0-9_-]/g,'_')}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('✅ Đã xuất báo cáo truy xuất ra Excel');
  }catch(err){ console.error(err); showToast('❌ Xuất Excel thất bại: '+(err&&err.message||err), true); }
}
// ── In / Lưu PDF ────────────────────────────────────────────────────────────
function thPrint(){
  const m = _thModel; if(!m){ showToast('Chưa có dữ liệu để in', true); return; }
  const w = window.open('', '_blank', 'width=980,height=900');
  if(!w){ showToast('Trình duyệt đang chặn cửa sổ in, vui lòng cho phép popup', true); return; }
  const body = document.getElementById('thBody').cloneNode(true);
  body.querySelectorAll('details').forEach(d=>d.setAttribute('open',''));
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Truy xuất ${esc(m.overview.code)}</title>
  <style>body{font-family:Inter,Arial,sans-serif;padding:22px;color:#151924;font-size:12.5px}
  h1{font-size:17px;margin:0 0 4px}.sub{color:#646c7c;margin-bottom:12px}
  .th-sec{margin:12px 0;page-break-inside:avoid}.th-sec-t{font-weight:800;font-size:13.5px;margin-bottom:6px;color:#1D3FAE}
  .th-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px}.th-grid-2{grid-template-columns:repeat(2,1fr)}
  .th-grid div{display:flex;flex-direction:column;border-bottom:1px solid #e4e7ee;padding:3px 0}.th-grid b{font-size:10.5px;color:#646c7c;font-weight:700}
  table{width:100%;border-collapse:collapse;margin:6px 0}th,td{border:1px solid #c9ced8;padding:4px 6px;text-align:left;font-size:11px}th{background:#eef2fb}
  details{border:1px solid #c9ced8;border-radius:6px;margin:6px 0;padding:6px 8px;page-break-inside:avoid}summary{font-weight:800;list-style:none}
  summary small{color:#646c7c;font-weight:600;margin-left:8px}.th-badge{float:right;font-size:10.5px;border:1px solid #bbb;border-radius:10px;padding:1px 8px}
  .ds-na{color:#b45309;font-weight:700}.th-tools,.th-legend,.th-sec-t small{display:none}</style></head><body>
  <h1>BÁO CÁO TRUY XUẤT SẢN XUẤT — ${esc(m.overview.code)}</h1>
  <div class="sub">CÔNG TY CỔ PHẦN CÔNG THƯƠNG ĐÔNG PHƯƠNG · In bởi ${esc(actorName())} · ${esc(fmtDateTime(Date.now()))}</div>${body.innerHTML}</body></html>`);
  w.document.close(); w.focus();
  setTimeout(()=>w.print(), 400);
}
