// src/components/shared/capture.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Chụp 1 khối trong app thành ảnh PNG, rồi mở hộp thoại chia sẻ (nếu máy hỗ
// trợ Web Share, ví dụ điện thoại) để gửi thẳng vào nhóm Zalo/Messenger...
// Nếu máy/trình duyệt không hỗ trợ chia sẻ file thì tự tải ảnh về máy.
async function captureAndShareElement(elId, filename, shareTitle){
  const orig = document.getElementById(elId);
  if(!orig){ showToast('❌ Không tìm thấy bảng để chụp', true); return; }
  showToast('⏳ Đang chụp ảnh bảng...');
  await ensureHtml2Canvas();
  if(!window.html2canvas){ showToast('❌ Không tải được công cụ chụp ảnh, kiểm tra mạng rồi thử lại', true); return; }

  // Nhân bản khối cần chụp ra ngoài màn hình: bỏ sticky (kẻo bị lặp/kẻ dính),
  // đổi input thành chữ thường và bỏ nút xoá để ảnh chụp gọn, sạch như biên bản giấy
  const clone = orig.cloneNode(true);
  clone.querySelectorAll('input').forEach(inp=>{
    const span = document.createElement('span');
    span.textContent = inp.value || '';
    span.style.cssText = 'display:inline-block;width:100%;text-align:'+(inp.style.textAlign||'center');
    inp.parentNode.replaceChild(span, inp);
  });
  clone.querySelectorAll('button').forEach(b=>b.remove());
  clone.querySelectorAll('*').forEach(elx=>{ if(elx.style && elx.style.position==='sticky') elx.style.position='static'; });

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-99999px;top:0;background:#fff;';
  wrap.appendChild(clone);
  document.body.appendChild(wrap);

  try{
    const canvas = await window.html2canvas(clone, {scale:2, backgroundColor:'#ffffff', useCORS:true});
    document.body.removeChild(wrap);
    canvas.toBlob(async (blob)=>{
      if(!blob){ showToast('❌ Chụp ảnh thất bại, thử lại', true); return; }
      const file = new File([blob], filename, {type:'image/png'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        try{
          await navigator.share({files:[file], title:shareTitle, text:shareTitle});
          showToast('✅ Đã mở hộp thoại chia sẻ — chọn nhóm Zalo/Messenger để gửi');
          return;
        }catch(e){ /* người dùng bấm huỷ chia sẻ → rơi xuống tự tải ảnh về */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✅ Đã lưu ảnh vào máy — mở Zalo/Messenger để gửi vào nhóm');
    }, 'image/png');
  }catch(e){
    if(wrap.parentNode) document.body.removeChild(wrap);
    showToast('❌ Lỗi khi chụp ảnh: '+(e.message||e), true);
  }
}
