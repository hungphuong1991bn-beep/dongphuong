// src/modules/attendance/attendance-gate.js  — v2.9.1 (MỚI)
// ════════════════════════════════════════════════════════════
// KHOÁ TAB CHẤM CÔNG BẰNG MẬT KHẨU
//  • Admin: luôn xem + sửa + đổi mật khẩu, không phải nhập gì.
//  • Tài khoản khác (Nhân viên SX / Chỉ xem): phải nhập mật khẩu chấm công mới
//    mở được tab và chấm công. Mở khoá chỉ có hiệu lực trong phiên (đóng tab/trình
//    duyệt là phải nhập lại), tối đa 8 giờ, và tự khoá lại khi Admin đổi mật khẩu.
//  • Mật khẩu KHÔNG lưu chữ thường: chỉ lưu {h: SHA-256(salt:mật khẩu), s: salt}.
//    Mật khẩu mặc định (bản cài đặt đầu tiên) nằm bên dưới dạng băm; khi Admin đổi,
//    bản mới lưu tại /data/attMeta/pw (đồng bộ mọi thiết bị) và thay thế mặc định.
//  • Nạp SAU attendance-view.js: bọc renderChamCong (gate) và gắn nút Admin/khoá lại.
// ════════════════════════════════════════════════════════════
var ATT_GATE_DEFAULT = { s:'a90f8687c970704999b1534fa750cce3', h:'297212fc73ae820904a4405882d772f64cc8ce1897dbc534f68960513d0490b5' };
var ATT_GATE_SS_KEY  = 'sx_att_gate_v1';
var ATT_GATE_MAX_AGE = 8*60*60*1000;      // 8 giờ
var _attGateFail = 0, _attGateBlockUntil = 0;

function _attGatePw(){ var p = DB && DB.attMeta && DB.attMeta.pw; return (p && p.h && p.s) ? p : ATT_GATE_DEFAULT; }
function _attGateUid(){ return (typeof currentUser !== 'undefined' && currentUser) ? String(currentUser.id || currentUser.username || '') : ''; }

// true = được xem + chấm công tab này
function attGateOk(){
  if(typeof currentUser === 'undefined' || !currentUser) return false;
  if(typeof isAdmin === 'function' && isAdmin()) return true;
  try{
    var s = JSON.parse(sessionStorage.getItem(ATT_GATE_SS_KEY) || 'null');
    if(!s || s.uid !== _attGateUid()) return false;
    if(Date.now() - (s.ts||0) > ATT_GATE_MAX_AGE) return false;
    return s.v === _attGatePw().h.slice(0,16);      // Admin đổi mật khẩu → phiên cũ mất hiệu lực
  }catch(e){ return false; }
}
function attGateLock(){ try{ sessionStorage.removeItem(ATT_GATE_SS_KEY); }catch(e){} }
function _attGateUnlockSession(){
  try{ sessionStorage.setItem(ATT_GATE_SS_KEY, JSON.stringify({uid:_attGateUid(), ts:Date.now(), v:_attGatePw().h.slice(0,16)})); }catch(e){}
}

// ── Màn hình nhập mật khẩu ─────────────────────────────────
function _attGateRender(msg){
  var mc = document.getElementById('mc'); if(!mc) return;
  mc.innerHTML = '<div class="card" style="max-width:420px;margin:40px auto;padding:28px 22px;text-align:center">'
   + '<div style="font-size:44px;line-height:1">🔒</div>'
   + '<div style="font-size:18px;font-weight:800;margin:10px 0 4px">Tab Chấm công được bảo vệ</div>'
   + '<div style="font-size:13px;color:var(--text3);margin-bottom:16px">Nhập mật khẩu chấm công để xem và chấm công.<br>Mật khẩu do Quản trị viên cấp.</div>'
   + '<input id="attGatePw" type="password" class="field-inp" autocomplete="off" placeholder="Mật khẩu chấm công" style="width:100%;text-align:center;font-size:16px" onkeydown="if(event.key===\'Enter\')attGateSubmit()">'
   + '<div id="attGateMsg" style="min-height:20px;margin:8px 0;font-size:13px;color:#dc2626;font-weight:600">' + (msg||'') + '</div>'
   + '<button class="set-btn att2-btn att2-btn--pri" style="width:100%;padding:11px" onclick="attGateSubmit()">🔓 Mở khoá</button>'
   + '</div>';
  var i = document.getElementById('attGatePw'); if(i) try{ i.focus(); }catch(e){}
}
async function attGateSubmit(){
  var i = document.getElementById('attGatePw'); if(!i) return;
  var now = Date.now();
  if(now < _attGateBlockUntil){ _attGateRender('⏳ Sai quá nhiều lần. Thử lại sau ' + Math.ceil((_attGateBlockUntil-now)/1000) + ' giây.'); return; }
  var pw = i.value || ''; if(!pw){ _attGateRender('Vui lòng nhập mật khẩu.'); return; }
  var p = _attGatePw(), ok = false;
  try{ ok = (await hashPassword(pw, p.s)) === p.h; }catch(e){ ok = false; }
  if(ok){
    _attGateFail = 0; _attGateUnlockSession();
    try{ log('Mở khoá tab Chấm công','',''); }catch(e){}
    renderChamCong();
  } else {
    _attGateFail++;
    if(_attGateFail >= 5){ _attGateBlockUntil = Date.now() + 30000*Math.min(_attGateFail-4, 10); }
    _attGateRender('❌ Sai mật khẩu' + (_attGateFail>=5 ? ' — tạm khoá vài chục giây.' : '.'));
  }
}

// ── Admin đổi mật khẩu ─────────────────────────────────────
function attGateOpenChangePw(){
  if(!isAdmin()) return;
  var old = document.getElementById('attGatePwBox'); if(old) old.remove();
  var d = document.createElement('div'); d.id = 'attGatePwBox';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML = '<div class="card" style="width:100%;max-width:400px;padding:22px">'
   + '<div style="font-size:17px;font-weight:800;margin-bottom:4px">🔑 Mật khẩu tab Chấm công</div>'
   + '<div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">Chỉ nhân viên (không phải Admin) cần mật khẩu này. Đổi xong, mọi thiết bị đang mở khoá sẽ bị yêu cầu nhập lại.</div>'
   + '<input id="attGateNew1" type="text" class="field-inp" autocomplete="off" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" style="width:100%;margin-bottom:8px">'
   + '<input id="attGateNew2" type="text" class="field-inp" autocomplete="off" placeholder="Nhập lại mật khẩu mới" style="width:100%">'
   + '<div id="attGateNewMsg" style="min-height:20px;margin:8px 0;font-size:13px;color:#dc2626;font-weight:600"></div>'
   + '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="set-btn att2-btn" onclick="document.getElementById(\'attGatePwBox\').remove()">Huỷ</button>'
   + '<button class="set-btn att2-btn att2-btn--pri" onclick="attGateSaveNewPw()">💾 Lưu mật khẩu</button></div></div>';
  document.body.appendChild(d);
  var i = document.getElementById('attGateNew1'); if(i) try{ i.focus(); }catch(e){}
}
async function attGateSaveNewPw(){
  if(!isAdmin()) return;
  var a = (document.getElementById('attGateNew1')||{}).value || '', b = (document.getElementById('attGateNew2')||{}).value || '';
  var msg = document.getElementById('attGateNewMsg');
  if(a.length < 6){ msg.textContent = 'Mật khẩu tối thiểu 6 ký tự.'; return; }
  if(a !== b){ msg.textContent = 'Hai lần nhập không khớp.'; return; }
  var f = await makePasswordFields(a);
  var rec = {h:f.passwordHash, s:f.salt, by:attActor(), at:Date.now()};
  try{ if(fbOk()) await fbWrite('/data/attMeta/pw', rec, 'PUT'); }
  catch(e){ msg.textContent = 'Không lưu được lên máy chủ (' + e.message + '). Kiểm tra mạng rồi thử lại.'; return; }
  if(!DB.attMeta) DB.attMeta = {};
  DB.attMeta.pw = rec; _attSaveMeta();
  try{ log('Đổi mật khẩu tab Chấm công','',''); }catch(e){}
  var box = document.getElementById('attGatePwBox'); if(box) box.remove();
  showToast('✅ Đã đổi mật khẩu tab Chấm công');
}

// ── Bọc renderChamCong: chưa mở khoá → hiện màn nhập mật khẩu ──
(function(){
  var _orig = renderChamCong;
  renderChamCong = function(){
    if(!attGateOk()){ _attGateRender(); return; }
    _orig.apply(this, arguments);
    try{
      var tools = document.querySelector('.att2-tools'); if(!tools) return;
      var b = document.createElement('button'); b.className = 'set-btn att2-btn';
      if(isAdmin()){ b.textContent = '🔑 Mật khẩu chấm công'; b.onclick = attGateOpenChangePw; }
      else { b.textContent = '🔒 Khoá lại'; b.onclick = function(){ attGateLock(); renderChamCong(); }; }
      tools.appendChild(b);
    }catch(e){}
  };
})();
