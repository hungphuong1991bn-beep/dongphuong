// src/modules/orders/orders-detail-modal.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Modal: Xem chi tiết đơn hàng (Tab Đơn đang làm) -->
<div class="modal" id="ddDetailModal">
  <div class="modal-box" style="max-width:560px">
    <div class="modal-handle"></div>
    <div class="modal-title" id="ddDetailTitle">Chi tiết đơn hàng</div>
    <div id="ddDetailBody" style="font-size:13px;color:var(--text2);line-height:1.9"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('ddDetailModal')">Đóng</button>
      <button class="btn" style="background:#0C7A54;color:#fff" id="ddDetailPlanBtn" onclick="">🏭 Xem ở Kế hoạch SX</button>
      <button class="btn" style="background:var(--brand);color:#fff;flex:1" id="ddDetailEditBtn" onclick="">✏️ Chỉnh sửa</button>
    </div>
  </div>
</div>`);
