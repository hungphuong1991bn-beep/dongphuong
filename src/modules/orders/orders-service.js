// src/modules/orders/orders-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

// ── Trạng thái riêng cho tab "Đơn đang làm" (ERP order management) ──
let ddRecvFrom = '';   // lọc theo ngày nhận đơn (từ ngày)
let ddPriorityFilter = 'all';   // lọc theo mức ưu tiên
let ddCustomerFilter = 'all';   // lọc theo khách hàng
let ddSpecFilter = 'all';       // lọc theo quy cách (VD: Φ18×6000mm)
let ddSelected = new Set();          // các đơn đang được chọn để thao tác hàng loạt
let _editOrderId = null;

// ════════════════════════════════════════════════════════════
// MERGE-BEFORE-WRITE cho /data/orders và /data/attendance
// ────────────────────────────────────────────────────────────
// LỖI GỐC: trước đây saveOrders()/saveAttendance() GHI ĐÈ TOÀN BỘ nhánh dữ
// liệu bằng mảng/object cục bộ. Nhiều người dùng cùng thao tác trong giờ làm
// việc (thêm đơn, đổi trạng thái, chấm công...) gần như đồng thời từ nhiều
// thiết bị → thiết bị A thêm đơn mới rồi lưu; ngay sau đó thiết bị B (đang
// cầm bản dữ liệu cũ hơn vài giây, CHƯA kịp nhận đơn mới của A qua realtime)
// đổi trạng thái 1 đơn khác rồi lưu → B ghi đè mất luôn đơn mới của A, dù B
// không hề động tới đơn đó. Đây chính là lỗi "thêm đơn/thao tác đơn xong rồi
// mất số liệu" xảy ra suốt buổi sáng khi nhiều người cùng dùng app.
//
// CÁCH SỬA: mỗi lần lưu, so sánh dữ liệu cục bộ với "ảnh chụp lần đồng bộ gần
// nhất" để biết CHÍNH XÁC đơn/dòng nào mình vừa thêm/sửa/xoá, rồi đọc lại bản
// mới nhất từ server làm NỀN, chỉ áp đè đúng phần mình vừa đổi lên trên nền
// đó trước khi ghi lại. Nhờ vậy thay đổi của thiết bị khác (mà mình chưa kịp
// nhận) không bị xoá mất, kể cả khi nhiều thiết bị lưu gần như cùng lúc.
function snapshotOrders(list){
  const m = {};
  (list||[]).forEach(o=>{ if(o && o.id) m[o.id] = JSON.stringify(o); });
  return m;
}
let _lastSyncedOrdersSnapshot = {};

// ── LƯỚI AN TOÀN CHỐNG NHÂN ĐÔI ĐƠN HÀNG ─────────────────────
// Tab Kế hoạch sản xuất CHỈ ĐƯỢC PHÉP cập nhật đúng 1 bản ghi hiện có theo
// id (không bao giờ push/add/create bản ghi mới) ở mọi thao tác: Bắt đầu
// chạy, Chuyển công đoạn, Cập nhật tiến độ, Hoàn thành, Lưu kế hoạch. Hàm
// này chạy NGAY TRƯỚC MỖI LẦN LƯU như một lưới an toàn cuối cùng: nếu vì
// bất kỳ lý do gì (đồng bộ lỗi, dữ liệu cũ lẫn vào...) mà DB.orders lỡ có 2
// bản ghi trùng id, sẽ tự gộp lại thành 1 (giữ bản có updatedAt/version mới
// nhất) TRƯỚC KHI ghi xuống Database/đồng bộ Realtime — tuyệt đối không để
// đơn trùng lặp lọt ra ngoài hay hiển thị cho người dùng.
function dedupeOrdersByIdKeepNewest(){
  const seen = new Map(); // id -> bản ghi giữ lại
  let hadDup = false;
  DB.orders.forEach(o=>{
    if(!o || !o.id) return;
    const prev = seen.get(o.id);
    if(!prev){ seen.set(o.id, o); return; }
    hadDup = true;
    const prevScore = (Number(prev.updatedAt)||0)*1000 + (Number(prev.version)||0);
    const curScore  = (Number(o.updatedAt)||0)*1000 + (Number(o.version)||0);
    if(curScore >= prevScore) seen.set(o.id, o); // giữ bản mới hơn, bỏ bản cũ
  });
  if(hadDup){
    DB.orders = [...seen.values()];
    console.warn('[dedupeOrdersByIdKeepNewest] Phát hiện & đã gộp đơn hàng bị trùng id — chỉ giữ lại bản mới nhất của mỗi id.');
  }
}

// ── TỰ SỬA CHỮA GỐC RỄ: dọn các đơn hàng bị lưu "kép" trên Firebase ──────
// NGUYÊN NHÂN THẬT của lỗi "bấm Hoàn thành (hoặc bất kỳ thao tác nào) thì 1
// bản chạy sang tab Hoàn thành/cập nhật đúng, còn 1 bản y hệt vẫn kẹt lại ở
// Kế hoạch SX với trạng thái CŨ": trước đây từng có chỗ ghi đè NGUYÊN CẢ
// mảng DB.orders lên thẳng nhánh /data (xem saveAll() phía trên — hàm này
// hiện KHÔNG còn được gọi ở đâu trong code nữa, nhưng dữ liệu nó từng ghi
// vẫn còn tồn đọng trên Firebase của bạn). Khi ghi 1 mảng JS lên Firebase,
// Firebase KHÔNG lưu dạng mảng mà tự chuyển thành object với key là CHỈ SỐ
// ("0","1","2"...). Từ đó, mỗi lần cập nhật 1 đơn, hệ thống (đúng thiết kế)
// chỉ ghi/đọc đúng 1 key /data/orders/{id} — nhưng hoàn toàn không đụng tới
// các key số kiểu cũ ("0","1"...) còn sót lại. Hậu quả: CÙNG một đơn hàng
// tồn tại "kép" trên Firebase — 1 bản ở key số (dữ liệu CŨ, đứng yên mãi
// mãi vì không ai còn ghi vào key đó) và 1 bản ở key=id (dữ liệu MỚI). Đọc
// về sẽ thấy đơn đó xuất hiện 2 lần với 2 trạng thái khác nhau — trông y
// hệt như "tạo đơn trùng lặp".
// Hàm này chạy mỗi khi đọc lại toàn bộ /data/orders: bất kỳ key nào KHÁC
// với field .id của chính bản ghi đó là key rác (legacy) → tự xoá thẳng key
// rác đó trên Firebase (nếu key=id đúng chưa tồn tại thì ghi dữ liệu vào
// đúng chỗ trước, tránh mất dữ liệu, rồi mới xoá key rác). Tự chạy ngầm,
// không chặn UI, lỗi mạng thì bỏ qua — lần đọc sau sẽ tự thử lại.
// Chống chạy chồng lấn: hàm này được gọi từ 3 nơi (đọc lần đầu, applyDataSnapshot,
// applyFieldChange) gần như cùng lúc mỗi khi /data/orders được xử lý — nếu không
// chặn, nhiều lượt dọn dẹp giống hệt nhau sẽ chạy song song, nhân đôi số lần ghi
// và số lần "dội ngược" gây nhấp nháy.
let _healingLegacyKeys = false;
async function healOrdersLegacyKeys(rawOrders){
  if(!rawOrders || typeof rawOrders!=='object' || Array.isArray(rawOrders)) return;
  if(!fbOk()) return;
  const keys = Object.keys(rawOrders);
  const properIds = new Set(keys.filter(k=>rawOrders[k] && rawOrders[k].id===k));
  const legacyKeys = keys.filter(k=>{
    const v = rawOrders[k];
    return v && typeof v==='object' && v.id && v.id!==k;
  });
  if(!legacyKeys.length) return;
  if(_healingLegacyKeys) return; // đang có 1 lượt dọn khác chạy rồi → bỏ qua, không chạy chồng lấn
  _healingLegacyKeys = true;
  // Tăng _pendingSaves trong suốt quá trình dọn: mọi sự kiện SSE "dội ngược"
  // (do chính các lệnh ghi/xoá bên dưới gây ra) sẽ bị applySingleOrderChange/
  // applyFieldChange/applyDataSnapshot tự bỏ qua (vì đều check _pendingSaves>0),
  // nên KHÔNG còn kích hoạt vẽ lại giao diện liên tục nữa. Sau khi dọn xong,
  // endSave() sẽ tự đồng bộ lại đúng 1 lần duy nhất.
  console.warn('[healOrdersLegacyKeys] Phát hiện '+legacyKeys.length+' đơn hàng bị lưu trùng key kiểu cũ trên Firebase — đang tự dọn dẹp...');
  beginSave();
  try{
    for(const k of legacyKeys){
      const v = rawOrders[k];
      try{
        if(!properIds.has(v.id)){
          // Bản đúng key=id chưa có → ghi vào đúng chỗ trước để không mất dữ liệu
          await fbWrite('/data/orders/'+v.id, v, 'PUT');
          properIds.add(v.id);
        }
        await fbWrite('/data/orders/'+k, null, 'DELETE'); // xoá key rác kiểu cũ
        console.warn('[healOrdersLegacyKeys] Đã xoá key rác /data/orders/'+k+' (đơn hàng id='+v.id+')');
      }catch(e){ /* lỗi mạng thì bỏ qua, lần load sau tự thử dọn lại */ }
    }
  } finally {
    endSave();
    _healingLegacyKeys = false;
  }
}

function saveOrders(){if(guardViewer())return;
  dedupeOrdersByIdKeepNewest();
  lsSave();
  _lastHash = hashOrders(DB.orders); // đánh dấu NGAY: đây là bản mới nhất do chính mình vừa tạo
  if(!fbOk()) return;
  setSyncDot('saving');
  markDirty('orders');
  beginSave();
  mergeAndSaveOrders();
}

// Đánh version/updatedAt/updatedBy cho 1 bản ghi vừa sửa cục bộ. Version chỉ
// tăng khi bản ghi ĐƯỢC GHI LÊN FIREBASE thành công (gọi ngay trước khi gộp,
// trong mergeAndSaveOrders) — không tăng khi chỉ sửa trên UI mà chưa lưu.
function stampOrderVersion(o){
  o.version = (Number(o.version)||0) + 1;
  o.updatedAt = Date.now();
  o.updatedBy = actorName();
}

// Ghi/xoá ĐÚNG 1 đơn tại /data/orders/{id} bằng ETag conditional write, thay
// vì tải cả nhánh /data/orders về rồi PUT đè cả mảng như trước. Lợi ích:
//   - Băng thông: mỗi lần lưu chỉ gửi đúng bản ghi vừa đổi (vài trăm byte),
//     không phải toàn bộ danh sách đơn (có thể vài trăm KB khi nhiều đơn).
//   - Firebase tự chặn ghi đè mù ở tầng server: nếu giữa lúc mình đọc ETag và
//     lúc ghi có thiết bị khác vừa ghi ĐÚNG đơn này, PUT/DELETE sẽ bị từ chối
//     với 412 thay vì âm thầm mất dữ liệu — hàm này đọc lại rồi thử tiếp tối
//     đa vài lần thay vì phải tải nguyên cả mảng để so sánh như cơ chế cũ.
// orderOrNull = null nghĩa là xoá đơn (chuyển hẳn khỏi /data/orders, dùng khi
// soft-delete sang ordersTrash hoặc khôi phục ngược lại).
async function writeOrderRecord(id, orderOrNull, baseVersion, maxRetry){
  maxRetry = maxRetry==null ? 4 : maxRetry;
  for(let attempt=0; attempt<=maxRetry; attempt++){
    let etag = '*', serverVal;
    try{
      const cur = await fbReadETag('/data/orders/'+id);
      etag = cur.etag; serverVal = cur.data;
    }catch(e){ /* không lấy được ETag (mạng chập chờn) → vẫn thử ghi bên dưới, Firebase sẽ tự trả 412 nếu có mâu thuẫn với etag mặc định */ }

    // XUNG ĐỘT THẬT: server đang giữ version MỚI HƠN bản mình dựa vào để sửa
    // (nghĩa là thiết bị khác đã ghi đơn này SAU lần mình đồng bộ gần nhất).
    // Không ghi đè mù — giữ lại bản có updatedAt thực sự mới hơn.
    if(orderOrNull && serverVal && typeof serverVal==='object'){
      const serverVersion = Number(serverVal.version)||0;
      if(serverVersion > (baseVersion||0)){
        const serverTime = Number(serverVal.updatedAt)||0;
        const localTime = Number(orderOrNull.updatedAt)||0;
        if(serverTime > localTime){
          log('Xung đột dữ liệu (tự xử lý)',
            `${serverVal.customer||orderOrNull.customer||'?'} · Giữ bản của ${serverVal.updatedBy||'thiết bị khác'}`,
            id, null, null);
          return {ok:true, kept:'server', value:serverVal};
        }
      }
    }

    try{
      const method = orderOrNull ? 'PUT' : 'DELETE';
      const res = await fbWriteETag('/data/orders/'+id, orderOrNull, etag, method);
      if(res.ok) return {ok:true, kept:'local', value:orderOrNull};
      // 412 — vừa có ai ghi đơn này ngay giữa lúc mình đọc/ghi → đọc lại và
      // thử lại từ đầu vòng lặp (không tính là lỗi mạng).
    }catch(e){
      if(attempt>=maxRetry) throw e;
      await new Promise(res=>setTimeout(res, 400*(attempt+1)));
    }
  }
  throw new Error('Ghi đơn '+id+' thất bại do xung đột ghi liên tục');
}

async function mergeAndSaveOrders(retryCount){
  retryCount = retryCount||0;
  const localSnap = snapshotOrders(DB.orders);
  const changedIds = [];
  Object.keys(localSnap).forEach(id=>{ if(localSnap[id]!==_lastSyncedOrdersSnapshot[id]) changedIds.push(id); });
  const removedIds = [];
  Object.keys(_lastSyncedOrdersSnapshot).forEach(id=>{ if(!localSnap[id]) removedIds.push(id); });

  if(!changedIds.length && !removedIds.length){ endSave(); return; }

  // Ghi version/updatedAt/updatedBy cho ĐÚNG các đơn thiết bị này vừa sửa,
  // ngay trước khi ghi lên Firebase. baseVersions ghi lại version của đơn đó
  // tại lần đồng bộ gần nhất (trước khi sửa) — dùng để writeOrderRecord phát
  // hiện xung đột thật sự (không chỉ đơn giản "ai ghi sau thắng"), tránh dữ
  // liệu MỚI của thiết bị khác bị dữ liệu CŨ của thiết bị này ghi đè mất.
  const baseVersions = {};
  changedIds.forEach(id=>{
    try{ baseVersions[id] = JSON.parse(_lastSyncedOrdersSnapshot[id]||'null')?.version || 0; }catch(e){ baseVersions[id]=0; }
    const o = DB.orders.find(x=>x.id===id);
    if(o) stampOrderVersion(o);
  });

  try{
    const results = await Promise.all([
      ...changedIds.map(id=>{
        const o = DB.orders.find(x=>x.id===id);
        return writeOrderRecord(id, o||null, baseVersions[id]).then(r=>({id, ...r}));
      }),
      ...removedIds.map(id=>writeOrderRecord(id, null, 0).then(r=>({id, ...r})))
    ]);

    // Nếu writeOrderRecord phát hiện xung đột thật và quyết định giữ bản
    // server (mới hơn) → cập nhật lại đúng đơn đó trong state cục bộ.
    let anyServerKept = false;
    results.forEach(r=>{
      if(r.kept==='server' && r.value){
        const idx = DB.orders.findIndex(x=>x.id===r.id);
        if(idx>=0) DB.orders[idx] = r.value; else DB.orders.push(r.value);
        anyServerKept = true;
      }
    });
    if(anyServerKept) showToast('⚠️ Đã tự xử lý xung đột dữ liệu', true);

    _lastHash = hashOrders(DB.orders);
    DB.orders.forEach(o=>_knownIds.add(o.id));
    lsSave();
    if(anyServerKept) scheduleUIRefresh(false);
    _lastSyncedOrdersSnapshot = snapshotOrders(DB.orders);
    setSyncDot('ok'); clearDirty('orders'); endSave();
  }catch(e){
    // Ghi thất bại (mất mạng/xung đột liên tục không dứt) → TUYỆT ĐỐI không
    // được coi đây là đã lưu xong. Giữ nguyên dấu "dirty" (đã đánh dấu ở
    // saveOrders) và thử lại sau vài giây, tối đa vài lần rồi thôi (dấu dirty
    // vẫn còn nên lần mở app sau sẽ tự đẩy lại — xem initAndStartSync).
    //
    // FIX RACE CONDITION QUAN TRỌNG: TUYỆT ĐỐI không được gọi endSave() ở
    // đây trước khi lên lịch retry. Hàm này thường được gọi bằng `await` từ
    // initAndStartSync() (để đẩy dữ liệu "dirty" từ phiên trước lên TRƯỚC KHI
    // đọc bản server về). Nếu endSave() gọi ngay tại đây, _pendingSaves rơi
    // về 0 trong lúc retry còn đang chờ 3s qua setTimeout (không hề được
    // await) — initAndStartSync() coi như "ghi xong" và tiếp tục đọc /data,
    // thấy _pendingSaves===0 nên GHI ĐÈ DB.orders bằng bản server (cũ hơn,
    // chưa có phần dirty), xoá mất đúng phần vừa cố gắng đẩy lên. Tệ hơn:
    // khi retry chạy 3s sau, DB.orders đã bị ghi đè nên so với snapshot
    // (cũng đã bị ghi đè theo) KHÔNG còn khác biệt gì → retry lặng lẽ bỏ
    // cuộc, dữ liệu mất vĩnh viễn — đúng triệu chứng "đơn/tiến độ vừa nhập tự
    // biến mất, dữ liệu quay về ngày cũ" xảy ra ngay lúc autoCleanDone() chạy
    // ở cuối initAndStartSync(). CÁCH SỬA: giữ nguyên _pendingSaves (không
    // endSave() ở nhánh còn retry) để mọi bản đọc /data trong lúc này tiếp
    // tục bị applyDataSnapshot/doPoll/initAndStartSync bỏ qua cho tới khi
    // retry thực sự thành công hoặc hết lượt thử (chỉ endSave() lúc đó).
    if(retryCount < 6){
      setTimeout(()=>{ mergeAndSaveOrders(retryCount+1); }, 3000);
    } else {
      endSave();
      setSyncDot('error');
      showToast('❌ Lỗi sync: '+e.message, true);
    }
  }
}

// ════════════════════════════════════════════════════════════
// MERGE-BEFORE-WRITE cho /data/ordersTrash (Thùng rác — Soft Delete)
// ────────────────────────────────────────────────────────────
// Đơn "xoá" (tự động sau 30 ngày hoặc do người dùng xoá tay) không còn bị xoá
// cứng khỏi hệ thống — chỉ được CHUYỂN sang nhánh /data/ordersTrash với
// deleted:true, deletedAt, deletedBy. Nhánh chính /data/orders không hề bị
// đụng tới về mặt cấu trúc (chỉ bớt đi đúng các id đã chuyển), nên toàn bộ
// logic hiển thị/lọc/đếm đơn hàng ở các tab khác (Kế hoạch SX, Đơn đang làm,
// Hoàn thành, Dashboard...) không cần sửa gì — chúng vẫn chỉ đọc DB.orders
// như trước, và DB.orders vẫn chỉ chứa đơn còn hoạt động.
// Dùng cùng cơ chế merge-theo-id như mergeAndSaveOrders() để nhiều thiết bị
// cùng xoá/khôi phục gần như đồng thời không ghi đè mất thùng rác của nhau.
let _lastSyncedTrashSnapshot = {};

function saveOrdersTrash(){
  lsSave();
  if(!fbOk()) return;
  markDirty('ordersTrash');
  beginSave();
  mergeAndSaveOrdersTrash();
}

async function mergeAndSaveOrdersTrash(retryCount){
  retryCount = retryCount||0;
  const localSnap = snapshotOrders(DB.ordersTrash);
  const changedIds = new Set();
  Object.keys(localSnap).forEach(id=>{ if(localSnap[id]!==_lastSyncedTrashSnapshot[id]) changedIds.add(id); });
  const removedIds = new Set();
  Object.keys(_lastSyncedTrashSnapshot).forEach(id=>{ if(!localSnap[id]) removedIds.add(id); });

  let merged;
  try{
    const serverRaw = await fbRead('/data/ordersTrash');
    const serverList = serverRaw ? (Array.isArray(serverRaw)?serverRaw:Object.values(serverRaw)) : [];
    const mergedMap = {};
    serverList.forEach(o=>{ if(o && o.id) mergedMap[o.id]=o; });
    DB.ordersTrash.forEach(o=>{
      if(!o || !o.id) return;
      if(changedIds.has(o.id) || !mergedMap[o.id]) mergedMap[o.id]=o;
    });
    removedIds.forEach(id=>{ delete mergedMap[id]; }); // đơn vừa khôi phục / xoá vĩnh viễn
    merged = Object.values(mergedMap);
  }catch(e){
    // FIX RACE CONDITION (giống mergeAndSaveOrders phía trên): không được
    // endSave() ở đây trước khi lên lịch retry, nếu không _pendingSaves rơi
    // về 0 giữa lúc retry còn đang chờ 3s, khiến initAndStartSync()/doPoll()
    // tưởng đã ghi xong và ghi đè DB.ordersTrash bằng bản server cũ ngay
    // trong lúc đó — mất đúng các đơn vừa chuyển vào/khôi phục khỏi thùng rác.
    if(retryCount < 6){
      setTimeout(()=>{ mergeAndSaveOrdersTrash(retryCount+1); }, 3000);
    } else {
      endSave();
      setSyncDot('error');
    }
    return;
  }

  DB.ordersTrash = merged;
  lsSave();
  scheduleUIRefresh(false);
  return fbSaveField('ordersTrash', '/data/ordersTrash', false, ()=>{ _lastSyncedTrashSnapshot = snapshotOrders(DB.ordersTrash); });
}

// ════════════════════════════════════════════════════════════
// AUTO CLEANUP — tự động XOÁ VĨNH VIỄN "Đơn hoàn thành" quá 30 NGÀY (tính
// theo doneAt, KHÔNG dùng ngày tạo đơn) khỏi DB.orders — KHÔNG còn chuyển
// vào DB.ordersTrash (đã bỏ cơ chế Soft Delete cho luồng này, xoá là mất
// hẳn, không khôi phục được). CHỈ đụng đúng các order id thoả điều kiện —
// không tác động bất kỳ dữ liệu/tab nào khác (kế hoạch SX, tiến độ, chấm
// công, nhân sự, tài khoản, kỷ luật/nghỉ phép/lịch làm việc, bảo trì,
// QR/khuôn...).
// ────────────────────────────────────────────────────────────
// AN TOÀN ĐỒNG BỘ (đọc kỹ trước khi sửa):
//   • Chỉ chạy khi đồng bộ đã ổn định: _pendingSaves===0 (không có lượt ghi/
//     retry nào đang dở dang) VÀ không còn field nào bị đánh dấu "dirty" từ
//     phiên trước (nghĩa là dữ liệu cục bộ đã lên Firebase đầy đủ). Đây
//     chính là yêu cầu "chạy sau khi Firebase Sync đã hoàn tất".
//   • TUYỆT ĐỐI không dùng saveAll()/fbWrite('/data', ...) — chỉ gọi
//     saveOrders(), hàm này đã dùng đúng cơ chế merge-theo-id + ETag
//     conditional write, chỉ ghi riêng đúng nhánh /data/orders, không đụng
//     nhánh nào khác.
//   • Chống Race Condition nhiều thiết bị: không tự đọc/so sánh toàn bộ
//     mảng rồi ghi đè — để mergeAndSaveOrders() lo phần đọc bản mới nhất
//     từ server làm nền trước khi ghi (xem hàm đó).
//   • Mất mạng/Firebase lỗi: DB.orders cục bộ + localStorage ĐÃ được cập
//     nhật ngay (xoá cục bộ luôn thành công), còn phần đẩy lên Firebase
//     nếu lỗi sẽ tự retry theo đúng cơ chế "dirty" sẵn có (markDirty bên
//     trong saveOrders) — không coi là mất dữ liệu đồng bộ, lần sync sau
//     tự đẩy lại đúng trạng thái đã xoá.
//   • Khoá chống chạy đồng thời + tối đa 1 lần/ngày trên CÙNG thiết bị: dùng
//     cờ bộ nhớ _autoCleanRunning (chặn 2 lệnh gọi chồng lấn trong cùng
//     phiên) và mốc thời gian lưu trong localStorage (chặn chạy lại trong
//     vòng 24h, kể cả sau khi tải lại trang).
const AUTOCLEAN_LOCK_KEY = 'sx_autoclean_last_run_v1';
const AUTOCLEAN_MIN_INTERVAL_MS = 24*60*60*1000; // tối đa 1 lần / 24h / thiết bị
const AUTOCLEAN_DAYS = 30;
let _autoCleanRunning = false; // khoá chống chạy chồng lấn trên cùng thiết bị

function autoCleanLastRun(){
  try{ return Number(localStorage.getItem(AUTOCLEAN_LOCK_KEY))||0; }catch(e){ return 0; }
}

// Kiểm tra TẤT CẢ điều kiện an toàn trước khi cho phép chạy — không thoả 1
// điều kiện nào cũng phải bỏ qua, sẽ tự thử lại ở lượt gọi kế tiếp (mở app
// sau/khi hiện lại tab/định kỳ mỗi giờ — xem các nơi gọi bên dưới).
function canRunAutoClean(){
  if(_autoCleanRunning) return false;               // đang có 1 lượt khác chạy dở
  if(!fbOk()) return false;                          // chưa cấu hình Firebase
  if(_pendingSaves>0) return false;                   // đang có ghi/retry dở dang
  if(getDirtyFields().length>0) return false;         // còn dữ liệu phiên trước chưa chắc đã lên Firebase
  if(Date.now() - autoCleanLastRun() < AUTOCLEAN_MIN_INTERVAL_MS) return false; // đã chạy trong vòng 24h
  return true;
}

async function autoCleanupDoneOrders(){
  if(!canRunAutoClean()) return;
  _autoCleanRunning = true;
  // Ghi mốc "đã chạy" NGAY LẬP TỨC (đồng bộ, trước khi xử lý bất cứ gì) để
  // 2 lệnh gọi gần như đồng thời trên cùng thiết bị (VD initAndStartSync +
  // visibilitychange xảy ra sát nhau) không cùng lọt qua canRunAutoClean().
  try{ localStorage.setItem(AUTOCLEAN_LOCK_KEY, String(Date.now())); }catch(e){}

  try{
    // Kiểm tra lại lần cuối ngay trước khi đụng dữ liệu — phòng trường hợp
    // giữa lúc canRunAutoClean() ở trên và đây có thao tác ghi khác vừa bắt đầu.
    if(_pendingSaves>0 || getDirtyFields().length>0) return;

    const cutoff = Date.now() - AUTOCLEAN_DAYS*24*60*60*1000;
    const toRemove = DB.orders.filter(o=>o && o.status==='done' && Number(o.doneAt)>0 && Number(o.doneAt)<=cutoff);
    if(!toRemove.length) return; // không có đơn nào quá hạn — không đụng gì cả

    const removedIds = new Set(toRemove.map(o=>o.id));

    // XOÁ VĨNH VIỄN — không còn chuyển vào Thùng rác nữa (đã bỏ cơ chế soft-
    // delete cho luồng tự động dọn 30 ngày). Chỉ bớt đúng các id quá hạn khỏi
    // DB.orders, không sửa/xoá bất kỳ đơn nào khác (đơn mới, đơn đang sản
    // xuất...). Không đụng bất kỳ mảng/field nào khác của DB (kế hoạch SX,
    // tiến độ, chấm công, nhân sự, tài khoản, kỷ luật/nghỉ phép/lịch làm
    // việc, bảo trì, QR/khuôn...).
    DB.orders = DB.orders.filter(o=>!removedIds.has(o.id));

    log('Tự động xoá vĩnh viễn đơn hoàn thành quá 30 ngày',
      `${toRemove.length} đơn: ${toRemove.map(o=>o.customer||o.id).slice(0,10).join(', ')}${toRemove.length>10?'…':''}`,
      null, null, {ids:[...removedIds], deletedBy:'AUTO_30_DAYS_PERMANENT'});

    // CHỈ ghi riêng /data/orders bằng cơ chế merge-theo-id sẵn có — TUYỆT ĐỐI
    // không saveAll()/ghi đè cả node /data.
    saveOrders();

    // Tab "Đơn hoàn thành" tự refresh để các đơn vừa dọn biến mất khỏi danh
    // sách ngay, không cần người dùng bấm gì thêm.
    if(currentTab==='hoanThanh') renderTab(currentTab);
    updateBadges();
  }catch(e){
    console.warn('[autoCleanupDoneOrders] lỗi khi dọn dẹp:', e);
  }finally{
    _autoCleanRunning = false;
  }
}


// Hash để detect thay đổi
function hashOrders(list){
  return (list||[]).map(o=>o.id+'|'+o.status+'|'+(o.doneAt||0)+'|'+(o.startedAt||0)).join(';');
}

let _savingOrder = false;
function saveOrder(){if(guardViewer())return;
  if(!_editOrderId && guardCreateOrder()){ closeModal('orderModal'); return; }
  // SỬA LỖI: bấm "Lưu đơn hàng" 2 lần liên tiếp thật nhanh (double-click
  // chuột, hoặc double-tap trên điện thoại/tablet khi mạng/máy hơi chậm)
  // trước đây gọi saveOrder() 2 lần trước khi modal kịp đóng ở lần đầu →
  // tạo ra 2 đơn hàng giống hệt nhau cùng lúc. Khoá lại trong lúc xử lý.
  if(_savingOrder) return;
  _savingOrder = true;
  const btn = $('ofSaveBtn'); if(btn) btn.disabled = true;
  try{
    _saveOrderImpl();
  } finally {
    _savingOrder = false;
    if(btn) btn.disabled = false;
  }
}
function _saveOrderImpl(){
  if(!_editOrderId && !canCreateOrder()) return; // chốt chặn cuối
  const customer=$('ofCust').value.trim();
  if(!customer){ $('orderErr').textContent='Nhập tên khách hàng'; $('orderErr').style.display='block'; return; }
  saveCustomerHistory(customer);
  saveQuyCachHistory($('ofType').value.trim());
  const isCoil = $('ofIsCoil') ? $('ofIsCoil').checked : false;
  const phi = parseFloat($('ofPhi').value)||0;
  const dT  = parseDimInput($('ofThk').value), dW = parseDimInput($('ofW').value);
  const t   = dT.num, w = dW.num;            // số để tính KG (trung bình nếu ghi nhiều giá trị)
  const tDisp = dT.val, wDisp = dW.val;      // giá trị lưu/hiển thị (VD "6/10")
  const lInput = parseFloat($('ofL').value)|| (isCoil?100:4000); // mm (thanh) hoặc mét/cuộn (cuộn)
  const l   = isCoil ? lInput*1000 : lInput; // luôn quy về mm để tính khối lượng nhất quán
  const meterPerCoil = isCoil ? lInput : 0;
  const qty = parseInt($('ofQty').value)||0; // số thanh hoặc số cuộn
  let kg    = parseFloat($('ofKg').value)||0;
  // Auto-calc nếu chưa có
  const isBoCanh = isBoCanhType($('ofType').value) && !(phi > 0);
  const boCalc = isBoCanh ? calcBoCanhArea(t, w) : null;
  if(!kg){
    if(phi&&l&&qty) kg=parseFloat((phi*phi*l*7/1000000*qty).toFixed(3));
    else if(isBoCanh){ if(boCalc&&l&&qty) kg=parseFloat((boCalc.area*l*CU_DENSITY/1000000*qty).toFixed(3)); }
    else if(t&&w&&l&&qty) kg=parseFloat((t*w*l*CU_DENSITY/1000000*qty).toFixed(3));
  }
  const isRound = phi > 0; // true = thanh/dây tròn
  const totalMeters = isCoil ? parseFloat((qty*meterPerCoil).toFixed(2)) : 0;
  const data={
    customer, po:$('ofPO').value.trim(), type:$('ofType').value.trim(),
    material:$('ofMat').value, thickness:tDisp, width:wDisp, thicknessNum:t, widthNum:w, length:l, qty, kg,
    phi: isRound?phi:0, isRound,
    isBoCanh, boR: boCalc ? boCalc.r : 0, boArea: boCalc ? parseFloat(boCalc.area.toFixed(4)) : 0,
    isCoil, meterPerCoil, totalMeters,
    priority:$('ofPri').value, deliveryDate:$('ofDate').value,
    address:$('ofAddr').value.trim(), note:$('ofNote').value.trim()
  };

  if(_editOrderId){
    const idx=DB.orders.findIndex(x=>x.id===_editOrderId);
    const before={...DB.orders[idx]};
    DB.orders[idx]={...DB.orders[idx],...data};
    log('Sửa đơn',`${customer} · ${data.priority}`,_editOrderId,
      {status:before.status,customer:before.customer},
      {status:DB.orders[idx].status,customer});
    showToast('✅ Đã cập nhật đơn hàng');
  } else {
    const doCreate=()=>{
      const newId=uid();
      DB.orders.push({id:newId,status:'pending',createdAt:Date.now(),createdBy:currentUser?.id,...data});
      _knownIds.add(newId);
      const dimStr = isRound?`Φ${phi}`:`${tDisp}×${wDisp}`;
      const specStrTxt = isCoil
        ? `${dimStr}mm · ${qty} cuộn × ${meterPerCoil}m = ${totalMeters}m`
        : (isRound?`Φ${phi}×${lInput}mm · ${qty} cây`:`${tDisp}×${wDisp}×${lInput}mm · ${qty} thanh`);
      log('Thêm đơn',`${customer} · ${specStrTxt} · ${data.priority}`,newId,null,{customer,qty,priority:data.priority});
      showToast('✅ Đã thêm đơn hàng mới');
      addNotif('order_new','📦 Đơn mới: '+customer,`${specStrTxt} · ${data.priority}`,'keHoach',currentUser?.name);
      pushNotif('📦 Đơn hàng mới!',`${customer} · ${specStrTxt}`);
      closeModal('orderModal');
      renderTab(currentTab);
      saveOrders();
    };
    // Cảnh báo TRƯỚC khi tạo nếu đã có đơn giống hệt (cùng khách, cùng kích
    // thước, cùng số lượng, tạo trong vòng vài tiếng gần đây) — chặn ngay từ
    // gốc tình trạng nhập trùng đơn do 2 người/2 thiết bị cùng nhập 1 đơn.
    const dups=findDuplicateOrders({customer,isRound,isCoil,phi:isRound?phi:0,thickness:tDisp,width:wDisp,length:l,qty,createdAt:Date.now()});
    if(dups.length){
      confirm2('⚠️ Có thể bị trùng đơn',
        `Đã có ${dups.length} đơn giống hệt của "${customer}" (${specStr({isCoil,isRound,phi,thickness:tDisp,width:wDisp,length:l})}, ${qty} ${isRound?'cây':isCoil?'cuộn':'thanh'}) được tạo gần đây. Bạn có chắc muốn tạo thêm đơn mới này không?`,
        doCreate);
      return;
    }
    doCreate();
    return;
  }
  closeModal('orderModal');
  renderTab(currentTab);
  saveOrders();
}
// ════════════════════════════════════════════════════════════
// PHÁT HIỆN ĐƠN TRÙNG LẶP (không phải lỗi đồng bộ, mà là 2 đơn KHÁC id nhau
// nhưng nội dung giống hệt) — ĐÂY MỚI LÀ NGUYÊN NHÂN THẬT của cảm giác "xoá
// đơn xong lại thấy nó quay lại ngay lập tức" mà người dùng gặp phải (VD:
// đơn 5x20 của Á Châu bị nhập 2 lần bởi 2 thiết bị/2 người gần như cùng lúc
// trước khi kịp đồng bộ cho nhau thấy). Khi đó xoá 1 đơn là xoá ĐÚNG đơn đó
// (đã biến mất vĩnh viễn, xem code writeOrderRecord/mergeAndSaveOrders ở
// trên — không hề có chỗ nào ghi nó trở lại), nhưng đơn còn lại — id khác,
// vẫn còn nguyên trên hệ thống — hiển thị giống hệt nên trông như "chưa xoá
// được / vừa xoá lại có". Sửa tận gốc bằng cách: (1) cảnh báo NGAY khi tạo
// đơn nếu phát hiện đã có đơn giống hệt còn active, và (2) sau khi xoá 1
// đơn, chủ động báo & cho xoá luôn nếu vẫn còn bản sao giống hệt.
function ordersLookDuplicate(a,b){
  if(!a||!b||a.id===b.id) return false;
  const norm=s=>(s||'').toString().trim().toLowerCase();
  if(norm(a.customer)!==norm(b.customer)) return false;
  if(!!a.isRound!==!!b.isRound) return false;
  if(!!a.isCoil!==!!b.isCoil) return false;
  if((a.phi||0)!==(b.phi||0)) return false;
  if((a.thickness||0)!==(b.thickness||0)) return false;
  if((a.width||0)!==(b.width||0)) return false;
  if((a.length||0)!==(b.length||0)) return false;
  if((a.qty||0)!==(b.qty||0)) return false;
  // Chỉ coi là trùng khi 2 đơn được TẠO cách nhau dưới 3 tiếng ("cùng giờ
  // cùng ngày") — tránh báo nhầm 2 đơn hàng lặp lại tự nhiên của cùng 1
  // khách vào những ngày khác nhau.
  const ta=Number(a.createdAt)||0, tb=Number(b.createdAt)||0;
  if(!ta||!tb) return false;
  return Math.abs(ta-tb) < 3*60*60*1000;
}
function findDuplicateOrders(o){ return DB.orders.filter(x=>ordersLookDuplicate(o,x)); }

function deleteOrder(id){if(guardViewer())return;
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  confirm2('Xóa đơn hàng',`Xóa đơn của "${o.customer}"?`,()=>{
    log('Xóa đơn',o.customer,id,{customer:o.customer,status:o.status},null);
    DB.orders=DB.orders.filter(x=>x.id!==id);
    renderTab(currentTab); updateBadges(); showToast('Đã xóa đơn');
    saveOrders();
    // Đơn vừa xoá đã mất hẳn — kiểm tra xem có bản sao giống hệt nào của nó
    // còn sót lại không (xem giải thích ở ordersLookDuplicate phía trên).
    const dups=findDuplicateOrders(o);
    if(dups.length){
      setTimeout(()=>{
        confirm2('⚠️ Vẫn còn đơn giống hệt',
          `Đơn "${o.customer}" bạn vừa xoá ĐÃ được xoá hẳn. Tuy nhiên hệ thống phát hiện còn ${dups.length} đơn khác giống hệt (cùng khách, cùng kích thước ${specStr(o)}, cùng số lượng, tạo gần cùng giờ) — có thể đây là đơn bạn tưởng "vừa xoá xong lại thấy". Xoá luôn (những) đơn này chứ?`,
          ()=>{
            dups.forEach(d=>log('Xóa đơn (trùng lặp)',d.customer,d.id,{customer:d.customer,status:d.status},null));
            DB.orders=DB.orders.filter(x=>!dups.some(d=>d.id===x.id));
            renderTab(currentTab); updateBadges();
            showToast('Đã xóa '+dups.length+' đơn trùng lặp');
            saveOrders();
          });
      },400);
    }
  });
}

function setStatus(id, newStatus){if(guardViewer())return;
  // CHỈ CẬP NHẬT đơn hàng đã có theo id (không push/add/create bản ghi mới,
  // không đổi id) — id truyền vào phải khớp đúng 1 bản ghi hiện có trong
  // DB.orders, nếu không tìm thấy thì dừng lại, không tự tạo mới.
  const o=DB.orders.find(x=>x.id===id); if(!o) return;

  // Bắt đầu chạy: nếu công đoạn hiện tại (mặc định 'dun' nếu đơn chưa từng
  // chạy) đã được phân công máy, và máy đó đang thực sự CHẠY đơn khác →
  // chặn lại, không cho 2 đơn cùng "chạy chồng" trên 1 máy. Đơn bị chặn vẫn
  // giữ nguyên vị trí trong HÀNG ĐỢI của máy đó (xem dhMachineQueue) và tự
  // được phép bấm "Bắt đầu" lại ngay khi máy trống.
  if(newStatus==='running'){
    const stageKey = o.stage || 'dun';
    const machineId = orderMachineAssign(o)[stageKey];
    if(machineId){
      const conflict = machineConflictOrder(machineId, stageKey, id);
      if(conflict){
        const m = machineById(machineId);
        showToast(`⛔ ${m?m.name:'Máy'} đang chạy đơn ${ddCode(conflict)} (${conflict.customer||''}) — đơn này đang xếp hàng chờ, hãy đợi máy trống hoặc đổi máy khác`, true);
        renderTab(currentTab);
        return;
      }
    }
  }

  // Máy đang thực sự giữ đơn này (nếu có) ngay TRƯỚC khi đổi trạng thái —
  // dùng để tự động đẩy đơn kế tiếp trong hàng đợi lên RUNNING ngay khi máy
  // này được giải phóng bởi đơn hoàn thành (mục 3 + mục 11: AUTO DISPATCH).
  const freedMachineId = (()=>{
    if(newStatus!=='done' || o.status!=='running') return null;
    const active = orderActiveAssignStage(o);
    return active ? (orderMachineAssign(o)[active.key] || null) : null;
  })();

  const before=o.status;
  o.status=newStatus;
  if(newStatus==='running'&&!o.startedAt) o.startedAt=Date.now();
  if(newStatus==='running'&&!o.stage) o.stage='dun';
  // Bấm "Bắt đầu sản xuất" đã qua kiểm tra không xung đột ở trên → xác nhận
  // NGAY đơn này đang chạy thật tại đúng máy công đoạn hiện tại (nếu có gán
  // máy) — đồng bộ với cơ chế machineActiveAt dùng ở setStage()/
  // promoteQueuedOrderToRunning() (chống 2 đơn cùng "đang chạy" 1 máy).
  if(newStatus==='running'){
    const stKey = o.stage || 'dun';
    const mid = orderMachineAssign(o)[stKey];
    if(mid) dhMarkActiveAtMachine(o, stKey, mid);
  }
  if(newStatus==='done') o.doneAt=Date.now();
  if(newStatus==='done') o.stage='danhbong';
  if(newStatus==='done') o.doneBy=currentUser?.name||'—';
  if(newStatus!=='done') delete o.doneAt;
  const lb={pending:'Chờ sản xuất',running:'Đang sản xuất',done:'Hoàn thành'};
  log(lb[newStatus]||newStatus,
    `${o.customer} · ${o.priority||''} · ${specStr(o)} · ${qtyLabel(o)}`,
    id,
    {status:before,customer:o.customer,priority:o.priority},
    {status:newStatus,customer:o.customer,priority:o.priority});

  // UI ngay lập tức
  if(newStatus==='done'){
    goTab('hoanThanh'); // Đơn hoàn thành → nhảy thẳng sang tab Hoàn thành, không còn ở tab Đơn Hàng nữa
  } else {
    renderTab(currentTab);
  }
  updateBadges();
  refreshKhDetailIfOpen(id); // panel chi tiết (nếu đang mở đúng đơn) cập nhật ngay, không cần đóng/mở lại
  goToOrderCard(id); // Nổi bật + cuộn tới đúng thẻ đơn vừa đổi trạng thái, tránh mất dấu khi đơn đổi vị trí/cột
  showToast({pending:'⏳ Chờ sản xuất',running:'⚙️ Đang sản xuất!',done:'✅ Hoàn thành!'}[newStatus]||'');

  // Firebase
  saveOrders();

  // AUTO DISPATCH (mục 3 + 11): đơn A vừa hoàn thành → máy vừa giải phóng ra
  // → tự động lấy đơn đầu hàng đợi (VD "B") đẩy sang RUNNING ngay, KHÔNG
  // cần thao tác thủ công/gán lại máy (đúng lỗi báo cáo gốc).
  if(freedMachineId) promoteQueuedOrderToRunning(freedMachineId);

  if(newStatus==='done'){
    pushNotif('✅ Hoàn thành!',`${o.customer} đã xong`);
    alertUser('done');
    addNotif('order_done','✅ Hoàn thành: '+o.customer,
      `${specStr(o)} · ${qtyLabel(o)} · ${o.priority||''}`,'hoanThanh',currentUser?.name);
    // Kiểm tra thăng cấp tự động (gộp qua scheduleAiAutoPromoteCheck — xem
    // giải thích ở khai báo hàm phía trên)
    scheduleAiAutoPromoteCheck();
    // Đơn vừa hoàn thành → hỏi có muốn cấp mã QR truy xuất cho từng thanh/cuộn không
    if(isStaff()) setTimeout(()=>openQrGenForOrder(id), 700);
  }
  if(newStatus==='running'){
    addNotif('order_run','⚙️ Bắt đầu chạy: '+o.customer,
      `${specStr(o)} · ${qtyLabel(o)} · ${o.priority||''}`,'keHoach',currentUser?.name);
  }
}
