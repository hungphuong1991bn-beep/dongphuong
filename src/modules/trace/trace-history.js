// src/modules/trace/trace-history.js — v2.14.0: MÔ HÌNH TRUY XUẤT LỊCH SỬ SẢN XUẤT CỦA 1 ĐƠN (CHỈ ĐỌC)
// ────────────────────────────────────────────────────────────────────────────
// Tạo cấu trúc dữ liệu cho bảng "Truy xuất sản xuất" ở tab Đơn hoàn thành:
//   ĐÙN → RÚT → ĐÁNH BÓNG → CẮT → KIỂM TRA → HOÀN THÀNH
// NGUYÊN TẮC (giống trace-engine.js):
//   • KHÔNG ghi gì vào DB, KHÔNG tự suy diễn. Liên kết CHỈ bằng KHÓA: ID đơn (donHangId / orderId).
//     Không ghép theo tên khách hàng hay mã PO.
//   • Dữ liệu chưa được ghi nhận → null / mảng rỗng; giao diện hiển thị "CHƯA CÓ DỮ LIỆU".
//     Không bịa máy, giờ hay người vận hành.
//   • Nguồn của từng thông tin được ghi rõ (source) để phân biệt dữ liệu THỰC TẾ với dữ liệu cũ:
//       'sessions'  phiên chạy ghi tự động từ v2.14 (máy · giờ · người · thời lượng chính xác)
//       'history'   machineHistory cũ (chỉ có máy + mốc bắt đầu/kết thúc, KHÔNG có thời lượng chạy / người)
//       'assigned'  chỉ có phân công máy (machineAssign) — KHÔNG xác nhận máy đã thực sự chạy
//       'ledger'    Sổ máy (Nhật ký đùn / rút / đánh bóng+cắt) gắn đơn bằng donHangId
//       'none'      không có dữ liệu
//   • Nguồn dữ liệu nhận qua tham số src (xem trSource()) để kiểm thử độc lập.
// ────────────────────────────────────────────────────────────────────────────

const TH_STAGES = [
  {key:'dun',      label:'ĐÙN',        icon:'🔧', ledger:'nl'},
  {key:'rut',      label:'RÚT',        icon:'🔩', ledger:'rut'},
  {key:'danhbong', label:'ĐÁNH BÓNG',  icon:'✨', ledger:'polish'},
  {key:'cat',      label:'CẮT',        icon:'✂️', ledger:'cut'}
];

// v2.14.1: MÁY THEO KẾ HOẠCH SX (chức năng "Phân công máy" ở tab Kế hoạch SX) — CHỈ ĐỌC.
// Nguồn: o.machineAssign[công đoạn] (máy đang gán) → o.machineHistory[công đoạn] (máy đã lưu vết khi đơn đi qua công đoạn).
// Trả null nếu kế hoạch chưa từng gán máy cho công đoạn đó (không đoán).
function thPlanMachine(order, stageKey){
  const as = order.machineAssign && order.machineAssign[stageKey];
  if(as) return {machineId:as, via:'assign', startAt:(order.machineActiveStartAt && order.machineActiveStartAt[stageKey]) || null, endAt:null};
  const h = order.machineHistory && order.machineHistory[stageKey];
  if(h && h.machineId) return {machineId:h.machineId, via:'history', startAt:h.startAt||null, endAt:h.endAt||null};
  return null;
}

function thUniq(a){ return [...new Set((a||[]).filter(x=>x!=null && String(x).trim()!=='').map(x=>String(x).trim()))]; }
function thNum(v){ const n = Number(v); return (v===''||v==null||!isFinite(n)) ? null : n; }
function thSum(rows, key){
  let any = false, t = 0;
  (rows||[]).forEach(r=>{ const n = thNum(r[key]); if(n!=null){ any = true; t += n; } });
  return any ? t : null;
}

// Phiếu QC gắn với đơn: theo ID đơn; phiếu chưa gắn đơn chỉ nối khi mã lô / mã sản phẩm trùng KHÓA của đơn
function thQcFor(orderId, src, lotKeys, prodKeys){
  const out = [];
  (src.qc||[]).forEach(q=>{
    if(!q) return; let via = '';
    if(q.orderId===orderId) via = 'Theo ID đơn hàng';
    else if(!q.orderId && trKey(q.lot) && lotKeys.has(trKey(q.lot))) via = 'Theo mã lô (phiếu chưa gắn đơn)';
    else if(!q.orderId && trKey(q.productCode) && prodKeys.has(trKey(q.productCode))) via = 'Theo mã sản phẩm (phiếu chưa gắn đơn)';
    if(via) out.push({q, via});
  });
  return out.sort((a,b)=>trTs(a.q.createdAt||a.q.date)-trTs(b.q.createdAt||b.q.date));
}

function thBuild(orderId, src){
  src = src || trSource();
  const order = (src.orders||[]).find(o=>o && o.id===orderId);
  if(!order) return null;
  const mine = a => (a||[]).filter(r=>r && r.donHangId===orderId);
  const isCut = r => trKey(r.congDoan).indexOf('CAT')>=0;
  const nl = mine(src.nl), rut = mine(src.rut), dbAll = mine(src.db);
  const ledgers = {nl, rut, polish:dbAll.filter(r=>!isCut(r)), cut:dbAll.filter(isCut)};
  const qrs = (src.qr||[]).filter(p=>p && p.orderId===orderId);
  const sessions = rcSessions(order).filter(Boolean).slice().sort((a,b)=>a.startAt-b.startAt);
  const pauses = rcPauses(order).filter(Boolean);
  const now = rcNow();
  const status = rcStatusOf(order);

  // ── Công đoạn sản xuất ──
  const stages = TH_STAGES.map(def=>{
    const ss = sessions.filter(s=>s.stage===def.key);
    const hist = order.machineHistory && order.machineHistory[def.key];
    const assigned = order.machineAssign && order.machineAssign[def.key];
    const rows = ledgers[def.ledger];
    const openS = ss.find(s=>s.endAt==null);
    let source = 'none';
    if(ss.length) source = 'sessions'; else if(hist) source = 'history'; else if(assigned) source = 'assigned';

    // Trạng thái hiển thị
    let state = 'missing';
    if(openS) state = 'running';
    else if(status==='paused' && ss.length && ss[ss.length-1].endReason==='pause' && (order.stage||'dun')===def.key) state = 'paused';
    else if(ss.length) state = 'done';
    else if(hist) state = 'done';
    else if(rows.length) state = 'partial';       // có dòng Sổ máy nhưng không có bản ghi chạy
    else if(assigned && status!=='done') state = 'planned';

    // Máy: ưu tiên phiên chạy → lịch sử cũ → (phân công, KHÔNG xác nhận)
    const machineIds = thUniq(ss.map(s=>s.machineId));
    if(!machineIds.length && hist && hist.machineId) machineIds.push(hist.machineId);
    const startAt = ss.length ? ss[0].startAt : (hist ? hist.startAt||null : null);
    const closed = ss.filter(s=>s.endAt!=null);
    const endAt = openS ? null : (closed.length ? closed[closed.length-1].endAt : (hist ? hist.endAt||null : null));
    let runMs = null;
    if(ss.length) runMs = ss.reduce((t,s)=>t + (s.endAt!=null ? (s.runMs!=null?s.runMs:Math.max(0,s.endAt-s.startAt)) : Math.max(0, now-s.startAt)), 0);
    // Với dữ liệu cũ chỉ có mốc đầu–cuối: đó là KHOẢNG thời gian, KHÔNG phải thời gian chạy thực → để riêng
    const spanMs = (!ss.length && hist && hist.startAt && hist.endAt) ? Math.max(0, hist.endAt-hist.startAt) : null;

    // Số liệu từ Sổ máy (gắn bằng donHangId)
    const ledgerMachines = thUniq(rows.map(r=>r.may));
    const operatorsLedger = thUniq(rows.map(r=>r.nguoiSanXuat));
    const actors = thUniq(ss.map(s=>s.by).concat(ss.map(s=>s.endBy)));
    const notes = thUniq(rows.map(r=>r.ghiChu));
    let qty = {input:null, output:null, done:null, inputUnit:'', outputUnit:'', doneUnit:'', source:'none', note:''};
    if(rows.length){
      qty.source = 'ledger';
      if(def.key==='dun'){
        qty.input = thSum(rows,'soLuong'); qty.inputUnit = 'kg nguyên liệu';
        qty.output = thSum(rows,'soMetChay'); qty.outputUnit = 'm chạy';
        qty.note = 'Theo Nhật ký đùn (Số lượng kg · Số mét chạy).';
      } else {
        qty.done = thSum(rows,'soThanh'); qty.doneUnit = 'thanh';
        qty.note = 'Sổ máy chỉ ghi 1 số lượng (số thanh thực hiện) — hệ thống chưa tách đầu vào / đầu ra cho công đoạn này.';
      }
    }
    // v2.14.1: máy theo phân công ở Kế hoạch SX + đối chiếu với máy thực tế đã chạy (nếu có phiên chạy)
    const plan = thPlanMachine(order, def.key);
    const planDiff = !!(plan && ss.length && machineIds.length && machineIds.indexOf(plan.machineId)<0);
    return {
      key:def.key, label:def.label, icon:def.icon, state, source,
      plan, planDiff,
      machineIds, ledgerMachines, assignedMachineId: assigned||'',
      startAt, endAt, runMs, spanMs, open:!!openS,
      sessions:ss, operatorsLedger, actors, notes, qty,
      shifts: thUniq(rows.map(r=>r.ca)), ledgerRows: rows.length,
      lots: thUniq(rows.map(r=>r.heatLot).concat(rows.map(r=>r.maLoSX)))
    };
  });

  // ── Kiểm tra chất lượng ──
  const lotKeys = new Set(), prodKeys = new Set();
  [nl,rut,dbAll].forEach(a=>a.forEach(r=>{ const m=trKey(r.maLoSX), h=trKey(r.heatLot); if(m) lotKeys.add(m); if(h) lotKeys.add(h); }));
  qrs.forEach(p=>{ const k=trKey(p.productCode); if(k) prodKeys.add(k); });
  const qcList = thQcFor(orderId, src, lotKeys, prodKeys).map(({q,via})=>({
    id:q.id, code:q.code||'', inspector:q.inspector||q.holdBy||q.createdBy||'',
    at:trTs(q.createdAt)||trTs(q.date), atExact:!!trTs(q.createdAt),
    kind:q.type, form:q.form||'', result:q.type==='hold'?'HOLD':q.type==='ncr'?'NCR':(q.result||'UNK'),
    draft:q.status==='draft', voided:!!q.void, via,
    disposition:q.disposition||'', cause:q.cause||'', action:q.action||''
  }));
  const live = qcList.filter(i=>!i.draft && !i.voided);
  const qcResult = !live.length ? '' : (live.some(i=>i.result==='NG'||i.result==='HOLD'||i.result==='NCR') ? 'NG' : live.some(i=>i.result==='OK') ? 'OK' : 'UNK');
  const qc = {key:'qc', label:'KIỂM TRA CHẤT LƯỢNG', icon:'✅', state: qcList.length?'done':'missing', source: qcList.length?'qc':'none', items:qcList, result:qcResult};

  // ── Hoàn thành ──
  const finish = {key:'done', label:'HOÀN THÀNH', icon:'🏁', state: status==='done' ? 'done' : 'missing',
    at: order.doneAt||null, by: order.doneBy||'', qtyDone: thNum(order.doneQty), qtyOrdered: thNum(order.qty)};

  // ── Tổng quan ──
  const owner = (src.users||((typeof DB!=='undefined'&&DB.users)||[])).find(u=>u && u.id===order.createdBy);
  const overview = {
    id:order.id, code:(typeof ddCode==='function')?ddCode(order):(order.po||order.id), customer:order.customer||'', po:order.po||'',
    productType:order.type||'', productCodes:thUniq(qrs.map(p=>p.productCode)), copperGrades:thUniq(qrs.map(p=>p.copperGrade)),
    spec:(typeof specStr==='function')?specStr(order):'', material:order.material||'',
    qtyOrdered:thNum(order.qty), qtyDone:thNum(order.doneQty), kg:thNum(order.kg),
    unit: order.isCoil?'cuộn':(order.isRound?'cây':'thanh'),
    startedAt:order.startedAt||null, doneAt:order.doneAt||null,
    runMs: rcRunMs(order, now), runSource: rcRunSource(order),
    pausedMs: rcPausedTotalMs(order, now), pauseCount: rcPauseCount(order),
    owner: owner ? owner.name : '', doneBy: order.doneBy||'',
    status, delivered:!!order.delivered, whIn:!!order.whIn, progressNote:order.progressNote||'', note:order.note||'',
    qrCount:qrs.length
  };

  // ── Bảng "Lần · Công đoạn · Máy · Bắt đầu · Kết thúc · Thời gian chạy · Người vận hành" ──
  const runTable = sessions.map(s=>({
    no:s.no, stage:s.stage, machineId:s.machineId||'', startAt:s.startAt, endAt:s.endAt==null?null:s.endAt,
    runMs: s.endAt!=null ? (s.runMs!=null?s.runMs:Math.max(0,s.endAt-s.startAt)) : Math.max(0, now-s.startAt),
    open:s.endAt==null, by:s.by||'', endBy:s.endBy||'', startReason:s.startReason||'', endReason:s.endReason||'',
    legacy:!!s.legacy, source:'sessions'
  }));
  // Công đoạn chỉ có lịch sử máy cũ (không có phiên): liệt kê riêng, thời lượng = CHƯA CÓ DỮ LIỆU
  const legacyRows = [];
  TH_STAGES.forEach(def=>{
    if(sessions.some(s=>s.stage===def.key)) return;
    const h = order.machineHistory && order.machineHistory[def.key];
    if(h) legacyRows.push({no:null, stage:def.key, machineId:h.machineId||'', startAt:h.startAt||null, endAt:h.endAt||null,
      runMs:null, open:false, by:'', endBy:'', startReason:'', endReason:'', legacy:true, source:'history'});
  });

  // ── Lịch sử đổi máy: 2 phiên liên tiếp CÙNG công đoạn mà khác máy ──
  const machineChanges = [];
  TH_STAGES.forEach(def=>{
    const ss = sessions.filter(s=>s.stage===def.key);
    for(let i=1;i<ss.length;i++){
      if((ss[i-1].machineId||'')!==(ss[i].machineId||'')){
        machineChanges.push({at:ss[i].startAt, stage:def.key, from:ss[i-1].machineId||'', to:ss[i].machineId||'',
          by:ss[i].by||'', viaPause: ss[i-1].endReason==='pause'});
      }
    }
  });

  // ── Chỗ thiếu dữ liệu (nói rõ, không đoán) ──
  const gaps = [];
  stages.forEach(st=>{
    if(st.state==='missing') gaps.push(`Công đoạn ${st.label}: CHƯA CÓ DỮ LIỆU (không có phiên chạy, lịch sử máy hay dòng Sổ máy gắn với đơn này bằng ID).`);
    else if(st.source==='history') gaps.push(`Công đoạn ${st.label}: chỉ có lịch sử máy cũ — không có thời gian chạy thực tế, không có người vận hành.`);
    else if(st.source==='assigned' || (st.state==='partial')) gaps.push(`Công đoạn ${st.label}: chưa có bản ghi chạy thực tế${st.assignedMachineId?' (chỉ có phân công máy, không xác nhận đã chạy)':''}.`);
  });
  stages.forEach(st=>{
    if(st.planDiff) gaps.push(`Công đoạn ${st.label}: Kế hoạch SX phân máy ${rcMachineName(st.plan.machineId)} nhưng phiên chạy ghi ${st.machineIds.map(rcMachineName).join(' → ')} — kiểm tra lại phân công / đổi máy.`);
  });
  if(!qcList.length) gaps.push('Kiểm tra chất lượng: chưa có phiếu QC nào gắn với đơn này bằng ID đơn hàng.');
  if(overview.runSource==='legacy') gaps.push('Thời gian chạy: đơn hoàn thành trước khi có tính năng tạm dừng — con số là khoảng từ lúc bắt đầu đến hoàn thành (không loại trừ thời gian nghỉ).');
  if(overview.runSource==='legacy-mixed') gaps.push('Thời gian chạy: có phiên khôi phục từ dữ liệu cũ (mốc bắt đầu = giờ bắt đầu đơn) nên chưa loại trừ được thời gian nghỉ trước thời điểm nâng cấp.');

  return {order, overview, stages, qc, finish, runTable, legacyRows, pauses, machineChanges, gaps, qrs};
}
