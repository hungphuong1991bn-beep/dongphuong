// src/services/presence.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// ONLINE PRESENCE (Firebase Heartbeat)
// ════════════════════════════════════════════════════════════
// Mã định danh thiết bị — lưu cố định trong localStorage của trình duyệt để
// mỗi lần mở lại app (kể cả sau khi tự reload) vẫn dùng đúng 1 mã, tránh bị
// đếm thành "nhiều thiết bị" trong danh sách Đang truy cập.
// Có thêm phần ngẫu nhiên (không chỉ dựa vào mốc thời gian) để tránh trường
// hợp 2 tab/cửa sổ của CÙNG một trình duyệt cùng khởi động gần như đồng thời
// (VD trình duyệt tự khôi phục nhiều tab cùng lúc sau khi mở lại máy) và vô
// tình sinh ra 2 mã na ná nhau trước khi kịp ghi lại localStorage cho nhau
// thấy — đây là một trong các nguyên nhân khiến 1 máy/1 người lại hiện thành
// nhiều dòng trùng tên trong "Đang truy cập".
const _devId = (()=>{
  let id=localStorage.getItem('sx_dev');
  if(!id){ id='d'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); localStorage.setItem('sx_dev',id); }
  return id;
})();

// Thời điểm bắt đầu phiên làm việc trên thiết bị này — dùng sessionStorage
// (sống sót qua các lần tự reload định kỳ của app, chỉ mất khi đóng hẳn tab)
// để tính "Đang truy cập được bao lâu" hiển thị trong bảng chi tiết.
const _sessionStart = (()=>{
  try{
    let t = Number(sessionStorage.getItem('sx_session_start')||0);
    if(!t){ t = Date.now(); sessionStorage.setItem('sx_session_start', String(t)); }
    return t;
  }catch(e){ return Date.now(); } // sessionStorage bị chặn (riêng tư/webview) → vẫn chạy tiếp, chỉ mất phần nhớ qua reload
})();

// Nhận diện loại thiết bị (di động / máy tính) để hiển thị trong danh sách
// "Đang truy cập" — giúp admin biết ai đang thao tác trên xưởng (điện thoại)
// hay ở văn phòng (máy tính).
function deviceInfo(type){
  const t = type || (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'') ? 'mobile' : 'desktop');
  return t==='mobile' ? {type:'mobile', icon:'📱', label:'Điện thoại'} : {type:'desktop', icon:'💻', label:'Máy tính'};
}

const TAB_LABEL = {
  dashboard:'Tổng quan', dorDang:'Đơn Hàng', keHoach:'Kế hoạch SX',
  hoanThanh:'Đơn hoàn thành', baoCao:'Báo cáo', nhatKy:'Nhật ký thao tác',
  nhanSu:'Quản lý nhân sự', chamCong:'Chấm công', baoTriMay:'Bảo trì máy', lichLamViec:'Lịch làm việc', settings:'Cài đặt'
};
// Đếm nhanh số lượng theo từng vai trò để hiện dòng tóm tắt gọn
// (VD: "👑1 · ⚙️2 · 👁1") phía trên danh sách chi tiết.
function roleBreakdownTxt(list){
  const c={admin:0,staff:0,viewer:0};
  list.forEach(u=>{ if(c[u.role]!=null) c[u.role]++; });
  return [c.admin&&`👑${c.admin}`, c.staff&&`⚙️${c.staff}`, c.viewer&&`👁${c.viewer}`].filter(Boolean).join(' · ');
}

// Giờ "chuẩn" dùng cho presence — lấy từ header Date của lần gọi Firebase gần nhất
// để không bị lệch bởi đồng hồ hệ thống của từng máy (nguyên nhân phổ biến khiến
// 1 thiết bị tự thấy "hết hạn" dù dữ liệu vẫn mới).
let _clockOffset = 0;
function nowSrv(){ return Date.now() + _clockOffset; }

// ── v2.13.1: SỬA LỖI "1 máy chỉ thấy mỗi tài khoản của chính mình" ──────────
// Nguyên nhân: ts của mỗi thiết bị trước đây là GIỜ ĐỒNG HỒ CỦA MÁY ĐÓ (đã bù bằng
// header Date, độ phân giải 1s, có thể bị proxy/cache làm lệch). Máy nào tự tính giờ
// lệch > 30s so với các máy khác sẽ thấy ts của mọi người khác là "quá cũ" → lọc hết,
// chỉ còn dòng của chính mình (vừa ghi xong nên luôn "mới"). Cách sửa:
//  (1) ghi ts bằng GIỜ MÁY CHỦ Firebase ({".sv":"timestamp"}) → mọi máy dùng cùng 1 đồng hồ;
//  (2) tính độ lệch giờ từ chính ts máy chủ trả về trong phản hồi PUT (chính xác ms),
//      lấy điểm giữa lượt gửi-nhận để bù độ trễ mạng;
//  (3) nới thời hạn 30s → 75s (heartbeat 20s/lần, timer nền có thể bị trình duyệt
//      giãn cách → 30s quá sát, chỉ cần 1 lượt chậm là người đó "biến mất");
//  (4) dòng của chính thiết bị này luôn được giữ lại và không bao giờ mất người khác
//      chỉ vì 1 bản ghi hỏng (ts không phải số).
const PRESENCE_TTL_MS = 75000;
function presenceOnlineList(p){
  if(!p || typeof p!=='object') return [];
  const now = nowSrv();
  return Object.entries(p)
    .filter(([id,u])=>{
      if(!u || typeof u!=='object') return false;
      const ts = Number(u.ts);
      if(!isFinite(ts)) return false;
      return Math.abs(now-ts) < PRESENCE_TTL_MS; // abs: máy khác "ở tương lai" (lệch giờ) vẫn hiện
    })
    .map(([id,u])=>({...u,ts:Number(u.ts),_id:id}))
    .sort((a,b)=>b.ts-a.ts);
}

function showFbNotConfigured(){
  const ss0 = document.getElementById('sbScanStats');
  if(ss0){ ss0.style.display='none'; ss0.innerHTML=''; }
  const sb0 = document.getElementById('sbOnline');
  if(sb0) sb0.innerHTML = `<div class="sb-online-offline">⚠️ Chưa bật Firebase Sync (Cài đặt) — không thể xem ai đang truy cập</div>`;
  const el0 = document.getElementById('onlineEl');
  if(el0) el0.innerHTML = `<div class="sb-online-offline" style="margin-bottom:10px;cursor:pointer" onclick="goTab('settings')">⚠️ Thiết bị này chưa cấu hình Firebase Sync — bấm để vào Cài đặt bật lên, nếu không sẽ không thấy được ai đang truy cập</div>`;
}

// Đọc lại /presence và vẽ lại danh sách — KHÔNG ghi heartbeat của chính mình.
// Dùng cho các lần làm mới "nhẹ" khi có tín hiệu từ thiết bị khác (SSE) để
// không tạo thêm ghi Firebase không cần thiết mỗi khi người khác online/offline.
async function refreshOnlineListOnly(){
  if(!currentUser || !fbOk()) return;
  try{
    const p = await fbRead('/presence');
    renderPresenceLists(presenceOnlineList(p));
  }catch(e){ console.warn('[refreshOnlineListOnly] lỗi:', e); }
}

// Bước 4 (tốc độ): gộp các lần gọi trùng. Lần ghi heartbeat gần nhất được nhớ lại để
// (1) bỏ qua tiếng vọng SSE của chính lần ghi đó, (2) cho phép các luồng vẽ lại dữ liệu
// dồn dập gọi bản "có giãn cách" thay vì ghi + đọc /presence lại mỗi lần.
let _lastHeartbeatAt = 0;
function updateOnlineThrottled(minGapMs){
  if(Date.now() - _lastHeartbeatAt < (minGapMs||5000)) return;
  return updateOnline();
}

async function updateOnline(){
  if(!currentUser) return;
  if(!fbOk()){
    // Chưa cấu hình Firebase (Cài đặt ▸ Cấu hình Firebase Sync) → không có
    // nguồn dữ liệu để biết ai đang truy cập. Hiện gợi ý rõ ràng thay vì để
    // trống im lặng, để không bị hiểu nhầm là lỗi.
    showFbNotConfigured();
    return;
  }
  try{
    const dev = deviceInfo();
    const t0 = Date.now();
    const wRes = await fetch(await fbAppendAuth(fbUrl()+'/presence/'+_devId+'.json'), {
      method:'PUT', headers:{'Content-Type':'application/json'},
      // ts = giờ MÁY CHỦ Firebase (không phụ thuộc đồng hồ máy này)
      body: JSON.stringify({name:currentUser.name,role:currentUser.role,uid:currentUser.username,tab:currentTab,ts:{'.sv':'timestamp'},since:_sessionStart+_clockOffset,device:dev.type})
    });
    if(!wRes.ok) throw new Error('HTTP '+wRes.status+' khi ghi presence');
    const t1 = Date.now();
    _lastHeartbeatAt = t1;
    // Phản hồi PUT trả về đúng dữ liệu đã ghi, trong đó ts đã được máy chủ thay bằng số ms thật
    try{
      const w = await wRes.json();
      const srvTs = w && Number(w.ts);
      if(srvTs && isFinite(srvTs)) _clockOffset = srvTs - Math.round((t0+t1)/2);
      else throw new Error('no ts');
    }catch(_e){
      const srvDate = wRes.headers.get('date'); // phương án dự phòng: header Date (độ phân giải 1s)
      if(srvDate){ const t=Date.parse(srvDate); if(!isNaN(t)) _clockOffset = t - Date.now(); }
    }
    const p = await fbRead('/presence');
    let online = presenceOnlineList(p);
    // Luôn có dòng của chính mình, kể cả khi lượt đọc trả về dữ liệu cũ/thiếu
    if(!online.some(u=>u._id===_devId)){
      online.unshift({name:currentUser.name,role:currentUser.role,uid:currentUser.username,tab:currentTab,ts:nowSrv(),since:_sessionStart,device:dev.type,_id:_devId});
    }
    renderPresenceLists(online);
  }catch(e){ console.warn('[updateOnline] lỗi khi tải danh sách đang truy cập:', e); }
}
window.addEventListener('beforeunload',()=>{
  if(fbOk()) navigator.sendBeacon(fbAppendAuthSync(fbUrl()+'/presence/'+_devId+'.json'), JSON.stringify(null));
});
