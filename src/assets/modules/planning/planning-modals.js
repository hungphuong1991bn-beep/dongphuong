// src/modules/planning/planning-modals.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Panel chi tiết Kế hoạch sản xuất (Drawer bên phải trên Desktop / bottom-sheet trên Mobile) -->
<div class="modal kh-drawer" id="khDetailModal" onclick="if(event.target===this)closeModal('khDetailModal');">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title" id="khDetailTitle">Chi tiết kế hoạch sản xuất</div>
    <div id="khDetailBody" style="font-size:13px;color:var(--text2);line-height:1.6"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('khDetailModal')">Đóng</button>
      <button class="btn" style="background:#0C7A54;color:#fff" id="khDetailProgressBtn" onclick="">📊 Tiến độ</button>
      <button class="btn" style="background:var(--brand);color:#fff;flex:1" id="khDetailEditBtn" onclick="">✏️ Chỉnh sửa</button>
    </div>
  </div>
</div>

<!-- Modal nhỏ: hiển thị QR cho 1 mã nguyên liệu (trong panel Kế hoạch SX) -->
<div class="modal" id="khMatQRModal">
  <div class="modal-box" style="max-width:320px;text-align:center">
    <div class="modal-handle"></div>
    <div class="modal-title" id="khMatQRTitle">QR mã nguyên liệu</div>
    <canvas id="khMatQRCanvas" width="200" height="200" style="margin:0 auto 14px;display:block"></canvas>
    <div class="modal-footer">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('khMatQRModal')">Đóng</button>
    </div>
  </div>
</div>`);
