// src/services/update.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

let _deferInstall = null;

// ════════════════════════════════════════════════════════════
// PWA
// ════════════════════════════════════════════════════════════
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); _deferInstall=e;
  setTimeout(()=>{ if(currentUser){ const b=$('pwaBar'); if(b) b.style.display='flex'; } },4000);
});
window.addEventListener('appinstalled',()=>{ const b=$('pwaBar'); if(b) b.style.display='none'; showToast('✅ Đã cài đặt!'); });
function installPWA(){
  if(_deferInstall){ _deferInstall.prompt(); _deferInstall.userChoice.then(()=>{ _deferInstall=null; $('pwaBar').style.display='none'; }); }
  else alert('iPhone: Nhấn Share → "Thêm vào màn hình chính"\nChrome PC: Nhấn nút ⊕ trên thanh địa chỉ');
}

// Service Worker + Auto-update
// ════ AUTO-UPDATE ENGINE v2 ═══════════════════════════════════
// Chiến lược "chuyên nghiệp" khi deploy code mới lên GitHub:
//   1. version.json làm NGUỒN SỰ THẬT duy nhất về bản build hiện tại
//      (tự tăng mỗi lần deploy qua GitHub Actions/Pages — xem ghi chú cuối file)
//   2. Service Worker vẫn check song song, được yêu cầu kích hoạt (skipWaiting)
//      NGAY khi phát hiện bản mới thay vì chờ user đóng hết tab
//   3. Có timeout + backoff khi lỗi mạng, tự tạm dừng khi ẩn app/mất mạng
//      → không còn "gọi API mù" mỗi 30–60s như bản cũ, đỡ tốn 4G/5G
// ═══════════════════════════════════════════════════════════════

let _reloading = false;

// Hàm reload an toàn: không reload khi đang gõ/modal
function safeReload(force){
  if(_reloading) return;
  const modalOpen = document.querySelector('.modal.open');
  const focused   = document.activeElement;
  const isTyping  = focused&&(focused.tagName==='INPUT'||focused.tagName==='TEXTAREA'||focused.tagName==='SELECT');
  if(force||(!modalOpen&&!isTyping)){
    _reloading=true;
    window.location.reload();
  } else {
    // Đang gõ → đợi 30s rồi thử lại
    setTimeout(()=>{ _reloading=false; safeReload(false); }, 30000);
  }
}

// 1. SERVICE WORKER — check khi mở lại app thay vì hẹn giờ liên tục;
//    khi thấy bản mới, yêu cầu SW kích hoạt ngay (cần sw.js hỗ trợ message SKIP_WAITING — xem ghi chú cuối file)
let _swReg = null;
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'})
    .then(reg=>{
      _swReg = reg;
      reg.update();

      reg.addEventListener('updatefound',()=>{
        const nw=reg.installing; if(!nw) return;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='installed'&&navigator.serviceWorker.controller){
            try{ nw.postMessage({type:'SKIP_WAITING'}); }catch(e){}
            showUpdateBanner();
          }
        });
      });
    }).catch(()=>{});

  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    safeReload(false);
  });

  // Chỉ hỏi SW kiểm tra bản mới khi người dùng thực sự quay lại app
  // (không hẹn giờ cố định → tiết kiệm dữ liệu cho những phiên mở lâu, ít tương tác)
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && _swReg) _swReg.update();
  });
  window.addEventListener('online', ()=>{ if(_swReg) _swReg.update(); });
}

// 2. VERSION.JSON — nguồn sự thật cho biết đúng bản đang deploy trên GitHub,
// đáng tin cậy hơn ETag/Last-Modified (vốn hay bị CDN của GitHub Pages cache/bỏ qua).
// Nếu chưa có file version.json, hệ thống tự rơi về kiểm tra Last-Modified của index.html.
let _lastVersion = localStorage.getItem('sx_app_ver') || '';
let _versionCheckFail = 0;
let _versionTimer = null;

async function checkForNewVersion(){
  if(document.hidden || (navigator.onLine===false)) return; // đỡ tốn data khi ẩn/mất mạng
  const ctrl = new AbortController();
  const timeout = setTimeout(()=>ctrl.abort(), 8000);
  try{
    let ver = '';
    try{
      const r = await fetch('version.json?_='+Date.now(), {cache:'no-store', signal:ctrl.signal});
      if(r.ok){
        const j = await r.json();
        ver = (j.version||j.build||j.commit||'')+'';
        _versionInfo = j;
        try{ localStorage.setItem(VER_INFO_KEY, JSON.stringify(j)); }catch(e){}
        refreshVersionCardInfo();
      }
    }catch(e){ /* chưa có version.json → dùng fallback bên dưới */ }
    if(!ver){
      const r2 = await fetch(location.href, {method:'HEAD', cache:'no-store', signal:ctrl.signal});
      ver = r2.headers.get('etag')||r2.headers.get('last-modified')||'';
    }
    clearTimeout(timeout);
    _versionCheckFail = 0;
    if(!ver) return;
    if(!_lastVersion){ _lastVersion=ver; localStorage.setItem('sx_app_ver',ver); return; } // lần đầu: chỉ lưu mốc
    if(ver !== _lastVersion){
      _lastVersion = ver;
      localStorage.setItem('sx_app_ver', ver);
      showUpdateBanner();
    }
  }catch(e){
    clearTimeout(timeout);
    _versionCheckFail++;
  }
}

// Kiểm tra ngay sau 5s, sau đó lặp lại mỗi 2 phút (nhẹ hơn nhiều so với 60s cũ);
// nếu lỗi mạng liên tục thì giãn cách theo cấp số nhân, tối đa 15 phút/lần
function scheduleVersionCheck(){
  clearTimeout(_versionTimer);
  const base = 120*1000;
  const delay = Math.min(base*Math.pow(2, Math.min(_versionCheckFail,4)), 15*60*1000);
  _versionTimer = setTimeout(async()=>{ await checkForNewVersion(); scheduleVersionCheck(); }, delay);
}
setTimeout(()=>{ checkForNewVersion(); scheduleVersionCheck(); }, 5000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) checkForNewVersion(); });
window.addEventListener('online', checkForNewVersion);

// 3. IDLE RELOAD — tự reload sau 2 phút không tương tác
// Chỉ đếm khi app đang HIỂN THỊ trên màn hình. Khi app bị đẩy xuống nền
// (người dùng chuyển qua Zalo nhắn tin/gọi điện, app khác...), dừng hẳn bộ đếm
// và huỷ mọi lịch reload đang chờ — tránh việc tự reload "ngầm" làm hao pin/CPU/
// mạng đúng lúc đang gọi điện, và tránh giật/gián đoạn khi người dùng quay lại.
let _idleTimer = null;
const IDLE_RELOAD = 2*60*1000; // 2 phút

function resetIdleTimer(){
  clearTimeout(_idleTimer);
  if(document.hidden) return; // ở nền: không hẹn giờ reload
  _idleTimer = setTimeout(()=>safeReload(false), IDLE_RELOAD);
}
['click','touchstart','keydown','scroll','pointerdown'].forEach(ev=>{
  document.addEventListener(ev, resetIdleTimer, {passive:true});
});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ clearTimeout(_idleTimer); _idleTimer=null; }
  else resetIdleTimer(); // quay lại app: đếm lại từ đầu, không cộng dồn thời gian ở nền
});
resetIdleTimer();

// Hiện/ẩn chấm "🆕 có bản mới" ngay trên mục Cài đặt (sidebar desktop
// + bottom-nav mobile) để người dùng biết có bản cập nhật mà không cần
// phải bấm vào Cài đặt kiểm tra thủ công. Badge chỉ tắt khi app thực sự
// tải lại bản mới (safeReload) — vì trước đó app vẫn đang chạy bản cũ.
function updateVersionBadge(show){
  const sb = document.getElementById('sbVerBadge');
  const bn = document.getElementById('bnVerDot');
  if(sb) sb.style.display = show ? 'inline-flex' : 'none';
  if(bn) bn.classList.toggle('show', !!show);
}

// Banner thông báo update — đẹp hơn, có countdown
function showUpdateBanner(){
  updateVersionBadge(true);
  if(document.getElementById('updateBanner')) return;
  const b = document.createElement('div');
  b.id = 'updateBanner';
  b.style.cssText = [
    'position:fixed','top:calc(var(--top)+var(--safe-t)+10px)',
    'left:50%','transform:translateX(-50%)',
    'background:var(--navy)',
    'color:#fff','padding:11px 16px','border-radius:14px',
    'font-size:13px','font-weight:600','z-index:9999',
    'display:flex','align-items:center','gap:10px',
    'box-shadow:0 4px 24px rgba(0,0,0,.5)',
    'border:1px solid rgba(255,255,255,.1)',
    'animation:ann-slide .4s cubic-bezier(.34,1.56,.64,1)',
    'max-width:92vw'
  ].join(';');

  // Countdown 10s rồi tự reload
  let countdown = 10;
  // Nếu version.json đã có số phiên bản mới (do bump-version.yml tự tăng),
  // hiện luôn số đó trong thông báo cho rõ ràng thay vì chỉ nói chung chung.
  const newVerTxt = (_versionInfo && _versionInfo.version) ? ` ${_versionInfo.version}` : '';
  const updateCountdown = ()=>{
    b.innerHTML = `<span style="font-size:16px">🆕</span>
      <span>Có bản cập nhật${newVerTxt}! Tự cập nhật sau <b id="cdNum">${countdown}</b>s</span>
      <button onclick="safeReload(true)" style="background:var(--brand2);color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;white-space:nowrap">Cập nhật ngay</button>
      <button onclick="this.closest('#updateBanner').remove();clearInterval(_cdInterval)" style="background:rgba(255,255,255,.1);border:none;color:#fff;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>`;
  };
  updateCountdown();
  document.body.appendChild(b);

  // Đếm ngược và tự reload
  window._cdInterval = setInterval(()=>{
    countdown--;
    const el=document.getElementById('cdNum');
    if(el) el.textContent=countdown;
    if(countdown<=0){
      clearInterval(window._cdInterval);
      safeReload(false);
    }
  }, 1000);
}

// 4. NATIVE APP (ANDROID) — kiểm tra bản .apk mới trên GitHub Releases.
// Khác với 2 mục trên (vốn tự cập nhật NỘI DUNG web qua GitHub Pages),
// mục này kiểm tra bản CÁI VỎ Android (icon/tên/URL...) — thứ không tự
// cập nhật được, người dùng phải tự tải .apk mới về cài đè. Đoạn này chỉ
// chạy khi app đang mở TRONG vỏ Android (Capacitor), không chạy khi mở
// bằng trình duyệt thường hay bản desktop (Electron không có Capacitor).
(function(){
  const REPO = 'hungphuong1990bn-create/test';
  const TAG_PREFIX = 'android-v';
  const CHECK_EVERY_MS = 4*60*60*1000; // tối đa 1 lần/4 tiếng, đỡ tốn API quota
  const LS_KEY = 'sx_native_ver_check_at';

  function isAndroidNativeApp(){
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.getPlatform && window.Capacitor.getPlatform()==='android');
  }
  function verParts(v){ return (v||'').replace(/^v/i,'').split('.').map(n=>parseInt(n,10)||0); }
  function verIsNewer(a,b){ // a mới hơn b?
    const pa=verParts(a), pb=verParts(b);
    for(let i=0;i<Math.max(pa.length,pb.length);i++){
      const x=pa[i]||0, y=pb[i]||0;
      if(x>y) return true;
      if(x<y) return false;
    }
    return false;
  }

  async function checkNativeAppUpdate(){
    if(!isAndroidNativeApp()) return;
    const lastCheck = parseInt(localStorage.getItem(LS_KEY)||'0',10);
    if(Date.now()-lastCheck < CHECK_EVERY_MS) return;
    try{
      const { App } = window.Capacitor.Plugins;
      if(!App) return;
      const info = await App.getInfo(); // {version, build, id, name}
      const currentVer = info.version || '0';

      const ctrl = new AbortController();
      const timeout = setTimeout(()=>ctrl.abort(), 8000);
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {signal: ctrl.signal});
      clearTimeout(timeout);
      localStorage.setItem(LS_KEY, String(Date.now()));
      if(!res.ok) return;
      const releases = await res.json();
      const rel = (Array.isArray(releases)?releases:[]).find(r => r.tag_name && r.tag_name.startsWith(TAG_PREFIX) && !r.draft);
      if(!rel) return;
      const remoteVer = rel.tag_name.slice(TAG_PREFIX.length);
      if(!verIsNewer(remoteVer, currentVer)) return;

      const asset = (rel.assets||[]).find(a => /\.apk$/i.test(a.name));
      const downloadUrl = asset ? asset.browser_download_url : rel.html_url;
      showNativeUpdateBanner(remoteVer, downloadUrl);
    }catch(e){ /* im lặng bỏ qua lỗi mạng, thử lại lần sau */ }
  }

  window.showNativeUpdateBanner = function(remoteVer, downloadUrl){
    if(document.getElementById('nativeUpdateBanner')) return;
    const b = document.createElement('div');
    b.id = 'nativeUpdateBanner';
    b.style.cssText = [
      'position:fixed','top:calc(var(--top)+var(--safe-t)+10px)',
      'left:50%','transform:translateX(-50%)',
      'background:var(--navy)',
      'color:#fff','padding:11px 16px','border-radius:14px',
      'font-size:13px','font-weight:600','z-index:9999',
      'display:flex','align-items:center','gap:10px',
      'box-shadow:0 4px 24px rgba(0,0,0,.5)',
      'border:1px solid rgba(255,255,255,.1)',
      'animation:ann-slide .4s cubic-bezier(.34,1.56,.64,1)',
      'max-width:92vw'
    ].join(';');
    b.innerHTML = `<span style="font-size:16px">📲</span>
      <span>Có bản app mới ${remoteVer}!</span>
      <button id="nativeUpdBtn" style="background:var(--brand2);color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;white-space:nowrap">Tải về ngay</button>
      <button id="nativeUpdClose" style="background:rgba(255,255,255,.1);border:none;color:#fff;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>`;
    document.body.appendChild(b);
    b.querySelector('#nativeUpdBtn').onclick = async ()=>{
      try{
        const { Browser } = window.Capacitor.Plugins;
        if(Browser) await Browser.open({ url: downloadUrl });
        else window.open(downloadUrl, '_blank');
      }catch(e){ window.open(downloadUrl, '_blank'); }
    };
    b.querySelector('#nativeUpdClose').onclick = ()=> b.remove();
  };

  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) checkNativeAppUpdate(); });
  setTimeout(checkNativeAppUpdate, 6000);
})();
