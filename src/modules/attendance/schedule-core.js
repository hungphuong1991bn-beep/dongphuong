// src/modules/attendance/schedule-core.js  — GIAI ĐOẠN 2 (v2.7.0)
// Logic THUẦN của Lịch làm việc theo NGÀY (không DOM, không ghi dữ liệu → dễ kiểm thử).
//
// MÔ HÌNH DỮ LIỆU MỚI (nhánh riêng, KHÔNG đụng lichLamViec cũ):
//   DB.shiftCatalog[shiftId]            = {name,start,end,breakMin,minStaff,type,active,...}  (chỉ lưu phần Admin đã sửa/tạo thêm)
//   DB.shiftAssign[YYYY-MM][wid][ngày]  = shiftId   (phân ca RIÊNG theo ngày — ghi từng ô như chấm công)
//   DB.otReg[YYYY-MM][wid][ngày]        = số giờ tăng ca ĐĂNG KÝ
// Khi chưa phân riêng cho một ngày, ca được suy ra từ bảng "Lịch làm việc theo bộ phận" cũ (khớp theo TÊN)
// và được đánh dấu "mặc định" — không bao giờ coi là dữ liệu đã phân.
//
// CẦN XÁC NHẬN VỚI DOANH NGHIỆP (không tự suy diễn): thời gian nghỉ giữa ca, quân số tối thiểu mỗi ca
// (mặc định 0 = chưa đặt → không cảnh báo thiếu), phân loại ca cố định/luân phiên, và việc ca mặc định có áp
// dụng cho Chủ nhật/ngày lễ hay không (hiện: KHÔNG áp dụng cho Chủ nhật & ngày lễ, chỉ ngày đã phân riêng mới tính).

var SCH_BUILTIN = {
  ca1:   {id:'ca1',   name:'Ca 1',        start:'06:00', end:'14:00', kind:'work', color:'#1d4ed8', bg:'#eff6ff', builtin:true},
  ca2:   {id:'ca2',   name:'Ca 2',        start:'14:00', end:'22:00', kind:'work', color:'#b45309', bg:'#fffbeb', builtin:true},
  ca3:   {id:'ca3',   name:'Ca 3',        start:'22:00', end:'06:00', kind:'work', color:'#6d28d9', bg:'#f5f3ff', builtin:true},
  hc:    {id:'hc',    name:'Hành chính',  start:'07:00', end:'17:00', kind:'work', color:'#047857', bg:'#ecfdf5', builtin:true},
  tangca:{id:'tangca',name:'Tăng ca',     start:'06:00', end:'17:00', kind:'ot',   color:'#c2410c', bg:'#fff7ed', builtin:true},
  nghi:  {id:'nghi',  name:'Nghỉ',        start:'',      end:'',      kind:'off',  color:'#0e7490', bg:'#ecfeff', builtin:true}
};
var SCH_BUILTIN_ORDER = ['ca1','ca2','ca3','hc','tangca','nghi'];
var SCH_DEFAULT_COLORS = [['#0369a1','#e0f2fe'],['#a21caf','#fae8ff'],['#be123c','#ffe4e6'],['#4d7c0f','#ecfccb'],['#b45309','#fef3c7'],['#0f766e','#ccfbf1']];

function schPad(n){ return String(n).padStart(2,'0'); }
function schYMD(d){ return d.getFullYear() + '-' + schPad(d.getMonth()+1) + '-' + schPad(d.getDate()); }
function schParse(ds){ var p = String(ds).split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); }
function schValidDate(ds){ if(!/^\d{4}-\d{2}-\d{2}$/.test(ds||'')) return false; var d = schParse(ds); return schYMD(d) === ds; }
function schAddDays(ds, n){ var d = schParse(ds); d.setDate(d.getDate() + n); return schYMD(d); }
function schDow(ds){ return (schParse(ds).getDay() + 6) % 7; }           // 0 = Thứ 2 … 6 = Chủ nhật
function schMonday(ds){ return schAddDays(ds, -schDow(ds)); }
function schWeekDates(ds){ var m = schMonday(ds), out = []; for(var i=0;i<7;i++) out.push(schAddDays(m, i)); return out; }
function schMonthDates(ym){ var n = attDaysIn(ym), out = []; for(var d=1; d<=n; d++) out.push(ym + '-' + schPad(d)); return out; }
function schDiffDays(a, b){ return Math.round((schParse(b) - schParse(a)) / 86400000); }
function schRange(from, to){ var out = [], n = schDiffDays(from, to); for(var i=0;i<=n && i<=400;i++) out.push(schAddDays(from, i)); return out; }
function schIsSunday(ds){ return schParse(ds).getDay() === 0; }
function schMonthPrev(ym){ return attShiftYM(ym, -1); }

// ── Danh mục ca = ca có sẵn + phần Admin đã sửa + ca Admin tạo thêm ──
function schMergedShift(id, ov){
  var base = SCH_BUILTIN[id] || {id:id, name:id, start:'', end:'', kind:'work', color:'#0369a1', bg:'#e0f2fe', builtin:false};
  var o = Object.assign({}, base, ov || {});
  o.id = id; o.minStaff = Math.max(0, parseInt(o.minStaff, 10) || 0); o.breakMin = Math.max(0, parseInt(o.breakMin, 10) || 0);
  o.active = (ov && ov.active === false) ? false : true; o.type = o.type || '';
  return o;
}
function schCatalog(includeInactive){
  var cat = (DB.shiftCatalog && typeof DB.shiftCatalog === 'object') ? DB.shiftCatalog : {};
  var list = SCH_BUILTIN_ORDER.map(function(id){ return schMergedShift(id, cat[id]); });
  Object.keys(cat).filter(function(id){ return !SCH_BUILTIN[id] && cat[id]; })
    .sort(function(a, b){ return (cat[a].createdAt||0) - (cat[b].createdAt||0); })
    .forEach(function(id){ list.push(schMergedShift(id, cat[id])); });
  return includeInactive ? list : list.filter(function(s){ return s.active; });
}
function schShiftById(id){ if(!id) return null; var cat = DB.shiftCatalog || {}; if(!SCH_BUILTIN[id] && !cat[id]) return null; return schMergedShift(id, cat[id]); }
function schTimeToMin(t){ var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function schValidTime(t){ var m = schTimeToMin(t); return m !== null && m < 24*60 && (t.split(':')[1] < 60); }
// Số giờ làm của ca (đã trừ nghỉ giữa ca); ca qua nửa đêm (22:00→06:00) tính đúng.
function schShiftHours(s){
  var a = schTimeToMin(s.start), b = schTimeToMin(s.end); if(a === null || b === null) return null;
  var mins = (b - a + 24*60) % (24*60); if(mins === 0) mins = 24*60;
  return Math.round(Math.max(0, mins - (s.breakMin||0)) / 6) / 10;
}
function schShiftLabel(s){ return s ? (s.start && s.end ? s.name + ' · ' + s.start + '–' + s.end : s.name) : 'Chưa phân ca'; }
function schValidateShift(def, existing){
  var errs = [];
  if(!def.name || !String(def.name).trim()) errs.push('Nhập tên ca');
  if(def.kind !== 'off'){
    if(!schValidTime(def.start)) errs.push('Giờ bắt đầu không hợp lệ (HH:MM)');
    if(!schValidTime(def.end)) errs.push('Giờ kết thúc không hợp lệ (HH:MM)');
    if(schValidTime(def.start) && schValidTime(def.end) && def.start === def.end) errs.push('Giờ bắt đầu và kết thúc không được trùng nhau');
    var br = parseInt(def.breakMin, 10); if(isNaN(br) || br < 0 || br > 240) errs.push('Nghỉ giữa ca 0–240 phút');
  }
  var ms = parseInt(def.minStaff, 10); if(isNaN(ms) || ms < 0 || ms > 999) errs.push('Quân số tối thiểu 0–999');
  var nm = String(def.name||'').trim().toLowerCase();
  (existing || []).forEach(function(s){ if(s.id !== def.id && s.active && s.name.trim().toLowerCase() === nm) errs.push('Đã có ca tên "' + def.name.trim() + '"'); });
  return errs;
}

// ── Ca mặc định suy ra từ bảng lịch bộ phận CŨ (khớp tên). Trả {tênChữThường: shiftId} ──
function schLegacyMap(){
  var m = {}, dup = {};
  (DB.lichLamViec || []).forEach(function(sheet){ (sheet.rows || []).forEach(function(r){
    var nm = r.wid ? 'id:' + r.wid : (r.name || '').trim().toLowerCase(); if(!nm || nm === 'id:') return;
    var k = (typeof llvShiftKey === 'function') ? llvShiftKey(r.time) : 'khac';
    if(k === 'khac') return;
    if(m[nm] && m[nm] !== k){ dup[nm] = true; }
    if(!m[nm]) m[nm] = k;
  }); });
  return {map:m, dup:dup};
}

// ── Ngữ cảnh tính toán (cache nghỉ phép theo người-tháng để không tính lại) ──
function schMakeCtx(){
  var lg = schLegacyMap();
  return {legacy:lg.map, dup:lg.dup, hol:(typeof attHolidays === 'function' ? attHolidays() : {}), leaveCache:{}, cat:schCatalog(true).reduce(function(o,s){ o[s.id] = s; return o; }, {})};
}
function schLeaveOn(ctx, w, ds){
  var ym = ds.slice(0,7), key = w.id + '|' + ym;
  if(!ctx.leaveCache[key]) ctx.leaveCache[key] = attLeaveDays(w, ym, DB.nghiPhep || []);
  return ctx.leaveCache[key][+ds.slice(8,10)] || '';
}
function schAssigned(w, ds){
  var r = DB.shiftAssign && DB.shiftAssign[ds.slice(0,7)] && DB.shiftAssign[ds.slice(0,7)][w.id];
  var v = r && r[+ds.slice(8,10)]; return v ? String(v) : '';
}
// Ca hiệu lực của 1 người trong 1 ngày: {id, src:'assigned'|'default'|''}
function schEffective(ctx, w, ds){
  var a = schAssigned(w, ds);
  if(a) return {id:a, src:'assigned'};
  if(schIsSunday(ds) || ctx.hol[ds]) return {id:'', src:''};
  var d = ctx.legacy['id:' + w.id] || ctx.legacy[(w.name || '').trim().toLowerCase()];
  return d ? {id:d, src:'default'} : {id:'', src:''};
}
function schOtReg(w, ds){
  var r = DB.otReg && DB.otReg[ds.slice(0,7)] && DB.otReg[ds.slice(0,7)][w.id];
  var v = r && r[+ds.slice(8,10)]; var n = parseFloat(String(v||'').replace(',', '.')); return isNaN(n) ? 0 : n;
}
function schOtActual(w, ds){
  var r = DB.attendance && DB.attendance[ds.slice(0,7)] && DB.attendance[ds.slice(0,7)][w.id];
  var v = r && r[+ds.slice(8,10)]; if(v === undefined || v === null || v === '') return 0;
  var i = attCellInfo(v); return i.state === 'ok' ? i.ot : 0;
}

// ── Danh sách nhân sự đưa vào lịch: lấy từ HR, chỉ người "Đang làm" (+ lọc bộ phận) ──
function schScopeWorkers(dept){
  return (DB.workers || []).filter(function(w){
    if((w.trangThai || 'Đang làm') !== 'Đang làm') return false;
    return !dept || dept === 'all' || (w.boPhan || '') === dept;
  }).sort(function(a, b){ return (a.name || '').localeCompare(b.name || '', 'vi'); });
}

// ── Điểm danh nhân lực 1 ngày ──
// Trả: {date, shifts:[{shift, items:[{w,src,ot,otActual,conflict}], actual, min, short}], leave:[{w,type}], ot:[], unassigned:[], conflicts:[], totals}
function schDayRoster(ds, dept, ctx){
  ctx = ctx || schMakeCtx();
  var workers = schScopeWorkers(dept), by = {}, leave = [], ot = [], un = [], conflicts = [];
  workers.forEach(function(w){
    var eff = schEffective(ctx, w, ds), lv = schLeaveOn(ctx, w, ds);
    var reg = schOtReg(w, ds), act = schOtActual(w, ds);
    if(reg > 0 || act > 0) ot.push({w:w, reg:reg, actual:act});
    var nm = ctx.dup['id:' + w.id] ? 'id:' + w.id : (w.name || '').trim().toLowerCase();
    if(eff.src === 'default' && ctx.dup[nm]) conflicts.push({w:w, code:'dup', text:'Xuất hiện ở nhiều bảng lịch bộ phận với ca khác nhau'});
    if(lv){ leave.push({w:w, type:lv}); var sh0 = ctx.cat[eff.id]; if(eff.src === 'assigned' && sh0 && sh0.kind !== 'off') conflicts.push({w:w, code:'leave', text:'Được xếp ' + sh0.name + ' nhưng có đơn nghỉ phép đã duyệt (' + lv + ')'}); return; }
    var sh = ctx.cat[eff.id];
    if(!eff.id || !sh){ if(eff.id && !sh) conflicts.push({w:w, code:'badshift', text:'Ca "' + eff.id + '" không còn trong danh mục'}); un.push(w); return; }
    if(sh.kind === 'off'){ leave.push({w:w, type:'Nghỉ (đã xếp)', planned:true}); return; }
    (by[sh.id] = by[sh.id] || []).push({w:w, src:eff.src, reg:reg, otActual:act});
  });
  var shifts = schCatalog(false).filter(function(s){ return s.kind !== 'off'; }).map(function(s){
    var items = by[s.id] || []; return {shift:s, items:items, actual:items.length, min:s.minStaff, short:Math.max(0, s.minStaff - items.length)};
  });
  Object.keys(by).forEach(function(id){ if(!shifts.some(function(x){ return x.shift.id === id; })){ var s = ctx.cat[id]; if(s) shifts.push({shift:s, items:by[id], actual:by[id].length, min:s.minStaff, short:Math.max(0, s.minStaff - by[id].length)}); } });
  var required = 0, covered = 0, actualAll = 0, short = 0;
  shifts.forEach(function(x){ required += x.min; covered += Math.min(x.actual, x.min); actualAll += x.actual; short += x.short; });
  return {date:ds, shifts:shifts, leave:leave, ot:ot, unassigned:un, conflicts:conflicts,
    totals:{workers:workers.length, required:required, actual:actualAll, short:short, leave:leave.length, ot:ot.length, unassigned:un.length,
            response: required > 0 ? Math.round(covered / required * 1000) / 10 : null}};
}
function schMonthSummary(ym, dept){
  var ctx = schMakeCtx();
  return schMonthDates(ym).map(function(ds){ var r = schDayRoster(ds, dept, ctx);
    return {date:ds, counts:r.shifts.filter(function(x){ return x.actual > 0 || x.min > 0; }).map(function(x){ return {id:x.shift.id, actual:x.actual, min:x.min, short:x.short}; }),
      leave:r.totals.leave, ot:r.totals.ot, short:r.totals.short, unassigned:r.totals.unassigned, conflicts:r.conflicts.length, workers:r.totals.workers}; });
}

// ── KẾ HOẠCH thay đổi (chỉ tính, chưa ghi). Mỗi thay đổi: {wid,name,date,old,new} — old = giá trị đã PHÂN RIÊNG (không tính mặc định). ──
function schBaseChange(w, ds, nv){ return {wid:w.id, name:w.name || '', date:ds, old:schAssigned(w, ds), new:nv}; }
function schFinishPlan(changes, sk){ return {changes:changes, skipped:sk}; }
// opt: {workers, from, to, shiftId ('' = bỏ phân riêng), mode:'empty'|'overwrite', skipSun, skipHol, skipLeave}
function schPlanAssign(opt){
  var ctx = opt.ctx || schMakeCtx(), ch = [], sk = {sun:0, hol:0, leave:0, kept:0, same:0, invalid:0};
  if(opt.shiftId && !ctx.cat[opt.shiftId]){ sk.invalid = 1; return schFinishPlan(ch, sk); }
  schRange(opt.from, opt.to).forEach(function(ds){
    (opt.workers || []).forEach(function(w){
      if(opt.skipSun && schIsSunday(ds)){ sk.sun++; return; }
      if(opt.skipHol && ctx.hol[ds]){ sk.hol++; return; }
      var nv = opt.shiftId || '';
      if(opt.skipLeave && nv && schLeaveOn(ctx, w, ds)){ sk.leave++; return; }
      var old = schAssigned(w, ds);
      if(old === nv){ sk.same++; return; }
      if(opt.mode !== 'overwrite' && old){ sk.kept++; return; }
      ch.push(schBaseChange(w, ds, nv));
    });
  });
  return schFinishPlan(ch, sk);
}
// Sao chép lịch HIỆU LỰC (đã phân riêng hoặc mặc định) từ khoảng nguồn sang khoảng đích.
// opt: {workers, srcFrom, dstFrom, days, mode, skipLeave}  (nguồn lệch đích theo số ngày cố định → giữ nguyên thứ trong tuần khi lệch 7)
function schPlanCopy(opt){
  var ctx = opt.ctx || schMakeCtx(), ch = [], sk = {empty:0, leave:0, kept:0, same:0};
  for(var i=0; i<opt.days; i++){
    var src = schAddDays(opt.srcFrom, i), dst = schAddDays(opt.dstFrom, i);
    (opt.workers || []).forEach(function(w){
      var eff = schEffective(ctx, w, src); if(!eff.id){ sk.empty++; return; }
      if(opt.skipLeave && schLeaveOn(ctx, w, dst)){ sk.leave++; return; }
      var old = schAssigned(w, dst);
      if(old === eff.id){ sk.same++; return; }
      if(opt.mode !== 'overwrite' && old){ sk.kept++; return; }
      ch.push(schBaseChange(w, dst, eff.id));
    });
  }
  return schFinishPlan(ch, sk);
}
// Sao chép tháng trước: ngày d của tháng trước → ngày d của tháng này (bỏ ngày không tồn tại).
function schPlanCopyMonth(opt){
  var ctx = opt.ctx || schMakeCtx(), prev = schMonthPrev(opt.ym), nPrev = attDaysIn(prev), ch = [], sk = {empty:0, leave:0, kept:0, same:0, nodate:0};
  schMonthDates(opt.ym).forEach(function(dst){
    var d = +dst.slice(8,10); if(d > nPrev){ sk.nodate++; return; }
    var src = prev + '-' + schPad(d);
    (opt.workers || []).forEach(function(w){
      var eff = schEffective(ctx, w, src); if(!eff.id){ sk.empty++; return; }
      if(opt.skipLeave && schLeaveOn(ctx, w, dst)){ sk.leave++; return; }
      var old = schAssigned(w, dst);
      if(old === eff.id){ sk.same++; return; }
      if(opt.mode !== 'overwrite' && old){ sk.kept++; return; }
      ch.push(schBaseChange(w, dst, eff.id));
    });
  });
  return schFinishPlan(ch, sk);
}
// Luân phiên theo tuần: người thứ i, tuần thứ k nhận ca shifts[(i+k+offset) % số ca].
function schPlanRotation(opt){
  var ctx = opt.ctx || schMakeCtx(), ch = [], sk = {sun:0, leave:0, kept:0, same:0, invalid:0}, list = opt.shifts || [];
  if(!list.length || list.some(function(id){ return !ctx.cat[id] || ctx.cat[id].kind === 'off'; })){ sk.invalid = 1; return schFinishPlan(ch, sk); }
  var start = schMonday(opt.from), workers = (opt.workers || []).slice().sort(function(a, b){ return (a.name||'').localeCompare(b.name||'', 'vi'); });
  for(var k=0; k<opt.weeks; k++){
    for(var dd=0; dd<7; dd++){
      var ds = schAddDays(start, k*7 + dd);
      if(ds < opt.from || ds > (opt.to || '9999-12-31')) continue;
      workers.forEach(function(w, i){
        if(opt.skipSun && schIsSunday(ds)){ sk.sun++; return; }
        var nv = list[(i + k + (opt.offset||0)) % list.length];
        if(opt.skipLeave && schLeaveOn(ctx, w, ds)){ sk.leave++; return; }
        var old = schAssigned(w, ds);
        if(old === nv){ sk.same++; return; }
        if(opt.mode !== 'overwrite' && old){ sk.kept++; return; }
        ch.push(schBaseChange(w, ds, nv));
      });
    }
  }
  return schFinishPlan(ch, sk);
}
// Đổi ca giữa 2 nhân viên trong khoảng ngày: ai có ca gì thì đổi cho người kia (dựa trên ca hiệu lực).
function schPlanSwap(opt){
  var ctx = opt.ctx || schMakeCtx(), ch = [], sk = {same:0, leave:0, empty:0}, A = opt.a, B = opt.b;
  schRange(opt.from, opt.to).forEach(function(ds){
    var ea = schEffective(ctx, A, ds), eb = schEffective(ctx, B, ds);
    if(schLeaveOn(ctx, A, ds) || schLeaveOn(ctx, B, ds)){ sk.leave++; return; }
    if(!ea.id || !eb.id){ sk.empty++; return; }          // thiếu ca ở 1 bên → không tự suy diễn, bỏ qua
    if(ea.id === eb.id){ sk.same++; return; }
    ch.push(schBaseChange(A, ds, eb.id)); ch.push(schBaseChange(B, ds, ea.id));
  });
  return schFinishPlan(ch, sk);
}
