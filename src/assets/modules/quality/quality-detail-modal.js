// src/modules/quality/quality-detail-modal.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Modal: chi tiết đơn ở tab "Đơn hàng đã hoàn thành" (chỉ theo dõi nhập kho/giao hàng, không có tiến độ SX) -->
<div class="modal" id="htDetailModal">
  <div class="modal-box" style="max-width:480px">
    <div class="modal-handle"></div>
    <div class="modal-title" id="htDetailTitle">Chi tiết thành phẩm</div>
    <div id="htDetailBody" style="font-size:13px;color:var(--text2);line-height:1.9"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('htDetailModal')">Đóng</button>
      <button class="btn btn-ghost" id="htDetailRevertBtn" style="display:none" onclick="">↩️ Về chờ SX</button>
      <button class="btn" style="background:var(--brand);color:#fff;flex:1" id="htDetailPrintBtn" onclick="">🖨 In phiếu</button>
    </div>
  </div>
</div>`);
