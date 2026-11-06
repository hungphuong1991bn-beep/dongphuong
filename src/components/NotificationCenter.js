// src/components/NotificationCenter.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- NOTIFICATION PANEL OVERLAY -->
<div class="notif-overlay" id="notifOverlay" onclick="closeNotifPanel()"></div>

<!-- NOTIFICATION PANEL -->
<div class="notif-panel" id="notifPanel">
  <div class="notif-panel-hd">
    <div class="notif-avatar" style="background:#eff6ff;font-size:18px">🔔</div>
    <h3>Thông báo</h3>
    <button onclick="markAllRead()" style="font-size:11.5px;color:var(--brand);border:1px solid #bfdbfe;background:#eff6ff;border-radius:7px;padding:4px 10px;cursor:pointer;font-family:inherit;font-weight:600;white-space:nowrap">Đọc hết</button>
    <button onclick="closeNotifPanel()" style="border:none;background:var(--bg);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;color:var(--text3);flex-shrink:0">✕</button>
  </div>
  <div class="notif-list" id="notifList"></div>
  <div class="notif-compose" id="notifCompose">
    <div class="notif-compose-title">📢 Gửi thông báo cho cả nhóm</div>
    <div class="notif-compose-row">
      <input class="notif-compose-inp" id="notifInp" placeholder="Nhập nội dung thông báo..." maxlength="200" onkeydown="if(event.key==='Enter')sendBroadcast()">
      <button class="notif-compose-send" onclick="sendBroadcast()">➤</button>
    </div>
  </div>
</div>

<!-- ANNOUNCE MODAL -->
<div class="modal" id="announceModal">
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">📢 Viết thông báo cho cả nhóm</div>
    <div class="field">
      <div class="field-lbl">Loại thông báo</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="annTypeGrid">
        <button class="ann-type-btn active" data-type="info" onclick="selectAnnType(this,'info')"
          style="padding:10px;border-radius:10px;border:2px solid var(--brand);background:#eff6ff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;color:var(--brand)">
          ℹ️ Thông tin
        </button>
        <button class="ann-type-btn" data-type="warn" onclick="selectAnnType(this,'warn')"
          style="padding:10px;border-radius:10px;border:2px solid var(--border);background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--text3)">
          ⚠️ Lưu ý
        </button>
        <button class="ann-type-btn" data-type="urgent" onclick="selectAnnType(this,'urgent')"
          style="padding:10px;border-radius:10px;border:2px solid var(--border);background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--text3)">
          🚨 Khẩn cấp
        </button>
        <button class="ann-type-btn" data-type="ok" onclick="selectAnnType(this,'ok')"
          style="padding:10px;border-radius:10px;border:2px solid var(--border);background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--text3)">
          ✅ Thông báo tốt
        </button>
      </div>
    </div>
    <div class="field">
      <div class="field-lbl">Nội dung thông báo *</div>
      <textarea id="annMsg" class="field-inp" rows="3" placeholder="Nhập nội dung thông báo cho cả đội..." style="resize:none;height:90px;line-height:1.5"></textarea>
      <div style="font-size:11px;color:var(--text4);margin-top:4px;text-align:right"><span id="annCount">0</span>/200 ký tự</div>
    </div>
    <div id="annPreview" style="display:none;margin-bottom:4px">
      <div class="field-lbl" style="margin-bottom:6px">Xem trước</div>
      <div id="annPreviewBar"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <div class="field" style="flex:1;margin:0">
        <div class="field-lbl">Tự xóa sau</div>
        <select id="annExpire" class="field-inp">
          <option value="0">Không tự xóa</option>
          <option value="3600000">1 giờ</option>
          <option value="28800000" selected>8 giờ</option>
          <option value="86400000">1 ngày</option>
          <option value="259200000">3 ngày</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('announceModal')">Huỷ</button>
      <button class="btn btn-primary" onclick="publishAnnounce()">📢 Gửi thông báo</button>
    </div>
  </div>
</div>`);


// ════════════════════════════════════════════════════════════
// ANNOUNCE SYSTEM — Admin viết → hiện ở MỌI TAB cho tất cả
// ════════════════════════════════════════════════════════════
const ANN_KEY = 'sx_announce_v1';
let _annType = 'info';
let _currentAnn = null;

const ANN_ICO  = {info:'ℹ️',warn:'⚠️',urgent:'🚨',ok:'✅'};
const ANN_LABEL= {info:'Thông tin',warn:'Lưu ý',urgent:'KHẨN CẤP',ok:'Thông báo tốt'};

function openAnnounce(){if(guardViewer())return;
  _annType='info';
  const ta=$('annMsg'); if(ta){ta.value='';ta.focus();}
  $('annCount').textContent='0';
  $('annPreview').style.display='none';
  // Reset type buttons
  document.querySelectorAll('.ann-type-btn').forEach(b=>{
    b.style.borderColor='var(--border)';b.style.background='#fff';b.style.color='var(--text3)';b.style.fontWeight='600';
  });
  const first=document.querySelector('.ann-type-btn[data-type="info"]');
  if(first){first.style.borderColor='var(--brand)';first.style.background='#eff6ff';first.style.color='var(--brand)';first.style.fontWeight='700';}
  openModal('announceModal');
  // Đếm ký tự realtime + preview
  setTimeout(()=>{
    const t=$('annMsg');
    if(t) t.oninput=function(){
      const n=this.value.length;
      $('annCount').textContent=n;
      if(n>0){ $('annPreview').style.display='block'; renderAnnPreview(this.value); }
      else $('annPreview').style.display='none';
    };
  },100);
}

function selectAnnType(btn, type){
  _annType=type;
  document.querySelectorAll('.ann-type-btn').forEach(b=>{
    b.style.borderColor='var(--border)';b.style.background='#fff';b.style.color='var(--text3)';b.style.fontWeight='600';
  });
  const colors={info:['var(--brand)','#eff6ff'],warn:['#b45309','#fffbeb'],urgent:['#dc2626','#fef2f2'],ok:['#059669','#f0fdf4']};
  const [c,bg]=colors[type]||colors.info;
  btn.style.borderColor=c;btn.style.background=bg;btn.style.color=c;btn.style.fontWeight='700';
  const msg=$('annMsg');
  if(msg&&msg.value.length>0) renderAnnPreview(msg.value);
}

function renderAnnPreview(msg){
  const el=$('annPreviewBar'); if(!el) return;
  el.innerHTML=buildAnnHTML({type:_annType,msg,from:currentUser?.name||'Admin',ts:Date.now(),expire:0});
}

function buildAnnHTML(ann){
  const t=vnDateTimeShort(new Date(ann.ts));
  // Tính % thời gian còn lại để tự xóa
  let timerBar='';
  if(ann.expireAt&&ann.expire){
    const pct=Math.max(0,Math.min(100,Math.round((ann.expireAt-Date.now())/ann.expire*100)));
    timerBar=`<div style="margin-top:6px;height:3px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:rgba(255,255,255,.7);border-radius:2px;transition:width 1s linear"></div>
    </div>`;
  }
  return `<div class="ann-bar type-${ann.type}">
    <div class="ann-icon">${ANN_ICO[ann.type]||'📢'}</div>
    <div class="ann-body">
      <div class="ann-from">📢 ${ann.from||'Admin'} · ${ANN_LABEL[ann.type]||'Thông báo'}${ann.type==='urgent'?'<span class=\"ann-dot-blink\"><span></span><span></span><span></span></span>':''}</div>
      <div class="ann-msg">${ann.msg}</div>
      <div class="ann-time">🕐 ${t}${ann.expire?` · ⏱ ${fmtDuration(ann.expire)}`:''}</div>
      ${timerBar}
    </div>
    <button class="ann-close" onclick="dismissAnnounce()" title="Đóng">✕</button>
  </div>`;
}

function publishAnnounce(){if(guardViewer())return;
  const msg=($('annMsg')?.value||'').trim();
  if(!msg){showToast('Nhập nội dung thông báo',true);return;}
  const expire=parseInt($('annExpire')?.value||'0');
  const ann={
    id:'ann'+Date.now(),
    ts: Date.now(),
    type: _annType,
    msg, from: currentUser?.name||'Admin',
    role: currentUser?.role||'admin',
    expire, // ms, 0=không xóa
    expireAt: expire>0?Date.now()+expire:0
  };
  _currentAnn=ann;
  // Lưu local + đẩy Firebase
  try{localStorage.setItem(ANN_KEY,JSON.stringify(ann));}catch(e){}
  if(fbOk()) fbWrite('/announce',ann,'PUT').catch(()=>{});
  closeModal('announceModal');
  showAnnBanner(ann);
  flashScreen(ann.type);
  animateBell();
  log('Gửi thông báo',`[${ANN_LABEL[ann.type]}] ${msg}`,'');
  showToast('✅ Đã gửi thông báo!','ok');
}

function showAnnBanner(ann){
  if(!ann) return;
  if(ann.expireAt&&ann.expireAt<Date.now()){ hideAnnBanner(); return; }
  const el=$('announceBanner'); if(!el) return;
  el.innerHTML=buildAnnHTML(ann);
  el.style.display='block';
  _currentAnn=ann;
  // Scroll lên đầu để thấy banner
  const mw=document.getElementById('mainWrap');
  if(mw) mw.scrollTo({top:0,behavior:'smooth'});
}

function hideAnnBanner(){
  const el=$('announceBanner'); if(!el) return;
  el.style.display='none';
  _currentAnn=null;
}

function dismissAnnounce(){
  hideAnnBanner();
  // Lưu trạng thái đã đóng cho session này
  try{sessionStorage.setItem('ann_dismissed',_currentAnn?.id||'');}catch(e){}
}

// Poll announce từ Firebase — mọi user đều nhận
let _lastAnnId='';
async function checkAnnounce(){
  if(!fbOk()) return;
  try{
    const ann=await fbRead('/announce');
    if(!ann||!ann.id) return;
    // Hết hạn → xóa
    if(ann.expireAt&&ann.expireAt<Date.now()){
      hideAnnBanner(); return;
    }
    if(ann.id===_lastAnnId) return;
    _lastAnnId=ann.id;
    // Kiểm tra user đã đóng thông báo này chưa
    const dismissed=sessionStorage.getItem('ann_dismissed')||'';
    if(dismissed===ann.id) return;
    showAnnBanner(ann);
    // Rung chuông nếu thông báo mới (không phải chính mình vừa gửi)
    if(ann.from!==currentUser?.name){
      flashScreen(ann.type);
      alertUser(ann.type==='urgent'?'urgent':'default');
      showToast(`📢 ${ann.from}: ${ann.msg.slice(0,40)}${ann.msg.length>40?'...':''}`);
      pushNotif('📢 '+ann.from, ann.msg);
    }
  }catch(e){}
}

// Admin xóa thông báo đang hiện
function clearAnnounce(){if(guardViewer())return;
  hideAnnBanner();
  if(fbOk()) fbWrite('/announce',null,'PUT').catch(()=>{});
  try{localStorage.removeItem(ANN_KEY);}catch(e){}
  showToast('Đã xóa thông báo');
}

function updateBellBadge(){
  _notifUnread = notifList.filter(n=>!n.read).length;
  const b=$('bellBadge');
  if(b){
    b.textContent = _notifUnread>9?'9+':_notifUnread;
    b.classList.toggle('show', _notifUnread>0);
  }
  document.querySelectorAll('.js-bell-badge').forEach(x=>{ x.textContent = _notifUnread>9?'9+':_notifUnread; x.classList.toggle('show', _notifUnread>0); });
}

function animateBell(){
  const b=$('bellBtn'); if(!b) return;
  b.classList.remove('ring');
  void b.offsetWidth; // reflow
  b.classList.add('ring');
  setTimeout(()=>b.classList.remove('ring'), 600);
}

function flashScreen(type){
  const colors={info:'#1d4ed8',warn:'#d97706',urgent:'#dc2626',ok:'#059669'};
  const c=colors[type]||colors.info;
  // Flash overlay
  const f=document.createElement('div');
  f.className='notif-flash';
  f.style.background=c;
  document.body.appendChild(f);
  // Ring effect
  const r=document.createElement('div');
  r.className='notif-flash-ring';
  r.style.borderColor=c;
  document.body.appendChild(r);
  setTimeout(()=>{f.remove();r.remove();},800);
}

// Mở/đóng panel

function openNotifPanel(){
  const p=$('notifPanel'), o=$('notifOverlay'); if(!p||!o) return;
  if(p.classList.contains('open')){ closeNotifPanel(); return; }
  renderNotifList();
  p.classList.add('open'); o.classList.add('show');
}
function closeNotifPanel(){
  $('notifPanel').classList.remove('open');
  $('notifOverlay').classList.remove('show');
}

// Render danh sách thông báo
const NOTIF_ICO = {
  order_new:'📦', order_done:'✅', order_run:'⚙️',
  broadcast:'📢', system:'ℹ️', error:'❌', warning:'⚠️'
};
function renderNotifList(){
  const el=$('notifList'); if(!el) return;
  if(!notifList.length){
    el.innerHTML='<div class="notif-empty"><div class="notif-empty-icon">🔔</div>Chưa có thông báo nào</div>';
    return;
  }
  el.innerHTML = notifList.slice(0,60).map((n,i)=>{
    const dt = new Date(n.ts);
    const t = vnDateTimeShort(dt);
    const ico = NOTIF_ICO[n.type]||'📌';
    return `<div class="notif-item${n.read?'':' unread'}${i===0?' new-anim':''}" data-nid="${escapeHtml(n.id)}" onclick="clickNotif(this.dataset.nid)">
      <div class="notif-avatar">${ico}</div>
      <div class="notif-body">
        <div class="notif-title">${escapeHtml(n.title)}</div>
        ${n.body?`<div class="notif-desc">${escapeHtml(n.body)}</div>`:''}
        <div class="notif-time">${n.from?`👤 ${escapeHtml(n.from)} · `:''}🕐 ${t}</div>
      </div>
      ${!n.read?'<span style="width:8px;height:8px;border-radius:50%;background:var(--brand);flex-shrink:0;margin-top:4px"></span>':''}
    </div>`;
  }).join('');
}

function clickNotif(id){
  const n = notifList.find(x=>x.id===id);
  if(!n) return;
  n.read=true; notifSave(); updateBellBadge();
  closeNotifPanel();
  if(n.tab) goTab(n.tab);
  renderNotifList();
}
function markAllRead(){
  notifList.forEach(n=>n.read=true);
  notifSave(); updateBellBadge(); renderNotifList();
}
