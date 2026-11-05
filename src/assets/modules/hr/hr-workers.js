// src/modules/hr/hr-workers.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Render lại đúng tab đang mở (Chấm công hoặc Quản lý nhân sự) sau khi danh
// sách người lao động thay đổi — 2 tab dùng CHUNG 1 nguồn dữ liệu DB.workers
// nên luôn phải đồng bộ với nhau dù thao tác được thực hiện ở tab nào.
function refreshWorkerViews(){
  if(currentTab==='nhanSu') renderNhanSu();
  else renderChamCong();
}

// Sinh mã nhân viên tự động dạng NV001, NV002... dựa trên mã lớn nhất đang có
// (không dùng số thứ tự trong mảng vì nhân viên có thể bị xóa giữa chừng).
function nextWorkerCode(){
  let maxN = 0;
  (DB.workers||[]).forEach(w=>{
    const mt = /^NV(\d+)$/.exec(w.maNV||'');
    if(mt) maxN = Math.max(maxN, parseInt(mt[1],10));
  });
  return 'NV' + String(maxN+1).padStart(3,'0');
}

function addWorker(){if(guardViewer())return;
  const id = uid();
  const fromNhanSu = (currentTab==='nhanSu');
  DB.workers.push({
    id, name:'', maNV: nextWorkerCode(), gioiTinh:'', ngaySinh:'', sdt:'', cccd:'',
    diaChi:'', chucVu:'', boPhan:'', ngayVaoLam: todayStr(), loaiHopDong:'',
    luongCoBan:'', nganHang:'', soTaiKhoan:'', trangThai:'Đang làm', ghiChu:''
  });
  saveWorkers();
  log('Thêm người lao động', `Đã thêm 1 người lao động mới vào bảng chấm công (chưa đặt tên)`, '', null, {workerId:id});
  refreshWorkerViews();
  setTimeout(()=>{
    if(fromNhanSu){ openWorkerProfile(id); }
    else { const el=document.getElementById('wkName_'+id); if(el){ el.focus(); } }
  }, 30);
}
function renameWorker(id, name){if(guardViewer())return;
  const w = DB.workers.find(x=>x.id===id); if(!w) return;
  const old = w.name;
  name = name.trim();
  if(old===name) return;
  w.name = name;
  saveWorkers();
  log('Sửa tên người lao động', `${old||'(chưa có tên)'} → ${name||'(chưa có tên)'}`, '', {name:old}, {name});
}
function deleteWorker(id){if(guardViewer())return;
  const w = DB.workers.find(x=>x.id===id); if(!w) return;
  confirm2('Xóa người lao động', `Xóa "${w.name||'(chưa có tên)'}" khỏi hệ thống? (Dữ liệu công đã chấm của người này cũng sẽ bị xóa)`, ()=>{
    DB.workers = DB.workers.filter(x=>x.id!==id);
    Object.keys(DB.attendance).forEach(ym=>{ if(DB.attendance[ym]) delete DB.attendance[ym][id]; });
    saveWorkers(); saveAttendance();
    log('Xóa người lao động', `${w.name||'(chưa có tên)'} · đã xóa toàn bộ dữ liệu công của người này`, '', {workerId:id,name:w.name}, null);
    refreshWorkerViews();
    showToast('Đã xóa');
  });
}

// Gán giá trị cho <select>, tự thêm option tạm nếu giá trị cũ (đã lưu trước đó)
// không nằm trong danh sách chuẩn — để không bị mất/trống dữ liệu cũ.
function setSelectKeepCustom(selectId, value){
  const el = document.getElementById(selectId);
  if(!el) return;
  value = value || '';
  if(value && !Array.from(el.options).some(o=>o.value===value)){
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = value + ' (cũ)';
    el.appendChild(opt);
  }
  el.value = value;
}

// ─── Hồ sơ nhân viên đầy đủ (mở modal sửa chi tiết) ───
function openWorkerProfile(id){
  const w = DB.workers.find(x=>x.id===id); if(!w) return;
  const viewer = !isAdmin(); // chỉ Admin được sửa hồ sơ, còn lại (Nhân viên, Xem) chỉ xem
  $('wpId').value = w.id;
  $('wpName').value = w.name||'';
  $('wpMaNV').value = w.maNV||'';
  $('wpGioiTinh').value = w.gioiTinh||'';
  $('wpNgaySinh').value = w.ngaySinh||'';
  $('wpSdt').value = w.sdt||'';
  $('wpCccd').value = w.cccd||'';
  $('wpDiaChi').value = w.diaChi||'';
  setSelectKeepCustom('wpChucVu', w.chucVu||'');
  setSelectKeepCustom('wpBoPhan', w.boPhan||'');
  $('wpNgayVaoLam').value = w.ngayVaoLam||'';
  $('wpLoaiHopDong').value = w.loaiHopDong||'';
  $('wpLuongCoBan').value = w.luongCoBan||'';
  $('wpNganHang').value = w.nganHang||'';
  $('wpSoTaiKhoan').value = w.soTaiKhoan||'';
  $('wpTrangThai').value = w.trangThai||'Đang làm';
  $('wpGhiChu').value = w.ghiChu||'';
  document.getElementById('workerProfileTitle').textContent = viewer ? '👁 Hồ sơ nhân viên' : '✏️ Sửa hồ sơ nhân viên';
  document.querySelectorAll('#workerProfileModal input, #workerProfileModal select, #workerProfileModal textarea').forEach(el=>{ el.disabled = viewer; });
  const saveBtn = document.getElementById('wpSaveBtn');
  if(saveBtn) saveBtn.style.display = viewer ? 'none' : '';
  openModal('workerProfileModal');
}
function saveWorkerProfile(){
  if(guardViewer())return;
  if(!isAdmin()){ showToast('🔒 Chỉ Admin mới có quyền sửa hồ sơ nhân viên', true); return; }
  const id = $('wpId').value;
  const w = DB.workers.find(x=>x.id===id); if(!w) return;
  w.name = $('wpName').value.trim();
  w.maNV = $('wpMaNV').value.trim();
  w.gioiTinh = $('wpGioiTinh').value;
  w.ngaySinh = $('wpNgaySinh').value;
  w.sdt = $('wpSdt').value.trim();
  w.cccd = $('wpCccd').value.trim();
  w.diaChi = $('wpDiaChi').value.trim();
  w.chucVu = $('wpChucVu').value.trim();
  w.boPhan = $('wpBoPhan').value.trim();
  w.ngayVaoLam = $('wpNgayVaoLam').value;
  w.loaiHopDong = $('wpLoaiHopDong').value;
  w.luongCoBan = $('wpLuongCoBan').value;
  w.nganHang = $('wpNganHang').value.trim();
  w.soTaiKhoan = $('wpSoTaiKhoan').value.trim();
  w.trangThai = $('wpTrangThai').value;
  w.ghiChu = $('wpGhiChu').value.trim();
  saveWorkers();
  log('Sửa hồ sơ nhân viên', `${w.name||'(chưa có tên)'} · ${w.chucVu||''} ${w.boPhan?('· '+w.boPhan):''}`, '', null, {workerId:id});
  closeModal('workerProfileModal');
  showToast('✅ Đã lưu hồ sơ nhân viên');
  refreshWorkerViews();
}
