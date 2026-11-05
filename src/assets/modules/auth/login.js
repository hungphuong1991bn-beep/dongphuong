// src/modules/auth/login.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// CHỐNG DÒ MẬT KHẨU (BRUTE-FORCE) KHI ĐĂNG NHẬP
// ────────────────────────────────────────────────────────────
// Trước đây không giới hạn số lần thử đăng nhập sai → 1 script tự
// động có thể dò mật khẩu liên tục không giới hạn. Giờ sau 5 lần sai
// liên tiếp sẽ khoá tạm thời, thời gian khoá tăng dần mỗi lần vẫn sai
// tiếp (15s → 30s → 60s..., tối đa 5 phút). Đây là chặn ở PHÍA TRÌNH
// DUYỆT (localStorage) nên chỉ cản người dùng thông thường/bot đơn
// giản, KHÔNG chặn được kẻ tấn công tự xoá localStorage — vẫn cần
// khoá Firebase Rules để bảo vệ triệt để (xem ghi chú ở fbRead/fbWrite).
const LOGIN_LOCK_KEY = 'sx_login_lock';
function getLoginLock(){ try{ return JSON.parse(localStorage.getItem(LOGIN_LOCK_KEY)||'null'); }catch(e){ return null; } }
function setLoginLock(o){ try{ localStorage.setItem(LOGIN_LOCK_KEY, JSON.stringify(o)); }catch(e){} }
function clearLoginLock(){ try{ localStorage.removeItem(LOGIN_LOCK_KEY); }catch(e){} }
function registerLoginFail(){
  const lock = getLoginLock() || {fails:0, until:0};
  lock.fails = (lock.fails||0)+1;
  let lockSeconds = 0;
  if(lock.fails>=5){ lockSeconds = Math.min(300, 15*Math.pow(2, lock.fails-5)); lock.until = Date.now()+lockSeconds*1000; }
  setLoginLock(lock);
  return lockSeconds;
}
function loginLockSecondsLeft(){
  const lock = getLoginLock();
  if(!lock || !lock.until) return 0;
  const left = Math.ceil((lock.until-Date.now())/1000);
  return left>0 ? left : 0;
}

async function doLogin(){
  const u=$('lu').value.trim(), p=$('lp').value;
  const err=$('loginErr'), btn=$('loginBtn');
  err.style.display='none';
  if(!u||!p){err.textContent='Nhập đủ tài khoản và mật khẩu';err.style.display='block';return;}
  const lockLeft = loginLockSecondsLeft();
  if(lockLeft>0){ err.textContent=`⏳ Sai quá nhiều lần, vui lòng thử lại sau ${lockLeft}s`; err.style.display='block'; return; }
  btn.disabled=true; btn.textContent='Đang xử lý...';

  // ── FIX ĐỒNG BỘ TÀI KHOẢN ─────────────────────────────────────
  // Trước đây: hàm chỉ so khớp với DB.users trong bộ nhớ cache cục bộ
  // (localStorage), còn dữ liệu mới nhất trên Firebase chỉ được tải về
  // SAU khi đăng nhập thành công (initAndStartSync). Vì vậy nếu 1 tài
  // khoản mới được tạo / đổi mật khẩu ở thiết bị A, thiết bị B (chưa
  // từng đăng nhập lần nào nên chưa có cache) sẽ không thấy tài khoản
  // đó và báo sai mật khẩu dù đã cấu hình đúng Firebase.
  // → Đọc /data/users mới nhất từ Firebase TRƯỚC khi kiểm tra, rồi mới
  // đối chiếu tài khoản/mật khẩu. Nếu mất mạng/lỗi thì vẫn dùng cache
  // cục bộ để không chặn đăng nhập khi offline.
  if(fbOk()){
    try{
      const freshUsers = await fbRead('/data/users');
      if(freshUsers){
        const arr = Array.isArray(freshUsers) ? freshUsers : Object.values(freshUsers);
        if(arr.length){ DB.users = arr; lsSave(); }
      }
    }catch(e){ /* offline hoặc lỗi mạng → dùng cache cục bộ */ }
  }

  setTimeout(async ()=>{
    const foundUser=DB.users.find(x=>x.username===u);
    const passOk = await verifyPassword(foundUser, p);
    if(foundUser && passOk){
      const user = foundUser;
      clearLoginLock();
      // Băm lại mật khẩu (của user này và mọi user cũ khác chưa migrate)
      // ngay khi có dịp, để không còn mật khẩu chữ thường tồn tại lâu dài
      if(await migrateUserPasswords(DB.users)){
        lsSave();
        // Dùng merge thay vì PUT thẳng cả mảng — lý do xem ghi chú ở đoạn
        // khôi phục phiên đăng nhập (DOMContentLoaded) bên dưới.
        if(fbOk()) mergeAndSaveUsers().catch(()=>{});
      }
      ensureUserProfileFields(user);
      user.lastLoginAt = Date.now();
      currentUser=user;
      // Lưu session để giữ đăng nhập sau reload
      try{ localStorage.setItem('sx_session_uid', user.id); }catch(e){}
      $('loginScreen').classList.remove('active');
      $('appScreen').classList.add('active');
      updateTopbarProfile(user);
      log('Đăng nhập','Đăng nhập thành công','');
      // Trước đây: nếu máy CHƯA từng cấu hình Firebase, ép hiện màn hình
      // "Cấu hình Firebase" ngay sau khi đăng nhập. Giờ app đã có sẵn URL
      // mặc định (FB_DEFAULT_URL) nên tự động kết nối luôn, không cần hỏi —
      // người dùng vẫn có thể vào Cài đặt ▸ Cấu hình Firebase Sync để đổi
      // sang URL/dự án khác bất cứ lúc nào nếu muốn.
      notifLoad();
      initAndStartSync().then(()=>{
        updateOnline();
        // Load announce đang active từ Firebase
        if(fbOk()) checkAnnounce();

      });
      requestNotif();
      updateBellBadge();
      // Hiện nút viết TB cho admin
      const wb=$('annWriteBtn');
      if(wb) wb.style.display=isAdmin()?'flex':'none';
      aiCacheLoad(); updateAiBubble();
      applyRoleNav();
      goTab(defaultTabFor());
    } else {
      const lockSeconds = registerLoginFail();
      err.textContent = lockSeconds>0
        ? `⏳ Sai quá nhiều lần, tài khoản tạm khoá đăng nhập ${lockSeconds}s`
        : 'Tên đăng nhập hoặc mật khẩu không đúng';
      err.style.display='block';
      $('loginCard').classList.add('shake');
      setTimeout(()=>$('loginCard').classList.remove('shake'),400);
    }
    btn.disabled=false; btn.textContent='Đăng nhập →';
  },300);
}

function doLogout(){
  log('Đăng xuất','','');
  if(fbOk()) navigator.sendBeacon(fbAppendAuthSync(fbUrl()+'/presence/'+_devId+'.json'),JSON.stringify(null));
  clearInterval(_pollTimer); _pollTimer=null;
  currentUser=null; currentTab='dashboard';
  document.body.classList.remove('sl-fullscreen');
  closeAiChatWindow();
  const abw=$('aiBubbleWrap'); if(abw) abw.classList.remove('show');
  try{ localStorage.removeItem('sx_session_uid'); }catch(e){}
  // Ẩn nút announce khi logout
  const wb=$('annWriteBtn'); if(wb) wb.style.display='none';
  hideAnnBanner();
  $('appScreen').classList.remove('active');
  $('loginScreen').classList.add('active');
  $('lp').value='';
}
