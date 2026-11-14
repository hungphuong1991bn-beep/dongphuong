// src/modules/attendance/schedule-service.js  — GIAI ĐOẠN 2 (v2.7.0)
// Dữ liệu lịch làm việc theo ngày. TÁI SỬ DỤNG đúng cơ chế an toàn của chấm công (attendance-service.js):
//   hàng đợi bền (outbox) · PATCH từng ô · áp lại ô chưa gửi lên dữ liệu server · chỉ báo OK khi Firebase xác nhận.
//   /data/shiftAssign/{YYYY-MM}/{workerId}/{ngày} = shiftId
//   /data/otReg/{YYYY-MM}/{workerId}/{ngày}       = giờ tăng ca đăng ký
//   /data/shiftCatalog/{shiftId}                  = định nghĩa ca (chỉ phần Admin sửa/tạo)
// PHÂN QUYỀN: giữ đúng như Lịch làm việc hiện có — CHỈ ADMIN được phân ca / sửa danh mục / đăng ký tăng ca;
// nhân viên và Viewer chỉ xem. Kiểm ở tầng xử lý (không chỉ ẩn nút).
// Phân ca là dữ liệu RIÊNG, KHÔNG ghi vào bảng chấm công → đổi ca không làm sai công đã chốt.

var SCH_ROOTS = ['shiftAssign', 'otReg'];
var SCH_CACHE_KEY = 'sx_sch_cache_v1';
if(!DB.shiftAssign) DB.shiftAssign = {};
if(!DB.otReg) DB.otReg = {};
if(!DB.shiftCatalog) DB.shiftCatalog = {};
(function(){ var c = _attLsGet(SCH_CACHE_KEY, null); if(c){ DB.shiftAssign = c.shiftAssign || {}; DB.otReg = c.otReg || {}; DB.shiftCatalog = c.shiftCatalog || {}; } })();
var _schSaveTimer = null;
function schSaveCache(){
  if(_schSaveTimer) return;
  _schSaveTimer = setTimeout(function(){ _schSaveTimer = null; _attLsSet(SCH_CACHE_KEY, {shiftAssign:DB.shiftAssign, otReg:DB.otReg, shiftCatalog:DB.shiftCatalog}); }, 300);
}
function schCanEdit(){ return typeof isAdmin === 'function' && isAdmin(); }

// ── Áp thao tác vào bộ nhớ (cũng dùng khi áp lại hàng đợi lên dữ liệu server) ──
function schApplyOpLocal(op){
  if(op.kind === 'tree'){
    var root = DB[op.root] || (DB[op.root] = {});
    if(op.v === null || op.v === ''){ if(root[op.ym] && root[op.ym][op.wid]) delete root[op.ym][op.wid][op.day]; return; }
    if(!root[op.ym]) root[op.ym] = {}; if(!root[op.ym][op.wid]) root[op.ym][op.wid] = {};
    root[op.ym][op.wid][op.day] = String(op.v);
  } else if(op.kind === 'catalog'){
    if(!DB.shiftCatalog) DB.shiftCatalog = {};
    if(op.v === null) delete DB.shiftCatalog[op.key]; else DB.shiftCatalog[op.key] = op.v;
  }
}
function _schQueueCell(root, date, wid, v){
  var ym = date.slice(0,7), day = +date.slice(8,10);
  var op = {kind:'tree', root:root, path:'/data/' + root + '/' + ym + '/' + wid, key:String(day), v:(v === '' || v === null ? null : String(v)), ym:ym, wid:wid, day:day};
  schApplyOpLocal(op); _attQueue(op);
}

// ── Nhận từ server ──
function schOnSnapshot(data){
  var changed = false; if(!data) return false;
  SCH_ROOTS.forEach(function(r){
    if(data[r] === undefined || data[r] === null) return;
    var prev = flattenAttendance(DB[r]); DB[r] = attNormalize(data[r]);
    if(!attFlatEqual(prev, flattenAttendance(DB[r]))) changed = true;
  });
  if(data.shiftCatalog !== undefined){
    var before = JSON.stringify(DB.shiftCatalog || {}); DB.shiftCatalog = data.shiftCatalog || {};
    if(JSON.stringify(DB.shiftCatalog) !== before) changed = true;
  }
  attReapplyOutbox(); if(changed) schSaveCache();
  return changed;
}
// Trả null nếu path không thuộc lịch; true nếu đã xử lý.
function schOnRealtime(path, val){
  var parts = path.split('/').filter(Boolean);
  if(parts[0] !== 'data') return null;
  var root = parts[1];
  if(SCH_ROOTS.indexOf(root) >= 0){
    var before = flattenAttendance(DB[root]);
    if(parts.length === 2) DB[root] = attNormalize(val);
    else if(parts.length === 3){ if(val == null) delete DB[root][parts[2]]; else DB[root][parts[2]] = attNormalize({x:val}).x; }
    else if(parts.length === 4){ if(!DB[root][parts[2]]) DB[root][parts[2]] = {}; if(val == null) delete DB[root][parts[2]][parts[3]]; else DB[root][parts[2]][parts[3]] = attNormalizeRow(val); }
    else if(parts.length === 5){ schApplyOpLocal({kind:'tree', root:root, ym:parts[2], wid:parts[3], day:parts[4], v:val == null ? null : val}); }
    else return null;
    attReapplyOutbox(); var changed = !attFlatEqual(before, flattenAttendance(DB[root])); schSaveCache();
    if(changed){ lsSave(); scheduleUIRefresh(true); } return true;
  }
  if(root === 'shiftCatalog'){
    var b = JSON.stringify(DB.shiftCatalog || {});
    if(parts.length === 2) DB.shiftCatalog = val || {};
    else if(parts.length === 3){ if(val == null) delete DB.shiftCatalog[parts[2]]; else DB.shiftCatalog[parts[2]] = val; }
    else return null;
    attReapplyOutbox(); schSaveCache();
    if(JSON.stringify(DB.shiftCatalog) !== b){ lsSave(); scheduleUIRefresh(true); } return true;
  }
  return null;
}
function schOnBoot(){ DB.shiftAssign = attNormalize(DB.shiftAssign); DB.otReg = attNormalize(DB.otReg); }

// ── Phân ca ──
function schFail(reason){ return {ok:false, reason:reason, applied:0}; }
// changes: [{wid,date,new}] — đã được kế hoạch lập & người dùng đã xác nhận. Trả Promise {ok, applied, pending, error?}.
async function schApplyAssign(changes, label){
  if(typeof isViewer === 'function' && isViewer()) return schFail('viewer');
  if(!schCanEdit()) return schFail('noperm');
  var cat = {}; schCatalog(true).forEach(function(s){ cat[s.id] = s; });
  var applied = 0, detail = [], byYm = {};
  changes.forEach(function(c){
    var w = (DB.workers || []).find(function(x){ return x.id === c.wid; }); if(!w || !schValidDate(c.date)) return;
    var nv = c.new == null ? '' : String(c.new); if(nv && !cat[nv]) return;
    var old = schAssigned(w, c.date); if(old === nv) return;
    _schQueueCell('shiftAssign', c.date, c.wid, nv); applied++;
    var ym = c.date.slice(0,7); byYm[ym] = (byYm[ym] || 0) + 1;
    if(detail.length < 300) detail.push([c.wid, c.date, old, nv]);
  });
  if(!applied) return {ok:true, applied:0, pending:attPendingCount()};
  var first = Object.keys(byYm).sort()[0];
  attAuditPush(first, {ty:'schAssign', m:label || 'Phân ca', c:applied, det:detail, trunc:applied > detail.length});
  try{ log('Lịch làm việc', (label || 'Phân ca') + ' · ' + applied + ' ô', ''); }catch(e){}
  schSaveCache(); lsSave();
  var r = await attFlush();
  return {ok:r.ok, applied:applied, pending:r.pending, error:r.error};
}
function schSetAssign(date, wid, shiftId, label){ return schApplyAssign([{wid:wid, date:date, new:shiftId}], label || 'Đổi ca 1 người'); }

// ── Đăng ký tăng ca ──
function schSetOT(date, wid, hours){
  if(typeof isViewer === 'function' && isViewer()) return schFail('viewer');
  if(!schCanEdit()) return schFail('noperm');
  var w = (DB.workers || []).find(function(x){ return x.id === wid; }); if(!w || !schValidDate(date)) return schFail('badday');
  var s = String(hours == null ? '' : hours).trim().replace(',', '.');
  if(s !== '' && !(/^\d{1,2}(\.\d)?$/.test(s) && parseFloat(s) > 0 && parseFloat(s) <= 24)) return schFail('invalid');
  var cur = (DB.otReg[date.slice(0,7)] && DB.otReg[date.slice(0,7)][wid] && DB.otReg[date.slice(0,7)][wid][+date.slice(8,10)]) || '';
  if(String(cur) === s) return {ok:true, changed:false};
  _schQueueCell('otReg', date, wid, s);
  attAuditPush(date.slice(0,7), {ty:'schOT', wid:wid, wn:w.name || '', d:date, o:String(cur), n:s});
  schSaveCache(); lsSave(); attScheduleFlush();
  return {ok:true, changed:true};
}

// ── Danh mục ca (Admin) ──
// def: {id?, name, start, end, breakMin, minStaff, type, kind}. Ca có sẵn chỉ sửa được phần cấu hình, không xoá; ca tự tạo có thể ngừng dùng.
async function schSaveShift(def){
  if(typeof isViewer === 'function' && isViewer()) return schFail('viewer');
  if(!schCanEdit()) return schFail('noperm');
  var existing = schCatalog(true);
  var id = def.id || ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2,5));
  var cur = schShiftById(id);
  var merged = {id:id, name:String(def.name||'').trim(), start:def.start||'', end:def.end||'', breakMin:parseInt(def.breakMin,10)||0,
    minStaff:parseInt(def.minStaff,10)||0, type:def.type||'', kind:(cur && cur.kind) || def.kind || 'work', active:def.active !== false};
  var errs = schValidateShift(merged, existing);
  if(errs.length) return {ok:false, reason:'invalid', errors:errs};
  var rec = {name:merged.name, start:merged.start, end:merged.end, breakMin:merged.breakMin, minStaff:merged.minStaff, type:merged.type, active:merged.active};
  if(!SCH_BUILTIN[id]){
    var idx = Object.keys(DB.shiftCatalog || {}).length;
    var col = SCH_DEFAULT_COLORS[idx % SCH_DEFAULT_COLORS.length];
    rec.kind = merged.kind; rec.color = (DB.shiftCatalog[id] && DB.shiftCatalog[id].color) || col[0]; rec.bg = (DB.shiftCatalog[id] && DB.shiftCatalog[id].bg) || col[1];
    rec.createdAt = (DB.shiftCatalog[id] && DB.shiftCatalog[id].createdAt) || Date.now();
  }
  var op = {kind:'catalog', path:'/data/shiftCatalog', key:id, v:rec};
  schApplyOpLocal(op); _attQueue(op);
  attAuditPush(schYMD(new Date()).slice(0,7), {ty:'schShift', m:(cur ? 'Sửa ca ' : 'Tạo ca ') + rec.name + ' (' + (rec.start || '—') + '–' + (rec.end || '—') + ', nghỉ ' + rec.breakMin + "', tối thiểu " + rec.minStaff + ')'});
  schSaveCache(); lsSave();
  var r = await attFlush();
  return {ok:r.ok, id:id, pending:r.pending, error:r.error};
}
async function schSetShiftActive(id, active){
  var s = schShiftById(id); if(!s) return schFail('badday');
  if(SCH_BUILTIN[id] && id !== 'tangca') { /* ca có sẵn vẫn có thể ngừng dùng, dữ liệu cũ giữ nguyên */ }
  return schSaveShift({id:id, name:s.name, start:s.start, end:s.end, breakMin:s.breakMin, minStaff:s.minStaff, type:s.type, kind:s.kind, active:active});
}
async function schAuditLoad(ym){
  var all = await attAuditLoad(ym);
  return all.filter(function(a){ return /^sch/.test(a.ty || ''); });
}
