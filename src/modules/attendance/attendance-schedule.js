// src/modules/attendance/attendance-schedule.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────



// ════════════════════════════════════════════════════════════
// LỊCH LÀM VIỆC (Nhân sự)
// ════════════════════════════════════════════════════════════
let _llvActive = null;

// Nhận diện ca làm việc từ chuỗi thời gian tự do (vd: "Ca 1 : 6h – 14h")
function llvShiftKey(t){
  t = (t||'').toLowerCase();
  if(/nghỉ/.test(t)) return 'nghi';
  if(/tăng\s*ca/.test(t)) return 'tangca';
  if(/ca\s*1/.test(t)) return 'ca1';
  if(/ca\s*2/.test(t)) return 'ca2';
  if(/ca\s*3/.test(t)) return 'ca3';
  if(/hc|hành\s*chính/.test(t)) return 'hc';
  return 'khac';
}
const LLV_SHIFT_META = {
  ca1:{label:'☀️ CA 1', color:'#1d4ed8', bg:'#eff6ff'},
  ca2:{label:'🌙 CA 2', color:'#b45309', bg:'#fffbeb'},
  ca3:{label:'🌑 CA 3', color:'#6d28d9', bg:'#f5f3ff'},
  hc:{label:'🏢 HÀNH CHÍNH', color:'#047857', bg:'#ecfdf5'},
  tangca:{label:'⏱️ TĂNG CA', color:'#c2410c', bg:'#fff7ed'},
  nghi:{label:'🏖️ NGHỈ (không xếp ca)', color:'#0e7490', bg:'#ecfeff'},
  khac:{label:'❓ CHƯA PHÂN CA', color:'#6b7280', bg:'#f3f4f6'}
};
const LLV_SHIFT_ORDER = ['ca1','ca2','ca3','hc','tangca','nghi','khac'];
const LLV_TIME_PRESETS = ['Ca 1 : 6h – 14h','Ca 2 : 14h – 22h','Ca 3 : 22h – 6h','HC : 7h – 17h','Tăng ca : 6h – 17h','Nghỉ ( không xếp ca)'];

// ── Dò ngày áp dụng (Từ ngày → Đến ngày) của 1 lịch làm việc, dựa vào ô nhập tay
// "📅 Thời gian áp dụng" (sheet.period), ví dụ: "23/7 - 24/7", "23-24/7/2026",
// "Từ 23/7 đến 24/7", "23/07/2026 - 24/07/2026"... Trả về {from,to} dạng
// 'YYYY-MM-DD', hoặc null nếu không dò được ngày nào trong chuỗi.
function llvNormYear(y){ y=+y; return y<100 ? 2000+y : y; }
function llvMkDateStr(y,mo,d){
  if(!(mo>=1&&mo<=12&&d>=1&&d<=31)) return null;
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function llvParseOneDateTok(tok, defYear){
  const mm = tok.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
  if(!mm) return null;
  const d=+mm[1], mo=+mm[2], y = mm[3]?llvNormYear(mm[3]):defYear;
  return llvMkDateStr(y,mo,d);
}


// ── Tự động dò đơn nghỉ phép đã duyệt đang hiệu lực NGAY HÔM NAY cho 1 nhân
// viên. Khớp theo tên (không phân biệt hoa/thường) với DB.nghiPhep.
// Chỉ tính đơn có trạng thái "Đã duyệt" và HÔM NAY nằm trong khoảng Từ
// ngày→Đến ngày của đơn. Luôn so với ngày hiện tại (không phải khoảng ngày
// áp dụng của cả lịch làm việc) — nhờ vậy khi đơn nghỉ hết hiệu lực (VD nghỉ
// từ 23 đến hết 26/7) thì sang ngày 27/7 badge "🏖️ Tình trạng nghỉ" sẽ TỰ
// ĐỘNG biến mất, không cần sửa tay.
// Nhân viên vẫn được giữ nguyên ở ca đã phân (không bị chuyển sang nhóm "Nghỉ").
function llvActiveLeave(name, list, sheet){
  const nm = (name||'').trim().toLowerCase();
  if(!nm) return null;
  const src = list || DB.nghiPhep || [];
  const today = todayStr();
  const hit = src.find(k => k.status==='Đã duyệt' && (k.workerName||'').trim().toLowerCase()===nm && (k.fromDate||'')<=today && today<=(k.toDate||''));
  return hit || null;
}
function llvLeaveBadgeHtml(rec){
  if(!rec) return '';
  const esc = v=>(v||'').toString().replace(/</g,'&lt;');
  const till = rec.toDate ? ` · đến ${fmtDate(rec.toDate)}` : '';
  return `<span title="${esc(rec.lydo||'')}" style="display:inline-block;padding:2px 8px;border-radius:10px;background:#cffafe;color:#0e7490;font-weight:700;font-size:11px;white-space:nowrap">🏖️ ${esc(rec.loai||'Đang nghỉ')}${till}</span>`;
}

// [GĐ1 v2.6.0] VÔ HIỆU HOÁ: hàm này tự nạp sẵn danh sách tên nhân viên cố định vào Lịch làm việc khi mảng đang
// rỗng (kể cả lúc dữ liệu Firebase chưa kịp tải về). Dữ liệu đó có thể bị ghi lên Firebase ở lần lưu kế tiếp
// và đè/lẫn với dữ liệu thật — trái nguyên tắc "không tạo dữ liệu nhân viên giả". Lịch rỗng nay hiển thị
// trạng thái trống để Admin tự tạo. (Dữ liệu mẫu cũ giữ lại bên dưới, không còn được gọi.)
function llvSeedIfEmpty(){
  return;
  if(DB.lichLamViec && DB.lichLamViec.length) return;
  const ca1 = [
    ['Lò Văn Mạnh','Nam'],['Hà Văn Tú','Nam'],['Lò Thanh Tú','Nam'],['Hà Quốc Bình','Nam'],['Ngần Văn Lai','Nam'],
    ['Thăng Văn Sơn','Nam'],['Hà Văn Đoàn','Nam'],['Hà Văn Thắng','Nam'],['Lò Minh Đức','Nam'],['Hà Văn Bảo','Nam'],
    ['Tòng Văn Nghìn','Nam'],['Vì Văn Nhã','Nam'],['Nguyễn Văn Đức','Nam'],['Phan Đạo Doãn','Nam'],['Trần Văn Thưởng','Nam'],
    ['Trần Văn Khang','Nam'],['Lường Văn Tú','Nam'],['Lê Văn Kỳ','Nam'],['Lê Minh Hùng','Nam'],['Lù Minh Quyết','Nam'],
    ['Bàn Thị Khoa','Nữ'],['Lò Thị Phương','Nữ'],['Lèo Văn Chẩn','Nam'],['Quàng Thị Thỏa','Nữ'],['Lò Thị Sim','Nữ']
  ];
  const ca2 = [
    ['Nguyễn Văn Duy','Nam'],['Ngần Văn Hiệp','Nam'],['Hà Văn Hùng','Nam'],['Khà Văn Hoài','Nam'],['Lò Văn Thức','Nam'],
    ['Nguyễn Đức Thủy','Nam'],['Ngần Văn Hải','Nam'],['Khà Đức Duy','Nam'],['Nguyễn Minh Chính','Nam'],['Vì Văn Tuấn','Nam'],
    ['Lương Văn Tình','Nam'],['Lục Văn Nghiềm','Nam'],['Nguyễn Văn Tuấn','Nam'],['Nông Thị Sắm','Nữ'],['Lô Văn Tài','Nam'],
    ['Lương Thị Linh','Nữ'],['Quàng Văn Phú','Nam'],['Cầm Bá Mạnh','Nam'],['Lương Văn Tuấn','Nam'],['Lò Thị Hiên','Nữ'],
    ['Lường Văn Tú','Nam'],['Triệu Ngọc Siêu','Nam'],['Nguyên Văn Tuấn','Nam'],['Chu Văn May','Nam'],['Trương Thanh Lợi','Nam']
  ];
  const rows = [];
  ca1.forEach(([n,g])=>rows.push({name:n,gender:g,time:'Ca 1 : 6h – 14h',leave:'',note:''}));
  ca2.forEach(([n,g])=>rows.push({name:n,gender:g,time:'Ca 2 : 14h – 22h',leave:'',note:''}));
  DB.lichLamViec = [{
    id:'llv_thanhcai',
    name:'Bộ phận Thanh Cái',
    period:'07/07 đến hết ngày 12/07/2026',
    warning:'Lịch có thể thay đổi đột xuất – Anh em nhớ xem thông báo thường xuyên!',
    rows,
    attachments:[]
  }];
}

// Nhóm các dòng theo ca dựa theo cột "Thời gian" (r.time). Tình trạng nghỉ phép
// (đơn đã duyệt, đang hiệu lực hôm nay) chỉ hiển thị dưới dạng badge ở cột
// "🏖️ Tình trạng nghỉ", KHÔNG làm thay đổi nhóm ca hiển thị — nhân viên vẫn được
// xếp đúng vào nhóm ca theo thời gian đã phân (Ca 1/Ca 2/Ca 3/HC/Tăng ca...).
function llvGroupRows(rows){
  const groups = {};
  rows.forEach((r,i)=>{ const k = llvShiftKey(r.time); (groups[k]=groups[k]||[]).push({r,i}); });
  return LLV_SHIFT_ORDER.filter(k=>groups[k] && groups[k].length).map(k=>({key:k, meta:LLV_SHIFT_META[k], items:groups[k]}));
}

// Nhãn CA rút gọn (không icon) — dùng để in kèm tên từng người, ví dụ "Ca 2",
// khác với LLV_SHIFT_META.label (bản đầy đủ có icon, dùng cho tiêu đề nhóm).
const LLV_SHIFT_SHORT = { ca1:'Ca 1', ca2:'Ca 2', ca3:'Ca 3', hc:'HC', tangca:'Tăng ca', nghi:'Nghỉ', khac:'Chưa phân ca' };

// ── Dò BỘ PHẬN của 1 nhân viên, lấy TRỰC TIẾP từ DB.workers (mục "Danh sách
// NV" ở tab Quản lý nhân sự — w.boPhan), khớp theo TÊN (không phân biệt
// hoa/thường, bỏ khoảng trắng thừa). Không tự suy diễn — nếu không tìm thấy
// hồ sơ nhân viên khớp tên thì trả về '' (không hiển thị).
function llvWorkerDept(name, list){
  const nm = (name||'').trim().toLowerCase();
  if(!nm) return '';
  const src = list || DB.workers || [];
  const w = src.find(x=>(x.name||'').trim().toLowerCase()===nm);
  return w && w.boPhan ? w.boPhan.toString().trim() : '';
}

// ── Badge màu cho cột "Bộ phận" trong Lịch làm việc — mỗi tên bộ phận được
// gán 1 màu cố định (hash theo tên) để dễ phân biệt trực quan giữa các
// bộ phận khác nhau trong cùng 1 bảng. escFn cho phép dùng chung cho cả bản
// quản trị (escape &lt;) lẫn trang công khai (pubEsc).
const LLV_DEPT_PALETTE = [
  ['#eef2ff','#4338ca'], ['#ecfeff','#0e7490'], ['#f0fdf4','#15803d'],
  ['#fff7ed','#c2410c'], ['#fdf4ff','#a21caf'], ['#fef2f2','#b91c1c'],
  ['#f0f9ff','#0369a1'], ['#fefce8','#a16207']
];
function llvDeptBadgeHtml(dept, escFn){
  const esc = escFn || (v=>(v||'').toString().replace(/</g,'&lt;'));
  if(!dept) return '<span style="color:var(--text4);font-size:11px">—</span>';
  let hash = 0;
  for(let i=0;i<dept.length;i++) hash = (hash*31 + dept.charCodeAt(i)) >>> 0;
  const [bg,fg] = LLV_DEPT_PALETTE[hash % LLV_DEPT_PALETTE.length];
  return `<span style="display:inline-block;padding:3px 9px;border-radius:8px;background:${bg};color:${fg};font-weight:700;font-size:11px;white-space:nowrap">${esc(dept)}</span>`;
}

function llvAttIcon(type, name){
  const ext = (name||'').split('.').pop().toLowerCase();
  if((type||'').startsWith('image/')) return '🖼️';
  if(ext==='pdf') return '📕';
  if(ext==='doc'||ext==='docx') return '📄';
  if(ext==='xls'||ext==='xlsx') return '📊';
  return '📎';
}
function llvFormatBytes(bytes){
  if(bytes==null) return '';
  if(bytes<1024) return bytes+' B';
  if(bytes<1024*1024) return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1024/1024).toFixed(1)+' MB';
}

// [GĐ2 v2.7.0] Hàm vẽ bảng theo bộ phận GỐC được đổi tên (nội dung KHÔNG đổi). renderLichLamViec() nay nằm ở
// schedule-view.js: thêm thanh chọn chế độ (Theo bộ phận / Ngày / Tuần / Tháng / Ca làm việc) rồi gọi lại hàm này.
function llvRenderSheets(){
  llvSeedIfEmpty();
  try{ if(typeof hrLinkSyncSchedule === 'function') hrLinkSyncSchedule(); }catch(e){ console.error('hrLinkSync', e); }
  const admin = isAdmin();
  const list = DB.lichLamViec||[];
  if(!_llvActive || !list.find(s=>s.id===_llvActive)) _llvActive = list.length?list[0].id:null;
  const sheet = list.find(s=>s.id===_llvActive);
  const groups = sheet ? llvGroupRows(sheet.rows||[]) : [];
  const shiftCountsTxt = groups.map(g=>`${g.meta.label.replace(/^\S+\s/,'')}: ${g.items.length}`).join(' · ');

  $('mc').innerHTML = `
    <div class="card" style="padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${list.map(s=>`<button class="chip${s.id===_llvActive?' active':''}" onclick="llvSelect('${s.id}')">${(s.name||'Bộ phận').replace(/</g,'&lt;')}</button>`).join('')}
        ${admin?`<button class="chip" onclick="llvAddSheet()">➕ Thêm bộ phận</button>`:''}
      </div>
    </div>
    ${sheet?`
    <div class="card" style="padding:12px 14px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">🔗 Danh sách nhân viên <b>tự đồng bộ từ Quản lý nhân sự</b> (theo Bộ phận) — ở đây chỉ chọn ca${(typeof hrLinkNoDeptCount==='function'&&hrLinkNoDeptCount())?` · <span style="color:#b45309">⚠️ ${hrLinkNoDeptCount()} nhân viên chưa có Bộ phận nên chưa lên lịch</span>`:''}.</div>
      ${admin?`<div id="llvMetaAdmin">
      <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Tên bộ phận</label>
      <input class="field-inp" value="${(sheet.name||'').replace(/"/g,'&quot;')}" ${admin?'':'readonly'} onchange="llvSetMeta('${sheet.id}','name',this.value)" style="margin:4px 0 10px">
      <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">📅 Thời gian áp dụng</label>
      <input class="field-inp" value="${(sheet.period||'').replace(/"/g,'&quot;')}" ${admin?'':'readonly'} onchange="llvSetMeta('${sheet.id}','period',this.value)" style="margin:4px 0 10px">
      <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">⚠️ Ghi chú / cảnh báo chung</label>
      <input class="field-inp" value="${(sheet.warning||'').replace(/"/g,'&quot;')}" ${admin?'':'readonly'} onchange="llvSetMeta('${sheet.id}','warning',this.value)" style="margin:4px 0 0">
      </div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:${admin?12:0}px">
        ${admin?`<button class="set-btn" style="width:auto;padding:9px 16px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700" onclick="llvAddRow('${sheet.id}')">➕ Thêm nhân viên</button>`:''}
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="llvPrint('${sheet.id}','A4')">🖨️ In A4</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="llvPrint('${sheet.id}','A3')">🖨️ In A3</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="llvCapture('${sheet.id}')">📷 Chụp ảnh gửi nhóm</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="llvExportExcel('${sheet.id}')">⬇️ Xuất Excel</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700" onclick="openCcllvQrModal()">🏷 Tạo mã QR xem Chấm công &amp; Lịch làm việc</button>
        ${admin?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;color:var(--red-m)" onclick="llvDeleteSheet('${sheet.id}')">🗑 Xóa bộ phận này</button>`:''}
      </div>
    </div>
    <div class="card" style="padding:8px;overflow-x:auto;margin-top:0">
      <div id="llvCaptureArea_${sheet.id}" style="background:#fff;padding:6px">
      <div style="text-align:center;font-weight:700;font-size:14px;margin-bottom:4px;text-transform:uppercase">Lịch làm việc bộ phận ${(sheet.name||'').replace(/</g,'&lt;')}</div>
      ${sheet.period?`<div style="text-align:center;font-size:12px;margin-bottom:2px">📅 ${(sheet.period||'').replace(/</g,'&lt;')}</div>`:''}
      ${sheet.warning?`<div style="text-align:center;font-size:11.5px;margin-bottom:8px;color:#b45309">⚠️ ${(sheet.warning||'').replace(/</g,'&lt;')}</div>`:''}
      ${groups.length?`<div style="text-align:center;font-size:11.5px;margin-bottom:8px;color:var(--text3)">${groups.map(g=>`<span style="display:inline-block;margin:0 6px;padding:2px 8px;border-radius:10px;background:${g.meta.bg};color:${g.meta.color};font-weight:700">${g.meta.label} · ${g.items.length} người</span>`).join('')}</div>`:''}
      <table id="llvTable_${sheet.id}" style="border-collapse:collapse;font-size:12px;width:100%;min-width:640px">
        <thead>
          <tr>
            <th style="border:1px solid var(--border);padding:6px;min-width:36px">STT</th>
            <th style="border:1px solid var(--border);padding:6px;min-width:150px;text-align:left">Họ và tên</th>
            <th style="border:1px solid var(--border);padding:6px;min-width:80px">Giới tính</th>
            <th style="border:1px solid var(--border);padding:6px;min-width:110px">🏭 Bộ phận</th>
            <th style="border:1px solid var(--border);padding:6px;min-width:150px">Thời gian</th>
            <th style="border:1px solid var(--border);padding:6px;min-width:140px">🏖️ Tình trạng nghỉ</th>
            <th style="border:1px solid var(--border);padding:6px;min-width:120px">Ghi chú</th>
            ${admin?'<th style="border:1px solid var(--border);padding:6px;min-width:30px"></th>':''}
          </tr>
        </thead>
        <tbody>
          ${groups.map(g=>`
            <tr>
              <td colspan="${admin?8:7}" style="border:1px solid var(--border);padding:7px 10px;background:${g.meta.bg};color:${g.meta.color};font-weight:700;font-size:12.5px;text-align:left">
                ${g.meta.label} <span style="font-weight:500;opacity:.8">— ${g.items.length} người</span>
              </td>
            </tr>
            ${g.items.map(({r,i},gi)=>{
              const leaveRec = llvActiveLeave(r.name, null, sheet);
              return `<tr>
              <td style="border:1px solid var(--border);padding:4px;text-align:center">${gi+1}</td>
              <td style="border:1px solid var(--border);padding:2px">
                <input value="${(r.name||'').replace(/"/g,'&quot;')}" placeholder="Họ và tên" ${(admin&&!r.wid)?'':'readonly'} ${r.wid?'title="🔗 Lấy từ Quản lý nhân sự — sửa tên ở đó"':''} onchange="llvSetCell('${sheet.id}',${i},'name',this.value)" style="width:100%;border:none;background:transparent;font-size:12px;font-family:inherit;padding:4px;outline:none;color:var(--text)">
              </td>
              <td style="border:1px solid var(--border);padding:2px">
                <input value="${(r.gender||'').replace(/"/g,'&quot;')}" placeholder="Nam/Nữ" ${(admin&&!r.wid)?'':'readonly'} onchange="llvSetCell('${sheet.id}',${i},'gender',this.value)" style="width:100%;border:none;background:transparent;font-size:12px;font-family:inherit;padding:4px;outline:none;color:var(--text);text-align:center">
              </td>
              <td style="border:1px solid var(--border);padding:4px;text-align:center">
                ${llvDeptBadgeHtml(typeof hrLinkDeptOfRow==='function'?hrLinkDeptOfRow(r):llvWorkerDept(r.name))}
              </td>
              <td style="border:1px solid var(--border);padding:2px">
                <select ${admin?'':'disabled'} onchange="llvSetCell2('${sheet.id}',${i},'time',this.value)" style="width:100%;border:none;background:transparent;font-size:12px;font-family:inherit;padding:4px;outline:none;color:var(--text);cursor:${admin?'pointer':'default'};-webkit-appearance:menulist">
                  <option value=""${!r.time?' selected':''}>-- Chọn ca --</option>
                  ${LLV_TIME_PRESETS.map(p=>`<option value="${p}"${r.time===p?' selected':''}>${p}</option>`).join('')}
                  ${r.time && !LLV_TIME_PRESETS.includes(r.time)?`<option value="${(r.time||'').replace(/"/g,'&quot;')}" selected>${(r.time||'').replace(/</g,'&lt;')}</option>`:''}
                </select>
              </td>
              <td style="border:1px solid var(--border);padding:2px;text-align:center">
                ${leaveRec ? llvLeaveBadgeHtml(leaveRec) : `<input value="${(r.leave||'').replace(/"/g,'&quot;')}" placeholder="Không nghỉ" title="Ghi chú nghỉ đột xuất (không có đơn xin nghỉ chính thức)" ${admin?'':'readonly'} onchange="llvSetCell('${sheet.id}',${i},'leave',this.value)" style="width:100%;border:none;background:transparent;font-size:11.5px;font-family:inherit;padding:4px;outline:none;color:var(--amber-m,#b45309);text-align:center">`}
              </td>
              <td style="border:1px solid var(--border);padding:2px">
                <input value="${(r.note||'').replace(/"/g,'&quot;')}" placeholder="" ${admin?'':'readonly'} onchange="llvSetCell('${sheet.id}',${i},'note',this.value)" style="width:100%;border:none;background:transparent;font-size:12px;font-family:inherit;padding:4px;outline:none;color:var(--text3)">
              </td>
              ${admin?`<td style="border:1px solid var(--border);padding:2px;text-align:center"><button class="icon-btn del" onclick="llvDeleteRow('${sheet.id}',${i})" style="font-size:12px"${r.wid?' title="Nhân viên lấy từ Quản lý nhân sự — xoá/cho nghỉ việc ở đó"':''}>${r.wid?'🔗':'🗑'}</button></td>`:''}
            </tr>`;}).join('')}
          `).join('')}
          ${sheet.rows.length===0?`<tr><td colspan="${admin?8:7}" style="padding:16px;text-align:center;color:var(--text4);border:1px solid var(--border)">Chưa có nhân viên nào trong lịch${admin?' · bấm "➕ Thêm nhân viên" để bắt đầu':''}</td></tr>`:''}
        </tbody>
      </table>
      </div>
    </div>
    <div class="card" style="padding:12px 14px;margin-top:8px;font-size:12px;color:var(--text3)">
      <b>Tổng số nhân viên:</b> ${sheet.rows.length}${shiftCountsTxt?` <span style="color:var(--text4)">(${shiftCountsTxt})</span>`:''}
      ${(()=>{ const nghiCount = (sheet.rows||[]).filter(r=>llvActiveLeave(r.name, null, sheet)).length; return nghiCount>0?` <span style="color:#0e7490;font-weight:700">· 🏖️ ${nghiCount} người đang nghỉ theo đơn đã duyệt</span>`:''; })()}
    </div>
    `:`<div class="card" style="padding:24px;text-align:center;color:var(--text4)">Chưa có lịch làm việc nào${admin?' · bấm "➕ Thêm bộ phận" để tạo lịch đầu tiên':''}</div>`}
  `;
}

function llvSelect(id){ _llvActive = id; renderLichLamViec(); }

function llvAddSheet(){if(guardViewer())return;
  const id = 'llv_'+uid();
  DB.lichLamViec.push({id, name:'Bộ phận mới', period:'', warning:'', rows:[], attachments:[]});
  _llvActive = id;
  saveLichLamViec();
  log('Thêm lịch làm việc', 'Đã tạo lịch làm việc cho 1 bộ phận mới', '', null, {sheetId:id});
  renderLichLamViec();
}

function llvSetMeta(sheetId, field, value){if(guardViewer())return; if(!isAdmin()){ showToast('🔒 Chỉ Admin được sửa Tên bộ phận / Thời gian áp dụng / Ghi chú chung', true); return; }
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const old = s[field];
  value = (value||'').trim();
  if(old===value) return;
  s[field] = value;
  saveLichLamViec();
  log('Sửa lịch làm việc', `${s.name||'(bộ phận)'} · cập nhật ${field}`, '', {[field]:old}, {[field]:value});
}

function llvDeleteSheet(sheetId){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  confirm2('Xóa bộ phận', `Xóa toàn bộ lịch làm việc của "${s.name||'bộ phận này'}"? Hành động này không thể hoàn tác.`, ()=>{
    DB.lichLamViec = DB.lichLamViec.filter(x=>x.id!==sheetId);
    _llvActive = null;
    saveLichLamViec();
    log('Xóa lịch làm việc', `${s.name||'(bộ phận)'}`, '', {sheetId,name:s.name}, null);
    renderLichLamViec();
    showToast('Đã xóa');
  });
}

function llvAddRow(sheetId){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  s.rows.push({stt:s.rows.length+1,name:'',gender:'',time:'',leave:'',note:''});
  saveLichLamViec();
  log('Thêm nhân viên vào lịch', `${s.name||'(bộ phận)'} · thêm 1 dòng mới`, '', null, null);
  renderLichLamViec();
}

function llvSetCell(sheetId, idx, field, value){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const row = s.rows[idx]; if(!row) return;
  row[field] = value;
  saveLichLamViec();
}

// Giống llvSetCell nhưng dựng lại bảng — dùng cho ô "Thời gian" vì thay đổi ca sẽ đổi nhóm hiển thị
function llvSetCell2(sheetId, idx, field, value){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const row = s.rows[idx]; if(!row) return;
  row[field] = value;
  saveLichLamViec();
  renderLichLamViec();
}

function llvDeleteRow(sheetId, idx){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const row = s.rows[idx]; if(!row) return;
  if(row.wid){ showToast('🔗 Nhân viên này lấy từ Quản lý nhân sự — muốn bỏ khỏi lịch hãy chuyển "Đã nghỉ việc" hoặc xoá ở tab Quản lý nhân sự', true); return; }
  confirm2('Xóa khỏi lịch', `Xóa "${row.name||'(chưa có tên)'}" khỏi lịch làm việc?`, ()=>{
    s.rows.splice(idx,1);
    saveLichLamViec();
    renderLichLamViec();
    showToast('Đã xóa');
  });
}

// ── Đính kèm tệp cho lịch làm việc ─────────────────────────
function llvUploadAttachment(sheetId, inputEl){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const files = Array.from(inputEl.files||[]); if(!files.length) return;
  if(!s.attachments) s.attachments=[];
  const MAX_BYTES = 3*1024*1024; // 3MB mỗi tệp để tránh phình dữ liệu đồng bộ
  let remaining = files.length;
  const done = ()=>{
    remaining--;
    if(remaining<=0){
      saveLichLamViec();
      log('Đính kèm tệp lịch làm việc', `${s.name||'(bộ phận)'} · thêm tệp đính kèm`, '', null, null);
      renderLichLamViec();
      showToast('✅ Đã thêm tệp đính kèm');
      inputEl.value='';
    }
  };
  files.forEach(file=>{
    if(file.size > MAX_BYTES){
      showToast(`❌ "${file.name}" quá lớn (tối đa 3MB/tệp)`, true);
      done();
      return;
    }
    const push = (dataUrl)=>{
      s.attachments.push({id:'att_'+uid(), name:file.name, type:file.type||'', size:file.size, dataUrl, uploadedAt:Date.now(), uploadedBy: currentUser?.name||'?'});
      done();
    };
    if(file.type && file.type.startsWith('image/')){
      const reader = new FileReader();
      reader.onload = ()=>{
        const img = new Image();
        img.onload = ()=>{
          const canvas = document.createElement('canvas');
          const maxW = 1000; const scale = Math.min(1, maxW/img.width);
          canvas.width = Math.round(img.width*scale); canvas.height = Math.round(img.height*scale);
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          push(canvas.toDataURL('image/jpeg',0.82));
        };
        img.onerror = ()=>push(reader.result);
        img.src = reader.result;
      };
      reader.onerror = done;
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = ()=>push(reader.result);
      reader.onerror = done;
      reader.readAsDataURL(file);
    }
  });
}

function llvOpenAttachment(sheetId, attId){
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const a = (s.attachments||[]).find(x=>x.id===attId); if(!a) return;
  const isImg = (a.type||'').startsWith('image/');
  const isPdf = a.type==='application/pdf' || (a.name||'').toLowerCase().endsWith('.pdf');
  if(isImg || isPdf){
    const w = window.open('');
    if(!w){ showToast('❌ Trình duyệt chặn cửa sổ popup, vui lòng cho phép popup', true); return; }
    const body = isImg
      ? `<img src="${a.dataUrl}" style="max-width:100%;display:block;margin:auto">`
      : `<iframe src="${a.dataUrl}" style="width:100%;height:100vh;border:none"></iframe>`;
    w.document.write(`<title>${(a.name||'Đính kèm').replace(/</g,'&lt;')}</title><body style="margin:0;background:#222">${body}</body>`);
  } else {
    const link = document.createElement('a');
    link.href = a.dataUrl; link.download = a.name || 'tep-dinh-kem';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }
}

function llvDeleteAttachment(sheetId, attId){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const a = (s.attachments||[]).find(x=>x.id===attId); if(!a) return;
  confirm2('Xóa tệp đính kèm', `Xóa "${a.name||'tệp'}" khỏi lịch làm việc?`, ()=>{
    s.attachments = s.attachments.filter(x=>x.id!==attId);
    saveLichLamViec();
    renderLichLamViec();
    showToast('Đã xóa tệp đính kèm');
  });
}

function llvExportExcel(sheetId){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const fname = (s.name||'bo_phan').replace(/\s+/g,'_');
  const groups = llvGroupRows(s.rows||[]);
  const rows = [];
  const sectionRowIdxs = [];
  rows.push([`LỊCH LÀM VIỆC BỘ PHẬN ${(s.name||'').toUpperCase()}`]);
  if(s.period) rows.push([`Ngày/tháng: ${s.period}`]);
  if(s.warning) rows.push([s.warning]);
  rows.push([]);
  rows.push(['STT','HỌ VÀ TÊN','GIỚI TÍNH','BỘ PHẬN','THỜI GIAN','TÌNH TRẠNG NGHỈ','GHI CHÚ']);
  groups.forEach(g=>{
    sectionRowIdxs.push(rows.length);
    rows.push([`${g.meta.label.replace(/^\S+\s/,'')} — ${g.items.length} người`,'','','','','','']);
    g.items.forEach(({r},gi)=>{
      const leaveRec = llvActiveLeave(r.name, null, s);
      const leaveTxt = leaveRec ? `Đang nghỉ: ${leaveRec.loai||''}${leaveRec.toDate?` (đến ${leaveRec.toDate})`:''}` : (r.leave||'');
      rows.push([gi+1, r.name||'', r.gender||'', llvWorkerDept(r.name)||'', r.time||'', leaveTxt, r.note||'']);
    });
  });
  rows.push([]);
  rows.push(['TỔNG SỐ NHÂN VIÊN', s.rows.length]);

  if(typeof XLSX==='undefined'){
    showToast('⏳ Thư viện Excel chưa tải xong, đang xuất tạm .csv...', true);
    csvDownload(`Lich_lam_viec_${fname}.csv`, rows);
    loadSheetJs();
    return;
  }

  const headerRowIdx = rows.findIndex(r=>r[0]==='STT');
  const nCols = 7;
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const merges = [{s:{r:0,c:0}, e:{r:0,c:nCols-1}}];
  if(s.period) merges.push({s:{r:1,c:0}, e:{r:1,c:nCols-1}});
  if(s.warning) merges.push({s:{r:s.period?2:1,c:0}, e:{r:s.period?2:1,c:nCols-1}});
  sectionRowIdxs.forEach(ri=>merges.push({s:{r:ri,c:0}, e:{r:ri,c:nCols-1}}));
  ws['!merges'] = merges;
  ws['!cols'] = [{wch:6},{wch:26},{wch:12},{wch:16},{wch:20},{wch:22},{wch:22}];
  ws['!freeze'] = {xSplit:0, ySplit:headerRowIdx+1};
  const range = XLSX.utils.decode_range(ws['!ref']);
  for(let R=headerRowIdx; R<=range.e.r-2; R++){
    const isSection = sectionRowIdxs.includes(R);
    for(let C=0; C<=range.e.c; C++){
      const addr = XLSX.utils.encode_cell({r:R,c:C});
      if(!ws[addr]) ws[addr] = {t:'s', v:''};
      ws[addr].s = {
        border:{top:{style:'thin',color:{rgb:'000000'}},bottom:{style:'thin',color:{rgb:'000000'}},left:{style:'thin',color:{rgb:'000000'}},right:{style:'thin',color:{rgb:'000000'}}},
        alignment:{horizontal: (C===1 && !isSection)?'left':'center', vertical:'center'},
        font: (R===headerRowIdx || isSection) ? {bold:true} : undefined,
        fill: isSection ? {fgColor:{rgb:'DBEAFE'}} : undefined
      };
    }
  }
  ws['A1'] = {t:'s', v:rows[0][0], s:{font:{bold:true,sz:14}, alignment:{horizontal:'center'}}};

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LichLamViec');
  XLSX.writeFile(wb, `Lich_lam_viec_${fname}.xlsx`);
  showToast('✅ Đã xuất lịch làm việc');
}

function llvPrint(sheetId, size){if(guardViewer())return;
  size = (size==='A3') ? 'A3' : 'A4';
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const esc = v=>(v||'').toString().replace(/</g,'&lt;');
  const groups = llvGroupRows(s.rows||[]);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lịch làm việc ${esc(s.name)}</title>
  <style>
    @page{ size:${size} portrait; margin:10mm; }
    body{ font-family:Arial,Helvetica,sans-serif; color:#000; }
    h1{ text-align:center; font-size:16px; margin:0 0 4px; text-transform:uppercase }
    .sub{ text-align:center; font-size:12px; margin-bottom:4px }
    .warn{ text-align:center; font-size:11px; margin-bottom:10px; color:#b45309 }
    table{ border-collapse:collapse; width:100%; font-size:11px }
    th,td{ border:1px solid #000; padding:4px 6px; text-align:center }
    th{ background:#f0f0f0; font-weight:bold }
    td.name{ text-align:left }
    tr.section td{ text-align:left; font-weight:bold; background:#eef2ff }
    .foot{ margin-top:10px; font-size:11px; display:flex; justify-content:space-between }
  </style></head><body>
    <h1>Lịch làm việc bộ phận ${esc(s.name)}</h1>
    ${s.period?`<div class="sub">📅 Ngày/tháng: ${esc(s.period)}</div>`:''}
    ${s.warning?`<div class="warn">⚠️ ${esc(s.warning)}</div>`:''}
    <table>
      <thead><tr><th>STT</th><th>Họ và tên</th><th>Giới tính</th><th>Bộ phận</th><th>Thời gian</th><th>Tình trạng nghỉ</th><th>Ghi chú</th></tr></thead>
      <tbody>
        ${groups.map(g=>`
          <tr class="section"><td colspan="7">${esc(g.meta.label.replace(/^\S+\s/,''))} — ${g.items.length} người</td></tr>
          ${g.items.map(({r},gi)=>{
            const leaveRec = llvActiveLeave(r.name, null, s);
            const leaveTxt = leaveRec ? `Đang nghỉ: ${leaveRec.loai||''}${leaveRec.toDate?` (đến ${leaveRec.toDate})`:''}` : (r.leave||'');
            return `<tr><td>${gi+1}</td><td class="name">${esc(r.name)}</td><td>${esc(r.gender)}</td><td>${esc(llvWorkerDept(r.name))}</td><td>${esc(r.time)}</td><td>${esc(leaveTxt)}</td><td>${esc(r.note)}</td></tr>`;
          }).join('')}
        `).join('')}
      </tbody>
    </table>
    <div class="foot"><span>Tổng số nhân viên: ${s.rows.length}</span></div>
  </body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('❌ Trình duyệt chặn cửa sổ in, vui lòng cho phép popup', true); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.onload = ()=>{ w.focus(); w.print(); };
}
