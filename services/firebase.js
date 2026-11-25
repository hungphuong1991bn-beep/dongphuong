// src/services/firebase.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// FIREBASE HELPERS  – tất cả user đều ghi được
// ════════════════════════════════════════════════════════════
// Trả về Database URL đang dùng: URL máy này đã tự cấu hình (nếu có), nếu
// chưa từng cấu hình gì thì dùng URL mặc định của nhà máy. Nếu người dùng
// từng bấm "Bỏ qua" (__skip__), tôn trọng lựa chọn đó (chế độ offline).
function fbUrl(){
  const raw = localStorage.getItem(FB_KEY);
  if(raw === '__skip__') return '';
  if(raw && raw.trim()) return raw.replace(/__skip__/,'');
  return FB_DEFAULT_URL;
}
function fbOk(){
  const raw = localStorage.getItem(FB_KEY);
  return raw !== '__skip__'; // luôn có URL dùng được: đã lưu hoặc mặc định
}

// ════════════════════════════════════════════════════════════
// FIREBASE ANONYMOUS AUTH — nâng cấp bảo mật
// ════════════════════════════════════════════════════════════
// Trước đây app gọi thẳng REST API của Realtime Database mà KHÔNG kèm bất
// kỳ token nào — bảo mật lúc đó phụ thuộc 100% vào việc Rules để mở public
// (".read": true, ".write": true), nghĩa là AI CÓ URL đều đọc/ghi được.
// Từ giờ, mọi request sẽ tự động kèm theo 1 "auth token" ẩn danh (Anonymous
// Authentication) lấy được bằng apiKey của dự án. Sau khi khoá Rules lại
// (yêu cầu auth != null — xem hướng dẫn đổi Rules), chỉ những request có
// token hợp lệ mới đọc/ghi được, chặn được người ngoài có URL nhưng không
// qua ứng dụng. Việc đăng nhập này diễn ra NGẦM, không cần người dùng nhập
// gì thêm, không ảnh hưởng tài khoản nội bộ (users/mật khẩu trong app vẫn
// hoạt động y hệt như cũ — đây là lớp xác thực RIÊNG ở tầng Firebase).
let _fbIdToken = null;     // idToken hiện có, cache trong RAM
let _fbIdTokenExp = 0;     // thời điểm hết hạn (ms epoch)
let _fbAuthPromise = null; // gộp nhiều lượt xin token đồng thời thành 1 request

async function fbEnsureAuth(){
  const now = Date.now();
  if(_fbIdToken && now < _fbIdTokenExp - 60000) return _fbIdToken; // còn hạn, chừa 60s an toàn
  if(_fbAuthPromise) return _fbAuthPromise; // đang có 1 lượt xin token khác chạy, dùng chung kết quả
  _fbAuthPromise = (async()=>{
    try{
      const savedRefresh = localStorage.getItem(FB_REFRESH_LS);
      if(savedRefresh){
        try{
          const rr = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FB_API_KEY}`, {
            method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
            body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(savedRefresh)
          });
          if(rr.ok){
            const d = await rr.json();
            _fbIdToken = d.id_token;
            _fbIdTokenExp = now + (parseInt(d.expires_in,10)||3600)*1000;
            localStorage.setItem(FB_REFRESH_LS, d.refresh_token);
            return _fbIdToken;
          }
        }catch(e){ /* refresh lỗi (mất mạng/refresh token hết hạn) → tạo phiên ẩn danh mới bên dưới */ }
      }
      // Chưa có refresh token hoặc refresh thất bại → tạo 1 tài khoản ẩn danh mới.
      // Đây KHÔNG phải tài khoản người dùng của app — chỉ là "vé" để Firebase
      // Rules biết request này đến từ ứng dụng hợp lệ, không phải người lạ.
      const sr = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_API_KEY}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({returnSecureToken:true})
      });
      const d = await sr.json();
      if(!sr.ok) throw new Error((d && d.error && d.error.message) || ('HTTP '+sr.status));
      _fbIdToken = d.idToken;
      _fbIdTokenExp = now + (parseInt(d.expiresIn,10)||3600)*1000;
      localStorage.setItem(FB_REFRESH_LS, d.refreshToken);
      return _fbIdToken;
    }catch(e){
      console.warn('[fbEnsureAuth] Không lấy được token xác thực Firebase:', e.message||e);
      _fbIdToken = null; _fbIdTokenExp = 0;
      return null; // request phía sau sẽ gọi KHÔNG kèm auth — nếu Rules bắt buộc, Firebase sẽ tự trả lỗi quyền truy cập rõ ràng
    } finally {
      _fbAuthPromise = null;
    }
  })();
  return _fbAuthPromise;
}

// Gắn thêm ?auth=TOKEN (hoặc &auth=TOKEN nếu URL đã có dấu ?) vào 1 URL gọi
// Firebase REST. Dùng cho MỌI lệnh gọi Firebase trong app (đọc/ghi/SSE/…)
async function fbAppendAuth(url){
  const token = await fbEnsureAuth();
  if(!token) return url;
  return url + (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(token);
}
// Bản đồng bộ (không await) dùng riêng cho sendBeacon lúc đóng trang/tab —
// thời điểm đó không thể chờ xin token mới, chỉ dùng token đang có sẵn trong RAM.
function fbAppendAuthSync(url){
  if(!_fbIdToken) return url;
  return url + (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(_fbIdToken);
}

async function fbRead(path){
  const r = await fetch(await fbAppendAuth(fbUrl()+path+'.json?print=pretty'), {cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

async function fbWrite(path, data, method='PUT'){
  if(!fbOk()) return;
  const r = await fetch(await fbAppendAuth(fbUrl()+path+'.json'), {
    method,
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

// ── FIREBASE ETag CONDITIONAL WRITE ──────────────────────────
// Firebase Realtime Database hỗ trợ ETag cho từng path: đọc kèm header
// 'X-Firebase-ETag: true' sẽ trả về header 'ETag' đại diện cho đúng phiên
// bản dữ liệu hiện tại tại path đó; ghi kèm header 'if-match: <etag>' chỉ
// thành công NẾU dữ liệu server chưa đổi kể từ lúc đọc — nếu đã có thiết bị
// khác ghi đè trong lúc đó, Firebase trả về 412 Precondition Failed thay vì
// âm thầm để ai ghi sau thắng. Đây là cơ chế dùng để ghi TỪNG ĐƠN riêng lẻ
// tại /data/orders/{id} (xem writeOrderRecord) — vừa giảm băng thông (chỉ
// gửi đúng 1 bản ghi thay đổi thay vì cả mảng đơn), vừa phát hiện xung đột
// ngay tại tầng ghi thay vì phải tải cả nhánh về so sánh mỗi lần lưu.
async function fbReadETag(path){
  const r = await fetch(await fbAppendAuth(fbUrl()+path+'.json'), {headers:{'X-Firebase-ETag':'true'}, cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  const etag = r.headers.get('ETag') || '*';
  const data = await r.json();
  return {data, etag};
}
// method PUT để ghi/cập nhật, DELETE để xoá. Trả {ok:true} nếu ghi thành
// công, {ok:false, conflict:true} nếu bị 412 (ai đó vừa ghi trước mình).
async function fbWriteETag(path, data, etag, method){
  const r = await fetch(await fbAppendAuth(fbUrl()+path+'.json'), {
    method: method||'PUT',
    headers:{'Content-Type':'application/json', 'if-match': etag||'*'},
    body: method==='DELETE' ? undefined : JSON.stringify(data===undefined?null:data)
  });
  if(r.status===412) return {ok:false, conflict:true};
  if(!r.ok) throw new Error('HTTP '+r.status);
  return {ok:true, etag:r.headers.get('ETag')};
}
