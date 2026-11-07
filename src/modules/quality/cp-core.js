// src/modules/quality/cp-core.js — PHÂN HỆ CONTROLPLAN (Chất lượng QC): LÕI DỮ LIỆU
// ─────────────────────────────────────────────────────────────────────────────
// • Dữ liệu: DB.cpRecords[] — MỘT mảng bản ghi, phân loại bằng `type`:
//     chk (phiếu kiểm tra: dun|rut|danhbong|cat|dothang) · fqc · ncr · hold · eightd
//     cp (Control Plan) · pfmea · defect (mã lỗi) · aql (bảng tra) · importLog (nhật ký nhập Excel)
// • Đồng bộ: từng bản ghi tại Firebase /data/cpRecords/{id} (cùng nhánh /data như mọi dữ liệu khác nên
//   dùng đúng Rules/xác thực hiện có). Ghi theo HÀNG ĐỢI lưu bền trong localStorage → mất mạng vẫn lưu,
//   tự thử lại (online / 30s / lần mở app), hiển thị "chưa đồng bộ". Không bao giờ ghi đè cả nhánh.
// • Không đụng DB/lsSave của app: bộ nhớ cục bộ dùng khoá riêng sx_cp_v1.
// • Chỉ GẮN THÊM vào đồng bộ hiện có qua 3 điểm móc nhỏ (cpOnBoot / cpOnSnapshot / cpOnRealtime).
// ─────────────────────────────────────────────────────────────────────────────

const CP_LS = 'sx_cp_v1', CP_QK = 'sx_cp_q_v1', CP_CONFK = 'sx_cp_conf_v1';
const CP_PATH = '/data/cpRecords';

// ── Danh mục biểu mẫu (13 mục nghiệp vụ) ───────────────────────────────────────
const CP_STAGE_LABEL = {dun:'Đùn', rut:'Rút', danhbong:'Đánh bóng', cat:'Cắt', dothang:'Độ thẳng', fqc:'FQC'};
const CP_FORM_PREFIX = {dun:'DUN', rut:'RUT', danhbong:'DB', cat:'CAT', dothang:'DT'};
const CP_GROUPS = [
  {key:'A', title:'NHÓM A – QUẢN LÝ TIÊU CHUẨN', color:'#2563EB'},
  {key:'B', title:'NHÓM B – KIỂM TRA TRONG QUÁ TRÌNH', color:'#0D9488'},
  {key:'C', title:'NHÓM C – KIỂM TRA THÀNH PHẨM', color:'#7C3AED'},
  {key:'D', title:'NHÓM D – XỬ LÝ SẢN PHẨM KHÔNG PHÙ HỢP', color:'#DC2626'}
];
// kind: master = bảng danh mục (không "phiếu"); form = có phiếu
const CP_FORMS = [
  {no:1,  g:'A', key:'cp',      kind:'cp',      icon:'📐', title:'Control Plan – Kế hoạch kiểm soát', code:'CP', desc:'Đặc tính, tiêu chuẩn, thiết bị, cỡ mẫu, tần suất, phản ứng khi NG. Bấm biểu mẫu để mở đúng Check Sheet.'},
  {no:2,  g:'A', key:'pfmea',   kind:'pfmea',   icon:'⚠️', title:'PFMEA – Phân tích rủi ro quá trình', code:'PFMEA', desc:'Dạng lỗi tiềm ẩn, S–O–D, RPN tự tính, hành động khắc phục và người phụ trách.'},
  {no:3,  g:'A', key:'aql',     kind:'aql',     icon:'🧮', title:'AQL – Cỡ mẫu & tiêu chí chấp nhận', code:'ISO 2859-1', desc:'Tra Code, cỡ mẫu, Ac/Re theo quy mô lô và mức AQL (bảng tham khảo của công ty).'},
  {no:4,  g:'A', key:'defects', kind:'defect',  icon:'🔎', title:'Danh mục mã lỗi ngoại quan', code:'QA-QC-VS-001', desc:'OK, NG-01 … NG-12: tên lỗi, tiêu chuẩn đạt, phản ứng khi NG.'},
  {no:5,  g:'B', key:'dothang', kind:'form',    icon:'📏', title:'Kiểm tra độ thẳng', code:'', desc:'Độ thẳng cạnh/mặt, độ vểnh, độ vặn theo tiêu chuẩn 0,50–1mm.'},
  {no:6,  g:'B', key:'dun',     kind:'form',    icon:'🔧', title:'Check Sheet công đoạn Đùn', code:'FR-EX-01 · SOP-01', desc:'Dày, rộng, ngoại quan theo từng mẫu; liên kết đơn hàng & lô.'},
  {no:7,  g:'B', key:'rut',     kind:'form',    icon:'🔩', title:'Check Sheet công đoạn Rút', code:'FR-RU-01 · SOP-02', desc:'Dày, rộng, dài, ngoại quan; liên kết sổ máy Rút.'},
  {no:8,  g:'B', key:'danhbong',kind:'form',    icon:'✨', title:'Check Sheet công đoạn Đánh bóng', code:'FR-PO-01 · SOP-03', desc:'Kích thước và ngoại quan sau đánh bóng; liên kết sổ máy Đánh bóng.'},
  {no:9,  g:'B', key:'cat',     kind:'form',    icon:'✂️', title:'Check Sheet công đoạn Cắt', code:'FR-CT-01 · SOP-04', desc:'Dài, dày, rộng, bavia/ngoại quan; liên kết công đoạn Cắt.'},
  {no:10, g:'C', key:'fqc',     kind:'form',    icon:'✅', title:'FQC – Kiểm tra thành phẩm theo AQL', code:'FR-FQC-01 · SOP-05', desc:'Tự tra AQL, tự kết luận lô theo số lỗi Major/Minor/Critical.'},
  {no:11, g:'D', key:'ncr',     kind:'form',    icon:'📝', title:'NCR – Báo cáo sản phẩm không phù hợp', code:'NCR', desc:'Số NCR tự động, hành động ngăn chặn/khắc phục, QA phê duyệt.'},
  {no:12, g:'D', key:'hold',    kind:'form',    icon:'🛑', title:'HOLD / RELEASE – Cách ly & giải phóng lô', code:'HOLD', desc:'HOLD → Đang điều tra → Chờ phê duyệt → RELEASE / Phế phẩm. Chỉ QA được Release.'},
  {no:13, g:'D', key:'eightd',  kind:'form',    icon:'🧩', title:'8D – Nguyên nhân & hành động khắc phục', code:'8D', desc:'D0–D8: người phụ trách, hạn, bằng chứng, trạng thái từng bước.'}
];
function cpFormDef(key){ return CP_FORMS.find(f=>f.key===key); }
// biểu mẫu → loại bản ghi
const CP_TYPE_OF_FORM = {dun:'chk', rut:'chk', danhbong:'chk', cat:'chk', dothang:'chk', fqc:'fqc', ncr:'ncr', hold:'hold', eightd:'eightd'};
// máy theo công đoạn (dùng đúng MACHINES / ASSIGN_STAGES hiện có)
const CP_STAGE_GROUP = {dun:'Máy đùn', rut:'Máy rút', danhbong:'Máy đánh bóng', cat:'Máy cắt'};
function cpMachinesFor(form){ const g=CP_STAGE_GROUP[form]; return (typeof MACHINES!=='undefined' && g) ? MACHINES.filter(m=>m.group===g).map(m=>m.name) : []; }

// ── Tiện ích ──────────────────────────────────────────────────────────────────
function cpH(s){ return s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function cpNorm(s){ return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/\s+/g,''); }
function cpYmd(d){ d=d||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function cpToday(){ return cpYmd(new Date()); }
function cpHm(d){ d=d||new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function cpFmtDate(iso){ if(!iso) return '—'; const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m? m[3]+'/'+m[2]+'/'+m[1] : String(iso); }
function cpFmtTs(ts){ if(!ts) return '—'; const d=new Date(ts); return cpFmtDate(cpYmd(d))+' '+cpHm(d); }
function cpUid(p){ return (p||'cp')+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function cpNum(v){ if(v===''||v==null) return null; const n=Number(String(v).replace(',','.')); return isFinite(n)?n:null; }
function cpActor(){ return currentUser ? (currentUser.name||currentUser.username||currentUser.id) : 'system'; }
function cpClone(o){ return JSON.parse(JSON.stringify(o)); }

// ── Phân quyền ControlPlan ────────────────────────────────────────────────────
// Dùng vai trò sẵn có của app: admin → quản trị; staff + qcRole (do Admin gán trong ControlPlan ▸ Phân quyền)
// → qc | lead | qa; staff không có qcRole → prod (chỉ xem); viewer/solieu → view.
const CP_ROLE_LABEL = {admin:'Quản trị viên', qa:'QA / Quản lý chất lượng', lead:'Trưởng QC', qc:'Nhân viên QC', prod:'Nhân viên sản xuất (xem)', view:'Chỉ xem', none:'—'};
function cpRole(){
  const u=currentUser; if(!u) return 'none';
  if(u.role==='admin') return 'admin';
  if(u.role==='staff') return ['qc','lead','qa'].indexOf(u.qcRole)>=0 ? u.qcRole : 'prod';
  return 'view';
}
const CP_PERM = {
  create:   ['admin','qa','lead','qc'],      // tạo phiếu kiểm tra / NCR / HOLD / 8D
  editAny:  ['admin','qa','lead'],            // sửa phiếu của người khác / phiếu đã hoàn tất (có lý do + nhật ký)
  review:   ['admin','qa','lead'],            // xử lý dữ liệu "cần kiểm tra"
  master:   ['admin','qa','lead'],            // sửa Control Plan / PFMEA
  config:   ['admin'],                        // danh mục mã lỗi, phân quyền, nhập Excel
  investigate:['admin','qa','lead','qc'],     // HOLD: bắt đầu điều tra / gửi phê duyệt
  approve:  ['admin','qa'],                   // RELEASE / Phế phẩm / duyệt NCR / đóng 8D
  verify:   ['admin','qa','lead']             // xác nhận hiệu lực NCR
};
function cpCan(action, rec){
  const r=cpRole(); if(!(CP_PERM[action]||[]).includes(r)) return false;
  if(action==='create' && isViewer()) return false;
  return true;
}
// sửa 1 bản ghi: tác giả sửa được BẢN NHÁP của mình; phiếu đã hoàn tất/bản của người khác cần quyền editAny
function cpCanEdit(rec){
  if(!rec || rec.void) return false;
  if(cpCan('editAny')) return true;
  if(!cpCan('create')) return false;
  return rec.status==='draft' && rec.createdById===(currentUser&&currentUser.id);
}
function cpGuard(action, msg){
  if(cpCan(action)) return false;
  showToast('🔒 '+(msg||'Tài khoản của bạn không có quyền thực hiện thao tác này'), true);
  return true;
}

// ── Kho dữ liệu cục bộ + hàng đợi đồng bộ ─────────────────────────────────────
let _cpIdx = null, _cpQ = {}, _cpTimer = null, _cpFlushing = false, _cpFails = 0, _cpLastErr = '', _cpLastOk = 0, _cpSaveTimer = null;
function cpRecs(){ return DB.cpRecords || (DB.cpRecords=[]); }
function cpIndex(){ if(!_cpIdx){ _cpIdx=new Map(); cpRecs().forEach(r=>{ if(r&&r.id) _cpIdx.set(r.id,r); }); } return _cpIdx; }
function cpGet(id){ return cpIndex().get(id); }
function cpOf(type, pred){ const out=[]; cpRecs().forEach(r=>{ if(r && r.type===type && !r.void && (!pred||pred(r))) out.push(r); }); return out; }

function cpLoadLocal(){
  try{ const a=JSON.parse(localStorage.getItem(CP_LS)||'[]'); if(Array.isArray(a)) DB.cpRecords=a; }catch(e){ DB.cpRecords=DB.cpRecords||[]; }
  try{ _cpQ=JSON.parse(localStorage.getItem(CP_QK)||'{}')||{}; }catch(e){ _cpQ={}; }
  _cpIdx=null;
}
function cpSaveLocalNow(){
  try{ localStorage.setItem(CP_LS, JSON.stringify(cpRecs())); }catch(e){
    if(!cpSaveLocalNow._warned){ cpSaveLocalNow._warned=true; showToast('⚠️ Bộ nhớ thiết bị đầy — dữ liệu ControlPlan vẫn đồng bộ lên máy chủ nhưng không lưu đệm được', true); }
  }
}
function cpSaveLocal(){ clearTimeout(_cpSaveTimer); _cpSaveTimer=setTimeout(cpSaveLocalNow, 120); }
function cpSaveQueue(){ try{ localStorage.setItem(CP_QK, JSON.stringify(_cpQ)); }catch(e){} }
function cpPending(){ return Object.keys(_cpQ).length; }
cpLoadLocal();

function cpStrip(rec){ const o={}; Object.keys(rec).forEach(k=>{ if(k[0]!=='_') o[k]=rec[k]; }); return o; }

// Lưu 1 bản ghi (thêm/sửa). meta: {act, reason, changes[]} → ghi vào hist (nhật ký của chính phiếu) và nhật ký app.
function cpPut(rec, meta){
  meta = meta || {};
  const now = Date.now(), old = cpGet(rec.id), isNew = !old;
  if(!rec.createdAt){ rec.createdAt=now; rec.createdBy=cpActor(); rec.createdById=currentUser&&currentUser.id; }
  const baseRev = isNew ? 0 : (old.rev||0);
  rec.rev = (rec.rev||0) + 1;
  rec.updatedAt = now; rec.updatedBy = cpActor();
  if(meta.act){
    rec.hist = (rec.hist||[]).concat([{ts:now, by:cpActor(), role:cpRole(), act:meta.act, reason:meta.reason||'', ch:(meta.changes||[]).slice(0,14)}]).slice(-40);
  }
  const arr = cpRecs(), i = arr.findIndex(r=>r.id===rec.id);
  if(i>=0) arr[i]=rec; else arr.push(rec);
  _cpIdx=null;
  const q=_cpQ[rec.id]; _cpQ[rec.id]={op:'put', base: q ? q.base : baseRev};
  cpSaveLocal(); cpSaveQueue(); cpScheduleFlush(300);
  try{ if(meta.act && typeof log==='function') log('ControlPlan · '+meta.act, (cpFormLabelOf(rec)+' '+(rec.code||rec.id)+(meta.reason?' — '+meta.reason:'')), rec.orderId||''); }catch(e){}
  cpSyncBadge();
  return rec;
}
// Thêm nhiều bản ghi mới (nhập Excel): không ghi nhật ký từng dòng
function cpPutMany(list){
  const arr=cpRecs(); const now=Date.now();
  list.forEach(rec=>{
    rec.rev = rec.rev||1; rec.updatedAt = rec.updatedAt||now;
    arr.push(rec); _cpQ[rec.id]={op:'put', base:0};
  });
  _cpIdx=null; cpSaveLocalNow(); cpSaveQueue(); cpScheduleFlush(200); cpSyncBadge();
}
// Xoá cứng CHỈ cho bản nháp chưa hoàn tất (phiếu đã hoàn tất thì "huỷ" bằng void + lý do)
function cpDeleteDraft(id){
  const r=cpGet(id); if(!r || r.status!=='draft') return false;
  cpRecs().splice(cpRecs().findIndex(x=>x.id===id),1); _cpIdx=null;
  const q=_cpQ[id]; if(q && q.base===0) delete _cpQ[id]; else _cpQ[id]={op:'del'};
  cpSaveLocal(); cpSaveQueue(); cpScheduleFlush(300); cpSyncBadge();
  try{ log('ControlPlan · Xoá bản nháp', (r.code||id), ''); }catch(e){}
  return true;
}

function cpScheduleFlush(ms){ clearTimeout(_cpTimer); _cpTimer=setTimeout(cpFlush, ms==null?1000:ms); }
async function cpFlush(){
  if(_cpFlushing) return;
  const ids=Object.keys(_cpQ);
  if(!ids.length){ cpSyncBadge(); return; }
  if(typeof fbOk==='function' && !fbOk()){ cpSyncBadge(); return; }       // chế độ không có Firebase: chỉ lưu máy này
  if(typeof navigator!=='undefined' && navigator.onLine===false){ cpSyncBadge(); return; }
  _cpFlushing=true; if(typeof beginSave==='function') beginSave();
  try{
    if(typeof setSyncDot==='function') setSyncDot('saving');
    const fresh=[], edits=[], dels=[];
    ids.forEach(id=>{ const q=_cpQ[id]; if(q.op==='del') dels.push(id); else if(!cpGet(id)) delete _cpQ[id]; else if((q.base||0)===0) fresh.push(id); else edits.push(id); });
    for(let i=0;i<fresh.length;i+=100){        // bản ghi MỚI: ghi theo lô qua PATCH (chỉ thêm khoá con, không đụng các bản ghi khác)
      const chunk=fresh.slice(i,i+100), body={}; chunk.forEach(id=>{ body[id]=cpStrip(cpGet(id)); });
      await fbWrite(CP_PATH, body, 'PATCH'); chunk.forEach(id=>{ delete _cpQ[id]; }); cpSaveQueue();
    }
    for(const id of edits){                    // bản ghi SỬA: kiểm tra không ai sửa trước (tránh ghi đè âm thầm)
      const q=_cpQ[id], srv=await fbRead(CP_PATH+'/'+id);
      if(srv && (srv.rev||0) > (q.base||0)){ cpConflict(id, srv); delete _cpQ[id]; cpSaveQueue(); continue; }
      await fbWrite(CP_PATH+'/'+id, cpStrip(cpGet(id)), 'PUT'); delete _cpQ[id]; cpSaveQueue();
    }
    for(const id of dels){ await fbWrite(CP_PATH+'/'+id, null, 'DELETE'); delete _cpQ[id]; cpSaveQueue(); }
    _cpFails=0; _cpLastErr=''; _cpLastOk=Date.now();
    if(typeof setSyncDot==='function') setSyncDot('ok');
  }catch(e){
    _cpFails++; _cpLastErr=(e&&e.message)||'lỗi mạng';
    if(typeof setSyncDot==='function') setSyncDot('error');
    cpScheduleFlush(Math.min(60000, 4000*Math.pow(2,Math.min(_cpFails,4))));   // thử lại, giãn dần tới 60s
  }finally{
    _cpFlushing=false; if(typeof endSave==='function') endSave(); cpSyncBadge();
    if(Object.keys(_cpQ).length && !_cpFails) cpScheduleFlush(500);
  }
}
// Xung đột: người khác đã sửa phiếu trong lúc mình sửa → giữ bản của họ, cất bản của mình để QA/Trưởng QC xem lại
function cpConflict(id, serverRec){
  const mine=cpGet(id); let list=[]; try{ list=JSON.parse(localStorage.getItem(CP_CONFK)||'[]'); }catch(e){}
  if(mine) list.push({id, ts:Date.now(), by:cpActor(), mine:cpStrip(mine)});
  try{ localStorage.setItem(CP_CONFK, JSON.stringify(list.slice(-30))); }catch(e){}
  const arr=cpRecs(), i=arr.findIndex(r=>r.id===id); if(i>=0) arr[i]=serverRec; else arr.push(serverRec); _cpIdx=null; cpSaveLocal();
  showToast('⚠️ Phiếu '+(serverRec.code||id)+' vừa được người khác sửa — đã giữ bản mới nhất, bản của bạn được cất ở mục Xung đột đồng bộ', true);
}
function cpConflicts(){ try{ return JSON.parse(localStorage.getItem(CP_CONFK)||'[]'); }catch(e){ return []; } }
function cpConflictDiscard(i){ const l=cpConflicts(); l.splice(i,1); try{ localStorage.setItem(CP_CONFK, JSON.stringify(l)); }catch(e){} }
function cpConflictRestore(i){
  const l=cpConflicts(), c=l[i]; if(!c) return;
  const cur=cpGet(c.id), rec=Object.assign({}, c.mine, {rev:cur?cur.rev:c.mine.rev, hist:cur?cur.hist:c.mine.hist});
  cpPut(rec,{act:'Khôi phục bản sửa bị xung đột', reason:'Người dùng chọn giữ bản của mình'}); cpConflictDiscard(i);
}

// ── Móc vào đồng bộ hiện có ───────────────────────────────────────────────────
function cpApplyRemote(id, val){
  if(!id || _cpQ[id]) return false;                    // bản cục bộ đang chờ gửi → ưu tiên bản cục bộ
  const arr=cpRecs(), i=arr.findIndex(r=>r&&r.id===id);
  if(val==null){ if(i>=0){ arr.splice(i,1); _cpIdx=null; return true; } return false; }
  if(i<0){ arr.push(val); _cpIdx=null; return true; }
  if((val.rev||0) >= (arr[i].rev||0) && (val.updatedAt||0)!==(arr[i].updatedAt||0)){ arr[i]=val; _cpIdx=null; return true; }
  return false;
}
function cpOnSnapshot(raw){
  if(!raw) return false;
  const list = Array.isArray(raw)?raw:Object.values(raw); let ch=false;
  list.forEach(r=>{ if(r && r.id && cpApplyRemote(r.id, r)) ch=true; });
  if(ch){ cpSaveLocal(); }
  return ch;
}
function cpOnBoot(raw){ try{ cpOnSnapshot(raw); }catch(e){} cpScheduleFlush(1500); cpSyncBadge(); }
function cpOnRealtime(path, val){
  const rest = path.slice(CP_PATH.length).replace(/^\//,'');
  let ch=false;
  if(!rest) ch=cpOnSnapshot(val);
  else if(rest.indexOf('/')<0){ ch=cpApplyRemote(rest, val); if(ch) cpSaveLocal(); }
  if(ch) cpRefreshUI();
}
window.addEventListener('online', ()=>cpScheduleFlush(500));
setInterval(()=>{ if(cpPending() && !_cpFlushing) cpFlush(); }, 30000);

function cpSyncInfo(){
  const n=cpPending();
  if(!n) return {cls:'ok', text:'✓ Đã đồng bộ', n:0};
  if(typeof navigator!=='undefined' && navigator.onLine===false) return {cls:'warn', text:'📴 Mất mạng — '+n+' mục chờ đồng bộ', n};
  if(_cpFails) return {cls:'err', text:'⚠ Lỗi đồng bộ — '+n+' mục chờ gửi lại', n};
  return {cls:'warn', text:'⏳ Đang đồng bộ '+n+' mục…', n};
}
function cpSyncBadge(){
  const el=document.getElementById('cpSyncBadge'); if(!el) return;
  const i=cpSyncInfo(); el.className='cp-sync '+i.cls; el.textContent=i.text; el.title=_cpLastErr?('Lỗi gần nhất: '+_cpLastErr):(_cpLastOk?('Đồng bộ lần cuối '+cpFmtTs(_cpLastOk)):'');
}
function cpRefreshUI(){ if(typeof currentTab!=='undefined' && currentTab==='controlPlan' && typeof renderControlPlan==='function') renderControlPlan(); }

// ── Mã phiếu tự động ──────────────────────────────────────────────────────────
function cpNextCode(prefix){
  let max=0; const re=new RegExp('^'+prefix.replace(/[-]/g,'\\-')+'(\\d+)$');
  cpRecs().forEach(r=>{ const m=r && r.code && String(r.code).match(re); if(m) max=Math.max(max, +m[1]); });
  return prefix+String(max+1).padStart(3,'0');
}
function cpNewCode(type, form, dateIso){
  const ymd=(dateIso||cpToday()).replace(/-/g,'').slice(2), yr=(dateIso||cpToday()).slice(0,4);
  if(type==='chk') return cpNextCode((CP_FORM_PREFIX[form]||'KT')+'-'+ymd+'-');
  if(type==='fqc') return cpNextCode('FQC-'+ymd+'-');
  if(type==='ncr') return cpNextCode('NCR-'+yr+'-');
  if(type==='hold') return cpNextCode('HOLD-'+yr+'-');
  if(type==='eightd') return cpNextCode('8D-'+yr+'-');
  return cpNextCode('CP-');
}
function cpFormLabelOf(r){
  if(!r) return '';
  if(r.type==='chk') return 'Phiếu '+(CP_STAGE_LABEL[r.form]||r.form);
  return {fqc:'Phiếu FQC', ncr:'NCR', hold:'HOLD', eightd:'8D', cp:'Control Plan', pfmea:'PFMEA', defect:'Mã lỗi', aql:'AQL'}[r.type] || r.type;
}

// ── Danh mục chuẩn: dùng bản ghi trong DB nếu đã nhập, chưa có thì dùng seed (cp-seed.js) ──
function cpSeed(){ return (typeof CP_SEED!=='undefined') ? CP_SEED : {controlPlan:[],pfmea:[],defects:[],aql:null,eightD:[],toc:{items:[]}}; }
function cpMasterList(type, seedKey){
  const own=cpOf(type);
  if(own.length) return own;
  return (cpSeed()[seedKey]||[]).map(r=>Object.assign({_seed:1}, r));
}
function cpDefects(){
  const l=cpMasterList('defect','defects').slice();
  l.sort((a,b)=> a.code==='OK' ? -1 : b.code==='OK' ? 1 : String(a.code).localeCompare(String(b.code), 'en', {numeric:true}));
  return l;
}
function cpDefect(code){ return cpDefects().find(d=>d.code===code) || null; }
function cpControlPlan(){ return cpMasterList('cp','controlPlan').slice().sort((a,b)=>(a.no||0)-(b.no||0)); }
function cpPfmea(){ return cpMasterList('pfmea','pfmea').slice().sort((a,b)=>(a.no||0)-(b.no||0)); }
function cpRpn(p){ return (p.S&&p.O&&p.D) ? p.S*p.O*p.D : null; }
function cpAqlRec(){ const own=cpOf('aql'); return own[0] || (cpSeed().aql ? Object.assign({_seed:1}, cpSeed().aql) : null); }
function cpControlPlanForStage(form){
  const label={dun:'Đùn',rut:'Rút',danhbong:'Đánh bóng',cat:'Cắt',fqc:'FQC'}[form]; if(!label) return [];
  return cpControlPlan().filter(r=>r.stage===label);
}

// ── AQL: tra bảng đã duyệt (không suy diễn) ───────────────────────────────────
const CP_AQL_WARN = 'Bảng AQL là bảng RÚT GỌN tham khảo theo tiêu chuẩn công ty áp dụng (ISO 2859-1, Normal, Single Sampling). Phần mềm KHÔNG áp dụng quy tắc mũi tên/chuyển cỡ mẫu — cần đối chiếu bản tiêu chuẩn được duyệt khi có tranh chấp.';
function cpAqlRange(txt){
  const t=String(txt).replace(/,/g,'').replace(/\s/g,'');
  let m=t.match(/^(\d+)[–-](\d+)$/); if(m) return [+m[1], +m[2]];
  m=t.match(/^(\d+)\+$/); if(m) return [+m[1], Infinity];
  return null;
}
function cpAqlLookup(lotSize, level, aqlMajor, aqlMinor, aqlCritical){
  const T=cpAqlRec(); const out={ok:false, errors:[], warnings:[CP_AQL_WARN]};
  if(!T){ out.errors.push('Chưa có bảng AQL'); return out; }
  const lot=Math.floor(Number(lotSize));
  if(!lot || lot<1){ out.errors.push('Nhập số lượng lô (số nguyên ≥ 1)'); return out; }
  if(String(level||'II')!=='II'){ out.errors.push('Workbook chỉ có bảng cho Level II — Level "'+level+'" chưa có bảng được duyệt, không tự suy diễn'); return out; }
  const row=T.codes.find(c=>{ const r=cpAqlRange(c.range); return r && lot>=r[0] && lot<=r[1]; });
  if(!row){ out.errors.push('Quy mô lô '+lot+' nằm ngoài các khoảng trong bảng AQL (bắt đầu từ 2)'); return out; }
  out.code=row.code; out.n=row.n; out.range=row.range; out.level='II';
  const pick=(aql)=>{
    if(aql===''||aql==null) return null;
    const v=T.table[row.code] && T.table[row.code][String(aql)];
    if(!v) return {aql:String(aql), err:'Mức AQL '+aql+' không có trong bảng'};
    const [ac,re]=v.split('/').map(Number); return {aql:String(aql), ac, re};
  };
  out.major=pick(aqlMajor); out.minor=pick(aqlMinor); out.critical=pick(aqlCritical);
  [out.major,out.minor,out.critical].forEach(x=>{ if(x&&x.err) out.errors.push(x.err); });
  if(!out.major && !out.minor) out.errors.push('Chọn ít nhất AQL Major hoặc AQL Minor');
  if(out.n>lot) out.warnings.push('Cỡ mẫu ('+out.n+') lớn hơn quy mô lô ('+lot+') — kiểm 100%');
  out.ok = !out.errors.length;
  return out;
}
// Kết luận lô theo số lỗi. Critical: nếu KHÔNG chọn AQL Critical → không chấp nhận lỗi Critical nào (quy tắc an toàn của phần mềm, bảng AQL không có).
function cpAqlEvaluate(lk, majorNG, minorNG, criticalNG){
  if(!lk || !lk.ok) return {result:'UNK', reasons:['Chưa tra được AQL']};
  const reasons=[]; let ng=false; const m=+majorNG||0, n=+minorNG||0, c=+criticalNG||0;
  if(lk.major){ if(m>=lk.major.re || m>lk.major.ac){ ng=true; reasons.push('Major '+m+' > Ac '+lk.major.ac); } }
  if(lk.minor){ if(n>=lk.minor.re || n>lk.minor.ac){ ng=true; reasons.push('Minor '+n+' > Ac '+lk.minor.ac); } }
  if(lk.critical){ if(c>lk.critical.ac){ ng=true; reasons.push('Critical '+c+' > Ac '+lk.critical.ac); } }
  else if(c>0){ ng=true; reasons.push('Có '+c+' lỗi Critical (không chấp nhận)'); }
  return {result: ng?'NG':'OK', reasons};
}

// ── Kết luận phiếu ────────────────────────────────────────────────────────────
function cpCalcResult(rec){
  if(rec.type==='fqc') return rec.result||'UNK';
  const ls=rec.lines||[]; if(!ls.length) return 'UNK';
  if(ls.some(l=>l.result==='NG')) return 'NG';
  if(ls.some(l=>l.result!=='OK')) return 'UNK';
  return 'OK';
}
const CP_RES = {OK:{t:'OK', c:'ok'}, NG:{t:'NG', c:'ng'}, UNK:{t:'Chưa xác định', c:'unk'}};

// ── Liên kết dữ liệu hiện có (đơn hàng / sổ máy / QR) — CHỈ theo khoá, không ghép theo tên ──
function cpOrderLabel(o){ return (typeof ddCode==='function'?ddCode(o):(o.po||o.id))+' · '+(o.customer||'—')+' · '+(typeof specStr==='function'?specStr(o):(o.type||'')); }
function cpOrders(){ return (DB.orders||[]).filter(o=>o && o.id); }
function cpOrderById(id){ return cpOrders().find(o=>o.id===id) || null; }
function cpLedgerFor(form){
  if(form==='dun') return {field:'nguyenLieuLog', label:'Sổ nguyên liệu/đùn', rows:DB.nguyenLieuLog||[]};
  if(form==='rut') return {field:'mayRutLog', label:'Sổ máy Rút', rows:DB.mayRutLog||[]};
  if(form==='danhbong') return {field:'mayDanhBongLog', label:'Sổ máy Đánh bóng', rows:(DB.mayDanhBongLog||[]).filter(r=>cpNorm(r.congDoan).indexOf('cat')<0)};
  if(form==='cat') return {field:'mayDanhBongLog', label:'Sổ máy Cắt', rows:(DB.mayDanhBongLog||[]).filter(r=>cpNorm(r.congDoan).indexOf('cat')>=0)};
  return {field:'', label:'', rows:[]};
}
// các lô đã ghi trong sổ cho 1 đơn
function cpLotsForOrder(orderId, form){
  if(!orderId) return [];
  const led=cpLedgerFor(form), seen=new Set(), out=[];
  led.rows.forEach(r=>{
    if(!r || r.donHangId!==orderId) return;
    const lot=(r.maLoSX||'').trim() || (form==='dun' ? (r.heatLot||'').trim() : '');
    if(!lot || seen.has(lot)) return; seen.add(lot);
    out.push({lot, heatLot:r.heatLot||'', machine:r.may||'', ledgerField:led.field, ledgerId:r.id, spec:r.quyCach||''});
  });
  return out;
}
function cpProductsForOrder(orderId){
  if(!orderId) return [];
  return (DB.qrProducts||[]).filter(p=>p && p.orderId===orderId && p.productCode).map(p=>({code:p.productCode, qrId:p.id, name:p.productName||''}));
}
// Quét/nhập 1 mã bất kỳ → tìm theo KHOÁ: id đơn, PO, mã QR, mã SP, mã lô SX, Heat-Lot
function cpResolveCode(raw){
  let q=String(raw||'').trim(); if(!q) return null;
  const m=q.match(/[?&]qr=([^&#\s]+)/i); if(m){ try{ q=decodeURIComponent(m[1]); }catch(e){ q=m[1]; } }
  const k=cpNorm(q); const hit={orderId:'', productCode:'', qrId:'', lot:'', heatLot:'', machine:'', via:''};
  const o=cpOrders().find(o=>o.id===q || cpNorm(o.po)===k); if(o){ hit.orderId=o.id; hit.via='Mã đơn/PO'; }
  const p=(DB.qrProducts||[]).find(p=>p && (cpNorm(p.qrCode)===k || (p.productCode && cpNorm(p.productCode)===k)));
  if(p){ hit.qrId=p.id; hit.productCode=p.productCode||''; if(!hit.orderId) hit.orderId=p.orderId||''; hit.via=hit.via||'Mã QR/Mã SP'; }
  ['nguyenLieuLog','mayRutLog','mayDanhBongLog'].forEach(f=>{
    (DB[f]||[]).forEach(r=>{ if(!r || hit.lot) return;
      if(r.maLoSX && cpNorm(r.maLoSX)===k){ hit.lot=r.maLoSX; hit.machine=r.may||''; if(!hit.orderId) hit.orderId=r.donHangId||''; hit.via='Mã lô SX'; }
      else if(r.heatLot && cpNorm(r.heatLot)===k){ hit.heatLot=r.heatLot; hit.lot=r.maLoSX||''; if(!hit.orderId) hit.orderId=r.donHangId||''; hit.via='Heat-Lot'; }
    });
  });
  return hit.via ? hit : null;
}
function cpLinkStatus(r){
  if(r.orderId && (r.lot||r.lotSX)) return {t:'ĐÃ LIÊN KẾT', c:'ok'};
  if(r.orderId) return {t:'Có đơn – thiếu lô', c:'warn'};
  return {t:'CHƯA XÁC ĐỊNH', c:'unk'};
}

// ── Chuẩn hoá tên để gom thống kê (không sửa dữ liệu gốc) ─────────────────────
const CP_CUST_ALIAS = {'kho miem nam':'kho mien nam', 'intetel':'intel'};   // lỗi chính tả hiển nhiên đã báo trong báo cáo nhập
function cpCustKey(s){
  let k=String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/\s+/g,' ').trim();
  if(CP_CUST_ALIAS[k]) k=CP_CUST_ALIAS[k];
  return k.replace(/\s+/g,'');
}
let _cpCanon=null, _cpCanonN=-1;
function cpCustCanon(){
  const n=cpRecs().length; if(_cpCanon && _cpCanonN===n) return _cpCanon;
  const cnt={}; cpRecs().forEach(r=>{ if(r && r.customer){ const k=cpCustKey(r.customer); (cnt[k]=cnt[k]||{})[r.customer.trim()]=(cnt[k][r.customer.trim()]||0)+1; } });
  const m={}; Object.keys(cnt).forEach(k=>{ m[k]=Object.keys(cnt[k]).sort((a,b)=>cnt[k][b]-cnt[k][a])[0]; });
  _cpCanon=m; _cpCanonN=n; return m;
}
function cpCust(r){ if(!r||!r.customer) return ''; return cpCustCanon()[cpCustKey(r.customer)] || r.customer; }
function cpSpecKey(s){ return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[φϕø⌀]/g,'phi').replace(/[×✕✖*·]/g,'x').replace(/(\d),(\d)/g,'$1.$2').replace(/mm|cm/g,'').replace(/[^a-z0-9.]/g,''); }

// ── Lọc + KPI ─────────────────────────────────────────────────────────────────
const CP_FILTER0 = {from:'', to:'', stage:'', qc:'', customer:'', order:'', product:'', lot:'', result:'', source:''};
function cpIsInspection(r){ return r && (r.type==='chk' || r.type==='fqc'); }
function cpMatch(r, F){
  if(!r) return false;
  const d=r.date||(r.createdAt?cpYmd(new Date(r.createdAt)):'');
  if(F.from && (!d || d<F.from)) return false;
  if(F.to && (!d || d>F.to)) return false;
  if(F.stage){ const st=r.type==='chk'?r.form:(r.type==='fqc'?'fqc':(r.stage||'')); if(st!==F.stage && !(r.type==='hold'||r.type==='ncr'||r.type==='eightd') ) return false; if((r.type==='ncr') && cpNorm(r.stageLabel||r.stage||'')!==cpNorm(CP_STAGE_LABEL[F.stage]||'')) return false; }
  if(F.qc){ const who=r.inspector||r.holdBy||r.createdBy||''; if(who!==F.qc) return false; }
  if(F.customer && cpCustKey(r.customer)!==F.customer) return false;
  if(F.order){ const k=cpNorm(F.order); if(cpNorm(r.orderCode||'').indexOf(k)<0 && cpNorm(r.po||'').indexOf(k)<0 && cpNorm(r.orderId||'')!==k) return false; }
  if(F.product && cpNorm(r.productCode||'').indexOf(cpNorm(F.product))<0) return false;
  if(F.lot && cpNorm(r.lot||'').indexOf(cpNorm(F.lot))<0) return false;
  if(F.result && (r.type==='chk'||r.type==='fqc') && (r.result||'UNK')!==F.result) return false;
  if(F.source && (r.source||'app')!==F.source) return false;
  return true;
}
function cpInspections(F){ return cpRecs().filter(r=>cpIsInspection(r) && !r.void && r.status!=='draft' && cpMatch(r,F||{})); }
const CP_HOLD_OPEN = ['HOLD','Đang điều tra','Chờ phê duyệt'];
function cpKpis(F){
  F=F||{}; const today=cpToday(), ins=cpInspections(F);
  const holds=cpOf('hold', r=>cpMatch(r,F)), ncrs=cpOf('ncr', r=>cpMatch(r,F)), d8=cpOf('eightd', r=>cpMatch(r,F));
  return {
    total:ins.length, today:ins.filter(r=>r.date===today).length,
    ok:ins.filter(r=>r.result==='OK').length, ng:ins.filter(r=>r.result==='NG').length, unk:ins.filter(r=>r.result!=='OK'&&r.result!=='NG').length,
    holdOpen:holds.filter(h=>CP_HOLD_OPEN.includes(h.status)).length,
    ncrOpen:ncrs.filter(n=>n.status!=='Đã đóng').length,
    d8Open:d8.filter(x=>x.status!=='Đã đóng').length,
    drafts:cpRecs().filter(r=>cpIsInspection(r)&&!r.void&&r.status==='draft').length
  };
}
// số liệu cho từng thẻ biểu mẫu
function cpCardStats(key, F){
  const f=cpFormDef(key), type=CP_TYPE_OF_FORM[key], today=cpToday();
  if(!type){
    const n={cp:cpControlPlan().length, pfmea:cpPfmea().length, aql:cpAqlRec()?15:0, defects:cpDefects().length}[key]||0;
    return {n, today:0, ng:0, unit:{cp:'dòng',pfmea:'dòng',aql:'mã cỡ mẫu',defects:'mã lỗi'}[key]||'dòng'};
  }
  let l=cpRecs().filter(r=>r.type===type && !r.void && (type!=='chk'||r.form===key));
  if(type==='chk'||type==='fqc') l=l.filter(r=>r.status!=='draft');
  const dateOf=r=>r.date||(r.createdAt?cpYmd(new Date(r.createdAt)):'');
  return {n:l.length, today:l.filter(r=>dateOf(r)===today).length,
          ng:l.filter(r=> (type==='chk'||type==='fqc') ? r.result==='NG' : (type==='hold' ? CP_HOLD_OPEN.includes(r.status) : r.status!=='Đã đóng')).length,
          unit:'phiếu'};
}
function cpPeople(){
  const s=new Set(); cpRecs().forEach(r=>{ if(r && r.inspector) s.add(r.inspector); });
  (DB.users||[]).forEach(u=>{ if(u && (u.qcRole)) s.add(u.name||u.username); });
  return [...s].sort();
}
function cpCustomers(){ const c=cpCustCanon(); return Object.keys(c).sort((a,b)=>c[a].localeCompare(c[b],'vi')).map(k=>({key:k,name:c[k]})); }
function cpReviewList(){ return cpRecs().filter(r=>r && r.type==='chk' && r.review && r.review.length && !r.reviewed && !r.void); }

// ── Khởi tạo phiếu mới ────────────────────────────────────────────────────────
function cpBlankLine(form, n){
  const base={n:n||1, time:cpHm(), result:''};
  if(form==='dothang') return Object.assign(base,{edge:'', face:'', warp:'', twist:''});
  const l=Object.assign(base,{thick:null, width:null, appearance:'OK', appearanceNote:'', qtyNG:null});
  if(form!=='dun') l.length=null;
  return l;
}
function cpBlank(form){
  const type=CP_TYPE_OF_FORM[form], now=new Date(), date=cpToday();
  const base={id:cpUid('cp'), type, status:'draft', source:'app', date, createdAt:0};
  if(type==='chk') return Object.assign(base,{form, code:'', customer:'', shift:(now.getHours()>=14 && now.getHours()<22)?'Ca 2':'Ca 1', workshop:'', machine:'', spec:'', productCode:'', lot:'',
      orderId:'', orderCode:'', po:'', standard: form==='dothang'?'0,50 - 1mm':'', inspector:cpActor(), lines:[cpBlankLine(form,1)], result:'UNK', tol:{}});
  if(type==='fqc') return Object.assign(base,{code:'', customer:'', orderId:'', orderCode:'', po:'', productCode:'', lot:'', lotQty:'', level:'II', aqlMajor:'', aqlMinor:'', aqlCritical:'', majorNG:0, minorNG:0, criticalNG:0, defectCodes:[], inspector:cpActor(), result:'UNK', note:''});
  if(type==='ncr') return Object.assign(base,{status:'Mở', code:'', productCode:'', lot:'', orderId:'', orderCode:'', customer:'', stage:'', desc:'', standard:'', qtyAffected:'', klass:'', containment:'', cause:'', action:'', verification:'', disposition:'', holdId:'', eightdId:'', sourceId:'', owner:'', approvedBy:'', approvedAt:0});
  if(type==='hold') return Object.assign(base,{status:'HOLD', code:'', heldAt:Date.now(), productCode:'', lot:'', orderId:'', orderCode:'', customer:'', qty:'', reason:'', scope:'', holdBy:cpActor(), containment:'', investigation:'', disposition:'', ncrId:'', sourceId:'', verifyId:'', owner:'', releaseBy:'', releaseAt:0});
  if(type==='eightd'){
    const steps=(cpSeed().eightD||[]).map(s=>({step:s.step, title:s.title, content:'', owner:'', due:'', evidence:'', status:'Open', doneAt:0, doneBy:''}));
    return Object.assign(base,{status:'Đang xử lý', code:'', title:'', customer:'', productCode:'', lot:'', orderId:'', orderCode:'', ncrId:'', trigger:'', leader:cpActor(), w5h2:{what:'',where:'',when:'',who:'',why:'',how:'',howMany:''}, steps});
  }
  return base;
}
