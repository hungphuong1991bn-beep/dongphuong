// src/services/notification.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

let _notifOk = false;
let notifSoundOn = localStorage.getItem('sx_notif_sound_off')!=='1';
let notifVibrateOn = localStorage.getItem('sx_notif_vibrate_off')!=='1';
let _audioCtx = null;
// Mở khóa AudioContext ngay lần chạm/click đầu tiên (bắt buộc trên mobile để phát được âm thanh sau này)
function _unlockAudioOnce(){
  try{ getAudioCtx(); }catch(e){}
  document.removeEventListener('click', _unlockAudioOnce);
  document.removeEventListener('touchstart', _unlockAudioOnce);
}
document.addEventListener('click', _unlockAudioOnce, {once:true});
document.addEventListener('touchstart', _unlockAudioOnce, {once:true});
// ════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// ════════════════════════════════════════════════════════════
const NOTIF_KEY = 'sx_notif_v1';
let notifList = [];
let _notifUnread = 0;

function notifLoad(){
  try{ notifList = JSON.parse(localStorage.getItem(NOTIF_KEY)||'[]'); }catch(e){ notifList=[]; }
}
function notifSave(){
  try{ localStorage.setItem(NOTIF_KEY, JSON.stringify(notifList.slice(0,100))); }catch(e){}
}

function addNotif(type, title, body, tab, fromUser){
  const n = {
    id: 'n'+Date.now()+Math.random().toString(36).slice(2,5),
    ts: Date.now(),
    type,       // 'order_new'|'order_done'|'order_run'|'broadcast'|'system'
    title, body,
    tab: tab||'',
    from: fromUser||currentUser?.name||'',
    read: false
  };
  notifList.unshift(n);
  if(notifList.length>100) notifList=notifList.slice(0,100);
  notifSave();
  // Đẩy lên Firebase để mọi thiết bị nhận
  if(fbOk()) fbWrite('/notif', notifList.slice(0,50), 'PUT').catch(()=>{});
  updateBellBadge();
  showToast(title, type==='error');
  animateBell();
  return n;
}

// Admin gửi broadcast
function sendBroadcast(){if(guardViewer())return;
  const inp=$('notifInp'); if(!inp) return;
  const msg=inp.value.trim(); if(!msg) return;
  inp.value='';
  addNotif('broadcast','📢 '+currentUser.name, msg, '', currentUser.name);
  // Ghi log
  log('Gửi thông báo', msg, '');
  flashScreen();
  showToast('✅ Đã gửi thông báo cho cả nhóm');
  // Đẩy lên Firebase path /broadcast để poll nhận
  if(fbOk()) fbWrite('/broadcast', {
    id:'b'+Date.now(), msg, from:currentUser.name,
    role:currentUser.role, ts:Date.now()
  }, 'PUT').catch(()=>{});
  renderNotifList();
}

// Poll broadcast từ Firebase (mọi user nhận)
let _lastBroadcastId = '';
async function checkBroadcast(){
  if(!fbOk()||!currentUser) return;
  try{
    const bc = await fbRead('/broadcast');
    if(!bc||!bc.id||bc.id===_lastBroadcastId) return;
    if(bc.from===currentUser.name && bc.ts>Date.now()-5000) return; // chính mình vừa gửi
    _lastBroadcastId = bc.id;
    const n = {
      id:'b'+bc.ts, ts:bc.ts, type:'broadcast',
      title:'📢 '+bc.from, body:bc.msg,
      from:bc.from, read:false, tab:''
    };
    notifList.unshift(n);
    notifSave(); updateBellBadge(); flashScreen();
    alertUser('urgent');
    showToast('📢 '+bc.from+': '+bc.msg);
    pushNotif('📢 '+bc.from, bc.msg);
  }catch(e){}
}

// ════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════
function requestNotif(){
  if(!('Notification' in window)) return;
  if(Notification.permission==='granted'){ _notifOk=true; return; }
  Notification.requestPermission().then(p=>_notifOk=(p==='granted'));
}
function pushNotif(title,body){
  if(!_notifOk||document.visibilityState==='visible') return;
  try{ new Notification(title,{body,icon:document.querySelector('link[rel="icon"]')?.href}); }catch(e){}
}
function notifyNewOrder(o){
  pushNotif('📦 Đơn mới: '+o.customer,`${specStr(o)} · ${qtyLabel(o)} · ${o.priority||''}`);
  showToast('🆕 Đơn mới: '+o.customer);
  alertUser('new');
}

// ── CHUÔNG & RUNG (âm thanh + haptic khi có sự kiện quan trọng) ──
function getAudioCtx(){
  try{
    if(!_audioCtx) _audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(_audioCtx.state==='suspended') _audioCtx.resume();
    return _audioCtx;
  }catch(e){ return null; }
}
function _tone(ctx, freq, startAt, dur, type, vol){
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type||'sine'; o.frequency.value=freq;
  o.connect(g); g.connect(ctx.destination);
  const t0=ctx.currentTime+startAt;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol||0.25, t0+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  o.start(t0); o.stop(t0+dur+0.05);
}
function playNotifSound(kind){
  if(!notifSoundOn) return;
  const ctx=getAudioCtx(); if(!ctx) return;
  try{
    if(kind==='done'){
      // Giai điệu đi lên vui tai: hoàn thành đơn hàng
      _tone(ctx,523.25,0,0.16,'sine',0.28);
      _tone(ctx,659.25,0.13,0.16,'sine',0.28);
      _tone(ctx,783.99,0.26,0.32,'sine',0.3);
    }else if(kind==='new'){
      // 2 tiếng "ting-ting" báo đơn mới
      _tone(ctx,880,0,0.13,'sine',0.26);
      _tone(ctx,880,0.17,0.13,'sine',0.26);
    }else if(kind==='urgent'){
      // Báo động khẩn, dồn dập hơn
      _tone(ctx,660,0,0.12,'square',0.22);
      _tone(ctx,880,0.15,0.12,'square',0.22);
      _tone(ctx,660,0.3,0.12,'square',0.22);
      _tone(ctx,880,0.45,0.2,'square',0.22);
    }else{
      _tone(ctx,740,0,0.18,'sine',0.24);
    }
  }catch(e){}
}
function vibrateDevice(kind){
  if(!notifVibrateOn) return;
  if(!('vibrate' in navigator)) return; // iOS Safari không hỗ trợ rung qua web
  const patterns={done:[80,50,80,50,180],new:[60,60,60],urgent:[120,80,120,80,120,80,260],default:[100]};
  try{ navigator.vibrate(patterns[kind]||patterns.default); }catch(e){}
}
function alertUser(kind){
  playNotifSound(kind);
  vibrateDevice(kind);
  animateBell();
}
function toggleNotifSound(on){
  notifSoundOn=on;
  localStorage.setItem('sx_notif_sound_off', on?'0':'1');
  if(on){ getAudioCtx(); playNotifSound('new'); }
}
function toggleNotifVibrate(on){
  notifVibrateOn=on;
  localStorage.setItem('sx_notif_vibrate_off', on?'0':'1');
  if(on) vibrateDevice('new');
}
function testNotifAlert(){
  if(!notifSoundOn&&!notifVibrateOn){ showToast('⚠️ Hãy bật ít nhất 1 mục (âm thanh hoặc rung)'); return; }
  alertUser('done');
  showToast('🔔 Đã thử chuông & rung');
}
