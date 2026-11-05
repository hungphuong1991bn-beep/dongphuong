// src/modules/molds/molds-modals.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Quản lý Khuôn — Thêm/Sửa mục Tổng hợp Khuôn (chỉ Admin) -->
<div class="modal" id="khCatModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="khCatModalTitle">Thêm kích thước khuôn</div>
    <div id="khCatErr" class="modal-err"></div>
    <div class="field">
      <div class="field-lbl">Nhóm khuôn *</div>
      <input id="khCatGroup" class="field-inp" list="khCatGroupList" placeholder="VD: Đồng thanh dẹt">
      <datalist id="khCatGroupList"></datalist>
    </div>
    <div class="field">
      <div class="field-lbl">Kích thước / Chủng loại *</div>
      <input id="khCatSize" class="field-inp" placeholder="VD: 10x60 hoặc Φ 20">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="khCatDelBtn" style="display:none;color:#B91C1C;border-color:#FCA5A5;margin-right:auto" onclick="khCatDeleteFromModal()">🗑 Xóa</button>
      <button class="btn btn-ghost" onclick="closeModal('khCatModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="khCatSave()">💾 Lưu</button>
    </div>
  </div>
</div>

<!-- Quản lý Khuôn — Thêm/Sửa mục Số lượng Khuôn (chỉ Admin) -->
<div class="modal" id="khQtyModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="khQtyModalTitle">Thêm khuôn vào kho</div>
    <div id="khQtyErr" class="modal-err"></div>
    <div class="modal-row">
      <div class="field">
        <div class="field-lbl">Loại khuôn *</div>
        <select id="khQtyLoai" class="field-inp">
          <option value="Đùn">Đùn</option>
          <option value="Kéo">Kéo (Rút)</option>
        </select>
      </div>
      <div class="field">
        <div class="field-lbl">Nhóm khuôn *</div>
        <input id="khQtyGroup" class="field-inp" list="khQtyGroupList" placeholder="VD: Đồng thanh dẹt">
        <datalist id="khQtyGroupList"></datalist>
      </div>
    </div>
    <div class="field">
      <div class="field-lbl">Kích thước / Chủng loại *</div>
      <input id="khQtySize" class="field-inp" placeholder="VD: 10x60 hoặc Φ 20">
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Số lượng *</div><input id="khQtyNum" class="field-inp" type="number" min="0" placeholder="0"></div>
      <div class="field"><div class="field-lbl">Ngày mua</div><input id="khQtyDate" class="field-inp" type="date"></div>
    </div>
    <div class="field"><div class="field-lbl">Ghi chú</div><input id="khQtyNote" class="field-inp" placeholder=""></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('khQtyModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="khQtySave()">💾 Lưu</button>
    </div>
  </div>
</div>`);
