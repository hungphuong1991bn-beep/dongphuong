// src/modules/hr/hr-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ─── state cho sub-tab Quản lý nhân sự (hồ sơ / nghỉ phép / kỷ luật / thống kê) ───
let _nsTab = 'danhsach';
function goNsTab(t){
  if(t==='tangluong' && !hrSalaryCan()) return;   // tab lương chỉ Admin
  _nsTab = t;
  document.querySelectorAll('.ns-tab').forEach(el=>el.classList.toggle('active', el.dataset.tab===t));
  document.querySelectorAll('.ns-panel').forEach(el=>el.classList.toggle('active', el.dataset.tab===t));
  const bar = document.getElementById('nsTabBar');
  if(bar) bar.scrollIntoView({behavior:'smooth', block:'start'});
}

// Bộ lọc bảng "Danh sách nhân viên" — lọc cục bộ, chỉ vẽ lại phần <tbody> để không mất focus ô đang gõ.
let _nsWorkerSearch = '';
let _nsWorkerStatusFilter = 'all';
let _nsDeptFilter = 'all';
let _nsPosFilter = 'all';
let _nsQuick = '';                    // '' | 'thieu' | 'sinhnhat' | 'nghiphep'
let _nsSort = {key:'', dir:1};        // key: name | boPhan | ngayVaoLam | cong | luong
let _nsShowSalary = false;            // Admin: mặc định ẨN số lương trên bảng (chống người đứng cạnh nhìn)
const NS_STATUS_COLOR = {'Đang làm':'#16a34a','Tạm nghỉ':'#f59e0b','Đã nghỉ việc':'#6b7280'};
const NS_STATUS_BG    = {'Đang làm':'#dcfce7','Tạm nghỉ':'#fef3c7','Đã nghỉ việc':'#f1f5f9'};

function nsResetPrivacy(){ _nsShowSalary = false; }

function workerInitials(name){
  const parts = (name||'?').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return parts.length>1 ? (parts[0][0]+parts[parts.length-1][0]).toUpperCase() : parts[0][0].toUpperCase();
}

// Danh sách đã lọc + sắp xếp (dùng chung cho bảng và xuất Excel)
function nsFilteredWorkers(){
  const q = _nsWorkerSearch.trim().toLowerCase();
  let list = (DB.workers||[]).slice();
  if(_nsWorkerStatusFilter!=='all') list = list.filter(w=>nsStatusOf(w)===_nsWorkerStatusFilter);
  if(_nsDeptFilter!=='all') list = list.filter(w=>(w.boPhan||'').trim()===_nsDeptFilter);
  if(_nsPosFilter!=='all') list = list.filter(w=>(w.chucVu||'').trim()===_nsPosFilter);
  if(_nsQuick==='thieu') list = list.filter(w=>nsMissingFields(w).length>0);
  else if(_nsQuick==='sinhnhat') list = list.filter(w=>nsBirthdayDay(w)>0);
  else if(_nsQuick==='nghiphep'){ const ids = nsOnLeaveTodayIds(); list = list.filter(w=>ids.has(w.id)); }
  if(q) list = list.filter(w=>{
    const hay = [w.name,w.maNV,w.chucVu,w.boPhan,w.sdt,w.cccd].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  if(_nsSort.key){
    const d = _nsSort.dir, k = _nsSort.key, canSal = hrSalaryCan();
    const val = w=>{
      if(k==='name') return nsNameSortKey(w);
      if(k==='boPhan') return (w.boPhan||'￿');
      if(k==='ngayVaoLam') return (w.ngayVaoLam||'9999-99-99');
      if(k==='cong') return parseCongValNum(computeTotal(w.id));
      if(k==='luong') return canSal ? hrSalaryGet(w.id) : 0;
      return 0;
    };
    list.sort((a,b)=>{ const x=val(a), y=val(b); return (typeof x==='number' ? x-y : nsCmpVi(x,y)) * d; });
  }
  return list;
}

function renderWorkerTableRows(list){
  const admin = isAdmin();
  const canSal = hrSalaryCan();
  const onLeave = nsOnLeaveTodayIds();
  const ym = curYM();
  const cols = 11 + (canSal?1:0);
  if(!list.length) return `<tr><td colspan="${cols}" style="padding:22px;text-align:center;color:var(--text4);font-size:13px">Không tìm thấy nhân viên phù hợp</td></tr>`;
  return list.map((w,i)=>{
    const klW = (DB.kyLuat||[]).filter(k=>k.workerId===w.id && (k.date||'').startsWith(ym)).length;
    const npW = (DB.nghiPhep||[]).filter(k=>k.workerId===w.id && (k.fromDate||'').startsWith(ym)).length;
    const st = nsStatusOf(w);
    const miss = nsMissingFields(w);
    const sen = nsSeniorityText(w);
    const bd = nsBirthdayDay(w);
    const sal = canSal ? hrSalaryGet(w.id) : 0;
    const lastRaise = canSal ? hrRaiseLast(w.id) : null;
    return `<tr onclick="if(event.target.closest('button,a'))return; openWorkerProfile('${nsEsc(w.id)}')" style="cursor:pointer" title="Bấm để xem hồ sơ chi tiết">
      <td style="text-align:center;color:var(--text3)">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${nsEsc(workerInitials(w.name))}</div>
          <div>
            <div style="font-weight:700;font-size:13px">${nsEsc(w.name||'(Chưa đặt tên)')}${bd?` <span title="Sinh nhật ngày ${bd}" style="font-size:12px">🎂</span>`:''}${onLeave.has(w.id)?` <span class="ns-badge" style="background:#cffafe;color:#0e7490;font-size:10px;padding:1px 7px">🏖️ Nghỉ phép</span>`:''}</div>
            <div style="font-size:11px;color:var(--text4)">${w.maNV?('Mã NV: '+nsEsc(w.maNV)):('ID: '+nsEsc(w.id))}</div>
            ${miss.length?`<div style="font-size:10.5px;color:#b45309">⚠️ Thiếu: ${nsEsc(miss.join(', '))}</div>`:''}
          </div>
        </div>
      </td>
      <td style="font-size:12.5px">${nsEsc(w.chucVu||'—')}</td>
      <td style="font-size:12.5px">${nsEsc(w.boPhan||'—')}</td>
      <td style="font-size:12.5px;white-space:nowrap">${w.sdt?`<a href="tel:${nsEsc(w.sdt)}" style="color:var(--brand);text-decoration:none">${nsEsc(w.sdt)}</a>`:'—'}</td>
      <td style="text-align:center;font-size:12px;white-space:nowrap">${w.ngayVaoLam?nsEsc(fmtDate(w.ngayVaoLam)):'—'}${sen?`<div style="font-size:10.5px;color:var(--text4)">${nsEsc(sen)}</div>`:''}</td>
      <td style="text-align:center"><span class="ns-badge" style="background:${NS_STATUS_BG[st]||'#f1f5f9'};color:${NS_STATUS_COLOR[st]||'#6b7280'}">${nsEsc(st)}</span></td>
      ${canSal?`<td style="text-align:right;white-space:nowrap;font-weight:600;font-size:12.5px">${sal?(_nsShowSalary?nsEsc(sal.toLocaleString('vi-VN')):'••••••••'):'<span style="color:var(--text4);font-weight:400">—</span>'}${lastRaise?`<div style="font-size:10.5px;font-weight:500;color:#16a34a" title="Lần tăng lương gần nhất">↑ ${nsEsc(fmtDate(lastRaise.date))}</div>`:''}</td>`:''}
      <td style="text-align:center;font-weight:700;color:var(--green)">${computeTotal(w.id)}</td>
      <td style="text-align:center">${klW>0?`<span class="ns-badge" style="background:#fee2e2;color:#dc2626">${klW}</span>`:`<span style="color:var(--text4);font-size:12px">—</span>`}</td>
      <td style="text-align:center">${npW>0?`<span class="ns-badge" style="background:#dbeafe;color:var(--brand)">${npW}</span>`:`<span style="color:var(--text4);font-size:12px">—</span>`}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="icon-btn" title="${admin?'Sửa hồ sơ':'Xem hồ sơ'}" onclick="openWorkerProfile('${nsEsc(w.id)}')" style="font-size:12px">${admin?'✏️':'👁'}</button>
        ${admin?`<button class="icon-btn del" onclick="deleteWorker('${nsEsc(w.id)}')" title="Xóa" style="font-size:12px">🗑</button>`:''}
      </td>
    </tr>`;
  }).join('');
}

// Vẽ lại phần thay đổi theo bộ lọc: tbody + bộ đếm + nút lọc nhanh + mũi tên sắp xếp
function nsRefreshList(){
  const list = nsFilteredWorkers();
  const total = (DB.workers||[]).length;
  const body = document.getElementById('nsWorkerTableBody');
  if(body) body.innerHTML = renderWorkerTableRows(list);
  const cnt = document.getElementById('nsWorkerCount');
  if(cnt) cnt.textContent = list.length===total ? (total+' nhân viên') : (list.length+' / '+total+' nhân viên');
  document.querySelectorAll('[data-nsquick]').forEach(el=>el.classList.toggle('active', el.dataset.nsquick===_nsQuick));
  document.querySelectorAll('#nsWorkerTable th[data-sort] .ns-sort').forEach(sp=>{
    const k = sp.parentElement.dataset.sort;
    sp.textContent = _nsSort.key===k ? (_nsSort.dir>0?'▲':'▼') : '';
  });
}
// Giữ tên cũ (có thể được gọi từ nơi khác)
function nsApplyWorkerFilter(searchVal, statusVal){
  if(searchVal!==undefined) _nsWorkerSearch = searchVal;
  if(statusVal!==undefined) _nsWorkerStatusFilter = statusVal;
  nsRefreshList();
}
function nsSetFilter(key, val){
  if(key==='dept') _nsDeptFilter = val;
  else if(key==='pos') _nsPosFilter = val;
  nsRefreshList();
}
function nsSetQuick(q){ _nsQuick = (_nsQuick===q) ? '' : q; nsRefreshList(); }
function nsResetFilters(){
  _nsWorkerSearch=''; _nsWorkerStatusFilter='all'; _nsDeptFilter='all'; _nsPosFilter='all'; _nsQuick=''; _nsSort={key:'',dir:1};
  renderNhanSu();
}
// Bấm tiêu đề cột: tăng → giảm → bỏ sắp xếp
function nsSortBy(key){
  if(_nsSort.key!==key) _nsSort = {key, dir:1};
  else if(_nsSort.dir===1) _nsSort.dir = -1;
  else _nsSort = {key:'', dir:1};
  nsRefreshList();
}
function nsToggleSalary(ev){
  if(ev && ev.stopPropagation) ev.stopPropagation();
  if(!hrSalaryCan()) return;
  _nsShowSalary = !_nsShowSalary;
  renderNhanSu();
}
// Từ thẻ thống kê → mở tab Nghỉ phép đã lọc "Chờ duyệt"
function nsGoLeavePending(){
  if(typeof npSetFilter==='function') npSetFilter('status','Chờ duyệt');
  const sel = document.getElementById('npFilterStatus'); if(sel) sel.value = 'Chờ duyệt';
  goNsTab('nghiphep');
}
function nsGoQuick(q){ _nsQuick = q; goNsTab('danhsach'); nsRefreshList(); }

function renderNhanSu(){
  if(hrSalaryCan() && typeof hrSalaryUnitNeedsAction === 'function' && hrSalaryUnitNeedsAction()){ try{ hrSalaryUnitPrompt(); }catch(e){ console.error(e); } }   // v2.12.0: còn lương cũ theo THÁNG → hỏi quy đổi sang NGÀY
  if(hrSalaryCan()){ try{ hrRaiseApplyDue(); }catch(e){ console.error(e); } }   // lần tăng lương đã đến ngày hiệu lực → tự áp dụng
  if(_nsTab==='tangluong' && !hrSalaryCan()) _nsTab = 'danhsach';
  const ym = curYM();
  const [y,m] = ym.split('-').map(Number);
  const nDays = daysInMonth(ym);
  const admin = isAdmin();
  const canSal = hrSalaryCan();
  const monthData = DB.attendance[ym] || {};
  const dayCols = Array.from({length:nDays}, (_,i)=>i+1);
  const workers = DB.workers;
  const totalCong = workers.reduce((s,w)=>s + parseCongValNum(computeTotal(w.id)), 0);
  const klCount = (DB.kyLuat||[]).filter(k=>{
    const d = k.date||'';
    return d.startsWith(ym);
  }).length;
  const nghiPhepCount = (DB.nghiPhep||[]).filter(k=>{ const d=k.fromDate||''; return d.startsWith(ym); }).length;
  const dangLamCount = workers.filter(nsIsActive).length;
  const choDuyetCount = (DB.nghiPhep||[]).filter(k=>(k.status||'Chờ duyệt')==='Chờ duyệt').length;
  const onLeaveNow = nsOnLeaveTodayIds().size;
  const thieuCount = workers.filter(w=>nsMissingFields(w).length>0).length;
  const sinhNhatCount = workers.filter(w=>nsIsActive(w) && nsBirthdayDay(w)>0).length;
  const quyLuong = canSal ? hrSalaryTotalActive() : 0;
  const quyLuongTxt = !quyLuong ? '—' : (_nsShowSalary ? (quyLuong>=1e6 ? (quyLuong/1e6).toLocaleString('vi-VN',{maximumFractionDigits:1})+' tr' : quyLuong.toLocaleString('vi-VN')) : '••••••');
  const deptRows = nsDeptList().map(d=>{
    const ws = workers.filter(w=>(w.boPhan||'').trim()===d);
    const act = ws.filter(nsIsActive);
    const cong = act.reduce((s,w)=>s+parseCongValNum(computeTotal(w.id)),0);
    const np = (DB.nghiPhep||[]).filter(k=>ws.some(w=>w.id===k.workerId) && (k.fromDate||'').startsWith(ym)).length;
    const kl = (DB.kyLuat||[]).filter(k=>ws.some(w=>w.id===k.workerId) && (k.date||'').startsWith(ym)).length;
    return {d, n:ws.length, act:act.length, cong, np, kl};
  }).filter(r=>r.n>0);
  const noDeptAct = workers.filter(w=>nsIsActive(w) && !(w.boPhan||'').trim()).length;

  $('mc').innerHTML = `
    <!-- ── HEADER + STATS ── -->
    <div class="card" style="padding:12px 14px;margin-bottom:0">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Tổng quan nhân sự · Tháng ${m}/${y}</div>
      <div class="ns-stat-grid">
        <div class="ns-stat" onclick="goNsTab('danhsach')" title="Xem danh sách nhân viên"><div class="ns-stat-val">${workers.length}</div><div class="ns-stat-lbl">Người lao động</div></div>
        <div class="ns-stat" onclick="_nsWorkerStatusFilter='Đang làm';goNsTab('danhsach');renderNhanSu()" title="Lọc nhân viên đang làm"><div class="ns-stat-val" style="color:#16a34a">${dangLamCount}</div><div class="ns-stat-lbl">Đang làm việc</div></div>
        <div class="ns-stat" onclick="goTab('chamCong')" title="Xem bảng chấm công" style="cursor:pointer"><div class="ns-stat-val" style="color:var(--green)">${totalCong.toFixed(1)}</div><div class="ns-stat-lbl">Tổng công tháng</div></div>
        <div class="ns-stat" onclick="nsGoQuick('nghiphep')" title="Nhân viên đang nghỉ phép hôm nay"><div class="ns-stat-val" style="color:#0e7490">${onLeaveNow}</div><div class="ns-stat-lbl">Nghỉ phép hôm nay</div></div>
        <div class="ns-stat" onclick="nsGoLeavePending()" title="Đơn nghỉ phép chờ duyệt"><div class="ns-stat-val" style="color:var(--amber)">${choDuyetCount}</div><div class="ns-stat-lbl">Đơn chờ duyệt</div></div>
        <div class="ns-stat" onclick="goNsTab('nghiphep')" title="Xem đơn nghỉ phép"><div class="ns-stat-val" style="color:var(--amber)">${nghiPhepCount}</div><div class="ns-stat-lbl">Đơn nghỉ tháng này</div></div>
        <div class="ns-stat" onclick="goNsTab('kyluat')" title="Xem hồ sơ kỷ luật"><div class="ns-stat-val" style="color:var(--red-m)">${klCount}</div><div class="ns-stat-lbl">Vi phạm KL</div></div>
        <div class="ns-stat" onclick="nsGoQuick('sinhnhat')" title="Sinh nhật trong tháng"><div class="ns-stat-val" style="color:#db2777">${sinhNhatCount}</div><div class="ns-stat-lbl">🎂 Sinh nhật tháng ${m}</div></div>
        ${canSal?`<div class="ns-stat" onclick="nsToggleSalary(event)" title="🔒 Chỉ Admin thấy — bấm để hiện/ẩn số" style="border-style:dashed"><div class="ns-stat-val" style="color:#7c3aed;font-size:18px">${quyLuongTxt}</div><div class="ns-stat-lbl">🔒 Tổng lương ngày (đang làm)</div></div>`:''}
      </div>
      ${thieuCount>0?`<div onclick="nsGoQuick('thieu')" style="cursor:pointer;margin-top:2px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12.5px;color:#92400e">⚠️ <b>${thieuCount}</b> hồ sơ đang làm việc còn thiếu thông tin (bộ phận, chức vụ, SĐT, ngày vào làm…) — <u>bấm để xem</u></div>`:''}
    </div>

    <!-- ── SUB-TABS ── -->
    <div class="ns-tabs" id="nsTabBar">
      <button class="ns-tab${_nsTab==='danhsach'?' active':''}" data-tab="danhsach" onclick="goNsTab('danhsach')">👥 Danh sách NV</button>
      <button class="ns-tab${_nsTab==='nghiphep'?' active':''}" data-tab="nghiphep" onclick="goNsTab('nghiphep')">🏖️ Nghỉ phép</button>
      <button class="ns-tab${_nsTab==='kyluat'?' active':''}" data-tab="kyluat" onclick="goNsTab('kyluat')">⚠️ Kỷ luật</button>
      <button class="ns-tab${_nsTab==='thongke'?' active':''}" data-tab="thongke" onclick="goNsTab('thongke')">📊 Thống kê</button>
      ${canSal?`<button class="ns-tab${_nsTab==='tangluong'?' active':''}" data-tab="tangluong" onclick="goNsTab('tangluong')">📈 Tăng lương</button>`:''}
      <button class="ns-tab" onclick="goTab('chamCong')" title="Sang tab Chấm công" style="margin-left:auto;color:var(--brand)">🗓️ Chấm công →</button>
    </div>

    <!-- ══════════ PANEL: DANH SÁCH NHÂN VIÊN (đầy đủ, chuyên nghiệp) ══════════ -->
    <div class="ns-panel${_nsTab==='danhsach'?' active':''}" data-tab="danhsach">
      <div class="card" style="padding:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div style="font-weight:700;font-size:15px;color:var(--brand)">👥 Danh sách nhân viên <span style="font-weight:500;font-size:12px;color:var(--text4)">(${dangLamCount} đang làm việc · <span id="nsWorkerCount"></span>)</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer" onclick="exportWorkersExcel()" title="Xuất đúng danh sách đang lọc">📥 Xuất Excel</button>
            <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700;border:none;cursor:pointer" onclick="openNhanSuQrModal()">🏷 Tạo mã QR xem công khai</button>
            ${admin?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700;border:none;cursor:pointer" onclick="addWorker()">➕ Thêm nhân viên</button>`:''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <input id="nsWorkerSearch" class="field-inp" style="flex:1;min-width:200px" placeholder="🔍 Tìm theo tên, mã NV, chức vụ, bộ phận, SĐT..." value="${nsEsc(_nsWorkerSearch)}" oninput="nsApplyWorkerFilter(this.value, undefined)">
          <select id="nsWorkerStatusFilter" class="field-inp" style="width:auto" onchange="nsApplyWorkerFilter(undefined, this.value)">
            <option value="all" ${_nsWorkerStatusFilter==='all'?'selected':''}>Tất cả trạng thái</option>
            <option value="Đang làm" ${_nsWorkerStatusFilter==='Đang làm'?'selected':''}>🟢 Đang làm</option>
            <option value="Tạm nghỉ" ${_nsWorkerStatusFilter==='Tạm nghỉ'?'selected':''}>🟡 Tạm nghỉ</option>
            <option value="Đã nghỉ việc" ${_nsWorkerStatusFilter==='Đã nghỉ việc'?'selected':''}>⚪ Đã nghỉ việc</option>
          </select>
          <select id="nsDeptFilter" class="field-inp" style="width:auto" onchange="nsSetFilter('dept', this.value)">
            <option value="all">Tất cả bộ phận</option>
            ${nsDeptList().map(d=>`<option value="${nsEsc(d)}" ${_nsDeptFilter===d?'selected':''}>${nsEsc(d)}</option>`).join('')}
          </select>
          <select id="nsPosFilter" class="field-inp" style="width:auto" onchange="nsSetFilter('pos', this.value)">
            <option value="all">Tất cả chức vụ</option>
            ${nsPositionList().map(d=>`<option value="${nsEsc(d)}" ${_nsPosFilter===d?'selected':''}>${nsEsc(d)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
          <button class="ns-chip${_nsQuick==='thieu'?' active':''}" data-nsquick="thieu" onclick="nsSetQuick('thieu')">⚠️ Thiếu thông tin (${thieuCount})</button>
          <button class="ns-chip${_nsQuick==='sinhnhat'?' active':''}" data-nsquick="sinhnhat" onclick="nsSetQuick('sinhnhat')">🎂 Sinh nhật tháng ${m} (${sinhNhatCount})</button>
          <button class="ns-chip${_nsQuick==='nghiphep'?' active':''}" data-nsquick="nghiphep" onclick="nsSetQuick('nghiphep')">🏖️ Nghỉ phép hôm nay (${onLeaveNow})</button>
          <button class="ns-chip" onclick="nsResetFilters()" title="Xoá mọi bộ lọc và sắp xếp">✕ Xoá lọc</button>
          ${canSal?`<button class="ns-chip" onclick="nsToggleSalary(event)" style="margin-left:auto" title="🔒 Chỉ Admin thấy cột lương">${_nsShowSalary?'🙈 Ẩn lương':'👁 Hiện lương'}</button>`:''}
        </div>
        ${workers.length===0
          ? `<div style="text-align:center;color:var(--text4);padding:24px;font-size:13px">Chưa có nhân viên nào trong hệ thống${admin?' · bấm "➕ Thêm nhân viên" để bắt đầu':''}</div>`
          : `<div style="overflow-x:auto"><table class="ns-table" style="min-width:${canSal?1180:1060}px" id="nsWorkerTable">
          <thead><tr>
            <th style="width:36px">STT</th>
            <th data-sort="name" onclick="nsSortBy('name')" class="ns-th-sort" style="min-width:190px">Nhân viên <span class="ns-sort"></span></th>
            <th>Chức vụ</th>
            <th data-sort="boPhan" onclick="nsSortBy('boPhan')" class="ns-th-sort">Bộ phận <span class="ns-sort"></span></th>
            <th>SĐT</th>
            <th data-sort="ngayVaoLam" onclick="nsSortBy('ngayVaoLam')" class="ns-th-sort" style="text-align:center">Ngày vào làm <span class="ns-sort"></span></th>
            <th style="text-align:center">Trạng thái</th>
            ${canSal?`<th data-sort="luong" onclick="nsSortBy('luong')" class="ns-th-sort" style="text-align:right">🔒 Lương / ngày <span class="ns-sort"></span></th>`:''}
            <th data-sort="cong" onclick="nsSortBy('cong')" class="ns-th-sort" style="text-align:center">Công tháng ${m}/${y} <span class="ns-sort"></span></th>
            <th style="text-align:center">Kỷ luật</th>
            <th style="text-align:center">Nghỉ phép</th>
            <th style="width:70px"></th>
          </tr></thead>
          <tbody id="nsWorkerTableBody"></tbody>
        </table></div>`}
      </div>
    </div>

    <!-- ══════════ PANEL: NGHỈ PHÉP ══════════ -->
    <div class="ns-panel${_nsTab==='nghiphep'?' active':''}" data-tab="nghiphep">
      <div class="card" style="padding:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div style="font-weight:700;font-size:15px;color:var(--brand)">🏖️ Quản lý nghỉ phép</div>
          ${admin?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700;border:none;cursor:pointer" onclick="openNghiPhepForm()">➕ Thêm đơn nghỉ phép</button>`:''}
        </div>
        ${admin?`<div id="nghiPhepForm" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">
          <div id="npFormTitle" style="font-weight:700;font-size:13px;margin-bottom:10px">📝 Đơn xin nghỉ phép</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Nhân viên *</label>
              <select id="np_worker" class="field-inp" style="width:100%">
                <option value="">-- Chọn nhân viên --</option>
                ${workers.map(w=>`<option value="${w.id}">${w.name||'(Chưa đặt tên)'}</option>`).join('')}
              </select></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Loại nghỉ *</label>
              <select id="np_loai" class="field-inp" style="width:100%">
                <option value="Nghỉ phép năm">Nghỉ phép năm</option>
                <option value="Nghỉ ốm">Nghỉ ốm</option>
                <option value="Nghỉ việc riêng">Nghỉ việc riêng</option>
                <option value="Nghỉ thai sản">Nghỉ thai sản</option>
                <option value="Nghỉ không lương">Nghỉ không lương</option>
                <option value="Khác">Khác</option>
              </select></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Từ ngày *</label>
              <input type="date" id="np_from" class="field-inp" style="width:100%" value="${todayStr()}"></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Đến ngày *</label>
              <input type="date" id="np_to" class="field-inp" style="width:100%" value="${todayStr()}"></div>
            <div style="grid-column:1/-1"><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Lý do</label>
              <textarea id="np_lydo" class="field-inp" style="width:100%;min-height:55px;resize:vertical" placeholder="Lý do xin nghỉ..."></textarea></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Trạng thái</label>
              <select id="np_status" class="field-inp" style="width:100%">
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Đã duyệt">Đã duyệt</option>
                <option value="Từ chối">Từ chối</option>
              </select></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="set-btn" style="width:auto;padding:9px 18px;background:var(--brand);color:#fff;font-weight:700;border:none;cursor:pointer" id="npSaveBtn" onclick="saveNghiPhep()">💾 Lưu đơn</button>
            <button class="set-btn" style="width:auto;padding:9px 14px;border:none;cursor:pointer" onclick="closeNghiPhepForm()">✕ Hủy</button>
          </div>
        </div>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
          <input id="npFilterQ" class="field-inp" style="flex:1;min-width:160px" placeholder="🔍 Tìm tên nhân viên, lý do..." value="${nsEsc(_npFilter.q)}" oninput="npSetFilter('q', this.value)">
          <select id="npFilterStatus" class="field-inp" style="width:auto" onchange="npSetFilter('status', this.value)">
            <option value="all" ${_npFilter.status==='all'?'selected':''}>Tất cả trạng thái</option>
            <option value="Chờ duyệt" ${_npFilter.status==='Chờ duyệt'?'selected':''}>🟡 Chờ duyệt</option>
            <option value="Đã duyệt" ${_npFilter.status==='Đã duyệt'?'selected':''}>🟢 Đã duyệt</option>
            <option value="Từ chối" ${_npFilter.status==='Từ chối'?'selected':''}>🔴 Từ chối</option>
          </select>
          <input id="npFilterMonth" type="month" class="field-inp" style="width:auto" value="${nsEsc(_npFilter.month)}" onchange="npSetFilter('month', this.value)" title="Lọc theo tháng bắt đầu nghỉ (bỏ trống = tất cả)">
          <button class="ns-chip" onclick="npResetFilter()">✕ Xoá lọc</button>
        </div>
        <div id="nghiPhepList">${renderNghiPhepList()}</div>
      </div>
    </div>

    <!-- ══════════ PANEL: KỶ LUẬT ══════════ -->
    <div class="ns-panel${_nsTab==='kyluat'?' active':''}" data-tab="kyluat">
      <div class="card" style="padding:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div style="font-weight:700;font-size:15px;color:var(--red-m)">⚠️ Hồ sơ kỷ luật</div>
          ${admin?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:var(--red-m);color:#fff;font-weight:700;border:none;cursor:pointer" onclick="openKyLuatForm()">➕ Thêm kỷ luật</button>`:''}
        </div>
        ${admin?`<div id="kyLuatForm" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">
          <div id="klFormTitle" style="font-weight:700;font-size:13px;margin-bottom:10px">📝 Ghi nhận vi phạm</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Người vi phạm *</label>
              <select id="kl_worker" class="field-inp" style="width:100%">
                <option value="">-- Chọn nhân viên --</option>
                ${workers.map(w=>`<option value="${w.id}">${w.name||'(Chưa đặt tên)'}</option>`).join('')}
              </select></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Ngày vi phạm *</label>
              <input type="date" id="kl_date" class="field-inp" style="width:100%" value="${todayStr()}"></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Hình thức kỷ luật *</label>
              <select id="kl_loai" class="field-inp" style="width:100%">
                <option value="Khiển trách">Khiển trách</option>
                <option value="Cảnh cáo">Cảnh cáo</option>
                <option value="Hạ bậc lương">Hạ bậc lương</option>
                <option value="Sa thải">Sa thải</option>
                <option value="Phạt tiền">Phạt tiền</option>
                <option value="Khác">Khác</option>
              </select></div>
            <div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Người quyết định</label>
              <input type="text" id="kl_nguoiqd" class="field-inp" style="width:100%" placeholder="Tên người ký quyết định"></div>
            <div style="grid-column:1/-1"><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Lý do vi phạm *</label>
              <textarea id="kl_lydo" class="field-inp" style="width:100%;min-height:60px;resize:vertical" placeholder="Mô tả hành vi vi phạm..."></textarea></div>
            <div style="grid-column:1/-1"><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Ghi chú thêm</label>
              <input type="text" id="kl_ghichu" class="field-inp" style="width:100%" placeholder="Ghi chú (nếu có)"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="set-btn" id="klSaveBtn" style="width:auto;padding:9px 18px;background:var(--red-m);color:#fff;font-weight:700;border:none;cursor:pointer" onclick="saveKyLuat()">💾 Lưu kỷ luật</button>
            <button class="set-btn" style="width:auto;padding:9px 14px;border:none;cursor:pointer" onclick="closeKyLuatForm()">✕ Hủy</button>
          </div>
        </div>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
          <input id="klFilterQ" class="field-inp" style="flex:1;min-width:160px" placeholder="🔍 Tìm tên người vi phạm, lý do..." value="${nsEsc(_klFilter.q)}" oninput="klSetFilter('q', this.value)">
          <select id="klFilterLoai" class="field-inp" style="width:auto" onchange="klSetFilter('loai', this.value)">
            <option value="all">Tất cả hình thức</option>
            ${['Khiển trách','Cảnh cáo','Hạ bậc lương','Sa thải','Phạt tiền','Khác'].map(l=>`<option value="${l}" ${_klFilter.loai===l?'selected':''}>${l}</option>`).join('')}
          </select>
          <input id="klFilterMonth" type="month" class="field-inp" style="width:auto" value="${nsEsc(_klFilter.month)}" onchange="klSetFilter('month', this.value)" title="Lọc theo tháng vi phạm (bỏ trống = tất cả)">
          <button class="ns-chip" onclick="klResetFilter()">✕ Xoá lọc</button>
        </div>
        <div id="kyLuatList">${renderKyLuatList()}</div>
      </div>
    </div>

    ${canSal?`<!-- ══════════ PANEL: TĂNG LƯƠNG (chỉ Admin) ══════════ -->
    <div class="ns-panel${_nsTab==='tangluong'?' active':''}" data-tab="tangluong">${renderRaisePanel()}</div>`:''}

    <!-- ══════════ PANEL: THỐNG KÊ ══════════ -->
    <div class="ns-panel${_nsTab==='thongke'?' active':''}" data-tab="thongke">
      <div class="card" style="padding:14px">
        <div style="font-weight:700;font-size:15px;color:var(--brand);margin-bottom:14px">📊 Thống kê nhân sự — Tháng ${m}/${y}</div>
        ${workers.length===0 ? '' : `
        <div style="font-weight:700;font-size:13px;margin-bottom:6px">Theo bộ phận</div>
        <div style="overflow-x:auto;margin-bottom:16px"><table class="ns-table" style="min-width:560px">
          <thead><tr><th>Bộ phận</th><th style="text-align:center">Tổng NV</th><th style="text-align:center">Đang làm</th><th style="text-align:center">Tổng công</th><th style="text-align:center">TB công/người</th><th style="text-align:center">Đơn nghỉ</th><th style="text-align:center">Vi phạm KL</th></tr></thead>
          <tbody>
            ${deptRows.map(r=>`<tr>
              <td style="font-weight:600">${nsEsc(r.d)}</td>
              <td style="text-align:center">${r.n}</td>
              <td style="text-align:center">${r.act}</td>
              <td style="text-align:center;font-weight:700;color:var(--green)">${r.cong.toFixed(1)}</td>
              <td style="text-align:center">${r.act?(r.cong/r.act).toFixed(1):'—'}</td>
              <td style="text-align:center;color:var(--amber)">${r.np||'—'}</td>
              <td style="text-align:center">${r.kl?`<span class="ns-badge" style="background:#fee2e2;color:#dc2626">${r.kl}</span>`:'—'}</td>
            </tr>`).join('')}
            ${noDeptAct?`<tr><td style="font-weight:600;color:#b45309">(Chưa có bộ phận)</td><td style="text-align:center">${noDeptAct}</td><td style="text-align:center">${noDeptAct}</td><td colspan="4" style="color:#b45309;font-size:11.5px">⚠️ Bổ sung bộ phận trong hồ sơ để lên lịch & thống kê đúng</td></tr>`:''}
          </tbody>
        </table></div>
        <div style="font-weight:700;font-size:13px;margin-bottom:6px">Theo từng nhân viên</div>`}
        ${workers.length===0
          ? `<div style="text-align:center;color:var(--text4);padding:24px">Chưa có dữ liệu</div>`
          : `<div style="overflow-x:auto"><table class="ns-table" style="min-width:560px">
          <thead><tr>
            <th>Họ và tên</th>
            <th style="text-align:center">Tổng công</th>
            <th style="text-align:center">Ngày công (8h)</th>
            <th style="text-align:center">Giờ thêm giờ</th>
            <th style="text-align:center">Ngày nghỉ</th>
            <th style="text-align:center">Vi phạm KL</th>
          </tr></thead>
          <tbody>
            ${workers.map(w=>{
              const rd = monthData[w.id]||{};
              let congNgay=0, otTong=0, nghiTong=0;
              dayCols.forEach(d=>{
                const v = rd[d];
                if(!v && v!==0) return;
                const p = parseCongValue(v);
                congNgay += p.cong||0;
                otTong += p.ot||0;
                if(p.cong===0) nghiTong++;
              });
              const klW = (DB.kyLuat||[]).filter(k=>k.workerId===w.id&&(k.date||'').startsWith(ym)).length;
              const totalC = computeTotal(w.id);
              return `<tr>
                <td style="font-weight:600">${(w.name||'?').replace(/</g,'&lt;')}</td>
                <td style="text-align:center;font-weight:700;color:var(--green)">${totalC}</td>
                <td style="text-align:center">${congNgay.toFixed(1)}</td>
                <td style="text-align:center">${otTong.toFixed(1)}h</td>
                <td style="text-align:center;color:var(--amber)">${nghiTong}</td>
                <td style="text-align:center">${klW>0?`<span class="ns-badge" style="background:#fee2e2;color:#dc2626">${klW}</span>`:'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
        <div style="margin-top:14px;padding:10px 12px;background:var(--green-l);border-radius:8px;font-size:12.5px">
          <b>Tổng toàn xưởng:</b> ${totalCong.toFixed(1)} công · ${workers.length} người · Trung bình ${workers.length?( totalCong/workers.length).toFixed(1):0} công/người
        </div>`}
      </div>
    </div>
  `;
  nsRefreshList();   // dựng bảng danh sách theo bộ lọc / sắp xếp đang chọn
}
