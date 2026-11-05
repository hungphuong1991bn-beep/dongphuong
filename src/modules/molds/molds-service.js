// src/modules/molds/molds-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function saveKhuonCatalog(){if(guardNotAdmin())return;
  lsSave();
  syncArrFieldToServer('khuonCatalog', '/data/khuonCatalog');
}

function saveKhuonQty(){if(guardNotAdmin())return;
  lsSave();
  syncArrFieldToServer('khuonQty', '/data/khuonQty');
}
