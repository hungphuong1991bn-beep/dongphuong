// src/modules/tv-mode/tv-mode.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// 🏭 BẢNG ĐIỀU HÀNH SẢN XUẤT — màn hình giám sát TV/monitor lớn tại xưởng.
// CHỈ ĐỌC dữ liệu từ DB.orders (phân công máy đã lưu tại o.machineAssign) —
// không lưu máy/công đoạn riêng, không nhập lại gì ở đây, nên luôn khớp
// 100% với tab Kế hoạch SX và không bao giờ có dữ liệu trùng.
// ════════════════════════════════════════════════════════════
let dhTvMode = false;   // chế độ TV: fullscreen, bố cục tự vừa khít màn hình hoàn toàn bằng CSS

// ── TV Mode "khoá cứng": khi bật (bấm nút TV Mode, hoặc mở link kèm
// ?tv=1), CỬA SỔ trình duyệt này sẽ luôn ở lại tab Điều hành SX — goTab()
// sẽ tự ép về 'dieuHanh' dù được gọi với tab nào. Lưu trong sessionStorage
// (theo TỪNG cửa sổ/tab trình duyệt riêng, KHÔNG chia sẻ với cửa sổ PC
// khác — 2 cửa sổ = 2 currentTab độc lập) nên cửa sổ PC đổi tab thoải mái
// mà không ảnh hưởng gì tới cửa sổ TV, và cửa sổ TV vẫn giữ khoá dù lỡ bị
// tải lại, không cần bấm lại TV Mode hay F5.
function dhTvLocked(){
  // Khoá cứng TV được coi là đang bật nếu MỘT TRONG HAI đúng:
  //  - sessionStorage: khoá riêng theo cửa sổ (giữ được qua F5/reload trong
  //    cùng cửa sổ, nhưng mất khi đóng hẳn cửa sổ/trình duyệt)
  //  - localStorage: khoá theo THIẾT BỊ (giữ được cả khi tắt hẳn trình
  //    duyệt/app rồi mở lại) — đây là phần mới, đáp ứng yêu cầu "khởi động
  //    lại vẫn tự vào đúng Điều hành SX", TV xưởng dùng bookmark ?tv=1 hoặc
  //    đã từng bấm nút TV Mode sẽ luôn tự khoá lại dù mất điện/khởi động lại.
  try{
    return sessionStorage.getItem('sx_tv_locked')==='1' || localStorage.getItem('sx_tv_locked')==='1';
  }catch(e){ return false; }
}

// Đồng bộ class toàn trang <body> để ẩn hẳn sidebar/topbar/bottom-nav/FAB
// khi đang ở TV Mode (không chỉ riêng khung dh-wrap) — gọi mỗi khi dhTvMode
// thay đổi (bật/tắt thủ công, hoặc tự khôi phục sau reload/khởi động lại).
function dhSyncFullscreenClass(){
  try{ document.body.classList.toggle('dh-tv-fullscreen', !!dhTvMode); }catch(e){}
}

// ── Full Screen THẬT (native, ở tầng cửa sổ Windows) khi app đang chạy
// trong bản .exe (Electron) — đi qua cầu nối window.tvNative do
// preload.js expose, main.js là nơi DUY NHẤT thực gọi
// BrowserWindow.setFullScreen()/setKiosk() và lưu trạng thái ra đĩa để
// khôi phục đúng sau auto reset/reload/khởi động lại (xem main.js).
// Khi KHÔNG chạy trong Electron (vd mở thẳng bằng trình duyệt để test,
// hoặc chạy trên Smart TV/trình duyệt nhúng) → dùng HTML Fullscreen API,
// có kèm ĐẦY ĐỦ tiền tố nhà cung cấp (webkit/moz/ms) để tương thích cả
// Safari (desktop/iPadOS) lẫn các trình duyệt WebView cũ hay gặp trên
// Smart TV Android/Tizen/webOS — trước đây chỉ gọi bản KHÔNG tiền tố nên
// im lặng KHÔNG vào được Full Screen thật trên các trình duyệt này (chỉ
// đổi được layout CSS, browser chrome/thanh địa chỉ vẫn còn).
function dhFsRequest(el){
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen
    || el.mozRequestFullScreen || el.msRequestFullscreen;
  if(!fn) return Promise.reject(new Error('Fullscreen API không được hỗ trợ'));
  try{ const r = fn.call(el); return (r && r.catch) ? r : Promise.resolve(r); }
  catch(e){ return Promise.reject(e); }
}
function dhFsExit(){
  const fn = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen
    || document.mozCancelFullScreen || document.msExitFullscreen;
  if(!fn) return Promise.resolve();
  try{ const r = fn.call(document); return (r && r.catch) ? r : Promise.resolve(r); }
  catch(e){ return Promise.resolve(); }
}
function dhFsElement(){
  return document.fullscreenElement || document.webkitFullscreenElement
    || document.mozFullScreenElement || document.msFullscreenElement || null;
}
function dhApplyFullscreen(tvMode, fullscreen){
  if(typeof window!=='undefined' && window.tvNative && window.tvNative.isElectron){
    try{ window.tvNative.setState(!!tvMode, !!fullscreen); }catch(e){}
    return;
  }
  if(fullscreen && !dhFsElement()){
    dhFsRequest(document.documentElement).catch(()=>{
      // Một số trình duyệt (Safari/nhiều WebView TV) chặn Fullscreen API nếu
      // không coi cú click là "user gesture" (VD: click đi qua lớp overlay,
      // hoặc bị delay bởi code khác chạy trước). Thử lại 1 lần ngay trong
      // cùng tick sự kiện hiện tại là đủ cho hầu hết các trường hợp; nếu vẫn
      // thất bại thì bỏ qua — layout TV Mode (CSS) vẫn hoạt động bình
      // thường, chỉ là không ẩn được thanh trình duyệt.
    });
  } else if(!fullscreen && dhFsElement()){
    dhFsExit().catch(()=>{});
  }
}

// ── Xử lý khi trạng thái Full Screen của TRÌNH DUYỆT thay đổi KHÔNG qua nút
// TV Mode trong app (VD: người dùng bấm phím Esc hoặc F11 để thoát Full
// Screen) — trước đây app KHÔNG hay biết việc này nên vẫn coi TV Mode đang
// "bật" (dhTvMode=true), khiến layout TV Mode (CSS ẩn sidebar/topbar...) bị
// kẹt lại dù trình duyệt đã hiện thanh địa chỉ/thanh công cụ trở lại — giao
// diện rối, không khớp trạng thái thật. Nay hễ phát hiện ĐANG bật TV Mode mà
// trình duyệt KHÔNG còn ở Full Screen thật nữa thì tự động tắt TV Mode theo,
// đồng bộ lại toàn bộ (khoá cửa sổ/nút bấm/layout) cho khớp thực tế. Không áp
// dụng khi chạy trong Electron (Electron tự quản lý Full Screen ở tầng
// Windows riêng qua tvNative, không dùng HTML Fullscreen API của trang).
function dhOnFullscreenChange(){
  const isElectron = typeof window!=='undefined' && window.tvNative && window.tvNative.isElectron;
  if(!isElectron && dhTvMode && !dhFsElement()){
    dhTvMode = false;
    try{ sessionStorage.removeItem('sx_tv_locked'); localStorage.removeItem('sx_tv_locked'); }catch(e){}
    if(currentTab==='dieuHanh') renderDieuHanh();
  }
  dhSyncFullscreenClass();
  dhScheduleFitNextQueues();
}

// Khi chạy trong Electron: main process là nguồn sự thật cho trạng thái
// Full Screen thật của cửa sổ. Lắng nghe để đồng bộ lại nếu main tự đổi
// (vd vừa khôi phục Full Screen lúc khởi động app, hoặc người dùng nhấn
// Esc/F11 ở tầng Windows thoát Full Screen mà không qua nút bấm trong
// app) — chỉ đồng bộ cờ khoá TV Mode (để dhTvLocked() luôn khớp thực
// tế), KHÔNG tự ý đổi tab người dùng đang xem.
if(typeof window!=='undefined' && window.tvNative && window.tvNative.isElectron){
  try{
    window.tvNative.onStateSync(state=>{
      if(!state) return;
      try{
        if(state.tvMode){ sessionStorage.setItem('sx_tv_locked','1'); localStorage.setItem('sx_tv_locked','1'); }
      }catch(e){}
      if(state.tvMode && !dhTvMode){ dhTvMode=true; dhSyncFullscreenClass(); }
    });
  }catch(e){}
}

function dhToggleTv(){
  dhTvMode = !dhTvMode;
  // Bật TV Mode = khoá luôn CỬA SỔ này ở tab Điều hành SX (theo sessionStorage
  // riêng của cửa sổ, không ảnh hưởng cửa sổ PC khác) — đúng công dụng: cửa
  // sổ này giờ là "cửa sổ TV", dùng Windows Extend kéo qua màn TV. Tắt TV Mode
  // = mở khoá, trả cửa sổ này về trạng thái bình thường (đổi tab được như PC).
  try{
    if(dhTvMode){ sessionStorage.setItem('sx_tv_locked','1'); localStorage.setItem('sx_tv_locked','1'); }
    else { sessionStorage.removeItem('sx_tv_locked'); localStorage.removeItem('sx_tv_locked'); }
  }catch(e){}
  dhSyncFullscreenClass();
  dhApplyFullscreen(dhTvMode, dhTvMode);
  renderDieuHanh();
}

// ── TV Mode BỐ CỤC THUẦN CSS — không còn hàm JS nào đo/co giãn layout nữa.
// "Vừa khít 1 màn hình, không cuộn" ở mọi độ phân giải (1920×1080 /
// 2560×1440 / 3840×2160) hoàn toàn do CSS đảm nhiệm (Flex chia đều theo
// nhóm máy + Grid 1-hàng-duy-nhất theo var(--n) + clamp(dvh) cho chữ/khoảng
// cách — xem chi tiết trong khối CSS ".dh-wrap.dh-tv" ở phần <style>), nên
// không cần requestAnimationFrame/setTimeout/ResizeObserver để "dò" kích
// thước như bản cũ nữa — trình duyệt tự tính lại tức thời mỗi khi resize.
//
// Phần JS còn lại dưới đây KHÔNG liên quan tới bố cục: chỉ đảm bảo cửa sổ
// TV (đã khoá cứng qua dhToggleTv()/?tv=1) luôn tự quay lại đúng tab Điều
// hành SX + đúng class fullscreen mỗi khi màn hình TV được bật lại (đổi
// nguồn HDMI, khoá màn hình rồi mở lại...) — logic này giữ nguyên như cũ.
let _dhWatchersBound = false;
function dhBindAutoFit(){
  if(_dhWatchersBound) return;
  _dhWatchersBound = true;
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden){
      if(dhTvLocked() && currentTab!=='dieuHanh') goTab('dieuHanh');
      dhSyncFullscreenClass();
      dhScheduleFitNextQueues();
    }
  });
  document.addEventListener('fullscreenchange', dhOnFullscreenChange);
  document.addEventListener('webkitfullscreenchange', dhOnFullscreenChange);
  document.addEventListener('mozfullscreenchange', dhOnFullscreenChange);
  document.addEventListener('MSFullscreenChange', dhOnFullscreenChange);
  // Đổi độ phân giải / kéo cửa sổ TV qua màn khác (Windows Extend) / xoay màn
  // — CSS clamp(dvh/dvw) tự co giãn ngay, nhưng số đơn "chạy tiếp" hiển thị
  // vừa khít cần đo lại vì phụ thuộc chiều cao PIXEL thật của từng card.
  window.addEventListener('resize', dhScheduleFitNextQueues);
  // An toàn thêm: 'load' (ảnh/logo/font tải xong có thể đổi chiều cao card
  // so với lúc DOM vừa render) và ResizeObserver theo dõi TRỰC TIẾP khung
  // #dhWrap (bắt được mọi thay đổi kích thước thật sự của khu vực TV — kể cả
  // những trường hợp không phát sinh sự kiện 'resize' của window, ví dụ khi
  // trình duyệt/OS đổi tỉ lệ hiển thị (zoom/DPI) hoặc đổi safe-area) để
  // dhFitNextQueues() luôn được đo lại đúng lúc, không phụ thuộc trọn vẹn vào
  // 1 lần requestAnimationFrame ngay sau render.
  window.addEventListener('load', dhScheduleFitNextQueues);
  if(window.ResizeObserver){
    const dhWrapEl = document.getElementById('dhWrap');
    if(dhWrapEl){
      const ro = new ResizeObserver(()=>dhScheduleFitNextQueues());
      ro.observe(dhWrapEl);
    }
  }
}
