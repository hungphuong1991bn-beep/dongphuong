// src/modules/inventory/inventory-service.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// AUTO CLEANUP tab 📊 Số liệu (Sổ nguyên liệu / Sổ máy Rút / Sổ máy Đánh
// bóng + Cắt) — TỰ ĐỘNG XOÁ hẳn (không qua Thùng rác, vì các sổ này chỉ
// là nhật ký ghi nhanh hàng ngày) các dòng có "Ngày" quá 32 ngày, để sổ
// luôn gọn nhẹ, dễ tìm dòng gần đây. Dùng lại đúng cơ chế khoá chống
// chạy chồng lấn + tối đa 1 lần/24h/thiết bị như autoCleanupDoneOrders()
// ở trên, để không đụng vào dữ liệu khi đang sync/ghi dở dang.
const SL_AUTOCLEAN_LOCK_KEY = 'sx_sl_autoclean_last_run_v1';
const SL_AUTOCLEAN_DAYS = 32;
let _slAutoCleanRunning = false;

// ── NHẮC XUẤT EXCEL TRƯỚC KHI BỊ TỰ ĐỘNG XOÁ ──────────────────────────
// Dòng dữ liệu nào sắp tới hạn bị autoCleanupSoLieu() xoá (còn ≤5 ngày
// nữa) thì cần nhắc người dùng xuất Excel lưu trữ trước — tránh việc
// dữ liệu tự mất mà không ai kịp lưu.
const SL_REMIND_DAYS_BEFORE = 5;
const SL_REMIND_LOCK_KEY = 'sx_sl_remind_export_last_run_v1';

// Số ngày còn lại trước khi 1 dòng (theo "Ngày ghi") bị tự động xoá.
// Trả về null nếu dòng không có Ngày hợp lệ (không xoá tự động nên
// cũng không cần nhắc).
function slDaysUntilAutoDelete(ngay){
  if(!ngay) return null;
  const rowDate = new Date(ngay+'T00:00:00');
  if(isNaN(rowDate)) return null;
  const daysSince = Math.floor((new Date() - rowDate)/86400000);
  return SL_AUTOCLEAN_DAYS - daysSince;
}
// Với 1 sổ (tab): đếm số dòng sắp bị xoá trong SL_REMIND_DAYS_BEFORE
// ngày tới + số ngày còn lại ít nhất (dòng cũ nhất sẽ bị xoá sớm nhất).
function slSoonExpireInfo(tab){
  const arr = slArr(tab);
  let count=0, minLeft=Infinity;
  arr.forEach(r=>{
    const left = slDaysUntilAutoDelete(r && r.ngay);
    if(left!=null && left>=0 && left<=SL_REMIND_DAYS_BEFORE){
      count++;
      if(left<minLeft) minLeft = left;
    }
  });
  return count>0 ? {count, daysLeft:minLeft} : null;
}
// Banner cảnh báo hiển thị NGAY TRÊN đầu tab 📊 Số liệu (luôn đúng thời
// điểm thực tế vì tính lại mỗi lần render, không phụ thuộc thông báo
// có bị bỏ lỡ hay không) — kèm nút xuất Excel nhanh cho đúng sổ đó.
function slRemindBannerHTML(){ return ''; } // tự xoá đã tắt (xoá thủ công bởi Admin) — không còn banner cảnh báo
function _slRemindBannerHTML_legacy(){
  const parts = Object.keys(SL_META).map(k=>{
    const info = slSoonExpireInfo(k);
    if(!info) return '';
    const m = SL_META[k];
    const whenTxt = info.daysLeft<=0 ? 'HÔM NAY' : `trong ${info.daysLeft} ngày nữa`;
    return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 12px;border-radius:10px;background:#FFF7ED;border:1px solid #FDBA74;margin-bottom:8px">
      <span style="flex:1;min-width:220px;font-size:12.5px;color:#9A3412;line-height:1.5">⏰ <b>${info.count} dòng</b> của <b>${m.icon} ${m.label}</b> sẽ tự động bị xoá <b>${whenTxt}</b> (đã ghi hơn ${SL_AUTOCLEAN_DAYS-SL_REMIND_DAYS_BEFORE} ngày) — xuất Excel lưu trữ ngay kẻo mất dữ liệu!</span>
      <button class="khm-add-btn" style="background:${m.color};flex:0 0 auto" onclick="exportSlExcel('${k}')">📥 Xuất Excel</button>
    </div>`;
  }).filter(Boolean);
  return parts.join('');
}
// Nhắc chủ động qua chuông thông báo (addNotif) — tối đa 1 lần/24h/thiết
// bị (dùng lại chung mốc AUTOCLEAN_MIN_INTERVAL_MS), để Admin/nhân sự
// vẫn được nhắc kể cả khi không mở sẵn tab Số liệu. Gọi cùng lúc/cùng
// chỗ với autoCleanupSoLieu() (xem điểm gọi ở initApp/visibilitychange/
// setInterval bên dưới) để không cần thêm lịch chạy riêng.
function slRemindExportIfNeeded(){
  try{
    const last = Number(localStorage.getItem(SL_REMIND_LOCK_KEY))||0;
    if(Date.now() - last < AUTOCLEAN_MIN_INTERVAL_MS) return;
    const soonParts = [];
    Object.keys(SL_META).forEach(k=>{
      const info = slSoonExpireInfo(k);
      if(info) soonParts.push(`${SL_META[k].label}: ${info.count} dòng (còn ${info.daysLeft<=0?'0':info.daysLeft} ngày)`);
    });
    if(!soonParts.length) return;
    localStorage.setItem(SL_REMIND_LOCK_KEY, String(Date.now()));
    addNotif('warning', '⏰ Sắp tự động xoá dữ liệu Số liệu',
      `Một số dòng trong tab 📊 Số liệu sắp bị tự động xoá (quá ${SL_AUTOCLEAN_DAYS} ngày, không thể khôi phục) — ${soonParts.join('; ')}. Vào tab Số liệu và bấm "Xuất Excel" cho từng sổ để lưu trữ trước khi bị xoá.`,
      'soLieu');
  }catch(e){
    console.warn('[slRemindExportIfNeeded] lỗi khi kiểm tra nhắc xuất Excel:', e);
  }
}

function slAutoCleanLastRun(){
  try{ return Number(localStorage.getItem(SL_AUTOCLEAN_LOCK_KEY))||0; }catch(e){ return 0; }
}
function canRunSlAutoClean(){
  if(_slAutoCleanRunning) return false;
  if(!fbOk()) return false;
  if(_pendingSaves>0) return false;
  if(getDirtyFields().length>0) return false;
  if(Date.now() - slAutoCleanLastRun() < AUTOCLEAN_MIN_INTERVAL_MS) return false;
  return true;
}
async function autoCleanupSoLieu(){
  if(!canRunSlAutoClean()) return;
  _slAutoCleanRunning = true;
  try{ localStorage.setItem(SL_AUTOCLEAN_LOCK_KEY, String(Date.now())); }catch(e){}

  try{
    if(_pendingSaves>0 || getDirtyFields().length>0) return;

    const cutoffDate = new Date(); cutoffDate.setDate(cutoffDate.getDate()-SL_AUTOCLEAN_DAYS);
    const pad = n=>String(n).padStart(2,'0');
    const cutoffStr = `${cutoffDate.getFullYear()}-${pad(cutoffDate.getMonth()+1)}-${pad(cutoffDate.getDate())}`;

    let totalRemoved = 0;
    const removedByTab = [];
    Object.keys(SL_META).forEach(tab=>{
      const field = SL_META[tab].field;
      const arr = DB[field]||[];
      // Chỉ xoá dòng CÓ ghi Ngày và ngày đó đã quá hạn — dòng thiếu Ngày (hiếm,
      // dữ liệu lỗi) được giữ nguyên để không xoá nhầm.
      const kept = arr.filter(r=> !(r && r.ngay && r.ngay < cutoffStr));
      const removed = arr.length - kept.length;
      if(removed>0){
        DB[field] = kept;
        totalRemoved += removed;
        removedByTab.push(`${SL_META[tab].label}: ${removed} dòng`);
        slDoSave(tab);
      }
    });

    if(totalRemoved>0){
      log('Tự động dọn Số liệu quá 32 ngày',
        `${totalRemoved} dòng dữ liệu cũ hơn ${SL_AUTOCLEAN_DAYS} ngày (theo Ngày ghi) đã tự động bị xoá — ${removedByTab.join('; ')}`,
        null, null, {deletedBy:'AUTO_32_DAYS'});
      if(currentTab==='soLieu') renderSoLieu();
    }
  }catch(e){
    console.warn('[autoCleanupSoLieu] lỗi khi dọn dẹp:', e);
  }finally{
    _slAutoCleanRunning = false;
  }
}

// ════════════════════════════════════════════════════════════════════
// NÂNG CẤP: ĐỒNG BỘ TỪNG DÒNG THEO ID cho 3 sổ ở tab 📊 Số liệu (Sổ
// nguyên liệu / Sổ máy Rút / Sổ máy Đánh bóng+Cắt) — giống HỆT cơ chế
// đang dùng cho tab Đơn hoàn thành (writeOrderRecord/mergeAndSaveOrders
// ở trên, ghi trực tiếp /data/orders/{id}), THAY VÌ dùng
// mergeAndSaveArrField (tải + ghi đè NGUYÊN CẢ mảng) như trước.
//
// Lý do đổi riêng cho 3 sổ này: đây là nơi có thao tác XOÁ HÀNG LOẠT
// ("Dọn dữ liệu sau khi xuất Excel") — với cơ chế ghi đè cả mảng, việc
// xoá đúng phụ thuộc vào so sánh với "ảnh chụp lần đồng bộ gần nhất"
// (có thể bị cũ trong vài tình huống hiếm), khiến có lúc xoá ở máy này
// nhưng máy khác vẫn còn dữ liệu cũ. Ghi/xoá TRỰC TIẾP từng dòng tại
// /data/<field>/{id} thì:
//   - Không phụ thuộc ảnh chụp nào cả — xoá đúng ID nào, ID đó biến mất
//     khỏi Firebase ngay, chắc chắn 100%.
//   - Firebase phát sự kiện SSE đúng path /data/<field>/{id} tới MỌI
//     thiết bị khác đang mở app → nhận và cập nhật/xoá NGAY LẬP TỨC,
//     không cần đợi vòng poll hay lần lưu kế tiếp — đúng như tab Đơn
//     hoàn thành đang chạy.
// Các nhánh mảng khác (baoTri, lichLamViec, kyLuat, nghiPhep, workers,
// khuôn, check sheet, qrProducts) KHÔNG đổi — vẫn dùng mergeAndSaveArrField
// như cũ vì không có thao tác xoá hàng loạt tương tự.
// ════════════════════════════════════════════════════════════════════

// Ghi (PUT) hoặc xoá (DELETE, khi recordOrNull=null) ĐÚNG 1 dòng tại
// /data/<field>/{id}. Có thử lại tối đa vài lần nếu mạng chập chờn.
async function writeSlLogRecord(field, id, recordOrNull, maxRetry){
  maxRetry = maxRetry==null ? 3 : maxRetry;
  const path = '/data/'+field+'/'+id;
  for(let attempt=0; attempt<=maxRetry; attempt++){
    try{
      await fbWrite(path, recordOrNull===undefined?null:recordOrNull, recordOrNull?'PUT':'DELETE');
      return true;
    }catch(e){
      if(attempt>=maxRetry) throw e;
      await new Promise(res=>setTimeout(res, 500*(attempt+1)));
    }
  }
}

// So sánh trạng thái cục bộ hiện tại với "ảnh chụp lần đồng bộ gần nhất"
// (_lastSyncedArrSnap[field] — luôn được làm mới đúng lúc mỗi khi có cập
// nhật realtime, xem applyFieldChange/applySingleSlItemChange/applyDataSnapshot)
// để biết CHÍNH XÁC dòng nào vừa thêm/sửa (PUT) hay vừa xoá (DELETE),
// rồi gửi từng lệnh riêng lẻ — dùng chung cho thêm/sửa 1 dòng, xoá 1
// dòng, và xoá hàng loạt sau khi xuất Excel.
async function syncSlFieldPerRecord(field){
  if(!fbOk()) return;
  const localSnap = snapshotArrById(DB[field]);
  const lastSnap = _lastSyncedArrSnap[field] || {};
  const byId = {}; (DB[field]||[]).forEach(o=>{ if(o && o.id) byId[o.id]=o; });
  const changedIds = Object.keys(localSnap).filter(id=>localSnap[id]!==lastSnap[id]);
  const removedIds = Object.keys(lastSnap).filter(id=>!localSnap[id]);
  if(!changedIds.length && !removedIds.length) return;

  setSyncDot('saving'); markDirty(field); beginSave();
  let hasFailure = false;
  try{
    const ops = changedIds.map(id=>({id, val:byId[id]})).concat(removedIds.map(id=>({id, val:null})));
    const chunkSize = 15; // gửi theo lô nhỏ, tránh dội quá nhiều request cùng lúc khi xoá hàng loạt
    for(let i=0;i<ops.length;i+=chunkSize){
      const chunk = ops.slice(i, i+chunkSize);
      const results = await Promise.allSettled(chunk.map(op=>writeSlLogRecord(field, op.id, op.val)));
      results.forEach(r=>{ if(r.status==='rejected') hasFailure = true; });
    }
  }catch(e){ hasFailure = true; }

  if(!hasFailure){
    _lastSyncedArrSnap[field] = snapshotArrById(DB[field]);
    clearDirty(field); setSyncDot('ok');
  } else {
    // Giữ nguyên dấu "dirty" — lần mở app sau (initAndStartSync) sẽ tự
    // dùng mergeAndSaveArrField làm lưới an toàn đọc-lại-và-đối-chiếu để
    // đẩy nốt phần còn thiếu lên server, không mất dữ liệu.
    setSyncDot('error');
    showToast('⚠️ Một vài dòng chưa đồng bộ được lên máy chủ do lỗi mạng — sẽ tự thử lại khi mở app.', true);
  }
  endSave();
}

// Nhận cập nhật realtime cho ĐÚNG 1 dòng của 1 trong 3 sổ (SSE báo path
// /data/<field>/{id}) — áp thẳng vào DB[field] và làm mới ảnh chụp đồng
// bộ, y hệt applySingleOrderChange nhưng dùng chung cho cả 3 sổ.
function applySingleSlItemChange(field, id, val){
  if(_pendingSaves>0) return; // đang có lượt ghi cục bộ dở dang — để lượt đó tự lo, poll/lượt sau bù phần còn thiếu
  const arr = DB[field] || (DB[field]=[]);
  const idx = arr.findIndex(x=>x && x.id===id);
  if(val==null){ if(idx>=0) arr.splice(idx,1); }
  else { if(idx>=0) arr[idx]=val; else arr.push(val); }
  if(Object.prototype.hasOwnProperty.call(_lastSyncedArrSnap, field)) _lastSyncedArrSnap[field] = snapshotArrById(DB[field]);
  lsSave();
  if(currentTab==='soLieu') renderSoLieu();
}

// DI TRÚ DỮ LIỆU CŨ 1 LẦN: 3 sổ này trước đây lưu NGUYÊN 1 MẢNG tại
// /data/<field> (không tách theo id). Nếu vẫn ghi thẳng từng dòng vào
// /data/<field>/{id} trong khi nhánh gốc còn là mảng, dữ liệu sẽ lẫn lộn
// giữa index số (0,1,2...) và id chuỗi → hỏng cấu trúc. Vì vậy: phát
// hiện đúng 1 lần khi nhánh còn là mảng, chuyển hẳn sang dạng object
// theo id rồi ghi đè lại URL gốc — CHỈ đổi cấu trúc lưu trữ, không đổi
// nội dung dữ liệu. Sau lần này, mọi thao tác thêm/sửa/xoá đều dùng
// writeSlLogRecord ở trên; các lần load sau nhánh này sẽ luôn là object.
const _slMigratedField = {};
async function migrateSlLogIfArray(field, path, rawValue){
  if(!Array.isArray(rawValue) || !rawValue.length) return;
  if(_slMigratedField[field]) return;
  _slMigratedField[field] = true;
  try{
    const obj = {};
    rawValue.forEach(r=>{ if(r && r.id) obj[r.id]=r; });
    await fbWrite(path, obj, 'PUT');
  }catch(e){ _slMigratedField[field] = false; /* mạng lỗi — tự thử lại ở lần mở app sau */ }
}
// Check Sheet Thiết bị — lưu dữ liệu tick hàng ngày: Admin + Staff (giống
// chấm công), Viewer chỉ xem. Dùng cơ chế merge-theo-khoá y hệt Attendance
// để nhiều người cùng tick ở nhiều máy/thiết bị khác nhau không đè mất nhau.
// ── Sổ Nguyên liệu / Sổ Máy rút / Sổ Máy đánh bóng (tab 📊 Số liệu) ──────
// NÂNG CẤP: dùng cơ chế đồng bộ TỪNG DÒNG THEO ID (syncSlFieldPerRecord ở
// trên) — giống hệt tab Đơn hoàn thành — thay cho mergeAndSaveArrField
// (ghi đè nguyên cả mảng) như baoTri/lichLamViec ở trên.
function saveNguyenLieuLog(){if(guardViewer())return;
  lsSave();
  syncSlFieldPerRecord('nguyenLieuLog');
}
function saveMayRutLog(){if(guardViewer())return;
  lsSave();
  syncSlFieldPerRecord('mayRutLog');
}
function saveMayDanhBongLog(){if(guardViewer())return;
  lsSave();
  syncSlFieldPerRecord('mayDanhBongLog');
}
