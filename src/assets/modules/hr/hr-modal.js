// src/modules/hr/hr-modal.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Hồ sơ nhân viên đầy đủ (dùng chung cho Thêm / Sửa từ tab Quản lý nhân sự) -->
<div class="modal" id="workerProfileModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="workerProfileTitle">✏️ Sửa hồ sơ nhân viên</div>
    <input type="hidden" id="wpId">
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Họ và tên *</div><input id="wpName" class="field-inp" placeholder="Nguyễn Văn A"></div>
      <div class="field"><div class="field-lbl">Mã nhân viên</div><input id="wpMaNV" class="field-inp" placeholder="NV001"></div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Giới tính</div>
        <select id="wpGioiTinh" class="field-inp">
          <option value="">-- Chọn --</option>
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
          <option value="Khác">Khác</option>
        </select>
      </div>
      <div class="field"><div class="field-lbl">Ngày sinh</div><input id="wpNgaySinh" class="field-inp" type="date"></div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Số điện thoại</div><input id="wpSdt" class="field-inp" type="tel" placeholder="09xxxxxxxx"></div>
      <div class="field"><div class="field-lbl">CCCD/CMND</div><input id="wpCccd" class="field-inp" placeholder="Số CCCD"></div>
    </div>
    <div class="field"><div class="field-lbl">Địa chỉ</div><input id="wpDiaChi" class="field-inp" placeholder="Địa chỉ thường trú"></div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Chức vụ</div>
        <select id="wpChucVu" class="field-inp">
          <option value="">-- Chọn chức vụ --</option>
          <option value="Công nhân">Công nhân</option>
          <option value="Tổ trưởng">Tổ trưởng</option>
          <option value="Trưởng ca">Trưởng ca</option>
          <option value="Quản đốc">Quản đốc</option>
          <option value="Kế toán">Kế toán</option>
          <option value="Bảo vệ">Bảo vệ</option>
          <option value="Lái xe">Lái xe</option>
          <option value="Kỹ thuật/Bảo trì">Kỹ thuật/Bảo trì</option>
        </select>
      </div>
      <div class="field"><div class="field-lbl">Bộ phận / Tổ</div>
        <select id="wpBoPhan" class="field-inp">
          <option value="">-- Chọn bộ phận --</option>
          <option value="Thanh Cái">Thanh Cái</option>
          <option value="Lò">Lò</option>
          <option value="Kéo">Kéo</option>
          <option value="Kho">Kho</option>
          <option value="Băm ép">Băm ép</option>
          <option value="Aomaga">Aomaga</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Ngày vào làm</div><input id="wpNgayVaoLam" class="field-inp" type="date"></div>
      <div class="field"><div class="field-lbl">Loại hợp đồng</div>
        <select id="wpLoaiHopDong" class="field-inp">
          <option value="">-- Chọn --</option>
          <option value="Thử việc">Thử việc</option>
          <option value="Chính thức">Chính thức</option>
          <option value="Thời vụ">Thời vụ</option>
          <option value="Khác">Khác</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Lương cơ bản (VNĐ)</div><input id="wpLuongCoBan" class="field-inp" type="number" placeholder="VD: 6000000"></div>
      <div class="field"><div class="field-lbl">Trạng thái</div>
        <select id="wpTrangThai" class="field-inp">
          <option value="Đang làm">🟢 Đang làm</option>
          <option value="Tạm nghỉ">🟡 Tạm nghỉ</option>
          <option value="Đã nghỉ việc">⚪ Đã nghỉ việc</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Ngân hàng</div><input id="wpNganHang" class="field-inp" placeholder="VD: Vietcombank"></div>
      <div class="field"><div class="field-lbl">Số tài khoản</div><input id="wpSoTaiKhoan" class="field-inp" placeholder="Số tài khoản ngân hàng"></div>
    </div>
    <div class="field"><div class="field-lbl">Ghi chú thêm</div><textarea id="wpGhiChu" class="field-inp" style="min-height:55px;resize:vertical" placeholder="Ghi chú khác (nếu có)"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('workerProfileModal')">Đóng</button>
      <button class="btn btn-primary" id="wpSaveBtn" onclick="saveWorkerProfile()">💾 Lưu hồ sơ</button>
    </div>
  </div>
</div>`);
