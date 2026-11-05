// src/modules/account/account-modals.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- User Modal -->
<div class="modal" id="userModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="userModalTitle">Thêm tài khoản</div>
    <div id="userErr" class="modal-err"></div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Tên đăng nhập *</div><input id="ufUser" class="field-inp" placeholder="username" autocomplete="off"></div>
      <div class="field"><div class="field-lbl">Mật khẩu</div><input id="ufPass" class="field-inp" type="password" placeholder="••••••" autocomplete="new-password"></div>
    </div>
    <div class="field"><div class="field-lbl">Họ tên *</div><input id="ufName" class="field-inp" placeholder="Tên hiển thị"></div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Vai trò</div>
        <select id="ufRole" class="field-inp">
          <option value="staff">👤 Nhân viên</option>
          <option value="solieu">📊 Chỉ nhập Số liệu</option>
          <option value="viewer">👁 Xem</option>
          <option value="admin">👑 Admin</option>
        </select>
      </div>
      <div class="field"><div class="field-lbl">Email</div><input id="ufEmail" class="field-inp" type="email" placeholder=""></div>
    </div>
    <div class="field"><div class="field-lbl">Số điện thoại</div><input id="ufPhone" class="field-inp" placeholder=""></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('userModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="saveUser()">💾 Lưu</button>
    </div>
  </div>
</div>

<!-- Edit Profile Modal -->
<div class="modal" id="profileModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">Thông tin tài khoản</div>
    <div class="avu-wrap">
      <div class="avu-circle" id="avuCircle">
        <img id="avuImg" src="" alt="avatar">
        <span id="avuInitials">?</span>
        <div class="avu-spin" id="avuSpin">⏳</div>
      </div>
      <button type="button" class="avu-btn" onclick="$('avuFile').click()">✏️ Thay đổi ảnh đại diện</button>
      <div class="avu-hint">JPG, PNG, WEBP · tối đa 4MB · tự động cắt tròn</div>
      <input type="file" id="avuFile" accept="image/jpeg,image/png,image/webp" style="display:none" onchange="onAvatarFileChange(this)">
    </div>
    <div class="field"><div class="field-lbl">Họ và tên</div><input id="epName" class="field-inp"></div>
    <div class="field"><div class="field-lbl">Email</div><input id="epEmail" class="field-inp" type="email"></div>
    <div class="field"><div class="field-lbl">Điện thoại</div><input id="epPhone" class="field-inp"></div>
    <div class="field"><div class="field-lbl">Chức vụ</div><input id="epPosition" class="field-inp" placeholder="VD: Trưởng phòng sản xuất"></div>
    <div class="field"><div class="field-lbl">Bộ phận</div><input id="epDept" class="field-inp" placeholder="VD: Bộ phận đóng gói"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('profileModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="saveProfile()">💾 Lưu thay đổi</button>
    </div>
  </div>
</div>

<!-- Change Password Modal -->
<div class="modal" id="passModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">Đổi mật khẩu</div>
    <div id="passErr" class="modal-err"></div>
    <div class="field">
      <div class="field-lbl">Mật khẩu hiện tại</div>
      <div class="field-inp-wrap"><input id="cpOld" class="field-inp" type="password"><button type="button" class="pw-eye" onclick="pwToggle('cpOld',this)">👁</button></div>
    </div>
    <div class="field">
      <div class="field-lbl">Mật khẩu mới</div>
      <div class="field-inp-wrap"><input id="cpNew" class="field-inp" type="password" oninput="pwStrengthUpdate(this.value)"><button type="button" class="pw-eye" onclick="pwToggle('cpNew',this)">👁</button></div>
      <div class="pw-strength"><i id="pwStrengthBar"></i></div>
      <div class="pw-strength-label" id="pwStrengthLabel">Nhập mật khẩu mới</div>
    </div>
    <div class="field">
      <div class="field-lbl">Xác nhận lại</div>
      <div class="field-inp-wrap"><input id="cpCf" class="field-inp" type="password"><button type="button" class="pw-eye" onclick="pwToggle('cpCf',this)">👁</button></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('passModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="savePass()">💾 Đổi MK</button>
    </div>
  </div>
</div>

<!-- Session Management Modal -->
<div class="modal" id="sessModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">Quản lý phiên đăng nhập</div>
    <div id="sessBody"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('sessModal')">Đóng</button>
      <button class="btn btn-primary" style="background:#dc2626" onclick="closeModal('sessModal');confirm2('Đăng xuất','Bạn có chắc chắn muốn đăng xuất?',doLogout)">🚪 Đăng xuất</button>
    </div>
  </div>
</div>`);
