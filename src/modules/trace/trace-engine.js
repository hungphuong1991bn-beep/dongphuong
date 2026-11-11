// src/modules/trace/trace-engine.js — PHÂN HỆ TRUY XUẤT & KHIẾU NẠI (Bước 2: truy xuất CHỈ ĐỌC)
// ────────────────────────────────────────────────────────────────────
// NGUYÊN TẮC (theo đặc tả):
//  • KHÔNG ghi gì vào DB, KHÔNG sửa dữ liệu nguồn, KHÔNG tự suy diễn.
//  • Chỉ liên kết bằng KHÓA (ID đơn / Heat-Lot / Mã lô SX / mã QR) — tuyệt đối
//    không ghép theo tên khách hàng, tên sản phẩm hay quy cách.
//  • Quan hệ nào không có khóa → không hiện là đã liên kết (UI ghi CHƯA XÁC ĐỊNH).
// Hàm thuần: nhận nguồn dữ liệu qua tham số để kiểm thử độc lập (xem trSource()).
// ────────────────────────────────────────────────────────────────────

// Chuẩn hoá MÃ để so khớp khóa: bỏ dấu, hoa, bỏ khoảng trắng. Rỗng → ''.
function trKey(s){
  return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d')
    .toUpperCase().replace(/\s+/g,'');
}
// Chuẩn hoá VĂN BẢN để tìm kiếm (không dùng để liên kết).
function trText(s){
  return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim();
}
// ── TÌM THEO QUY CÁCH KÍCH THƯỚC (10x100, 10*100, 10 X 100, 10×100×4000, Φ18…) ──
// Người dùng gõ dấu nhân bằng x / X / * / × / ✕ → quy hết về chữ "x"; bỏ khoảng trắng,
// "mm", dấu phẩy thập phân → chấm. Chỉ coi là truy vấn quy cách khi có dạng SỐ x SỐ…
// hoặc Φ/phi + số (ô nhập 1 con số trơn như "100" KHÔNG bị coi là quy cách để tránh khớp bừa).
function trSpecKey(s){
  return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase()
    .replace(/[φϕø⌀]/g,'phi').replace(/[×✕✖✗*·]/g,'x')
    .replace(/(\d),(\d)/g,'$1.$2').replace(/mm|cm/g,'').replace(/[^a-z0-9.]/g,'');
}
function trSpecQuery(raw){
  const k = trSpecKey(raw);
  return (/^(phi)?\d+(\.\d+)?(x\d+(\.\d+)?)+$/.test(k) || /^phi\d+(\.\d+)?(x\d+(\.\d+)?)*$/.test(k)) ? k : '';
}
// Khớp theo ranh giới từng số: "10x100" khớp "10x100x4000" nhưng KHÔNG khớp "110x100".
// Trường tự do (vd. loại hàng "10*100 mạ", "TJ 10 x 100 đỏ") được tách thành các cụm số
// "số x số x số" rồi mới so, nên chữ xung quanh không làm hỏng việc khớp.
function trSpecTokens(field){
  let f = String(field==null?'':field).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase()
    .replace(/[φϕø⌀]/g,'phi').replace(/[×✕✖*·]/g,'x').replace(/(\d),(\d)/g,'$1.$2').replace(/mm|cm/g,' ');
  f = f.replace(/phi\s*(?=\d)/g,'phi');
  for(let i=0;i<3;i++) f = f.replace(/(\d)\s*x\s*(?=\d)/g,'$1x');
  return f.match(/(?:phi)?\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)*/g) || [];
}
function trSpecHas(field, qSpec){
  if(!qSpec) return false;
  return trSpecTokens(field).some(t=>('x'+t+'x').indexOf('x'+qSpec+'x')>=0);
}
// Quy cách đầy đủ của 1 đơn / 1 mã QR từ các trường kích thước (giống specStr ở tab Đơn hàng)
function trDimSpec(o){
  if(!o) return '';
  const t=o.thickness, w=o.width, l=o.length, phi=o.phi;
  if(o.isCoil) return (phi && o.isRound) ? 'phi'+phi : [t,w].filter(Boolean).join('x');
  if(phi && o.isRound) return 'phi'+phi+(l?'x'+l:'');
  return [t,w,l].filter(Boolean).join('x');
}

// Nếu người dùng dán link QR công khai (?qr=DP-...) → lấy mã QR ra.
function trExtractQr(q){
  const s = String(q||'').trim();
  const m = s.match(/[?&]qr=([^&#\s]+)/i);
  if(m){ try{ return decodeURIComponent(m[1]); }catch(e){ return m[1]; } }
  return s;
}

// Nguồn dữ liệu thật của app (đọc, không ghi)
function trSource(){
  return {
    orders: (typeof DB!=='undefined' && DB.orders) || [],
    qr:     (typeof DB!=='undefined' && DB.qrProducts) || [],
    nl:     (typeof DB!=='undefined' && DB.nguyenLieuLog) || [],
    rut:    (typeof DB!=='undefined' && DB.mayRutLog) || [],
    db:     (typeof DB!=='undefined' && DB.mayDanhBongLog) || [],
    // Phiếu QC (module Chất lượng): chỉ phiếu có thật, bỏ bản ghi danh mục (cp/pfmea/aql/defect/importLog)
    qc:     ((typeof DB!=='undefined' && DB.cpRecords) || []).filter(r=>r && (r.type==='chk'||r.type==='fqc'||r.type==='ncr'||r.type==='hold'))
  };
}

// Tìm theo ô nhập: trả về {query, seeds, primary, material, related, gaps}
//  seeds    : các bản ghi khớp trực tiếp ô nhập (kèm lý do khớp)
//  primary  : đơn / QR / dòng sổ liên kết TRỰC TIẾP bằng khóa với seeds
//  material : lô nguyên liệu (Heat-Lot) liên quan + toàn bộ dòng sổ cùng lô
//  related  : đơn & dòng sổ KHÁC dùng chung lô → nguy cơ ảnh hưởng (1 bước, không lan rộng)
function trSearch(rawQuery, src, scope){
  src = src || trSource();
  scope = scope || 'all';
  const A = tag => scope==='all' || scope===tag;   // phạm vi tìm: all | order | lot | product | spec | wo
  const query = trExtractQr(rawQuery);
  const qKey = trKey(query), qTxt = trText(query);
  const out = {query, seeds:{orders:[],qr:[],nl:[],rut:[],db:[],qc:[]}, why:{}, scope, primary:null, material:null, related:null, gaps:[]};
  if(!qKey) return out;

  const why = (k,id,reason)=>{ (out.why[k+':'+id] = out.why[k+':'+id] || []).push(reason); };
  const exactOrContains = (field, key) => { const f=trKey(field); return !!f && (f===key || (key.length>=3 && f.indexOf(key)>=0)); };
  const textHas = (field) => !!qTxt && qTxt.length>=2 && trText(field).indexOf(qTxt)>=0;
  const qSpec = trSpecQuery(query); // '' nếu ô nhập không có dạng quy cách

  // ── 1. SEEDS: khớp trực tiếp ───────────────────────────────────────
  src.orders.forEach(o=>{
    if(!o) return; const r=[];
    if(A('order') && o.id && o.id===query) r.push('Mã đơn hàng (ID)');
    if(A('order') && exactOrContains(o.po,qKey)) r.push('Mã PO khách hàng');
    if(A('lot') && (o.matCodes||[]).some(c=>exactOrContains(c,qKey))) r.push('Mã nguyên liệu trên đơn');
    if(A('order') && textHas(o.customer)) r.push('Tên khách hàng');
    if(A('spec') && textHas(o.type)) r.push('Quy cách sản phẩm');
    else if(A('spec') && qSpec && (trSpecHas(o.type,qSpec) || trSpecHas(trDimSpec(o),qSpec))) r.push('Quy cách sản phẩm');
    if(r.length){ out.seeds.orders.push(o); r.forEach(x=>why('order',o.id,x)); }
  });
  src.qr.forEach(p=>{
    if(!p) return; const r=[];
    if(A('product') && exactOrContains(p.qrCode,qKey)) r.push('Mã QR');
    if(A('product') && exactOrContains(p.productCode,qKey)) r.push('Mã sản phẩm / thành phẩm');
    if(A('spec') && qSpec && (trSpecHas(p.productName,qSpec) || trSpecHas(trDimSpec(p.spec),qSpec))) r.push('Quy cách sản phẩm');
    if(r.length){ out.seeds.qr.push(p); r.forEach(x=>why('qr',p.id,x)); }
  });
  [['nl',src.nl],['rut',src.rut],['db',src.db]].forEach(([k,arr])=>{
    arr.forEach(r0=>{
      if(!r0) return; const r=[];
      if(A('lot') && exactOrContains(r0.heatLot,qKey)) r.push('Mã lô nguyên liệu / Heat-Lot');
      if((A('lot')||A('wo')) && exactOrContains(r0.maLoSX,qKey)) r.push('Mã lô sản xuất');
      if(A('wo') && k==='nl' && exactOrContains(r0.wo,qKey)) r.push('Mã phiếu sản xuất (WO)');
      if(A('spec') && qSpec && trSpecHas(r0.quyCach,qSpec)) r.push('Quy cách sản phẩm');
      if(r.length){ out.seeds[k].push(r0); r.forEach(x=>why(k,r0.id,x)); }
    });
  });

  // Phiếu QC: khớp theo số phiếu / mã lô / mã sản phẩm (chỉ ở phạm vi 'all' hoặc đúng loại mã)
  (src.qc||[]).forEach(q=>{
    if(!q) return; const r=[];
    if(scope==='all' && exactOrContains(q.code,qKey)) r.push('Số phiếu QC');
    if(A('lot') && exactOrContains(q.lot,qKey)) r.push('Mã lô trên phiếu QC');
    if(A('product') && exactOrContains(q.productCode,qKey)) r.push('Mã sản phẩm trên phiếu QC');
    if(r.length){ out.seeds.qc.push(q); r.forEach(x=>why('qc',q.id,x)); }
  });

  // ── 2. PRIMARY: liên kết trực tiếp bằng KHÓA ───────────────────────
  const ordMap = new Map(src.orders.filter(Boolean).map(o=>[o.id,o]));
  const P = {orders:new Map(), qr:new Map(), nl:new Map(), rut:new Map(), db:new Map()};
  const addO = id => { if(id && ordMap.has(id)) P.orders.set(id, ordMap.get(id)); };
  out.seeds.orders.forEach(o=>addO(o.id));
  out.seeds.qr.forEach(p=>{ P.qr.set(p.id,p); addO(p.orderId); });
  out.seeds.qc.forEach(q=>addO(q.orderId));
  ['nl','rut','db'].forEach(k=>out.seeds[k].forEach(r=>{ P[k].set(r.id,r); addO(r.donHangId); }));
  // Chỉ khi người dùng tìm theo ĐƠN hoặc QR (định danh 1 đơn) mới mở rộng ra TOÀN BỘ
  // dòng sổ + QR của đơn đó. Tìm theo mã LÔ thì giữ đúng phạm vi lô (không kéo thêm
  // các lô nguyên liệu khác của cùng đơn) — đơn liên quan vẫn hiện để biết ngữ cảnh.
  const expandOrders = new Set([...out.seeds.orders.map(o=>o.id), ...out.seeds.qr.map(p=>p.orderId)].filter(id=>id && ordMap.has(id)));
  expandOrders.forEach(id=>{
    [['nl',src.nl],['rut',src.rut],['db',src.db]].forEach(([k,arr])=>arr.forEach(r=>{ if(r && r.donHangId===id) P[k].set(r.id,r); }));
    src.qr.forEach(p=>{ if(p && p.orderId===id) P.qr.set(p.id,p); });
  });
  // cùng Mã lô SX (khóa rõ ràng, không rỗng) → cùng một lô sản xuất
  const lotsSX = new Set();
  ['nl','rut','db'].forEach(k=>P[k].forEach(r=>{ const m=trKey(r.maLoSX); if(m) lotsSX.add(m); }));
  if(lotsSX.size){
    [['nl',src.nl],['rut',src.rut],['db',src.db]].forEach(([k,arr])=>arr.forEach(r=>{ if(r && lotsSX.has(trKey(r.maLoSX))) P[k].set(r.id,r); }));
  }

  // ── 3. MATERIAL: Heat-Lot của các dòng primary → mọi dòng cùng lô ──
  const heatLots = new Set();
  ['nl','rut','db'].forEach(k=>P[k].forEach(r=>{ const h=trKey(r.heatLot); if(h) heatLots.add(h); }));
  const M = {nl:[], rut:[], db:[]};
  const R = {orders:new Map(), nl:[], rut:[], db:[]};
  if(heatLots.size){
    [['nl',src.nl],['rut',src.rut],['db',src.db]].forEach(([k,arr])=>arr.forEach(r=>{
      if(!r || !heatLots.has(trKey(r.heatLot))) return;
      if(P[k].has(r.id)) { if(k==='nl') M.nl.push(r); return; }
      // nguyên liệu cùng lô luôn là "hồ sơ lô"; rút/bóng/nl khác đơn → vùng ảnh hưởng
      if(k==='nl') M.nl.push(r);
      R[k].push(r);
      if(r.donHangId && ordMap.has(r.donHangId) && !P.orders.has(r.donHangId)) R.orders.set(r.donHangId, ordMap.get(r.donHangId));
    }));
  }
  // đơn khác (không nằm trong primary) có matCodes trùng đúng Heat-Lot → cũng là liên quan
  if(heatLots.size){
    src.orders.forEach(o=>{ if(o && !P.orders.has(o.id) && (o.matCodes||[]).some(c=>heatLots.has(trKey(c)))) R.orders.set(o.id,o); });
  }

  // ── 3b. QC: phiếu gắn với kết quả bằng KHÓA (ID đơn / mã lô / mã sản phẩm) — ghi rõ lý do liên kết ──
  const prodKeys = new Set([...P.qr.values()].map(p=>trKey(p.productCode)).filter(Boolean));
  const lotKeys  = new Set([...lotsSX, ...heatLots]);
  const seedQc   = new Set(out.seeds.qc.map(q=>q.id));
  const Qm = new Map(); out.qcVia = {};
  (src.qc||[]).forEach(q=>{
    if(!q) return; let via='';
    if(seedQc.has(q.id)) via='Khớp trực tiếp ô tìm kiếm';
    else if(q.orderId && P.orders.has(q.orderId)) via='Theo ID đơn hàng';
    else if(trKey(q.lot) && lotKeys.has(trKey(q.lot))) via='Theo mã lô';
    else if(trKey(q.productCode) && prodKeys.has(trKey(q.productCode))) via='Theo mã sản phẩm';
    if(via){ Qm.set(q.id,q); out.qcVia[q.id]=via; }
  });

  out.primary = {
    orders:[...P.orders.values()], qr:[...P.qr.values()], qc:[...Qm.values()],
    nl:[...P.nl.values()], rut:[...P.rut.values()], db:[...P.db.values()]
  };
  out.material = {heatLots:[...heatLots], lotsSX:[...lotsSX], nl:M.nl};
  out.related  = {orders:[...R.orders.values()], nl:R.nl.filter(r=>!P.nl.has(r.id)), rut:R.rut, db:R.db};

  // ── 4. GAPS: nói rõ chỗ nào thiếu khóa (không đoán) ────────────────
  out.primary.orders.forEach(o=>{
    const nO = ['nl','rut','db'].reduce((s,k)=>s+[...P[k].values()].filter(r=>r.donHangId===o.id).length,0);
    if(!nO) out.gaps.push({orderId:o.id, code:'NO_LEDGER_LINK',
      text:'Chưa có dòng nào ở 3 sổ liên kết với đơn này bằng ID đơn. Có thể dòng chưa gắn đơn, hoặc đã được Admin dọn thủ công — đối chiếu file Excel đã xuất.'});
    if(!src.qr.some(p=>p && p.orderId===o.id)) out.gaps.push({orderId:o.id, code:'NO_QR', text:'Đơn chưa có mã QR / thành phẩm nào.'});
    if(!(src.qc||[]).some(q=>q && q.orderId===o.id)) out.gaps.push({orderId:o.id, code:'NO_QC', text:'Chưa có phiếu QC nào gắn với đơn này bằng ID đơn hàng.'});
  });
  ['rut','db'].forEach(k=>{
    const n=[...P[k].values()].filter(r=>!trKey(r.heatLot)).length;
    if(n) out.gaps.push({code:'NO_HEATLOT_'+k, text:`${n} dòng ${k==='rut'?'Sổ máy rút':'Sổ máy đánh bóng + cắt'} chưa có Heat-Lot nguồn → CHƯA XÁC ĐỊNH nguyên liệu đầu vào.`});
  });
  return out;
}

// Trạng thái "tình trạng truy xuất" cho 1 đơn — chỉ dựa trên khóa có thật
// Tính trên TOÀN BỘ nguồn (không phụ thuộc phạm vi tìm kiếm) để không báo thiếu sai.
function trCoverage(orderId, res, src){
  src = src || trSource();
  const has = arr => arr.some(r=>r && r.donHangId===orderId);
  const parts = {
    nguyenLieu: has(src.nl), mayRut: has(src.rut), mayDanhBong: has(src.db),
    qr: src.qr.some(x=>x && x.orderId===orderId)
  };
  const n = Object.values(parts).filter(Boolean).length;
  return {parts, level: n===4?'full': n===0?'none':'partial', n};
}

// ── HÀNH TRÌNH TRUY XUẤT của 1 đơn (timeline + sơ đồ) — CHỈ ĐỌC, chỉ nối bằng KHÓA ──────────────
// Tính trên TOÀN BỘ nguồn (không phụ thuộc phạm vi tìm kiếm) để không báo thiếu sai.
//  • Sổ nguyên liệu = "Sổ nguyên liệu/đùn" (đúng định nghĩa của module Chất lượng, cpLedgerFor) → cung cấp Máy đùn.
//  • Máy cắt = dòng Sổ đánh bóng+cắt có công đoạn chứa "cắt".
//  • Nhà cung cấp: hệ thống CHƯA có trường này ở bất kỳ nguồn nào → luôn trả status 'nodata', không điền tạm.
//  • Phiếu QC gắn theo orderId; phiếu không có orderId chỉ được nối khi mã lô / mã sản phẩm trùng KHÓA của đơn.
function trTs(v){ if(v==null||v==='') return 0; if(typeof v==='number') return v; const n=Date.parse(v); return isNaN(n)?0:n; }
function trRowTs(r){ return trTs(r.createdAt) || trTs(r.updatedAt) || trTs(r.ngay) || trTs(r.date); }
function trTimeline(orderId, src){
  src = src || trSource();
  const order = (src.orders||[]).find(o=>o && o.id===orderId) || null;
  const mine = a => (a||[]).filter(r=>r && r.donHangId===orderId);
  const isCut = r => trKey(r.congDoan).indexOf('CAT')>=0;
  const nl = mine(src.nl), rut = mine(src.rut), dbAll = mine(src.db);
  const qrs = (src.qr||[]).filter(p=>p && p.orderId===orderId);
  // khóa của đơn → để nối phiếu QC không có orderId
  const lotK = new Set(), prodK = new Set();
  [nl,rut,dbAll].forEach(a=>a.forEach(r=>{ const m=trKey(r.maLoSX), h=trKey(r.heatLot); if(m) lotK.add(m); if(h) lotK.add(h); }));
  qrs.forEach(p=>{ const k=trKey(p.productCode); if(k) prodK.add(k); });
  const qcList = [];
  (src.qc||[]).forEach(q=>{
    if(!q) return; let via='';
    if(q.orderId===orderId) via='Theo ID đơn hàng';
    else if(!q.orderId && trKey(q.lot) && lotK.has(trKey(q.lot))) via='Theo mã lô (phiếu chưa gắn đơn)';
    else if(!q.orderId && trKey(q.productCode) && prodK.has(trKey(q.productCode))) via='Theo mã sản phẩm (phiếu chưa gắn đơn)';
    if(via) qcList.push({q, via});
  });
  const uniq = a => [...new Set(a.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))];
  const led = (key,label,icon,rows,tab) => {
    const items = rows.map(r=>({ts:trRowTs(r), exact:!!(trTs(r.createdAt)||trTs(r.updatedAt)), who:r.nguoiSanXuat||r.updatedBy||'', machine:r.may||'',
      lot:[r.heatLot&&('Heat-Lot '+r.heatLot), r.maLoSX&&('Lô SX '+r.maLoSX)].filter(Boolean).join(' · '),
      detail:[r.nguyenLieu||r.quyCach||'', r.ca&&('Ca '+r.ca), r.soLuong?(r.soLuong+' kg'):(r.soThanh!=null&&r.soThanh!==''?(r.soThanh+' thanh'):'')].filter(Boolean).join(' · '),
      open:`slViewDetail('${tab}','${String(r.id).replace(/'/g,'')}')`})).sort((a,b)=>a.ts-b.ts);
    return {key,label,icon,status:items.length?'ok':'missing',items,machines:uniq(rows.map(r=>r.may)),actors:uniq(rows.map(r=>r.nguoiSanXuat||r.updatedBy))};
  };
  const stages = [];
  stages.push({key:'order',label:'Đơn hàng',icon:'📦',status:order?'ok':'missing',machines:[],actors:uniq([order&&(order.createdBy||order.updatedBy)]),
    items: order?[{ts:trTs(order.createdAt), exact:!!trTs(order.createdAt), who:order.createdBy||order.updatedBy||'', machine:'', lot:'', detail:[order.customer, order.po&&('PO '+order.po)].filter(Boolean).join(' · '), open:`ddViewDetail('${String(order.id).replace(/'/g,'')}')`}]:[]});
  stages.push({key:'supplier',label:'Nhà cung cấp',icon:'🏭',status:'nodata',items:[],machines:[],actors:[],
    note:'Hệ thống chưa có trường Nhà cung cấp ở Đơn hàng, Sổ nguyên liệu hay QR → không thể truy xuất. Chỉ hiển thị khi dữ liệu nguồn có trường này.'});
  stages.push(led('material','Nguyên liệu & Máy đùn','🧪',nl,'nguyenLieu'));
  stages.push(led('rut','Máy rút','↘️',rut,'mayRut'));
  stages.push(led('polish','Máy đánh bóng','✨',dbAll.filter(r=>!isCut(r)),'mayDanhBong'));
  stages.push(led('cut','Máy cắt','✂️',dbAll.filter(isCut),'mayDanhBong'));
  // QC
  const qcItems = qcList.map(({q,via})=>({ts:trTs(q.createdAt)||trTs(q.date), exact:!!trTs(q.createdAt), who:q.inspector||q.holdBy||q.createdBy||'', machine:q.machine||'',
    lot:q.lot?('Lô '+q.lot):'', detail:[ (typeof CP_STAGE_LABEL!=='undefined'&&CP_STAGE_LABEL[q.form])||q.form||({fqc:'FQC',ncr:'NCR',hold:'HOLD'}[q.type]||q.type), q.code, q.status==='draft'?'(nháp)':'', q.void?'(đã huỷ)':'' ].filter(Boolean).join(' · '),
    result: q.type==='hold'?'HOLD':q.type==='ncr'?'NCR':(q.result||'UNK'), via, draft:q.status==='draft', voided:!!q.void,
    open: (typeof cpOpen==='function')?`cpOpen('${String(q.id).replace(/'/g,'')}')`:''})).sort((a,b)=>a.ts-b.ts);
  const live = qcItems.filter(i=>!i.draft && !i.voided);
  const qcRes = live.some(i=>i.result==='NG'||i.result==='HOLD'||i.result==='NCR') ? 'NG' : live.some(i=>i.result==='OK') ? 'OK' : 'UNK';
  stages.push({key:'qc',label:'QC – Kết quả kiểm tra',icon:'✅',status:qcItems.length?'ok':'missing',items:qcItems,machines:uniq(qcItems.map(i=>i.machine)),actors:uniq(qcItems.map(i=>i.who)),result:qcItems.length?qcRes:''});
  // QR / thành phẩm
  const qrItems = qrs.map(p=>({ts:trTs(p.createdAt)||trTs(p.updatedAt), exact:!!(trTs(p.createdAt)||trTs(p.updatedAt)), who:p.operator||p.producer||'', machine:p.machine||'', lot:p.productCode?('SP '+p.productCode):'',
    detail:[p.qrCode, p.productName, (p.qcResult&&p.qcResult!=='pending')?('QC: '+p.qcResult):'CHƯA QC'].filter(Boolean).join(' · '), open:`openQrDetail('${String(p.id).replace(/'/g,'')}')`})).sort((a,b)=>a.ts-b.ts);
  stages.push({key:'qr',label:'Thành phẩm / QR',icon:'🏷️',status:qrItems.length?'ok':'missing',items:qrItems,machines:uniq(qrs.map(p=>p.machine)),actors:uniq(qrs.map(p=>p.operator||p.producer))});
  // Giao hàng
  stages.push({key:'delivery',label:'Giao hàng',icon:'🚚',status:(order&&order.delivered)?'ok':'missing',machines:[],actors:uniq([order&&order.deliveredBy]),
    items:(order&&order.delivered)?[{ts:trTs(order.deliveredAt),exact:!!trTs(order.deliveredAt),who:order.deliveredBy||'',machine:'',lot:'',detail:['Đã giao', order.exportSlipNo&&('Phiếu xuất '+order.exportSlipNo)].filter(Boolean).join(' · '),open:''}]:[]});
  const known = stages.filter(s=>s.status!=='nodata');
  return {orderId, order, stages, have:known.filter(s=>s.status==='ok').length, total:known.length};
}
