// src/utils/helpers.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════════════════════
function $(id){ return document.getElementById(id); }
function uid(){ return 'o'+Date.now()+Math.random().toString(36).slice(2,6); }

// Dở dang
// Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu (VD: "gap 1" vẫn khớp "GẤP 1")
function _stripDiacritics(s){
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d');
}

// ════════════════════════════════════════════════════════════
// TÌM KIẾM & BỘ LỌC HỢP NHẤT (Search Bubble) — 1 component dùng
// chung cho 3 tab Đơn hàng / Kế hoạch SX / Đơn hoàn thành: thanh
// tìm kiếm gọn luôn hiển thị (sticky cùng dải KPI) + nút Bộ lọc
// mở Bottom Sheet (Mobile) / Floating Panel (Desktop) chứa đầy đủ
// Trạng thái, Khách hàng, Người phụ trách, Ngày nhận, Hạn giao...
// Toàn bộ vẫn dùng lại NGUYÊN các biến/hàm lọc đã có sẵn của từng
// tab (searchQ, khSearchQ, htSearchQ...) — chỉ đổi GIAO DIỆN hiển
// thị, không đổi logic lọc, để không ảnh hưởng dữ liệu/kết quả.
// ════════════════════════════════════════════════════════════
function debounce(fn, ms){
  let t;
  return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), ms); };
}

function csvDownload(filename, rows){
  const esc = v => {
    v = (v===undefined||v===null) ? '' : String(v);
    if(/[",\n;]/.test(v)) v = '"'+v.replace(/"/g,'""')+'"';
    return v;
  };
  const content = '\uFEFF' + rows.map(r=>r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([content], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════
// QUẢN LÝ KHUÔN (Tổng hợp Khuôn / Số lượng Khuôn) — Khu vực Thiết bị
// Chỉ ADMIN được thêm/sửa/xóa (guardNotAdmin ở mọi hàm ghi dữ liệu).
// Staff/Viewer chỉ xem, tìm kiếm, lọc.
// ════════════════════════════════════════════════════════════
// ── HELPER DÙNG CHUNG (Admin + Trang công khai QR) ─────────────────────
// parseKhuonSize() / sortKhuonList() / normalizeKhuonSearch() / khuonMatchesSearch()
// đảm bảo Sort & Search luôn thống nhất giữa tab Admin và trang QR công khai.
function _khStripAccents(str){
  return String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
}

function b64ToArrayBuffer(b64){
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function esc(s){ return s==null?'':String(s).replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
