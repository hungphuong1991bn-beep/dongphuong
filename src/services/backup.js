// src/services/backup.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// BACKUP TỰ ĐỘNG ĐỊNH KỲ — ĐÃ TẮT THEO YÊU CẦU NGƯỜI DÙNG
// ────────────────────────────────────────────────────────────
// Trước đây: sao lưu toàn bộ /data sang /backups/{yyyy-mm-dd} định kỳ, và có
// nút "Sao lưu dữ liệu ngay" trong Cài đặt. Người dùng lo ngại việc backup
// này có thể là nguyên nhân gây xung đột dữ liệu (đơn vừa xoá lại quay về)
// nên đã yêu cầu tắt hẳn. Lưu ý: các hàm bên dưới chỉ ĐỌC /data rồi ghi sang
// nhánh riêng /backups (không hề ghi ngược lại /data/orders), nên thực chất
// không phải là nguồn gây ra lỗi "xoá đơn xong lại thấy còn" — xem sửa lỗi
// đúng nguyên nhân ở findDuplicateOrders()/deleteOrder() bên dưới. Tuy vậy
// vẫn tắt hẳn theo đúng yêu cầu để người dùng yên tâm không còn bất kỳ thao
// tác ghi nền nào chạy ngoài ý muốn. Giữ lại các hàm (không xoá code) để dễ
// bật lại sau này nếu cần, nhưng không còn nơi nào gọi tới chúng nữa.
// ════════════════════════════════════════════════════════════
const BACKUP_INTERVAL_MS = 24*60*60*1000; // tối thiểu cách nhau 1 ngày/lần
const BACKUP_KEEP_DAYS = 30;              // chỉ giữ tối đa 30 bản gần nhất
let _lastBackupAtCache = null;            // hiển thị "gần nhất: ..." ở Cài đặt

function backupDateKey(d){
  const pad = n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// Cố "giành quyền" chạy backup bằng ghi có điều kiện lên /backupMeta —
// nếu chưa tới hạn hoặc vừa có thiết bị khác giành trước (412) thì bỏ qua,
// tránh backup trùng lặp nhiều lần không cần thiết trong cùng 1 lúc.
async function claimBackupLock(force){
  try{
    const cur = await fbReadETag('/backupMeta');
    const meta = cur.data || {};
    _lastBackupAtCache = meta.lastBackupAt || null;
    if(!force && Date.now() - (Number(meta.lastBackupAt)||0) < BACKUP_INTERVAL_MS) return false;
    const res = await fbWriteETag('/backupMeta',
      {lastBackupAt: Date.now(), lastBackupBy: (currentUser&&currentUser.name)||_devId},
      cur.etag, 'PUT');
    return !!res.ok;
  }catch(e){ return false; }
}

// Xoá bớt backup cũ quá BACKUP_KEEP_DAYS ngày để không phình dung lượng
// Firebase vô hạn theo thời gian. ?shallow=true chỉ tải DANH SÁCH TÊN KHOÁ
// (ngày backup), không tải nội dung — rất nhẹ, không tốn băng thông đáng kể.
async function pruneOldBackups(){
  try{
    const r = await fetch(await fbAppendAuth(fbUrl()+'/backups.json?shallow=true'), {cache:'no-store'});
    if(!r.ok) return;
    const keys = await r.json();
    if(!keys) return;
    const names = Object.keys(keys).sort(); // "yyyy-mm-dd" sắp đúng thứ tự theo chuỗi
    const excess = names.length - BACKUP_KEEP_DAYS;
    if(excess<=0) return;
    await Promise.all(names.slice(0, excess).map(k=>fbWrite('/backups/'+k, null, 'DELETE').catch(()=>{})));
  }catch(e){ /* im lặng — không ảnh hưởng hoạt động chính của app */ }
}

async function runBackupNow(){
  const data = await fbRead('/data');
  if(!data) return false;
  await fbWrite('/backups/'+backupDateKey(new Date()), {ts:Date.now(), data}, 'PUT');
  _lastBackupAtCache = Date.now();
  await pruneOldBackups();
  return true;
}

// Gọi định kỳ (xem setInterval bên dưới + sau khi khởi động sync) — tự bỏ
// qua nếu chưa tới hạn hoặc thiết bị khác vừa backup xong.
async function maybeRunAutoBackup(){
  if(!fbOk() || !currentUser) return;
  try{
    if(!(await claimBackupLock(false))) return;
    await runBackupNow();
    console.log('[autoBackup] Đã sao lưu dữ liệu lúc', new Date().toLocaleString());
  }catch(e){ console.warn('[autoBackup] lỗi khi sao lưu:', e); }
}

// Nút "Sao lưu dữ liệu ngay" trong Cài đặt (chỉ Admin) — backup ngay lập
// tức, bỏ qua giới hạn BACKUP_INTERVAL_MS (force=true) nhưng vẫn dùng khoá
// ETag để tránh đụng độ nếu vô tình bấm ở 2 thiết bị cùng lúc.
// Đã tắt: không còn setInterval gọi maybeRunAutoBackup() định kỳ mỗi giờ nữa
// (xem ghi chú "BACKUP TỰ ĐỘNG ĐỊNH KỲ — ĐÃ TẮT THEO YÊU CẦU NGƯỜI DÙNG" ở trên).

// ── PRESENCE HEARTBEAT ──────────────────────────────────────
// Trước đây "Đang truy cập" chỉ được ghi lại khi người dùng chuyển tab hoặc
// khi có đơn hàng thay đổi. Nếu đứng yên ở Dashboard >30s (rất hay gặp trên
// máy tính, ít bấm hơn điện thoại), presence của chính thiết bị đó hết hạn
// và biến mất khỏi danh sách của MỌI thiết bị khác — đây chính là lỗi
// "không hiện Người truy cập". Heartbeat này ghi lại đều đặn để presence
// không bao giờ hết hạn khi app còn đang mở và hiển thị.
setInterval(()=>{
  if(currentUser && fbOk() && !document.hidden) updateOnline();
}, 20000);
