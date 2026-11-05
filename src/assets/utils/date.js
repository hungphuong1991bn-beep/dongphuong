// src/utils/date.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

// ── Định dạng ngày tháng tiếng Việt thủ công (không phụ thuộc Intl/vi-VN
//    vì nhiều trình duyệt/thiết bị (đặc biệt WebView Android cũ, một số
//    trình duyệt iOS) không có dữ liệu locale 'vi-VN' đầy đủ, dẫn tới hiển
//    thị sai ngôn ngữ hoặc lỗi). Các hàm dưới luôn ra tiếng Việt chuẩn.
const VN_WEEKDAYS=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const VN_WEEKDAYS_SHORT=['CN','T2','T3','T4','T5','T6','T7'];
const VN_MONTHS=['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
function pad2(n){ return String(n).padStart(2,'0'); }
function vnDateDMY(d){ d=(d instanceof Date)?d:new Date(d); if(isNaN(d)) return '—'; return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }
function vnDateDM(d){ d=(d instanceof Date)?d:new Date(d); if(isNaN(d)) return '—'; return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`; }
function vnTimeHM(d){ d=(d instanceof Date)?d:new Date(d); if(isNaN(d)) return '—'; return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
// Đồng hồ topbar "chuyên nghiệp": giờ:phút:giây dạng số đếm (monospace) +
// dấu hai chấm nhấp nháy mỗi giây + thứ/ngày rút gọn, có chấm xanh báo hiệu
// đang chạy realtime. Cập nhật DOM tối giản (không innerHTML lại toàn bộ)
// để tránh giật khi chạy mỗi giây trên thiết bị yếu.
function updateTopbarClock(){
  const now = new Date();
  const tEl = document.getElementById('clockTime');
  const dEl = document.getElementById('clockDate');
  const tElM = document.getElementById('clockTimeMobile');
  const dElM = document.getElementById('clockDateMobile');
  if(tEl){
    tEl.innerHTML = `${pad2(now.getHours())}<span class="tc-colon">:</span>${pad2(now.getMinutes())}<span class="tc-colon">:</span>${pad2(now.getSeconds())}`;
  }
  if(dEl){
    dEl.textContent = vnDateDMY(now);
  }
  if(tElM) tElM.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  if(dElM) dElM.textContent = vnDateDMY(now);
  if(typeof dhTickClock==='function') dhTickClock();
}
function vnDateTimeShort(d){ d=(d instanceof Date)?d:new Date(d); if(isNaN(d)) return '—'; return `${vnDateDM(d)} ${vnTimeHM(d)}`; }

function fmtDate(s){ if(!s) return'—'; try{return vnDateDMY(new Date(s));}catch{return s;} } // 'YYYY-MM' tháng đang xem

function todayStr(d){
  d = d || new Date();
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function curYM(){ return (_attYM = _attYM || todayStr().slice(0,7)); }
function daysInMonth(ym){ const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); }
function weekdayVN(y,m,day){ const w=new Date(y,m-1,day).getDay(); return ['CN','T2','T3','T4','T5','T6','T7'][w]; }
