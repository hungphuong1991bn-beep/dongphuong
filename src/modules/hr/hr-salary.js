// src/modules/hr/hr-salary.js — v2.9.0: MỨC LƯƠNG CHỈ ADMIN XEM / SỬA
// v2.12.0: ĐƠN VỊ LƯƠNG = VNĐ / NGÀY (trước đây hiểu là theo tháng). Dấu mốc đơn vị lưu ở /hrPrivate/salaryUnit = 'day';
//   dữ liệu cũ chưa có dấu mốc → Admin phải chọn quy đổi (chia số ngày công/tháng) / giữ nguyên / xoá để nhập lại (xem hrSalaryUnit*).
//   Hồ sơ nhân viên sửa lương trực tiếp, nhưng vẫn ghi qua hrRaiseAdd nên có lịch sử theo ngày áp dụng.
// ─────────────────────────────────────────────────────────────────────────────
// VẤN ĐỀ CŨ: lương nằm ngay trong hồ sơ nhân viên (DB.workers[].luongCoBan) → được đồng bộ
// về MỌI tài khoản + máy khách, và còn lộ cả trên trang QR công khai (đọc /data/workers).
// CÁCH LÀM MỚI:
//   • Lương lưu ở nhánh RIÊNG  /hrPrivate/salary/{workerId} = số tiền (VNĐ). KHÔNG nằm trong /data
//     nên không đi theo DB.workers, không có trong cache chung, sao lưu chung, trang QR công khai.
//   • Chỉ khi currentUser là Admin app mới tải/ghi nhánh này. Tài khoản khác: DB.hrSalary luôn rỗng,
//     hrSalaryGet() luôn trả 0, giao diện không dựng ô/cột lương.
//   • Dữ liệu lương cũ (w.luongCoBan) được TỰ CHUYỂN sang nhánh riêng khi Admin đăng nhập, rồi gỡ khỏi
//     hồ sơ chung. Mọi lần saveWorkers() cũng gỡ luongCoBan (mọi vai trò) để máy cũ không đẩy ngược lên.
//   • Ghi lương có hàng đợi bền (localStorage) → mất mạng không mất số vừa nhập; gửi lại khi có mạng.
// GHI CHÚ BẢO MẬT: app dùng Firebase Anonymous Auth chung nên "Admin" chỉ tồn tại ở tầng ứng dụng.
// Để chặn tuyệt đối ở tầng máy chủ cần thêm Firebase Rules + custom claims (xem docs/CHANGELOG.md).

const HR_SALARY_PATH = '/hrPrivate/salary';
const HR_SALARY_LS = 'dp_hr_salary_v1';              // cache lương (CHỈ lưu trên máy của Admin)
const HR_SALARY_PENDING_LS = 'dp_hr_salary_pending_v1'; // {workerId: số | null} chưa gửi lên server
const HR_UNIT_PATH = '/hrPrivate/salaryUnit';           // 'day' = mọi số tiền lương/tăng lương là VNĐ MỖI NGÀY
const HR_UNIT_LS = 'dp_hr_salary_unit_v1';              // đã quy đổi xong ở máy này (chống hỏi/quy đổi lần 2 khi chưa gửi kịp dấu mốc)
const HR_UNIT_KEY = '__unit';                           // khoá trong hàng đợi gửi cho dấu mốc đơn vị
const HR_MONTH_DAYS = 26;                               // số ngày công/tháng gợi ý khi quy đổi lương tháng → ngày

const HR_RAISE_PATH = '/hrPrivate/raises';           // /hrPrivate/raises/{raiseId} = {workerId,date,from,to,reason,applied,...}
const HR_RAISE_LS = 'dp_hr_raises_v1';               // cache lịch sử tăng lương (CHỈ trên máy Admin)

if(typeof DB === 'object' && DB && !DB.hrSalary) DB.hrSalary = {};
if(typeof DB === 'object' && DB && !DB.hrRaises) DB.hrRaises = [];
function hrToday(){ return (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0, 10); }
// Khoá hàng đợi: "r:<id>" = bản ghi tăng lương; còn lại = id nhân viên (lương hiện tại)
function hrSalaryPathOf(key){ return key === HR_UNIT_KEY ? HR_UNIT_PATH : key.indexOf('r:') === 0 ? HR_RAISE_PATH + '/' + key.slice(2) : HR_SALARY_PATH + '/' + key; }

function hrSalaryCan(){ return typeof isAdmin === 'function' && isAdmin(); }

// Chuẩn hoá về số nguyên dương (VNĐ); rỗng / sai → 0
function hrSalaryNum(v){
  if(v == null || v === '') return 0;
  let n;
  if(typeof v === 'number') n = v;
  else {
    const t = String(v).trim();
    // "6500000" / "6500000.5" = số thường; "6.500.000" / "6,500,000" / "6 500 000" = dấu ngăn cách hàng nghìn
    n = /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : Number(t.replace(/\D/g, ''));
  }
  return isFinite(n) && n > 0 ? Math.round(n) : 0;
}
// Đọc lương 1 nhân viên: tài khoản không phải Admin LUÔN nhận 0
function hrSalaryGet(wid){
  if(!hrSalaryCan() || !DB.hrSalary) return 0;
  return hrSalaryNum(DB.hrSalary[wid]);
}
function hrSalaryFmt(n){ return n ? Number(n).toLocaleString('vi-VN') + ' VNĐ/ngày' : '—'; }
// Tổng quỹ MỨC LƯƠNG HIỆN TẠI của nhân viên chưa nghỉ việc (Admin)
function hrSalaryTotalActive(){
  if(!hrSalaryCan()) return 0;
  return (DB.workers || []).reduce((s, w) => s + ((w.trangThai || 'Đang làm') === 'Đã nghỉ việc' ? 0 : hrSalaryGet(w.id)), 0);
}

// ── localStorage (chỉ Admin) ──
function hrSalaryLsSave(){ try{ if(hrSalaryCan()){ localStorage.setItem(HR_SALARY_LS, JSON.stringify(DB.hrSalary || {})); localStorage.setItem(HR_RAISE_LS, JSON.stringify(DB.hrRaises || [])); } }catch(e){} }
function hrSalaryLsLoad(){
  try{
    const d = JSON.parse(localStorage.getItem(HR_SALARY_LS) || '{}');
    DB.hrSalary = (d && typeof d === 'object') ? d : {};
  }catch(e){ DB.hrSalary = {}; }
  try{ const r = JSON.parse(localStorage.getItem(HR_RAISE_LS) || '[]'); DB.hrRaises = Array.isArray(r) ? r : []; }catch(e){ DB.hrRaises = []; }
}
function hrSalaryPendingLoad(){ try{ const d = JSON.parse(localStorage.getItem(HR_SALARY_PENDING_LS) || '{}'); return (d && typeof d === 'object') ? d : {}; }catch(e){ return {}; } }
function hrSalaryPendingSave(p){
  try{
    if(p && Object.keys(p).length) localStorage.setItem(HR_SALARY_PENDING_LS, JSON.stringify(p));
    else localStorage.removeItem(HR_SALARY_PENDING_LS);
  }catch(e){}
}
// Xoá sạch dấu vết lương khỏi bộ nhớ + máy khi đăng xuất / không phải Admin
function hrSalaryClearCache(){
  DB.hrSalary = {}; DB.hrRaises = []; DB.hrUnit = '';
  try{ localStorage.removeItem(HR_SALARY_LS); localStorage.removeItem(HR_RAISE_LS); }catch(e){}
}

// ── Gửi các thay đổi đang chờ lên server. Trả true nếu đã gửi hết ──
// Nếu có thay đổi mới được thêm trong lúc đang gửi → vòng lặp gửi nốt, không bỏ sót.
let _hrSalaryFlushing = null, _hrSalaryAgain = false;
function hrSalaryFlush(){
  if(!hrSalaryCan() || typeof fbOk !== 'function' || !fbOk()) return Promise.resolve(false);
  if(_hrSalaryFlushing){ _hrSalaryAgain = true; return _hrSalaryFlushing; }
  _hrSalaryFlushing = (async () => {
    do{
      _hrSalaryAgain = false;
      const pend = hrSalaryPendingLoad(), ids = Object.keys(pend);
      if(!ids.length) return true;
      const rs = await Promise.all(ids.map(id =>
        fbWrite(hrSalaryPathOf(id), pend[id], 'PUT').then(() => {
          const p = hrSalaryPendingLoad();
          if(JSON.stringify(p[id]) === JSON.stringify(pend[id])) delete p[id];      // chỉ xoá nếu chưa bị sửa tiếp trong lúc gửi
          hrSalaryPendingSave(p);
          return true;
        }).catch(() => false)
      ));
      if(!rs.every(Boolean)) return false;
    }while(_hrSalaryAgain);
    return true;
  })().finally(() => { _hrSalaryFlushing = null; });
  return _hrSalaryFlushing;
}

// ── Đặt lương 1 nhân viên (Admin). value rỗng/0 = xoá ──
function hrSalarySet(wid, value){
  if(!hrSalaryCan() || !wid) return false;
  const n = hrSalaryNum(value);
  if(!DB.hrSalary) DB.hrSalary = {};
  if(n) DB.hrSalary[wid] = n; else delete DB.hrSalary[wid];
  hrSalaryLsSave();
  const p = hrSalaryPendingLoad(); p[wid] = n || null; hrSalaryPendingSave(p);
  hrSalaryFlush();
  return true;
}

// ── Tải lương từ server (Admin). Áp lại phần chưa gửi để bản server cũ không đè lên ──
async function hrSalaryFetch(){
  if(!hrSalaryCan() || typeof fbOk !== 'function' || !fbOk()) return false;
  try{
    await hrSalaryFlush();
    const raw = await fbRead(HR_SALARY_PATH);
    const map = {};
    if(raw && typeof raw === 'object') Object.keys(raw).forEach(k => { const n = hrSalaryNum(raw[k]); if(n) map[k] = n; });
    const pend = hrSalaryPendingLoad();
    Object.keys(pend).forEach(k => { if(k.indexOf('r:') === 0 || k === HR_UNIT_KEY) return; if(pend[k]) map[k] = pend[k]; else delete map[k]; });
    const rawR = await fbRead(HR_RAISE_PATH);
    const rmap = {};
    if(rawR && typeof rawR === 'object') Object.keys(rawR).forEach(k => { const r = rawR[k]; if(r && typeof r === 'object' && r.workerId) rmap[k] = Object.assign({id: k}, r); });
    Object.keys(pend).forEach(k => { if(k.indexOf('r:') !== 0) return; if(pend[k]) rmap[k.slice(2)] = pend[k]; else delete rmap[k.slice(2)]; });
    let unitRaw = null; try{ unitRaw = await fbRead(HR_UNIT_PATH); }catch(e){ unitRaw = null; }   // đọc dấu mốc lỗi KHÔNG được làm hỏng cả lần tải lương
    DB.hrUnit = (unitRaw === 'day' || pend[HR_UNIT_KEY] === 'day') ? 'day' : '';
    if(DB.hrUnit === 'day'){ try{ localStorage.setItem(HR_UNIT_LS, 'day'); }catch(e){} }
    DB.hrSalary = map; DB.hrRaises = Object.keys(rmap).map(k => rmap[k]);
    hrSalaryLsSave();
    return true;
  }catch(e){ return false; }
}

// ── Gỡ luongCoBan khỏi hồ sơ chung (mọi vai trò). Trả số hồ sơ đã gỡ ──
function hrSalaryStripWorkers(){
  let n = 0;
  (DB.workers || []).forEach(w => { if(w && Object.prototype.hasOwnProperty.call(w, 'luongCoBan')){ delete w.luongCoBan; n++; } });
  return n;
}
// Admin: nhặt lương cũ còn trong hồ sơ → chép sang nhánh riêng (không đè giá trị đã có). Trả số mục đã chép
function hrSalaryCaptureLegacy(){
  if(!hrSalaryCan()) return 0;
  if(!DB.hrSalary) DB.hrSalary = {};
  let moved = 0;
  const pend = hrSalaryPendingLoad();
  (DB.workers || []).forEach(w => {
    if(!w || !Object.prototype.hasOwnProperty.call(w, 'luongCoBan')) return;
    const n = hrSalaryNum(w.luongCoBan);
    if(n && !hrSalaryNum(DB.hrSalary[w.id])){ DB.hrSalary[w.id] = n; pend[w.id] = n; moved++; }
  });
  if(moved){ hrSalaryPendingSave(pend); hrSalaryLsSave(); }
  return moved;
}

// ── Di trú một lần: lương cũ trong /data/workers → /hrPrivate/salary, rồi gỡ khỏi hồ sơ chung ──
// An toàn: chỉ gỡ khi lương đã gửi lên server thành công (hoặc không có lương nào cần chuyển).
async function hrSalaryMigrate(){
  if(!hrSalaryCan()) return 0;
  const legacy = (DB.workers || []).filter(w => w && Object.prototype.hasOwnProperty.call(w, 'luongCoBan'));
  if(!legacy.length) return 0;
  const withSalary = legacy.filter(w => hrSalaryNum(w.luongCoBan) > 0).length;
  hrSalaryCaptureLegacy();
  // Còn mục chờ gửi (kể cả từ lần thử trước bị mất mạng) → phải gửi xong mới được gỡ khỏi hồ sơ chung
  if(Object.keys(hrSalaryPendingLoad()).length){
    const sent = await hrSalaryFlush();
    if(!sent) return 0;               // chưa gửi được → giữ nguyên, thử lại lần đăng nhập sau
  }
  const stripped = hrSalaryStripWorkers();
  if(stripped && typeof saveWorkers === 'function') saveWorkers();
  if(stripped && typeof log === 'function') log('Bảo mật hồ sơ', `Đã tách mức lương cơ bản của ${withSalary} nhân viên khỏi hồ sơ chung — chỉ Admin xem được`, '');
  return withSalary;
}

// ═════════════════════════════════════════════════════════════════════════
// ĐƠN VỊ LƯƠNG (v2.12.0): mọi số tiền lương / tăng lương = VNĐ MỖI NGÀY. Dữ liệu cũ (hiểu theo THÁNG) KHÔNG tự đổi —
// Admin chọn: quy đổi (chia N ngày công/tháng, làm tròn VNĐ) · giữ nguyên (nếu thực ra đã là tiền ngày) · xoá để nhập lại.
// Trong lúc chưa chọn: chặn ghi lương mới (hrRaiseAdd) để không trộn lẫn tháng/ngày.
// ═════════════════════════════════════════════════════════════════════════
function hrSalaryUnitNeedsAction(){
  if(!hrSalaryCan() || DB.hrUnit === 'day') return false;
  try{ if(localStorage.getItem(HR_UNIT_LS) === 'day') return false; }catch(e){}
  return Object.keys(DB.hrSalary || {}).length > 0 || (DB.hrRaises || []).length > 0;
}
// Ghi dấu mốc 'day' (qua hàng đợi bền → mất mạng không mất)
function hrSalaryMarkDay(){
  DB.hrUnit = 'day';
  try{ localStorage.setItem(HR_UNIT_LS, 'day'); }catch(e){}
  const p = hrSalaryPendingLoad(); p[HR_UNIT_KEY] = 'day'; hrSalaryPendingSave(p);
  hrSalaryFlush();
}
// Sau khi tải xong dữ liệu: chưa có lương nào → đặt dấu mốc luôn; còn dữ liệu cũ → trả true nếu CẦN Admin quyết định
function hrSalaryUnitCheck(){
  if(!hrSalaryCan()) return false;
  if(hrSalaryUnitNeedsAction()) return true;
  if(DB.hrUnit !== 'day') hrSalaryMarkDay();
  return false;
}
// mode: 'convert' (chia divisor) | 'keep' | 'clear'. Trả {ok, error?, salaries, raises}
function hrSalaryUnitApply(mode, divisor){
  if(!hrSalaryCan()) return {ok: false, error: 'Chỉ Admin'};
  if(!hrSalaryUnitNeedsAction()) return {ok: false, error: 'Không có dữ liệu cần quy đổi'};
  const d = Math.round(Number(divisor));
  if(mode === 'convert' && !(d >= 1 && d <= 31)) return {ok: false, error: 'Số ngày công/tháng phải từ 1 đến 31'};
  if(mode !== 'convert' && mode !== 'keep' && mode !== 'clear') return {ok: false, error: 'Lựa chọn không hợp lệ'};
  const conv = v => { const n = hrSalaryNum(v); return n ? Math.max(1, Math.round(n / d)) : 0; };
  let ns = 0, nr = 0;
  Object.keys(DB.hrSalary || {}).slice().forEach(wid => {
    if(mode === 'convert') hrSalarySet(wid, conv(DB.hrSalary[wid]));
    else if(mode === 'clear') hrSalarySet(wid, 0);
    ns++;
  });
  (DB.hrRaises || []).slice().forEach(r => {
    if(!r) return;
    if(mode === 'convert'){ r.from = conv(r.from); r.to = conv(r.to); hrRaiseSave(r); }
    else if(mode === 'clear') hrRaiseDelete(r.id);
    nr++;
  });
  hrSalaryMarkDay();
  return {ok: true, salaries: ns, raises: nr};
}

// ── Gọi sau khi đăng nhập + đồng bộ xong ──
async function hrSalaryOnLogin(){
  try{
    if(!hrSalaryCan()){
      hrSalaryClearCache();
      if(hrSalaryStripWorkers() && typeof lsSave === 'function') lsSave();
      return;
    }
    hrSalaryLsLoad();
    if(await hrSalaryFetch()){
      try{ hrSalaryCaptureLegacy(); }catch(e){}      // lương cũ còn trong hồ sơ cũng là số THÁNG → phải tính vào việc hỏi quy đổi
      if(!hrSalaryUnitCheck()) hrRaiseApplyDue();   // chưa quy đổi tháng→ngày thì chưa tự áp dụng lần tăng nào
      const moved = await hrSalaryMigrate();
      if(moved && typeof showToast === 'function') showToast(`🔒 Đã chuyển mức lương của ${moved} nhân viên sang vùng bảo mật (chỉ Admin xem)`);
    }
    if(typeof currentTab !== 'undefined' && currentTab === 'nhanSu' && typeof renderNhanSu === 'function') renderNhanSu();
  }catch(e){ console.error('hrSalaryOnLogin', e); }
}
function hrSalaryOnLogout(){
  try{ if(hrSalaryCan()) hrSalaryFlush(); }catch(e){}
  hrSalaryClearCache();
  try{ if(typeof nsResetPrivacy === 'function') nsResetPrivacy(); }catch(e){}   // lần đăng nhập sau luôn bắt đầu ở trạng thái ẨN số lương
}

// ── Realtime: có ai đó vừa đổi /hrPrivate → CHỈ Admin tải lại ──
let _hrSalaryRtTimer = null;
function hrSalaryOnRealtime(){
  if(!hrSalaryCan()) return;
  clearTimeout(_hrSalaryRtTimer);
  _hrSalaryRtTimer = setTimeout(async () => {
    if(await hrSalaryFetch() && typeof currentTab !== 'undefined' && currentTab === 'nhanSu' && typeof renderNhanSu === 'function'){
      const open = document.getElementById('workerProfileModal');
      if(!(open && open.classList.contains('open'))) renderNhanSu();   // không vẽ lại khi đang mở hồ sơ
    }
  }, 600);
}

// ═════════════════════════════════════════════════════════════════════════
// LỊCH SỬ TĂNG LƯƠNG (v2.10.0) — chỉ Admin. Mỗi lần = {id, workerId, workerName, date(YYYY-MM-DD hiệu lực),
// from, to, reason, applied, by, createdAt}. Lương hiện tại (hrSalary) = mức `to` của lần tăng gần nhất đã đến hạn.
// Lần tăng có ngày hiệu lực ở TƯƠNG LAI được lưu "chờ hiệu lực", tự áp dụng khi Admin mở app sau ngày đó.
// ═════════════════════════════════════════════════════════════════════════
function hrRaiseList(wid){
  if(!hrSalaryCan()) return [];
  return (DB.hrRaises || []).filter(r => r && (!wid || r.workerId === wid))
    .slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}
function hrRaiseLast(wid){          // lần tăng đã áp dụng gần nhất của 1 nhân viên
  const l = hrRaiseList(wid).filter(r => r.date <= hrToday());
  return l.length ? l[l.length - 1] : null;
}
function hrRaiseSave(r){
  const p = hrSalaryPendingLoad(); p['r:' + r.id] = r; hrSalaryPendingSave(p); hrSalaryLsSave();
}
// Cập nhật mức lương theo NGÀY HIỆU LỰC (v2.11.0: đây là cách DUY NHẤT đổi mức lương hiện tại — hồ sơ nhân viên chỉ xem).
// o = {workerId, date, to, reason, adjust}. Mặc định chỉ cho TĂNG; muốn giảm / sửa sai phải tích adjust=true
// (lưu kind:'adjust'). Bằng mức trước đó thì từ chối vì không có gì thay đổi. Trả {ok, error?, raise?}
function hrRaiseAdd(o){
  if(!hrSalaryCan()) return {ok: false, error: 'Chỉ Admin mới được ghi nhận tăng lương'};
  if(hrSalaryUnitNeedsAction()) return {ok: false, error: 'Cần xác nhận quy đổi lương từ THÁNG sang NGÀY trước (hộp thoại hiện khi mở Quản lý nhân sự)'};
  const w = (DB.workers || []).find(x => x.id === o.workerId);
  if(!w) return {ok: false, error: 'Vui lòng chọn nhân viên'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date || '')) return {ok: false, error: 'Vui lòng chọn ngày hiệu lực'};
  const to = hrSalaryNum(o.to);
  if(!to) return {ok: false, error: 'Vui lòng nhập mức lương mới'};
  const hist = hrRaiseList(w.id);
  const earlier = hist.filter(r => r.date <= o.date), later = hist.filter(r => r.date > o.date);
  const from = earlier.length ? earlier[earlier.length - 1].to : (later.length ? later[0].from : hrSalaryGet(w.id));
  const adjust = o.adjust === true || o.adjust === 'true';
  if(from && to === from) return {ok: false, error: 'Mức lương mới đang bằng mức trước đó (' + from.toLocaleString('vi-VN') + ' VNĐ/ngày) — không có gì để cập nhật'};
  if(from && to < from && !adjust) return {ok: false, needAdjust: true, from, to, error: 'Mức lương mới thấp hơn mức trước đó (' + from.toLocaleString('vi-VN') + ' VNĐ/ngày). Nếu là giảm lương hoặc sửa nhập sai, hãy tích "Điều chỉnh / giảm lương"'};
  const r = {id: 'rs' + Date.now() + Math.random().toString(36).slice(2, 5), workerId: w.id, workerName: w.name || '', date: o.date,
    from: from || 0, to, kind: (from && to < from) ? 'adjust' : 'raise', reason: String(o.reason || '').trim(), applied: false,
    by: (typeof actorName === 'function') ? actorName() : '', createdAt: hrToday()};
  if(!DB.hrRaises) DB.hrRaises = [];
  DB.hrRaises.push(r); hrRaiseSave(r);
  hrRaiseApplyDue();
  hrSalaryFlush();
  return {ok: true, raise: r};
}
function hrRaiseDelete(id){
  if(!hrSalaryCan()) return false;
  const before = (DB.hrRaises || []).length;
  DB.hrRaises = (DB.hrRaises || []).filter(r => r.id !== id);
  if(DB.hrRaises.length === before) return false;
  const p = hrSalaryPendingLoad(); p['r:' + id] = null; hrSalaryPendingSave(p); hrSalaryLsSave();
  hrSalaryFlush();
  return true;
}
// Áp dụng các lần tăng đã đến hạn: lương hiện tại = mức `to` của lần gần nhất có ngày hiệu lực <= hôm nay.
function hrRaiseApplyDue(){
  if(!hrSalaryCan()) return 0;
  const today = hrToday(); let changed = 0;
  const wids = {};
  (DB.hrRaises || []).forEach(r => { if(r && r.applied !== true && r.date <= today) wids[r.workerId] = 1; });
  Object.keys(wids).forEach(wid => {
    const due = hrRaiseList(wid).filter(r => r.date <= today);
    const latest = due[due.length - 1];
    if(latest && hrSalaryGet(wid) !== latest.to) hrSalarySet(wid, latest.to);
    due.forEach(r => { if(r.applied !== true){ r.applied = true; hrRaiseSave(r); changed++; } });
  });
  if(changed) hrSalaryFlush();
  return changed;
}
