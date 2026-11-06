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
    db:     (typeof DB!=='undefined' && DB.mayDanhBongLog) || []
  };
}

// Tìm theo ô nhập: trả về {query, seeds, primary, material, related, gaps}
//  seeds    : các bản ghi khớp trực tiếp ô nhập (kèm lý do khớp)
//  primary  : đơn / QR / dòng sổ liên kết TRỰC TIẾP bằng khóa với seeds
//  material : lô nguyên liệu (Heat-Lot) liên quan + toàn bộ dòng sổ cùng lô
//  related  : đơn & dòng sổ KHÁC dùng chung lô → nguy cơ ảnh hưởng (1 bước, không lan rộng)
function trSearch(rawQuery, src){
  src = src || trSource();
  const query = trExtractQr(rawQuery);
  const qKey = trKey(query), qTxt = trText(query);
  const out = {query, seeds:{orders:[],qr:[],nl:[],rut:[],db:[]}, why:{}, primary:null, material:null, related:null, gaps:[]};
  if(!qKey) return out;

  const why = (k,id,reason)=>{ (out.why[k+':'+id] = out.why[k+':'+id] || []).push(reason); };
  const exactOrContains = (field, key) => { const f=trKey(field); return !!f && (f===key || (key.length>=3 && f.indexOf(key)>=0)); };
  const textHas = (field) => !!qTxt && qTxt.length>=2 && trText(field).indexOf(qTxt)>=0;
  const qSpec = trSpecQuery(query); // '' nếu ô nhập không có dạng quy cách

  // ── 1. SEEDS: khớp trực tiếp ───────────────────────────────────────
  src.orders.forEach(o=>{
    if(!o) return; const r=[];
    if(o.id && o.id===query) r.push('Mã đơn hàng (ID)');
    if(exactOrContains(o.po,qKey)) r.push('Mã PO khách hàng');
    if((o.matCodes||[]).some(c=>exactOrContains(c,qKey))) r.push('Mã nguyên liệu trên đơn');
    if(textHas(o.customer)) r.push('Tên khách hàng');
    if(textHas(o.type)) r.push('Quy cách sản phẩm');
    else if(qSpec && (trSpecHas(o.type,qSpec) || trSpecHas(trDimSpec(o),qSpec))) r.push('Quy cách sản phẩm');
    if(r.length){ out.seeds.orders.push(o); r.forEach(x=>why('order',o.id,x)); }
  });
  src.qr.forEach(p=>{
    if(!p) return; const r=[];
    if(exactOrContains(p.qrCode,qKey)) r.push('Mã QR');
    if(exactOrContains(p.productCode,qKey)) r.push('Mã sản phẩm / thành phẩm');
    if(qSpec && (trSpecHas(p.productName,qSpec) || trSpecHas(trDimSpec(p.spec),qSpec))) r.push('Quy cách sản phẩm');
    if(r.length){ out.seeds.qr.push(p); r.forEach(x=>why('qr',p.id,x)); }
  });
  [['nl',src.nl],['rut',src.rut],['db',src.db]].forEach(([k,arr])=>{
    arr.forEach(r0=>{
      if(!r0) return; const r=[];
      if(exactOrContains(r0.heatLot,qKey)) r.push('Mã lô nguyên liệu / Heat-Lot');
      if(exactOrContains(r0.maLoSX,qKey)) r.push('Mã lô sản xuất');
      if(qSpec && trSpecHas(r0.quyCach,qSpec)) r.push('Quy cách sản phẩm');
      if(r.length){ out.seeds[k].push(r0); r.forEach(x=>why(k,r0.id,x)); }
    });
  });

  // ── 2. PRIMARY: liên kết trực tiếp bằng KHÓA ───────────────────────
  const ordMap = new Map(src.orders.filter(Boolean).map(o=>[o.id,o]));
  const P = {orders:new Map(), qr:new Map(), nl:new Map(), rut:new Map(), db:new Map()};
  const addO = id => { if(id && ordMap.has(id)) P.orders.set(id, ordMap.get(id)); };
  out.seeds.orders.forEach(o=>addO(o.id));
  out.seeds.qr.forEach(p=>{ P.qr.set(p.id,p); addO(p.orderId); });
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

  out.primary = {
    orders:[...P.orders.values()], qr:[...P.qr.values()],
    nl:[...P.nl.values()], rut:[...P.rut.values()], db:[...P.db.values()]
  };
  out.material = {heatLots:[...heatLots], lotsSX:[...lotsSX], nl:M.nl};
  out.related  = {orders:[...R.orders.values()], nl:R.nl.filter(r=>!P.nl.has(r.id)), rut:R.rut, db:R.db};

  // ── 4. GAPS: nói rõ chỗ nào thiếu khóa (không đoán) ────────────────
  out.primary.orders.forEach(o=>{
    const nO = ['nl','rut','db'].reduce((s,k)=>s+[...P[k].values()].filter(r=>r.donHangId===o.id).length,0);
    if(!nO) out.gaps.push({orderId:o.id, code:'NO_LEDGER_LINK',
      text:'Chưa có dòng nào ở 3 sổ liên kết với đơn này bằng ID đơn. Có thể dòng chưa gắn đơn, hoặc đã bị tự động dọn (sổ >32 ngày) — đối chiếu file Excel đã xuất.'});
    if(!src.qr.some(p=>p && p.orderId===o.id)) out.gaps.push({orderId:o.id, code:'NO_QR', text:'Đơn chưa có mã QR / thành phẩm nào.'});
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
