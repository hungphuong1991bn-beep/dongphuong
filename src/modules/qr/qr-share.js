// src/modules/qr/qr-share.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// MÃ QR CÔNG KHAI: XEM CHẤM CÔNG + LỊCH LÀM VIỆC
// Người lao động quét bằng camera điện thoại thường (không cần cài app,
// không cần đăng nhập) sẽ mở thẳng trang tra cứu, đọc dữ liệu trực tiếp
// từ Firebase RTDB — dùng chung cơ chế với mã QR truy xuất sản phẩm ──
// ════════════════════════════════════════════════════════════
function ccllvPublicUrl(){
  const base = location.origin + location.pathname;
  const db = fbUrl();
  return base + '?pub=ccllv' + (db ? '&db=' + encodeURIComponent(db) : '');
}

function scanStatCardHtml(label, stats){
  if(!stats) return `<div class="qr-stat-card" style="flex:1;text-align:left;padding:8px 10px"><div style="font-size:11px;color:var(--text4)">${label}</div><div style="font-size:12px;color:var(--text4)">— chưa có dữ liệu —</div></div>`;
  return `<div class="qr-stat-card" style="flex:1;text-align:left;padding:8px 10px">
    <div style="font-size:11px;color:var(--text4)">${label}</div>
    <div style="font-size:18px;font-weight:800;color:var(--brand)">${stats.total}<span style="font-size:11px;font-weight:600;color:var(--text3)"> lượt quét</span></div>
    <div style="font-size:11px;color:var(--text3)">Hôm nay: ${stats.today}</div>
  </div>`;
}
async function loadCcllvQrStats(){
  const box = $('ccllvQrStats'); if(!box) return;
  if(!fbOk()){ box.innerHTML = ''; return; }
  box.innerHTML = `<div style="font-size:11.5px;color:var(--text4)">Đang tải số lượt quét…</div>`;
  const [llv, cc] = await Promise.all([fetchScanStats('lichlamviec'), fetchScanStats('chamcong')]);
  if(!$('ccllvQrStats')) return; // modal đã đóng trong lúc tải
  box.innerHTML = scanStatCardHtml('📅 Lịch làm việc', llv) + scanStatCardHtml('🗓️ Chấm công', cc);
}
async function openCcllvQrModal(){
  if(guardViewer()) return;
  openModal('ccllvQrModal');
  const link = ccllvPublicUrl();
  $('ccllvQrLinkTxt').textContent = link;
  $('ccllvQrWarn').style.display = fbOk() ? 'none' : 'block';
  loadCcllvQrStats();
  const wrap = $('ccllvQrCanvasWrap');
  wrap.innerHTML = '<span style="font-size:12px;color:var(--text4)">Đang tạo mã QR…</span>';
  await ensureQrLib();
  if(!$('ccllvQrCanvasWrap')) return; // modal đã đóng trong lúc tải thư viện
  if(!window.QRCode){ wrap.innerHTML=''; wrap.textContent = link; return; }
  wrap.innerHTML = '';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  QRCode.toCanvas(canvas, link, {width:220, margin:1}, function(err){
    if(err){ wrap.innerHTML=''; wrap.textContent = link; }
  });
}

function copyCcllvLink(){
  const link = ccllvPublicUrl();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(()=>showToast('✅ Đã sao chép liên kết')).catch(()=>showToast('❌ Không thể sao chép, vui lòng tự chọn và copy', true));
  } else {
    showToast('❌ Trình duyệt không hỗ trợ sao chép tự động, vui lòng tự chọn và copy', true);
  }
}

async function downloadCcllvQr(){
  await ensureQrLib();
  if(!window.QRCode){ showToast('❌ Chưa tải xong thư viện tạo mã QR, kiểm tra kết nối mạng và thử lại', true); return; }
  try{
    const dataUrl = await QRCode.toDataURL(ccllvPublicUrl(), {margin:1, width:640});
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'QR_Cham_cong_Lich_lam_viec.png';
    a.click();
  }catch(e){
    showToast('❌ Không tạo được ảnh mã QR, vui lòng thử lại', true);
  }
}

// Tính tổng công từ dữ liệu thô (không phụ thuộc DB — dùng cho trang công khai)
// Dùng chung công thức computeCongTotalStr() với tab quản lý nhân sự (xem
// định nghĩa phía trên, gần hàm computeTotal) để tổng công hiển thị ở trang
// công khai luôn khớp với tổng công ở bảng chấm công nội bộ.
function pubComputeTotal(rowData){
  return computeCongTotalStr(rowData);
}

// ════════════════════════════════════════════════════════════
// MÃ QR CÔNG KHAI: TỔNG HỢP KHUÔN
// Khách hàng & bất kỳ ai quét bằng camera điện thoại thường (không cần
// cài app, không cần đăng nhập) sẽ mở thẳng trang tra cứu, đọc dữ liệu
// trực tiếp từ Firebase RTDB (khuonCatalog + khuonQty) — dùng chung cơ
// chế với mã QR Chấm công/Lịch làm việc và mã QR truy xuất sản phẩm ──
// ════════════════════════════════════════════════════════════
function khuonPublicUrl(){
  const base = location.origin + location.pathname;
  const db = fbUrl();
  return base + '?pub=khuon' + (db ? '&db=' + encodeURIComponent(db) : '');
}

async function loadKhuonQrStats(){
  const box = $('khuonQrStats'); if(!box) return;
  if(!fbOk()){ box.innerHTML = ''; return; }
  box.innerHTML = `<div style="font-size:11.5px;color:var(--text4)">Đang tải số lượt quét…</div>`;
  const st = await fetchScanStats('khuon');
  if(!$('khuonQrStats')) return; // modal đã đóng trong lúc tải
  box.innerHTML = scanStatCardHtml('🧩 Tổng hợp Khuôn', st);
}

async function openKhuonQrModal(){
  if(guardViewer()) return;
  openModal('khuonQrModal');
  const link = khuonPublicUrl();
  $('khuonQrLinkTxt').textContent = link;
  $('khuonQrWarn').style.display = fbOk() ? 'none' : 'block';
  loadKhuonQrStats();
  const wrap = $('khuonQrCanvasWrap');
  wrap.innerHTML = '<span style="font-size:12px;color:var(--text4)">Đang tạo mã QR…</span>';
  await ensureQrLib();
  if(!$('khuonQrCanvasWrap')) return; // modal đã đóng trong lúc tải thư viện
  if(!window.QRCode){ wrap.innerHTML=''; wrap.textContent = link; return; }
  wrap.innerHTML = '';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  QRCode.toCanvas(canvas, link, {width:220, margin:1}, function(err){
    if(err){ wrap.innerHTML=''; wrap.textContent = link; }
  });
}

function copyKhuonLink(){
  const link = khuonPublicUrl();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(()=>showToast('✅ Đã sao chép liên kết')).catch(()=>showToast('❌ Không thể sao chép, vui lòng tự chọn và copy', true));
  } else {
    showToast('❌ Trình duyệt không hỗ trợ sao chép tự động, vui lòng tự chọn và copy', true);
  }
}

async function downloadKhuonQr(){
  await ensureQrLib();
  if(!window.QRCode){ showToast('❌ Chưa tải xong thư viện tạo mã QR, kiểm tra kết nối mạng và thử lại', true); return; }
  try{
    const dataUrl = await QRCode.toDataURL(khuonPublicUrl(), {margin:1, width:640});
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'QR_Tong_hop_Khuon.png';
    a.click();
  }catch(e){
    showToast('❌ Không tạo được ảnh mã QR, vui lòng thử lại', true);
  }
}

// ════════════════════════════════════════════════════════════
// MÃ QR CÔNG KHAI: DANH SÁCH NHÂN SỰ + NGHỈ PHÉP
// Ai quét bằng camera điện thoại thường (không cài app, không đăng nhập)
// đều mở thẳng trang xem danh sách nhân viên và tình hình nghỉ phép, đọc
// trực tiếp từ Firebase RTDB. Bấm vào 1 nhân viên để xem toàn bộ hồ sơ.
// ════════════════════════════════════════════════════════════
function nhanSuPublicUrl(){
  const base = location.origin + location.pathname;
  const db = fbUrl();
  return base + '?pub=nhansu' + (db ? '&db=' + encodeURIComponent(db) : '');
}

async function loadNhanSuQrStats(){
  const box = $('nhanSuQrStats'); if(!box) return;
  if(!fbOk()){ box.innerHTML = ''; return; }
  box.innerHTML = `<div style="font-size:11.5px;color:var(--text4)">Đang tải số lượt quét…</div>`;
  const st = await fetchScanStats('nhansu');
  if(!$('nhanSuQrStats')) return; // modal đã đóng trong lúc tải
  box.innerHTML = scanStatCardHtml('👥 Danh sách nhân sự', st);
}

async function openNhanSuQrModal(){
  if(guardViewer()) return;
  openModal('nhanSuQrModal');
  const link = nhanSuPublicUrl();
  $('nhanSuQrLinkTxt').textContent = link;
  $('nhanSuQrWarn').style.display = fbOk() ? 'none' : 'block';
  loadNhanSuQrStats();
  const wrap = $('nhanSuQrCanvasWrap');
  wrap.innerHTML = '<span style="font-size:12px;color:var(--text4)">Đang tạo mã QR…</span>';
  await ensureQrLib();
  if(!$('nhanSuQrCanvasWrap')) return;
  if(!window.QRCode){ wrap.innerHTML=''; wrap.textContent = link; return; }
  wrap.innerHTML = '';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  QRCode.toCanvas(canvas, link, {width:220, margin:1}, function(err){
    if(err){ wrap.innerHTML=''; wrap.textContent = link; }
  });
}

function copyNhanSuLink(){
  const link = nhanSuPublicUrl();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(()=>showToast('✅ Đã sao chép liên kết')).catch(()=>showToast('❌ Không thể sao chép, vui lòng tự chọn và copy', true));
  } else {
    showToast('❌ Trình duyệt không hỗ trợ sao chép tự động, vui lòng tự chọn và copy', true);
  }
}

async function downloadNhanSuQr(){
  await ensureQrLib();
  if(!window.QRCode){ showToast('❌ Chưa tải xong thư viện tạo mã QR, kiểm tra kết nối mạng và thử lại', true); return; }
  try{
    const dataUrl = await QRCode.toDataURL(nhanSuPublicUrl(), {margin:1, width:640});
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'QR_Danh_sach_nhan_su.png';
    a.click();
  }catch(e){
    showToast('❌ Không tạo được ảnh mã QR, vui lòng thử lại', true);
  }
}
