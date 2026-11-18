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
// Banner trên đầu tab Số liệu: CHỈ hiện khi còn thay đổi (ghi/xoá) CHƯA lên được máy chủ — để người dùng
// biết ngay vì sao dữ liệu còn nguyên trên thiết bị khác (thường do mất mạng) và bấm đồng bộ lại.
// (Tự xoá theo ngày đã tắt — xoá thủ công bởi Admin — nên không còn banner nhắc hạn như trước.)
function slRemindBannerHTML(){
  if(typeof slQueueAny!=='function' || !slQueueAny()) return '';
  let put=0, del=0; SL_FIELDS.forEach(f=>{ const e=slQueueLoad()[f]; put+=e.put.length; del+=e.del.length; });
  const parts = [];
  if(del) parts.push(`<b>${del}</b> dòng chờ xoá`);
  if(put) parts.push(`<b>${put}</b> dòng chờ lưu`);
  return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 12px;border-radius:10px;background:#FFF7ED;border:1px solid #FDBA74;margin-bottom:8px">
    <span style="flex:1;min-width:220px;font-size:12.5px;color:#9A3412;line-height:1.5">⏳ Còn ${parts.join(' và ')} chưa đồng bộ lên máy chủ (thường do mất mạng) — các thiết bị khác chỉ thấy thay đổi sau khi đồng bộ xong. Hệ thống tự thử lại khi có mạng.</span>
    <button class="khm-add-btn" style="background:#C2410C;flex:0 0 auto" onclick="slRetryPendingNow()">🔄 Đồng bộ ngay</button>
  </div>`;
}
async function slRetryPendingNow(){
  showToast('⏳ Đang đồng bộ...', false);
  let ok = false;
  try{ ok = await slFlushAll(); }catch(e){ ok = false; }
  if(ok){ showToast('✅ Đã đồng bộ xong lên máy chủ'); try{ await doPoll(); }catch(e){} }
  else showToast('⚠️ Chưa đồng bộ được — kiểm tra kết nối mạng rồi thử lại', true);
  if(currentTab==='soLieu') renderSoLieu();
}
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

// ════════════════════════════════════════════════════════════════════
// HÀNG ĐỢI BỀN (localStorage) — mọi lệnh GHI / XOÁ chưa lên được server
// ────────────────────────────────────────────────────────────────────
// LỖI GỐC (đã sửa): trước đây lệnh xoá chỉ được suy ra từ "ảnh chụp đồng bộ"
// trong RAM. Nếu lúc bấm xoá/xuất Excel mà mất mạng, hoặc app bị đóng trước
// khi ghi xong, thì lệnh xoá BIẾN MẤT (ảnh chụp rỗng ở lần mở app sau → "không
// có gì để xoá"), bản server cũ lại được tải về → dòng đã xoá "sống lại" trên
// máy này và vẫn còn trên các thiết bị khác.
// CÁCH SỬA: mỗi thay đổi được ghi vào hàng đợi lưu trong localStorage NGAY
// khi phát sinh (put = dòng thêm/sửa chưa lên server, del = dòng cần xoá trên
// server). Hàng đợi chỉ được xoá khỏi khi server xác nhận OK, nên dù mất mạng
// hay tắt app, lần mở sau vẫn tự thử lại cho tới khi xong.
// ════════════════════════════════════════════════════════════════════
const SL_FIELDS = ['nguyenLieuLog','mayRutLog','mayDanhBongLog'];
const SL_QUEUE_KEY = 'sx_sl_pending_v1';
let _slQueue = null;
function slQueueLoad(){
  if(_slQueue) return _slQueue;
  let q = null;
  try{ q = JSON.parse(localStorage.getItem(SL_QUEUE_KEY)||'null'); }catch(e){}
  if(!q || typeof q!=='object') q = {};
  SL_FIELDS.forEach(f=>{
    const e = q[f] || {};
    q[f] = {put: Array.isArray(e.put)?e.put:[], del: Array.isArray(e.del)?e.del:[]};
  });
  _slQueue = q; return q;
}
function slQueueSave(){ try{ localStorage.setItem(SL_QUEUE_KEY, JSON.stringify(_slQueue||{})); }catch(e){} }
function slQueueCount(field){ const e = slQueueLoad()[field]; return e ? e.put.length + e.del.length : 0; }
function slQueueAny(){ return SL_FIELDS.some(f=>slQueueCount(f)>0); }
function slQueuePut(field, ids){
  const e = slQueueLoad()[field]; const put = new Set(e.put), del = new Set(e.del);
  (ids||[]).forEach(id=>{ if(!id) return; put.add(id); del.delete(id); });
  e.put = [...put]; e.del = [...del]; slQueueSave();
}
function slQueueDel(field, ids){
  const e = slQueueLoad()[field]; const put = new Set(e.put), del = new Set(e.del);
  (ids||[]).forEach(id=>{ if(!id) return; del.add(id); put.delete(id); });
  e.put = [...put]; e.del = [...del]; slQueueSave();
}
function _slEndSaveQuiet(){ _pendingSaves = Math.max(0, _pendingSaves-1); } // như endSave() nhưng KHÔNG tự gọi doPoll (tránh vòng lặp khi mất mạng)

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

// Đẩy toàn bộ hàng đợi của 1 sổ lên server (xoá + ghi theo từng ID, lô nhỏ).
// Trả true nếu hàng đợi đã sạch. Dùng chung cho: lưu thường, xoá sau khi xuất
// Excel, mở lại app, có mạng trở lại, vòng poll.
const _slFlushing = {};
async function slFlushField(field){
  if(!fbOk()) return false;
  if(typeof navigator!=='undefined' && navigator.onLine===false) return false; // biết chắc đang offline → khỏi chờ thử lại
  if(_slFlushing[field]) return _slFlushing[field];
  const job = (async()=>{
    let ok = true;
    for(let pass=0; pass<3; pass++){
      const e = slQueueLoad()[field];
      if(!e.put.length && !e.del.length) break;
      const byId = {}; (DB[field]||[]).forEach(o=>{ if(o && o.id) byId[o.id]=o; });
      const ops = [];
      e.del.forEach(id=>ops.push({kind:'del', id}));
      e.put.forEach(id=>ops.push({kind:'put', id, row:byId[id]}));
      beginSave(); setSyncDot('saving');
      try{
        const chunkSize = 15; // lô nhỏ, tránh dội quá nhiều request cùng lúc khi xoá hàng loạt
        for(let i=0;i<ops.length;i+=chunkSize){
          const chunk = ops.slice(i, i+chunkSize);
          const results = await Promise.allSettled(chunk.map(op=>{
            if(op.kind==='put' && !op.row) return Promise.resolve('skip'); // dòng đã không còn ở máy → bỏ qua
            return writeSlLogRecord(field, op.id, op.kind==='del'?null:op.row);
          }));
          let okCount = 0;
          results.forEach((r,k)=>{
            const op = chunk[k];
            if(r.status==='fulfilled'){
              okCount++;
              const q = slQueueLoad()[field];
              if(op.kind==='del'){ q.del = q.del.filter(x=>x!==op.id); }
              else {
                // Chỉ gỡ khỏi hàng đợi nếu dòng KHÔNG bị sửa tiếp trong lúc đang gửi
                const cur = (DB[field]||[]).find(o=>o && o.id===op.id);
                if(!op.row || !cur || JSON.stringify(cur)===JSON.stringify(op.row)) q.put = q.put.filter(x=>x!==op.id);
              }
            } else ok = false;
          });
          slQueueSave();
          if(okCount===0){ ok = false; break; } // cả lô lỗi (mất mạng) → dừng sớm, đừng treo đồng bộ
        }
      }catch(err){ ok = false; }
      _slEndSaveQuiet();
      if(!ok) break;
    }
    const clean = slQueueCount(field)===0;
    if(clean){ clearDirty(field); setSyncDot('ok'); } else { markDirty(field); setSyncDot('error'); }
    return clean;
  })();
  _slFlushing[field] = job;
  try{ return await job; } finally { delete _slFlushing[field]; }
}
async function slFlushAll(){
  let ok = true;
  for(const f of SL_FIELDS){ if(slQueueCount(f)>0){ try{ if(!(await slFlushField(f))) ok = false; }catch(e){ ok = false; } } }
  return ok;
}

// So sánh trạng thái cục bộ với "ảnh chụp lần đồng bộ gần nhất" để biết dòng
// nào vừa thêm/sửa/xoá, GHI VÀO HÀNG ĐỢI BỀN trước (kể cả khi đang offline),
// rồi mới đẩy lên server. opts.removedIds: các ID PHẢI xoá trên server dù
// ảnh chụp có đúng hay không (dùng cho "Dọn dữ liệu sau khi xuất Excel").
async function syncSlFieldPerRecord(field, opts){
  opts = opts || {};
  const localSnap = snapshotArrById(DB[field]);
  const lastSnap = _lastSyncedArrSnap[field] || {};
  const changedIds = Object.keys(localSnap).filter(id=>localSnap[id]!==lastSnap[id]);
  const removedIds = Object.keys(lastSnap).filter(id=>!localSnap[id]);
  const forced = Array.isArray(opts.removedIds) ? opts.removedIds : [];
  slQueuePut(field, changedIds);
  slQueueDel(field, removedIds.concat(forced));
  _lastSyncedArrSnap[field] = localSnap; // từ đây hàng đợi bền là nguồn sự thật cho phần chưa lên server
  if(slQueueCount(field)===0) return true;
  markDirty(field);
  if(!fbOk()) return false;
  let ok = false;
  try{
    ok = await slFlushField(field);
    // Có thể đã có thay đổi mới chen vào hàng đợi đúng lúc lượt đẩy trước đang chạy → đẩy nốt
    if(slQueueCount(field)>0 && !_slFlushing[field]) ok = await slFlushField(field);
  }catch(e){ ok = false; }
  if(ok){
    setTimeout(()=>{ if(typeof currentUser!=='undefined' && currentUser && fbOk()) doPoll(); }, 500); // đối chiếu lại 1 lần cho chắc
  } else {
    showToast('⚠️ Một vài dòng chưa đồng bộ được lên máy chủ do lỗi mạng — sẽ tự thử lại khi có mạng / mở lại app.', true);
  }
  return ok;
}

// Chuẩn hoá giá trị server trả về cho 1 sổ + ÁP LẠI hàng đợi chưa lên server:
//  • bỏ các dòng đang chờ xoá (không cho "sống lại" do bản server cũ)
//  • giữ bản cục bộ của các dòng đang chờ ghi (không bị bản server cũ ghi đè)
// raw = null/undefined nghĩa là server KHÔNG còn dòng nào → trả mảng rỗng
// (trước đây trường hợp này bị bỏ qua nên các máy khác giữ mãi dữ liệu cũ).
function slApplyServerList(field, raw){
  const fresh = raw==null ? [] : (Array.isArray(raw) ? raw : Object.values(raw));
  const rows = fresh.filter(r=>r && typeof r==='object');
  const q = slQueueLoad()[field];
  if(!q || (!q.put.length && !q.del.length)) return rows;
  const delSet = new Set(q.del);
  const byId = new Map(); const noId = [];
  rows.forEach(r=>{ if(r.id){ if(!delSet.has(r.id)) byId.set(r.id, r); } else noId.push(r); });
  const local = {}; (DB[field]||[]).forEach(o=>{ if(o && o.id) local[o.id]=o; });
  q.put.forEach(id=>{ if(local[id]) byId.set(id, local[id]); });
  return [...byId.values(), ...noId];
}
// Áp bản đọc toàn bộ /data cho cả 3 sổ. Trả true nếu có sổ nào thay đổi.
function slApplySnapshotAll(data){
  let changed = false;
  SL_FIELDS.forEach(f=>{
    const list = slApplyServerList(f, data ? data[f] : null);
    if(JSON.stringify(list)!==JSON.stringify(DB[f]||[])){ DB[f] = list; changed = true; }
    _lastSyncedArrSnap[f] = snapshotArrById(DB[f]);
  });
  return changed;
}
// Danh sách ID đang có trên server (shallow — rất nhẹ, không tải nội dung dòng).
async function slServerIds(field){
  const r = await fetch(await fbAppendAuth(fbUrl()+'/data/'+field+'.json?shallow=true'), {cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  const v = await r.json();
  return v && typeof v==='object' ? Object.keys(v) : [];
}
// Kiểm tra lại trên server: các ID đã yêu cầu xoá còn sót không? Còn thì xoá lại.
// Trả số ID vẫn còn sau khi thử lại (0 = sạch hoàn toàn); null nếu không kiểm tra được.
async function slVerifyDeleted(field, ids){
  try{
    const idSet = new Set(ids||[]);
    for(let round=0; round<2; round++){
      const left = (await slServerIds(field)).filter(id=>idSet.has(id));
      if(!left.length) return 0;
      if(round===1) return left.length;
      slQueueDel(field, left);
      await slFlushField(field);
    }
  }catch(e){ return null; }
  return null;
}
// Làm mới 1 sổ từ server (dùng TRƯỚC khi xuất Excel để file luôn đầy đủ,
// không phụ thuộc bản cục bộ có thể còn thiếu dòng do thiết bị khác vừa ghi).
async function slRefreshFromServer(tab){
  const field = SL_META[tab].field;
  if(!fbOk()) return {ok:false, reason:'Chế độ offline'};
  try{
    for(let i=0; i<10 && _pendingSaves>0; i++) await new Promise(r=>setTimeout(r,300)); // chờ lượt ghi đang dở
    if(slQueueCount(field)>0) await slFlushField(field);                                 // đẩy phần chưa lên trước
    const raw = await fbRead('/data/'+field);
    const list = slApplyServerList(field, raw);
    DB[field] = list; _lastSyncedArrSnap[field] = snapshotArrById(list);
    lsSave();
    return {ok:true};
  }catch(e){ return {ok:false, reason:String(e&&e.message||e)}; }
}

// Nhận cập nhật realtime cho ĐÚNG 1 dòng của 1 trong 3 sổ (SSE báo path
// /data/<field>/{id}) — áp thẳng vào DB[field] và làm mới ảnh chụp đồng bộ.
function applySingleSlItemChange(field, id, val){
  if(_pendingSaves>0) return; // đang có lượt ghi cục bộ dở dang — bản đọc đầy đủ ở endSave()/poll sẽ bù
  const q = slQueueLoad()[field];
  if(val!=null && q.del.indexOf(id)>=0) return; // dòng đang chờ xoá trên server → không cho "sống lại"
  if(q.put.indexOf(id)>=0) return;              // bản cục bộ mới hơn đang chờ đẩy lên → không ghi đè
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
function saveNguyenLieuLog(opts){if(guardViewer())return;
  lsSave();
  return syncSlFieldPerRecord('nguyenLieuLog', opts);
}
function saveMayRutLog(opts){if(guardViewer())return;
  lsSave();
  return syncSlFieldPerRecord('mayRutLog', opts);
}
function saveMayDanhBongLog(opts){if(guardViewer())return;
  lsSave();
  return syncSlFieldPerRecord('mayDanhBongLog', opts);
}
