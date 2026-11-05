// src/modules/settings/settings-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Settings
function renderSettings(){
  const u=currentUser; if(!u) return;
  const admin=isAdmin();
  $('mc').innerHTML=`
    <div class="profile-card">
      <div class="profile-avatar" style="${u.avatar?'':'background:linear-gradient(135deg,var(--brand),var(--brand2));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px'}">${u.avatar?`<img src="${u.avatar}" alt="avatar">`:userInitials(u.name)}</div>
      <div>
        <div class="profile-name">${u.name}</div>
        <div class="profile-role">${u.role==='admin'?'👑 Quản trị viên':u.role==='staff'?'⚙️ Nhân viên SX':u.role==='solieu'?'📊 Chỉ nhập Số liệu':'👁 Chỉ xem'}</div>
        ${u.position?`<div class="profile-detail">💼 ${u.position}</div>`:''}
        ${u.department?`<div class="profile-detail">🏭 ${u.department}</div>`:''}
        ${u.email?`<div class="profile-detail">✉️ ${u.email}</div>`:''}
        ${u.phone?`<div class="profile-detail">📞 ${u.phone}</div>`:''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="set-btn" onclick="openEditProfileModal()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Sửa thông tin cá nhân
      </button>
      <button class="set-btn" onclick="openModal('passModal');$('cpOld').value='';$('cpNew').value='';$('cpCf').value=''">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        Đổi mật khẩu
      </button>
      <button class="set-btn" onclick="$('fbSetup').style.display='flex';$('fbUrlInp').value=localStorage.getItem(FB_KEY)||''">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
        Cấu hình Firebase Sync
      </button>
      ${admin?`<button class="set-btn" onclick="$('aiSetup').style.display='flex';$('aiKeyInp').value=localStorage.getItem(AI_API_KEY_LS)||''">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M9 13v2M15 13v2"/></svg>
        Cấu hình AI Copilot nâng cao ${aiApiEnabled()?'<span style="color:#16a34a;font-weight:800">· Đang bật</span>':''}
      </button>`:''}
      <button class="set-btn" onclick="goTab('nhatKy')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Nhật ký thao tác
      </button>
      <div class="sec-title" style="margin-top:8px">🔔 Chuông & rung thông báo</div>
      <div class="set-toggle-card">
        <div class="set-toggle-row">
          <span style="font-size:19px">🔊</span>
          <div class="set-toggle-info">
            <div class="set-toggle-title">Âm thanh thông báo</div>
            <div class="set-toggle-sub">Reo chuông khi có đơn mới hoặc đơn vừa xong</div>
          </div>
          <label class="swtch">
            <input type="checkbox" ${notifSoundOn?'checked':''} onchange="toggleNotifSound(this.checked)">
            <span class="swtch-track"><span class="swtch-thumb"></span></span>
          </label>
        </div>
        <div class="set-toggle-row">
          <span style="font-size:19px">📳</span>
          <div class="set-toggle-info">
            <div class="set-toggle-title">Rung điện thoại</div>
            <div class="set-toggle-sub">Rung khi có đơn mới hoặc đơn vừa xong (Android)</div>
          </div>
          <label class="swtch">
            <input type="checkbox" ${notifVibrateOn?'checked':''} onchange="toggleNotifVibrate(this.checked)">
            <span class="swtch-track"><span class="swtch-thumb"></span></span>
          </label>
        </div>
      </div>
      <button class="set-btn" onclick="testNotifAlert()" style="border-color:#bfdbfe;background:#eff6ff;margin-top:2px">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        Thử chuông & rung
      </button>
      ${admin?`
      <div class="sec-title" style="margin-top:8px">Quản lý tài khoản</div>
      <div class="card" style="padding:0 14px">
        ${DB.users.map(usr=>`<div class="user-row">
          <div class="user-info">
            <div class="user-name">${usr.role==='admin'?'👑':usr.role==='staff'?'⚙️':usr.role==='solieu'?'📊':'👁'} ${usr.name}</div>
            <div class="user-sub">@${usr.username} · ${usr.role==='admin'?'Admin':usr.role==='staff'?'Nhân viên':usr.role==='solieu'?'Chỉ nhập Số liệu':'Xem'}</div>
          </div>
          <button class="icon-btn" onclick="editUser('${usr.id}')">✏️</button>
          ${usr.id!==currentUser.id?`<button class="icon-btn del" onclick="deleteUser('${usr.id}')">🗑</button>`:'<div style="width:32px"></div>'}
        </div>`).join('')}
      </div>
      <button class="set-btn" onclick="openAnnounce()" style="border-color:#bfdbfe;background:#eff6ff">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
        📢 Viết thông báo cho cả nhóm
      </button>
      <button class="set-btn" onclick="clearAnnounce()" style="border-color:#fde68a;background:#fffbeb">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        Xóa thông báo đang hiện
      </button>
      <button class="set-btn" onclick="openAddUser()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Thêm tài khoản mới
      </button>`:''}
      <button class="set-btn danger" onclick="confirm2('Đăng xuất','Xác nhận đăng xuất?',doLogout)">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        Đăng xuất
      </button>
      <div class="sec-title" style="margin-top:8px">📱 Phiên bản ứng dụng</div>
      <div class="card ver-card" id="verCardWrap">${buildVersionCard()}</div>
    </div>
  `;
  updateVerConnDot();
  refreshCacheStorageEstimate();
}
