// src/modules/inventory/inventory-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
 // tải trước thư viện ngay khi vào app để bấm "Xuất Excel" có kết quả nhanh

// ════════════════════════════════════════════════════════════════════════
// 📊 SỐ LIỆU  +  📋 HỒ SƠ AUDIT
// ────────────────────────────────────────────────────────────────────────
// 3 sổ dữ liệu (Nguyên liệu / Máy rút / Máy đánh bóng) bám đúng cấu trúc 2
// file mẫu gốc. Tab Hồ sơ KHÔNG lưu dữ liệu riêng — tự động LẤY & GHÉP dữ
// liệu từ Đơn hàng (DB.orders) + 3 sổ trên bằng khoá Mã cuộn/Heat-Lot và
// Mã đơn hàng/PO/WO, nên không phải nhập lại bất cứ gì.
// ════════════════════════════════════════════════════════════════════════
let _slTab = 'nguyenLieu';      // 'nguyenLieu' | 'mayRut' | 'mayDanhBong'
let _slSearch = '';
let _slFrom = '', _slTo = '';
let _slEditId = null;

// Mỗi sổ 1 màu riêng để nổi bật, hiện đại: Nguyên liệu = xanh lá (Emerald),
// Máy Rút = xanh dương (Blue), Đánh bóng + Cắt = tím (Violet).
const SL_META = {
  nguyenLieu:  {field:'nguyenLieuLog', save:'saveNguyenLieuLog', label:'Sổ nguyên liệu',            icon:'🧪', code:'TC-02', color:'#059669', colorLight:'#ECFDF5', congDoan:null},
  mayRut:      {field:'mayRutLog',     save:'saveMayRutLog',     label:'Sổ máy Rút',                 icon:'↘️', code:'TC-03', color:'#2563EB', colorLight:'#EFF6FF', congDoan:['Rút']},
  mayDanhBong: {field:'mayDanhBongLog',save:'saveMayDanhBongLog',label:'Sổ máy Đánh bóng + Cắt',      icon:'✨', code:'TC-04', color:'#7C3AED', colorLight:'#F5F3FF', congDoan:['Đánh bóng','Cắt']}
};

function slArr(tab){ return DB[SL_META[tab].field] || (DB[SL_META[tab].field]=[]); }
function slDoSave(tab){ window[SL_META[tab].save](); }

// ── Cột "Máy" — nhớ theo khu máy (nhóm máy trong MACHINES) ────────────
// Mỗi Công đoạn (Rút/Đánh bóng/Cắt) khớp đúng 1 khu máy (group) trong
// MACHINES đã khai báo ở đầu file (dùng chung với tab Bảo trì máy/Điều
// hành SX) — để danh sách máy chọn ở Sổ Rút/Đánh bóng+Cắt luôn khớp
// đúng máy thật đang có trong xưởng, không phải gõ tay/tự bịa tên máy.
const CONGDOAN_MACHINE_GROUP = {'Rút':'Máy rút', 'Đánh bóng':'Máy đánh bóng', 'Cắt':'Máy cắt'};
function mcMachinesForCongDoan(congDoan){
  const group = CONGDOAN_MACHINE_GROUP[congDoan];
  return group ? MACHINES.filter(m=>m.group===group) : [];
}
function mcMachineOptionsHTML(congDoan, selected){
  return machineOptionsHTMLByGroup(CONGDOAN_MACHINE_GROUP[congDoan], selected);
}
// ── Chọn máy TRỰC TIẾP theo khu máy (group) — dùng cho Sổ nguyên liệu, nơi
// không có sẵn "Công đoạn" để suy ra khu máy như Sổ Rút/Đánh bóng+Cắt, nên
// người dùng tự chọn "Khu máy" trước rồi mới chọn đúng máy trong khu đó.
const MACHINE_GROUPS = [...new Set(MACHINES.map(m=>m.group))];
function machineGroupOptionsHTML(selected){
  return '<option value="">— Chọn khu máy —</option>' +
    MACHINE_GROUPS.map(g=>`<option value="${esc(g)}" ${g===selected?'selected':''}>${esc(g)}</option>`).join('');
}
function machinesInGroup(group){ return group ? MACHINES.filter(m=>m.group===group) : []; }
function machineOptionsHTMLByGroup(group, selected){
  const list = machinesInGroup(group);
  if(!list.length) return '<option value="">— Chọn máy —</option>';
  return '<option value="">— Chọn máy —</option>' +
    list.map(m=>`<option value="${esc(m.name)}" ${m.name===selected?'selected':''}>${m.icon||''} ${esc(m.name)}</option>`).join('');
}
// "Nhớ khu máy": lưu lại máy vừa chọn gần nhất CHO TỪNG KHU MÁY (group)
// vào localStorage trên thiết bị đang dùng — lần thêm dòng mới kế tiếp ở
// cùng khu máy đó (VD cùng mở Sổ máy Rút) sẽ tự điền sẵn đúng máy vừa
// dùng, đỡ phải chọn lại mỗi lần nếu vẫn đang thao tác trên cùng 1 máy.
const SL_LAST_MAY_KEY = 'sx_sl_last_may_v1';
// "Nhớ khu máy" riêng cho Sổ nguyên liệu — vì sổ này không có sẵn Công
// đoạn để tự suy ra khu máy như Sổ Rút/Đánh bóng+Cắt, nên cần nhớ luôn cả
// Khu máy vừa chọn (không chỉ máy cụ thể) để lần thêm dòng kế tiếp đỡ
// phải chọn lại từ đầu nếu vẫn đang ghi nhận trên cùng khu máy.
const NL_LAST_KHU_KEY = 'sx_nl_last_khu_v1';
function nlLastKhuGet(){ try{ return localStorage.getItem(NL_LAST_KHU_KEY)||''; }catch(e){ return ''; } }
function nlLastKhuSet(khu){ if(!khu) return; try{ localStorage.setItem(NL_LAST_KHU_KEY, khu); }catch(e){} }
function nlOnKhuMayChange(){
  const khu = $('nlKhuMay').value;
  $('nlMay').innerHTML = machineOptionsHTMLByGroup(khu, slLastMayGet(khu));
}
function nlOnMayChange(){
  const khu = $('nlKhuMay').value, may = $('nlMay').value;
  if(may) slLastMaySet(khu, may);
}
function slLastMayGet(group){
  if(!group) return '';
  try{ const obj = JSON.parse(localStorage.getItem(SL_LAST_MAY_KEY)||'{}'); return obj[group]||''; }
  catch(e){ return ''; }
}
function slLastMaySet(group, may){
  if(!group || !may) return;
  try{
    const obj = JSON.parse(localStorage.getItem(SL_LAST_MAY_KEY)||'{}');
    obj[group] = may;
    localStorage.setItem(SL_LAST_MAY_KEY, JSON.stringify(obj));
  }catch(e){}
}
// Đổi Công đoạn (chỉ Sổ Đánh bóng + Cắt mới có 2 lựa chọn) → nạp lại đúng
// danh sách máy của khu máy tương ứng, tự điền máy dùng gần nhất ở khu đó.
function mcOnCongDoanChange(){
  const congDoan = $('mcCongDoan').value;
  const group = CONGDOAN_MACHINE_GROUP[congDoan];
  $('mcMay').innerHTML = mcMachineOptionsHTML(congDoan, slLastMayGet(group));
}
// Chọn máy xong → nhớ ngay cho khu máy đó, không cần đợi bấm Lưu, để nếu
// đổi ý Công đoạn qua lại thì máy vừa chọn không bị mất "trí nhớ".
function mcOnMayChange(){
  const congDoan = $('mcCongDoan').value, may = $('mcMay').value;
  if(may) slLastMaySet(CONGDOAN_MACHINE_GROUP[congDoan], may);
}

function goSlTab(tab){ _slTab = tab; _slSearch=''; _slFrom=''; _slTo=''; renderSoLieu(); }
function slSetSearch(v){ _slSearch = v; renderSlBody(); }
function slSetFrom(v){ _slFrom = v; renderSlBody(); }
function slSetTo(v){ _slTo = v; renderSlBody(); }

// Danh sách gợi ý Đơn hàng dùng cho ô "Liên kết Đơn hàng" ở Sổ nguyên liệu.

// Gợi ý "Khách hàng" ở Sổ nguyên liệu — CHỈ ghi nhớ những tên khách hàng đã
// từng được gõ tay ở chính field này (không lấy/gắn với mã đơn hàng thật
// trong hệ thống Đơn hàng), để nhập nhanh & thống nhất tên gọi qua các lần.
function nlKhachHangOptionsHTML(){
  const set = new Set((DB.nguyenLieuLog||[]).map(r=>r.khachHang).filter(Boolean));
  return [...set].map(v=>`<option value="${v.replace(/"/g,'&quot;')}"></option>`).join('');
}
function orderSpecShort(o){
  if(!o) return '';
  if(o.isCoil) return `${o.thickness||'?'}×${o.width||'?'}`;
  if(o.isRound&&o.phi) return `Φ${o.phi}`;
  return `${o.thickness||'?'}×${o.width||'?'}×${o.length||'?'}`;
}
// Gợi ý "Loại NL" ở Sổ máy Rút/Đánh bóng+Cắt — lấy từ các tên nguyên liệu
// đã từng ghi ở Sổ nguyên liệu, giúp nhập nhanh & thống nhất tên gọi.
function mcLoaiNlOptionsHTML(){
  const set = new Set((DB.nguyenLieuLog||[]).map(r=>r.nguyenLieu).filter(Boolean));
  return [...set].map(v=>`<option value="${v.replace(/"/g,'&quot;')}"></option>`).join('');
}
// Gợi ý "Khách hàng" — lấy từ danh sách khách hàng đã có ở Đơn hàng.
function mcKhachHangOptionsHTML(){
  const set = new Set((DB.orders||[]).map(o=>o.customer).filter(Boolean));
  return [...set].map(v=>`<option value="${v.replace(/"/g,'&quot;')}"></option>`).join('');
}

function matchesSearch(obj, fields, q){
  if(!q) return true;
  const qq = q.toLowerCase();
  return fields.some(f=> String(obj[f]||'').toLowerCase().includes(qq));
}
function inDateRange(dateStr, from, to){
  if(!dateStr) return !from && !to;
  if(from && dateStr < from) return false;
  if(to && dateStr > to) return false;
  return true;
}

function renderSoLieu(){
  const tabsHtml = Object.keys(SL_META).map(k=>{
    const m = SL_META[k], n = slArr(k).length, active = _slTab===k;
    const soon = slSoonExpireInfo(k);
    const soonDot = soon ? `<span title="${soon.count} dòng sắp bị tự động xoá" style="position:absolute;top:6px;right:6px;min-width:16px;height:16px;padding:0 3px;border-radius:20px;background:#dc2626;color:#fff;font-size:9.5px;font-weight:800;line-height:16px;text-align:center;box-shadow:0 0 0 2px #fff">${soon.count>9?'9+':soon.count}</span>` : '';
    return `<button class="sl-tab-card ${active?'active':''}" style="--sl-c:${m.color};--sl-c-l:${m.colorLight};position:relative" onclick="goSlTab('${k}')">
      ${soonDot}
      <div class="sl-tab-icon">${m.icon}</div>
      <div class="sl-tab-info"><div class="sl-tab-label">${m.label}</div><div class="sl-tab-count">${n} dòng đã ghi</div></div>
    </button>`;
  }).join('');
  $('mc').innerHTML = `
    ${slRemindBannerHTML()}
    <div class="sl-tabs">${tabsHtml}</div>
    <div id="slStats" class="khm-stats"></div>
    <div class="hs-filter-row">
      <input class="khm-search" style="flex:2;min-width:180px" placeholder="🔎 Tìm theo mọi trường..." value="${(_slSearch||'').replace(/"/g,'&quot;')}" oninput="slSetSearch(this.value)">
      <input type="date" value="${_slFrom}" onchange="slSetFrom(this.value)" title="Từ ngày">
      <input type="date" value="${_slTo}" onchange="slSetTo(this.value)" title="Đến ngày">
      <button class="khm-add-btn" style="background:${SL_META[_slTab].color}" onclick="exportSlExcel('${_slTab}')">📥 Xuất Excel</button>
      <button class="khm-add-btn" style="background:#334155" onclick="slPrintExport('${_slTab}')">🖨️ In / Xuất PDF</button>
      ${isSlEditor()?`<button class="khm-add-btn" style="background:${SL_META[_slTab].color}" onclick="slOpenAdd()">+ Thêm dòng</button>`:''}
    </div>
    <div style="font-size:11.5px;color:var(--text4);margin:-4px 0 10px">⏳ Dữ liệu quá <b>32 ngày</b> (tính theo Ngày ghi) sẽ tự động bị xoá khỏi sổ để gọn nhẹ — hãy xuất Excel/PDF lưu trữ định kỳ nếu cần giữ lại lâu dài.</div>
    <div id="slBody"></div>
  `;
  renderSlBody();
}

function renderSlBody(){
  const tab = _slTab, meta = SL_META[tab];
  const list = slArr(tab).slice().sort((a,b)=> String(b.ngay||'').localeCompare(String(a.ngay||'')) || (b.updatedAt||0)-(a.updatedAt||0));
  const filtered = list.filter(r=>{
    const dateOk = inDateRange(r.ngay, _slFrom, _slTo);
    if(!dateOk) return false;
    if(tab==='nguyenLieu') return matchesSearch(r, ['nguyenLieu','heatLot','loaiThanhPham','ghiChu','khachHang','doDanDien','may','khuMay'], _slSearch);
    return matchesSearch(r, ['quyCach','loaiNL','congDoan','nguoiSanXuat','khachHang','ghiChu'], _slSearch);
  });

  // Thẻ thống kê nhanh — viền trái tô theo màu của sổ đang xem
  const c = meta.color;
  if(tab==='nguyenLieu'){
    const totalKg = list.reduce((s,r)=>s+(Number(r.soLuong)||0),0);
    const totalPhe = list.reduce((s,r)=>s+(Number(r.phe)||0),0);
    const totalPhoi = list.reduce((s,r)=>s+(Number(r.phoi)||0),0);
    $('slStats').innerHTML = `
      <div class="khm-stat-card" style="border-left-color:${c}"><div class="khm-stat-num">${list.length}</div><div class="khm-stat-lbl">Dòng đã ghi</div></div>
      <div class="khm-stat-card" style="border-left-color:${c}"><div class="khm-stat-num">${fmtNum(totalKg)}</div><div class="khm-stat-lbl">Tổng số lượng (kg)</div></div>
      <div class="khm-stat-card warn"><div class="khm-stat-num">${fmtNum(totalPhe)}</div><div class="khm-stat-lbl">Tổng phế/đầu mẩu (kg)</div></div>
      <div class="khm-stat-card warn"><div class="khm-stat-num">${fmtNum(totalPhoi)}</div><div class="khm-stat-lbl">Tổng phoi (kg)</div></div>`;
    $('slStats').innerHTML += slMachineBreakdownHTML(list, c);
  } else {
    const totalThanh = list.reduce((s,r)=>s+(Number(r.soThanh)||0),0);
    const dacBiet = list.filter(r=>r.hang==='Đặc biệt').length;
    $('slStats').innerHTML = `
      <div class="khm-stat-card" style="border-left-color:${c}"><div class="khm-stat-num">${list.length}</div><div class="khm-stat-lbl">Dòng đã ghi</div></div>
      <div class="khm-stat-card" style="border-left-color:${c}"><div class="khm-stat-num">${fmtNum(totalThanh)}</div><div class="khm-stat-lbl">Tổng số thanh</div></div>
      <div class="khm-stat-card" style="border-left-color:${c}"><div class="khm-stat-num">${dacBiet}</div><div class="khm-stat-lbl">Số dòng hàng Đặc biệt</div></div>`;
    $('slStats').innerHTML += slMachineBreakdownHTML(list, c);
  }

  const admin = isSlEditor();
  let head, rows;
  if(tab==='nguyenLieu'){
    head = `<tr><th>STT</th><th>Ngày</th><th>Giờ nhập</th><th>Nguyên liệu</th><th>Mã cuộn/Heat-Lot</th><th>Độ dẫn điện</th><th>Số lượng (kg)</th><th>Loại TP chạy</th><th>Số mét chạy</th><th>Máy</th><th>Phế/đầu mẩu</th><th>Phoi</th><th>Khách hàng</th><th>Ghi chú</th><th></th></tr>`;
    rows = filtered.map((r,i)=>`<tr class="dt-row-clickable" onclick="slViewDetail('nguyenLieu','${r.id}')">
        <td class="dt-stt">${i+1}</td><td>${fmtDate(r.ngay)}</td><td>${slGioNhapHTML(r)}</td><td>${esc(r.nguyenLieu)}</td><td>${esc(r.heatLot)}</td><td>${esc(r.doDanDien)}</td>
        <td>${fmtNum(r.soLuong)}</td><td>${esc(r.loaiThanhPham)}</td><td>${esc(r.soMetChay)}</td>
        <td>${r.may?`🏭 ${esc(r.may)}`:'<span style="color:var(--text4)">—</span>'}</td>
        <td>${nlMultiCellHTML(r.phe,r.pheItems)}</td><td>${nlMultiCellHTML(r.phoi,r.phoiItems)}</td><td>${esc(r.khachHang)||'—'}</td><td>${esc(r.ghiChu)}</td>
        <td class="dt-actions">${admin?`<button class="dt-actbtn" onclick="event.stopPropagation();slOpenEdit('${r.id}')">✏️</button><button class="dt-actbtn danger" onclick="event.stopPropagation();slDelete('${r.id}')">🗑️</button>`:''}</td>
      </tr>`).join('');
  } else {
    head = `<tr><th>STT</th><th>Ngày</th><th>Giờ nhập</th><th>Quy cách</th><th>Loại NL</th><th>Hàng</th><th>Số thanh</th><th>Công đoạn</th><th>Máy</th><th>Ca SX</th><th>Người SX</th><th>Khách hàng</th><th>Ghi chú</th><th></th></tr>`;
    rows = filtered.map((r,i)=>`<tr class="dt-row-clickable" onclick="slViewDetail('${tab}','${r.id}')">
        <td class="dt-stt">${i+1}</td><td>${fmtDate(r.ngay)}</td><td>${slGioNhapHTML(r)}</td><td>${esc(r.quyCach)}</td><td>${esc(r.loaiNL)}</td>
        <td><span class="dt-pill">${esc(r.hang)||'—'}</span></td><td>${fmtNum(r.soThanh)}</td>
        <td><span class="dt-pill" style="background:${meta.colorLight};color:${meta.color}">${esc(r.congDoan)||'—'}</span></td>
        <td>${r.may?`🏭 ${esc(r.may)}`:'<span style="color:var(--text4)">—</span>'}</td>
        <td>${r.ca?('Ca '+esc(r.ca)):'—'}</td><td>${esc(r.nguoiSanXuat)}</td><td>${esc(r.khachHang)||'—'}</td><td>${esc(r.ghiChu)}</td>
        <td class="dt-actions">${admin?`<button class="dt-actbtn" onclick="event.stopPropagation();slOpenEdit('${r.id}')">✏️</button><button class="dt-actbtn danger" onclick="event.stopPropagation();slDelete('${r.id}')">🗑️</button>`:''}</td>
      </tr>`).join('');
  }

  const nCols = tab==='nguyenLieu' ? 15 : 14;
  $('slBody').innerHTML = `
    <div class="dt-wrap" style="--sl-accent:${c}"><table class="dt-table"><thead>${head}</thead>
      <tbody>${filtered.length?rows:`<tr><td colspan="${nCols}" class="dt-empty">📭 Chưa có dữ liệu — bấm "+ Thêm dòng" để bắt đầu ghi ${meta.label.toLowerCase()}</td></tr>`}</tbody>
    </table></div>`;
}
// Hiện số kg tổng trong ô bảng; nếu có từ 2 mã trở lên thì thêm dấu 🔖 và
// tooltip (hover/chạm giữ) liệt kê từng mã kèm kg để không phải mở Sửa
// mới xem được chi tiết đã ghi nhiều mã trong cùng 1 dòng.
function nlMultiCellHTML(total, items){
  const t = fmtNum(total);
  if(!Array.isArray(items) || items.length<2) return t;
  const detail = items.map(it=>`${it.ma?esc(it.ma)+': ':''}${fmtNum(it.kg)}kg`).join(' • ');
  return `<span title="${esc(detail)}">${t} <span style="opacity:.6;font-size:10px">🔖${items.length}</span></span>`;
}

// Cột "Giờ nhập" (Sổ nguyên liệu / Sổ máy Rút / Sổ máy Đánh bóng+Cắt) — tự
// động lấy từ createdAt (giờ:phút lúc BẤM LƯU lần đầu, không phải giờ gõ
// tay ở ô "Ngày"), không cần/không cho nhập tay để luôn khớp đúng thực tế
// ai ghi sổ lúc nào. Dòng cũ ghi trước khi có cột này (chưa có createdAt)
// thì tạm dùng updatedAt để vẫn hiện được giờ thay vì để trống hẳn. Nếu
// dòng đã từng được Sửa lại (updatedAt muộn hơn createdAt) thì thêm gợi ý
// "✏️ sửa lúc …" ngay trong tooltip để biết đây là giờ nhập gốc, không phải
// giờ sửa gần nhất (giờ sửa gần nhất vẫn xem đầy đủ ở khung "Xem chi tiết").
function slGioNhapHTML(r){
  const created = r.createdAt || r.updatedAt;
  if(!created) return '<span style="color:var(--text4)">—</span>';
  const time = vnTimeHM(new Date(created));
  let title = 'Giờ nhập: ' + fmtDateTime(created);
  if(r.updatedAt && r.updatedBy && r.updatedAt - created > 60000){
    title += ` • ✏️ Sửa lúc ${fmtDateTime(r.updatedAt)} bởi ${r.updatedBy}`;
  }
  return `<span title="${esc(title)}">🕐 ${time}</span>`;
}

// Thống kê nhanh theo khu máy (nhóm máy) — gộp toàn bộ máy trong cùng 1
// khu (VD "Máy rút 100 - 1" + "Máy rút 100 - 2" + "Máy rút 50" đều thuộc
// khu "Máy rút") để thấy ngay khu nào chạy nhiều thanh nhất, dòng nào
// chưa ghi máy cụ thể (hiển thị "Chưa ghi máy") để nhắc bổ sung.
function slMachineBreakdownHTML(list, color){
  const byGroup = {};
  list.forEach(r=>{
    const may = r.may && r.may.trim();
    const m = may ? MACHINES.find(x=>x.name===may) : null;
    const key = m ? m.group : (may ? may : 'Chưa ghi máy');
    if(!byGroup[key]) byGroup[key] = {soThanh:0, count:0};
    byGroup[key].soThanh += Number(r.soThanh)||0;
    byGroup[key].count += 1;
  });
  const keys = Object.keys(byGroup);
  if(!keys.length) return '';
  keys.sort((a,b)=> byGroup[b].soThanh - byGroup[a].soThanh);
  const chips = keys.map(k=>{
    const g = byGroup[k];
    const missing = k==='Chưa ghi máy';
    return `<span class="dt-pill" style="background:${missing?'#FEF3C7':color+'1A'};color:${missing?'#92400E':color};font-weight:600;margin:2px 4px 2px 0">
      ${missing?'⚠️ ':'🏭 '}${esc(k)} · ${g.count} dòng · ${fmtNum(g.soThanh)} thanh
    </span>`;
  }).join('');
  return `<div style="grid-column:1/-1;padding:8px 2px 0"><div style="font-size:11.5px;color:var(--text4);margin-bottom:4px;font-weight:600">📊 Theo khu máy:</div>${chips}</div>`;
}


// ── Thêm / Sửa Sổ nguyên liệu ─────────────────────────────────────────
// ── Nhóm nhập nhiều "Mã + Kg" cho Phế/đầu mẩu & Phoi ──────────────────
// _nlPheItems / _nlPhoiItems: mảng {ma, kg} đang chỉnh trong modal.
let _nlPheItems = [{ma:'',kg:''}], _nlPhoiItems = [{ma:'',kg:''}];
function nlMultiArr(type){ return type==='phe' ? _nlPheItems : _nlPhoiItems; }
function nlMultiRender(type){
  const items = nlMultiArr(type);
  const listEl = $(type==='phe'?'nlPheList':'nlPhoiList');
  listEl.innerHTML = items.map((it,i)=>`
    <div class="nl-multi-row">
      <input class="field-inp nl-multi-code" placeholder="Mã (VD: Fi20B — tuỳ chọn)" value="${esc(it.ma)}" oninput="nlMultiUpdate('${type}',${i},'ma',this.value)">
      <input class="field-inp nl-multi-kg" type="number" step="0.01" placeholder="Kg" value="${it.kg===''?'':it.kg}" oninput="nlMultiUpdate('${type}',${i},'kg',this.value)">
      <button type="button" class="nl-multi-del" title="Xoá mã này" onclick="nlMultiDel('${type}',${i})">✕</button>
    </div>`).join('');
  const total = items.reduce((s,it)=>s+(Number(it.kg)||0),0);
  $(type==='phe'?'nlPheTotal':'nlPhoiTotal').textContent = `${fmtNum(total)} kg`;
}
function nlMultiUpdate(type, i, field, val){
  const items = nlMultiArr(type);
  if(!items[i]) return;
  items[i][field] = field==='kg' ? val : val;
  // Chỉ cập nhật lại tổng kg hiển thị, không render lại toàn bộ (để không
  // mất focus/con trỏ đang gõ dở trên input).
  const total = items.reduce((s,it)=>s+(Number(it.kg)||0),0);
  $(type==='phe'?'nlPheTotal':'nlPhoiTotal').textContent = `${fmtNum(total)} kg`;
}
function nlMultiAdd(type){
  const items = nlMultiArr(type);
  items.push({ma:'',kg:''});
  nlMultiRender(type);
  // Focus ngay vào ô Mã vừa thêm để gõ tiếp cho nhanh.
  const listEl = $(type==='phe'?'nlPheList':'nlPhoiList');
  const rows = listEl.querySelectorAll('.nl-multi-code');
  if(rows.length) rows[rows.length-1].focus();
}
function nlMultiDel(type, i){
  const items = nlMultiArr(type);
  items.splice(i,1);
  if(!items.length) items.push({ma:'',kg:''}); // luôn chừa lại ít nhất 1 hàng trống
  nlMultiRender(type);
}
function nlMultiSetFromRecord(items, total){
  // items: mảng chi tiết đã lưu (nếu có) — dùng khi Sửa dòng cũ.
  // total: số phe/phoi tổng kiểu cũ (dòng ghi từ trước khi có tính năng
  // này) — nếu chưa có chi tiết thì hiển thị lại đúng 1 hàng bằng số tổng.
  if(Array.isArray(items) && items.length) return items.map(x=>({ma:x.ma||'', kg:(x.kg===0?0:(x.kg||''))}));
  if(total) return [{ma:'', kg:total}];
  return [{ma:'',kg:''}];
}
function nlMultiPack(type){
  // Gói lại mảng {ma,kg} khi Lưu: bỏ các hàng hoàn toàn trống (không mã,
  // không kg) để không lưu rác vào dữ liệu.
  return nlMultiArr(type).filter(it=>String(it.ma||'').trim()!=='' || (Number(it.kg)||0)!==0)
    .map(it=>({ma:String(it.ma||'').trim(), kg:Number(it.kg)||0}));
}

// ── Nhiều "Loại thành phẩm chạy" trên cùng 1 cuộn ───────────────────────
// _nlTPItems: mảng chuỗi đang chỉnh trong modal. Khi Lưu: loaiThanhPhamItems
// = mảng đầy đủ, loaiThanhPham = nối bằng " + " (giữ tương thích bảng, tìm
// kiếm, xuất Excel và dữ liệu cũ vốn chỉ có 1 chuỗi).
let _nlTPItems = [''];
function nlTPRender(){
  const el = $('nlTPList'); if(!el) return;
  el.innerHTML = _nlTPItems.map((v,i)=>`
    <div class="nl-multi-row">
      <input class="field-inp nl-multi-code" style="flex:1" placeholder="${i===0?'VD: 10x100':'Loại thành phẩm khác (VD: 8x60)'}" value="${esc(v)}" oninput="nlTPUpdate(${i},this.value)">
      <button type="button" class="nl-multi-del" title="Xoá loại này" onclick="nlTPDel(${i})">✕</button>
    </div>`).join('');
}
function nlTPUpdate(i,val){ if(i>=0 && i<_nlTPItems.length) _nlTPItems[i]=val; }
function nlTPAdd(){
  _nlTPItems.push('');
  nlTPRender();
  const rows = $('nlTPList').querySelectorAll('.nl-multi-code');
  if(rows.length) rows[rows.length-1].focus();
}
function nlTPDel(i){
  _nlTPItems.splice(i,1);
  if(!_nlTPItems.length) _nlTPItems.push('');
  nlTPRender();
}
function nlTPFromRecord(r){
  if(Array.isArray(r.loaiThanhPhamItems) && r.loaiThanhPhamItems.length) return r.loaiThanhPhamItems.map(x=>String(x||''));
  if(r.loaiThanhPham) return String(r.loaiThanhPham).split(/\s+\+\s+/);
  return [''];
}
function nlTPPack(){ return _nlTPItems.map(x=>String(x||'').trim()).filter(Boolean); }

function nlOpenAdd(){
  if(guardSlEdit())return;
  _slEditId = null;
  $('nlModalTitle').textContent = 'Thêm dòng Sổ nguyên liệu';
  $('nlErr').style.display='none'; $('nlErr').textContent='';
  ['nlNguyenLieu','nlHeatLot','nlDoDanDien','nlSoLuong','nlSoMet','nlDonHang','nlPO','nlWO','nlGhiChu'].forEach(id=>$(id).value='');
  $('nlNgay').value = todayStr();
  _nlPheItems = [{ma:'',kg:''}]; _nlPhoiItems = [{ma:'',kg:''}];
  nlMultiRender('phe'); nlMultiRender('phoi');
  _nlTPItems = ['']; nlTPRender();
  const dfKhu = nlLastKhuGet();
  $('nlKhuMay').innerHTML = machineGroupOptionsHTML(dfKhu);
  $('nlMay').innerHTML = machineOptionsHTMLByGroup(dfKhu, slLastMayGet(dfKhu));
  $('nlKhachHangList').innerHTML = nlKhachHangOptionsHTML();
  openModal('nlModal');
}
function nlOpenEdit(id){
  if(guardSlEdit())return;
  const r = slArr('nguyenLieu').find(x=>x.id===id); if(!r) return;
  _slEditId = id;
  $('nlModalTitle').textContent = 'Sửa dòng Sổ nguyên liệu';
  $('nlErr').style.display='none'; $('nlErr').textContent='';
  $('nlNgay').value=r.ngay||''; $('nlNguyenLieu').value=r.nguyenLieu||''; $('nlHeatLot').value=r.heatLot||'';
  $('nlDoDanDien').value=r.doDanDien||''; $('nlSoLuong').value=r.soLuong??''; _nlTPItems = nlTPFromRecord(r); nlTPRender();
  $('nlSoMet').value=r.soMetChay||'';
  _nlPheItems = nlMultiSetFromRecord(r.pheItems, r.phe);
  _nlPhoiItems = nlMultiSetFromRecord(r.phoiItems, r.phoi);
  nlMultiRender('phe'); nlMultiRender('phoi');
  const rKhu = r.khuMay || (r.may ? ((MACHINES.find(m=>m.name===r.may)||{}).group||'') : '');
  $('nlKhuMay').innerHTML = machineGroupOptionsHTML(rKhu);
  $('nlMay').innerHTML = machineOptionsHTMLByGroup(rKhu, r.may||'');
  $('nlDonHang').value=r.khachHang||''; $('nlPO').value=r.po||''; $('nlWO').value=r.wo||''; $('nlGhiChu').value=r.ghiChu||'';
  $('nlKhachHangList').innerHTML = nlKhachHangOptionsHTML();
  openModal('nlModal');
}
function nlSave(){
  if(guardSlEdit())return;
  const ngay=$('nlNgay').value, nl=$('nlNguyenLieu').value.trim();
  const pheItems = nlMultiPack('phe'), phoiItems = nlMultiPack('phoi');
  const tpItems = nlTPPack();
  const phe = pheItems.reduce((s,it)=>s+it.kg,0);
  const phoi = phoiItems.reduce((s,it)=>s+it.kg,0);
  if(!ngay){ $('nlErr').textContent='⚠️ Vui lòng nhập Ngày.'; $('nlErr').style.display='block'; return; }
  // Cho phép ghi ĐỘC LẬP Phế/đầu mẩu hoặc Phoi mà không cần nhập Nguyên
  // liệu — vì thực tế phế/phoi phát sinh và được ghi nhận nhiều lần hơn
  // hẳn so với mỗi lần nhập nguyên liệu đầu vào. Chỉ chặn khi cả 3 đều
  // trống (tránh lưu 1 dòng hoàn toàn rỗng).
  if(!nl && !phe && !phoi){ $('nlErr').textContent='⚠️ Vui lòng nhập Nguyên liệu, hoặc ít nhất Phế/đầu mẩu hay Phoi.'; $('nlErr').style.display='block'; return; }
  const arr = slArr('nguyenLieu');
  const khuMay = $('nlKhuMay').value, may = $('nlMay').value;
  const rec = {
    id: _slEditId || uid(),
    ngay, nguyenLieu: nl, heatLot: $('nlHeatLot').value.trim(),
    doDanDien: $('nlDoDanDien').value.trim(),
    soLuong: $('nlSoLuong').value?Number($('nlSoLuong').value):0,
    loaiThanhPham: tpItems.join(' + '), loaiThanhPhamItems: tpItems, soMetChay: $('nlSoMet').value.trim(),
    khuMay, may,
    phe, phoi, pheItems, phoiItems,
    khachHang: $('nlDonHang').value.trim(), po: $('nlPO').value.trim(), wo: $('nlWO').value.trim(),
    ghiChu: $('nlGhiChu').value.trim(),
    updatedAt: Date.now(), updatedBy: actorName()
  };
  const idx = arr.findIndex(x=>x.id===rec.id);
  // "Giờ nhập" (createdAt) phải GIỮ NGUYÊN từ lần Lưu đầu tiên, kể cả khi
  // Sửa lại dòng sau đó — chỉ updatedAt/updatedBy mới đổi mỗi lần Sửa.
  rec.createdAt = (idx>=0 && arr[idx].createdAt) || rec.updatedAt;
  if(idx>=0) arr[idx]=rec; else arr.push(rec);
  nlLastKhuSet(khuMay); slLastMaySet(khuMay, may); // nhớ khu máy + máy vừa dùng
  saveNguyenLieuLog();
  const logLabel = nl || (phe?`Phế/đầu mẩu ${fmtNum(phe)}kg`:'') || (phoi?`Phoi ${fmtNum(phoi)}kg`:'') || '(dòng trống)';
  log('Sổ nguyên liệu', `${_slEditId?'Sửa':'Thêm'} dòng ${logLabel} (${rec.heatLot||'—'})`, rec.id, null, null);
  closeModal('nlModal');
  renderSoLieu();
  showToast(_slEditId?'✅ Đã cập nhật':'✅ Đã thêm dòng mới');
}
function slDelete(id){
  if(guardSlEdit())return;
  const tab=_slTab, arr=slArr(tab);
  const r = arr.find(x=>x.id===id); if(!r) return;
  if(!confirm('Xoá dòng dữ liệu này? Không thể hoàn tác.')) return;
  const idx = arr.findIndex(x=>x.id===id);
  if(idx>=0) arr.splice(idx,1);
  slDoSave(tab);
  log(SL_META[tab].label, 'Xoá 1 dòng dữ liệu', id, null, null);
  renderSoLieu();
  showToast('🗑️ Đã xoá');
}

// ── Chi tiết 1 dòng Số liệu — bấm vào bất kỳ đâu trên dòng (ngoài 2 nút
// ✏️/🗑️ ở cuối bảng) sẽ mở bảng chi tiết ĐẦY ĐỦ toàn bộ thông tin của dòng
// đó (kể cả các trường không đủ chỗ hiển thị trên bảng như PO/WO, chi tiết
// từng mã Phế/Phoi, người & thời điểm cập nhật gần nhất...), có nút Sửa/Xoá
// ngay tại đây — không cần quay lại bảng tìm đúng dòng rồi bấm icon nhỏ.
let _slDetailTab = null, _slDetailId = null;
function slDetailField(label, value){
  return `<div><b>${label}</b><span>${value==null||value===''?'—':value}</span></div>`;
}
function slViewDetail(tab, id){
  const r = slArr(tab).find(x=>x.id===id); if(!r) return;
  _slDetailTab = tab; _slDetailId = id;
  const meta = SL_META[tab];
  $('slDetailTitle').textContent = `${meta.icon} ${meta.label} · ${fmtDate(r.ngay)}`;
  let fieldsHTML;
  if(tab==='nguyenLieu'){
    fieldsHTML = `<div class="kh-detail-grid">
      ${slDetailField('Ngày', fmtDate(r.ngay))}
      ${slDetailField('Giờ nhập', (r.createdAt||r.updatedAt)?fmtDateTime(r.createdAt||r.updatedAt):'—')}
      ${slDetailField('Nguyên liệu', esc(r.nguyenLieu))}
      ${slDetailField('Mã cuộn/Heat-Lot', esc(r.heatLot))}
      ${slDetailField('Độ dẫn điện', esc(r.doDanDien))}
      ${slDetailField('Số lượng', fmtNum(r.soLuong)+' kg')}
      ${slDetailField('Loại thành phẩm chạy', esc((r.loaiThanhPhamItems&&r.loaiThanhPhamItems.length>1)?r.loaiThanhPhamItems.join('  •  '):r.loaiThanhPham))}
      ${slDetailField('Số mét chạy', esc(r.soMetChay))}
      ${slDetailField('Khu máy', esc(r.khuMay))}
      ${slDetailField('Máy sản xuất', r.may?('🏭 '+esc(r.may)):'—')}
      ${slDetailField('Tổng phế/đầu mẩu', fmtNum(r.phe)+' kg')}
      ${slDetailField('Chi tiết mã phế/đầu mẩu', esc(nlDetailText(r.pheItems)))}
      ${slDetailField('Tổng phoi', fmtNum(r.phoi)+' kg')}
      ${slDetailField('Chi tiết mã phoi', esc(nlDetailText(r.phoiItems)))}
      ${slDetailField('Khách hàng', esc(r.khachHang))}
      ${slDetailField('PO', esc(r.po))}
      ${slDetailField('WO', esc(r.wo))}
    </div>
    ${r.ghiChu?`<div style="margin-top:10px;padding:8px 10px;background:var(--amber-l);border-left:3px solid var(--amber-m);border-radius:0 8px 8px 0;line-height:1.5"><b>📝 Ghi chú:</b> ${esc(r.ghiChu)}</div>`:''}`;
  } else {
    fieldsHTML = `<div class="kh-detail-grid">
      ${slDetailField('Ngày', fmtDate(r.ngay))}
      ${slDetailField('Giờ nhập', (r.createdAt||r.updatedAt)?fmtDateTime(r.createdAt||r.updatedAt):'—')}
      ${slDetailField('Quy cách', esc(r.quyCach))}
      ${slDetailField('Loại NL', esc(r.loaiNL))}
      ${slDetailField('Hàng', esc(r.hang))}
      ${slDetailField('Số thanh', fmtNum(r.soThanh))}
      ${slDetailField('Công đoạn', esc(r.congDoan))}
      ${slDetailField('Máy sản xuất', r.may?('🏭 '+esc(r.may)):'—')}
      ${slDetailField('Ca SX', r.ca?('Ca '+esc(r.ca)):'—')}
      ${slDetailField('Người SX', esc(r.nguoiSanXuat))}
      ${slDetailField('Khách hàng', esc(r.khachHang))}
    </div>
    ${r.ghiChu?`<div style="margin-top:10px;padding:8px 10px;background:var(--amber-l);border-left:3px solid var(--amber-m);border-radius:0 8px 8px 0;line-height:1.5"><b>📝 Ghi chú:</b> ${esc(r.ghiChu)}</div>`:''}`;
  }
  const updHTML = (r.updatedAt||r.updatedBy) ? `<div class="kh-detail-sec"><div class="kh-detail-sec-title">🕐 Cập nhật gần nhất</div>
    <div class="kh-detail-grid">
      ${slDetailField('Thời điểm', r.updatedAt?fmtDateTime(r.updatedAt):'—')}
      ${slDetailField('Người cập nhật', esc(r.updatedBy))}
    </div></div>` : '';
  $('slDetailBody').innerHTML = fieldsHTML + updHTML;
  const admin = isSlEditor();
  const editBtn = $('slDetailEditBtn'), delBtn = $('slDetailDeleteBtn');
  editBtn.style.display = admin ? '' : 'none';
  delBtn.style.display = admin ? '' : 'none';
  editBtn.onclick = ()=>{ closeModal('slDetailModal'); slOpenEdit(id); };
  delBtn.onclick = ()=>{ closeModal('slDetailModal'); slDelete(id); };
  openModal('slDetailModal');
}

// ── Thêm / Sửa Sổ máy Rút / Đánh bóng + Cắt (form dùng chung) ─────────
// "Công đoạn" tự khớp theo sổ đang mở: Sổ máy Rút luôn khoá = "Rút"; Sổ
// máy Đánh bóng + Cắt cho chọn "Đánh bóng" hoặc "Cắt".
function mcCongDoanOptionsHTML(tab, selected){
  const opts = SL_META[tab].congDoan || ['Rút'];
  return opts.map(v=>`<option value="${v}" ${v===selected?'selected':''}>${v}</option>`).join('');
}
function mcOpenAdd(){
  if(guardSlEdit())return;
  _slEditId = null;
  $('mcModalTitle').textContent = 'Thêm dòng '+SL_META[_slTab].label;
  $('mcErr').style.display='none'; $('mcErr').textContent='';
  ['mcQuyCach','mcLoaiNL','mcSoThanh','mcNguoiSX','mcKhachHang','mcGhiChu'].forEach(id=>$(id).value='');
  $('mcNgay').value = todayStr(); $('mcHang').value='Bo cạnh'; $('mcCa').value='';
  const dfCongDoan = SL_META[_slTab].congDoan[0];
  $('mcCongDoan').innerHTML = mcCongDoanOptionsHTML(_slTab, dfCongDoan);
  $('mcMay').innerHTML = mcMachineOptionsHTML(dfCongDoan, slLastMayGet(CONGDOAN_MACHINE_GROUP[dfCongDoan]));
  $('mcLoaiNLList').innerHTML = mcLoaiNlOptionsHTML();
  $('mcKhachHangList').innerHTML = mcKhachHangOptionsHTML();
  openModal('mcModal');
}
function mcOpenEdit(id){
  if(guardSlEdit())return;
  const r = slArr(_slTab).find(x=>x.id===id); if(!r) return;
  _slEditId = id;
  $('mcModalTitle').textContent = 'Sửa dòng '+SL_META[_slTab].label;
  $('mcErr').style.display='none'; $('mcErr').textContent='';
  $('mcNgay').value=r.ngay||''; $('mcQuyCach').value=r.quyCach||''; $('mcLoaiNL').value=r.loaiNL||'';
  $('mcHang').value=r.hang||'Bo cạnh'; $('mcSoThanh').value=r.soThanh??''; $('mcCa').value=r.ca||'';
  $('mcNguoiSX').value=r.nguoiSanXuat||''; $('mcKhachHang').value=r.khachHang||''; $('mcGhiChu').value=r.ghiChu||'';
  const edCongDoan = r.congDoan||SL_META[_slTab].congDoan[0];
  $('mcCongDoan').innerHTML = mcCongDoanOptionsHTML(_slTab, edCongDoan);
  $('mcMay').innerHTML = mcMachineOptionsHTML(edCongDoan, r.may||slLastMayGet(CONGDOAN_MACHINE_GROUP[edCongDoan]));
  $('mcLoaiNLList').innerHTML = mcLoaiNlOptionsHTML();
  $('mcKhachHangList').innerHTML = mcKhachHangOptionsHTML();
  openModal('mcModal');
}
function mcSave(){
  if(guardSlEdit())return;
  const ngay=$('mcNgay').value, qc=$('mcQuyCach').value.trim(), soThanh=$('mcSoThanh').value;
  const nguoiSX=$('mcNguoiSX').value.trim();
  if(!ngay || !qc || !soThanh || !nguoiSX){ $('mcErr').textContent='⚠️ Vui lòng nhập đủ Ngày, Quy cách, Số thanh, Người SX.'; $('mcErr').style.display='block'; return; }
  const tab = _slTab, arr = slArr(tab);
  const congDoan = $('mcCongDoan').value, may = $('mcMay').value;
  const rec = {
    id: _slEditId || uid(),
    ngay, quyCach: qc, loaiNL: $('mcLoaiNL').value.trim(), hang: $('mcHang').value,
    soThanh: Number(soThanh), congDoan, may, ca: $('mcCa').value,
    nguoiSanXuat: nguoiSX, khachHang: $('mcKhachHang').value.trim(), ghiChu: $('mcGhiChu').value.trim(),
    updatedAt: Date.now(), updatedBy: actorName()
  };
  const idx = arr.findIndex(x=>x.id===rec.id);
  // "Giờ nhập" (createdAt) phải GIỮ NGUYÊN từ lần Lưu đầu tiên, kể cả khi
  // Sửa lại dòng sau đó — chỉ updatedAt/updatedBy mới đổi mỗi lần Sửa.
  rec.createdAt = (idx>=0 && arr[idx].createdAt) || rec.updatedAt;
  if(idx>=0) arr[idx]=rec; else arr.push(rec);
  slLastMaySet(CONGDOAN_MACHINE_GROUP[congDoan], may); // nhớ máy vừa dùng cho khu máy này
  slDoSave(tab);
  log(SL_META[tab].label, `${_slEditId?'Sửa':'Thêm'} dòng ${qc} (${rec.congDoan})`, rec.id, null, null);
  closeModal('mcModal');
  renderSoLieu();
  showToast(_slEditId?'✅ Đã cập nhật':'✅ Đã thêm dòng mới');
}

// slOpenAdd()/slOpenEdit() dùng chung cho cả 3 sổ — điều hướng đúng modal
// theo tab hiện tại (Nguyên liệu dùng form riêng, Rút/Đánh bóng+Cắt dùng chung).
function slOpenAdd(){ if(_slTab==='nguyenLieu') nlOpenAdd(); else mcOpenAdd(); }
function slOpenEdit(id){ if(_slTab==='nguyenLieu') nlOpenEdit(id); else mcOpenEdit(id); }
