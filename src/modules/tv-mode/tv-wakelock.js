// src/modules/tv-mode/tv-wakelock.js — Giai đoạn 4: giữ màn hình TV không tắt/ngủ khi đang ở TV Mode
// Dùng Screen Wake Lock API (nếu trình duyệt/WebView hỗ trợ). Trình duyệt tự nhả khoá khi tab bị ẩn,
// nên xin lại khi tab hiện lại. Không hỗ trợ / bị từ chối → bỏ qua im lặng (TV Mode vẫn chạy như cũ).
// Không sửa tv-mode.js: chỉ đọc cờ dhTvMode / dhTvLocked() và bọc dhToggleTv để cập nhật ngay.
let _tvWake = null;
function tvWantWake(){
  try{ return !!(dhTvMode || (typeof dhTvLocked==='function' && dhTvLocked())); }catch(e){ return false; }
}
async function tvSyncWakeLock(){
  if(!('wakeLock' in navigator)) return;
  try{
    if(tvWantWake()){
      if(!_tvWake && !document.hidden){
        _tvWake = await navigator.wakeLock.request('screen');
        _tvWake.addEventListener('release', ()=>{ _tvWake = null; });
      }
    } else if(_tvWake){
      const l = _tvWake; _tvWake = null; await l.release();
    }
  }catch(e){ _tvWake = null; /* bị từ chối (pin yếu, chưa có quyền…) → bỏ qua */ }
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) tvSyncWakeLock(); });
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev, ()=>setTimeout(tvSyncWakeLock,0)));
window.addEventListener('load', ()=>setTimeout(tvSyncWakeLock, 1500));
setInterval(tvSyncWakeLock, 60000);   // kiểm tra nhẹ mỗi phút (không làm gì nếu trạng thái không đổi)
dpEnhanceRender('dhToggleTv', ()=>{ tvSyncWakeLock(); });
