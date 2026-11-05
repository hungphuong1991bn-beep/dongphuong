// src/modules/checklist/checklist-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────



// ════════════════════════════════════════════════════════════
// CHECK SHEET THIẾT BỊ — render + thao tác (Khu vực Thiết bị)
// Admin: quản lý cấu trúc (nhóm thiết bị / khu vực máy / hạng mục).
// Admin + Staff: tick trạng thái hàng ngày. Viewer: chỉ xem.
// ════════════════════════════════════════════════════════════
let _csYM = null;
let _csActiveGroup = null;
let _csManageMode = false;

function csYM(){ return (_csYM = _csYM || todayStr().slice(0,7)); }
function shiftCsMonth(delta){
  const [y,m] = csYM().split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  _csYM = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderCheckSheet();
}
function changeCsMonth(val){ if(!val) return; _csYM = val; renderCheckSheet(); }
function csGoGroup(id){ _csActiveGroup = id; renderCheckSheet(); }
function csToggleManage(){ if(guardNotAdmin())return; _csManageMode = !_csManageMode; renderCheckSheet(); }

// Trạng thái 1 ô ngày, đọc từ DB.csData[ym][itemKey][day]
function csCellStatus(itemKey, day){
  const ym = csYM();
  return (((DB.csData[ym]||{})[itemKey]||{})[day]) || '';
}
// Bấm 1 ô ngày → chuyển vòng: Trống → ✓ Đạt → ✗ Cần bảo trì → Trống.
// Admin + Staff được thao tác (giống chấm công); Viewer chỉ xem.
function csCycleCell(itemKey, day){
  if(guardViewer())return;
  const ym = csYM();
  if(!DB.csData[ym]) DB.csData[ym] = {};
  if(!DB.csData[ym][itemKey]) DB.csData[ym][itemKey] = {};
  const cur = DB.csData[ym][itemKey][day] || '';
  const next = cur==='' ? 'ok' : (cur==='ok' ? 'ng' : '');
  if(next==='') delete DB.csData[ym][itemKey][day];
  else DB.csData[ym][itemKey][day] = next;
  saveCsData();
  const el = document.getElementById('csCell_'+CSS.escape(itemKey)+'_'+day);
  if(el) csApplyCellStyle(el, next);
  else renderCheckSheet();
}
function csApplyCellStyle(el, status){
  const st = CS_STATUS[status];
  el.textContent = st ? st.short : '';
  el.style.color = st ? st.color : 'var(--text4)';
  el.style.background = st ? st.bg : '';
  el.title = st ? st.label : 'Bấm để đánh dấu';
}

// ── Quản lý cấu trúc: nhóm thiết bị / khu vực máy / hạng mục (chỉ Admin) ──
function csAddGroup(){
  if(guardNotAdmin())return;
  const name = prompt('Tên nhóm thiết bị mới (VD: TJ550, Rút 100):');
  if(!name || !name.trim()) return;
  const g = {id:'csg_'+Date.now(), name:name.trim(), sections:[]};
  DB.csTemplates = DB.csTemplates || [];
  DB.csTemplates.push(g);
  saveCsTemplates();
  _csActiveGroup = g.id;
  renderCheckSheet();
}
function csRenameGroup(groupId){
  if(guardNotAdmin())return;
  const g = (DB.csTemplates||[]).find(x=>x.id===groupId); if(!g) return;
  const name = prompt('Đổi tên nhóm thiết bị:', g.name);
  if(!name || !name.trim()) return;
  g.name = name.trim();
  saveCsTemplates();
  renderCheckSheet();
}
function csDeleteGroup(groupId){
  if(guardNotAdmin())return;
  const g = (DB.csTemplates||[]).find(x=>x.id===groupId); if(!g) return;
  if(!confirm(`Xoá toàn bộ nhóm thiết bị "${g.name}" và mọi hạng mục bên trong?`)) return;
  DB.csTemplates = (DB.csTemplates||[]).filter(x=>x.id!==groupId);
  saveCsTemplates();
  if(_csActiveGroup===groupId) _csActiveGroup = null;
  renderCheckSheet();
}
function csAddSection(groupId){
  if(guardNotAdmin())return;
  const g = (DB.csTemplates||[]).find(x=>x.id===groupId); if(!g) return;
  const name = prompt('Tên khu vực máy mới (VD: MÁY RÚT):');
  if(!name || !name.trim()) return;
  g.sections = g.sections || [];
  g.sections.push({id:'css_'+Date.now(), name:name.trim(), items:[]});
  saveCsTemplates();
  renderCheckSheet();
}
function csRenameSection(groupId, sectionId){
  if(guardNotAdmin())return;
  const g = (DB.csTemplates||[]).find(x=>x.id===groupId); if(!g) return;
  const sec = (g.sections||[]).find(x=>x.id===sectionId); if(!sec) return;
  const name = prompt('Đổi tên khu vực máy:', sec.name);
  if(!name || !name.trim()) return;
  sec.name = name.trim();
  saveCsTemplates();
  renderCheckSheet();
}
function csDeleteSection(groupId, sectionId){
  if(guardNotAdmin())return;
  const g = (DB.csTemplates||[]).find(x=>x.id===groupId); if(!g) return;
  const sec = (g.sections||[]).find(x=>x.id===sectionId); if(!sec) return;
  if(!confirm(`Xoá khu vực máy "${sec.name}" và toàn bộ hạng mục bên trong?`)) return;
  g.sections = (g.sections||[]).filter(x=>x.id!==sectionId);
  saveCsTemplates();
  renderCheckSheet();
}
function csAddItem(groupId, sectionId){
  if(guardNotAdmin())return;
  const g = (DB.csTemplates||[]).find(x=>x.id===groupId); if(!g) return;
  const sec = (g.sections||[]).find(x=>x.id===sectionId); if(!sec) return;
  const name = prompt('Tên hạng mục kiểm tra mới (VD: Kiểm tra dầu 46):');
  if(!name || !name.trim()) return;
  const std = prompt('Tiêu chuẩn kiểm tra (không bắt buộc):', '') || '';
  sec.items = sec.items || [];
  sec.items.push({id:'i_'+Date.now(), name:name.trim(), std:std.trim()});
  saveCsTemplates();
  renderCheckSheet();
}
function csEditItem(groupId, sectionId, itemId){
  if(guardNotAdmin())return;
  const g = (DB.csTemplates||[]).find(x=>x.id===groupId); if(!g) return;
  const sec = (g.sections||[]).find(x=>x.id===sectionId); if(!sec) return;
  const it = (sec.items||[]).find(x=>x.id===itemId); if(!it) return;
  const name = prompt('Đổi tên hạng mục:', it.name);
  if(!name || !name.trim()) return;
  const std = prompt('Tiêu chuẩn kiểm tra (không bắt buộc):', it.std||'');
  it.name = name.trim();
  it.std = (std==null?it.std:std.trim());
  saveCsTemplates();
  renderCheckSheet();
}
function csDeleteItem(groupId, sectionId, itemId){
  if(guardNotAdmin())return;
  const g = (DB.csTemplates||[]).find(x=>x.id===groupId); if(!g) return;
  const sec = (g.sections||[]).find(x=>x.id===sectionId); if(!sec) return;
  const it = (sec.items||[]).find(x=>x.id===itemId); if(!it) return;
  if(!confirm(`Xoá hạng mục "${it.name}"?`)) return;
  sec.items = (sec.items||[]).filter(x=>x.id!==itemId);
  saveCsTemplates();
  renderCheckSheet();
}

function csSectionRowsHTML(group, sec, dayCols, admin, viewer){
  const manage = admin && _csManageMode;
  const totalCols = 3 + dayCols.length + (manage?1:0);
  const header = `<tr>
    <td colspan="${totalCols}" style="border:1px solid var(--border);padding:6px 8px;background:var(--bg2,#eef2f7);font-weight:800;font-size:12px">
      ${(sec.name||'').toString().replace(/</g,'&lt;')}
      ${manage?` <button class="icon-btn" style="font-size:11px" onclick="csRenameSection('${group.id}','${sec.id}')" title="Đổi tên khu vực máy">✏️</button><button class="icon-btn del" style="font-size:11px" onclick="csDeleteSection('${group.id}','${sec.id}')" title="Xoá khu vực máy">🗑</button><button class="icon-btn" style="font-size:11px" onclick="csAddItem('${group.id}','${sec.id}')" title="Thêm hạng mục">➕ Hạng mục</button>`:''}
    </td>
  </tr>`;
  let stt = 0;
  const rows = (sec.items||[]).map(it=>{
    stt++;
    const itemKey = group.id+'|'+sec.id+'|'+it.id;
    return `<tr>
      <td style="position:sticky;left:0;background:var(--card);border:1px solid var(--border);padding:5px 6px;text-align:center">${stt}</td>
      <td style="position:sticky;left:28px;background:var(--card);border:1px solid var(--border);padding:5px 8px">${(it.name||'').toString().replace(/</g,'&lt;')}</td>
      <td style="border:1px solid var(--border);padding:5px 8px;font-size:11px;color:var(--text3)">${(it.std||'—').toString().replace(/</g,'&lt;')}</td>
      ${dayCols.map(day=>{
        const v = csCellStatus(itemKey, day);
        const st = CS_STATUS[v];
        return `<td id="csCell_${itemKey}_${day}" onclick="csCycleCell('${itemKey}',${day})" title="${st?st.label:'Bấm để đánh dấu'}" style="border:1px solid var(--border);padding:0;text-align:center;height:28px;width:28px;font-weight:800;font-size:12px;cursor:${viewer?'default':'pointer'};color:${st?st.color:'var(--text4)'};background:${st?st.bg:''}">${st?st.short:''}</td>`;
      }).join('')}
      ${manage?`<td style="border:1px solid var(--border);padding:2px;text-align:center;white-space:nowrap"><button class="icon-btn" style="font-size:11px" onclick="csEditItem('${group.id}','${sec.id}','${it.id}')" title="Sửa">✏️</button><button class="icon-btn del" style="font-size:11px" onclick="csDeleteItem('${group.id}','${sec.id}','${it.id}')" title="Xoá">🗑</button></td>`:''}
    </tr>`;
  }).join('');
  return header + rows;
}

function renderCheckSheet(){
  const admin = isAdmin();
  const viewer = isViewer();
  const groups = DB.csTemplates || [];
  if(!_csActiveGroup || !groups.find(g=>g.id===_csActiveGroup)) _csActiveGroup = groups[0] ? groups[0].id : null;
  const ym = csYM();
  const [y,m] = ym.split('-').map(Number);
  const nDays = daysInMonth(ym);
  const dayCols = Array.from({length:nDays}, (_,i)=>i+1);
  const group = groups.find(g=>g.id===_csActiveGroup);

  let totalOk=0, totalNg=0;
  if(group){
    (group.sections||[]).forEach(sec=>(sec.items||[]).forEach(it=>{
      const itemKey = group.id+'|'+sec.id+'|'+it.id;
      const data = (DB.csData[ym]||{})[itemKey] || {};
      Object.values(data).forEach(v=>{ if(v==='ok') totalOk++; else if(v==='ng') totalNg++; });
    }));
  }

  $('mc').innerHTML = `
    <div class="card" style="padding:12px 14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Check Sheet Thiết bị — Tháng ${m}/${y}</div>
          <div style="font-size:20px;font-weight:800;color:var(--brand);margin-top:2px">${groups.length} nhóm thiết bị <span style="font-size:12px;font-weight:600;color:var(--text3)">· ✅ ${totalOk} lượt đạt · ⚠️ ${totalNg} lượt cần bảo trì (tháng này)</span></div>
        </div>
        ${!viewer?`<button class="chip" style="font-size:11.5px;padding:6px 12px;font-weight:700" onclick="goTab('baoTriMay')" title="Xem lịch sử bảo trì máy">🛠 Bảo trì máy →</button>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="chip" onclick="shiftCsMonth(-1)">←</button>
        <input type="month" class="field-inp" style="width:auto;flex:1;min-width:130px" value="${ym}" onchange="changeCsMonth(this.value)">
        <button class="chip" onclick="shiftCsMonth(1)">→</button>
        <button class="chip" onclick="changeCsMonth(todayStr().slice(0,7))">Tháng này</button>
      </div>
      ${!viewer?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        ${group?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="exportCheckSheetExcel('${group.id}')">⬇️ Xuất Excel</button>`:''}
        ${admin?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;${_csManageMode?'background:var(--brand);color:#fff;font-weight:700':''}" onclick="csToggleManage()">${_csManageMode?'✅ Xong quản lý':'⚙️ Quản lý hạng mục'}</button>`:''}
        ${admin?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="csAddGroup()">➕ Thêm nhóm thiết bị</button>`:''}
      </div>`:''}
    </div>

    <div class="khm-tabs" style="align-items:center">
      ${groups.map(g=>`<button class="khm-tab-btn ${g.id===_csActiveGroup?'active':''}" onclick="csGoGroup('${g.id}')">${(g.name||'').toString().replace(/</g,'&lt;')}${(admin&&_csManageMode&&g.id===_csActiveGroup)?` <span onclick="event.stopPropagation();csRenameGroup('${g.id}')" title="Đổi tên">✏️</span> <span onclick="event.stopPropagation();csDeleteGroup('${g.id}')" title="Xoá">🗑</span>`:''}</button>`).join('')}
    </div>

    ${!group ? `<div class="card" style="padding:24px;text-align:center;color:var(--text4)">Chưa có nhóm thiết bị nào${admin?' · bấm "➕ Thêm nhóm thiết bị" để bắt đầu':''}</div>` : `
    <div class="card" style="padding:8px;overflow-x:auto;margin-top:8px">
      <div style="text-align:center;font-weight:700;font-size:14px;margin:4px 0 8px;text-transform:uppercase">BẢNG KIỂM THIẾT BỊ — ${(group.name||'').toString().replace(/</g,'&lt;')}</div>
      <table style="border-collapse:collapse;font-size:11.5px;white-space:nowrap">
        <thead>
          <tr>
            <th style="position:sticky;left:0;background:var(--card);border:1px solid var(--border);padding:5px 6px;min-width:28px;z-index:2">STT</th>
            <th style="position:sticky;left:28px;background:var(--card);border:1px solid var(--border);padding:5px 8px;min-width:170px;text-align:left;z-index:2">Hạng mục</th>
            <th style="border:1px solid var(--border);padding:5px 8px;min-width:100px">Tiêu chuẩn</th>
            ${dayCols.map(day=>`<th style="border:1px solid var(--border);padding:4px 2px;min-width:30px;text-align:center">
              <div style="font-size:12px;font-weight:700">${day}</div>
              <div style="font-weight:700;color:${weekdayVN(y,m,day)==='CN'?'var(--red-m)':'var(--brand2)'};font-size:9px;margin-top:1px">${weekdayVN(y,m,day)}</div>
            </th>`).join('')}
            ${admin&&_csManageMode?'<th style="border:1px solid var(--border);padding:5px 6px;min-width:30px"></th>':''}
          </tr>
        </thead>
        <tbody>
          ${(group.sections||[]).map(sec=>csSectionRowsHTML(group, sec, dayCols, admin, viewer)).join('')}
          ${(!group.sections || !group.sections.length) ? `<tr><td colspan="${3+nDays+(admin&&_csManageMode?1:0)}" style="padding:16px;text-align:center;color:var(--text4);border:1px solid var(--border)">Chưa có khu vực máy nào${admin?' · bấm "➕ Thêm khu vực máy" bên dưới':''}</td></tr>` : ''}
        </tbody>
      </table>
      ${admin&&_csManageMode?`<div style="padding:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="csAddSection('${group.id}')">➕ Thêm khu vực máy</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;color:#dc2626" onclick="csDeleteGroup('${group.id}')">🗑 Xoá nhóm thiết bị này</button>
      </div>`:''}
    </div>
    <div class="card" style="padding:12px 14px;margin-top:8px;font-size:12px;color:var(--text3);line-height:1.6">
      <b>Ký hiệu:</b>
      <span style="display:inline-flex;align-items:center;gap:4px;margin-left:8px"><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${CS_STATUS.ok.bg};color:${CS_STATUS.ok.color};text-align:center;font-weight:800;line-height:16px;font-size:11px">${CS_STATUS.ok.short}</span> ${CS_STATUS.ok.label}</span>
      <span style="display:inline-flex;align-items:center;gap:4px;margin-left:16px"><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${CS_STATUS.ng.bg};color:${CS_STATUS.ng.color};text-align:center;font-weight:800;line-height:16px;font-size:11px">${CS_STATUS.ng.short}</span> ${CS_STATUS.ng.label}</span>
      <div style="margin-top:6px">${viewer?'Bạn đang ở chế độ chỉ xem.':'Bấm vào từng ô ngày để chuyển trạng thái: Trống → ✓ Đạt → ✗ Cần bảo trì → Trống.'}</div>
    </div>`}
  `;
}
