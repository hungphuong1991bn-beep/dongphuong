// src/modules/maintenance/maintenance-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function saveBaoTri(){if(guardViewer())return;
  lsSave();
  syncArrFieldToServer('baoTri', '/data/baoTri');
}
