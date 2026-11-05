// src/modules/audit/audit-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Nhật ký
const ACT_ICO={'Đăng nhập':'🔑','Đăng xuất':'🚪','Thêm đơn':'🆕','Sửa đơn':'✏️','Xóa đơn':'🗑️','Đang chạy':'⚙️','Xong':'✅','Chờ SX':'⏳','Sửa TK':'👤','Thêm TK':'➕','Xóa TK':'🗑️','Đổi MK':'🔐','Đổi MK TK':'🔐','Chấm công':'🗓️','Thêm người lao động':'➕','Sửa tên người lao động':'✏️','Xóa người lao động':'🗑️','Lưu chấm công':'💾','Tự chốt sổ chấm công':'📦','Kỷ luật':'⚠️','Nghỉ phép':'🏖️'};
// Format before/after thành dạng dễ đọc
function fmtLogChange(obj){
  if(!obj) return '';
  if(typeof obj !== 'object') return String(obj);
  const labelMap = {
    status: v=>({pending:'⏳ Chờ SX',running:'⚙️ Đang chạy',done:'✅ Xong',cutting:'⚙️ Đang chạy'}[v]||v),
    customer: v=>`Khách: ${v}`,
    priority: v=>`Ưu tiên: ${v}`,
    doneQty: v=>`Đã chạy: ${v} thanh`,
    matCodes: v=>v&&v.length?`Mã NL: ${v.join(', ')}`:'',
    note: v=>v?`Ghi chú: ${v}`:'',
    role: v=>({admin:'👑 Admin',staff:'⚙️ Nhân viên',viewer:'👁 Xem'}[v]||v),
    công: v=>`Công: ${v}`,
  };
  return Object.entries(obj)
    .filter(([k,v])=>v!==null&&v!==undefined&&v!=='')
    .map(([k,v])=>{ const f=labelMap[k]; return f?f(v):`${k}: ${Array.isArray(v)?v.join(', '):v}`; })
    .filter(Boolean).join(' · ');
}

let _logSearchQ = '';

function renderNhatKy(){
  actLog.forEach(l=>l.read=true); logSave(); updateLogBadge();
  const siOld=document.getElementById('logSearch');
  let caretPos=null, hadFocus=false;
  if(siOld){ _logSearchQ=siOld.value; hadFocus=document.activeElement===siOld; caretPos=siOld.selectionStart; }

  let list=actLog.slice(0,300);
  if(_logSearchQ){
    const q=_logSearchQ.toLowerCase();
    list=list.filter(l=>(l.action||'').toLowerCase().includes(q)||(l.detail||'').toLowerCase().includes(q)||(l.user||'').toLowerCase().includes(q)||(l.orderId||'').toLowerCase().includes(q));
  }

  $('mc').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="sec-title">Nhật ký (${actLog.length})</div>
      ${isAdmin()?`<button onclick="clearLog()" style="font-size:12px;color:var(--red-m);border:1px solid var(--red-l);background:var(--red-l);padding:4px 10px;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600">Xoá log</button>`:''}
    </div>
    <div class="search-wrap" style="margin-bottom:8px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input class="search-inp" id="logSearch" type="search" placeholder="Tìm theo thao tác, người dùng, mã đơn..." value="${_logSearchQ}" autocomplete="off">
    </div>
    ${list.length===0
      ? '<div class="empty"><div class="empty-icon">📋</div>'+(_logSearchQ?`Không tìm thấy "${_logSearchQ}"`:'Chưa có hoạt động')+'</div>'
      : list.map(l=>{
          const dt=new Date(l.ts);
          const t=vnDateTimeShort(dt);
          const bTxt=fmtLogChange(l.before);
          const aTxt=fmtLogChange(l.after);
          const aSt=l.after&&l.after.status;
          const aCol=aSt?({pending:'var(--amber-m)',running:'var(--brand)',done:'var(--green-m)'}[aSt]||'var(--green-m)'):'var(--green-m)';
          return `<div class="act-row">
            <div class="act-icon-wrap">${ACT_ICO[l.action]||'📌'}</div>
            <div class="act-body">
              <div class="act-main">${l.action}</div>
              ${l.detail?`<div class="act-detail">${l.detail}</div>`:''}
              ${(bTxt||aTxt)?`<div style="margin-top:4px;display:flex;flex-direction:column;gap:3px">
                ${bTxt?`<div style="font-size:11px;background:var(--amber-l);padding:3px 8px;border-radius:5px;border-left:2px solid var(--amber-m);color:var(--amber)">← ${bTxt}</div>`:''}
                ${aTxt?`<div style="font-size:11px;background:var(--green-l);padding:3px 8px;border-radius:5px;border-left:2px solid var(--green-m);color:${aCol}">→ ${aTxt}</div>`:''}
              </div>`:''}
              <div class="act-meta" style="margin-top:3px">👤 <b>${l.user}</b> · ${l.role==='admin'?'👑':l.role==='solieu'?'📊':'⚙️'} · 🕐 ${t}</div>
              ${l.orderId?`<div class="act-oid">🔖 ${l.orderId}</div>`:''}
            </div>
          </div>`;
        }).join('')
    }
  `;
  const ni=document.getElementById('logSearch');
  if(ni){
    ni.addEventListener('input',function(){_logSearchQ=this.value;renderNhatKy();});
    if(hadFocus){
      ni.focus();
      const pos = caretPos!==null ? Math.min(caretPos, ni.value.length) : ni.value.length;
      try{ ni.setSelectionRange(pos, pos); }catch(e){}
    }
  }
}
function clearLog(){if(guardViewer())return; confirm2('Xoá nhật ký','Xoá toàn bộ nhật ký thao tác?',()=>{ actLog=[]; saveLog(); renderNhatKy(); showToast('Đã xoá nhật ký'); }); }
