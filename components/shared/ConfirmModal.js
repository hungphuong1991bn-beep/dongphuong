// src/components/shared/ConfirmModal.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Confirm Modal -->
<div class="modal" id="cfModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="cfTitle"></div>
    <div style="font-size:13.5px;color:var(--text2);margin-bottom:4px" id="cfBody"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('cfModal')">Huỷ</button>
      <button class="btn" style="background:var(--red-m);color:#fff;flex:1" onclick="cfOK()">Xác nhận</button>
    </div>
  </div>
</div>`);
