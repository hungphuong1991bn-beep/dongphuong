// src/modules/settings/settings-version.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// PHIÊN BẢN ỨNG DỤNG & KIỂM TRA CẬP NHẬT (trong tab Cài đặt)
// Tái sử dụng cơ chế kiểm tra bản mới (checkForNewVersion, _swReg,
// _lastVersion) đã có ở cuối file — chỉ thêm phần hiển thị/điều khiển.
// ════════════════════════════════════════════════════════════
const VER_LAST_CHECK_KEY = 'sx_app_last_check';
// Cache thông tin version.json mới nhất (do bump-version.yml tự sinh mỗi lần
// deploy: version = short SHA, build = epoch giây, commit, updatedAt = ISO).
// Dùng để khu vực "Phiên bản ứng dụng" luôn hiện đúng bản build thật đang chạy
// trên GitHub, không chỉ dựa vào APP_VERSION gõ tay trong code.
const VER_INFO_KEY = 'sx_app_verinfo';
let _versionInfo = (function(){ try{ return JSON.parse(localStorage.getItem(VER_INFO_KEY)||'null'); }catch(e){ return null; } })();

function getLocalStorageSizeKB(){
  let total=0;
  try{
    for(const key in localStorage){
      if(Object.prototype.hasOwnProperty.call(localStorage,key)){
        total += (localStorage[key]||'').length + key.length;
      }
    }
  }catch(e){}
  return total*2/1024; // ước lượng UTF-16 ~2 byte/ký tự
}

function verCheckIconSvg(){
  return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`;
}

// Nhận diện gọn trình duyệt & hệ điều hành từ userAgent — chỉ để hiển thị
// tham khảo trong thẻ "Phiên bản ứng dụng", không dùng để rẽ nhánh logic.
function getBrowserOsInfo(){
  const ua = navigator.userAgent || '';
  let browser = 'Trình duyệt';
  if(/Edg\//.test(ua)) browser = 'Edge';
  else if(/OPR\//.test(ua)) browser = 'Opera';
  else if(/CriOS|Chrome/.test(ua)) browser = 'Chrome';
  else if(/FxiOS|Firefox/.test(ua)) browser = 'Firefox';
  else if(/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if(/Safari/.test(ua)) browser = 'Safari';
  let os = 'Không rõ';
  if(/Android/.test(ua)) os = 'Android';
  else if(/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if(/Windows/.test(ua)) os = 'Windows';
  else if(/Mac OS X/.test(ua)) os = 'macOS';
  else if(/Linux/.test(ua)) os = 'Linux';
  return `${browser} · ${os}`;
}

// Đánh dấu lần mở app đầu tiên trên thiết bị này (chỉ set 1 lần, không đổi
// khi cập nhật phiên bản) để thẻ "Phiên bản ứng dụng" có thể hiện "Đã dùng
// được X ngày" — giúp phân biệt máy mới cài với máy đã dùng lâu khi cần hỗ trợ.
const VER_FIRST_OPEN_KEY = 'sx_first_open_ts';
function getFirstOpenTs(){
  let ts = localStorage.getItem(VER_FIRST_OPEN_KEY);
  if(!ts){ ts = Date.now().toString(); try{ localStorage.setItem(VER_FIRST_OPEN_KEY, ts); }catch(e){} }
  return parseInt(ts, 10);
}
function fmtUsedSince(ts){
  const days = Math.max(0, Math.floor((Date.now()-ts)/86400000));
  if(days<1) return 'Mới cài hôm nay';
  if(days===1) return '1 ngày';
  if(days<30) return `${days} ngày`;
  const months = Math.floor(days/30);
  return `${months} tháng${days%30>=1?` ${days%30} ngày`:''}`;
}

function buildVersionCard(){
  const online   = navigator.onLine;
  const swOn     = typeof _swReg!=='undefined' && !!_swReg;
  const lastRaw  = localStorage.getItem(VER_LAST_CHECK_KEY);
  const lastTxt  = lastRaw ? vnDateTimeShort(new Date(parseInt(lastRaw,10))) : 'Chưa kiểm tra lần nào';
  const storageKB   = getLocalStorageSizeKB();
  const storagePct  = Math.min(100, (storageKB/5120*100));
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone===true;
  let buildTxt = APP_BUILD_DATE;
  try{ buildTxt = fmtDate(APP_BUILD_DATE+'T00:00:00'); }catch(e){}
  // Thông tin bản build thật lấy từ version.json (nguồn: bump-version.yml,
  // tự tăng mỗi lần push code mới lên nhánh chính). Nếu chưa kiểm tra lần
  // nào (chưa có cache) thì hiện "Đang đồng bộ…" và sẽ tự điền khi
  // checkForNewVersion() chạy lần đầu (~5s sau khi mở app).
  const vi = _versionInfo;
  const commitTxt = vi ? (String(vi.commit||'').slice(0,7)||'—') : null;
  const deployTxt = vi && vi.updatedAt ? vnDateTimeShort(new Date(vi.updatedAt)) : null;
  const buildInfoTxt = vi ? `#${commitTxt} · ${deployTxt||'—'}` : 'Đang đồng bộ…';
  // version.json.version là số phiên bản THẬT do bump-version.yml tự tăng
  // mỗi lần deploy (2.5.0 → 2.5.1/2.6.0...). Ưu tiên hiển thị số này; nếu
  // chưa đồng bộ được (offline lần đầu) thì tạm dùng APP_VERSION gõ tay.
  const displayVersion = (vi && vi.version) ? vi.version : APP_VERSION;
  const deviceTxt = getBrowserOsInfo();
  const usedTxt = fmtUsedSince(getFirstOpenTs());
  return `
    <div class="ver-top">
      <div class="ver-logo">${window.BRAND_LOGO_URL?`<img src="${window.BRAND_LOGO_URL}" alt="Logo Đông Phương – Tâm sáng rạng tín bền" decoding="async" onerror="this.replaceWith(document.createTextNode('🏭'))">`:'🏭'}</div>
      <div>
        <div class="ver-name">SX Đông Phương</div>
        <div class="ver-num" id="verNumLine">Phiên bản ${displayVersion} · ${buildTxt}</div>
      </div>
      <span class="ver-status-badge ok" id="verBadge">✓ Mới nhất</span>
    </div>
    <div class="ver-info-list">
      <div class="ver-info-row"><span class="ver-info-row-lbl">🌐 Kết nối mạng</span><span class="ver-info-row-val" id="verOnlineVal"><span class="ver-dot ${online?'on':'off'}"></span> ${online?'Online':'Offline'}</span></div>
      <div class="ver-info-row"><span class="ver-info-row-lbl">⚙️ Service Worker</span><span class="ver-info-row-val"><span class="ver-dot ${swOn?'on':'off'}"></span> ${swOn?'Đang hoạt động':'Chưa đăng ký'}</span></div>
      <div class="ver-info-row"><span class="ver-info-row-lbl">📱 Chế độ chạy</span><span class="ver-info-row-val">${isStandalone?'Ứng dụng đã cài (PWA)':'Trình duyệt web'}</span></div>
      <div class="ver-info-row"><span class="ver-info-row-lbl">💻 Trình duyệt / Thiết bị</span><span class="ver-info-row-val">${deviceTxt}</span></div>
      <div class="ver-info-row"><span class="ver-info-row-lbl">🧩 Bản build (GitHub)</span><span class="ver-info-row-val" id="verBuildInfo">${buildInfoTxt}</span></div>
      <div class="ver-info-row"><span class="ver-info-row-lbl">📅 Đã dùng trên máy này</span><span class="ver-info-row-val">${usedTxt}</span></div>
      <div class="ver-info-row"><span class="ver-info-row-lbl">🕐 Kiểm tra lần cuối</span><span class="ver-info-row-val" id="verLastCheck">${lastTxt}</span></div>
      <div class="ver-info-row"><span class="ver-info-row-lbl">📦 Bộ nhớ đệm (cache)</span><span class="ver-info-row-val" id="verCacheEstVal">Đang tính…</span></div>
    </div>
    <div style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3)"><span>💾 Dữ liệu offline đã lưu</span><span>${storageKB.toFixed(0)} KB</span></div>
      <div class="ver-storage-bar"><div class="ver-storage-fill" style="width:${storagePct}%"></div></div>
    </div>
    <div class="ver-credit">
      <span>NGƯỜI PHÁT TRIỂN</span>
      <b>${APP_DEVELOPER}</b>
      <small>${APP_DEVELOPER_UNIT}</small>
    </div>
    <button class="ver-check-btn" id="verCheckBtn" onclick="checkUpdateManual()">${verCheckIconSvg()}<span>Kiểm tra cập nhật ngay</span></button>
    <div class="ver-sub-actions">
      <button class="ver-ghost-btn" onclick="copyDiagnosticInfo()" title="Sao chép thông tin để gửi cho bộ phận hỗ trợ">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        <span>Sao chép chẩn đoán</span>
      </button>
      <button class="ver-ghost-btn danger" onclick="clearCacheAndReload()" title="Xoá cache trình duyệt và tải lại ứng dụng từ đầu">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2"/></svg>
        <span>Xóa cache & tải lại</span>
      </button>
    </div>
  `;
}

// Cập nhật dòng "Bản build (GitHub)" tại chỗ (không render lại cả card)
// mỗi khi có dữ liệu version.json mới từ checkForNewVersion()/checkUpdateManual().
function refreshVersionCardInfo(){
  if(!_versionInfo) return;
  const vi = _versionInfo;
  const el = document.getElementById('verBuildInfo');
  if(el){
    const commitTxt = String(vi.commit||'').slice(0,7)||'—';
    const deployTxt = vi.updatedAt ? vnDateTimeShort(new Date(vi.updatedAt)) : '—';
    el.textContent = `#${commitTxt} · ${deployTxt}`;
  }
  // Cập nhật luôn số phiên bản hiển thị nếu version.json vừa đồng bộ về
  // sau khi card đã render với APP_VERSION tạm thời.
  const numEl = document.getElementById('verNumLine');
  if(numEl && vi.version){
    let buildTxt = APP_BUILD_DATE;
    try{ buildTxt = fmtDate(APP_BUILD_DATE+'T00:00:00'); }catch(e){}
    numEl.textContent = `Phiên bản ${vi.version} · ${buildTxt}`;
  }
}

let _verListenersBound=false;
function updateVerConnDot(){
  if(_verListenersBound) return;
  _verListenersBound=true;
  const refresh=()=>{
    const el=document.getElementById('verOnlineVal');
    if(!el) return;
    const online=navigator.onLine;
    el.innerHTML = `<span class="ver-dot ${online?'on':'off'}"></span> ${online?'Online':'Offline'}`;
  };
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
}

// Dung lượng thật của Cache Storage (file HTML/CSS/JS/ảnh mà Service Worker
// đã lưu để chạy offline) — khác với localStorage (chỉ chứa dữ liệu đơn hàng…).
// Dùng navigator.storage.estimate() khi trình duyệt hỗ trợ; nếu không thì
// đếm số file trong các cache đang mở để vẫn có con số tham khảo.
async function refreshCacheStorageEstimate(){
  const el = document.getElementById('verCacheEstVal');
  if(!el) return;
  try{
    if(navigator.storage && navigator.storage.estimate){
      const est = await navigator.storage.estimate();
      const usedMB = (est.usage||0)/1024/1024;
      el.textContent = usedMB>=1 ? `${usedMB.toFixed(1)} MB` : `${((est.usage||0)/1024).toFixed(0)} KB`;
    } else if('caches' in window){
      const names = await caches.keys();
      let fileCount = 0;
      for(const n of names){ const c = await caches.open(n); fileCount += (await c.keys()).length; }
      el.textContent = `${fileCount} tệp (${names.length} cache)`;
    } else {
      el.textContent = 'Không hỗ trợ';
    }
  }catch(e){ el.textContent = 'Không xác định'; }
}

// Gom toàn bộ thông tin trên thẻ "Phiên bản ứng dụng" thành 1 đoạn văn bản
// gọn để người dùng dán vào tin nhắn khi báo lỗi cho quản trị viên/dev,
// thay vì phải chụp màn hình hoặc gõ tay lại từng dòng.
async function copyDiagnosticInfo(){
  const vi = _versionInfo;
  const displayVersion = (vi && vi.version) ? vi.version : APP_VERSION;
  const commitTxt = vi ? (String(vi.commit||'').slice(0,7)||'—') : '—';
  const swOn = typeof _swReg!=='undefined' && !!_swReg;
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone===true;
  const lines = [
    `SX Đông Phương — Thông tin chẩn đoán`,
    `Phiên bản: ${displayVersion} (#${commitTxt})`,
    `Người phát triển: ${APP_DEVELOPER} (${APP_DEVELOPER_UNIT})`,
    `Kết nối mạng: ${navigator.onLine?'Online':'Offline'}`,
    `Service Worker: ${swOn?'Đang hoạt động':'Chưa đăng ký'}`,
    `Chế độ chạy: ${isStandalone?'Ứng dụng đã cài (PWA)':'Trình duyệt web'}`,
    `Trình duyệt / Thiết bị: ${getBrowserOsInfo()}`,
    `Đã dùng trên máy này: ${fmtUsedSince(getFirstOpenTs())}`,
    `Thời điểm: ${vnDateTimeShort(new Date())}`
  ];
  const text = lines.join('\n');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else { const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    showToast('📋 Đã sao chép thông tin chẩn đoán');
  }catch(e){ showToast('⚠️ Không thể sao chép, thử lại sau'); }
}

// Xoá sạch Cache Storage (bản offline cũ) + huỷ đăng ký Service Worker rồi
// tải lại trang — dùng khi app bị lỗi hiển thị/kẹt bản cũ mà "Kiểm tra cập
// nhật" thông thường không khắc phục được. KHÔNG đụng tới dữ liệu đơn hàng
// (localStorage) hay Firebase Sync, chỉ xoá phần cache kỹ thuật.
async function clearCacheAndReload(){
  confirm2('Xóa cache & tải lại', 'Ứng dụng sẽ xoá bộ nhớ đệm offline và tải lại từ đầu. Dữ liệu đơn hàng, chấm công… vẫn được giữ nguyên (đã lưu riêng). Tiếp tục?', async ()=>{
    try{
      if('caches' in window){ const names = await caches.keys(); await Promise.all(names.map(n=>caches.delete(n))); }
      if('serviceWorker' in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=>r.unregister()));
      }
    }catch(e){ /* vẫn tải lại dù có lỗi khi dọn cache */ }
    showToast('🔄 Đang tải lại...');
    setTimeout(()=>{ window.location.reload(true); }, 400);
  });
}

async function checkUpdateManual(){
  const btn=document.getElementById('verCheckBtn');
  const badge=document.getElementById('verBadge');
  if(!navigator.onLine){
    showToast('⚠️ Không có kết nối mạng để kiểm tra');
    return;
  }
  if(btn){
    btn.disabled=true; btn.classList.add('spinning');
    const span=btn.querySelector('span'); if(span) span.textContent='Đang kiểm tra...';
  }
  if(badge){ badge.className='ver-status-badge checking'; badge.textContent='Đang kiểm tra…'; }

  const prevVersion = (typeof _lastVersion!=='undefined')?_lastVersion:'';
  const prevFail = (typeof _versionCheckFail!=='undefined')?_versionCheckFail:0;
  try{ await checkForNewVersion(); }catch(e){}
  if(typeof _swReg!=='undefined' && _swReg){ try{ _swReg.update(); }catch(e){} }

  localStorage.setItem(VER_LAST_CHECK_KEY, Date.now().toString());
  const errored = (typeof _versionCheckFail!=='undefined') && _versionCheckFail>prevFail;
  const found   = !errored && typeof _lastVersion!=='undefined' && _lastVersion && _lastVersion!==prevVersion;

  if(badge){
    if(errored){ badge.className='ver-status-badge off'; badge.textContent='⚠️ Lỗi kiểm tra'; }
    else if(found){ badge.className='ver-status-badge newver'; badge.textContent='🆕 Có bản mới'; }
    else{ badge.className='ver-status-badge ok'; badge.textContent='✓ Mới nhất'; }
  }
  const lc=document.getElementById('verLastCheck'); if(lc) lc.textContent=vnDateTimeShort(new Date());
  refreshCacheStorageEstimate();
  if(btn){
    btn.disabled=false; btn.classList.remove('spinning');
    const span=btn.querySelector('span'); if(span) span.textContent='Kiểm tra cập nhật ngay';
  }
  if(errored) showToast('⚠️ Không thể kiểm tra cập nhật, thử lại sau');
  else if(found) showToast('🆕 Đã tìm thấy bản cập nhật mới!');
  else showToast('✅ Bạn đang dùng bản mới nhất');
}
