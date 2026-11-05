// src/modules/audit/audit-log.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function saveLog(){
  logSave();
  if(!fbOk()) return;
  fbWrite('/log', actLog.slice(0,300), 'PUT').catch(()=>{});
}

// ════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ════════════════════════════════════════════════════════════
function log(action, detail, orderId, before, after){
  const e = {
    id:'l'+Date.now()+Math.random().toString(36).slice(2,5),
    ts: Date.now(),
    user: currentUser?.name||'?',
    userId: currentUser?.id||'?',
    role: currentUser?.role||'?',
    action, detail:''+( detail||''), orderId:orderId||'',
    before: before||null, after: after||null,
    read: false
  };
  actLog.unshift(e);
  if(actLog.length>300) actLog=actLog.slice(0,300);
  saveLog();
  updateLogBadge();
}

function updateLogBadge(){
  const n = actLog.filter(l=>!l.read).length;
  const sb = document.getElementById('sbLogBadge');
  if(sb){ sb.style.display=n>0?'inline-block':'none'; sb.textContent=n>9?'9+':n||'!'; }
  const bl = document.getElementById('bnLog');
  if(bl) bl.classList.toggle('show', n>0);
}
