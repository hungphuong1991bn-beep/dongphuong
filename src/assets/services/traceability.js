// src/services/traceability.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════════════
// MODULE QR — QUẢN LÝ THÀNH PHẨM BẰNG MÃ QR (Giai đoạn 1)
// Tạo QR khi hoàn thành, quét QR, lịch sử công đoạn (timeline), in tem.
// Dữ liệu: DB.qrProducts[] — đồng bộ realtime qua Firebase RTDB giống
// hệt cơ chế orders/workers hiện có (xem saveQrProducts / _FB_FIELD_MAP).
// ════════════════════════════════════════════════════════════════════

// Các công đoạn theo đúng yêu cầu truy xuất nguồn gốc (khác với STAGES
// 3 bước dùng cho bảng điều khiển sản xuất "Kế hoạch SX" ở trên — module
// QR cần chi tiết hơn cho mục đích truy xuất).
const QR_STAGES = [
  {key:'dun',      label:'Đùn',         icon:'🔧'},
  {key:'rut',      label:'Rút',         icon:'🔩'},
  {key:'danhbong', label:'Đánh bóng',   icon:'✨'},
  {key:'cat',      label:'Cắt',         icon:'✂️'},
  {key:'kiemtra',  label:'Kiểm tra QC', icon:'🔍'},
  {key:'dongoi',   label:'Đóng gói',    icon:'📦'},
  {key:'xuatkho',  label:'Xuất kho',    icon:'🚚'}
];
const QR_STAGE_LABEL = Object.fromEntries(QR_STAGES.map(s=>[s.key,s.label]));
const COPPER_GRADES = ['C1100','C1020','C1011','Khác'];

function qrStatusInfo(s){
  return {
    producing:{label:'⚙️ Đang sản xuất',cls:'qr-b-producing'},
    qc_pending:{label:'🔍 Chờ QC',cls:'qr-b-qc'},
    in_stock:{label:'📦 Đã nhập kho',cls:'qr-b-instock'},
    out_stock:{label:'🚚 Đã xuất kho',cls:'qr-b-outstock'},
    error:{label:'❌ Lỗi / Không đạt',cls:'qr-b-error'}
  }[s] || {label:s,cls:'qr-b-producing'};
}

// ── Sinh mã QR duy nhất: DP-YYYYMMDD-XXXXXX ─────────────────────────
function qrDateStr(d){
  d=d||new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

// ── URL công khai gắn vào mỗi mã QR: khi khách hàng quét bằng camera
// điện thoại thường (không cần cài app), trình duyệt sẽ mở thẳng trang
// tra cứu thông tin sản phẩm này, đọc dữ liệu trực tiếp từ Firebase ──
function qrPublicUrl(code){
  const base = location.origin + location.pathname;
  const db = fbUrl();
  return base + '?qr=' + encodeURIComponent(code) + (db ? '&db=' + encodeURIComponent(db) : '');
}

function genUniqueQrCode(){
  const ds = qrDateStr();
  const prefix = `DP-${ds}-`;
  let maxSeq = 0;
  DB.qrProducts.forEach(p=>{
    if(p.qrCode && p.qrCode.startsWith(prefix)){
      const n = parseInt(p.qrCode.slice(prefix.length),10);
      if(!isNaN(n) && n>maxSeq) maxSeq=n;
    }
  });
  // cộng thêm số QR đang chờ tạo trong lượt này (đề phòng tạo hàng loạt)
  maxSeq += (_qrBatchCounter||0);
  _qrBatchCounter = (_qrBatchCounter||0)+1;
  return prefix + String(maxSeq+1).padStart(6,'0');
}
let _qrBatchCounter = 0;
