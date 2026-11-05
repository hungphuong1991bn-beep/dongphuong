// src/modules/maintenance/maintenance-modal.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Bảo trì máy Modal -->
<div class="modal" id="btmModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="btmModalTitle">Báo hỏng / Bảo trì máy</div>
    <div id="btmErr" class="modal-err"></div>
    <div class="field">
      <div class="field-lbl">Máy</div>
      <input id="btmMachineName" class="field-inp" readonly style="background:var(--bg);font-weight:700">
    </div>
    <div class="modal-row">
      <div class="field">
        <div class="field-lbl">Loại</div>
        <select id="btmType" class="field-inp">
          <option value="hong">🔴 Máy hỏng đột xuất</option>
          <option value="baotri">🟡 Bảo trì định kỳ</option>
          <option value="kiemtra">🔵 Kiểm tra định kỳ</option>
        </select>
      </div>
      <div class="field">
        <div class="field-lbl">Trạng thái</div>
        <select id="btmStatus" class="field-inp">
          <option value="dang_sua">⏳ Đang sửa / đang xử lý</option>
          <option value="da_xong">✅ Đã xong</option>
        </select>
      </div>
    </div>
    <div class="field">
      <div class="field-lbl">Máy hỏng gì? / Mô tả sự cố *</div>
      <input id="btmIssue" class="field-inp" placeholder="VD: Kẹt trục vít, cháy motor, rò dầu...">
    </div>
    <div class="field">
      <div class="field-lbl">Thay thế gì? / Linh kiện, vật tư sửa chữa</div>
      <input id="btmParts" class="field-inp" placeholder="VD: Thay bạc đạn, dây curoa, cầu chì...">
    </div>
    <div class="modal-row">
      <div class="field"><div class="field-lbl">Người sửa / kỹ thuật</div><input id="btmTech" class="field-inp" placeholder="Tên người thực hiện"></div>
      <div class="field"><div class="field-lbl">Ngày</div><input id="btmDate" class="field-inp" type="date"></div>
    </div>
    <div class="field"><div class="field-lbl">Chi phí (nếu có)</div><input id="btmCost" class="field-inp" type="number" placeholder="VNĐ"></div>
    <div class="field"><div class="field-lbl">Ghi chú thêm</div><input id="btmNote" class="field-inp" placeholder=""></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('btmModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="btmSaveRecord()">💾 Lưu</button>
    </div>
  </div>
</div>`);
