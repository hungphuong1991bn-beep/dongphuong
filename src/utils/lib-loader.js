// src/utils/lib-loader.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


let _exceljsPromise = null;
function ensureExcelJs(){
  if(window.ExcelJS) return Promise.resolve();
  if(_exceljsPromise) return _exceljsPromise;
  _exceljsPromise = new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.id = 'exceljs-cdn';
    s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
    s.onload = ()=>resolve();
    s.onerror = ()=>{ _exceljsPromise = null; s.remove(); reject(new Error('load-fail')); }; // cho phép thử lại khi có mạng
    document.head.appendChild(s);
  });
  return _exceljsPromise;
}
// Bước 4 (tốc độ): trước đây tải ExcelJS (~900KB, CDN) ngay khi mở app, chặn băng thông lúc khởi động.
// Mọi hàm xuất Excel đều tự `await ensureExcelJs()` nên chỉ cần nạp sẵn lúc máy rảnh (sau khi app hiện xong);
// vẫn có thư viện sẵn trước khi người dùng bấm "Xuất Excel" trong hầu hết trường hợp.
(function prewarmExcelJs(){
  const go = ()=>{ ensureExcelJs().catch(()=>{}); };
  const later = ()=>{ if('requestIdleCallback' in window) requestIdleCallback(go, {timeout:8000}); else setTimeout(go, 4000); };
  if(document.readyState==='complete') setTimeout(later, 3000); else window.addEventListener('load', ()=>setTimeout(later, 3000), {once:true});
})();
// Lưu ý: việc chống trùng chỉ dựa trên dữ liệu đã đồng bộ về máy hiện tại.
// Nếu 2 thiết bị cùng tạo mã đồng thời khi đang mất mạng, có xác suất rất
// nhỏ bị trùng số thứ tự — hệ thống sẽ tự phát hiện & báo "QR bị trùng"
// trên Dashboard (mục 6) để người quản trị xử lý thủ công.
// ── Tải thư viện tạo mã QR (đảm bảo luôn có, kể cả khi script "defer"
// chưa kịp chạy xong lúc mở nhanh màn hình chi tiết QR) ─────────────
let _qrLibPromise = null;
function ensureQrLib(){
  if(window.QRCode) return Promise.resolve();
  if(_qrLibPromise) return _qrLibPromise;
  _qrLibPromise = new Promise((resolve)=>{
    // Nếu script gốc (defer) rồi cũng sẽ tự chạy xong — chờ tối đa ~4s
    let tries = 0;
    const check = setInterval(()=>{
      tries++;
      if(window.QRCode){ clearInterval(check); resolve(); return; }
      if(tries>=40){ // ~4s: script defer có vẻ không tải được → tự chèn lại
        clearInterval(check);
        if(document.getElementById('qrcodejs-cdn')){ resolve(); return; }
        const s=document.createElement('script');
        s.id='qrcodejs-cdn'; s.src='https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
        s.onload=()=>resolve();
        s.onerror=()=>resolve();
        document.head.appendChild(s);
      }
    }, 100);
  });
  return _qrLibPromise;
}
function loadSheetJs(){
  if(document.getElementById('sheetjs-cdn')) return;
  const s=document.createElement('script');
  s.id='sheetjs-cdn'; s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  s.onload=()=>showToast('✅ Đã tải xong, bấm "Xuất Excel" lại lần nữa');
  document.head.appendChild(s);
}
loadSheetJs();

// ════════════════════════════════════════════════════════════
// CHỤP ẢNH BẢNG CÔNG / LỊCH LÀM VIỆC ĐỂ GỬI NHÓM (Zalo/Messenger...)
// ════════════════════════════════════════════════════════════
let _html2canvasPromise = null;
function ensureHtml2Canvas(){
  if(window.html2canvas) return Promise.resolve();
  if(_html2canvasPromise) return _html2canvasPromise;
  _html2canvasPromise = new Promise((resolve)=>{
    const s=document.createElement('script');
    s.id='html2canvas-cdn';
    s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload=()=>resolve();
    s.onerror=()=>resolve();
    document.head.appendChild(s);
  });
  return _html2canvasPromise;
}
