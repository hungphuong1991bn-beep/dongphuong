// src/modules/qr/qr-public-screen.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- ═══ LOGIN ═══ -->
<!-- ═══ MÀN HÌNH TRA CỨU CÔNG KHAI (khách quét mã QR bằng camera điện thoại thường) ═══ -->
<div id="publicScanScreen" class="screen">
  <div class="pub-wrap" id="pubWrap">
    <div class="pub-msg">⏳ Đang tải thông tin sản phẩm…</div>
  </div>
</div>`);
