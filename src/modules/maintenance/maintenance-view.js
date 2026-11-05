// src/modules/maintenance/maintenance-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// BẢO TRÌ MÁY (Nhân sự)
// ════════════════════════════════════════════════════════════
let _btmActive = null; // id máy đang xem lịch sử, null = xem lưới tổng quan
let _btmEditId = null; // id bản ghi đang sửa (null = thêm mới)
let _btmFilterMachineForModal = null;

// Trạng thái hiện tại của 1 máy, suy ra từ bản ghi mới nhất (không tính các
// bản ghi ghi-nhận-tấn/đã-thay-linh-kiện — những bản ghi đó không phải sự cố)
function machineStatus(machineId){
  const list = (DB.baoTri||[]).filter(r=>r.machineId===machineId && r.type!=='tonLog' && r.type!=='tonReset').sort((a,b)=>b.createdAt-a.createdAt);
  const latest = list[0];
  if(!latest || latest.status==='da_xong') return 'ok';
  return latest.type==='hong' ? 'hong' : 'baotri';
}
function machineStatusLabel(st){
  return st==='hong' ? '🔴 Đang hỏng' : st==='baotri' ? '🟡 Đang bảo trì' : '🟢 Hoạt động tốt';
}
function machineRecords(machineId){
  return (DB.baoTri||[]).filter(r=>r.machineId===machineId && r.type!=='tonLog' && r.type!=='tonReset').sort((a,b)=>b.createdAt-a.createdAt);
}

// ── Các bản ghi ghi-nhận-sản-lượng (tonLog) / đã-thay-linh-kiện (tonReset)
// của 1 máy, theo thứ tự thời gian tăng dần (dùng để tính tấn tích lũy)
function machineTonEvents(machineId){
  return (DB.baoTri||[]).filter(r=>r.machineId===machineId && (r.type==='tonLog'||r.type==='tonReset')).sort((a,b)=>a.createdAt-b.createdAt);
}

// Trạng thái tấn hiện tại của 1 máy kể từ lần thay gần nhất (null nếu máy
// không thuộc diện theo dõi tấn — VD máy đánh bóng)
function getMaintTonState(machineId){
  const m = MACHINES.find(x=>x.id===machineId); if(!m) return null;
  const mtype = maintTypeOfMachine(m); if(!mtype) return null;
  const info = MAINT_TON_INFO[mtype];
  const events = machineTonEvents(machineId);
  let lastReset = null;
  for(let i=events.length-1;i>=0;i--){ if(events[i].type==='tonReset'){ lastReset = events[i]; break; } }
  const since = lastReset ? events.filter(e=>e.createdAt>lastReset.createdAt) : events;
  const tonNow = since.filter(e=>e.type==='tonLog').reduce((s,e)=>s+(Number(e.tonAdded)||0),0);
  const lastChangeDate = lastReset ? lastReset.date : null;
  const level = tonNow>=info.dueFrom ? 'due' : tonNow>=info.warnFrom ? 'warn' : 'ok';
  const percent = Math.max(0, Math.min(100, Math.round(tonNow/info.dueFrom*100)));
  const days = lastChangeDate ? Math.max(0, Math.floor((Date.now()-new Date(lastChangeDate).getTime())/86400000)) : null;
  return {machineId, mtype, info, tonNow, lastChangeDate, level, percent, days, events};
}
function machineLastRecordText(machineId){
  const list = machineRecords(machineId);
  if(!list.length) return 'Chưa có lịch sử';
  const r = list[0];
  return `${r.status==='da_xong'?'Xong':'Đang xử lý'} · ${fmtDate(r.date)}`;
}

function renderBaoTriMay(){
  checkMaintTonAlerts();
  const admin = isStaff(); // admin + staff được thao tác, viewer chỉ xem
  const totalHong = MACHINES.filter(m=>machineStatus(m.id)==='hong').length;
  const totalBaoTri = MACHINES.filter(m=>machineStatus(m.id)==='baotri').length;

  if(!_btmActive){
    // ── Màn hình lưới tổng quan tất cả máy ──
    const groups = [...new Set(MACHINES.map(m=>m.group))];
    $('mc').innerHTML = `
      <div class="card" style="padding:12px 14px;display:flex;gap:16px;flex-wrap:wrap">
        <div style="font-size:12.5px"><b style="color:#166534">🟢 ${MACHINES.length-totalHong-totalBaoTri}</b> máy hoạt động tốt</div>
        <div style="font-size:12.5px"><b style="color:#b91c1c">🔴 ${totalHong}</b> máy đang hỏng</div>
        <div style="font-size:12.5px"><b style="color:#92400e">🟡 ${totalBaoTri}</b> máy đang bảo trì</div>
      </div>
      ${groups.map(g=>`
        <div class="btm-group-title">${g==='Máy đùn'?'🏭':g==='Máy rút'?'⚙️':'✨'} ${g}</div>
        <div class="machine-grid">
          ${MACHINES.filter(m=>m.group===g).map(m=>{
            const st = machineStatus(m.id);
            return `<div class="machine-card st-${st}" onclick="btmSelectMachine('${m.id}')">
              <div class="machine-card-icon">${m.icon}</div>
              <div class="machine-card-name">${m.name}</div>
              <div class="machine-card-status st-${st}">${machineStatusLabel(st)}</div>
              <div class="machine-card-sub">${machineLastRecordText(m.id)}</div>
            </div>`;
          }).join('')}
        </div>
      `).join('')}
    `;
    return;
  }

  // ── Màn hình chi tiết 1 máy: lịch sử sửa chữa / bảo trì ──
  const m = MACHINES.find(x=>x.id===_btmActive);
  if(!m){ _btmActive=null; renderBaoTriMay(); return; }
  const st = machineStatus(m.id);
  const records = machineRecords(m.id);

  $('mc').innerHTML = `
    <button class="btm-back" onclick="btmBack()">← Quay lại danh sách máy</button>
    <div class="card" style="padding:14px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="font-size:26px">${m.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:800;color:var(--text)">${m.name}</div>
          <div style="font-size:11.5px;color:var(--text3)">${m.group}</div>
        </div>
        <span class="machine-card-status st-${st}" style="font-size:11.5px">${machineStatusLabel(st)}</span>
      </div>
      ${admin?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="set-btn" style="width:auto;padding:9px 16px;font-size:12.5px;background:var(--red-m);color:#fff;font-weight:700" onclick="btmOpenAdd('${m.id}','hong')">🔴 Báo hỏng</button>
        <button class="set-btn" style="width:auto;padding:9px 16px;font-size:12.5px;background:#d97706;color:#fff;font-weight:700" onclick="btmOpenAdd('${m.id}','baotri')">🟡 Bảo trì định kỳ</button>
        <button class="set-btn" style="width:auto;padding:9px 16px;font-size:12.5px" onclick="btmOpenAdd('${m.id}','kiemtra')">🔵 Kiểm tra</button>
      </div>`:''}
    </div>
    ${renderMaintTonCard(m)}
    <div class="sec-title" style="margin-top:12px">📋 Lịch sử bảo trì / sửa chữa (${records.length})</div>
    ${records.length===0
      ? `<div class="empty"><div class="empty-icon">🛠️</div>Chưa có lịch sử bảo trì cho máy này</div>`
      : records.map(r=>`
        <div class="btm-hist-item ${r.type}">
          <div class="btm-hist-hd">
            <span class="btm-hist-type ${r.type}">${BTM_TYPE_LABEL[r.type]||r.type}</span>
            <span class="btm-hist-status ${r.status==='da_xong'?'done':''}">${r.status==='da_xong'?'✅ Đã xong':'⏳ Đang xử lý'}</span>
            <span class="btm-hist-date">🕐 ${fmtDate(r.date)}</span>
          </div>
          <div class="btm-hist-row">🔧 <b>Sự cố:</b> ${(r.issue||'—').replace(/</g,'&lt;')}</div>
          ${r.parts?`<div class="btm-hist-row">🔩 <b>Thay thế:</b> ${r.parts.replace(/</g,'&lt;')}</div>`:''}
          ${r.tech?`<div class="btm-hist-row">👤 <b>Người sửa:</b> ${r.tech.replace(/</g,'&lt;')}</div>`:''}
          ${r.cost?`<div class="btm-hist-row">💰 <b>Chi phí:</b> ${Number(r.cost).toLocaleString('vi-VN')}đ</div>`:''}
          ${r.note?`<div class="btm-hist-row">📝 ${r.note.replace(/</g,'&lt;')}</div>`:''}
          ${admin?`<div class="btm-hist-actions">
            ${r.status!=='da_xong'?`<button class="set-btn" style="width:auto;padding:6px 12px;font-size:11.5px;background:var(--green-m);color:#fff;font-weight:700" onclick="btmMarkDone('${r.id}')">✅ Đánh dấu xong</button>`:''}
            <button class="set-btn" style="width:auto;padding:6px 12px;font-size:11.5px" onclick="btmEditRecord('${r.id}')">✏️ Sửa</button>
            <button class="set-btn" style="width:auto;padding:6px 12px;font-size:11.5px;color:var(--red-m)" onclick="btmDeleteRecord('${r.id}')">🗑 Xóa</button>
          </div>`:''}
        </div>
      `).join('')}
  `;
}

function btmSelectMachine(id){ _btmActive = id; renderBaoTriMay(); }
function btmBack(){ _btmActive = null; renderBaoTriMay(); }

function btmOpenAdd(machineId, type){if(guardViewer())return;
  const m = MACHINES.find(x=>x.id===machineId); if(!m) return;
  _btmEditId = null;
  _btmFilterMachineForModal = machineId;
  $('btmModalTitle').textContent = 'Thêm bản ghi bảo trì';
  $('btmMachineName').value = m.name;
  $('btmType').value = type || 'hong';
  $('btmStatus').value = 'dang_sua';
  $('btmIssue').value = '';
  $('btmParts').value = '';
  $('btmTech').value = '';
  $('btmDate').value = new Date().toISOString().slice(0,10);
  $('btmCost').value = '';
  $('btmNote').value = '';
  $('btmErr').style.display = 'none';
  openModal('btmModal');
}

function btmEditRecord(id){if(guardViewer())return;
  const r = (DB.baoTri||[]).find(x=>x.id===id); if(!r) return;
  const m = MACHINES.find(x=>x.id===r.machineId);
  _btmEditId = id;
  _btmFilterMachineForModal = r.machineId;
  $('btmModalTitle').textContent = 'Sửa bản ghi bảo trì';
  $('btmMachineName').value = m?m.name:r.machineId;
  $('btmType').value = r.type||'hong';
  $('btmStatus').value = r.status||'dang_sua';
  $('btmIssue').value = r.issue||'';
  $('btmParts').value = r.parts||'';
  $('btmTech').value = r.tech||'';
  $('btmDate').value = r.date||new Date().toISOString().slice(0,10);
  $('btmCost').value = r.cost||'';
  $('btmNote').value = r.note||'';
  $('btmErr').style.display = 'none';
  openModal('btmModal');
}

function btmSaveRecord(){if(guardViewer())return;
  const issue = $('btmIssue').value.trim();
  if(!issue){ $('btmErr').textContent='Vui lòng nhập mô tả sự cố / máy hỏng gì'; $('btmErr').style.display='block'; return; }
  const machineId = _btmFilterMachineForModal;
  const m = MACHINES.find(x=>x.id===machineId);
  const data = {
    type: $('btmType').value,
    status: $('btmStatus').value,
    issue,
    parts: $('btmParts').value.trim(),
    tech: $('btmTech').value.trim(),
    date: $('btmDate').value || new Date().toISOString().slice(0,10),
    cost: $('btmCost').value ? Number($('btmCost').value) : 0,
    note: $('btmNote').value.trim()
  };

  if(_btmEditId){
    const r = (DB.baoTri||[]).find(x=>x.id===_btmEditId); if(!r) return;
    const before = {...r};
    Object.assign(r, data);
    saveBaoTri();
    log('Sửa bảo trì máy', `${m?m.name:r.machineId} · ${issue}`, '', before, r);
  } else {
    const rec = { id:'bt_'+uid(), machineId, createdAt:Date.now(), ...data };
    DB.baoTri.push(rec);
    saveBaoTri();
    log(data.type==='hong'?'Báo hỏng máy':'Bảo trì máy', `${m?m.name:machineId} · ${issue}`, '', null, rec);
  }
  closeModal('btmModal');
  updateBtmBadge();
  renderBaoTriMay();
  showToast('✅ Đã lưu bản ghi bảo trì');
}

function btmMarkDone(id){if(guardViewer())return;
  const r = (DB.baoTri||[]).find(x=>x.id===id); if(!r) return;
  const m = MACHINES.find(x=>x.id===r.machineId);
  r.status = 'da_xong';
  r.finishedAt = Date.now();
  saveBaoTri();
  log('Hoàn tất sửa chữa/bảo trì', `${m?m.name:r.machineId} · ${r.issue||''}`, '', null, {status:'da_xong'});
  updateBtmBadge();
  renderBaoTriMay();
  showToast('✅ Đã đánh dấu hoàn tất');
}

function btmDeleteRecord(id){if(guardViewer())return;
  const r = (DB.baoTri||[]).find(x=>x.id===id); if(!r) return;
  const m = MACHINES.find(x=>x.id===r.machineId);
  confirm2('Xóa bản ghi bảo trì', `Xóa bản ghi "${r.issue||''}" của ${m?m.name:r.machineId}?`, ()=>{
    DB.baoTri = DB.baoTri.filter(x=>x.id!==id);
    saveBaoTri();
    log('Xóa bảo trì máy', `${m?m.name:r.machineId} · ${r.issue||''}`, '', r, null);
    updateBtmBadge();
    renderBaoTriMay();
    showToast('Đã xóa');
  });
}
