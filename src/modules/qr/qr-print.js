// src/modules/qr/qr-print.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── In tem QR (mục 4) ────────────────────────────────────────────────
let _printTargetIds = [];
let _printSize = '40x30';
function openPrintModal(id){if(guardViewer())return;
  _printTargetIds = id ? [id] : [];
  // Mặc định lấy đúng số tem đã cấu hình khi tạo mã QR (thường là 2 tem/mã)
  // thay vì luôn in 1 tem — giúp đỡ tốn tem dán như đã cấu hình cho mã này.
  const rec = id ? DB.qrProducts.find(p=>p.id===id) : null;
  if($('qpLabelsPerCode')) $('qpLabelsPerCode').value = (rec && rec.labelCount) || 2;
  openModal('qrPrintModal');
}
function openBatchPrint(){if(guardViewer())return;
  const list = DB.qrProducts.filter(p=>qrFilterStatus==='all'||p.status===qrFilterStatus)
    .filter(p=>!qrSearchQ||matchQr(p,qrSearchQ));
  if(!list.length){ showToast('❌ Không có mã QR nào để in theo bộ lọc hiện tại', true); return; }
  _printTargetIds = list.map(p=>p.id);
  if($('qpLabelsPerCode')) $('qpLabelsPerCode').value = 2;
  openModal('qrPrintModal');
}
function selectPrintSize(size){
  _printSize = size;
  document.querySelectorAll('#qrPrintSizeRow .qr-print-opt').forEach(el=>el.classList.toggle('active', el.dataset.size===size));
  $('qrPrintCountWrap').style.display = size==='a4' ? 'block' : 'none';
  // Tuỳ chọn "số tem/mã" chỉ áp dụng cho in tem rời (không dùng khi in
  // nhiều tem khác nhau dồn chung trên 1 trang A4, vì khi đó người dùng
  // tự chọn tổng số tem cần in ở ô "Số lượng tem trên trang A4").
  if($('qrPrintPerCodeWrap')) $('qrPrintPerCodeWrap').style.display = size==='a4' ? 'none' : 'block';
}
const QR_LABEL_MM = { '40x30':[40,30], '50x30':[50,30], '70x50':[70,50] };
async function generateLabelPDF(){
  if(typeof window.jspdf==='undefined'){ showToast('❌ Chưa tải xong thư viện in PDF, thử lại sau vài giây', true); return; }
  await ensureQrLib();
  if(!window.QRCode){ showToast('❌ Chưa tải xong thư viện tạo mã QR, kiểm tra kết nối mạng và thử lại', true); return; }
  const ids = _printTargetIds.length ? _printTargetIds : (_qrDetailId?[_qrDetailId]:[]);
  if(!ids.length){ showToast('❌ Không có mã QR nào được chọn để in', true); return; }
  const items = ids.map(id=>DB.qrProducts.find(p=>p.id===id)).filter(Boolean);
  const { jsPDF } = window.jspdf;
  showToast('⏳ Đang tạo file PDF tem...');

  // jsPDF mặc định chỉ có font Helvetica/Times/Courier — KHÔNG hỗ trợ chữ có
  // dấu tiếng Việt. Đây chính là nguyên nhân tem in bị đo sai độ rộng chữ,
  // dẫn tới chữ bị cắt/chồng lên nhau và tên công ty hiển thị sai. Phải nạp
  // font riêng (WorkSans, đã nhúng sẵn base64, có đủ dấu tiếng Việt) và dùng
  // font này cho MỌI chữ trên tem thì đo đạc mới chính xác.
  const registerVnFont = (doc)=>{
    doc.addFileToVFS('WorkSans-Regular.ttf', WS_REGULAR_B64);
    doc.addFont('WorkSans-Regular.ttf', 'WorkSans', 'normal');
    doc.addFileToVFS('WorkSans-Bold.ttf', WS_BOLD_B64);
    doc.addFont('WorkSans-Bold.ttf', 'WorkSans', 'bold');
    doc.setFont('WorkSans','normal');
  };

  // Cắt bớt chữ + thêm dấu "…" nếu không đủ chỗ, thay vì để jsPDF tự xuống
  // dòng (cách cũ gây chồng lấn vì các dòng bên dưới có toạ độ Y cố định
  // mà không biết dòng trên đã bị đẩy xuống bao nhiêu).
  const fitText = (doc, text, maxW)=>{
    text = String(text==null?'':text);
    if(doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while(t.length>1 && doc.getTextWidth(t+'…') > maxW){ t = t.slice(0,-1); }
    return t.length ? t+'…' : '';
  };

  const drawLabel = async (doc, p, x, y, w, h)=>{
    const small = w < 55; // tem nhỏ 40x30 / 50x30mm cần bố cục cô đọng hơn
    const pad = 1.6;
    doc.setDrawColor(190); doc.setLineWidth(0.15); doc.rect(x,y,w,h);

    // ── Hàng tiêu đề: logo Đông Phương + tên công ty ──────────────
    const headerH = small ? 5.4 : 6.6;
    const logoSize = headerH - 1.6;
    try{ doc.addImage(DP_LOGO_DATAURL, 'JPEG', x+pad, y+0.8, logoSize, logoSize); }catch(e){}
    const nameX = x + pad + logoSize + 1.3;
    const nameMaxW = w - pad - logoSize - 1.3 - pad;
    doc.setFont('WorkSans','bold');
    let nameFs = small ? 5.8 : 7.2;
    const fullName = 'CÔNG TY CP CÔNG THƯƠNG ĐÔNG PHƯƠNG';
    const shortName = 'CTY CP CT ĐÔNG PHƯƠNG'; // chỉ dùng khi tem quá nhỏ, ngay cả khi đã co chữ hết cỡ vẫn không vừa
    doc.setFontSize(nameFs);
    let companyName = fullName;
    // Ưu tiên hiển thị ĐẦY ĐỦ tên công ty, chỉ thu nhỏ cỡ chữ dần cho tới
    // khi vừa khung — tránh rút gọn tên khi vẫn còn cách hiển thị đủ chữ.
    while(doc.getTextWidth(companyName) > nameMaxW && nameFs > (small?4.6:5.6)){
      nameFs -= 0.2; doc.setFontSize(nameFs);
    }
    if(doc.getTextWidth(companyName) > nameMaxW){
      companyName = shortName;
      nameFs = small ? 5.8 : 7.2;
      doc.setFontSize(nameFs);
      while(doc.getTextWidth(companyName) > nameMaxW && nameFs > 4.2){
        nameFs -= 0.2; doc.setFontSize(nameFs);
      }
    }
    doc.setTextColor(30,58,138);
    doc.text(fitText(doc, companyName, nameMaxW), nameX, y + headerH/2 + nameFs*0.32);
    doc.setTextColor(0,0,0);
    doc.setDrawColor(210); doc.setLineWidth(0.1);
    doc.line(x+pad*0.3, y+headerH, x+w-pad*0.3, y+headerH);

    // ── Phần thân: mã QR bên trái, thông tin sản phẩm bên phải ────
    const bodyY = y + headerH + 1.2;
    const bodyH = h - headerH - 2.6; // chừa chỗ cho dòng mã QR dạng chữ ở đáy tem
    const qrDataUrl = await QRCode.toDataURL(qrPublicUrl(p.qrCode), {margin:0, width:220});
    const qrSize = Math.min(bodyH, w*0.4);
    doc.addImage(qrDataUrl, 'PNG', x+pad, bodyY, qrSize, qrSize);

    const tx = x + pad + qrSize + 2, tw = w - qrSize - pad*2 - 2;
    // Dùng "Ø" thay cho "Φ" trong PDF: font nhúng cho tem không có sẵn ký tự
    // Hy Lạp Φ, còn Ø là ký hiệu đường kính tiêu chuẩn trong bản vẽ kỹ thuật.
    const specStr = p.spec.isRound ? `Ø${p.spec.phi}x${p.spec.length}mm` : `${p.spec.thickness}x${p.spec.width}x${p.spec.length}mm`;
    const lastRow = p.spec.isCoil
      ? `Cuộn ${p.coilLabel||p.quantity||1}${p.spec.meterPerCoil?`  ${p.spec.meterPerCoil}m/cuộn`:''}  ${fmtDate(p.prodDate)}`
      : `SL: ${p.quantity||1}  ${fmtDate(p.prodDate)}`;
    const rows = [
      {text: p.productCode||p.qrCode, bold:true,  fs: small?6.2:7.6},
      {text: `KH: ${p.customer||'—'}`,             bold:false, fs: small?5.2:6.4},
      {text: `QC: ${specStr}`,                     bold:false, fs: small?5.2:6.4},
      {text: lastRow, bold:false, fs: small?5.2:6.4}
    ];
    const lineH = bodyH / rows.length;
    rows.forEach((r,i)=>{
      // Co nhỏ cỡ chữ dần (tối đa ~35%) trước khi phải cắt "…" — ưu tiên
      // hiển thị đủ nội dung hơn là cắt chữ khi vẫn còn co được.
      doc.setFont('WorkSans', r.bold?'bold':'normal');
      let fs = r.fs, minFs = Math.max(r.fs*0.65, 4.2); // không co nhỏ hơn ~4.2pt để vẫn đọc được khi in
      doc.setFontSize(fs);
      while(doc.getTextWidth(r.text) > tw && fs > minFs){ fs -= 0.2; doc.setFontSize(fs); }
      const ry = bodyY + lineH*i + Math.min(lineH*0.72, r.fs*0.4+2);
      doc.text(fitText(doc, r.text, tw), tx, ry);
    });

    // ── Mã QR dạng chữ ở đáy tem, để quét/soát tay khi cần ────────
    doc.setFont('WorkSans','normal'); doc.setFontSize(small?4.6:5.4);
    doc.setTextColor(90,90,90);
    doc.text(fitText(doc, p.qrCode, w-pad*2), x+pad, y+h-1);
    doc.setTextColor(0,0,0);
  };

  if(_printSize==='a4'){
    const doc = new jsPDF({unit:'mm', format:'a4'});
    registerVnFont(doc);
    const count = Math.max(1, parseInt($('qpCount').value)||24);
    const cols=3, rows=8, mL=8, mT=10, cw=63, ch=33, gapX=3, gapY=1;
    let idx=0, placedOnPage=0;
    for(let n=0;n<count;n++){
      const item = items[idx % items.length]; idx++;
      if(!item) break;
      if(placedOnPage>0 && placedOnPage%(cols*rows)===0) doc.addPage();
      const pos = placedOnPage % (cols*rows);
      const col = pos % cols, row = Math.floor(pos/cols);
      const x = mL + col*(cw+gapX), y = mT + row*(ch+gapY);
      await drawLabel(doc, item, x, y, cw, ch);
      placedOnPage++;
    }
    doc.save(`tem-QR-A4-${Date.now()}.pdf`);
  } else {
    const [w,h] = QR_LABEL_MM[_printSize];
    // QUAN TRỌNG: jsPDF mặc định orientation:'p' (dọc). Khi không khai báo
    // orientation tường minh, với khổ tem NGANG (w>h như 40x30/50x30/70x50)
    // jsPDF sẽ tự động HOÁN ĐỔI w<->h để ép về dạng dọc — khiến trang PDF
    // thực tế hẹp hơn nhiều so với w mà drawLabel() đang dùng để tính toán,
    // làm nội dung bị vẽ tràn ra ngoài và bị cắt mất bên phải khi in. Đây
    // chính là nguyên nhân của lỗi "cắt mất phía bên phải" ở mọi khổ tem.
    // Phải luôn truyền orientation khớp với hình dạng w/h thực tế để tránh
    // bị tự động hoán đổi.
    const labelOrientation = w >= h ? 'l' : 'p';
    const doc = new jsPDF({unit:'mm', format:[w,h], orientation:labelOrientation});
    registerVnFont(doc);
    // Mỗi mã QR được in lặp lại `labelsPerCode` tem liền nhau (mặc định 2 —
    // dán 2 đầu bó hàng) thay vì chỉ 1 tem/mã như trước, để đúng với cách
    // gộp nhiều thanh vào chung 1 mã QR ở bước tạo mã.
    const labelsPerCode = Math.max(1, parseInt($('qpLabelsPerCode')?.value)||2);
    let first = true;
    for(let i=0;i<items.length;i++){
      const copies = items[i].labelCount || labelsPerCode;
      for(let c=0;c<copies;c++){
        // addPage() cũng phải truyền orientation, nếu không sẽ lặp lại đúng
        // lỗi hoán đổi w<->h ở TẤT CẢ các trang từ trang thứ 2 trở đi.
        if(!first) doc.addPage([w,h], labelOrientation);
        first = false;
        await drawLabel(doc, items[i], 0, 0, w, h);
      }
    }
    doc.save(`tem-QR-${_printSize}-${Date.now()}.pdf`);
  }
  showToast('✅ Đã tạo file PDF tem, kiểm tra mục tải xuống để in');
  closeModal('qrPrintModal');
}

// ── Xuất Excel danh sách QR (SheetJS) ────────────────────────────────
function exportQrExcel(){if(guardViewer())return;
  if(typeof XLSX==='undefined'){ showToast('⏳ Đang tải thư viện Excel, thử lại sau...', true); loadSheetJs(); return; }
  const rows = DB.qrProducts.map(p=>({
    'Mã QR':p.qrCode,'Mã sản phẩm':p.productCode,'Mã nguyên liệu':p.materialCode,'Khách hàng':p.customer,
    'Đơn hàng':p.orderPO,'Mác đồng':p.copperGrade,
    'Quy cách':p.spec.isRound?`Φ${p.spec.phi}x${p.spec.length}`:`${p.spec.thickness}x${p.spec.width}x${p.spec.length}`,
    'Trạng thái':qrStatusInfo(p.status).label,'Công đoạn':QR_STAGE_LABEL[p.currentStage]||p.currentStage,
    'Máy':p.machine,'Ca':p.shift,'Người sản xuất':p.producer,'Người vận hành':p.operator,'Ngày SX':p.prodDate,
    'QC':p.qcResult,'Vị trí kho':p.location,'Ghi chú':p.note
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'QR');
  XLSX.writeFile(wb, `danh-sach-QR-${Date.now()}.xlsx`);
}
