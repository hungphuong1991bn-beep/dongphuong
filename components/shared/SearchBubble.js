// src/components/shared/SearchBubble.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Bộ lọc hợp nhất (Search Bubble) — Bottom Sheet (Mobile) / Floating Panel (Desktop),
     dùng chung cho 3 tab Đơn hàng / Kế hoạch SX / Đơn hoàn thành -->
<div class="us-overlay" id="usOverlay" onclick="usClose()"></div>
<div class="us-sheet" id="usSheet">
  <div class="us-sheet-handle"></div>
  <div class="us-sheet-header">
    <b id="usSheetTitle">Bộ lọc</b>
    <button class="us-sheet-close" onclick="usClose()">✕</button>
  </div>
  <div class="us-sheet-body" id="usSheetBody"></div>
  <div class="us-sheet-footer">
    <button class="dd-reset-btn" onclick="usResetCurrent()">↺ Đặt lại</button>
    <button class="us-sheet-apply" onclick="usClose()">Áp dụng</button>
  </div>
</div>`);
