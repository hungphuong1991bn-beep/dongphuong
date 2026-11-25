// src/modules/planning/planning-runctl.js — v2.14.0: TẠM DỪNG / TIẾP TỤC SẢN XUẤT + THỜI GIAN CHẠY CỘNG DỒN
// ────────────────────────────────────────────────────────────────────────────
// MỤC TIÊU NGHIỆP VỤ
//   • Đơn đang chạy có thể TẠM DỪNG: đồng hồ dừng ngay, máy được giải phóng, vẫn giữ nguyên
//     phân công máy / công đoạn / số lượng đã làm / lịch sử máy.
//   • Đơn tạm dừng TIẾP TỤC được khi (và chỉ khi) máy được phân công đang trống; đồng hồ cộng
//     dồn tiếp từ thời gian đã chạy trước đó, KHÔNG tính khoảng nghỉ.
//   • Lưu đầy đủ từng PHIÊN CHẠY (công đoạn · máy · người · thời điểm · thời lượng) và LỊCH SỬ
//     TẠM DỪNG — đây là dữ liệu cho bảng truy xuất ở tab "Đơn hoàn thành".
//
// DỮ LIỆU (tất cả nằm TRONG bản ghi đơn /data/orders/{id} — KHÔNG thêm nhánh Firebase mới):
//   status            pending | running | paused | done      (running có thể còn giá trị cũ 'cutting')
//   startedAt         thời điểm bắt đầu LẦN ĐẦU (đã có từ trước, giữ nguyên ý nghĩa)
//   resumedAt         thời điểm bắt đầu phiên chạy gần nhất (bắt đầu / tiếp tục)
//   pausedAt          thời điểm tạm dừng gần nhất
//   accumulatedRunMs  tổng ms của các phiên ĐÃ ĐÓNG (phiên đang mở tính thêm lúc hiển thị)
//   runSessions[]     {id,no,stage,machineId,startAt,endAt,runMs,by,byId,startReason,endBy,endById,endReason,legacy?}
//   pauseHistory[]    {id,no,at,resumeAt,pausedMs,reason,by,byId,resumeBy,stage,machineId,runMsAtPause,auto?,closedReason?}
//
// NGUYÊN TẮC TÍNH GIỜ
//   • Tổng thời gian chạy = accumulatedRunMs + (đang chạy ? now − startAt của phiên đang mở : 0).
//     Luôn tính LẠI từ timestamp lưu trên dữ liệu mỗi lần hiển thị — không cộng dồn bằng biến đếm
//     của trình duyệt, nên F5 / đổi thiết bị / mất mạng rồi nối lại đều ra đúng cùng một số.
//   • Mọi mốc giờ dùng nowSrv() (đã bù lệch đồng hồ theo máy chủ Firebase — services/presence.js).
//   • accumulatedRunMs CHỈ thay đổi trong rcEndSession() → luôn bằng tổng runMs các phiên đã đóng.
//   • Đơn CŨ (chạy trước khi nâng cấp, chưa có phiên nào): giữ nguyên công thức cũ
//     (đang chạy: now − startedAt; xong: doneAt − startedAt). Chỉ khi có thao tác đầu tiên
//     (tạm dừng / đổi công đoạn / đổi máy / hoàn thành) mới tạo phiên và đánh dấu legacy:true —
//     KHÔNG bịa máy hay người vận hành chưa từng được ghi nhận.
//
// KIỂM SOÁT ĐỒNG THỜI (nhiều thiết bị)
//   1. Khoá theo đơn (_rcBusy + withPlanLock): bấm đúp / 2 thao tác chồng nhau không chạy 2 lần.
//   2. Trước khi quyết định: đợi các lượt ghi đang dở xong, ĐỌC LẠI /data/orders từ server và áp
//      vào bộ nhớ (rcRefresh) — quyết định dựa trên dữ liệu mới nhất, không phải bản cũ trên máy.
//   3. Điều kiện trạng thái (chỉ tạm dừng khi đang running, chỉ tiếp tục khi đang paused) và kiểm
//      tra TRÙNG MÁY được chạy lại trên dữ liệu vừa đọc (rcResumeConflict).
//   4. Sau khi ghi (rcAfterSave): đọc lại để xác nhận thao tác đã được ghi nhận; nếu 2 thiết bị
//      cùng tiếp tục 2 đơn trên 1 máy trong cùng khoảnh khắc thì đơn bắt đầu SAU tự tạm dừng.
//   Ghi từng đơn vẫn đi qua writeOrderRecord (ETag + version) có sẵn. Giới hạn đã biết: Firebase
//   REST không có transaction nhiều đơn, nên bước 3-4 là "kiểm tra lại + tự sửa", không phải khoá cứng.
//
// Quyền: Admin và Nhân viên SX (isStaff). Tài khoản Xem / Chỉ nhập số liệu bị chặn (guardViewer).
// ────────────────────────────────────────────────────────────────────────────

// Lý do gợi ý khi tạm dừng (bấm nhanh trên màn hình cảm ứng ở xưởng)
const RC_PAUSE_PRESETS = ['Chuyển sang đơn gấp', 'Hết nguyên liệu', 'Máy hỏng / sự cố', 'Hết ca / nghỉ', 'Chờ QC / kiểm tra', 'Thay khuôn / chỉnh máy'];

const _rcBusy = new Set(); // id đơn đang xử lý tạm dừng / tiếp tục (chống bấm nhiều lần)
const RC_VERIFY_DELAYS = [0, 3000, 8000]; // ms: các lượt đọc lại kiểm tra SAU khi ghi (xem rcAfterSave)

// ── Tiện ích nhỏ ────────────────────────────────────────────────────────────
function rcNow(){ return (typeof nowSrv==='function') ? nowSrv() : Date.now(); }
function rcStatusOf(o){ return o && o.status==='cutting' ? 'running' : (o ? o.status : undefined); }
function rcActor(){
  const u = (typeof currentUser!=='undefined' && currentUser) ? currentUser : null;
  return {name: u ? (u.name||u.username||u.id||'?') : 'system', id: u ? (u.id||'') : ''};
}
let _rcSeq = 0;
function rcSid(){ return 's'+Date.now().toString(36)+(++_rcSeq).toString(36)+Math.random().toString(36).slice(2,5); }
function rcSleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function rcMachineName(mid){
  if(!mid) return '';
  const m = (typeof machineById==='function') ? machineById(mid) : null;
  return m ? m.name : String(mid);
}
function rcStageLabel(key){
  return (typeof ASSIGN_STAGE_LABEL!=='undefined' && ASSIGN_STAGE_LABEL[key]) || key || '';
}

// Firebase trả mảng thưa / mảng dày dưới dạng object khoá số → luôn đưa về mảng THẬT, sửa tại chỗ
// (để các hàm bên dưới push / sửa phần tử trực tiếp trên chính bản ghi đơn).
function rcArr(o, key){
  let v = o[key];
  if(Array.isArray(v)) return v;
  if(v && typeof v==='object'){
    v = Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(Boolean);
    o[key] = v; return v;
  }
  return [];
}
function rcSessions(o){ return o ? rcArr(o,'runSessions') : []; }
function rcPauses(o){ return o ? rcArr(o,'pauseHistory') : []; }
function rcOpenSession(o){
  const a = rcSessions(o);
  for(let i=a.length-1;i>=0;i--){ if(a[i] && a[i].endAt==null) return a[i]; }
  return null;
}
function rcOpenPause(o){
  const a = rcPauses(o);
  for(let i=a.length-1;i>=0;i--){ if(a[i] && a[i].resumeAt==null && !a[i].closedReason) return a[i]; }
  return null;
}
// Đơn đã dùng mô hình thời gian mới chưa (có phiên hoặc có tổng cộng dồn)
function rcHasModel(o){ return !!o && (rcSessions(o).length>0 || o.accumulatedRunMs!=null); }

// ── Tính thời gian ──────────────────────────────────────────────────────────
// Tổng thời gian CHẠY THỰC TẾ (ms) — không gồm lúc tạm dừng / chờ.
function rcRunMs(o, now){
  if(!o) return 0;
  const s = rcStatusOf(o);
  if(rcHasModel(o)){
    let total = Number(o.accumulatedRunMs)||0;
    if(s==='running'){
      const op = rcOpenSession(o);
      const from = op ? op.startAt : (o.resumedAt||o.startedAt);
      if(from) total += Math.max(0, (now==null?rcNow():now) - from);
    }
    return total;
  }
  // Đơn cũ (trước nâng cấp): giữ nguyên cách tính cũ để số liệu không đổi
  if(!o.startedAt) return 0;
  if(s==='done') return o.doneAt ? Math.max(0, o.doneAt - o.startedAt) : 0;
  if(s==='running') return Math.max(0, (now==null?rcNow():now) - o.startedAt);
  return 0;
}
// Nguồn của con số thời gian chạy — để giao diện nói thật: 'sessions' (chính xác theo phiên) hay 'legacy' (ước tính cũ)
function rcRunSource(o){
  if(!o) return 'none';
  if(!rcHasModel(o)) return o.startedAt ? 'legacy' : 'none';
  return rcSessions(o).some(s=>s && s.legacy) ? 'legacy-mixed' : 'sessions';
}
// Tổng thời gian ĐÃ TẠM DỪNG (ms) — chỉ để hiển thị thông tin, không dùng tính giờ chạy
function rcPausedTotalMs(o, now){
  let t = 0;
  rcPauses(o).forEach(p=>{
    if(!p) return;
    if(p.pausedMs!=null) t += Number(p.pausedMs)||0;
    else if(p.resumeAt==null && !p.closedReason) t += Math.max(0,(now==null?rcNow():now)-p.at);
  });
  return t;
}
function rcPauseCount(o){ return rcPauses(o).filter(p=>p && !(p.closedReason==='revert')).length; }

// "hh:mm:ss" (không hiện giờ nếu < 1 giờ) — cùng khuôn với đồng hồ cũ "⏱ mm:ss"
function rcFmtHMS(ms, forceHours){
  const total = Math.max(0, Math.floor((ms||0)/1000));
  const h = Math.floor(total/3600), m = Math.floor((total%3600)/60), s = total%60;
  const pad = n=>String(n).padStart(2,'0');
  return (h>0||forceHours ? pad(h)+':' : '') + pad(m)+':'+pad(s);
}
function rcFmtDur(ms){
  if(!(ms>0)) return '0p';
  return (typeof fmtDuration==='function' ? fmtDuration(ms) : '') || '<1p';
}
// Nội dung đồng hồ của 1 đơn: đang chạy "⏱ …" (chạy tiếp theo thời gian), tạm dừng "⏸ …" (đứng yên)
function rcClockText(o, now){
  const s = rcStatusOf(o);
  return (s==='paused' ? '⏸ ' : '⏱ ') + rcFmtHMS(rcRunMs(o, now));
}

// ── Biến đổi dữ liệu đơn (thuần: chỉ sửa đối tượng đơn được truyền vào) ──────
// rcPrep: gọi TRƯỚC khi sửa bất kỳ trường nào của đơn (stage / máy / status). Với đơn CŨ đang chạy
// chưa có phiên, tạo phiên mở "khôi phục từ dữ liệu cũ" từ đúng trạng thái đang có — phải làm
// trước khi đổi stage/máy, nếu không phiên sẽ ghi nhầm công đoạn / máy MỚI.
function rcPrep(o){
  rcSessions(o); rcPauses(o); // chuẩn hoá object→mảng
  if(rcHasModel(o)) return;
  o.accumulatedRunMs = 0;
  if(rcStatusOf(o)==='running' && o.startedAt){
    const stage = o.stage || 'dun';
    o.runSessions = [{
      id:rcSid(), no:1, stage, machineId:(o.machineAssign && o.machineAssign[stage]) || '',
      startAt:o.startedAt, endAt:null, runMs:null, by:'', byId:'', startReason:'legacy', legacy:true
    }];
    o.resumedAt = o.startedAt;
  }
}
function rcStartSession(o, now, why){
  const stage = o.stage || 'dun';
  const a = rcSessions(o);
  const me = rcActor();
  a.push({
    id:rcSid(), no:a.length+1, stage, machineId:(o.machineAssign && o.machineAssign[stage]) || '',
    startAt:now, endAt:null, runMs:null, by:me.name, byId:me.id, startReason:why||'start'
  });
  o.runSessions = a;
  o.resumedAt = now;
  if(!o.startedAt) o.startedAt = now;
  if(o.accumulatedRunMs==null) o.accumulatedRunMs = 0;
}
// Đóng phiên đang mở (nếu có) và cộng thời lượng vào accumulatedRunMs — ĐIỂM DUY NHẤT cộng dồn.
function rcEndSession(o, now, reason){
  const op = rcOpenSession(o);
  if(!op) return 0;
  const me = rcActor();
  const end = Math.max(now, op.startAt);
  op.endAt = end;
  op.runMs = end - op.startAt;
  op.endReason = reason || '';
  op.endBy = me.name; op.endById = me.id;
  o.accumulatedRunMs = (Number(o.accumulatedRunMs)||0) + op.runMs;
  return op.runMs;
}
// Bắt đầu chạy (từ Chờ sản xuất, hoặc đơn được tự đẩy lên chạy). Đã có phiên mở thì giữ nguyên.
function rcApplyStart(o, now, why){
  if(!rcOpenSession(o)) rcStartSession(o, now, why||'start');
  if(!o.startedAt) o.startedAt = now;
}
// Đơn đang chạy chuyển công đoạn: đóng phiên cũ, mở phiên mới (liền mạch, không mất giây nào).
// Gọi SAU khi o.stage đã đổi (rcPrep đã gọi TRƯỚC khi đổi).
function rcApplyStage(o, now){
  if(rcStatusOf(o)!=='running') return;
  const op = rcOpenSession(o);
  const stage = o.stage || 'dun';
  if(op && op.stage===stage) return;
  if(op) rcEndSession(o, now, 'stage');
  rcStartSession(o, now, 'stage');
}
// Đơn đang chạy đổi máy ở công đoạn hiện tại: đóng phiên máy cũ, mở phiên máy mới — KHÔNG ghi đè máy cũ.
// Gọi SAU khi o.machineAssign đã đổi.
function rcApplyMachine(o, now){
  if(rcStatusOf(o)!=='running') return;
  const op = rcOpenSession(o);
  const stage = o.stage || 'dun';
  const mid = (o.machineAssign && o.machineAssign[stage]) || '';
  if(op && op.stage===stage && (op.machineId||'')===mid) return;
  if(op) rcEndSession(o, now, 'switch');
  rcStartSession(o, now, 'switch');
}
// Hoàn thành: chốt phiên cuối. Đơn đang tạm dừng mà hoàn thành thì đóng luôn bản ghi tạm dừng đang mở.
function rcApplyDone(o, now){
  rcEndSession(o, now, 'done');
  const pp = rcOpenPause(o);
  if(pp){ pp.closedReason='done'; pp.pausedMs = Math.max(0, now-pp.at); }
}
// Đưa về Chờ sản xuất (không phải tạm dừng): chốt phiên, huỷ bản ghi tạm dừng đang mở nếu có.
function rcApplyRevert(o, now){
  rcEndSession(o, now, 'revert');
  const pp = rcOpenPause(o);
  if(pp){ pp.closedReason='revert'; pp.pausedMs = Math.max(0, now-pp.at); }
}
// Các máy đơn đang thực sự giữ: công đoạn hiện tại và các công đoạn ĐÃ QUA còn gán máy (chạy song song)
function rcHeldMachines(o){
  const cur = assignStageIndex(o.stage||'dun');
  const out = [];
  ASSIGN_STAGES.forEach(st=>{
    if(assignStageIndex(st.key) > cur) return;
    const mid = o.machineAssign && o.machineAssign[st.key];
    if(mid && out.indexOf(mid)<0) out.push(mid);
  });
  return out;
}
// TẠM DỪNG: chốt phiên, đồng hồ đứng, nhả máy. Giữ nguyên machineAssign / machineHistory / stage / doneQty.
function rcApplyPause(o, reason, now, opts){
  rcPrep(o);
  opts = opts || {};
  const stage = o.stage || 'dun';
  const held = rcHeldMachines(o);
  rcEndSession(o, now, 'pause');
  o.status = 'paused';
  o.pausedAt = now;
  const me = rcActor();
  const a = rcPauses(o);
  a.push({
    id:rcSid(), no:a.length+1, at:now, resumeAt:null, pausedMs:null, reason:reason||'',
    by:me.name, byId:me.id, stage, machineId:(o.machineAssign && o.machineAssign[stage]) || '',
    runMsAtPause:Number(o.accumulatedRunMs)||0, auto:!!opts.auto
  });
  o.pauseHistory = a;
  // Nhả máy: xoá dấu "đang chạy thật" (machineActiveAt) — máy trống cho đơn khác. KHÔNG xoá machineAssign.
  delete o.machineActiveAt; delete o.machineActiveStartAt;
  return {freed: held};
}
// TIẾP TỤC: mở phiên mới, đóng bản ghi tạm dừng đang mở, xác nhận lại các máy đang giữ.
function rcApplyResume(o, now){
  rcPrep(o);
  const me = rcActor();
  const pp = rcOpenPause(o);
  if(pp){ pp.resumeAt = now; pp.pausedMs = Math.max(0, now-pp.at); pp.resumeBy = me.name; pp.resumeById = me.id; }
  o.status = 'running';
  rcStartSession(o, now, 'resume');
  rcHeldMachines(o).forEach(mid=>{
    const st = (typeof assignStageOfMachine==='function') ? assignStageOfMachine(mid) : null;
    if(st && typeof dhMarkActiveAtMachine==='function') dhMarkActiveAtMachine(o, st.key, mid);
  });
}

// ── Kiểm tra trùng máy khi tiếp tục ────────────────────────────────────────
// Trả về {order, machineId, stage} nếu đơn khác đang CHIẾM máy mà đơn này cần; null nếu trống.
// Chỉ xét công đoạn hiện tại và các công đoạn đã qua còn gán máy (giống dhIsOrderRunningAtStage).
function rcResumeConflict(o, orders){
  const cur = assignStageIndex(o.stage||'dun');
  for(const st of ASSIGN_STAGES){
    if(assignStageIndex(st.key) > cur) break;
    const mid = o.machineAssign && o.machineAssign[st.key];
    if(!mid) continue;
    const c = (orders||[]).find(x=>x && x.id!==o.id && dhIsOrderRunningAtStage(x, st.key, mid));
    if(c) return {order:c, machineId:mid, stage:st.key};
  }
  return null;
}
// Gộp danh sách đơn trong bộ nhớ với bản đọc từ server: mỗi id lấy bản có version cao hơn
function rcOrderPool(serverOrders){
  const m = new Map();
  (DB.orders||[]).forEach(o=>{ if(o && o.id) m.set(o.id, o); });
  (serverOrders||[]).forEach(s=>{
    if(!s || !s.id) return;
    const l = m.get(s.id);
    if(!l || (Number(s.version)||0) > (Number(l.version)||0)) m.set(s.id, s);
  });
  return [...m.values()];
}
function rcConflictMsg(cf){
  const m = rcMachineName(cf.machineId) || 'Máy';
  const c = cf.order;
  return `⛔ Chưa thể tiếp tục: ${m} đang chạy đơn ${ddCode(c)} (${c.customer||'—'}) — hãy đợi đơn đó tạm dừng/hoàn thành, hoặc đổi sang máy khác rồi tiếp tục`;
}

// ── Đồng bộ trước/sau khi ghi ──────────────────────────────────────────────
// Trước khi quyết định: đợi lượt ghi dở xong → đọc lại /data/orders → áp vào bộ nhớ (như đồng bộ realtime).
// Offline / lỗi mạng: trả online=false, thao tác vẫn chạy trên dữ liệu cục bộ và sẽ tự đẩy lên khi có mạng.
async function rcRefresh(){
  if(typeof fbOk!=='function' || !fbOk()) return {online:false, orders:null};
  try{
    for(let i=0;i<40 && typeof _pendingSaves!=='undefined' && _pendingSaves>0;i++) await rcSleep(100);
    const raw = await fbRead('/data/orders');
    const arr = raw ? (Array.isArray(raw)?raw:Object.values(raw)).filter(Boolean) : [];
    const dirty = (typeof getDirtyFields==='function') ? getDirtyFields().indexOf('orders')>=0 : false;
    if(!dirty && typeof _pendingSaves!=='undefined' && _pendingSaves===0 && arr.length && hashOrders(arr)!==_lastHash){
      applyFieldChange('orders', raw);
    }
    return {online:true, orders:arr};
  }catch(e){ return {online:false, orders:null, err:e}; }
}
// Sau khi ghi: xác nhận thao tác đã được ghi nhận (không bị thiết bị khác ghi đè) và không trùng máy.
// Chạy vài lượt (0s / 3s / 8s) để bắt cả trường hợp 2 thiết bị ghi gần như cùng lúc.
async function rcAfterSave(id, expect){
  try{
    if(typeof fbOk!=='function' || !fbOk()) return;
    const passes = RC_VERIFY_DELAYS;
    for(let p=0;p<passes.length;p++){
      if(passes[p]) await rcSleep(passes[p]);
      for(let i=0;i<80 && typeof _pendingSaves!=='undefined' && _pendingSaves>0;i++) await rcSleep(125);
      if(typeof _pendingSaves!=='undefined' && _pendingSaves>0) return;
      const raw = await fbRead('/data/orders');
      const arr = raw ? (Array.isArray(raw)?raw:Object.values(raw)).filter(Boolean) : [];
      const srv = arr.find(x=>x.id===id);
      const loc = DB.orders.find(x=>x.id===id);
      if(!srv || !loc) return;
      const srvSt = rcStatusOf(srv), locSt = rcStatusOf(loc);
      if(srvSt!==expect){
        // Thiết bị khác đã đổi đơn này sau mình — bản mới nhất của họ được giữ (cơ chế xung đột có sẵn)
        if(p===0 && locSt!==expect) showToast('⚠️ Thao tác chưa được ghi nhận vì thiết bị khác vừa thay đổi đơn này — vui lòng kiểm tra lại trạng thái', true);
        return;
      }
      if(expect==='running'){
        const cf = rcResumeConflict(srv, arr);
        if(cf){
          const mySess = rcOpenSession(srv), otherSess = rcOpenSession(cf.order);
          const myAt = mySess ? mySess.startAt : (srv.resumedAt||0);
          const otAt = otherSess ? otherSess.startAt : (cf.order.resumedAt||cf.order.startedAt||0);
          const iLose = myAt>otAt || (myAt===otAt && String(srv.id)>String(cf.order.id));
          if(iLose){
            rcDoPause(id, `Tự động tạm dừng: ${rcMachineName(cf.machineId)} đã được đơn ${ddCode(cf.order)} chạy trước`, {auto:true, silentConfirm:true});
            showToast(`⛔ ${rcMachineName(cf.machineId)} vừa được đơn ${ddCode(cf.order)} (${cf.order.customer||'—'}) chiếm trước — đơn này đã tự tạm dừng để không chạy trùng máy`, true);
            return;
          }
        }
      }
    }
  }catch(e){ /* mất mạng giữa chừng: lần đồng bộ sau sẽ tự hội tụ */ }
}

// ── Thao tác: TẠM DỪNG ─────────────────────────────────────────────────────
let _rcPauseId = null;
function rcEnsurePauseModal(){
  let m = document.getElementById('rcPauseModal');
  if(m) return m;
  m = document.createElement('div');
  m.className = 'modal'; m.id = 'rcPauseModal';
  m.setAttribute('onclick', "if(event.target===this)closeModal('rcPauseModal');");
  m.innerHTML = `<div class="modal-box rc-modal">
    <div class="modal-handle"></div>
    <div class="modal-title">⏸ Tạm dừng sản xuất</div>
    <div id="rcPauseBody" data-dp-nodirty="1">
      <div id="rcPauseInfo" class="rc-info"></div>
      <label class="rc-lbl" for="rcPauseReason">Lý do tạm dừng <span id="rcPauseReq" class="rc-req"></span></label>
      <div class="rc-chips" id="rcPauseChips"></div>
      <textarea id="rcPauseReason" class="field-inp rc-reason" rows="2" maxlength="200" placeholder="Nhập lý do tạm dừng…"></textarea>
      <div id="rcPauseErr" class="rc-err" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('rcPauseModal')">Hủy</button>
      <button class="btn rc-btn-pause" id="rcPauseOk" style="flex:1" onclick="rcPauseConfirm()">⏸ Xác nhận tạm dừng</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  return m;
}
function rcPauseDialog(id, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer()) return;
  if(!isStaff()){ showToast('❌ Bạn không có quyền tạm dừng sản xuất', true); return; }
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  if(rcStatusOf(o)!=='running'){ showToast('Đơn không ở trạng thái Đang sản xuất', true); renderTab(currentTab); return; }
  rcEnsurePauseModal();
  _rcPauseId = id;
  const stage = o.stage || 'dun';
  const mid = o.machineAssign && o.machineAssign[stage];
  let freeTxt = mid ? `Máy <b>${esc(rcMachineName(mid))}</b> sẽ được giải phóng.` : 'Đơn chưa gán máy ở công đoạn này.';
  if(mid){
    const q = dhMachineQueue(mid, id).filter(x=>dhIsOrderDueAtStage(x, stage));
    if(q.length) freeTxt += `<br>⚙️ Đơn đang xếp hàng tiếp theo trên máy này (<b>${esc(q[0].customer||'—')}</b> · ${esc(ddCode(q[0]))}) sẽ <b>tự động chạy tiếp</b> khi máy trống.`;
  }
  document.getElementById('rcPauseInfo').innerHTML =
    `<div><b>${esc(o.customer||'—')}</b> · ${esc(ddCode(o))}</div>
     <div>Công đoạn: <b>${esc(rcStageLabel(stage))}</b> · Đã chạy: <b>${rcFmtHMS(rcRunMs(o), true)}</b></div>
     <div class="rc-info-note">${freeTxt}<br>Đồng hồ dừng ngay; phân công máy, công đoạn và số lượng đã làm được giữ nguyên.</div>`;
  document.getElementById('rcPauseChips').innerHTML = RC_PAUSE_PRESETS.map(t=>
    `<button type="button" class="rc-chip" onclick="rcPickReason(this)">${esc(t)}</button>`).join('');
  const ta = document.getElementById('rcPauseReason'); ta.value = '';
  document.getElementById('rcPauseReq').textContent = isAdmin() ? '(không bắt buộc với Quản trị viên)' : '(bắt buộc)';
  const er = document.getElementById('rcPauseErr'); er.style.display='none'; er.textContent='';
  const ok = document.getElementById('rcPauseOk'); ok.disabled = false;
  openModal('rcPauseModal');
  setTimeout(()=>{ try{ ta.focus(); }catch(e){} }, 80);
}
function rcPickReason(btn){
  const ta = document.getElementById('rcPauseReason'); if(!ta) return;
  ta.value = btn.textContent;
  document.querySelectorAll('#rcPauseChips .rc-chip').forEach(b=>b.classList.toggle('on', b===btn));
}
async function rcPauseConfirm(){
  const id = _rcPauseId; if(!id) return;
  const ta = document.getElementById('rcPauseReason');
  const reason = ((ta && ta.value)||'').trim();
  const er = document.getElementById('rcPauseErr');
  if(!reason && !isAdmin()){
    if(er){ er.textContent = 'Vui lòng nhập hoặc chọn lý do tạm dừng.'; er.style.display='block'; }
    return;
  }
  if(_rcBusy.has(id)) return;
  _rcBusy.add(id);
  const ok = document.getElementById('rcPauseOk'); if(ok) ok.disabled = true;
  try{
    await rcRefresh(); // quyết định trên dữ liệu mới nhất
    let res = null;
    const ran = withPlanLock(id, ()=>{ res = rcDoPause(id, reason); });
    closeModal('rcPauseModal');
    if(ran===false){ showToast('Đơn đang được xử lý bởi thao tác khác, vui lòng thử lại', true); renderTab(currentTab); return; }
    if(res && res.ok) rcAfterSave(id, 'paused');
  } finally {
    _rcBusy.delete(id); _rcPauseId = null;
    if(ok) ok.disabled = false;
  }
}
// Phần ĐỒNG BỘ của tạm dừng (sau khi đã đọc lại dữ liệu): kiểm tra trạng thái → ghi → lưu.
function rcDoPause(id, reason, opts){
  opts = opts || {};
  const o = DB.orders.find(x=>x.id===id); if(!o) return {ok:false, code:'missing'};
  if(rcStatusOf(o)!=='running'){
    showToast(rcStatusOf(o)==='paused' ? 'Đơn đã được tạm dừng (có thể từ thiết bị khác)' : 'Đơn không còn ở trạng thái Đang sản xuất — thiết bị khác có thể đã thay đổi', true);
    renderTab(currentTab); refreshKhDetailIfOpen(id);
    return {ok:false, code:'not-running'};
  }
  const now = rcNow();
  const before = {status:o.status, stage:o.stage||'dun', runMs:rcRunMs(o, now)};
  const r = rcApplyPause(o, reason, now, opts);
  const stage = o.stage || 'dun';
  const mid = o.machineAssign && o.machineAssign[stage];
  log(opts.auto ? 'Tự động tạm dừng' : 'Tạm dừng sản xuất',
    `${o.customer||''} · ${rcStageLabel(stage)}${mid?' · '+rcMachineName(mid):''} · đã chạy ${rcFmtHMS(before.runMs,true)}${reason?' · Lý do: '+reason:''}`,
    id, {status:before.status}, {status:'paused', reason:reason||'', runMs:before.runMs});
  renderTab(currentTab); updateBadges(); refreshKhDetailIfOpen(id);
  if(!opts.silentConfirm) showToast('⏸ Đã tạm dừng — đồng hồ dừng, máy được giải phóng');
  saveOrders();
  addNotif('order_pause','⏸ Tạm dừng: '+(o.customer||''),
    `${specStr(o)} · ${rcStageLabel(stage)}${reason?' · '+reason:''}`,'keHoach',currentUser?.name);
  // Máy vừa trống: đơn đang xếp hàng sẵn (đã gán đúng máy này) tự chạy tiếp — cùng cơ chế với hoàn thành / về chờ
  (r.freed||[]).forEach(m2=>promoteQueuedOrderToRunning(m2));
  return {ok:true, freed:r.freed};
}

// ── Thao tác: TIẾP TỤC ────────────────────────────────────────────────────
function rcSetBtnBusy(btn, on){
  if(!btn) return;
  btn.classList.toggle('is-loading', !!on);
  btn.disabled = !!on;
}
async function rcResumeOrder(id, btn, ev){
  if(ev) ev.stopPropagation();
  if(guardViewer()) return {ok:false, code:'viewer'};
  if(!isStaff()){ showToast('❌ Bạn không có quyền tiếp tục sản xuất', true); return {ok:false, code:'perm'}; }
  if(_rcBusy.has(id)) return {ok:false, code:'busy'}; // khoá chống bấm nhiều lần
  _rcBusy.add(id);
  rcSetBtnBusy(btn, true);
  if(ev && typeof khRipple==='function') khRipple(ev, btn);
  let res = {ok:false};
  try{
    const rf = await rcRefresh();
    const ran = withPlanLock(id, ()=>{ res = rcDoResume(id, rf); });
    if(ran===false){ showToast('Đơn đang được xử lý bởi thao tác khác, vui lòng thử lại', true); renderTab(currentTab); res = {ok:false, code:'locked'}; }
    if(res && res.ok) rcAfterSave(id, 'running');
  } finally {
    _rcBusy.delete(id);
    rcSetBtnBusy(btn, false);
  }
  return res;
}
function rcDoResume(id, rf){
  const o = DB.orders.find(x=>x.id===id); if(!o) return {ok:false, code:'missing'};
  if(rcStatusOf(o)!=='paused'){
    showToast(rcStatusOf(o)==='running' ? 'Đơn đã được tiếp tục (có thể từ thiết bị khác)' : 'Đơn không ở trạng thái Tạm dừng', true);
    renderTab(currentTab); refreshKhDetailIfOpen(id);
    return {ok:false, code:'not-paused'};
  }
  const pool = rcOrderPool(rf && rf.orders);
  const cf = rcResumeConflict(o, pool);
  if(cf){
    showToast(rcConflictMsg(cf), true);
    renderTab(currentTab); refreshKhDetailIfOpen(id);
    return {ok:false, code:'machine-busy', conflict:cf};
  }
  const now = rcNow();
  const pp = rcOpenPause(o);
  const pausedFor = pp ? Math.max(0, now-pp.at) : 0;
  rcApplyResume(o, now);
  const stage = o.stage || 'dun';
  const mid = o.machineAssign && o.machineAssign[stage];
  log('Tiếp tục sản xuất',
    `${o.customer||''} · ${rcStageLabel(stage)}${mid?' · '+rcMachineName(mid):''} · đã nghỉ ${rcFmtDur(pausedFor)} (không tính vào giờ chạy) · đã chạy trước đó ${rcFmtHMS(Number(o.accumulatedRunMs)||0,true)}`,
    id, {status:'paused'}, {status:'running'});
  renderTab(currentTab); updateBadges(); refreshKhDetailIfOpen(id);
  showToast('▶ Đã tiếp tục sản xuất — đồng hồ chạy tiếp từ '+rcFmtHMS(Number(o.accumulatedRunMs)||0, true));
  saveOrders();
  addNotif('order_run','▶ Tiếp tục: '+(o.customer||''), `${specStr(o)} · ${rcStageLabel(stage)}`,'keHoach',currentUser?.name);
  return {ok:true};
}

// ── Giao diện ──────────────────────────────────────────────────────────────
// Nút điều khiển chạy/dừng cho Thẻ & Drawer (chỉ Admin/Nhân viên SX)
function rcPauseBtnHTML(o){
  return `<button class="kh-abtn pause" id="kh-pause-${o.id}" onclick="rcPauseDialog('${o.id}',event)" title="Tạm dừng sản xuất — dừng đồng hồ và giải phóng máy">
    <span class="kh-abtn-spin"></span><span class="kh-abtn-label"><span class="kh-abtn-ico">⏸</span><span class="kh-abtn-txt">Tạm dừng</span></span></button>`;
}
function rcResumeBtnHTML(o){
  return `<button class="kh-abtn resume" id="kh-resume-${o.id}" onclick="rcResumeOrder('${o.id}',this,event)" title="Tiếp tục sản xuất — đồng hồ cộng dồn từ thời gian đã chạy">
    <span class="kh-abtn-spin"></span><span class="kh-abtn-label"><span class="kh-abtn-ico">▶</span><span class="kh-abtn-txt">TIẾP TỤC SẢN XUẤT</span></span></button>`;
}
// Khối thông tin của đơn đang tạm dừng (thẻ Kế hoạch)
function rcPausedInfoHTML(o){
  const pp = rcPauses(o).filter(p=>p && p.closedReason!=='revert');
  const last = pp.length ? pp[pp.length-1] : null;
  const stage = o.stage || 'dun';
  const mid = (last && last.machineId) || (o.machineAssign && o.machineAssign[stage]) || '';
  return `<div class="rc-paused-box">
    <div class="rc-row"><span>⏱ Đã chạy</span><b>${rcFmtHMS(rcRunMs(o), true)}</b></div>
    <div class="rc-row"><span>⏸ Tạm dừng lúc</span><b>${o.pausedAt?fmtDateTime(o.pausedAt):'—'}</b></div>
    <div class="rc-row"><span>Số lần tạm dừng</span><b>${pp.length}</b></div>
    <div class="rc-row"><span>Lý do</span><b class="rc-reason-txt">${last&&last.reason?esc(last.reason):'<i>Không ghi lý do</i>'}</b></div>
    ${mid?`<div class="rc-row"><span>Máy giữ chỗ</span><b>${esc(rcMachineName(mid))}</b></div>`:''}
    <div class="rc-row"><span>Người thao tác</span><b>${last&&last.by?esc(last.by):'—'}</b></div>
  </div>`;
}
// Chip tóm tắt số phiên / số lần dừng trên thẻ (bấm để xem lịch sử)
function rcHistoryChipHTML(o){
  const ns = rcSessions(o).length, np = rcPauseCount(o);
  if(ns<=1 && !np) return '';
  return `<button class="rc-hist-chip" onclick="event.stopPropagation();rcOpenHistory('${o.id}')" title="Xem lịch sử từng phiên chạy và tạm dừng">📜 ${ns} phiên chạy · ${np} lần tạm dừng</button>`;
}
const RC_END_LABEL = {pause:'Tạm dừng', stage:'Chuyển công đoạn', switch:'Đổi máy', done:'Hoàn thành', revert:'Về chờ SX'};
const RC_START_LABEL = {start:'Bắt đầu', resume:'Tiếp tục', stage:'Sang công đoạn mới', switch:'Sang máy mới', legacy:'Dữ liệu cũ'};
// Bảng lịch sử phiên chạy + tạm dừng (dùng ở Drawer và hộp thoại lịch sử)
function rcHistoryHTML(o){
  const ses = rcSessions(o), pau = rcPauses(o);
  if(!ses.length && !pau.length){
    if(o.startedAt) return `<div class="rc-empty">Đơn này bắt đầu chạy trước khi có tính năng ghi phiên — <b>chưa có dữ liệu phiên chạy</b>. Thời gian chạy hiện tính từ lúc bắt đầu (${fmtDateTime(o.startedAt)}).</div>`;
    return `<div class="rc-empty">Chưa có phiên chạy nào.</div>`;
  }
  const now = rcNow();
  const rows = ses.map(s=>{
    const open = s.endAt==null;
    const dur = open ? Math.max(0, now-s.startAt) : (s.runMs!=null ? s.runMs : Math.max(0,s.endAt-s.startAt));
    return `<tr class="${open?'rc-open':''}">
      <td>${s.no||''}</td><td>${esc(rcStageLabel(s.stage))}</td>
      <td>${s.machineId?esc(rcMachineName(s.machineId)):'<span class="ds-na">Chưa gán máy</span>'}</td>
      <td>${fmtDateTime(s.startAt)}</td>
      <td>${open?'<span class="rc-live">● đang chạy</span>':fmtDateTime(s.endAt)}</td>
      <td><b>${rcFmtHMS(dur, true)}</b></td>
      <td>${s.by?esc(s.by):'<span class="ds-na">CHƯA CÓ DỮ LIỆU</span>'}</td>
      <td>${open?'':esc(RC_END_LABEL[s.endReason]||s.endReason||'')}${s.legacy?' <span class="rc-tag" title="Phiên khôi phục từ dữ liệu cũ: mốc bắt đầu = giờ bắt đầu của đơn">dữ liệu cũ</span>':''}</td>
    </tr>`;
  }).join('');
  const prow = pau.map(p=>`<tr>
      <td>${p.no||''}</td><td>${fmtDateTime(p.at)}</td>
      <td>${p.resumeAt?fmtDateTime(p.resumeAt):(p.closedReason?esc(p.closedReason==='revert'?'Hủy (về Chờ SX)':'Đóng khi hoàn thành'):'<span class="rc-live">● đang tạm dừng</span>')}</td>
      <td>${p.pausedMs!=null?rcFmtDur(p.pausedMs):(p.resumeAt==null&&!p.closedReason?rcFmtDur(now-p.at):'—')}</td>
      <td>${p.reason?esc(p.reason):'<i>Không ghi lý do</i>'}${p.auto?' <span class="rc-tag">tự động</span>':''}</td>
      <td>${p.machineId?esc(rcMachineName(p.machineId)):'—'}</td>
      <td>${esc(p.by||'—')}${p.resumeBy&&p.resumeBy!==p.by?' → '+esc(p.resumeBy):''}</td></tr>`).join('');
  return `<div class="rc-hist">
    <div class="rc-hist-sum"><span>⏱ Tổng thời gian chạy: <b>${rcFmtHMS(rcRunMs(o), true)}</b></span><span>⏸ Đã nghỉ: <b>${rcFmtDur(rcPausedTotalMs(o))}</b></span><span>Số lần tạm dừng: <b>${rcPauseCount(o)}</b></span></div>
    ${ses.length?`<div class="rc-tbl-wrap"><table class="rc-tbl"><thead><tr><th>Lần</th><th>Công đoạn</th><th>Máy</th><th>Bắt đầu</th><th>Kết thúc</th><th>Thời gian chạy</th><th>Người vận hành</th><th>Kết thúc do</th></tr></thead><tbody>${rows}</tbody></table></div>`:''}
    ${pau.length?`<div class="rc-sub">Lịch sử tạm dừng</div><div class="rc-tbl-wrap"><table class="rc-tbl"><thead><tr><th>Lần</th><th>Tạm dừng lúc</th><th>Chạy lại lúc</th><th>Thời gian nghỉ</th><th>Lý do</th><th>Máy</th><th>Người thao tác</th></tr></thead><tbody>${prow}</tbody></table></div>`:''}
  </div>`;
}
function rcOpenHistory(id){
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  let m = document.getElementById('rcHistModal');
  if(!m){
    m = document.createElement('div'); m.className='modal'; m.id='rcHistModal';
    m.setAttribute('onclick',"if(event.target===this)closeModal('rcHistModal');");
    m.innerHTML = `<div class="modal-box rc-modal rc-modal-wide"><div class="modal-handle"></div>
      <div class="modal-title" id="rcHistTitle">Lịch sử phiên chạy</div>
      <div id="rcHistBody" data-dp-nodirty="1"></div>
      <div class="modal-footer"><button class="btn btn-ghost" style="flex:1" onclick="closeModal('rcHistModal')">Đóng</button></div></div>`;
    document.body.appendChild(m);
  }
  document.getElementById('rcHistTitle').textContent = `📜 ${o.customer||'—'} · ${ddCode(o)} — phiên chạy & tạm dừng`;
  document.getElementById('rcHistBody').innerHTML = rcHistoryHTML(o);
  openModal('rcHistModal');
}
// Đồng hồ trên màn hình: cập nhật mỗi giây các đồng hồ đang chạy (id clk-{orderId}). Gọi từ core/app.js.
// Mỗi lần đều TÍNH LẠI từ timestamp lưu trên đơn (không dùng biến đếm).
function rcTickClocks(){
  const now = rcNow();
  DB.orders.forEach(o=>{
    if(rcStatusOf(o)!=='running') return;
    const el = document.getElementById('clk-'+o.id);
    if(el) el.textContent = rcClockText(o, now);
  });
}
