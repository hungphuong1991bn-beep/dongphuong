// src/modules/qr/qr-public-scan.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function pubEsc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Đếm số lượt quét mã QR công khai (Lịch làm việc / Chấm công / Thông
// tin đơn hàng) — ghi nhận best-effort lên Firebase RTDB, không yêu cầu
// đăng nhập, không chặn/ảnh hưởng trải nghiệm người quét nếu lỗi mạng.
// Lưu tại /data/scanStats/{type}: {total, days:{YYYY-MM-DD:n}, lastAt}
// type ∈ 'lichlamviec' | 'chamcong' | 'donhang'
const SCAN_STAT_TYPES = {
  lichlamviec: 'Lịch làm việc',
  chamcong: 'Chấm công',
  donhang: 'Thông tin đơn hàng',
  khuon: 'Tổng hợp Khuôn',
  nhansu: 'Danh sách nhân sự'
};
async function pubTrackScan(type){
  try{
    const dbUrl = (new URLSearchParams(location.search).get('db') || fbUrl() || '').replace(/\/$/,'');
    if(!dbUrl) return;
    const today = (typeof todayStr==='function') ? todayStr() : new Date().toISOString().slice(0,10);
    const url = dbUrl + '/data/scanStats/' + type + '.json';
    let cur = {};
    try{
      const r = await fetch(await fbAppendAuth(url), {cache:'no-store'});
      if(r.ok) cur = (await r.json()) || {};
    }catch(e){ /* dùng cur rỗng nếu không đọc được */ }
    const days = cur.days || {};
    days[today] = (days[today]||0) + 1;
    const payload = { total: (cur.total||0) + 1, days, lastAt: Date.now() };
    await fetch(await fbAppendAuth(url), { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  }catch(e){ /* im lặng bỏ qua — không ảnh hưởng trang tra cứu công khai */ }
}

// Lấy thống kê lượt quét để hiển thị cho quản trị viên (tổng + hôm nay)
async function fetchScanStats(type){
  try{
    const dbUrl = fbUrl();
    if(!dbUrl) return null;
    const r = await fetch(await fbAppendAuth(dbUrl.replace(/\/$/,'') + '/data/scanStats/' + type + '.json'), {cache:'no-store'});
    if(!r.ok) return null;
    const d = await r.json();
    if(!d) return {total:0, today:0};
    const today = (typeof todayStr==='function') ? todayStr() : new Date().toISOString().slice(0,10);
    return { total: d.total||0, today: (d.days && d.days[today]) || 0 };
  }catch(e){ return null; }
}

// ── Trang tra cứu công khai: hiện khi khách hàng quét mã QR trên tem
// bằng camera điện thoại thường (không cần cài / đăng nhập app) ─────
async function renderPublicScan(code){
  $('loginScreen').classList.remove('active');
  $('publicScanScreen').classList.add('active');
  const wrap = $('pubWrap');
  const params = new URLSearchParams(location.search);
  const dbUrl = (params.get('db') || fbUrl() || '').replace(/\/$/,'');

  if(!dbUrl){
    wrap.innerHTML = `<div class="pub-msg">⚠️ Không thể tải dữ liệu — liên kết thiếu thông tin kết nối.<br>Vui lòng liên hệ nhà máy để được hỗ trợ.</div>`;
    return;
  }

  let record = null;
  let errMsg = null;
  try{
    // Lấy TOÀN BỘ danh sách rồi lọc ở phía trình duyệt (không dùng
    // orderBy/equalTo của Firebase) — tránh lỗi "cần thiết lập chỉ mục
    // (.indexOn)" hoặc lỗi cú pháp query từng khiến trang báo "không tìm
    // thấy" dù dữ liệu thực ra vẫn có trên máy chủ.
    const url = dbUrl + '/data/qrProducts.json?print=pretty';
    const r = await fetch(await fbAppendAuth(url), {cache:'no-store'});
    if(!r.ok){
      errMsg = `⚠️ Không kết nối được tới máy chủ dữ liệu (mã lỗi HTTP ${r.status}).<br>`
        + (r.status===401||r.status===403
            ? 'Có thể quy tắc bảo mật (Rules) của Firebase đang chặn truy cập công khai.'
            : 'Vui lòng thử lại sau ít phút hoặc liên hệ nhà máy.');
    } else {
      const data = await r.json();
      if(data){
        const arr = Array.isArray(data) ? data.filter(Boolean) : Object.values(data).filter(Boolean);
        record = arr.find(x=>x && x.qrCode===code) || null;
      }
    }
  }catch(e){
    errMsg = `⚠️ Không có kết nối mạng hoặc máy chủ dữ liệu không phản hồi.<br>Vui lòng kiểm tra lại Wi-Fi/4G rồi thử quét lại.`;
  }

  if(errMsg){
    wrap.innerHTML = `<div class="pub-msg">${errMsg}</div>`;
    return;
  }

  if(!record){
    wrap.innerHTML = `<div class="pub-msg">❌ Không tìm thấy thông tin cho mã <b>${pubEsc(code)}</b>.<br>Mã có thể chưa được đồng bộ lên hệ thống, đã bị xoá, hoặc đường truyền lúc tạo mã không ổn định — vui lòng thử lại sau ít phút hoặc liên hệ nhà máy.</div>`;
    return;
  }

  pubTrackScan('donhang');

  const p = record;
  const si = (typeof qrStatusInfo==='function') ? qrStatusInfo(p.status) : {label:p.status, cls:''};
  const statusColorMap = {
    'qr-b-producing':['#dbeafe','#1e3a8a'], 'qr-b-qc':['#fef3c7','#92400e'],
    'qr-b-instock':['#d1fae5','#065f46'], 'qr-b-outstock':['#e0e7ff','#3730a3'],
    'qr-b-error':['#fee2e2','#991b1b']
  };
  const [stBg, stFg] = statusColorMap[si.cls] || ['#e2e8f0','#334155'];
  const specStr = p.spec ? (p.spec.isRound?`Φ${p.spec.phi} × ${p.spec.length}mm`:`${p.spec.thickness} × ${p.spec.width} × ${p.spec.length}mm`) : '—';
  const qcLabel = p.qcResult==='pass'?'✅ Đạt':p.qcResult==='fail'?'❌ Không đạt':'⏳ Chưa kiểm tra';

  const items = [
    ['Khách hàng', p.customer||'—'], ['Mã sản phẩm', p.productCode||'—'],
    ['Đơn hàng', p.orderPO||'—'], ['Mã nguyên liệu', p.materialCode||'—'],
    ['Quy cách', specStr], ['Mác đồng', p.copperGrade||'—'],
    ['Ngày sản xuất', (typeof fmtDate==='function')?fmtDate(p.prodDate):(p.prodDate||'—')],
    ['Công đoạn hiện tại', (typeof QR_STAGE_LABEL!=='undefined' && QR_STAGE_LABEL[p.currentStage])||p.currentStage||'—'],
    ['Kết quả QC', qcLabel], ['Người kiểm tra QC', p.qcInspector||'—'],
    ['Trọng lượng', p.weight||'—'], ['Số lượng', p.quantity||1]
  ];

  wrap.innerHTML = `
    <div class="pub-header">
      <div class="pub-header-logo"><img src="${DP_LOGO_DATAURL}" alt="Logo Đông Phương" class="pub-header-logo-img"><span>CÔNG TY CP CÔNG THƯƠNG ĐÔNG PHƯƠNG</span></div>
      <div class="pub-header-title">${pubEsc(p.productCode||p.qrCode)}</div>
      <div class="pub-header-code">Mã QR: ${pubEsc(p.qrCode)}</div>
    </div>
    <div class="pub-card">
      <span class="pub-status" style="background:${stBg};color:${stFg}">${pubEsc(si.label||p.status)}</span>
      <div class="pub-grid" style="margin-top:14px">
        ${items.map(([l,v])=>`<div class="pub-item"><div class="lbl">${pubEsc(l)}</div><div class="val">${pubEsc(v)}</div></div>`).join('')}
      </div>
    </div>
    <div class="pub-footer">Trang tra cứu nguồn gốc sản phẩm — dữ liệu cập nhật trực tiếp từ hệ thống sản xuất</div>
  `;
}
