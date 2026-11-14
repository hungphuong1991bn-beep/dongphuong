// src/modules/attendance/attendance-core.js  — GIAI ĐOẠN 1 (v2.6.0)
// Logic THUẦN của Chấm công: kiểm tra định dạng ô, thống kê tháng, phát hiện bất thường,
// lập kế hoạch chấm hàng loạt. KHÔNG đụng DOM, KHÔNG ghi dữ liệu → dễ kiểm thử.
//
// QUY ƯỚC GIỮ NGUYÊN (không đổi công thức):  1 = 1 công · 0.5 = nửa công · 0 = nghỉ ·
// 1.2 = 1 công + 2 giờ tăng ca · 1.25 = 1 công + 2,5 giờ · đủ 8 giờ tăng ca quy đổi 1 công.
// Mọi phép tính công đều dùng lại parseCongValue()/computeCongTotalStr() (attendance-view.js).
//
// CẦN XÁC NHẬN VỚI DOANH NGHIỆP (chỉ dùng để CẢNH BÁO, không chặn nhập, không tự sửa dữ liệu):
//   - ngưỡng giờ tăng ca/ngày và /tháng (mặc định bên dưới chỉ là gợi ý);
//   - Chủ nhật & ngày lễ có phải ngày nghỉ quy ước hay không (hiện: không tính là "thiếu dữ liệu").
var ATT_RULES = { maxOtPerDay: 4, maxOtPerMonth: 40, maxCongPerDay: 1 };

function attPad2(n){ return String(n).padStart(2,'0'); }
function attDateStr(ym, day){ return ym + '-' + attPad2(day); }
function attIsSunday(ym, day){ var p = ym.split('-').map(Number); return new Date(p[0], p[1]-1, day).getDay() === 0; }
function attDaysIn(ym){ var p = ym.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
function attValidYM(ym){ return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym||''); }
function attShiftYM(ym, delta){ var p = ym.split('-').map(Number); var d = new Date(p[0], p[1]-1+delta, 1); return d.getFullYear() + '-' + attPad2(d.getMonth()+1); }

// ── 1. Định dạng một ô ─────────────────────────────────────────────
// Hợp lệ: số không âm, tối đa 1 dấu '.' hoặc ','. VD: 1 · 0.5 · 0 · 1.2 · 1,25
function attCellValid(raw){
  var s = String(raw==null ? '' : raw).trim();
  if(s === '') return true;                       // ô trống = chưa chấm → hợp lệ
  return /^\d{1,2}([.,]\d{1,2})?$/.test(s);
}
// Phân tích 1 ô: {state:'empty'|'ok'|'invalid', kind, cong, ot, warn:[mã cảnh báo]}
//   kind: 'full' | 'half' | 'off' | 'ot' | 'other'
function attCellInfo(raw){
  var s = String(raw==null ? '' : raw).trim();
  if(s === '') return {state:'empty', kind:'', cong:0, ot:0, warn:[]};
  if(!attCellValid(s)) return {state:'invalid', kind:'', cong:0, ot:0, warn:['format']};
  var p = parseCongValue(s);                      // CÔNG THỨC GỐC
  var warn = [];
  var kind = 'other';
  if(p.cong === 0 && p.ot === 0) kind = 'off';
  else if(p.ot > 0) kind = 'ot';
  else if(p.cong === 1) kind = 'full';
  else if(p.cong === 0.5) kind = 'half';
  if(p.cong > ATT_RULES.maxCongPerDay) warn.push('cong>1');
  if(p.ot > ATT_RULES.maxOtPerDay) warn.push('ot>day');
  var m = s.replace(',', '.').match(/^(\d+)\.(\d+)$/);
  if(m && parseInt(m[1],10) === 0 && m[2] !== '5') warn.push('frac');   // 0.x khác 0.5
  return {state:'ok', kind:kind, cong:p.cong, ot:p.ot, warn:warn};
}
var ATT_WARN_TEXT = {
  'format':  'Sai định dạng (chỉ nhập số: 1, 0.5, 0, 1.2…)',
  'cong>1':  'Quá 1 công trong 1 ngày',
  'ot>day':  'Giờ tăng ca trong ngày cao bất thường',
  'frac':    'Phần lẻ công khác 0.5',
  'leave':   'Có công vào ngày nghỉ phép đã duyệt',
  'prejoin': 'Chấm công trước ngày vào làm',
  'ot>month':'Tổng giờ tăng ca tháng cao bất thường',
  'missing': 'Chưa có dữ liệu chấm công'
};

// ── 2. Nghỉ phép đã duyệt → tập ngày trong tháng ────────────────────
// Chỉ đơn trạng thái "Đã duyệt" mới tính (đơn Chờ duyệt / Từ chối KHÔNG tính là nghỉ chính thức).
// Khớp theo workerId; đơn cũ thiếu workerId thì khớp theo tên (như llvActiveLeave).
function attLeaveDays(w, ym, nghiPhepList){
  var set = {}; if(!w) return set;
  var nm = (w.name||'').trim().toLowerCase();
  var n = attDaysIn(ym), first = attDateStr(ym,1), last = attDateStr(ym,n);
  (nghiPhepList||[]).forEach(function(k){
    if(!k || k.status !== 'Đã duyệt') return;
    var mine = k.workerId ? (k.workerId === w.id) : (nm && (k.workerName||'').trim().toLowerCase() === nm);
    if(!mine) return;
    var from = k.fromDate||'', to = k.toDate||'';
    if(!from || !to || to < first || from > last) return;
    for(var d=1; d<=n; d++){ var ds = attDateStr(ym,d); if(ds >= from && ds <= to) set[d] = k.loai || 'Nghỉ phép'; }
  });
  return set;
}

// ── 3. Ngày cuối cùng cần có dữ liệu (không đòi dữ liệu của tương lai) ──
function attCutoffDay(ym, todayYMD){
  var tYM = String(todayYMD).slice(0,7);
  if(ym < tYM) return attDaysIn(ym);
  if(ym > tYM) return 0;
  return parseInt(String(todayYMD).slice(8,10), 10);
}

// ── 4. Thống kê 1 nhân viên trong 1 tháng ───────────────────────────
// ctx: {ym, today:'YYYY-MM-DD', holidays:{date:tên}, nghiPhep:[]}
function attWorkerMonthStats(w, row, ctx){
  var ym = ctx.ym, n = attDaysIn(ym), hol = ctx.holidays || {};
  row = row || {};
  var cong = 0, ot = 0, off = 0, half = 0, worked = 0, filled = 0, missing = [], issues = [];
  var leave = attLeaveDays(w, ym, ctx.nghiPhep);
  var cutoff = attCutoffDay(ym, ctx.today);
  var active = (w.trangThai || 'Đang làm') === 'Đang làm';
  var join = w.ngayVaoLam || '';
  for(var d=1; d<=n; d++){
    var raw = row[d]; var info = attCellInfo(raw);
    var ds = attDateStr(ym,d);
    if(info.state === 'empty'){
      if(active && d <= cutoff && !attIsSunday(ym,d) && !hol[ds] && !leave[d] && (!join || ds >= join)) missing.push(d);
      continue;
    }
    filled++;
    if(info.state === 'invalid'){ issues.push({day:d, code:'format', sev:'error', value:String(raw)}); continue; }
    cong += info.cong; ot += info.ot;
    if(info.kind === 'off') off++; else { worked++; if(info.kind === 'half') half++; }
    info.warn.forEach(function(c){ issues.push({day:d, code:c, sev:'warn', value:String(raw)}); });
    if(leave[d] && (info.cong > 0)) issues.push({day:d, code:'leave', sev:'warn', value:String(raw)});
    if(join && ds < join && info.cong > 0) issues.push({day:d, code:'prejoin', sev:'warn', value:String(raw)});
  }
  // Quy đổi giống hệt computeCongTotalStr(): đủ 8h tăng ca = 1 công, dư giữ lại làm giờ.
  var extra = Math.floor(ot/8 + 1e-9);
  var otRest = Math.round((ot - extra*8) * 10) / 10; if(otRest >= 8) otRest = 0;
  var congUnits = Math.round((cong + extra) * 10) / 10;
  if(ot > ATT_RULES.maxOtPerMonth) issues.push({day:0, code:'ot>month', sev:'warn', value:String(ot)});
  var expected = 0;
  if(active){ for(var e=1; e<=cutoff; e++){ var es = attDateStr(ym,e); if(!attIsSunday(ym,e) && !hol[es] && !leave[e] && (!join || es >= join)) expected++; } }
  return {
    congStr: computeCongTotalStr(row),   // chuỗi hiển thị theo quy ước gốc (vd "28.6")
    congUnits: congUnits,                // số công (đã cộng phần quy đổi 8h) — dùng để cộng tổng
    otRaw: Math.round(ot*10)/10,         // tổng giờ tăng ca ghi nhận (trước quy đổi)
    otRest: otRest,                      // giờ tăng ca dư (<8h) sau quy đổi
    offDays: off, halfDays: half, workedDays: worked, filledCells: filled,
    missingDays: missing, expectedCells: expected, leaveDays: Object.keys(leave).length,
    issues: issues
  };
}

// ── 5. Tổng hợp cho cả danh sách (dashboard + báo cáo) ──────────────
// rows: [{w, stats}] — trả về các chỉ số tổng, cộng CHÍNH XÁC (không cộng chuỗi hiển thị).
function attAggregate(rows){
  var t = {workers:rows.length, withData:0, noData:0, congUnits:0, otRaw:0, otRest:0, offDays:0,
           missingCells:0, expectedCells:0, filledExpected:0, issueCount:0, workersWithIssues:0};
  rows.forEach(function(r){
    var s = r.stats;
    if(s.filledCells > 0) t.withData++; else t.noData++;
    t.congUnits += s.congUnits; t.otRaw += s.otRaw; t.otRest += s.otRest; t.offDays += s.offDays;
    t.missingCells += s.missingDays.length; t.expectedCells += s.expectedCells;
    t.filledExpected += Math.max(0, s.expectedCells - s.missingDays.length);
    var real = s.issues.length; t.issueCount += real; if(real || s.missingDays.length) t.workersWithIssues++;
  });
  t.congUnits = Math.round(t.congUnits*10)/10; t.otRaw = Math.round(t.otRaw*10)/10; t.otRest = Math.round(t.otRest*10)/10;
  t.completion = t.expectedCells > 0 ? Math.round(t.filledExpected / t.expectedCells * 1000) / 10 : (t.workers ? 100 : 0);
  return t;
}

// ── 6. Chọn dòng hiển thị theo bộ lọc ───────────────────────────────
// Người đã "Đã nghỉ việc" chỉ hiện nếu có dữ liệu công trong tháng (giữ lịch sử, không làm rối bảng).
// f: {dept, shift, status, q}; shiftOf(w) → khoá ca (ca1/ca2/…); monthRowsByWid: {wid:{day:val}}
function attFilterWorkers(workers, f, monthRows, shiftOf){
  f = f || {}; var q = (f.q||'').trim().toLowerCase();
  return (workers||[]).filter(function(w){
    var st = w.trangThai || 'Đang làm';
    var row = monthRows && monthRows[w.id];
    var hasData = !!row && Object.keys(row).some(function(k){ var v=row[k]; return v!==null && v!==undefined && v!==''; });
    if(f.status && f.status !== 'all'){ if(st !== f.status) return false; }
    else if(st === 'Đã nghỉ việc' && !hasData) return false;
    if(f.dept && f.dept !== 'all' && (w.boPhan||'') !== f.dept) return false;
    if(f.shift && f.shift !== 'all' && (shiftOf ? shiftOf(w) : 'khac') !== f.shift) return false;
    if(q){ var hay = [w.name, w.maNV, w.chucVu, w.boPhan].filter(Boolean).join(' ').toLowerCase(); if(hay.indexOf(q) < 0) return false; }
    return true;
  });
}

// ── 7. Kế hoạch chấm hàng loạt (CHỈ TÍNH, chưa ghi) ─────────────────
// opt: {ym, workers, fromDay, toDay, value (chuỗi, '' = xoá), mode:'empty'|'overwrite',
//       skipSun, skipHol, skipLeave, holidays, nghiPhep, att (DB.attendance), srcDay (sao chép từ ngày)}
// Trả {changes:[{wid,name,day,old,new}], skipped:{same,kept,sun,hol,leave,invalid}}
function attPlanBulk(opt){
  var ym = opt.ym, n = attDaysIn(ym), hol = opt.holidays || {}, att = opt.att || {};
  var changes = [], sk = {same:0, kept:0, sun:0, hol:0, leave:0, invalid:0};
  var from = Math.max(1, opt.fromDay|0), to = Math.min(n, opt.toDay|0);
  var useSrc = opt.srcDay != null;
  (opt.workers||[]).forEach(function(w){
    var row = (att[ym] && att[ym][w.id]) || {};
    var leave = opt.skipLeave ? attLeaveDays(w, ym, opt.nghiPhep) : {};
    for(var d=from; d<=to; d++){
      var ds = attDateStr(ym,d);
      if(opt.skipSun && attIsSunday(ym,d)){ sk.sun++; continue; }
      if(opt.skipHol && hol[ds]){ sk.hol++; continue; }
      if(opt.skipLeave && leave[d]){ sk.leave++; continue; }
      var nv = useSrc ? String(row[opt.srcDay]==null ? '' : row[opt.srcDay]).trim() : String(opt.value==null ? '' : opt.value).trim();
      if(!attCellValid(nv)){ sk.invalid++; continue; }
      if(useSrc && nv === '') { sk.kept++; continue; }           // ngày nguồn trống → không sao chép ô trống
      var old = String(row[d]==null ? '' : row[d]).trim();
      if(old === nv){ sk.same++; continue; }
      if(opt.mode !== 'overwrite' && old !== ''){ sk.kept++; continue; }
      changes.push({wid:w.id, name:w.name||'', day:d, old:old, new:nv});
    }
  });
  return {changes:changes, skipped:sk};
}

// ── 8. Chuẩn hoá dữ liệu Firebase ───────────────────────────────────
// Firebase trả các khoá số liên tiếp ("1","2",…) dưới dạng MẢNG (có null ở vị trí 0).
// Đưa về object {day:'giá trị'} đồng nhất, bỏ null/rỗng. KHÔNG đổi cấu trúc lưu trữ.
function attNormalizeRow(row){
  var out = {}; if(!row || typeof row !== 'object') return out;
  Object.keys(row).forEach(function(k){ var v = row[k]; if(v !== null && v !== undefined && v !== '') out[k] = String(v); });
  return out;
}
function attNormalize(att){
  var out = {}; if(!att || typeof att !== 'object') return out;
  Object.keys(att).forEach(function(ym){
    var ws = att[ym]; if(!ws || typeof ws !== 'object') return;
    out[ym] = {};
    Object.keys(ws).forEach(function(wid){ out[ym][wid] = attNormalizeRow(ws[wid]); });
  });
  return out;
}
function attFlatEqual(a, b){
  var ka = Object.keys(a), kb = Object.keys(b);
  if(ka.length !== kb.length) return false;
  for(var i=0;i<ka.length;i++){ if(a[ka[i]] !== b[ka[i]]) return false; }
  return true;
}
