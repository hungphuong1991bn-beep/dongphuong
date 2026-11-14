// src/services/sync.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

let _pollTimer = null;
let _lastHash = '';
let _knownIds = new Set();

// Đếm số lượt ghi lên Firebase đang "bay" (chưa có phản hồi). Trong lúc này,
// TUYỆT ĐỐI không được ghi đè DB cục bộ bằng dữ liệu đọc về (doPoll / SSE),
// vì bản đọc đó có thể vẫn là bản CŨ (chưa thấy đơn vừa thêm) do độ trễ mạng
// → nếu ghi đè sẽ xóa mất đơn vừa thêm cả trong bộ nhớ lẫn cache local,
// và F5 tải lại sẽ mất luôn (đúng lỗi đang gặp).
let _pendingSaves = 0;
function beginSave(){ _pendingSaves++; }
function endSave(){
  _pendingSaves = Math.max(0, _pendingSaves-1);
  // Sau khi ghi xong, đồng bộ lại 1 lần để chắc chắn không bỏ lỡ thay đổi
  // của người khác xảy ra đúng lúc mình đang ghi.
  if(_pendingSaves===0) setTimeout(()=>{ if(currentUser && fbOk()) doPoll(); }, 500);
}

// ════════════════════════════════════════════════════════════
// SYNC ENGINE
// Nguyên tắc:
//   1. Ghi local TRƯỚC → UI cập nhật ngay (mọi user)
//   2. Push lên Firebase NGAY SAU (async)
//   3. Polling 3s detect thay đổi từ thiết bị khác
// ════════════════════════════════════════════════════════════

let _saving = false;

// Đánh dấu các nhánh dữ liệu vừa sửa cục bộ nhưng CHƯA CHẮC đã lên Firebase
// thành công ("dirty"). Dấu này chỉ được xoá khi ghi lên Firebase trả về OK.
// Nếu app bị đóng / mất mạng / tắt máy giữa chừng trước khi ghi xong, dấu vẫn
// còn trong localStorage → lần MỞ APP SAU sẽ thấy dấu này và tự ĐẨY LẠI dữ
// liệu cục bộ lên Firebase TRƯỚC KHI tải dữ liệu server về (xem initAndStartSync),
// để không bị bản cũ trên server ghi đè mất đơn hàng/chấm công vừa nhập
// — đúng lỗi "nhập đơn/chấm công hôm nay, vào xem lại bị mất".
const DIRTY_KEY = 'sx_dirty_fields_v1';
function getDirtyFields(){ try{ return JSON.parse(localStorage.getItem(DIRTY_KEY)||'[]'); }catch(e){ return []; } }
function markDirty(field){
  try{ const s=new Set(getDirtyFields()); s.add(field); localStorage.setItem(DIRTY_KEY, JSON.stringify([...s])); }catch(e){}
}
function clearDirty(field){
  try{ const s=new Set(getDirtyFields()); s.delete(field); localStorage.setItem(DIRTY_KEY, JSON.stringify([...s])); }catch(e){}
}

// Ghi 1 nhánh /data/<field> lên Firebase, có retry ĐÚNG 1 LẦN sau 3s nếu lỗi
// mạng. QUAN TRỌNG: beginSave() chỉ được gọi 1 LẦN DUY NHẤT ở nơi gọi hàm này
// (không gọi lại bên trong retry), và endSave() luôn được gọi đúng 1 lần ở
// điểm kết thúc cuối cùng — dù thành công hay thất bại hẳn.
// Bản cũ gọi beginSave() lần nữa bên trong khối retry nhưng lại chỉ khớp với
// đúng 1 endSave() ở cuối → mỗi khi mạng chập chờn 1 lần là bộ đếm
// _pendingSaves bị "kẹt" ở số dương MÃI MÃI. Vì applyDataSnapshot/doPoll/
// applyFieldChange đều tự bỏ qua dữ liệu mới khi _pendingSaves>0 (để tránh ghi
// đè lúc đang lưu dở), hậu quả là thiết bị đó VĨNH VIỄN không nhận thêm bất kỳ
// cập nhật realtime/polling nào từ thiết bị khác nữa cho tới khi F5 lại trang
// — đúng lỗi "thêm đơn mới không đồng bộ được sang thiết bị khác".
function fbSaveField(field, path, isRetry, onSuccess){
  return fbWrite(path, DB[field], 'PUT')
    .then(()=>{ setSyncDot('ok'); clearDirty(field); endSave(); if(onSuccess) onSuccess(); })
    .catch(e=>{
      if(!isRetry){
        setSyncDot('error');
        showToast('❌ Lỗi sync: '+e.message, true);
        setTimeout(()=>fbSaveField(field, path, true, onSuccess), 3000);
      } else {
        setSyncDot('error');
        endSave(); // giữ nguyên dấu "dirty" để lần mở app sau tự đẩy lại, không mất dữ liệu
      }
    });
}

// Tên người thực hiện, dùng để điền updatedBy trên từng bản ghi
function actorName(){ return currentUser ? (currentUser.name||currentUser.username||currentUser.id) : 'system'; }

function saveAll(){if(guardViewer())return;
  lsSave();
  _lastHash = hashOrders(DB.orders);
  if(!fbOk()) return;
  setSyncDot('saving');
  beginSave();
  fbWrite('/data', {orders:DB.orders, ordersTrash:DB.ordersTrash, users:DB.users, attendance:DB.attendance, workers:DB.workers, kyLuat:DB.kyLuat, nghiPhep:DB.nghiPhep, lichLamViec:DB.lichLamViec, baoTri:DB.baoTri, qrProducts:DB.qrProducts}, 'PUT')
    .then(()=>{ setSyncDot('ok'); ['orders','ordersTrash','attendance','workers','kyLuat','nghiPhep','lichLamViec','baoTri','qrProducts'].forEach(clearDirty); endSave(); })
    .catch(e=>{ setSyncDot('error'); showToast('❌ Lỗi: '+e.message, true); endSave(); });
}

// ════════════════════════════════════════════════════════════
// MERGE-BEFORE-WRITE dùng CHUNG cho các nhánh dạng "mảng object có
// id": lichLamViec (lịch làm việc), kyLuat (kỷ luật), nghiPhep
// (nghỉ phép), baoTri (bảo trì).
// ────────────────────────────────────────────────────────────
// Trước đây các nhánh này GHI ĐÈ TOÀN BỘ mảng lên Firebase y hệt
// lỗi gốc của /data/orders: nếu 2 người cùng sửa lịch làm việc,
// cùng thêm/duyệt kỷ luật - nghỉ phép, hoặc cùng cập nhật bảo trì
// gần như đồng thời trên 2 thiết bị khác nhau, người lưu SAU sẽ
// đè mất luôn thay đổi của người lưu TRƯỚC (dù không hề động tới
// dòng đó), vì mỗi lần lưu là ghi đè cả mảng bằng bản cục bộ.
// CÁCH SỬA: áp dụng ĐÚNG cơ chế đã dùng cho orders/attendance ở
// trên - so sánh với "ảnh chụp lần đồng bộ gần nhất" để biết chính
// xác dòng nào mình vừa thêm/sửa/xoá, đọc lại bản mới nhất từ
// server làm nền, rồi chỉ áp đè đúng phần mình vừa đổi lên trên
// nền đó trước khi ghi lại. Viết 1 hàm generic dùng chung cho cả 4
// nhánh để không phải lặp lại logic 4 lần.
function snapshotArrById(list){
  const m = {};
  (list||[]).forEach(o=>{ if(o && o.id) m[o.id] = JSON.stringify(o); });
  return m;
}
let _lastSyncedArrSnap = { lichLamViec:{}, kyLuat:{}, nghiPhep:{}, baoTri:{}, workers:{}, qrProducts:{}, khuonCatalog:{}, khuonQty:{}, csTemplates:{}, nguyenLieuLog:{}, mayRutLog:{}, mayDanhBongLog:{} };

// [GĐ1 v2.6.0] Khởi tạo "ảnh chụp đã đồng bộ" của các nhánh mảng-theo-id từ trạng thái hiện có.
// LỖI GỐC: sau lần tải đầu, _lastSyncedArrSnap.workers/lichLamViec/kyLuat/nghiPhep... vẫn là {} cho tới
// khi có lần LƯU hoặc sự kiện realtime đầu tiên → thao tác XOÁ đầu tiên trong phiên không được tính là
// "dòng vừa xoá" nên bản server (còn dòng đó) được ghi lại → dòng đã xoá "sống lại" sau khi tải lại.
function initArrSnapshots(){
  ['workers','kyLuat','nghiPhep','lichLamViec','baoTri','qrProducts','khuonCatalog','khuonQty','csTemplates'].forEach(function(f){
    _lastSyncedArrSnap[f] = snapshotArrById(DB[f]);
  });
}
function asArr(v){ return Array.isArray(v) ? v : (v && typeof v==='object' ? Object.values(v) : []); }

async function mergeAndSaveArrField(field, path, onSuccess){
  const localSnap = snapshotArrById(DB[field]);
  const lastSnap = _lastSyncedArrSnap[field] || {};
  const changedIds = new Set();
  Object.keys(localSnap).forEach(id=>{ if(localSnap[id]!==lastSnap[id]) changedIds.add(id); });
  const removedIds = new Set();
  Object.keys(lastSnap).forEach(id=>{ if(!localSnap[id]) removedIds.add(id); });

  let merged;
  try{
    const serverRaw = await fbRead(path);
    const serverList = serverRaw ? (Array.isArray(serverRaw)?serverRaw:Object.values(serverRaw)) : [];
    const mergedMap = {};
    serverList.forEach(o=>{ if(o && o.id) mergedMap[o.id]=o; }); // nền = bản mới nhất trên server
    (DB[field]||[]).forEach(o=>{
      if(!o || !o.id) return;
      // chỉ ghi đè bằng bản cục bộ nếu: (a) dòng này CHÍNH thiết bị này
      // vừa sửa, hoặc (b) dòng hoàn toàn mới chưa từng có trên server
      if(changedIds.has(o.id) || !mergedMap[o.id]) mergedMap[o.id]=o;
    });
    removedIds.forEach(id=>{ delete mergedMap[id]; }); // dòng mình vừa xoá
    merged = Object.values(mergedMap);
  }catch(e){
    // Không đọc được server (mất mạng...) → vẫn ghi bản cục bộ như cũ,
    // để fbSaveField tự retry/đánh dấu dirty, không chặn thao tác người dùng
    merged = DB[field];
  }

  DB[field] = merged;
  lsSave();
  scheduleUIRefresh(false);
  fbSaveField(field, path, false, ()=>{ _lastSyncedArrSnap[field] = snapshotArrById(DB[field]); if(onSuccess) onSuccess(); });
}

function syncArrFieldToServer(field, path){
  if(!fbOk()) return;
  setSyncDot('saving');
  markDirty(field);
  beginSave();
  mergeAndSaveArrField(field, path);
}

async function initAndStartSync(){
  // Load cache trước
  lsLoad(); logLoad();
  if(typeof attOnBoot==='function') attOnBoot();   // [GĐ1] áp lại ô chấm công chưa gửi từ phiên trước
  if(!DB.khuonCatalog || !DB.khuonCatalog.length) DB.khuonCatalog = KHUON_CATALOG_SEED.map(x=>({...x}));
  if(!DB.khuonQty || !DB.khuonQty.length) DB.khuonQty = KHUON_QTY_SEED.map(x=>({...x}));
  if(!DB.csTemplates || !DB.csTemplates.length) DB.csTemplates = CS_TEMPLATE_SEED.map(x=>JSON.parse(JSON.stringify(x)));
  _lastHash = hashOrders(DB.orders);
  DB.orders.forEach(o=>_knownIds.add(o.id));
  // FIX QUAN TRỌNG — nguồn gốc lỗi "quay về dữ liệu cũ sau 1 đêm / sau Auto
  // Cleanup": phải khởi tạo snapshot "đã đồng bộ" ngay từ bản cache cục bộ,
  // KHÔNG được để rỗng {}. Nếu để rỗng và lần tải /data đầu tiên bên dưới bị
  // lỗi mạng (throw ở catch), mọi lần saveOrders()/saveUsers()/saveAttendance()
  // gọi sau đó (kể cả autoCleanDone() chạy ngay cuối hàm này) sẽ so sánh với
  // snapshot rỗng → COI TOÀN BỘ danh sách cục bộ (có thể đã cũ vài ngày) là
  // "vừa sửa" → merge ghi đè lên TOÀN BỘ nhánh /data/orders (hoặc users/
  // attendance) trên Firebase bằng bản cache cũ, xoá sạch mọi thay đổi mà
  // thiết bị khác đã làm trong lúc đó. Khởi tạo đúng ở đây giúp merge luôn so
  // sánh với trạng thái đã biết gần nhất (cache), nên chỉ đúng phần người
  // dùng thực sự vừa đổi trong phiên này mới bị coi là "dirty".
  _lastSyncedOrdersSnapshot = snapshotOrders(DB.orders);
  _lastSyncedUsersSnapshot = snapshotUsers(DB.users);
  _lastSyncedAttendanceSnapshot = flattenAttendance(DB.attendance);
  _lastSyncedCsDataSnapshot = flattenCsData(DB.csData);
  _lastSyncedTrashSnapshot = snapshotOrders(DB.ordersTrash);
  initArrSnapshots();

  if(fbOk()){
    setSyncDot('saving');
    try{
      // Nếu có nhánh dữ liệu bị đánh dấu "dirty" từ phiên trước (đã lưu local
      // nhưng CHƯA CHẮC lên Firebase kịp — VD app bị đóng/mất mạng ngay sau khi
      // nhập đơn/chấm công) → đẩy lên TRƯỚC khi tải bản server về. Nếu bỏ qua
      // bước này, bản server (cũ hơn) sẽ ghi đè lên state hiện tại ngay bên
      // dưới và xoá mất đúng phần vừa nhập — đây là nguyên nhân chính của lỗi
      // "nhập đơn/chấm công hôm nay, vào xem lại bị mất".
      const dirty = getDirtyFields();
      if(dirty.length){
        // QUAN TRỌNG: KHÔNG được ghi đè thẳng (fbWrite) nhánh orders/users/
        // attendance bằng bản cục bộ ở đây. Nếu thiết bị này vừa mở lại app
        // sau một thời gian offline (hoặc bị đóng đột ngột trước khi kịp
        // đồng bộ), bản cục bộ đang giữ lúc này có thể CŨ HƠN dữ liệu trên
        // server cho những đơn/tài khoản/chấm công do THIẾT BỊ KHÁC vừa
        // thêm/sửa trong lúc thiết bị này offline. Ghi đè thẳng sẽ XOÁ MẤT
        // ngay các thay đổi đó lúc vừa mở app — đúng lỗi "đơn thêm từ hôm
        // trước bị mất rồi lại có" (nó "có lại" chỉ vì thiết bị kia tự đồng
        // bộ lại đè lên sau đó, chứ không phải app đã sửa đúng).
        // → Dùng đúng các hàm merge-theo-từng-mục (mergeAndSaveOrders/Users/
        // Attendance) đã có sẵn: đọc bản mới nhất từ server làm nền, chỉ áp
        // đè đúng phần cục bộ, không xoá mất phần của thiết bị khác.
        // Các nhánh dạng "mảng object có id" (workers, qrProducts, lichLamViec,
        // kyLuat, nghiPhep, baoTri) TRƯỚC ĐÂY rơi vào nhánh else bên dưới và bị
        // GHI ĐÈ THẲNG cả mảng bằng fbWrite PUT — nếu thiết bị khác đã
        // thêm/sửa/xoá dòng nào đó trong nhánh này trong lúc thiết bị này
        // offline, bản ghi đè thẳng sẽ xoá mất thay đổi đó ngay lúc mở app.
        // Phải dùng đúng mergeAndSaveArrField (đọc bản server mới nhất làm
        // nền, chỉ áp đè đúng phần cục bộ) giống hệt các nhánh khác.
        const ARR_FIELD_PATHS = {workers:'/data/workers', qrProducts:'/data/qrProducts',
          lichLamViec:'/data/lichLamViec', kyLuat:'/data/kyLuat', nghiPhep:'/data/nghiPhep', baoTri:'/data/baoTri',
          khuonCatalog:'/data/khuonCatalog', khuonQty:'/data/khuonQty', csTemplates:'/data/csTemplates'};
        // 3 sổ Số liệu (nguyenLieuLog/mayRutLog/mayDanhBongLog) giờ lưu theo
        // dạng object-theo-id tại /data/<field>/{id} (xem syncSlFieldPerRecord/
        // writeSlLogRecord) — KHÔNG được đi qua mergeAndSaveArrField ở đây nữa,
        // vì hàm đó ghi đè cả path bằng 1 MẢNG (Object.values(...)), sẽ xoá mất
        // cấu trúc theo-id vừa chuyển đổi. Dùng đúng syncSlFieldPerRecord để
        // vẫn tự đối chiếu và đẩy nốt đúng từng dòng còn "dirty" theo ID.
        const SL_LOG_FIELDS = {nguyenLieuLog:1, mayRutLog:1, mayDanhBongLog:1};
        await Promise.all(dirty.map(async f=>{
          try{
            if(f==='orders'){ beginSave(); await mergeAndSaveOrders(); }
            else if(f==='users'){ beginSave(); await mergeAndSaveUsers(); }
            else if(f==='attendance'){ beginSave(); await mergeAndSaveAttendance(); }
            else if(f==='csData'){ beginSave(); await mergeAndSaveCsData(); }
            else if(f==='ordersTrash'){ beginSave(); await mergeAndSaveOrdersTrash(); }
            else if(SL_LOG_FIELDS[f]){ await syncSlFieldPerRecord(f); }
            else if(ARR_FIELD_PATHS[f]){ beginSave(); await mergeAndSaveArrField(f, ARR_FIELD_PATHS[f]); }
            else { await fbWrite('/data/'+f, DB[f], 'PUT'); clearDirty(f); }
          }catch(e){}
        }));
      }
      const data = await fbRead('/data');
      // SỬA LỖI QUAN TRỌNG: đọc /data lúc khởi động có thể mất một khoảng
      // thời gian (mạng chậm/wifi xưởng chập chờn). Nếu người dùng thao tác
      // (xoá đơn, sửa tiến độ, đổi công đoạn, thêm đơn...) NGAY TRONG lúc
      // đang chờ bản đọc này, saveOrders()/mergeAndSaveOrders() của thao tác
      // đó đã tăng _pendingSaves và có thể đang ghi lên Firebase. Trước đây
      // đoạn này GHI ĐÈ THẲNG DB.orders/DB.attendance/... bằng bản vừa đọc
      // (có thể là bản CŨ, chưa thấy thay đổi vừa rồi) mà KHÔNG kiểm tra
      // _pendingSaves — nên thao tác vừa làm bị "biến mất" ngay sau đó: y hệt
      // triệu chứng "xoá không được", "tiến độ không lưu được", hoặc phải
      // thêm lại đơn (gây trùng đơn 2 lần cùng ngày). Chỉ áp bản đọc này khi
      // chắc chắn không có lượt ghi cục bộ nào đang dang dở; nếu có, bỏ qua
      // và để doPoll()/SSE tự đồng bộ lại sau khi lượt ghi đó hoàn tất (xem
      // endSave()).
      if(data && _pendingSaves===0){
        if(data.orders){ DB.orders = Array.isArray(data.orders)?data.orders:Object.values(data.orders); dedupeOrdersByIdKeepNewest(); healOrdersLegacyKeys(data.orders); }
        if(data.ordersTrash){ DB.ordersTrash = Array.isArray(data.ordersTrash)?data.ordersTrash:Object.values(data.ordersTrash); }
        if(data.users && data.users.length){
          // Giữ lại user cache nếu Firebase chưa có
          DB.users = Array.isArray(data.users)?data.users:Object.values(data.users);
        }
        if(typeof attOnSnapshot==='function') attOnSnapshot(data); else if(data.attendance){ DB.attendance = data.attendance; }   // [GĐ1] chuẩn hoá + áp lại ô chưa gửi
        if(data.workers){ DB.workers = asArr(data.workers); }
        if(data.kyLuat){ DB.kyLuat = asArr(data.kyLuat); }
        if(data.nghiPhep){ DB.nghiPhep = asArr(data.nghiPhep); }
        if(data.lichLamViec){ DB.lichLamViec = asArr(data.lichLamViec); }
        if(data.baoTri){ DB.baoTri = asArr(data.baoTri); }
        // SỬA LỖI: trang công khai Tổng hợp Khuôn đọc thẳng
        // /data/khuonCatalog + /data/khuonQty từ Firebase. Trước đây khi
        // Firebase chưa có 2 nhánh này, app chỉ âm thầm dùng dữ liệu mẫu
        // CỤC BỘ (KHUON_CATALOG_SEED/KHUON_QTY_SEED) mà KHÔNG đẩy lên
        // server — khiến trang công khai luôn thấy "0 kích thước" dù trên
        // app admin vẫn thấy đầy đủ danh mục. Giờ nếu server chưa có (hoặc
        // rỗng), tự động đẩy dữ liệu mẫu cục bộ lên Firebase ngay khi kết
        // nối được, để trang công khai đọc được.
        if(data.khuonCatalog && data.khuonCatalog.length){ DB.khuonCatalog = Array.isArray(data.khuonCatalog)?data.khuonCatalog:Object.values(data.khuonCatalog); }
        else {
          if(!DB.khuonCatalog || !DB.khuonCatalog.length) DB.khuonCatalog = KHUON_CATALOG_SEED.map(x=>({...x}));
          syncArrFieldToServer('khuonCatalog', '/data/khuonCatalog');
        }
        if(data.khuonQty && data.khuonQty.length){ DB.khuonQty = Array.isArray(data.khuonQty)?data.khuonQty:Object.values(data.khuonQty); }
        else {
          if(!DB.khuonQty || !DB.khuonQty.length) DB.khuonQty = KHUON_QTY_SEED.map(x=>({...x}));
          syncArrFieldToServer('khuonQty', '/data/khuonQty');
        }
        if(data.csTemplates && data.csTemplates.length){ DB.csTemplates = Array.isArray(data.csTemplates)?data.csTemplates:Object.values(data.csTemplates); }
        else {
          if(!DB.csTemplates || !DB.csTemplates.length) DB.csTemplates = CS_TEMPLATE_SEED.map(x=>JSON.parse(JSON.stringify(x)));
          syncArrFieldToServer('csTemplates', '/data/csTemplates');
        }
        if(data.csData){ DB.csData = data.csData; }
        if(data.nguyenLieuLog){ DB.nguyenLieuLog = Array.isArray(data.nguyenLieuLog)?data.nguyenLieuLog:Object.values(data.nguyenLieuLog); migrateSlLogIfArray('nguyenLieuLog','/data/nguyenLieuLog',data.nguyenLieuLog); }
        if(data.mayRutLog){ DB.mayRutLog = Array.isArray(data.mayRutLog)?data.mayRutLog:Object.values(data.mayRutLog); migrateSlLogIfArray('mayRutLog','/data/mayRutLog',data.mayRutLog); }
        if(data.mayDanhBongLog){ DB.mayDanhBongLog = Array.isArray(data.mayDanhBongLog)?data.mayDanhBongLog:Object.values(data.mayDanhBongLog); migrateSlLogIfArray('mayDanhBongLog','/data/mayDanhBongLog',data.mayDanhBongLog); }
        if(typeof cpOnBoot==='function') cpOnBoot(data.cpRecords);   // ControlPlan: nạp /data/cpRecords (không ghi đè)
        lsSave();
        _lastHash = hashOrders(DB.orders);
        DB.orders.forEach(o=>_knownIds.add(o.id));
        _lastSyncedOrdersSnapshot = snapshotOrders(DB.orders);
        _lastSyncedAttendanceSnapshot = flattenAttendance(DB.attendance);
        _lastSyncedCsDataSnapshot = flattenCsData(DB.csData);
        _lastSyncedUsersSnapshot = snapshotUsers(DB.users);
        _lastSyncedTrashSnapshot = snapshotOrders(DB.ordersTrash);
        initArrSnapshots();
        _lastSyncedArrSnap.nguyenLieuLog = snapshotArrById(DB.nguyenLieuLog);
        _lastSyncedArrSnap.mayRutLog = snapshotArrById(DB.mayRutLog);
        _lastSyncedArrSnap.mayDanhBongLog = snapshotArrById(DB.mayDanhBongLog);
      } else if(!data){
        // Lần đầu: đẩy data lên (kèm cả khuonCatalog/khuonQty/qrProducts —
        // trước đây thiếu 2 nhánh khuôn nên trang công khai luôn rỗng)
        await fbWrite('/data', {orders:DB.orders, ordersTrash:DB.ordersTrash, users:DB.users, attendance:DB.attendance, workers:DB.workers, kyLuat:DB.kyLuat, nghiPhep:DB.nghiPhep, lichLamViec:DB.lichLamViec, baoTri:DB.baoTri, qrProducts:DB.qrProducts, khuonCatalog:DB.khuonCatalog, khuonQty:DB.khuonQty, csTemplates:DB.csTemplates, csData:DB.csData, nguyenLieuLog:DB.nguyenLieuLog, mayRutLog:DB.mayRutLog, mayDanhBongLog:DB.mayDanhBongLog}, 'PUT');
      }
      // Load log
      const log = await fbRead('/log');
      if(Array.isArray(log) && log.length >= actLog.length){ actLog = log; logSave(); }
      setSyncDot('ok');
    } catch(e){
      setSyncDot('error');
      showToast('⚠️ Offline – dùng dữ liệu cục bộ');
    }
    // Ưu tiên realtime qua SSE (1 kết nối, chỉ tải đúng phần đổi).
    // Nếu sau 4s chưa kết nối được (mạng chặn SSE, proxy...) → tự rơi về polling dự phòng.
    startRealtimeStream();
    setTimeout(()=>{ if(!_sseConnected) startPolling(); }, 4000);
  }
  // AUTO CLEANUP "Đơn hoàn thành" quá 30 ngày (xem autoCleanupDoneOrders()
  // ở trên): CHỈ lên lịch chạy ở ĐÂY — sau khi toàn bộ luồng tải dữ liệu ở
  // trên (đẩy "dirty" từ phiên trước + đọc /data mới nhất) đã hoàn tất —
  // không còn chạy ngay giữa lúc sync/ghi dở dang như bản trước đây từng gây
  // hiểu lầm "cứ Auto Cleanup chạy là mất dữ liệu". Trễ thêm vài giây và tự
  // kiểm tra lại _pendingSaves/dirty ngay trong autoCleanupDoneOrders() để
  // chắc chắn đồng bộ đã thực sự ổn định trước khi đụng tới dữ liệu.
  setTimeout(()=>{ /* Tự xoá ĐÃ TẮT — Admin dọn thủ công (modules/admin/manual-cleanup.js) */ }, 5000);
  renderTab(currentTab);
  updateBadges();
  // Chức năng sao lưu tự động đã được TẮT theo yêu cầu (xem ghi chú ở khối
  // BACKUP TỰ ĐỘNG ĐỊNH KỲ bên dưới) — không còn gọi maybeRunAutoBackup() ở đây nữa.
}

// Dừng/tiếp tục sync theo visibility để không ảnh hưởng app khác (Zalo, cuộc gọi) & đỡ hao pin/data
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){
    // App vào nền: đóng SSE + dừng poll hoàn toàn
    stopSSE();
    stopPolling();
  } else if(currentUser && fbOk()){
    // App hiện lại: mở lại realtime ngay, đồng thời đồng bộ 1 lần cho chắc
    startRealtimeStream();
    updateOnline();
    setTimeout(()=>{ doPoll(); if(!_sseConnected) startPolling(); }, 300);
    // Auto Cleanup 30 ngày / 32 ngày: thử lại khi app được mở lại (VD để qua
    // đêm ở nền rồi mở lại) — cả 2 hàm tự bỏ qua nếu chưa tới hạn 24h, chưa
    // đồng bộ xong hoặc đang có ghi dở dang, nên gọi lại đây an toàn.
    setTimeout(()=>{ /* Tự xoá ĐÃ TẮT — Admin dọn thủ công (modules/admin/manual-cleanup.js) */ }, 3000);
  }
});
// Auto Cleanup 30 ngày (Đơn hoàn thành) / 32 ngày (tab Số liệu): kiểm tra
// định kỳ mỗi giờ cho các phiên mở app kéo dài nhiều ngày liên tục không
// tải lại trang — bản thân từng hàm tự bỏ qua nếu chưa tới hạn 24h/thiết
// bị hoặc đồng bộ chưa ổn định (xem canRunAutoClean()/canRunSlAutoClean()).
setInterval(()=>{ if(currentUser && fbOk()){ /* Tự xoá ĐÃ TẮT — Admin dọn thủ công (modules/admin/manual-cleanup.js) */ } }, 60*60*1000);
window.addEventListener('online', ()=>{ if(currentUser && fbOk()){ startRealtimeStream(); doPoll(); updateOnline(); } });
window.addEventListener('offline', ()=>{ setSyncDot('offline'); });
