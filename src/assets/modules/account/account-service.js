// src/modules/account/account-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

let _editUserId  = null;

// ════════════════════════════════════════════════════════════
// MERGE-BEFORE-WRITE cho /data/users
// ────────────────────────────────────────────────────────────
// LỖI GỐC: mọi thao tác tài khoản (thêm/sửa/xoá TK, đổi hồ sơ, đổi mật khẩu)
// trước đây đều gọi saveAll() — hàm này GHI ĐÈ TOÀN BỘ node /data bằng bản
// cục bộ, gồm CẢ orders/attendance/workers/kyLuat/nghiPhep/lichLamViec/
// baoTri/qrProducts. Nếu đúng lúc đó thiết bị khác vừa thêm đơn hoặc đổi
// trạng thái (mà thiết bị đang thao tác tài khoản chưa kịp nhận về qua
// realtime/polling), thao tác tài khoản sẽ xoá mất luôn thay đổi đó — đúng
// lỗi "mất dữ liệu mới khi thêm/thao tác trạng thái/tài khoản đã tạo".
//
// CÁCH SỬA: tách riêng saveUsers() chỉ ghi đúng nhánh /data/users (không đụng
// các nhánh khác), đồng thời áp dụng cùng cơ chế merge theo từng tài khoản
// như saveOrders(), để 2 admin cùng thêm/sửa tài khoản gần như đồng thời từ
// 2 thiết bị cũng không ghi đè mất tài khoản của nhau.
function snapshotUsers(list){
  const m = {};
  (list||[]).forEach(u=>{ if(u && u.id) m[u.id] = JSON.stringify(u); });
  return m;
}
let _lastSyncedUsersSnapshot = {};

function saveUsers(){if(guardViewer())return;
  lsSave();
  if(!fbOk()) return;
  setSyncDot('saving');
  markDirty('users');
  beginSave();
  mergeAndSaveUsers();
}

async function mergeAndSaveUsers(){
  const localSnap = snapshotUsers(DB.users);
  const changedIds = new Set();
  Object.keys(localSnap).forEach(id=>{ if(localSnap[id]!==_lastSyncedUsersSnapshot[id]) changedIds.add(id); });
  const removedIds = new Set();
  Object.keys(_lastSyncedUsersSnapshot).forEach(id=>{ if(!localSnap[id]) removedIds.add(id); });

  let merged;
  try{
    const serverRaw = await fbRead('/data/users');
    const serverList = serverRaw ? (Array.isArray(serverRaw)?serverRaw:Object.values(serverRaw)) : [];
    const mergedMap = {};
    serverList.forEach(u=>{ if(u && u.id) mergedMap[u.id]=u; }); // nền = bản mới nhất trên server
    DB.users.forEach(u=>{
      if(!u || !u.id) return;
      // chỉ ghi đè bằng bản cục bộ nếu: (a) tài khoản này CHÍNH thiết bị này
      // vừa sửa, hoặc (b) tài khoản hoàn toàn mới chưa từng có trên server
      if(changedIds.has(u.id) || !mergedMap[u.id]) mergedMap[u.id]=u;
    });
    removedIds.forEach(id=>{ delete mergedMap[id]; }); // tài khoản mình vừa xoá
    merged = Object.values(mergedMap);
  }catch(e){
    // Không đọc được server (mất mạng...) → vẫn ghi bản cục bộ như cũ, để
    // fbSaveField tự retry/đánh dấu dirty, không chặn thao tác người dùng
    merged = DB.users;
  }

  DB.users = merged;
  lsSave();
  scheduleUIRefresh(false);
  return fbSaveField('users', '/data/users', false, ()=>{ _lastSyncedUsersSnapshot = snapshotUsers(DB.users); });
}
