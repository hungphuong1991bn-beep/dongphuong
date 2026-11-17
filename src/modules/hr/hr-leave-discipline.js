// src/modules/hr/hr-leave-discipline.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function parseCongValNum(s){ const n=parseFloat(s); return isNaN(n)?0:n; }

let _npEditId = null; // id đơn nghỉ phép đang SỬA (null = đang thêm mới)
// Bộ lọc danh sách đơn nghỉ phép (v2.9.0)
let _npFilter = {status:'all', month:'', q:''};
function npRefreshList(){ const el=document.getElementById('nghiPhepList'); if(el) el.innerHTML = renderNghiPhepList(); }
function npSetFilter(k, v){ _npFilter[k] = v; npRefreshList(); }
function npResetFilter(){
  _npFilter = {status:'all', month:'', q:''};
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.value=v; };
  set('npFilterQ',''); set('npFilterStatus','all'); set('npFilterMonth','');
  npRefreshList();
}
function npSetFormMode(edit){
  const t=document.getElementById('npFormTitle'), b=document.getElementById('npSaveBtn');
  if(t) t.textContent = edit ? '✏️ Sửa đơn nghỉ phép' : '📝 Đơn xin nghỉ phép';
  if(b) b.textContent = edit ? '💾 Cập nhật đơn' : '💾 Lưu đơn';
}
function openNghiPhepForm(){if(guardViewer())return;
  const f=document.getElementById('nghiPhepForm');
  _npEditId=null; npSetFormMode(false);
  const setV=(id,v)=>{const e=document.getElementById(id); if(e) e.value=v;};
  setV('np_worker',''); setV('np_loai','Nghỉ phép năm'); setV('np_from',todayStr()); setV('np_to',todayStr()); setV('np_lydo',''); setV('np_status','Chờ duyệt');
  if(f){f.style.display='block';f.scrollIntoView({behavior:'smooth',block:'start'});}
}
function closeNghiPhepForm(){
  const f=document.getElementById('nghiPhepForm');
  if(f) f.style.display='none';
  _npEditId=null; npSetFormMode(false);
}
function editNghiPhep(id){if(guardViewer())return;
  const rec=(DB.nghiPhep||[]).find(k=>k.id===id);
  if(!rec){ showToast('⚠️ Không tìm thấy đơn nghỉ phép', true); return; }
  const f=document.getElementById('nghiPhepForm'); if(!f) return;
  const sel=document.getElementById('np_worker');
  if(sel && rec.workerId && ![...sel.options].some(o=>o.value===rec.workerId)){
    const op=document.createElement('option'); op.value=rec.workerId; op.textContent=(rec.workerName||'(Nhân viên đã xoá)'); sel.appendChild(op);
  }
  const setV=(i,v)=>{const e=document.getElementById(i); if(e) e.value=v;};
  setV('np_worker',rec.workerId||''); setV('np_loai',rec.loai||'Nghỉ phép năm');
  setV('np_from',rec.fromDate||todayStr()); setV('np_to',rec.toDate||todayStr());
  setV('np_lydo',rec.lydo||''); setV('np_status',rec.status||'Chờ duyệt');
  _npEditId=id; npSetFormMode(true);
  f.style.display='block'; f.scrollIntoView({behavior:'smooth',block:'start'});
}
function saveNghiPhep(){if(guardViewer())return;
  const workerId = document.getElementById('np_worker').value;
  const loai     = document.getElementById('np_loai').value;
  const from     = document.getElementById('np_from').value;
  const to       = document.getElementById('np_to').value;
  const lydo     = document.getElementById('np_lydo').value.trim();
  const status   = document.getElementById('np_status').value;
  if(!workerId){ showToast('⚠️ Vui lòng chọn nhân viên', true); return; }
  if(!from||!to){ showToast('⚠️ Vui lòng nhập ngày', true); return; }
  if(to<from){ showToast('⚠️ Ngày kết thúc phải sau ngày bắt đầu', true); return; }
  if(!DB.nghiPhep) DB.nghiPhep=[];
  const _dup = nsFindLeaveOverlap(workerId, from, to, _npEditId);
  if(_dup){
    confirm2('Đơn nghỉ bị trùng ngày',
      `Nhân viên này đã có đơn "${_dup.loai||'Nghỉ phép'}" (${_dup.status||'Chờ duyệt'}) từ ${fmtDate(_dup.fromDate)} đến ${fmtDate(_dup.toDate||_dup.fromDate)} trùng với khoảng ngày vừa chọn. Vẫn lưu đơn mới?`,
      ()=>_saveNghiPhepNow(workerId, loai, from, to, lydo, status));
    return;
  }
  _saveNghiPhepNow(workerId, loai, from, to, lydo, status);
}
function _saveNghiPhepNow(workerId, loai, from, to, lydo, status){
  if(!DB.nghiPhep) DB.nghiPhep=[];
  const worker = DB.workers.find(w=>w.id===workerId);
  let _isEdit = false;
  const _npRec = _npEditId ? DB.nghiPhep.find(k=>k.id===_npEditId) : null;
  if(_npRec){
    _isEdit = true;
    Object.assign(_npRec, {workerId, workerName:worker?worker.name:(_npRec.workerName||''), loai, fromDate:from, toDate:to, lydo, status, updatedAt:todayStr()});
  } else {
    DB.nghiPhep.unshift({id:'np_'+Date.now(), workerId, workerName:worker?worker.name:'', loai, fromDate:from, toDate:to, lydo, status, createdAt:todayStr()});
  }
  lsSave();
  syncArrFieldToServer('nghiPhep', '/data/nghiPhep');
  log('Nghỉ phép',`${_isEdit?'Sửa đơn: ':''}${worker?worker.name:'?'} · ${loai} · ${from}→${to}`,'','','');
  showToast(_isEdit?'✅ Đã cập nhật đơn nghỉ phép':'✅ Đã lưu đơn nghỉ phép');
  closeNghiPhepForm();
  // Render lại TOÀN BỘ tab quản lý nhân sự (không chỉ riêng danh sách đơn
  // nghỉ phép) — trước đây chỉ cập nhật #nghiPhepList nên thẻ thống kê
  // "Đơn nghỉ phép" ở đầu trang và cột "Nghỉ phép (tháng)" ở tab Danh sách
  // NV bị đứng yên, không phản ánh đơn vừa thêm cho tới khi chuyển tab.
  renderNhanSu();
}
function deleteNghiPhep(id){if(guardViewer())return;
  confirm2('Xóa đơn','Xác nhận xóa đơn nghỉ phép này?',()=>{
    DB.nghiPhep=(DB.nghiPhep||[]).filter(k=>k.id!==id);
    lsSave();
    syncArrFieldToServer('nghiPhep', '/data/nghiPhep');
    showToast('🗑️ Đã xóa');
    renderNhanSu();
  });
}
function approveNghiPhep(id, status){if(guardViewer())return;
  const rec=(DB.nghiPhep||[]).find(k=>k.id===id);
  if(!rec) return;
  rec.status=status;
  lsSave();
  syncArrFieldToServer('nghiPhep', '/data/nghiPhep');
  showToast(status==='Đã duyệt'?'✅ Đã duyệt đơn':'❌ Đã từ chối đơn');
  // Render lại toàn bộ tab để tình trạng nghỉ (đã duyệt/từ chối) cập nhật
  // đồng thời ở mọi nơi hiển thị trong tab quản lý nhân sự, không chỉ riêng
  // bảng danh sách đơn nghỉ phép.
  renderNhanSu();
}
function npFilteredList(){
  const q=(_npFilter.q||'').trim().toLowerCase();
  return (DB.nghiPhep||[]).filter(k=>{
    if(_npFilter.status!=='all' && (k.status||'Chờ duyệt')!==_npFilter.status) return false;
    if(_npFilter.month && !(k.fromDate||'').startsWith(_npFilter.month)) return false;
    if(q && !((k.workerName||'')+' '+(k.lydo||'')+' '+(k.loai||'')).toLowerCase().includes(q)) return false;
    return true;
  }).slice().sort((a,b)=>String(b.fromDate||'').localeCompare(String(a.fromDate||'')));
}
function renderNghiPhepList(){
  const all=(DB.nghiPhep||[]);
  if(all.length===0) return `<div style="text-align:center;color:var(--text4);padding:18px;font-size:13px">Chưa có đơn nghỉ phép nào</div>`;
  const list=npFilteredList();
  if(list.length===0) return `<div style="text-align:center;color:var(--text4);padding:18px;font-size:13px">Không có đơn nào khớp bộ lọc</div>`;
  const admin=isAdmin();
  const stColor={'Chờ duyệt':'#f59e0b','Đã duyệt':'#22c55e','Từ chối':'#ef4444'};
  const today=todayStr();
  const daysApproved=list.filter(k=>k.status==='Đã duyệt').reduce((s,k)=>s+nsLeaveDays(k),0);
  const nCho=list.filter(k=>(k.status||'Chờ duyệt')==='Chờ duyệt').length;
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">${list.length} đơn${list.length!==all.length?' / '+all.length:''} · ${nCho} chờ duyệt · <b>${daysApproved}</b> ngày nghỉ đã duyệt</div>
  <div style="overflow-x:auto"><table class="ns-table" style="min-width:700px">
    <thead><tr>
      <th>Nhân viên</th><th>Loại nghỉ</th><th>Từ ngày</th><th>Đến ngày</th><th style="text-align:center">Số ngày</th><th>Lý do</th><th style="text-align:center">Trạng thái</th>
      ${admin?'<th style="width:130px"></th>':''}
    </tr></thead>
    <tbody>
      ${list.map(k=>{
        const nowOn = k.status==='Đã duyệt' && (k.fromDate||'')<=today && today<=(k.toDate||k.fromDate||'');
        return `<tr>
        <td style="font-weight:600">${nsEsc(k.workerName||'')}${nowOn?' <span class="ns-badge" style="background:#cffafe;color:#0e7490;font-size:10px;padding:1px 7px">đang nghỉ</span>':''}</td>
        <td>${nsEsc(k.loai||'')}</td>
        <td style="white-space:nowrap">${nsEsc(k.fromDate||'')}</td>
        <td style="white-space:nowrap">${nsEsc(k.toDate||'')}</td>
        <td style="text-align:center;font-weight:700">${nsLeaveDays(k)||'—'}</td>
        <td style="max-width:200px;color:var(--text3)">${nsEsc(k.lydo||'')}</td>
        <td style="text-align:center"><span class="ns-badge" style="color:#fff;background:${stColor[k.status]||'#6b7280'}">${nsEsc(k.status||'Chờ duyệt')}</span></td>
        ${admin?`<td style="text-align:center;white-space:nowrap">
          ${k.status!=='Đã duyệt'?`<button class="chip" style="font-size:11px;padding:3px 7px;background:#dcfce7;color:#166534;border:none;cursor:pointer;border-radius:5px" onclick="approveNghiPhep('${nsEsc(k.id)}','Đã duyệt')">✓ Duyệt</button> `:''}
          ${k.status!=='Từ chối'?`<button class="chip" style="font-size:11px;padding:3px 7px;background:#fee2e2;color:#dc2626;border:none;cursor:pointer;border-radius:5px" onclick="approveNghiPhep('${nsEsc(k.id)}','Từ chối')">✗ Từ chối</button> `:''}
          <button class="icon-btn" onclick="editNghiPhep('${nsEsc(k.id)}')" title="Sửa đơn" style="font-size:13px">✏️</button>
          <button class="icon-btn del" onclick="deleteNghiPhep('${nsEsc(k.id)}')" title="Xóa" style="font-size:13px">🗑</button>
        </td>`:''}
      </tr>`;}).join('')}
    </tbody>
  </table></div>`;
}

// ── Kỷ luật (v2.9.0: thêm SỬA bản ghi + bộ lọc) ──
let _klEditId = null; // id bản ghi kỷ luật đang SỬA (null = thêm mới)
let _klFilter = {loai:'all', month:'', q:''};
function klRefreshList(){ const el=document.getElementById('kyLuatList'); if(el) el.innerHTML = renderKyLuatList(); }
function klSetFilter(k, v){ _klFilter[k] = v; klRefreshList(); }
function klResetFilter(){
  _klFilter = {loai:'all', month:'', q:''};
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.value=v; };
  set('klFilterQ',''); set('klFilterLoai','all'); set('klFilterMonth','');
  klRefreshList();
}
function klSetFormMode(edit){
  const t=document.getElementById('klFormTitle'), b=document.getElementById('klSaveBtn');
  if(t) t.textContent = edit ? '✏️ Sửa hồ sơ kỷ luật' : '📝 Ghi nhận vi phạm';
  if(b) b.textContent = edit ? '💾 Cập nhật' : '💾 Lưu kỷ luật';
}
function klFillForm(rec){
  const setV=(id,v)=>{const e=document.getElementById(id); if(e) e.value=v;};
  setV('kl_worker', rec.workerId||''); setV('kl_date', rec.date||todayStr()); setV('kl_loai', rec.loai||'Khiển trách');
  setV('kl_nguoiqd', rec.nguoiqd||''); setV('kl_lydo', rec.lydo||''); setV('kl_ghichu', rec.ghichu||'');
}
function openKyLuatForm(){if(guardViewer())return;
  const f = document.getElementById('kyLuatForm');
  _klEditId = null; klSetFormMode(false); klFillForm({});
  if(f){ f.style.display='block'; f.scrollIntoView({behavior:'smooth',block:'start'}); }
}
function closeKyLuatForm(){
  const f = document.getElementById('kyLuatForm');
  if(f) f.style.display='none';
  _klEditId = null; klSetFormMode(false);
}
function editKyLuat(id){if(guardViewer())return;
  const rec=(DB.kyLuat||[]).find(k=>k.id===id);
  if(!rec){ showToast('⚠️ Không tìm thấy bản ghi kỷ luật', true); return; }
  const f=document.getElementById('kyLuatForm'); if(!f) return;
  const sel=document.getElementById('kl_worker');
  if(sel && rec.workerId && ![...sel.options].some(o=>o.value===rec.workerId)){
    const op=document.createElement('option'); op.value=rec.workerId; op.textContent=(rec.workerName||'(Nhân viên đã xoá)'); sel.appendChild(op);
  }
  klFillForm(rec); _klEditId=id; klSetFormMode(true);
  f.style.display='block'; f.scrollIntoView({behavior:'smooth',block:'start'});
}

function saveKyLuat(){if(guardViewer())return;
  const workerId = document.getElementById('kl_worker').value;
  const date     = document.getElementById('kl_date').value;
  const loai     = document.getElementById('kl_loai').value;
  const lydo     = document.getElementById('kl_lydo').value.trim();
  const nguoiqd  = document.getElementById('kl_nguoiqd').value.trim();
  const ghichu   = document.getElementById('kl_ghichu').value.trim();
  if(!workerId){ showToast('⚠️ Vui lòng chọn người vi phạm', true); return; }
  if(!date){ showToast('⚠️ Vui lòng chọn ngày vi phạm', true); return; }
  if(!lydo){ showToast('⚠️ Vui lòng nhập lý do vi phạm', true); return; }
  const worker = DB.workers.find(w=>w.id===workerId);
  if(!DB.kyLuat) DB.kyLuat=[];
  const old = _klEditId ? DB.kyLuat.find(k=>k.id===_klEditId) : null;
  if(old){
    Object.assign(old, {workerId, workerName:worker?worker.name:(old.workerName||''), date, loai, lydo, nguoiqd, ghichu, updatedAt:todayStr()});
  } else {
    DB.kyLuat.unshift({ id:'kl_'+Date.now(), workerId, workerName:worker?worker.name:'', date, loai, lydo, nguoiqd, ghichu, createdAt:todayStr() });
  }
  lsSave();
  syncArrFieldToServer('kyLuat', '/data/kyLuat');
  log('Kỷ luật', `${old?'Sửa: ':''}${worker?worker.name:'?'} · ${loai} · ${date}`, '', '', '');
  showToast(old?'✅ Đã cập nhật kỷ luật':'✅ Đã lưu kỷ luật');
  closeKyLuatForm();
  // Vẽ lại cả tab để thẻ thống kê + cột "Kỷ luật" ở Danh sách NV cập nhật theo
  renderNhanSu();
}

function deleteKyLuat(id){if(guardViewer())return;
  confirm2('Xóa kỷ luật','Xác nhận xóa bản ghi kỷ luật này?', ()=>{
    DB.kyLuat = (DB.kyLuat||[]).filter(k=>k.id!==id);
    lsSave();
    syncArrFieldToServer('kyLuat', '/data/kyLuat');
    showToast('🗑️ Đã xóa');
    renderNhanSu();
  });
}

function klFilteredList(){
  const q=(_klFilter.q||'').trim().toLowerCase();
  return (DB.kyLuat||[]).filter(k=>{
    if(_klFilter.loai!=='all' && k.loai!==_klFilter.loai) return false;
    if(_klFilter.month && !(k.date||'').startsWith(_klFilter.month)) return false;
    if(q && !((k.workerName||'')+' '+(k.lydo||'')+' '+(k.nguoiqd||'')).toLowerCase().includes(q)) return false;
    return true;
  }).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function renderKyLuatList(){
  const all = (DB.kyLuat||[]);
  if(all.length===0) return `<div style="text-align:center;color:var(--text4);padding:18px;font-size:13px">Chưa có hồ sơ kỷ luật nào</div>`;
  const list = klFilteredList();
  if(list.length===0) return `<div style="text-align:center;color:var(--text4);padding:18px;font-size:13px">Không có bản ghi nào khớp bộ lọc</div>`;
  const admin = isAdmin();
  const loaiColor = {'Khiển trách':'#f59e0b','Cảnh cáo':'#ef4444','Hạ bậc lương':'#8b5cf6','Sa thải':'#dc2626','Phạt tiền':'#f97316','Khác':'#6b7280'};
  return `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">${list.length} bản ghi${list.length!==all.length?' / '+all.length:''}</div>
  <div style="overflow-x:auto">
    <table style="border-collapse:collapse;width:100%;font-size:12px;min-width:600px">
      <thead>
        <tr style="background:var(--bg)">
          <th style="border:1px solid var(--border);padding:7px 8px;text-align:left">Ngày</th>
          <th style="border:1px solid var(--border);padding:7px 8px;text-align:left">Người vi phạm</th>
          <th style="border:1px solid var(--border);padding:7px 8px;text-align:center">Hình thức</th>
          <th style="border:1px solid var(--border);padding:7px 8px;text-align:left">Lý do</th>
          <th style="border:1px solid var(--border);padding:7px 8px;text-align:left">Người quyết định</th>
          <th style="border:1px solid var(--border);padding:7px 8px;text-align:left">Ghi chú</th>
          ${admin?'<th style="border:1px solid var(--border);padding:7px 8px;width:64px"></th>':''}
        </tr>
      </thead>
      <tbody>
        ${list.map(k=>`<tr>
          <td style="border:1px solid var(--border);padding:6px 8px;white-space:nowrap">${nsEsc(k.date||'')}</td>
          <td style="border:1px solid var(--border);padding:6px 8px;font-weight:600">${nsEsc(k.workerName||'')}</td>
          <td style="border:1px solid var(--border);padding:6px 8px;text-align:center">
            <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:${loaiColor[k.loai]||'#6b7280'}">${nsEsc(k.loai||'')}</span>
          </td>
          <td style="border:1px solid var(--border);padding:6px 8px;max-width:220px">${nsEsc(k.lydo||'')}</td>
          <td style="border:1px solid var(--border);padding:6px 8px">${nsEsc(k.nguoiqd||'—')}</td>
          <td style="border:1px solid var(--border);padding:6px 8px;color:var(--text3)">${nsEsc(k.ghichu||'')}</td>
          ${admin?`<td style="border:1px solid var(--border);padding:4px;text-align:center;white-space:nowrap"><button class="icon-btn" onclick="editKyLuat('${nsEsc(k.id)}')" style="font-size:13px" title="Sửa">✏️</button><button class="icon-btn del" onclick="deleteKyLuat('${nsEsc(k.id)}')" style="font-size:13px" title="Xóa">🗑</button></td>`:''}
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
