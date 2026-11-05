// src/modules/maintenance/maintenance-ton.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// AI CẢNH BÁO BẢO TRÌ THEO TẤN (vành nước máy đùn / dầu máy rút)
// ════════════════════════════════════════════════════════════
function maintLevelColor(level){ return level==='due' ? 'var(--red-m)' : level==='warn' ? 'var(--amber-m)' : 'var(--green-m)'; }
function maintLevelBg(level){ return level==='due' ? 'var(--red-l)' : level==='warn' ? 'var(--amber-l)' : 'var(--green-l)'; }
function maintLevelTag(level){ return level==='due' ? 'QUÁ HẠN' : level==='warn' ? 'SẮP ĐẾN HẠN' : 'AN TOÀN'; }
function maintLevelMsg(level, info){
  if(level==='due') return `⛔ Đã chạy vượt ${info.dueFrom} ${info.unit} — cần thay ${info.partName.toLowerCase()} ngay`;
  if(level==='warn') return `⚠️ Đã chạy trên ${info.warnFrom} ${info.unit} — chuẩn bị thay ${info.partName.toLowerCase()} trong thời gian tới`;
  return `🟢 Vẫn trong ngưỡng an toàn`;
}
function maintLevelRank(l){ return l==='due'?2:l==='warn'?1:0; }

// Thẻ theo dõi tấn — hiển thị trong màn hình chi tiết máy (Bảo trì máy)
function renderMaintTonCard(m){
  const st = getMaintTonState(m.id); if(!st) return '';
  const admin = isStaff();
  const color = maintLevelColor(st.level), bg = maintLevelBg(st.level);
  const warnPct = Math.min(100, Math.round(st.info.warnFrom/st.info.dueFrom*100));
  const hist = st.events.slice().reverse().slice(0,10);
  return `
  <div class="card maint-ton-card" style="padding:14px;margin-top:12px;border:1.5px solid ${color}">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-size:22px">${st.info.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:800;color:var(--text)">${st.info.partName}</div>
        <div style="font-size:11px;color:var(--text3)">🤖 AI theo dõi hạn thay theo sản lượng (tấn)</div>
      </div>
      <span style="font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;background:${bg};color:${color};white-space:nowrap">${maintLevelTag(st.level)}</span>
    </div>
    <div class="maint-progress" style="position:relative;margin-top:12px;height:10px;border-radius:20px;background:var(--bg);overflow:hidden">
      <div style="position:absolute;left:0;top:0;bottom:0;width:${st.percent}%;background:${color};border-radius:20px;transition:width .3s"></div>
      <div style="position:absolute;left:${warnPct}%;top:-2px;bottom:-2px;width:2px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.15)" title="Mốc cảnh báo ${st.info.warnFrom} ${st.info.unit}"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:11.5px;color:var(--text3);margin-top:6px">
      <span><b style="color:${color};font-size:15px">${st.tonNow.toFixed(1)}</b> / ${st.info.dueFrom} ${st.info.unit}</span>
      <span>⚠️ từ ${st.info.warnFrom} ${st.info.unit}</span>
    </div>
    <div style="font-size:11.5px;color:var(--text3);margin-top:8px">🗓️ Lần thay gần nhất: <b style="color:var(--text2)">${st.lastChangeDate?fmtDate(st.lastChangeDate):'Chưa ghi nhận'}</b>${st.days!=null?` · ${st.days} ngày trước`:''}</div>
    <div style="font-size:12px;font-weight:700;color:${color};margin-top:6px">${maintLevelMsg(st.level, st.info)}</div>
    ${admin?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12px" onclick="btmOpenTonLog('${m.id}')">➕ Ghi sản lượng</button>
      <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12px;background:var(--green-m);color:#fff;font-weight:700" onclick="btmOpenTonReset('${m.id}')">✅ Đã thay ${st.info.partName}</button>
    </div>`:''}
    ${hist.length?`<details style="margin-top:10px">
      <summary style="cursor:pointer;font-size:11.5px;color:var(--text3);font-weight:700">📜 Lịch sử ghi nhận (${hist.length})</summary>
      <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">
        ${hist.map(e=>`<div style="font-size:11px;color:var(--text3);padding:5px 9px;background:var(--bg);border-radius:6px">
          ${e.type==='tonReset'?`✅ <b style="color:var(--green-m)">Đã thay ${st.info.partName}</b>`:`➕ <b>+${Number(e.tonAdded).toFixed(1)} ${st.info.unit}</b>`} · ${fmtDate(e.date)}${e.note?` · ${e.note.replace(/</g,'&lt;')}`:''}
        </div>`).join('')}
      </div>
    </details>`:''}
  </div>`;
}

let _tonModalMachineId = null;

function btmOpenTonLog(machineId){ if(guardViewer())return;
  const m = MACHINES.find(x=>x.id===machineId); if(!m) return;
  const st = getMaintTonState(machineId); if(!st) return;
  _tonModalMachineId = machineId;
  $('tonLogMachineName').value = m.name;
  $('tonLogPartName').textContent = st.info.partName;
  $('tonLogAmount').value = '';
  $('tonLogDate').value = new Date().toISOString().slice(0,10);
  $('tonLogNote').value = '';
  $('tonLogErr').style.display = 'none';
  openModal('tonLogModal');
}

function tonLogSave(){ if(guardViewer())return;
  const amount = Number($('tonLogAmount').value);
  if(!amount || amount<=0){ $('tonLogErr').textContent='Vui lòng nhập số tấn hợp lệ (lớn hơn 0)'; $('tonLogErr').style.display='block'; return; }
  const machineId = _tonModalMachineId;
  const m = MACHINES.find(x=>x.id===machineId); if(!m) return;
  const before = getMaintTonState(machineId);
  const rec = { id:'bt_'+uid(), machineId, type:'tonLog', createdAt:Date.now(),
    date: $('tonLogDate').value || new Date().toISOString().slice(0,10),
    tonAdded: amount, note: $('tonLogNote').value.trim(), by: currentUser?.name||'' };
  DB.baoTri.push(rec);
  saveBaoTri();
  log('Ghi sản lượng máy', `${m.name} · +${amount} tấn`, '', null, rec);
  closeModal('tonLogModal');
  renderBaoTriMay();
  showToast(`✅ Đã ghi +${amount} tấn cho ${m.name}`);
  const after = getMaintTonState(machineId);
  if(after && before && maintLevelRank(after.level) > maintLevelRank(before.level)){
    showMaintAlertModal([{machineId, state:after}]);
  }
}

function btmOpenTonReset(machineId){ if(guardViewer())return;
  const m = MACHINES.find(x=>x.id===machineId); if(!m) return;
  const st = getMaintTonState(machineId); if(!st) return;
  _tonModalMachineId = machineId;
  $('tonResetMachineName').value = m.name;
  $('tonResetPartName').textContent = st.info.partName;
  $('tonResetCurrentTon').textContent = `${st.tonNow.toFixed(1)} ${st.info.unit}`;
  $('tonResetDate').value = new Date().toISOString().slice(0,10);
  $('tonResetNote').value = '';
  openModal('tonResetModal');
}

function tonResetSave(){ if(guardViewer())return;
  const machineId = _tonModalMachineId;
  const m = MACHINES.find(x=>x.id===machineId); if(!m) return;
  const st = getMaintTonState(machineId); if(!st) return;
  const rec = { id:'bt_'+uid(), machineId, type:'tonReset', createdAt:Date.now(),
    date: $('tonResetDate').value || new Date().toISOString().slice(0,10),
    tonAtReset: st.tonNow, note: $('tonResetNote').value.trim(), by: currentUser?.name||'' };
  DB.baoTri.push(rec);
  saveBaoTri();
  log(`Đã thay ${st.info.partName}`, `${m.name} · sau ${st.tonNow.toFixed(1)} ${st.info.unit}`, '', null, rec);
  closeModal('tonResetModal');
  renderBaoTriMay();
  showToast(`✅ Đã ghi nhận thay ${st.info.partName} cho ${m.name}`);
  try{
    const seen = JSON.parse(sessionStorage.getItem('sxMaintAlertSeen')||'[]');
    sessionStorage.setItem('sxMaintAlertSeen', JSON.stringify(seen.filter(k=>!k.startsWith(machineId+':'))));
  }catch(e){}
}

// Quét toàn bộ máy có theo dõi tấn, gom máy nào đang ở mức cảnh báo/quá hạn
// mà CHƯA hiện cho người dùng trong phiên làm việc này → hiện cửa sổ cảnh báo.
function checkMaintTonAlerts(){
  if(typeof MACHINES==='undefined' || typeof getMaintTonState!=='function') return;
  let seen; try{ seen = JSON.parse(sessionStorage.getItem('sxMaintAlertSeen')||'[]'); }catch(e){ seen=[]; }
  const list = [];
  MACHINES.forEach(m=>{
    const st = getMaintTonState(m.id); if(!st || st.level==='ok') return;
    const key = m.id+':'+st.level;
    if(!seen.includes(key)){ list.push({machineId:m.id, state:st}); seen.push(key); }
  });
  if(list.length){
    try{ sessionStorage.setItem('sxMaintAlertSeen', JSON.stringify(seen)); }catch(e){}
    showMaintAlertModal(list);
  }
}

// Cửa sổ cảnh báo nhỏ, hiện đại — hiện chi tiết từng máy đang cần chú ý
function showMaintAlertModal(list){
  if(!list || !list.length) return;
  const worst = list.some(x=>x.state.level==='due') ? 'due' : 'warn';
  $('maintAlertTitle').innerHTML = worst==='due'
    ? '⛔ Có máy đã QUÁ HẠN bảo trì'
    : '⚠️ Có máy SẮP ĐẾN HẠN bảo trì';
  $('maintAlertBody').innerHTML = list.map(({machineId,state})=>{
    const m = MACHINES.find(x=>x.id===machineId);
    const color = maintLevelColor(state.level), bg = maintLevelBg(state.level);
    const warnPct = Math.min(100, Math.round(state.info.warnFrom/state.info.dueFrom*100));
    return `
    <div class="maint-alert-card" style="border:1.5px solid ${color};border-radius:14px;padding:12px;margin-bottom:10px;background:linear-gradient(180deg,#fff,${bg}30)">
      <div style="display:flex;align-items:center;gap:9px">
        <div style="font-size:22px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:${bg};border-radius:10px">${m?m.icon:'🔧'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:800;color:var(--text)">${m?m.name:machineId}</div>
          <div style="font-size:11px;color:var(--text3)">${state.info.icon} ${state.info.partName}</div>
        </div>
        <span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;background:${bg};color:${color};white-space:nowrap">${maintLevelTag(state.level)}</span>
      </div>
      <div style="position:relative;margin-top:10px;height:9px;border-radius:20px;background:var(--bg);overflow:hidden">
        <div style="position:absolute;left:0;top:0;bottom:0;width:${state.percent}%;background:${color};border-radius:20px"></div>
        <div style="position:absolute;left:${warnPct}%;top:-2px;bottom:-2px;width:2px;background:#fff"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-top:5px">
        <span><b style="color:${color};font-size:13.5px">${state.tonNow.toFixed(1)}</b> / ${state.info.dueFrom} ${state.info.unit}</span>
        <span>🗓️ Thay lần cuối: ${state.lastChangeDate?fmtDate(state.lastChangeDate):'chưa có'}${state.days!=null?` (${state.days} ngày)`:''}</span>
      </div>
      <div style="font-size:12px;font-weight:700;color:${color};margin-top:7px">${maintLevelMsg(state.level, state.info)}</div>
      <button class="set-btn" style="width:auto;padding:7px 13px;font-size:11.5px;margin-top:8px;background:${color};color:#fff;font-weight:700;border:none" onclick="closeModal('maintAlertModal');goTab('baoTriMay');btmSelectMachine('${machineId}')">🔍 Xem chi tiết máy</button>
    </div>`;
  }).join('');
  openModal('maintAlertModal');
}
