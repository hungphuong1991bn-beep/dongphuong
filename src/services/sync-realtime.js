// src/services/sync-realtime.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Gộp các lần "vẽ lại giao diện" xảy ra dồn dập (VD nhiều field đổi liên
// tiếp qua SSE trong vài trăm ms) thành 1 lần duy nhất bằng requestAnimationFrame.
// Giúp đồng bộ mượt hơn (đỡ giật khi gõ/cuộn) và giảm tải CPU/pin — quan trọng
// để không ảnh hưởng các app khác đang chạy song song trên máy (Zalo nhắn tin/gọi…).
// Khi app đang ở nền (document.hidden) thì bỏ qua hẳn việc vẽ lại, chỉ lưu dữ
// liệu, vì lúc đó không ai nhìn thấy UI và vẽ lại chỉ tốn tài nguyên vô ích.
let _uiRefreshScheduled = false;
let _lastSyncToastAt = 0;
function scheduleUIRefresh(showSyncToast){
  if(document.hidden) return; // ở nền: khỏi vẽ, đỡ tốn máy cho ứng dụng khác
  if(showSyncToast){
    const now = Date.now();
    if(now - _lastSyncToastAt > 4000){ // gộp toast, tối đa 1 lần/4s cho đỡ chớp màn hình
      _lastSyncToastAt = now;
      showToast('🔄 Đã cập nhật dữ liệu');
    }
  }
  if(_uiRefreshScheduled) return;
  _uiRefreshScheduled = true;
  // AUTO DISPATCH (mục 13): mọi lần dữ liệu đơn hàng được đồng bộ lại từ
  // Firebase (SSE path /data/orders, /data/orders/{id}, hoặc bản đọc lại
  // toàn bộ /data) đều đi qua đúng 1 điểm này trước khi vẽ lại UI — quét lại
  // xem có máy nào vừa trống ra (do thao tác từ 1 thiết bị khác) để tự đẩy
  // đơn đầu hàng đợi lên RUNNING, không cần F5. Tự no-op nếu không có gì để
  // đẩy nên gọi vô điều kiện ở đây là an toàn, không tốn thêm round-trip.
  const run = ()=>{ _uiRefreshScheduled=false; dhAutoDispatchSweepAll(); renderTab(currentTab); updateBadges(); updateOnlineThrottled(5000); };
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(run); else setTimeout(run,16);
}

// Áp dữ liệu Firebase (/data) vào state hiện tại — dùng chung cho lần đọc đầu,
// polling dự phòng và khi SSE báo thay đổi ở gốc /data
function applyDataSnapshot(data){
  if(!data) return false;
  // Đang có lượt ghi lên Firebase chưa xong (VD vừa thêm đơn hàng) → bản đọc
  // về lúc này có thể là bản CŨ, chưa thấy thay đổi mình vừa gửi. Bỏ qua,
  // đợi ghi xong sẽ tự đồng bộ lại (xem endSave()) để không bị mất dữ liệu.
  if(_pendingSaves>0) return false;
  let changed = false;
  const freshOrders = data.orders
    ? (Array.isArray(data.orders)?data.orders:Object.values(data.orders))
    : null;
  if(freshOrders){
    const h = hashOrders(freshOrders);
    if(h !== _lastHash){
      _lastHash = h;
      freshOrders.forEach(o=>{ if(!_knownIds.has(o.id)){ _knownIds.add(o.id); notifyNewOrder(o); } });
      DB.orders = freshOrders;
      dedupeOrdersByIdKeepNewest(); // lưới an toàn: loại bỏ ngay nếu bản đọc về lỡ có trùng id
      _lastSyncedOrdersSnapshot = snapshotOrders(DB.orders);
      changed = true;
    }
    healOrdersLegacyKeys(data.orders); // dọn key rác kiểu cũ trên Firebase nếu có (nguyên nhân gốc gây trùng đơn)
  }
  if(data.users){
    const freshUsers = Array.isArray(data.users)?data.users:Object.values(data.users);
    if(JSON.stringify(freshUsers) !== JSON.stringify(DB.users)){ DB.users = freshUsers; _lastSyncedUsersSnapshot = snapshotUsers(DB.users); changed = true; }
  }
  if(data.ordersTrash){
    const freshTrash = Array.isArray(data.ordersTrash)?data.ordersTrash:Object.values(data.ordersTrash);
    if(JSON.stringify(freshTrash)!==JSON.stringify(DB.ordersTrash)){ DB.ordersTrash = freshTrash; _lastSyncedTrashSnapshot = snapshotOrders(DB.ordersTrash); changed = true; }
  }
  if(data.attendance && JSON.stringify(data.attendance)!==JSON.stringify(DB.attendance)){ DB.attendance = data.attendance; _lastSyncedAttendanceSnapshot = flattenAttendance(DB.attendance); changed = true; }
  // GHI CHÚ: mọi nhánh mảng-theo-id dưới đây (workers/kyLuat/nghiPhep/
  // lichLamViec/baoTri/khuonCatalog/khuonQty/csTemplates) cũng làm mới
  // _lastSyncedArrSnap[field] ngay khi nhận bản mới từ server — cùng lý do
  // đã sửa ở nguyenLieuLog/mayRutLog/mayDanhBongLog bên dưới và ở
  // applyFieldChange(): nếu không, "ảnh chụp lần đồng bộ gần nhất" bị cũ dần
  // trên các thiết bị ít tự lưu, khiến lần XOÁ kế tiếp trên thiết bị đó tính
  // sai dòng cần xoá trên Firebase (dòng đã xoá cục bộ nhưng không hề bị xoá
  // trên server/thiết bị khác).
  if(data.workers && JSON.stringify(data.workers)!==JSON.stringify(DB.workers)){ DB.workers = data.workers; _lastSyncedArrSnap.workers=snapshotArrById(DB.workers); changed = true; }
  if(data.kyLuat && JSON.stringify(data.kyLuat)!==JSON.stringify(DB.kyLuat)){ DB.kyLuat = data.kyLuat; _lastSyncedArrSnap.kyLuat=snapshotArrById(DB.kyLuat); changed = true; }
  if(data.nghiPhep && JSON.stringify(data.nghiPhep)!==JSON.stringify(DB.nghiPhep)){ DB.nghiPhep = data.nghiPhep; _lastSyncedArrSnap.nghiPhep=snapshotArrById(DB.nghiPhep); changed = true; }
  if(data.lichLamViec && JSON.stringify(data.lichLamViec)!==JSON.stringify(DB.lichLamViec)){ DB.lichLamViec = data.lichLamViec; _lastSyncedArrSnap.lichLamViec=snapshotArrById(DB.lichLamViec); changed = true; }
  if(data.baoTri && JSON.stringify(data.baoTri)!==JSON.stringify(DB.baoTri)){ DB.baoTri = data.baoTri; _lastSyncedArrSnap.baoTri=snapshotArrById(DB.baoTri); changed = true; }
  if(data.khuonCatalog && JSON.stringify(data.khuonCatalog)!==JSON.stringify(DB.khuonCatalog)){ DB.khuonCatalog = data.khuonCatalog; _lastSyncedArrSnap.khuonCatalog=snapshotArrById(DB.khuonCatalog); changed = true; }
  if(data.khuonQty && JSON.stringify(data.khuonQty)!==JSON.stringify(DB.khuonQty)){ DB.khuonQty = data.khuonQty; _lastSyncedArrSnap.khuonQty=snapshotArrById(DB.khuonQty); changed = true; }
  if(data.csTemplates && JSON.stringify(data.csTemplates)!==JSON.stringify(DB.csTemplates)){ DB.csTemplates = data.csTemplates; _lastSyncedArrSnap.csTemplates=snapshotArrById(DB.csTemplates); changed = true; }
  if(data.csData && JSON.stringify(data.csData)!==JSON.stringify(DB.csData)){ DB.csData = data.csData; _lastSyncedCsDataSnapshot = flattenCsData(DB.csData); changed = true; }
  if(data.nguyenLieuLog){ const fresh=Array.isArray(data.nguyenLieuLog)?data.nguyenLieuLog:Object.values(data.nguyenLieuLog); if(JSON.stringify(fresh)!==JSON.stringify(DB.nguyenLieuLog)){ DB.nguyenLieuLog=fresh; _lastSyncedArrSnap.nguyenLieuLog=snapshotArrById(DB.nguyenLieuLog); changed=true; } }
  if(data.mayRutLog){ const fresh=Array.isArray(data.mayRutLog)?data.mayRutLog:Object.values(data.mayRutLog); if(JSON.stringify(fresh)!==JSON.stringify(DB.mayRutLog)){ DB.mayRutLog=fresh; _lastSyncedArrSnap.mayRutLog=snapshotArrById(DB.mayRutLog); changed=true; } }
  if(data.mayDanhBongLog){ const fresh=Array.isArray(data.mayDanhBongLog)?data.mayDanhBongLog:Object.values(data.mayDanhBongLog); if(JSON.stringify(fresh)!==JSON.stringify(DB.mayDanhBongLog)){ DB.mayDanhBongLog=fresh; _lastSyncedArrSnap.mayDanhBongLog=snapshotArrById(DB.mayDanhBongLog); changed=true; } }
  if(typeof cpOnSnapshot==='function' && data.cpRecords && cpOnSnapshot(data.cpRecords)) changed = true;   // ControlPlan
  if(data.qrProducts){
    const freshQr = Array.isArray(data.qrProducts)?data.qrProducts:Object.values(data.qrProducts);
    if(JSON.stringify(freshQr)!==JSON.stringify(DB.qrProducts)){ DB.qrProducts = freshQr; _lastSyncedArrSnap.qrProducts=snapshotArrById(DB.qrProducts); changed = true; }
  }
  // AUTO DISPATCH (mục 13) chạy chung tại scheduleUIRefresh() bên dưới —
  // đúng 1 điểm cho mọi đường đồng bộ (poll toàn bộ /data, SSE theo field,
  // SSE theo từng đơn) để không trùng lặp/không bỏ sót.
  if(changed){ lsSave(); scheduleUIRefresh(true); }
  return changed;
}

// Đọc toàn bộ 1 lần — dùng khi mở lại app, lỗi SSE, hoặc không chắc phần nào đổi
// [SỬA LỖI ĐỒNG BỘ CHÉO THIẾT BỊ — sau refactor v2.5.141] Số thứ tự "sự kiện realtime đã áp vào dữ liệu".
// Lỗi cũ: khi thiết bị A thêm đơn, Firebase đẩy gần như cùng lúc 2 sự kiện tới B:
// /notif (→ handleRealtimeChange gọi doPoll() đọc lại cả /data) rồi /data/orders/<id>.
// Sự kiện đơn được áp ngay, nhưng bản đọc /data (bắt đầu TRƯỚC khi đơn lên server)
// về sau và GHI ĐÈ lại bằng danh sách cũ → đơn vừa nhận "biến mất" trên B, và vì SSE
// đang sống nên không có polling nào đọc lại → B thiếu đơn cho đến khi có thay đổi khác.
// Cách sửa: nếu trong lúc đọc có sự kiện dữ liệu realtime được áp, bản đọc có thể đã cũ
// hơn → KHÔNG áp, đọc lại (tối đa 3 lần) để hội tụ về bản mới nhất.
let _rtSeq = 0;
async function doPoll(retry){
  if(!currentUser || !fbOk()) return;
  if(_pendingSaves>0) return; // đang ghi dở dang → chờ endSave() tự gọi lại
  try{
    const seq = _rtSeq;
    const data = await fbRead('/data');
    if(seq===_rtSeq) applyDataSnapshot(data);
    else if((retry||0)<3) setTimeout(()=>{ doPoll((retry||0)+1); }, 400);
    const freshLog = await fbRead('/log');
    if(Array.isArray(freshLog) && freshLog.length > actLog.length){ actLog = freshLog; logSave(); updateLogBadge(); }
    setSyncDot('ok');
    await checkBroadcast();
    await checkAnnounce();
  } catch(e){ setSyncDot('error'); }
}

// ════════════════════════════════════════════════════════════
// REALTIME qua Firebase SSE (Server-Sent Events)
// Thay vì hỏi lại toàn bộ /data mỗi 3 giây (tốn data + chậm), mở
// DUY NHẤT 1 kết nối SSE tới gốc DB. Firebase chỉ đẩy xuống đúng
// (path, data) của nhánh vừa thay đổi → cập nhật ngay lập tức,
// gần như không tốn thêm băng thông so với lúc idle.
// ════════════════════════════════════════════════════════════
let _sse = null;
let _sseConnected = false;

// Map các nhánh /data/* mà app tự ghi trực tiếp (saveOrders, saveWorkers…)
// → xử lý gọn, không cần đọc lại toàn bộ /data
const _FB_FIELD_MAP = {
  '/data/orders':'orders', '/data/ordersTrash':'ordersTrash', '/data/users':'users', '/data/attendance':'attendance',
  '/data/workers':'workers', '/data/kyLuat':'kyLuat', '/data/nghiPhep':'nghiPhep',
  '/data/lichLamViec':'lichLamViec', '/data/baoTri':'baoTri', '/data/qrProducts':'qrProducts',
  '/data/nguyenLieuLog':'nguyenLieuLog', '/data/mayRutLog':'mayRutLog', '/data/mayDanhBongLog':'mayDanhBongLog'
};

function applyFieldChange(field, val){
  if(_pendingSaves>0) return; // đang ghi dở dang → bỏ qua bản đọc có thể còn cũ
  if(field==='orders'){
    const fresh = val ? (Array.isArray(val)?val:Object.values(val)) : [];
    const h = hashOrders(fresh);
    if(h===_lastHash) return;
    _lastHash = h;
    fresh.forEach(o=>{ if(!_knownIds.has(o.id)){ _knownIds.add(o.id); notifyNewOrder(o); } });
    DB.orders = fresh;
    dedupeOrdersByIdKeepNewest(); // lưới an toàn: loại bỏ ngay nếu bản đọc về lỡ có trùng id
    healOrdersLegacyKeys(val); // dọn key rác kiểu cũ trên Firebase nếu có (nguyên nhân gốc gây trùng đơn)
    _lastSyncedOrdersSnapshot = snapshotOrders(DB.orders);
  } else if(field==='ordersTrash'){
    const fresh = val ? (Array.isArray(val)?val:Object.values(val)) : [];
    if(JSON.stringify(fresh)===JSON.stringify(DB.ordersTrash)) return;
    DB.ordersTrash = fresh;
    _lastSyncedTrashSnapshot = snapshotOrders(DB.ordersTrash);
  } else if(field==='users'){
    const fresh = val ? (Array.isArray(val)?val:Object.values(val)) : DB.users;
    if(JSON.stringify(fresh)===JSON.stringify(DB.users)) return;
    DB.users = fresh;
    _lastSyncedUsersSnapshot = snapshotUsers(DB.users);
  } else {
    // 3 sổ Số liệu (nguyenLieuLog/mayRutLog/mayDanhBongLog) giờ lưu dạng
    // object-theo-id trên Firebase (xem migrateSlLogIfArray/writeSlLogRecord)
    // — khi SSE báo cả nhánh đổi (VD ngay lúc di trú dữ liệu), giá trị trả về
    // luôn là OBJECT chứ không còn là mảng, nên phải Object.values() lại
    // trước khi gán, nếu không DB[field] sẽ thành object và làm hỏng mọi chỗ
    // đang coi đây là mảng (slArr, .filter, .find...).
    const SL_LOG_FIELDS = {nguyenLieuLog:1, mayRutLog:1, mayDanhBongLog:1};
    let fresh = val || (Array.isArray(DB[field])?[]:{});
    if(SL_LOG_FIELDS[field] && fresh && !Array.isArray(fresh)) fresh = Object.values(fresh);
    if(JSON.stringify(fresh)===JSON.stringify(DB[field])) return;
    DB[field] = fresh;
    if(field==='attendance') _lastSyncedAttendanceSnapshot = flattenAttendance(DB.attendance);
    // SỬA LỖI ĐỒNG BỘ QUAN TRỌNG: các nhánh mảng-theo-id (Sổ nguyên liệu,
    // Sổ máy Rút, Sổ máy Đánh bóng, Lịch làm việc, Bảo trì, Kỷ luật, Nghỉ
    // phép, Workers, Khuôn, Check Sheet, QR...) dùng _lastSyncedArrSnap để
    // biết CHÍNH XÁC dòng nào mình vừa thêm/sửa/xoá khi lưu (mergeAndSaveArrField).
    // Trước đây, khi có cập nhật REALTIME (SSE) từ THIẾT BỊ KHÁC báo về đúng
    // nhánh này, DB[field] được cập nhật nhưng _lastSyncedArrSnap[field] KHÔNG
    // được làm mới theo — khiến "ảnh chụp lần đồng bộ gần nhất" bị CŨ dần theo
    // thời gian trên các thiết bị ít tự lưu (chỉ xem). Hậu quả: khi thiết bị đó
    // xoá dữ liệu (VD "Dọn dữ liệu sau khi xuất Excel"), các dòng do THIẾT BỊ
    // KHÁC thêm SAU lần đồng bộ cũ đó không nằm trong "ảnh chụp cũ" → không
    // được tính là "vừa xoá" → không bị xoá khỏi Firebase, nên vẫn còn nguyên
    // trên server và trên các thiết bị khác (dù trên máy vừa xoá thì đã biến
    // mất khỏi màn hình). Nay làm mới lại _lastSyncedArrSnap[field] MỖI KHI
    // nhận được cập nhật realtime, để lần xoá kế tiếp luôn tính đúng.
    if(Object.prototype.hasOwnProperty.call(_lastSyncedArrSnap, field)){
      _lastSyncedArrSnap[field] = snapshotArrById(DB[field]);
    }
  }
  lsSave(); scheduleUIRefresh(true);
}

// Áp 1 thay đổi ĐÚNG 1 đơn vào state cục bộ khi Firebase báo realtime về
// path /data/orders/{id} — thay vì tải lại cả /data/orders (nhẹ hơn nhiều,
// khớp với cách ghi từng đơn riêng lẻ ở writeOrderRecord/mergeAndSaveOrders).
// val=null nghĩa là đơn đó vừa bị xoá khỏi /data/orders (chuyển vào thùng
// rác hoặc bị xoá vĩnh viễn ở thiết bị khác).
function applySingleOrderChange(id, val){
  if(_pendingSaves>0) return; // đang ghi dở dang → chờ endSave() tự đồng bộ lại
  const idx = DB.orders.findIndex(o=>o.id===id);
  if(val==null){
    if(idx>=0) DB.orders.splice(idx,1);
  } else {
    if(idx>=0) DB.orders[idx] = val;
    else { DB.orders.push(val); if(!_knownIds.has(id)){ _knownIds.add(id); notifyNewOrder(val); } }
  }
  dedupeOrdersByIdKeepNewest(); // lưới an toàn cuối cùng, phòng khi có id trùng lọt vào
  _lastHash = hashOrders(DB.orders);
  _lastSyncedOrdersSnapshot = snapshotOrders(DB.orders);
  lsSave();
  scheduleUIRefresh(true);
}

// Xử lý 1 sự kiện thay đổi từ SSE, theo đúng path Firebase báo về
function handleRealtimeChange(path, val){
  _sseConnected = true;
  stopPolling(); // SSE đang sống → không cần polling song song nữa
  if(path.indexOf('/data')===0) _rtSeq++; // đánh dấu: có thay đổi dữ liệu realtime (xem doPoll)
  if(path==='/' || path==='/data'){ doPoll(); setSyncDot('ok'); return; }
  if(path==='/data/orders' || path==='/data/orders/'){
    // Ai đó vẫn ghi đè NGUYÊN CẢ nhánh (VD lần "đẩy data lên" đầu tiên khi
    // Firebase còn trống) → xử lý như trước, thay toàn bộ DB.orders.
    applyFieldChange('orders', val); setSyncDot('ok'); return;
  }
  if(path.indexOf('/data/orders/')===0){
    const id = path.slice('/data/orders/'.length);
    if(id && id.indexOf('/')===-1){ applySingleOrderChange(id, val); setSyncDot('ok'); return; }
  }
  // Sổ nguyên liệu / Máy Rút / Máy Đánh bóng+Cắt (tab 📊 Số liệu) — NÂNG CẤP
  // giống hệt Đơn hoàn thành ở trên: mỗi dòng lưu riêng tại /data/<field>/{id},
  // nên nhận đúng path này là biết ngay dòng nào vừa thêm/sửa/xoá, áp thẳng
  // vào DB tương ứng — các thiết bị khác thấy thay đổi NGAY LẬP TỨC, không
  // cần đợi vòng poll hay lần lưu kế tiếp.
  if(path.indexOf('/data/nguyenLieuLog/')===0){
    const id = path.slice('/data/nguyenLieuLog/'.length);
    if(id && id.indexOf('/')===-1){ applySingleSlItemChange('nguyenLieuLog', id, val); setSyncDot('ok'); return; }
  }
  if(path.indexOf('/data/mayRutLog/')===0){
    const id = path.slice('/data/mayRutLog/'.length);
    if(id && id.indexOf('/')===-1){ applySingleSlItemChange('mayRutLog', id, val); setSyncDot('ok'); return; }
  }
  if(path.indexOf('/data/mayDanhBongLog/')===0){
    const id = path.slice('/data/mayDanhBongLog/'.length);
    if(id && id.indexOf('/')===-1){ applySingleSlItemChange('mayDanhBongLog', id, val); setSyncDot('ok'); return; }
  }
  if(path.indexOf('/data/cpRecords')===0){ if(typeof cpOnRealtime==='function') cpOnRealtime(path, val); setSyncDot('ok'); return; }   // ControlPlan
  const field = _FB_FIELD_MAP[path];
  if(field){ applyFieldChange(field, val); setSyncDot('ok'); return; }
  if(path==='/announce'){ checkAnnounce(); return; }
  if(path==='/broadcast'){ checkBroadcast(); return; }
  if(path==='/log'){
    fbRead('/log').then(l=>{ if(Array.isArray(l)&&l.length>actLog.length){ actLog=l; logSave(); updateLogBadge(); } }).catch(()=>{});
    return;
  }
  if(path.indexOf('/presence')===0){
    // Tiếng vọng SSE của chính lần ghi heartbeat của thiết bị này: updateOnline() đã đọc lại
    // và vẽ danh sách ngay sau khi ghi → không cần đọc /presence thêm một lần nữa.
    if(path==='/presence/'+_devId) return;
    // Có người khác vừa online/offline → làm mới danh sách ngay (không ghi lại
    // heartbeat của chính mình, chỉ đọc lại để hiển thị đúng thực tế)
    refreshOnlineListOnly();
    return;
  }
  // Nhánh lạ không xác định trước → đọc lại toàn bộ cho chắc (hiếm khi xảy ra)
  doPoll();
}

// Tránh mở SSE khi máy đang bật Tiết kiệm dữ liệu hoặc mạng quá yếu (2G) —
// trường hợp đó polling giãn cách vẫn nhẹ nhàng hơn giữ 1 kết nối SSE kém ổn định
function shouldUseSSE(){
  if(typeof EventSource==='undefined') return false;
  const c = navigator.connection;
  if(c && (c.saveData || c.effectiveType==='slow-2g' || c.effectiveType==='2g')) return false;
  return true;
}

let _sseRefreshTimer = null;
async function startRealtimeStream(){
  if(!fbOk() || !currentUser || _sse || document.hidden) return;
  if(!shouldUseSSE()){ startPolling(); return; }
  try{
    const streamUrl = await fbAppendAuth(fbUrl()+'/.json');
    _sse = new EventSource(streamUrl);
    _sse.addEventListener('put', e=>{
      try{ const {path,data}=JSON.parse(e.data); handleRealtimeChange(path, data); }catch(err){}
    });
    _sse.addEventListener('patch', e=>{
      // 'patch' chỉ chứa các key con thay đổi → đọc lại đúng path đó cho chính xác,
      // vẫn nhẹ hơn nhiều so với hỏi lại toàn bộ /data
      try{
        const {path} = JSON.parse(e.data);
        fbRead(path).then(v=>handleRealtimeChange(path, v)).catch(()=>doPoll());
      }catch(err){}
    });
    _sse.onopen = ()=>{ _sseConnected = true; setSyncDot('ok'); stopPolling(); };
    _sse.onerror = ()=>{
      _sseConnected = false;
      setSyncDot('error');
      // EventSource tự động thử reconnect; song song bật polling dự phòng ngay
      // để dữ liệu không bị "đứng" trong lúc chờ kết nối lại
      startPolling();
    };
    // Token xác thực ẩn danh (idToken) chỉ sống ~1 giờ. Với Rules đã khoá lại
    // (yêu cầu auth != null), kết nối SSE mở lâu hơn thời hạn này có thể bị
    // máy chủ từ chối các phiên đọc kế tiếp. Cứ 50 phút, chủ động đóng và mở
    // lại kết nối với token mới để không bị gián đoạn đồng bộ thời gian thực.
    if(_sseRefreshTimer) clearInterval(_sseRefreshTimer);
    _sseRefreshTimer = setInterval(()=>{
      if(!_sse) return;
      stopSSE();
      startRealtimeStream();
    }, 50*60*1000);
  }catch(e){
    startPolling();
  }
}

function stopSSE(){
  if(_sse){ try{ _sse.close(); }catch(e){} _sse=null; }
  _sseConnected = false;
}

function stopPolling(){
  if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; }
}

// Polling CHỈ dùng làm dự phòng khi SSE chưa/không kết nối được.
// Giãn cách xa hơn hẳn bản cũ (3s) để không ảnh hưởng tốc độ mạng di động;
// tự tắt ngay khi SSE sống lại.
function startPolling(){
  if(_pollTimer) return;
  _pollTimer = setInterval(async()=>{
    if(!currentUser || !fbOk() || document.hidden) return;
    if(_sseConnected){ stopPolling(); return; }
    await doPoll();
  }, 8000);
}
