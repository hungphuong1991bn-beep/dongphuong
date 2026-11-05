// src/components/SetupScreens.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- ═══ FIREBASE SETUP ═══ -->
<div id="aiSetup" class="fb-screen" style="display:none">
  <div class="fb-card">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:32px;margin-bottom:8px">🤖</div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">Cấu hình AI Copilot nâng cao</div>
      <div style="font-size:12.5px;color:var(--text3);margin-top:4px;line-height:1.5">Nhập Anthropic API key để AI hiểu được cả những câu phức tạp/mơ hồ mà bộ luật có sẵn chưa xử lý được. Bỏ trống nếu chỉ muốn dùng bộ lệnh nhanh có sẵn (không cần mạng, không tốn phí).</div>
    </div>
    <div class="field">
      <div class="field-lbl">Anthropic API Key</div>
      <input id="aiKeyInp" class="field-inp" type="password" placeholder="sk-ant-...">
    </div>
    <div style="font-size:11px;color:var(--text4);margin:-6px 0 14px;line-height:1.5">⚠️ Key được lưu trên trình duyệt của máy này và gọi thẳng tới api.anthropic.com. Chỉ dùng trên thiết bị tin cậy của Admin.</div>
    <button class="btn btn-primary" style="width:100%" onclick="saveAiCfg()">💾 Lưu &amp; Bật AI nâng cao</button>
    <button class="btn" style="width:100%;margin-top:8px;background:transparent;color:var(--text3)" onclick="skipAiCfg()">Để sau</button>
  </div>
</div>
<div id="fbSetup" class="fb-screen" style="display:none">
  <div class="fb-card">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:32px;margin-bottom:8px">🔥</div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">Cấu hình Firebase</div>
      <div style="font-size:12.5px;color:var(--text3);margin-top:4px;line-height:1.5">Nhập URL để đồng bộ dữ liệu thời gian thực trên tất cả thiết bị</div>
    </div>
    <div class="field">
      <div class="field-lbl">Firebase Database URL</div>
      <input id="fbUrlInp" class="field-inp" type="url" placeholder="https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app">
    </div>
    <button class="btn btn-primary" style="width:100%" onclick="saveFbCfg()">💾 Lưu &amp; Kết nối</button>
    <div style="margin-top:20px">
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px">Hướng dẫn (miễn phí, 5 phút):</div>
      <div class="fb-step"><div class="fb-step-n">1</div><div class="fb-step-t">Vào <b>console.firebase.google.com</b> → Add project</div></div>
      <div class="fb-step"><div class="fb-step-n">2</div><div class="fb-step-t"><b>Realtime Database</b> → Create → Asia Southeast</div></div>
      <div class="fb-step"><div class="fb-step-n">3</div><div class="fb-step-t">Rules: đổi <b>".read": true, ".write": true</b> → Publish</div></div>
      <div class="fb-step"><div class="fb-step-n">4</div><div class="fb-step-t">Copy <b>Database URL</b> dán vào ô trên</div></div>
    </div>
    <div style="text-align:center;margin-top:14px">
      <button onclick="skipFb()" style="border:none;background:none;color:var(--text4);font-size:12px;cursor:pointer;font-family:inherit">Bỏ qua – lưu cục bộ</button>
    </div>
  </div>
</div>`);


// ════════════════════════════════════════════════════════════
// FIREBASE SETUP
// ════════════════════════════════════════════════════════════
async function saveFbCfg(){if(guardViewer())return;
  const url=$('fbUrlInp').value.trim().replace(/\/+$/,'');
  if(!url.startsWith('https://')){ alert('URL phải bắt đầu bằng https://'); return; }
  showToast('⏳ Đang kiểm tra kết nối Firebase...');
  try{
    // Thử ghi rồi đọc lại 1 giá trị nhỏ để chắc chắn: (1) URL đúng,
    // (2) Rules cho phép đọc/ghi công khai — nếu không, mã QR sau này
    // sẽ không thể tra cứu được từ điện thoại khách hàng.
    const testPath = url + '/data/_conn_test.json';
    const wr = await fetch(await fbAppendAuth(testPath), {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(Date.now())});
    if(!wr.ok) throw new Error('Ghi thất bại (HTTP '+wr.status+')');
    const rd = await fetch(await fbAppendAuth(testPath), {cache:'no-store'});
    if(!rd.ok) throw new Error('Đọc thất bại (HTTP '+rd.status+')');
  }catch(e){
    alert('❌ Không kết nối được tới Firebase với URL này.\n\nLỗi: '+e.message+'\n\nKiểm tra lại:\n• URL Firebase Realtime Database có đúng không\n• Rules đã đổi sang yêu cầu đăng nhập (vd: ".read": "auth != null", ".write": "auth != null") và Anonymous Authentication đã được BẬT trong Firebase Console\n• URL này có thuộc đúng dự án Firebase gắn với apiKey đang cấu hình trong app hay không\n\nNếu không sửa, các mã QR sẽ KHÔNG quét được từ điện thoại khách hàng.');
    return;
  }
  localStorage.setItem(FB_KEY,url);
  $('fbSetup').style.display='none';
  showToast('✅ Đã kết nối và lưu cấu hình Firebase');
  log('Cấu hình Firebase','Đã kết nối Firebase','');
  if(currentUser) initAndStartSync();
}
function skipFb(){if(guardViewer())return; localStorage.setItem(FB_KEY,'__skip__'); $('fbSetup').style.display='none'; }
