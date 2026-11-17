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
    nganHang:'', soTaiKhoan:'', trangThai:'Đang làm', ghiChu:''
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
// Đếm dữ liệu lịch sử gắn với 1 nhân viên (công, nghỉ phép, kỷ luật) — theo workerId.
function workerHistoryCount(id){
  let att = 0;
  Object.keys(DB.attendance||{}).forEach(ym=>{ const r = (DB.attendance[ym]||{})[id]; if(r) att += Object.keys(r).filter(d=>r[d]!==''&&r[d]!=null).length; });
  const leave = (DB.nghiPhep||[]).filter(k=>k.workerId===id).length;
  const disc  = (DB.kyLuat||[]).filter(k=>k.workerId===id).length;
  return {att, leave, disc, total: att+leave+disc};
}
// [GĐ1 v2.6.0] LỖI GỐC: trước đây xóa nhân viên còn XÓA LUÔN toàn bộ công đã chấm của người đó ở mọi tháng
// → mất lịch sử không khôi phục được. NAY: nhân viên đã có lịch sử (công / nghỉ phép / kỷ luật) KHÔNG bị xóa;
// chỉ chuyển sang "Đã nghỉ việc" (giữ nguyên mọi dữ liệu, vẫn xem/xuất được). Chỉ hồ sơ trống (thêm nhầm,
// chưa có lịch sử) mới được xóa hẳn. Chỉ Admin.
function deleteWorker(id){if(guardViewer())return;
  if(!isAdmin()){ showToast('🔒 Chỉ Admin được xóa/cho nghỉ việc nhân viên', true); return; }
  const w = DB.workers.find(x=>x.id===id); if(!w) return;
  const h = workerHistoryCount(id);
  if(h.total>0){
    if((w.trangThai||'Đang làm')==='Đã nghỉ việc'){ showToast('ℹ️ '+(w.name||'Nhân viên')+' đã ở trạng thái Đã nghỉ việc — dữ liệu lịch sử được giữ nguyên'); return; }
    confirm2('Cho nghỉ việc (giữ lịch sử)',
      `"${w.name||'(chưa có tên)'}" đã có ${h.att} ô công, ${h.leave} đơn nghỉ phép, ${h.disc} bản ghi kỷ luật nên KHÔNG thể xóa. Chuyển sang trạng thái "Đã nghỉ việc"? Toàn bộ lịch sử vẫn được giữ nguyên.`, ()=>{
      w.trangThai = 'Đã nghỉ việc'; w.ngayNghiViec = w.ngayNghiViec || todayStr();
      saveWorkers();
      log('Cho nghỉ việc', `${w.name||'(chưa có tên)'} · giữ nguyên ${h.att} ô công, ${h.leave} đơn nghỉ phép, ${h.disc} kỷ luật`, '', {trangThai:'Đang làm'}, {trangThai:'Đã nghỉ việc'});
      refreshWorkerViews(); showToast('✅ Đã chuyển sang Đã nghỉ việc — lịch sử được giữ nguyên');
    });
    return;
  }
  confirm2('Xóa hồ sơ trống', `Xóa "${w.name||'(chưa có tên)'}" khỏi hệ thống? Hồ sơ này chưa có công, nghỉ phép hay kỷ luật nào.`, ()=>{
    DB.workers = DB.workers.filter(x=>x.id!==id);
    try{ if(hrSalaryCan() && hrSalaryGet(id)) hrSalarySet(id, 0); }catch(e){}   // dọn luôn mức lương của hồ sơ đã xoá
    saveWorkers();
    log('Xóa người lao động', `${w.name||'(chưa có tên)'} · hồ sơ trống (chưa có lịch sử)`, '', {workerId:id,name:w.name}, null);
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
  // v2.9.0: LƯƠNG chỉ Admin. Tài khoản khác: ẩn hẳn ô, KHÔNG nạp giá trị nào vào DOM.
  const _canSal = hrSalaryCan();
  if(_canSal){ try{ hrSalaryCaptureLegacy(); }catch(e){} }   // lương cũ còn trong hồ sơ → hiện đúng cho Admin
  const _salBox = document.getElementById('wpSalaryField'); if(_salBox) _salBox.style.display = _canSal ? '' : 'none';
  $('wpLuongCoBan').value = _canSal ? (hrSalaryGet(w.id) ? hrSalaryGet(w.id).toLocaleString('vi-VN') : '') : '';   // chỉ đọc — đổi lương ở tab Tăng lương
  $('wpNganHang').value = w.nganHang||'';
  $('wpSoTaiKhoan').value = w.soTaiKhoan||'';
  $('wpTrangThai').value = w.trangThai||'Đang làm';
  $('wpGhiChu').value = w.ghiChu||'';
  document.getElementById('workerProfileTitle').textContent = viewer ? '👁 Hồ sơ nhân viên' : '✏️ Sửa hồ sơ nhân viên';
  document.querySelectorAll('#workerProfileModal input, #workerProfileModal select, #workerProfileModal textarea').forEach(el=>{ el.disabled = viewer; });
  const saveBtn = document.getElementById('wpSaveBtn');
  if(saveBtn) saveBtn.style.display = viewer ? 'none' : '';
  const _hist = document.getElementById('wpHistory'); if(_hist) _hist.innerHTML = renderWorkerHistoryHtml(w);
  openModal('workerProfileModal');
}
// Đóng hồ sơ: xoá giá trị lương khỏi ô nhập (không để sót trong DOM sau khi đóng)
function closeWorkerProfile(){
  const el = document.getElementById('wpLuongCoBan'); if(el) el.value = '';
  closeModal('workerProfileModal');
}
function saveWorkerProfile(){
  if(guardViewer())return;
  if(!isAdmin()){ showToast('🔒 Chỉ Admin mới có quyền sửa hồ sơ nhân viên', true); return; }
  const id = $('wpId').value;
  const w = DB.workers.find(x=>x.id===id); if(!w) return;
  const _name = $('wpName').value.trim(), _ma = $('wpMaNV').value.trim();
  if(!_name){ showToast('⚠️ Vui lòng nhập họ và tên nhân viên', true); return; }
  if(_ma && DB.workers.some(x=>x.id!==id && (x.maNV||'').trim().toLowerCase()===_ma.toLowerCase())){ showToast('⚠️ Mã nhân viên "'+_ma+'" đã có người khác dùng', true); return; }
  w.name = _name;
  w.maNV = _ma;
  w.gioiTinh = $('wpGioiTinh').value;
  w.ngaySinh = $('wpNgaySinh').value;
  w.sdt = $('wpSdt').value.trim();
  w.cccd = $('wpCccd').value.trim();
  w.diaChi = $('wpDiaChi').value.trim();
  w.chucVu = $('wpChucVu').value.trim();
  w.boPhan = $('wpBoPhan').value.trim();
  w.ngayVaoLam = $('wpNgayVaoLam').value;
  w.loaiHopDong = $('wpLoaiHopDong').value;
  w.nganHang = $('wpNganHang').value.trim();
  w.soTaiKhoan = $('wpSoTaiKhoan').value.trim();
  w.trangThai = $('wpTrangThai').value;
  // Ngày nghỉ việc: tự ghi khi chuyển sang "Đã nghỉ việc" (dùng tính thâm niên), bỏ khi quay lại làm việc
  if(w.trangThai==='Đã nghỉ việc'){ if(!w.ngayNghiViec) w.ngayNghiViec = todayStr(); } else { delete w.ngayNghiViec; }
  w.ghiChu = $('wpGhiChu').value.trim();
  // v2.9.0: lương lưu riêng (chỉ Admin) — KHÔNG ghi vào hồ sơ chung, KHÔNG đưa số tiền vào nhật ký
  // v2.11.0: hồ sơ chỉ HIỂN THỊ mức lương hiện tại; mọi thay đổi lương đi qua tab "Tăng lương" (hrRaiseAdd)
  if(hrSalaryCan()){
    try{ hrSalaryCaptureLegacy(); }catch(e){}
    delete w.luongCoBan;   // không bao giờ để lương trong hồ sơ chung
  }
  saveWorkers();
  log('Sửa hồ sơ nhân viên', `${w.name||'(chưa có tên)'} · ${w.chucVu||''} ${w.boPhan?('· '+w.boPhan):''}`, '', null, {workerId:id});
  const _se = document.getElementById('wpLuongCoBan'); if(_se) _se.value = '';
  closeModal('workerProfileModal');
  showToast('✅ Đã lưu hồ sơ nhân viên');
  refreshWorkerViews();
}
