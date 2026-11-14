// src/modules/hr/hr-link.js  — v2.8.0: LIÊN KẾT Quản lý nhân sự ↔ Lịch làm việc ↔ Chấm công
// NGUỒN DUY NHẤT = DB.workers (Danh sách nhân viên ở tab Quản lý nhân sự).
//  • Chấm công + Lịch làm việc theo ngày: đọc thẳng DB.workers (theo id) → luôn khớp, không nhập lại.
//  • Lịch làm việc theo bộ phận (DB.lichLamViec): mỗi dòng có thêm trường `wid` (id nhân viên). Hàm bên dưới tự
//    thêm dòng cho nhân viên mới, tự cập nhật tên/giới tính khi HR sửa, và (khi HR đổi) bỏ dòng của người đã nghỉ việc/bị xoá.
// AN TOÀN: không bao giờ tự bịa ca (dòng mới để trống = "Chưa phân ca"); không di chuyển dòng đã có; không chạy
// khi DB.workers còn rỗng (dữ liệu chưa tải về) để không xoá nhầm; tài khoản Xem không ghi.

function hrLinkNorm(s){ return String(s||'').trim().replace(/\s+/g,' ').toLowerCase(); }
// Tên bộ phận ở bảng lịch có thể ghi "Bộ phận Thanh Cái" trong khi hồ sơ ghi "Thanh Cái" → coi là cùng.
function hrLinkDeptKey(s){ return hrLinkNorm(s).replace(/^bộ\s*phận\s+/, ''); }
function hrLinkSlug(s){
  return hrLinkDeptKey(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'bp';
}
function hrLinkActive(w){ return !!(w && (w.trangThai||'Đang làm') !== 'Đã nghỉ việc'); }

// opts.prune = true: bỏ dòng của nhân viên đã nghỉ việc / đã xoá khỏi danh sách (chỉ gọi khi HR thay đổi).
// Trả về số thay đổi; tự lưu nếu có thay đổi.
function hrLinkSyncSchedule(opts){
  opts = opts || {};
  if(typeof isViewer === 'function' && isViewer()) return 0;
  const workers = Array.isArray(DB.workers) ? DB.workers : [];
  if(!workers.length) return 0;                                  // chưa tải xong dữ liệu → không đụng gì
  if(!Array.isArray(DB.lichLamViec)) DB.lichLamViec = [];
  const sheets = DB.lichLamViec, byId = {}; workers.forEach(w=>{ byId[w.id] = w; });
  let changed = 0;

  // 1) Gắn wid cho dòng cũ nhập tay nếu tên khớp DUY NHẤT 1 hồ sơ
  const nameCount = {}; workers.forEach(w=>{ const k = hrLinkNorm(w.name); if(k) nameCount[k] = (nameCount[k]||0) + 1; });
  const nameToW = {}; workers.forEach(w=>{ const k = hrLinkNorm(w.name); if(k && nameCount[k]===1) nameToW[k] = w; });
  const linked = {};                                             // wid → true (đã có dòng)
  sheets.forEach(s=>{
    if(!Array.isArray(s.rows)) s.rows = [];
    s.rows.forEach(r=>{
      if(!r.wid){ const w = nameToW[hrLinkNorm(r.name)]; if(w && !linked[w.id] ){ r.wid = w.id; changed++; } }
      if(r.wid) linked[r.wid] = linked[r.wid] || true;
    });
  });

  // 2) Cập nhật tên / giới tính theo hồ sơ; bỏ dòng trùng wid
  const seen = {};
  sheets.forEach(s=>{
    const keep = [];
    s.rows.forEach(r=>{
      if(r.wid){
        if(seen[r.wid]){ changed++; return; }                    // trùng → bỏ bản sau
        seen[r.wid] = true;
        const w = byId[r.wid];
        if(w){
          if(w.name && r.name !== w.name){ r.name = w.name; changed++; }
          if(w.gioiTinh && r.gender !== w.gioiTinh){ r.gender = w.gioiTinh; changed++; }
        }
      }
      keep.push(r);
    });
    s.rows = keep;
  });

  // 3) Thêm dòng cho nhân viên đang làm, có tên + bộ phận, mà chưa có dòng nào
  workers.forEach(w=>{
    if(!hrLinkActive(w) || !(w.name||'').trim() || !(w.boPhan||'').trim() || seen[w.id]) return;
    const key = hrLinkDeptKey(w.boPhan);
    let sheet = sheets.find(s=>hrLinkDeptKey(s.name) === key);
    if(!sheet){
      sheet = {id:'llv_auto_' + hrLinkSlug(w.boPhan), name:String(w.boPhan).trim(), period:'', warning:'', rows:[], attachments:[]};
      sheets.push(sheet); changed++;
    }
    sheet.rows.push({stt:sheet.rows.length+1, wid:w.id, name:w.name.trim(), gender:w.gioiTinh||'', time:'', leave:'', note:''});
    seen[w.id] = true; changed++;
  });

  // 4) (Khi HR thay đổi) bỏ dòng của người đã nghỉ việc hoặc đã bị xoá khỏi danh sách
  if(opts.prune){
    sheets.forEach(s=>{
      const before = s.rows.length;
      s.rows = s.rows.filter(r=>{ if(!r.wid) return true; const w = byId[r.wid]; return w && hrLinkActive(w); });
      changed += before - s.rows.length;
    });
  }

  if(changed){
    sheets.forEach(s=>s.rows.forEach((r,i)=>{ r.stt = i+1; }));
    if(typeof saveLichLamViec === 'function') saveLichLamViec();
  }
  return changed;
}

// Bộ phận của 1 dòng lịch: ưu tiên theo id nhân viên, không có thì dò theo tên (dòng nhập tay cũ)
function hrLinkDeptOfRow(r){
  if(r && r.wid){ const w = (DB.workers||[]).find(x=>x.id===r.wid); return w && w.boPhan ? String(w.boPhan).trim() : ''; }
  return (typeof llvWorkerDept === 'function') ? llvWorkerDept(r && r.name) : '';
}
// Số nhân viên đang làm nhưng CHƯA có bộ phận → chưa lên được lịch theo bộ phận (nhắc HR bổ sung)
function hrLinkNoDeptCount(){
  return (DB.workers||[]).filter(w=>hrLinkActive(w) && (w.name||'').trim() && !(w.boPhan||'').trim()).length;
}
