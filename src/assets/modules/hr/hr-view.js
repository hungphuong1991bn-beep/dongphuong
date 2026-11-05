// src/modules/hr/hr-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ─── state cho sub-tab Quản lý nhân sự (hồ sơ / nghỉ phép / kỷ luật / thống kê) ───
let _nsTab = 'danhsach';
function goNsTab(t){
  _nsTab = t;
  document.querySelectorAll('.ns-tab').forEach(el=>el.classList.toggle('active', el.dataset.tab===t));
  document.querySelectorAll('.ns-panel').forEach(el=>el.classList.toggle('active', el.dataset.tab===t));
  const bar = document.getElementById('nsTabBar');
  if(bar) bar.scrollIntoView({behavior:'smooth', block:'start'});
}

// Bộ lọc bảng "Danh sách nhân viên" (tìm kiếm + trạng thái) — lọc cục bộ,
// chỉ vẽ lại phần <tbody> để không mất focus ô đang gõ.
let _nsWorkerSearch = '';
let _nsWorkerStatusFilter = 'all';
const NS_STATUS_COLOR = {'Đang làm':'#16a34a','Tạm nghỉ':'#f59e0b','Đã nghỉ việc':'#6b7280'};
const NS_STATUS_BG    = {'Đang làm':'#dcfce7','Tạm nghỉ':'#fef3c7','Đã nghỉ việc':'#f1f5f9'};

function workerInitials(name){
  const parts = (name||'?').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return parts.length>1 ? (parts[0][0]+parts[parts.length-1][0]).toUpperCase() : parts[0][0].toUpperCase();
}

function renderWorkerTableRows(list){
  const ym = curYM();
  const admin = isAdmin();
  const viewer = isViewer();
  if(!list.length) return `<tr><td colspan="11" style="padding:22px;text-align:center;color:var(--text4);font-size:13px">Không tìm thấy nhân viên phù hợp</td></tr>`;
  return list.map((w,i)=>{
    const klW = (DB.kyLuat||[]).filter(k=>k.workerId===w.id && (k.date||'').startsWith(ym)).length;
    const npW = (DB.nghiPhep||[]).filter(k=>k.workerId===w.id && (k.fromDate||'').startsWith(ym)).length;
    const st = w.trangThai || 'Đang làm';
    return `<tr onclick="if(event.target.closest('button,a'))return; openWorkerProfile('${w.id}')" style="cursor:pointer" title="Bấm để xem hồ sơ chi tiết">
      <td style="text-align:center;color:var(--text3)">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${workerInitials(w.name)}</div>
          <div>
            <div style="font-weight:700;font-size:13px">${(w.name||'(Chưa đặt tên)').replace(/</g,'&lt;')}</div>
            <div style="font-size:11px;color:var(--text4)">${w.maNV?('Mã NV: '+w.maNV):('ID: '+w.id)}</div>
          </div>
        </div>
      </td>
      <td style="font-size:12.5px">${(w.chucVu||'—').toString().replace(/</g,'&lt;')}</td>
      <td style="font-size:12.5px">${(w.boPhan||'—').toString().replace(/</g,'&lt;')}</td>
      <td style="font-size:12.5px;white-space:nowrap">${w.sdt?`<a href="tel:${w.sdt}" style="color:var(--brand);text-decoration:none">${(''+w.sdt).replace(/</g,'&lt;')}</a>`:'—'}</td>
      <td style="text-align:center;font-size:12px;white-space:nowrap">${w.ngayVaoLam||'—'}</td>
      <td style="text-align:center"><span class="ns-badge" style="background:${NS_STATUS_BG[st]||'#f1f5f9'};color:${NS_STATUS_COLOR[st]||'#6b7280'}">${st}</span></td>
      <td style="text-align:center;font-weight:700;color:var(--green)">${computeTotal(w.id)}</td>
      <td style="text-align:center">${klW>0?`<span class="ns-badge" style="background:#fee2e2;color:#dc2626">${klW}</span>`:`<span style="color:var(--text4);font-size:12px">—</span>`}</td>
      <td style="text-align:center">${npW>0?`<span class="ns-badge" style="background:#dbeafe;color:var(--brand)">${npW}</span>`:`<span style="color:var(--text4);font-size:12px">—</span>`}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="icon-btn" title="${admin?'Sửa hồ sơ':'Xem hồ sơ'}" onclick="openWorkerProfile('${w.id}')" style="font-size:12px">${admin?'✏️':'👁'}</button>
        ${admin?`<button class="icon-btn del" onclick="deleteWorker('${w.id}')" title="Xóa" style="font-size:12px">🗑</button>`:''}
      </td>
    </tr>`;
  }).join('');
}

function nsApplyWorkerFilter(searchVal, statusVal){
  if(searchVal!==undefined) _nsWorkerSearch = searchVal;
  if(statusVal!==undefined) _nsWorkerStatusFilter = statusVal;
  const q = _nsWorkerSearch.trim().toLowerCase();
  let list = DB.workers;
  if(_nsWorkerStatusFilter!=='all') list = list.filter(w=>(w.trangThai||'Đang làm')===_nsWorkerStatusFilter);
  if(q) list = list.filter(w=>{
    const hay = [w.name,w.maNV,w.chucVu,w.boPhan,w.sdt,w.cccd].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  const body = document.getElementById('nsWorkerTableBody');
  if(body) body.innerHTML = renderWorkerTableRows(list);
}

function renderNhanSu(){
  const ym = curYM();
  const [y,m] = ym.split('-').map(Number);
  const nDays = daysInMonth(ym);
  const admin = isAdmin();
  const monthData = DB.attendance[ym] || {};
  const dayCols = Array.from({length:nDays}, (_,i)=>i+1);
  const workers = DB.workers;
  const totalCong = workers.reduce((s,w)=>s + parseCongValNum(computeTotal(w.id)), 0);
  const klCount = (DB.kyLuat||[]).filter(k=>{
    const d = k.date||'';
    return d.startsWith(ym);
  }).length;
  const nghiPhepCount = (DB.nghiPhep||[]).filter(k=>{ const d=k.fromDate||''; return d.startsWith(ym); }).length;
  const dangLamCount = workers.filter(w=>(w.trangThai||'Đang làm')==='Đang làm').length;

  $('mc').innerHTML = `
    <!-- ── HEADER + STATS ── -->
    <div class="card" style="padding:12px 14px;margin-bottom:0">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Tổng quan nhân sự · Tháng ${m}/${y}</div>
      <div class="ns-stat-grid">
        <div class="ns-stat" onclick="goNsTab('danhsach')" title="Xem danh sách nhân viên"><div class="ns-stat-val">${workers.length}</div><div class="ns-stat-lbl">Người lao động</div></div>
        <div class="ns-stat" onclick="goTab('chamCong')" title="Xem bảng chấm công" style="cursor:pointer"><div class="ns-stat-val" style="color:var(--green)">${totalCong.toFixed(1)}</div><div class="ns-stat-lbl">Tổng công tháng</div></div>
        <div class="ns-stat" onclick="goNsTab('nghiphep')" title="Xem đơn nghỉ phép"><div class="ns-stat-val" style="color:var(--amber)">${nghiPhepCount}</div><div class="ns-stat-lbl">Đơn nghỉ phép</div></div>
        <div class="ns-stat" onclick="goNsTab('kyluat')" title="Xem hồ sơ kỷ luật"><div class="ns-stat-val" style="color:var(--red-m)">${klCount}</div><div class="ns-stat-lbl">Vi phạm KL</div></div>
      </div>
    </div>

    <!-- ── SUB-TABS ── -->
    <div class="ns-tabs" id="nsTabBar">
      <button class="ns-tab${_nsTab==='danhsach'?' active':''}" data-tab="danhsach" onclick="goNsTab('danhsach')">👥 Danh sách NV</button>
      <button class="ns-tab${_nsTab==='nghiphep'?' active':''}" data-tab="nghiphep" onclick="goNsTab('nghiphep')">🏖️ Nghỉ phép</button>
      <button class="ns-tab${_nsTab==='kyluat'?' active':''}" data-tab="kyluat" onclick="goNsTab('kyluat')">⚠️ Kỷ luật</button>
      <button class="ns-tab${_nsTab==='thongke'?' active':''}" data-tab="thongke" onclick="goNsTab('thongke')">📊 Thống kê</button>
      <button class="ns-tab" onclick="goTab('chamCong')" title="Sang tab Chấm công" style="margin-left:auto;color:var(--brand)">🗓️ Chấm công →</button>
    </div>

    <!-- ══════════ PANEL: DANH SÁCH NHÂN VIÊN (đầy đủ, chuyên nghiệp) ══════════ -->
    <div class="ns-panel${_nsTab==='danhsach'?' active':''}" data-tab="danhsach">
      <div class="card" style="padding:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div style="font-weight:700;font-size:15px;color:var(--brand)">👥 Danh sách nhân viên <span style="font-weight:500;font-size:12px;color:var(--text4)">(${dangLamCount} đang làm việc)</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700;border:none;cursor:pointer" onclick="openNhanSuQrModal()">🏷 Tạo mã QR xem công khai</button>
            ${admin?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700;border:none;cursor:pointer" onclick="addWorker()">➕ Thêm nhân viên</button>`:''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <input id="nsWorkerSearch" class="field-inp" style="flex:1;min-width:200px" placeholder="🔍 Tìm theo tên, mã NV, chức vụ, bộ phận, SĐT..." value="${(_nsWorkerSearch||'').replace(/"/g,'&quot;')}" oninput="nsApplyWorkerFilter(this.value, undefined)">
          <select id="nsWorkerStatusFilter" class="field-inp" style="width:auto" onchange="nsApplyWorkerFilter(undefined, this.value)">
            <option value="all" ${_nsWorkerStatusFilter==='all'?'selected':''}>Tất cả trạng thái</option>
            <option value="Đang làm" ${_nsWorkerStatusFilter==='Đang làm'?'selected':''}>🟢 Đang làm</option>
            <option value="Tạm nghỉ" ${_nsWorkerStatusFilter==='Tạm nghỉ'?'selected':''}>🟡 Tạm nghỉ</option>
            <option value="Đã nghỉ việc" ${_nsWorkerStatusFilter==='Đã nghỉ việc'?'selected':''}>⚪ Đã nghỉ việc</option>
          </select>
        </div>
        ${workers.length===0
          ? `<div style="text-align:center;color:var(--text4);padding:24px;font-size:13px">Chưa có nhân viên nào trong hệ thống${admin?' · bấm "➕ Thêm nhân viên" để bắt đầu':''}</div>`
          : `<div style="overflow-x:auto"><table class="ns-table" style="min-width:980px" id="nsWorkerTable">
          <thead><tr>
            <th style="width:36px">STT</th>
            <th style="min-width:170px">Nhân viên</th>
            <th>Chức vụ</th>
            <th>Bộ phận</th>
            <th>SĐT</th>
            <th style="text-align:center">Ngày vào làm</th>
            <th style="text-align:center">Trạng thái</th>
            <th style="text-align:center">Tổng công tháng ${m}/${y}</th>
            <th style="text-align:center">Kỷ luật</th>
            <th style="text-align:center">Nghỉ phép</th>
            <th style="width:70px"></th>
          </tr></thead>
          <tbody id="nsWorkerTableBody">${renderWorkerTableRows(workers)}</tbody>
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
          <div style="font-weight:700;font-size:13px;margin-bottom:10px">📝 Ghi nhận vi phạm</div>
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
            <button class="set-btn" style="width:auto;padding:9px 18px;background:var(--red-m);color:#fff;font-weight:700;border:none;cursor:pointer" onclick="saveKyLuat()">💾 Lưu kỷ luật</button>
            <button class="set-btn" style="width:auto;padding:9px 14px;border:none;cursor:pointer" onclick="closeKyLuatForm()">✕ Hủy</button>
          </div>
        </div>`:''}
        <div id="kyLuatList">${renderKyLuatList()}</div>
      </div>
    </div>

    <!-- ══════════ PANEL: THỐNG KÊ ══════════ -->
    <div class="ns-panel${_nsTab==='thongke'?' active':''}" data-tab="thongke">
      <div class="card" style="padding:14px">
        <div style="font-weight:700;font-size:15px;color:var(--brand);margin-bottom:14px">📊 Thống kê nhân sự — Tháng ${m}/${y}</div>
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
}
