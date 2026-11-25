// src/utils/format.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

// Định dạng khoảng thời gian đã trôi qua kiểu "đang online được bao lâu"
// (khác onlineTimeAgo ở chỗ không có chữ "trước", dùng cho phiên đang mở)
function fmtOnlineDuration(startTs){
  const s = Math.max(0, Math.floor((nowSrv()-startTs)/1000));
  if(s<60) return 'vài giây';
  const m = Math.floor(s/60);
  if(m<60) return `${m} phút`;
  const h = Math.floor(m/60), rm = m%60;
  return rm ? `${h} giờ ${rm} phút` : `${h} giờ`;
}
function userInitials(name){
  const parts=(name||'?').trim().split(/\s+/);
  return parts.length>1 ? (parts[0][0]+parts[parts.length-1][0]).toUpperCase() : (parts[0][0]||'?').toUpperCase();
}
function onlineTimeAgo(ts){
  const d=Math.max(0,nowSrv()-ts);
  if(d<20000) return 'vừa xong';
  if(d<60000) return Math.floor(d/1000)+'s trước';
  if(d<3600000) return Math.floor(d/60000)+' phút trước';
  return Math.floor(d/3600000)+' giờ trước';
}
function fmtSyncAgo(ts){
  if(!ts) return '--';
  const s = Math.max(0, Math.floor((Date.now()-ts)/1000));
  if(s<3) return 'Vừa xong';
  if(s<60) return s+' giây trước';
  const m = Math.floor(s/60);
  if(m<60) return m+' phút trước';
  const h = Math.floor(m/60);
  return h+' giờ trước';
}


// Dashboard mini card (dùng ở cột Đang chạy và Hoàn thành)


// ════ AI ENGINE ════════════════════════════════════════════════
// Phân tích từng đơn: cảnh báo thời gian chạy, deadline, tiến độ
function fmtHrs(hrs){
  if(hrs < 1) return Math.round(hrs*60)+'p';
  const h=Math.floor(hrs), m=Math.round((hrs%1)*60);
  if(hrs >= 24){ const d=Math.floor(hrs/24), rem=Math.round(hrs%24); return rem>0?`${d} ngày ${rem}g`:`${d} ngày`; }
  return m>0?`${h}g${m}p`:`${h}g`;
}

// ════════════════════════════════════════════════════════════
// TỔNG QUAN (OVERVIEW) — các hàm dựng giao diện mới, dùng dữ liệu thật
// ════════════════════════════════════════════════════════════
function ovFmtKg(n){ return Math.round(n||0).toLocaleString('vi-VN'); }
function fmtDuration(ms){
  if(!ms||ms<0) return '';
  const totalMin=Math.floor(ms/60000);
  if(totalMin<60) return totalMin+'p';
  const h=Math.floor(totalMin/60), m=totalMin%60;
  return h+'g'+(m>0?m+'p':'');
}

function fmtDateTime(ts){
  if(!ts) return '—';
  const d=new Date(ts);
  const date=vnDateDMY(d);
  const time=vnTimeHM(d);
  return `${time} · ${date}`;
}

// Giống fmtDateTime() nhưng BỎ NĂM (chỉ ngày/tháng) — dùng cho panel sidebar
// "ĐƠN HOÀN THÀNH" ở Bảng Điều hành SX: cột "Hoàn thành lúc" vốn khá hẹp,
// hiển thị đủ cả năm (VD "13:46 · 18/08/2026") dễ bị dồn/tràn; vì hoàn
// thành hôm nay chắc chắn cùng năm hiện tại nên bỏ năm không mất thông tin.
function fmtTimeDateShort(ts){
  if(!ts) return '—';
  const d=new Date(ts);
  return `${vnTimeHM(d)} · ${vnDateDM(d)}`;
}
function fmtNum(n){ n=Number(n)||0; return n.toLocaleString('vi-VN',{maximumFractionDigits:2}); }
