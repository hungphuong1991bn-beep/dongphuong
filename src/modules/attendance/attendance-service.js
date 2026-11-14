// src/modules/attendance/attendance-service.js  — GIAI ĐOẠN 1 (v2.6.0)
// ════════════════════════════════════════════════════════════════════════════
// DỊCH VỤ DỮ LIỆU CHẤM CÔNG
// Cấu trúc lưu trữ KHÔNG đổi:  /data/attendance/{YYYY-MM}/{workerId}/{ngày} = "giá trị"
//
// LỖI GỐC ĐÃ SỬA (xem docs/CHANGELOG.md):
//  1. Trước đây mỗi lần lưu ghi đè CẢ DÒNG CÔNG 1 NGƯỜI-THÁNG (JSON nguyên dòng) và PUT cả nhánh
//     /data/attendance → 2 thiết bị sửa 2 ngày khác nhau của cùng 1 người thì người lưu sau
//     làm mất ô của người lưu trước. NAY: chỉ PATCH đúng những Ô vừa đổi.
//  2. Sau khi tải lại trang, "ảnh chụp đã đồng bộ" được dựng lại từ cache nên ô sửa lúc mất mạng
//     KHÔNG còn bị coi là đã đổi → bản server cũ ghi đè. NAY: hàng đợi (outbox) lưu bền trong
//     localStorage, tự gửi lại khi có mạng và luôn được áp lại lên dữ liệu server tải về.
//  3. Báo "đã lưu" khi Firebase chưa xác nhận. NAY: chỉ báo thành công sau khi Firebase trả OK.
//  4. Mỗi ô sửa kéo theo 1 lần PUT cả nhật ký 300 dòng. NAY: gộp, ghi 1 dòng tóm tắt mỗi đợt.
// ════════════════════════════════════════════════════════════════════════════

function flattenAttendance(att){
  var m = {};
  Object.keys(att||{}).forEach(function(ym){
    var ws = att[ym] || {};
    Object.keys(ws).forEach(function(wid){
      var row = ws[wid]; if(!row || typeof row !== 'object') return;
      Object.keys(row).forEach(function(d){
        var v = row[d]; if(v === null || v === undefined || v === '') return;
        m[ym + '|' + wid + '|' + d] = String(v);
      });
    });
  });
  return m;
}
function unflattenAttendance(map){
  var att = {};
  Object.keys(map).forEach(function(key){
    var i = key.indexOf('|'), j = key.lastIndexOf('|');
    if(i < 0 || j <= i) return;
    var ym = key.slice(0,i), wid = key.slice(i+1,j), d = key.slice(j+1);
    if(!att[ym]) att[ym] = {}; if(!att[ym][wid]) att[ym][wid] = {};
    att[ym][wid][d] = map[key];
  });
  return att;
}
var _lastSyncedAttendanceSnapshot = {};   // giữ tên cũ cho sync.js / sync-realtime.js

var ATT_OUTBOX_KEY = 'sx_att_outbox_v2';
var ATT_AUDIT_Q_KEY = 'sx_att_audit_q_v1';
var ATT_META_KEY = 'sx_att_meta_v1';

function _attLsGet(k, def){ try{ var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; }catch(e){ return def; } }
function _attLsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

var _attOutbox = _attLsGet(ATT_OUTBOX_KEY, {});      // {khoá: {kind,path,key,v,seq,ym,wid,day,ts}}
var _attAuditQ = _attLsGet(ATT_AUDIT_Q_KEY, []);     // [{ym, rec}]
var _attSeq = 0; Object.keys(_attOutbox).forEach(function(k){ _attSeq = Math.max(_attSeq, _attOutbox[k].seq||0); });
if(!DB.attMeta) DB.attMeta = _attLsGet(ATT_META_KEY, {}) || {};

function attActor(){ return (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.name || currentUser.username || currentUser.id || '?') : 'system'; }
function attPendingCount(){ return Object.keys(_attOutbox).length; }
function _attSaveOutbox(){ _attLsSet(ATT_OUTBOX_KEY, _attOutbox); }
function _attSaveMeta(){ _attLsSet(ATT_META_KEY, DB.attMeta || {}); }

// ── Trạng thái đồng bộ để giao diện hiển thị ────────────────────────
var _attSync = {state:'idle', lastOkAt:0, lastError:''};   // idle | sending | error | offline
var _attSyncListeners = [];
function attOnSyncChange(fn){ _attSyncListeners.push(fn); }
function attSyncInfo(){ return {state:_attSync.state, pending:attPendingCount(), lastOkAt:_attSync.lastOkAt, error:_attSync.lastError}; }
function _attNotify(){ _attSyncListeners.forEach(function(f){ try{ f(attSyncInfo()); }catch(e){} }); }
function _attSetState(s, err){
  _attSync.state = s; if(err !== undefined) _attSync.lastError = err;
  if(s === 'idle') _attSync.lastOkAt = Date.now();
  _attNotify();
}

// ── Áp thao tác vào bộ nhớ ─────────────────────────────────────────
function _attApplyCellLocal(ym, wid, day, v){
  if(!DB.attendance) DB.attendance = {};
  if(v === null || v === ''){
    if(DB.attendance[ym] && DB.attendance[ym][wid]) delete DB.attendance[ym][wid][day];
    return;
  }
  if(!DB.attendance[ym]) DB.attendance[ym] = {};
  if(!DB.attendance[ym][wid]) DB.attendance[ym][wid] = {};
  DB.attendance[ym][wid][day] = String(v);
}
function _attMetaMonth(ym, create){
  if(!DB.attMeta) DB.attMeta = {};
  if(!DB.attMeta.months){ if(!create) return null; DB.attMeta.months = {}; }
  if(!DB.attMeta.months[ym]){ if(!create) return null; DB.attMeta.months[ym] = {}; }
  return DB.attMeta.months[ym];
}
function _attApplyOpLocal(op){
  if(op.kind === 'cell') _attApplyCellLocal(op.ym, op.wid, op.day, op.v);
  else if(op.kind === 'note'){
    var mm = _attMetaMonth(op.ym, true); if(!mm.notes) mm.notes = {};
    if(op.v === null || op.v === '') delete mm.notes[op.wid]; else mm.notes[op.wid] = String(op.v);
  } else if(op.kind === 'holiday'){
    if(!DB.attMeta) DB.attMeta = {};
    if(!DB.attMeta.holidays) DB.attMeta.holidays = {};
    if(op.v === null) delete DB.attMeta.holidays[op.key]; else DB.attMeta.holidays[op.key] = String(op.v);
  } else if(typeof schApplyOpLocal === 'function') schApplyOpLocal(op);   // [GĐ2] phân ca / tăng ca / danh mục ca
}
// Áp lại MỌI thao tác chưa gửi lên dữ liệu vừa nhận từ server → không bao giờ bị bản cũ ghi đè.
function attReapplyOutbox(){
  Object.keys(_attOutbox).forEach(function(k){ _attApplyOpLocal(_attOutbox[k]); });
}
function _attQueue(op){
  op.seq = ++_attSeq; op.ts = Date.now();
  _attOutbox[op.kind + '|' + op.path + '|' + op.key] = op;
  _attSaveOutbox();
  _attNotify();
}

// ── Gửi lên Firebase (PATCH theo từng ô) ────────────────────────────
var _attFlushing = null, _attFlushAgain = false, _attRetryTimer = null, _attRetryN = 0, _attDebounce = null, _attLsTimer = null, _attAuditBusy = false;
function attScheduleFlush(ms){
  if(_attDebounce) clearTimeout(_attDebounce);
  _attDebounce = setTimeout(function(){ _attDebounce = null; attFlush(); }, ms == null ? 600 : ms);
}
function _attScheduleLs(){
  if(_attLsTimer) return;
  _attLsTimer = setTimeout(function(){ _attLsTimer = null; lsSave(); }, 400);   // lsSave() nặng → gộp
}
// Trả Promise {ok, pending, error?}. ok=true CHỈ khi Firebase đã xác nhận mọi thay đổi.
function attFlush(){
  if(_attFlushing){ _attFlushAgain = true; return _attFlushing; }
  var run = (async function(){
    var result = {ok:true, pending:0};
    try{
      do{
        _attFlushAgain = false;
        var keys = Object.keys(_attOutbox);
        if(!keys.length) break;
        if(!fbOk()){ _attOutbox = {}; _attSaveOutbox(); break; }       // chế độ chỉ-cục-bộ: không có gì để đồng bộ
        if(typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
        _attSetState('sending');
        var groups = {};
        keys.forEach(function(k){ var op = _attOutbox[k]; (groups[op.path] = groups[op.path] || []).push({k:k, seq:op.seq, key:op.key, v:op.v}); });
        var paths = Object.keys(groups);
        for(var i=0;i<paths.length;i++){
          var g = groups[paths[i]], body = {};
          g.forEach(function(x){ body[x.key] = (x.v === '' ? null : x.v); });     // null = xoá ô
          await fbWrite(paths[i], body, 'PATCH');                                   // ném lỗi nếu Firebase chưa OK
          g.forEach(function(x){ var cur = _attOutbox[x.k]; if(cur && cur.seq === x.seq) delete _attOutbox[x.k]; });
          _attSaveOutbox();
        }
      } while(_attFlushAgain || attPendingCount() > 0);
      _attRetryN = 0; if(_attRetryTimer){ clearTimeout(_attRetryTimer); _attRetryTimer = null; }
      result.pending = attPendingCount();
      _attSetState('idle', '');
      if(typeof setSyncDot === 'function') setSyncDot('ok');
      _attFlushAudit();                                                             // nền, không chờ
    }catch(e){
      result = {ok:false, pending:attPendingCount(), error:(e && e.message) || String(e)};
      var off = (typeof navigator !== 'undefined' && navigator.onLine === false) || result.error === 'offline' || /Failed to fetch|NetworkError|Load failed/i.test(result.error);
      _attSetState(off ? 'offline' : 'error', result.error);
      if(typeof setSyncDot === 'function') setSyncDot(off ? 'offline' : 'error');
      _attRetryN++;
      var wait = Math.min(60000, 3000 * Math.pow(2, Math.min(_attRetryN-1, 4)));
      if(_attRetryTimer) clearTimeout(_attRetryTimer);
      _attRetryTimer = setTimeout(function(){ _attRetryTimer = null; attFlush(); }, wait);
    }
    return result;
  })();
  _attFlushing = run;
  run.then(function(){ _attFlushing = null; }, function(){ _attFlushing = null; });
  return run;
}
if(typeof window !== 'undefined' && window.addEventListener){
  window.addEventListener('online', function(){ if(attPendingCount()) attFlush(); });
  window.addEventListener('pagehide', function(){ try{ lsSave(); }catch(e){} });
}

// ── Nhật ký chỉnh sửa (người sửa · thời gian · nội dung) ────────────
// Ghi vào /attAudit/{YYYY-MM} bằng POST (chỉ thêm, không bao giờ ghi đè). Nếu Firebase Rules chưa
// cho phép nhánh này thì giữ trong hàng đợi cục bộ (không chặn chấm công) — xem docs/HANDOVER-GD1.md.
function attAuditPush(ym, rec){
  rec.t = Date.now(); rec.by = attActor(); rec.uid = (typeof currentUser !== 'undefined' && currentUser && currentUser.id) || '';
  _attAuditQ.push({ym:ym, rec:rec});
  if(_attAuditQ.length > 3000) _attAuditQ = _attAuditQ.slice(-3000);
  _attLsSet(ATT_AUDIT_Q_KEY, _attAuditQ);
}
async function _attFlushAudit(){
  if(_attAuditBusy || !_attAuditQ.length || !fbOk()) return;
  _attAuditBusy = true;
  var batch = _attAuditQ.slice(0, 200), sent = 0;
  try{
    for(var i=0;i<batch.length;i++){ await fbWrite('/attAudit/' + batch[i].ym, batch[i].rec, 'POST'); sent++; }
  }catch(e){ /* giữ lại để gửi lần sau */ }
  if(sent){ _attAuditQ = _attAuditQ.slice(sent); _attLsSet(ATT_AUDIT_Q_KEY, _attAuditQ); }
  _attAuditBusy = false;
}
async function attAuditLoad(ym){
  var out = [];
  try{ var data = await fbRead('/attAudit/' + ym); if(data) Object.keys(data).forEach(function(k){ out.push(data[k]); }); }catch(e){}
  _attAuditQ.forEach(function(q){ if(q.ym === ym) out.push(q.rec); });     // gồm cả bản ghi chưa gửi
  out.sort(function(a,b){ return (b.t||0) - (a.t||0); });
  return out.slice(0, 500);
}
// log() hiện có ghi đè cả /log mỗi lần gọi → chỉ ghi 1 dòng tóm tắt cho mỗi đợt sửa.
var _attLogTimer = null, _attLogAcc = {};
function _attLogSummary(ym, n){
  _attLogAcc[ym] = (_attLogAcc[ym] || 0) + n;
  if(_attLogTimer) return;
  _attLogTimer = setTimeout(function(){
    var acc = _attLogAcc; _attLogAcc = {}; _attLogTimer = null;
    Object.keys(acc).forEach(function(y){ try{ log('Chấm công', 'Tháng ' + y.split('-')[1] + '/' + y.split('-')[0] + ' · đã sửa ' + acc[y] + ' ô công', ''); }catch(e){} });
  }, 5000);
}

// ── Khoá kỳ chấm công ───────────────────────────────────────────────
function attLockInfo(ym){ var m = _attMetaMonth(ym, false); return (m && m.lock) ? m.lock : null; }
function attIsLocked(ym){ return !!attLockInfo(ym); }
function attHolidays(){ return (DB.attMeta && DB.attMeta.holidays) || {}; }
function attNoteOf(ym, wid){ var m = _attMetaMonth(ym, false); return (m && m.notes && m.notes[wid]) || ''; }

// ── Sửa 1 ô ─────────────────────────────────────────────────────────
// Trả {ok, changed, reason, old}. reason: viewer | locked | invalid | noworker | badday
function attSetCell(ym, wid, day, raw){
  if(typeof isViewer === 'function' && isViewer()) return {ok:false, reason:'viewer'};
  if(!attValidYM(ym)) return {ok:false, reason:'badday'};
  day = parseInt(day, 10);
  if(!(day >= 1 && day <= attDaysIn(ym))) return {ok:false, reason:'badday'};
  if(attIsLocked(ym)) return {ok:false, reason:'locked'};
  var w = (DB.workers||[]).find(function(x){ return x.id === wid; });
  if(!w) return {ok:false, reason:'noworker'};
  var v = String(raw == null ? '' : raw).trim();
  if(!attCellValid(v)) return {ok:false, reason:'invalid'};
  var cur = DB.attendance && DB.attendance[ym] && DB.attendance[ym][wid] ? DB.attendance[ym][wid][day] : undefined;
  var old = (cur === undefined || cur === null) ? '' : String(cur);
  if(old === v) return {ok:true, changed:false, old:old};
  _attApplyCellLocal(ym, wid, day, v === '' ? null : v);
  _attQueue({kind:'cell', path:'/data/attendance/' + ym + '/' + wid, key:String(day), v:(v === '' ? null : v), ym:ym, wid:wid, day:day});
  attAuditPush(ym, {ty:'cell', wid:wid, wn:w.name||'', d:day, o:old, n:v});
  _attLogSummary(ym, 1);
  _attScheduleLs(); attScheduleFlush();
  return {ok:true, changed:true, old:old};
}

// ── Áp nhiều thay đổi 1 lần (chấm hàng loạt / sao chép) ─────────────
// changes: [{wid, day, new}] — đã được attPlanBulk lập và người dùng đã xác nhận.
// Trả Promise {ok, applied, pending, error?}; ok=true khi Firebase ĐÃ xác nhận.
async function attApplyBulk(ym, changes, label){
  if(typeof isViewer === 'function' && isViewer()) return {ok:false, reason:'viewer', applied:0};
  if(attIsLocked(ym)) return {ok:false, reason:'locked', applied:0};
  var applied = 0, detail = [];
  changes.forEach(function(c){
    var w = (DB.workers||[]).find(function(x){ return x.id === c.wid; }); if(!w) return;
    var v = String(c.new == null ? '' : c.new).trim(); if(!attCellValid(v)) return;
    var cur = DB.attendance && DB.attendance[ym] && DB.attendance[ym][c.wid] ? DB.attendance[ym][c.wid][c.day] : undefined;
    var old = (cur === undefined || cur === null) ? '' : String(cur);
    if(old === v) return;
    _attApplyCellLocal(ym, c.wid, c.day, v === '' ? null : v);
    _attQueue({kind:'cell', path:'/data/attendance/' + ym + '/' + c.wid, key:String(c.day), v:(v === '' ? null : v), ym:ym, wid:c.wid, day:c.day});
    applied++; if(detail.length < 300) detail.push([c.wid, c.day, old, v]);
  });
  if(!applied) return {ok:true, applied:0, pending:attPendingCount()};
  attAuditPush(ym, {ty:'bulk', m:label||'Chấm hàng loạt', c:applied, det:detail, trunc:applied > detail.length});
  _attLogSummary(ym, applied);
  lsSave();
  var r = await attFlush();
  return {ok:r.ok, applied:applied, pending:r.pending, error:r.error};
}

// ── Ghi chú theo người-tháng & ngày lễ (cũng đi qua outbox) ──────────
function attSetNote(ym, wid, text){
  if(typeof isViewer === 'function' && isViewer()) return {ok:false, reason:'viewer'};
  if(attIsLocked(ym)) return {ok:false, reason:'locked'};
  text = String(text||'').trim().slice(0, 300);
  if(attNoteOf(ym, wid) === text) return {ok:true, changed:false};
  var op = {kind:'note', path:'/data/attMeta/months/' + ym + '/notes', key:wid, v:(text === '' ? null : text), ym:ym, wid:wid};
  _attApplyOpLocal(op); _attQueue(op); _attSaveMeta();
  attAuditPush(ym, {ty:'note', wid:wid, n:text});
  attScheduleFlush();
  return {ok:true, changed:true};
}
function attSetHoliday(dateStr, name){            // chỉ Admin (kiểm ở giao diện + tại đây)
  if(typeof isAdmin === 'function' && !isAdmin()) return {ok:false, reason:'noperm'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return {ok:false, reason:'badday'};
  var op = {kind:'holiday', path:'/data/attMeta/holidays', key:dateStr, v:(name ? String(name).trim().slice(0,60) : null), ym:dateStr.slice(0,7)};
  _attApplyOpLocal(op); _attQueue(op); _attSaveMeta();
  attAuditPush(dateStr.slice(0,7), {ty:'holiday', d:dateStr, n:name||'(xoá)'});
  attScheduleFlush();
  return {ok:true};
}

// ── Chốt / mở khoá kỳ ───────────────────────────────────────────────
// Chốt: bắt buộc mọi thay đổi đã lên Firebase trước (không chốt dữ liệu chưa đồng bộ).
async function attLockMonth(ym){
  if(typeof isViewer === 'function' && isViewer()) return {ok:false, reason:'viewer'};
  if(attIsLocked(ym)) return {ok:true, already:true};
  var f = await attFlush();
  if(!f.ok || f.pending > 0) return {ok:false, reason:'unsynced', pending:f.pending, error:f.error};
  var lock = {by: attActor(), uid: (typeof currentUser !== 'undefined' && currentUser && currentUser.id) || '', at: Date.now()};
  try{ if(fbOk()) await fbWrite('/data/attMeta/months/' + ym, {lock:lock, lastUnlock:null}, 'PATCH'); }
  catch(e){ return {ok:false, reason:'network', error:e.message}; }
  var mm = _attMetaMonth(ym, true); mm.lock = lock; delete mm.lastUnlock; _attSaveMeta();
  attAuditPush(ym, {ty:'lock', m:'Chốt kỳ chấm công'});
  try{ log('Chốt chấm công', 'Tháng ' + ym.split('-')[1] + '/' + ym.split('-')[0], ''); }catch(e){}
  attScheduleFlush(50);
  return {ok:true};
}
async function attUnlockMonth(ym, reason){
  if(typeof isAdmin === 'function' && !isAdmin()) return {ok:false, reason:'noperm'};     // CHỈ ADMIN
  reason = String(reason||'').trim();
  if(!reason) return {ok:false, reason:'noreason'};
  if(!attIsLocked(ym)) return {ok:true, already:true};
  var info = {by: attActor(), at: Date.now(), reason: reason.slice(0,200)};
  try{ if(fbOk()) await fbWrite('/data/attMeta/months/' + ym, {lock:null, lastUnlock:info}, 'PATCH'); }
  catch(e){ return {ok:false, reason:'network', error:e.message}; }
  var mm = _attMetaMonth(ym, true); delete mm.lock; mm.lastUnlock = info; _attSaveMeta();
  attAuditPush(ym, {ty:'unlock', m:'Mở khoá kỳ: ' + info.reason});
  try{ log('Mở khoá chấm công', 'Tháng ' + ym.split('-')[1] + '/' + ym.split('-')[0] + ' · ' + info.reason, ''); }catch(e){}
  attScheduleFlush(50);
  return {ok:true};
}

// ── Nhận dữ liệu từ server (móc vào sync.js / sync-realtime.js) ──────
// Trả true nếu dữ liệu hiển thị thay đổi.
function attOnSnapshot(data){
  var changed = false; if(!data) return false;
  if(data.attendance !== undefined && data.attendance !== null){
    var norm = attNormalize(data.attendance);
    var prevFlat = flattenAttendance(DB.attendance);
    DB.attendance = norm; attReapplyOutbox();
    var fa = flattenAttendance(DB.attendance);
    if(!attFlatEqual(fa, prevFlat)) changed = true;
    _lastSyncedAttendanceSnapshot = fa;
  }
  if(data.attMeta !== undefined){
    var before = JSON.stringify(DB.attMeta || {});
    DB.attMeta = data.attMeta || {};
    attReapplyOutbox();
    if(JSON.stringify(DB.attMeta) !== before){ changed = true; _attSaveMeta(); }
  }
  if(typeof schOnSnapshot === 'function' && schOnSnapshot(data)) changed = true;   // [GĐ2]
  return changed;
}
function attOnBoot(){            // gọi ngay sau lsLoad(): ô chưa gửi từ phiên trước không bị mất khi tải lại trang
  DB.attendance = attNormalize(DB.attendance);
  if(typeof schOnBoot === 'function') schOnBoot();   // [GĐ2]
  attReapplyOutbox();
  if(attPendingCount()) setTimeout(function(){ attFlush(); }, 1500);
}
// SSE: /data/attendance/{ym}[/{wid}[/{ngày}]] hoặc /data/attMeta[/...]. Trả true nếu đã xử lý.
function attOnRealtime(path, val){
  var parts = path.split('/').filter(Boolean);       // ['data','attendance',ym,wid,day]
  if(parts[0] !== 'data') return false;
  if(typeof schOnRealtime === 'function'){ var sh = schOnRealtime(path, val); if(sh !== null) return true; }   // [GĐ2]
  var before = flattenAttendance(DB.attendance), beforeMeta = JSON.stringify(DB.attMeta || {});
  if(parts[1] === 'attendance'){
    if(parts.length === 2){ DB.attendance = attNormalize(val); }
    else if(parts.length === 3){ if(val == null) delete DB.attendance[parts[2]]; else DB.attendance[parts[2]] = attNormalize({x:val}).x; }
    else if(parts.length === 4){ if(!DB.attendance[parts[2]]) DB.attendance[parts[2]] = {}; if(val == null) delete DB.attendance[parts[2]][parts[3]]; else DB.attendance[parts[2]][parts[3]] = attNormalizeRow(val); }
    else if(parts.length === 5){ _attApplyCellLocal(parts[2], parts[3], parts[4], val == null ? null : val); }
    else return false;
  } else if(parts[1] === 'attMeta'){
    if(parts.length === 2) DB.attMeta = val || {};
    else {
      var node = DB.attMeta; if(!node) node = DB.attMeta = {};
      for(var i=2;i<parts.length-1;i++){ if(!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {}; node = node[parts[i]]; }
      if(val == null) delete node[parts[parts.length-1]]; else node[parts[parts.length-1]] = val;
    }
  } else return false;
  attReapplyOutbox();
  var after = flattenAttendance(DB.attendance), changed = !attFlatEqual(before, after) || JSON.stringify(DB.attMeta || {}) !== beforeMeta;
  _lastSyncedAttendanceSnapshot = after; _attSaveMeta();
  if(changed){ lsSave(); scheduleUIRefresh(true); }
  return true;
}

// ── Tương thích với mã cũ ───────────────────────────────────────────
// saveAttendance(): mã cũ gọi sau khi sửa DB.attendance trực tiếp. Giữ lại để không vỡ: đẩy outbox.
function saveAttendance(){ if(guardViewer()) return; lsSave(); attFlush(); }
// sync.js gọi hàm này khi phiên TRƯỚC (bản cũ) để lại dấu "dirty" cho chấm công: chỉ BỔ SUNG các ô
// cục bộ mà server chưa có (an toàn, không ghi đè ô server đã có), rồi dọn dấu.
async function mergeAndSaveAttendance(){
  try{
    var serverRaw = await fbRead('/data/attendance');
    var sf = flattenAttendance(attNormalize(serverRaw || {})), lf = flattenAttendance(DB.attendance);
    Object.keys(lf).forEach(function(k){
      if(k in sf) return;
      var i = k.indexOf('|'), j = k.lastIndexOf('|');
      var ym = k.slice(0,i), wid = k.slice(i+1,j), d = k.slice(j+1);
      _attQueue({kind:'cell', path:'/data/attendance/' + ym + '/' + wid, key:d, v:lf[k], ym:ym, wid:wid, day:parseInt(d,10)});
    });
  }catch(e){}
  var r = await attFlush();
  if(r.ok && typeof clearDirty === 'function') clearDirty('attendance');
  if(typeof endSave === 'function') endSave();
}

function saveLichLamViec(){if(guardViewer())return;
  lsSave();
  syncArrFieldToServer('lichLamViec', '/data/lichLamViec');
}
