// src/modules/account/account-menu.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

// Đồng bộ hiển thị tài khoản ở Topbar (avatar + tên + vai trò) và các phần
// tử ẩn (sbName/sbRole) vẫn cần cho các đoạn code cũ khác đọc giá trị này.
function updateTopbarProfile(user){
  if(!user) return;
  ensureUserProfileFields(user);
  const sbN=$('sbName'); if(sbN) sbN.textContent=user.name;
  const sbR=$('sbRole'); if(sbR) sbR.textContent=roleIcon(user.role)+' '+roleLabel(user.role);
  const abName=$('abName'); if(abName) abName.textContent=user.name;
  const abRole=$('abRole'); if(abRole) abRole.textContent=user.position||roleLabel(user.role);
  const _fab=$('fab'); if(_fab) _fab.classList.toggle('show', user.role==='admin');
  renderAvatarInto($('avatarBtnImg'), $('abInitials'), user);
  // Tab "Khách hàng": trước đây chỉ Admin xem được, nay mở thêm cho tài
  // khoản Nhân viên SX cùng xem/sử dụng (dùng isStaff() = admin||staff),
  // vẫn ẩn hẳn với tài khoản Chỉ xem/Số liệu.
  const sbiKhc=$('sbi-khachHang'); if(sbiKhc) sbiKhc.style.display = isStaff() ? 'flex' : 'none';
  const bnKhc=$('bn-khachHang'); if(bnKhc) bnKhc.style.display = isStaff() ? 'flex' : 'none';
}

// ════════════════════════════════════════════════════════════
// TÀI KHOẢN NGƯỜI DÙNG — Account Dropdown / User Menu
// (Avatar + tên cạnh nút "Đồng bộ" trên Global Header → mở dropdown
// tài khoản chuyên nghiệp: xem thông tin, sửa hồ sơ, đổi avatar, đổi
// mật khẩu, quản lý phiên, đăng xuất. Dùng chung 1 component cho toàn App.)
// ════════════════════════════════════════════════════════════
function ensureUserProfileFields(u){
  if(!u) return;
  if(u.position===undefined) u.position='';
  if(u.department===undefined) u.department='';
  if(u.avatar===undefined) u.avatar=null;
  if(u.status===undefined) u.status='active';
}
// Vẽ avatar (ảnh thật hoặc chữ cái đầu tên làm avatar mặc định) vào 1 cặp
// phần tử <img>/<span chữ cái>. Dùng chung cho Header, Dropdown, Modal hồ sơ.
function renderAvatarInto(imgEl, initialsEl, user){
  const url = user && user.avatar;
  if(imgEl){
    if(url){ imgEl.src=url; imgEl.style.display='block'; }
    else { imgEl.removeAttribute('src'); imgEl.style.display='none'; }
  }
  if(initialsEl){
    initialsEl.style.display = url ? 'none' : 'flex';
    initialsEl.textContent = userInitials(user && user.name);
  }
}
let _accDropdownOpen=false;
function toggleAccountDropdown(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  const dd=$('accDropdown'); if(!dd) return;
  if(_accDropdownOpen){ closeAccountDropdown(); return; }
  dd.innerHTML = buildAccountDropdownHTML();
  dd.classList.add('open');
  _accDropdownOpen=true;
  const btn=$('avatarBtn'); if(btn) btn.setAttribute('aria-expanded','true');
  positionAccountDropdown();
}
function closeAccountDropdown(){
  const dd=$('accDropdown'); if(dd) dd.classList.remove('open');
  _accDropdownOpen=false;
  const btn=$('avatarBtn'); if(btn) btn.setAttribute('aria-expanded','false');
}
function positionAccountDropdown(){
  const dd=$('accDropdown'), btn=$('avatarBtn'); if(!dd||!btn) return;
  const r=btn.getBoundingClientRect();
  const vw=window.innerWidth, vh=window.innerHeight;
  const dw=Math.min(320, vw-16);
  dd.style.width=dw+'px';
  let left=r.right-dw;
  if(left<8) left=8;
  if(left+dw>vw-8) left=Math.max(8,vw-8-dw);
  let top=r.bottom+8;
  let maxH=vh-top-12;
  if(maxH<220){
    const above=Math.min(460, r.top-16);
    top=Math.max(8, r.top-8-above);
    maxH=above;
  }
  dd.style.left=left+'px';
  dd.style.top=top+'px';
  dd.style.maxHeight=Math.max(180,maxH)+'px';
}
function buildAccountDropdownHTML(){
  const u=currentUser; if(!u) return '';
  ensureUserProfileFields(u);
  const avatarHTML = u.avatar ? `<img src="${u.avatar}" alt="avatar">` : `<span>${userInitials(u.name)}</span>`;
  const lastLoginTxt = u.lastLoginAt ? vnDateTimeShort(new Date(u.lastLoginAt)) : 'Hôm nay';
  return `
    <div class="acc-dd-head">
      <div class="acc-dd-avatar">${avatarHTML}</div>
      <div style="min-width:0">
        <div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.name}</div>
        <div style="font-size:11px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.position||roleLabel(u.role)}</div>
      </div>
    </div>
    <div class="acc-dd-sec">
      <span class="acc-status-badge"><span class="acc-status-dot"></span>Đang hoạt động</span>
      <div style="font-size:10.5px;color:var(--text4);margin-top:6px">Đăng nhập gần nhất: ${lastLoginTxt}</div>
    </div>
    <div class="acc-dd-div"></div>
    <div class="acc-dd-sec">
      <div class="acc-dd-sec-title">Thông tin cá nhân</div>
      <div class="acc-dd-row">👤 <b>${u.name}</b></div>
      <div class="acc-dd-row">🆔 @${u.username}</div>
      ${u.email?`<div class="acc-dd-row">✉️ ${u.email}</div>`:''}
      ${u.phone?`<div class="acc-dd-row">📞 ${u.phone}</div>`:''}
    </div>
    <div class="acc-dd-sec">
      <div class="acc-dd-sec-title">Thông tin công việc</div>
      <div class="acc-dd-row">💼 ${u.position||'—'}</div>
      <div class="acc-dd-row">🏭 ${u.department||'—'}</div>
      <div class="acc-dd-row">🔑 ${roleLabel(u.role)}</div>
    </div>
    <div class="acc-dd-div"></div>
    <div class="acc-dd-sec">
      <button class="acc-dd-btn" onclick="closeAccountDropdown();openEditProfileModal()">✏️ Chỉnh sửa hồ sơ</button>
      <button class="acc-dd-btn" onclick="closeAccountDropdown();openChangePassModal()">🔐 Đổi mật khẩu</button>
      <button class="acc-dd-btn" onclick="closeAccountDropdown();openSessionModal()">🖥️ Quản lý phiên đăng nhập</button>
      <div class="acc-dd-div"></div>
      <button class="acc-dd-btn danger" onclick="closeAccountDropdown();confirm2('Đăng xuất','Bạn có chắc chắn muốn đăng xuất?',doLogout)">🚪 Đăng xuất</button>
    </div>
  `;
}
function openEditProfileModal(){
  const u=currentUser; if(!u) return;
  ensureUserProfileFields(u);
  $('epName').value=u.name||'';
  $('epEmail').value=u.email||'';
  $('epPhone').value=u.phone||'';
  $('epPosition').value=u.position||'';
  $('epDept').value=u.department||'';
  _pendingAvatarDataUrl=undefined;
  const spin=$('avuSpin'); if(spin) spin.style.display='none';
  renderAvatarInto($('avuImg'),$('avuInitials'),u);
  openModal('profileModal');
}
function openChangePassModal(){
  $('cpOld').value=''; $('cpNew').value=''; $('cpCf').value='';
  pwStrengthUpdate('');
  ['cpOld','cpNew','cpCf'].forEach(id=>{ const el=$(id); if(el) el.type='password'; });
  openModal('passModal');
}
function openSessionModal(){
  const u=currentUser; if(!u) return;
  const dev = deviceInfo();
  const lastLoginTxt = u.lastLoginAt ? vnDateTimeShort(new Date(u.lastLoginAt)) : '—';
  $('sessBody').innerHTML = `
    <div class="acc-dd-row" style="padding:6px 0">${dev.icon} <b>${dev.label}</b> — phiên hiện tại</div>
    <div class="acc-dd-row" style="padding:6px 0">⏱️ Đang hoạt động: <b>${fmtOnlineDuration(_sessionStart)}</b></div>
    <div class="acc-dd-row" style="padding:6px 0">🕐 Đăng nhập gần nhất: <b>${lastLoginTxt}</b></div>
    <div style="font-size:11px;color:var(--text4);margin-top:10px">Đăng xuất sẽ kết thúc phiên làm việc hiện tại trên thiết bị này.</div>
  `;
  openModal('sessModal');
}
// Đóng dropdown khi: click ra ngoài, nhấn ESC, cuộn trang, đổi cỡ màn hình.
document.addEventListener('click', function(e){
  if(!_accDropdownOpen) return;
  const dd=$('accDropdown'), btn=$('avatarBtn');
  if(dd && dd.contains(e.target)) return;
  if(btn && btn.contains(e.target)) return;
  closeAccountDropdown();
});
document.addEventListener('keydown', function(e){ if(e.key==='Escape' && _accDropdownOpen) closeAccountDropdown(); });
window.addEventListener('scroll', function(){ if(_accDropdownOpen) closeAccountDropdown(); }, true);
window.addEventListener('resize', function(){ if(_accDropdownOpen) positionAccountDropdown(); });

// ── Thay avatar: chọn ảnh, xem trước, tự crop tròn, lưu cùng lúc Lưu hồ sơ ──
let _pendingAvatarDataUrl;
function onAvatarFileChange(input){
  const file = input.files && input.files[0]; if(!file) return;
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)){ showToast('⚠️ Chỉ chấp nhận ảnh JPG, PNG, WEBP'); input.value=''; return; }
  if(file.size > 4*1024*1024){ showToast('⚠️ Ảnh vượt quá giới hạn 4MB'); input.value=''; return; }
  const spin=$('avuSpin'); if(spin) spin.style.display='flex';
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      const size=240;
      const canvas=document.createElement('canvas'); canvas.width=size; canvas.height=size;
      const ctx=canvas.getContext('2d');
      const side=Math.min(img.width, img.height);
      const sx=(img.width-side)/2, sy=(img.height-side)/2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      _pendingAvatarDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const avImg=$('avuImg'), avInit=$('avuInitials');
      if(avImg){ avImg.src=_pendingAvatarDataUrl; avImg.style.display='block'; }
      if(avInit) avInit.style.display='none';
      if(spin) spin.style.display='none';
    };
    img.onerror=function(){ showToast('❌ Không đọc được ảnh này'); if(spin) spin.style.display='none'; };
    img.src=ev.target.result;
  };
  reader.onerror=function(){ showToast('❌ Lỗi đọc file'); if(spin) spin.style.display='none'; };
  reader.readAsDataURL(file);
  input.value='';
}
// ── Đổi mật khẩu: hiện/ẩn mật khẩu + thước đo độ mạnh ──
function pwToggle(id,btn){
  const el=$(id); if(!el) return;
  el.type = el.type==='password' ? 'text' : 'password';
  if(btn) btn.textContent = el.type==='password' ? '👁' : '🙈';
}
function pwStrengthUpdate(v){
  const bar=$('pwStrengthBar'), label=$('pwStrengthLabel'); if(!bar||!label) return;
  if(!v){ bar.style.width='0%'; bar.style.background='var(--border)'; label.style.color='var(--text4)'; label.textContent='Nhập mật khẩu mới'; return; }
  let score=0;
  if(v.length>=6) score++;
  if(v.length>=10) score++;
  if(/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if(/[0-9]/.test(v)) score++;
  if(/[^A-Za-z0-9]/.test(v)) score++;
  const levels=[
    {w:'20%',c:'#dc2626',t:'Rất yếu'},
    {w:'40%',c:'#f97316',t:'Yếu'},
    {w:'60%',c:'#eab308',t:'Trung bình'},
    {w:'80%',c:'#22c55e',t:'Mạnh'},
    {w:'100%',c:'#16a34a',t:'Rất mạnh'}
  ];
  const lv = levels[Math.max(0,Math.min(score,5)-1)];
  bar.style.width=lv.w; bar.style.background=lv.c; label.style.color=lv.c; label.textContent='Độ mạnh: '+lv.t;
}
