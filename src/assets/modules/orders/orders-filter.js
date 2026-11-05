// src/modules/orders/orders-filter.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

// Chuẩn hoá 1 chuỗi kích thước để so khớp tìm kiếm: gộp mọi ký hiệu "nhân"
// (×, *, x, X, có/không khoảng trắng quanh nó) về cùng 1 dạng "x", đồng thời
// bỏ đơn vị "mm" dính liền sau số (vd "6000mm" → "6000"). Nhờ vậy người dùng
// gõ tay ("20x30x4000") hay bấm/dán NGUYÊN chuỗi quy cách đang hiển thị trên
// bảng (vd "Φ18×6000mm", "20×30×4000mm") đều tìm ra đúng đơn — trước đây dán
// nguyên chuỗi hiển thị luôn ra rỗng vì dấu "×" và chữ "mm" không được chuẩn
// hoá giống lúc lưu dữ liệu.
function _normSpecQuery(s){
  return String(s||'')
    .replace(/[×xX*]/g, 'x')   // mọi ký hiệu nhân → "x"
    .replace(/\s*x\s*/g, 'x')  // bỏ khoảng trắng quanh dấu "x" (vd "18 x 6000" → "18x6000")
    .replace(/mm\b/g, '');     // bỏ đơn vị "mm" dính liền sau số
}
// Khớp 1 từ khoá với 1 trường dữ liệu (đã chuẩn hoá). Với từ khoá chỉ gồm
// số/dấu "x" (kích thước, mã số...) bắt buộc khớp NGUYÊN một "từ" theo ranh
// giới khoảng trắng, thay vì chỉ cần là chuỗi con — trước đây tìm "10x100"
// (includes) bị khớp NHẦM vào cả "10x1000" (chỉ vì "10x100" là 5 ký tự đầu
// của "10x1000"), khiến kết quả trả về rất nhiều/gần như toàn bộ đơn không
// liên quan thay vì đúng 1 đơn có quy cách 10×100. Với từ khoá chữ (tên
// khách, ghi chú...) vẫn giữ khớp chuỗi con như cũ để tìm linh hoạt.
function _specTokenMatch(fieldStr, token){
  // Nhận diện "mã kích thước" (thuần số/x, hoặc có tiền tố fi/phi/φ) — áp
  // dụng khớp NGUYÊN từ cho cả nhóm này. Trước đây chỉ áp dụng cho token
  // thuần số/x nên "φ10x100" (dán nguyên quy cách hiển thị) vẫn bị khớp
  // NHẦM vào "φ10x1000" qua includes() thông thường.
  if(/^(fi|phi|φ)?[0-9]+(x[0-9]+)*$/.test(token)){
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp('(^|\\s)'+esc+'(\\s|$)').test(fieldStr);
  }
  return fieldStr.includes(token);
}
function matchSearch(o, q){
  if(!q) return true;
  const qNorm = _normSpecQuery(_stripDiacritics(q.toLowerCase())).trim();
  if(!qNorm) return true;
  // Kích thước gộp: cho phép gõ "20x30", "20x30x4000", "Φ50", "phi50", "fi50"
  // — cũng như dán nguyên cụm hiển thị "Φ18x6000" / "20x30x4000" (đã qua
  // _normSpecQuery ở trên) nhờ có sẵn các biến thể gộp Φ+kích thước dưới đây.
  const sizeStr = o.isRound && o.phi
    ? `phi${o.phi} fi${o.phi} Φ${o.phi} ${o.phi}x${o.length||''} Φ${o.phi}x${o.length||''} phi${o.phi}x${o.length||''}`
    : `${o.thickness||''}x${o.width||''}x${o.length||''} ${o.thickness||''}*${o.width||''} ${o.thickness||''}x${o.width||''}`;
  const fields = [
    o.customer, o.po, o.id, o.type, o.note, o.material, o.priority,
    String(o.thickness||''), String(o.width||''), String(o.length||''),
    String(o.phi||''), String(o.qty||''), sizeStr,
    o.isCoil?'cuộn coil':'', String(o.meterPerCoil||''), String(o.totalMeters||'')
  ].map(v=>_normSpecQuery(_stripDiacritics(String(v||'').toLowerCase())));
  // Cho phép gõ nhiều từ khoá cách nhau bởi khoảng trắng, mỗi từ chỉ cần khớp
  // ở MỘT trường bất kỳ (không nhất thiết cùng 1 trường) → ví dụ gõ "fi18 gap1"
  // hoặc "2x12 cuon" vẫn ra đúng đơn dù kích thước và loại cuộn nằm ở 2 trường khác nhau.
  const tokens = qNorm.split(/\s+/).filter(Boolean);
  if(tokens.length<=1) return fields.some(v=>_specTokenMatch(v, qNorm));
  return tokens.every(t=>fields.some(v=>_specTokenMatch(v, t)));
}

// ── Thao tác hàng loạt ──



// ── 1 Dòng trong bảng Đơn hàng (ERP/MES table style, giống ảnh mẫu) ──
// Xuất danh sách đơn hàng đang hiển thị (đã áp bộ lọc/tìm kiếm) ra file CSV
// mở được bằng Excel — không phụ thuộc thư viện ngoài, an toàn & nhẹ.
// ── Ô tìm kiếm nhanh trên Topbar: BỘ LỌC THÔNG MINH ──────────────────
// Đây là ô tìm kiếm DUY NHẤT dùng chung cho mọi tab (Đơn hàng / Kế hoạch
// SX / Đơn hoàn thành) — các ô tìm kiếm riêng trong từng tab đã được bỏ.
// Ngoài tìm theo từ khoá tự do (mã đơn, PO, quy cách...) như trước, ô này
// còn tự nhận diện ngay trong câu gõ vào:
//   • Tab cần xem: "kế hoạch" → Kế hoạch SX; "đã giao"/"hoàn thành"/
//     "nhập kho"/"hoàn trả"/"chờ giao" → Đơn hoàn thành; mặc định → Đơn hàng
//   • Mức ưu tiên: "gấp 1".."gấp 8" (viết liền "gap1" cũng nhận được)
//   • Trạng thái đơn (theo đúng tab đang nhắm tới, VD "chưa lên kế hoạch",
//     "đang sản xuất", "chờ nhập kho", "quá hạn"...)
//   • Tên khách hàng (so khớp với danh sách khách hàng đã có đơn trong hệ
//     thống, ưu tiên khách có tên trùng nhiều từ nhất)
// Phần chữ còn lại sau khi đã "bóc" hết các bộ lọc nhận diện được ở trên
// sẽ dùng làm từ khoá tìm kiếm tự do như cơ chế cũ (matchSearch/htMatchSearch).
function _smartTokenNorm(s){ return _stripDiacritics(String(s||'').toLowerCase()); }

// Tìm 1 trong các cụm từ (mỗi cụm là mảng token đã chuẩn hoá) trong danh sách
// token của câu tìm kiếm, đánh dấu đã dùng (used) để không lấy trùng phần đó
// vào từ khoá tự do hay bộ lọc khác.
function _smartFindPhrase(nTokens, used, phraseList){
  for(const phrase of phraseList){
    for(let i=0;i<=nTokens.length-phrase.length;i++){
      let ok = true;
      for(let j=0;j<phrase.length;j++){
        if(used[i+j] || nTokens[i+j]!==phrase[j]){ ok=false; break; }
      }
      if(ok){ for(let j=0;j<phrase.length;j++) used[i+j]=true; return true; }
    }
  }
  return false;
}
