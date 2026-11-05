// src/modules/qr/qr-actions.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────

function openQrDetail(id){
  const p = DB.qrProducts.find(x=>x.id===id);
  if(!p){ showToast('❌ Không tìm thấy mã QR này (có thể sai hoặc đã xoá)', true); return; }
  _qrDetailId = id;
  const si = qrStatusInfo(p.status);
  const specStr = p.spec.isRound?`Φ${p.spec.phi} × ${p.spec.length}mm`:`${p.spec.thickness} × ${p.spec.width} × ${p.spec.length}mm`;
  const canManage = isStaff();
  const curIdx = QR_STAGES.findIndex(s=>s.key===p.currentStage);

  const infoItems = [
    ['Mã QR', p.qrCode], ['Mã sản phẩm', p.productCode], ['Mã nguyên liệu', p.materialCode||'—'],
    ['Khách hàng', p.customer||'—'], ['Đơn hàng (PO)', p.orderPO||'—'],
    ['Quy cách', specStr], ['Mác đồng', p.copperGrade],
    ...(p.spec.isCoil ? [
      ['📀 Cuộn số', p.coilLabel||'—'],
      ['Mét / cuộn', p.spec.meterPerCoil?`${p.spec.meterPerCoil}m`:'—']
    ] : []),
    ['Máy sản xuất', p.machine||'—'],
    ['Ca sản xuất', p.shift||'—'], ['Người sản xuất', p.producer||'—'],
    ['Ngày sản xuất', fmtDate(p.prodDate)], ['Giờ bắt đầu', p.startTime||'—'], ['Giờ kết thúc', p.endTime||'—'],
    ['Người vận hành', p.operator||'—'], ['Người kiểm tra QC', p.qcInspector||'—'],
    ['Kết quả QC', p.qcResult==='pass'?'✅ Đạt':p.qcResult==='fail'?'❌ Không đạt':'⏳ Chưa kiểm tra'],
    ['Độ cứng', p.hardness||'—'], ['Độ dẫn điện', p.conductivity||'—'],
    ['Trọng lượng', p.weight||'—'],
    ['Vị trí lưu kho', p.location||'—']
  ];
  // Số lượng thanh/cuộn: admin được sửa trực tiếp ngay tại đây (input số + nút Lưu)
  // thay vì chỉ hiển thị tĩnh — vì thực tế hay cần đính chính số thanh/cuộn sau
  // khi đã tạo mã QR (đếm lại kho, gộp/tách bó...).
  const qtyUnit = p.spec.isCoil ? 'cuộn' : 'thanh';
  const qtyItemHTML = isAdmin()
    ? `<div class="qr-detail-item qr-qty-edit">
        <div class="lbl">Số lượng (${qtyUnit})</div>
        <div class="val" style="display:flex;align-items:center;gap:6px">
          <input id="qrQtyInp-${p.id}" type="number" min="1" value="${p.quantity||1}" style="width:64px;border:1px solid var(--border);border-radius:7px;padding:4px 6px;font-size:13px;font-family:inherit;font-weight:700;color:var(--text);background:var(--card)">
          <button class="qr-qty-save-btn" onclick="editQrQuantity('${p.id}')" title="Lưu số lượng">💾</button>
        </div>
      </div>`
    : `<div class="qr-detail-item"><div class="lbl">Số lượng (${qtyUnit})</div><div class="val">${p.quantity||1}</div></div>`;

  $('qrDetailTitle').textContent = p.qrCode;
  $('qrDetailBody').innerHTML = `
    <div class="qr-detail-box">
      <div id="qrDetailCanvas" style="width:150px;height:150px;background:#fff;display:flex;align-items:center;justify-content:center"></div>
      <span class="qr-badge ${si.cls}" style="font-size:12px">${si.label}</span>
    </div>
    <div class="qr-detail-grid">${infoItems.map(([l,v])=>`<div class="qr-detail-item"><div class="lbl">${l}</div><div class="val">${v}</div></div>`).join('')}${qtyItemHTML}</div>
    ${p.note?`<div class="card-note" style="margin-bottom:10px">📝 ${p.note}</div>`:''}
    <div class="sec-title" style="margin:0 0 6px">Lịch sử công đoạn (Timeline)</div>
    <div class="qr-timeline">
      ${(p.history||[]).map(h=>`<div class="qr-tl-item"><div class="qr-tl-time">${fmtDateTime(h.time)}</div><div class="qr-tl-label">${h.label||QR_STAGE_LABEL[h.stage]||h.stage}${h.by?' · '+h.by:''}</div>${h.note?`<div class="qr-tl-note">${h.note}</div>`:''}</div>`).join('') || '<div class="qr-timeline-empty">Chưa có lịch sử</div>'}
    </div>
    ${canManage?`
    <div class="sec-title" style="margin:0 0 6px">Cập nhật công đoạn</div>
    <div class="qr-stage-row">
      ${QR_STAGES.map((s,i)=>`<button class="qr-stage-btn ${i<curIdx?'done':i===curIdx?'current':''}" onclick="advanceQrStage('${p.id}','${s.key}')">${s.icon} ${s.label}</button>`).join('')}
    </div>
    <div class="modal-row">
      <button class="btn btn-ghost" onclick="promptQcResult('${p.id}','pass')">✅ QC Đạt</button>
      <button class="btn btn-ghost" onclick="promptQcResult('${p.id}','fail')">❌ QC Không đạt</button>
    </div>
    <div class="modal-row">
      <button class="btn btn-ghost" onclick="transferQrWarehouse('${p.id}')">📦 Nhập/Chuyển kho</button>
      <button class="btn btn-ghost" onclick="exportQrWarehouse('${p.id}')">🚚 Xuất kho</button>
    </div>
    <div class="field"><div class="field-lbl">Thêm ghi chú</div>
      <div style="display:flex;gap:6px">
        <input id="qrNoteInp-${p.id}" class="field-inp" placeholder="Nhập ghi chú...">
        <button class="btn btn-primary" style="flex:0 0 auto;padding:0 14px" onclick="addQrNote('${p.id}')">Lưu</button>
      </div>
    </div>
    <div class="field"><div class="field-lbl">Đính kèm hình ảnh</div>
      <input type="file" accept="image/*" onchange="attachQrImage('${p.id}', this)">
    </div>
    ${(p.images&&p.images.length)?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${p.images.map(im=>`<img src="${im}" style="width:60px;height:60px;object-fit:cover;border-radius:6px">`).join('')}</div>`:''}
    `:''}
    ${isAdmin()?`
    <div class="sec-title" style="margin:14px 0 6px;color:var(--red-m)">Khu vực nguy hiểm</div>
    <div class="modal-row">
      <button class="btn btn-ghost" style="color:var(--red-m);border-color:var(--red-l)" onclick="deleteQrProduct('${p.id}')">🗑 Xóa mã QR này</button>
    </div>
    `:''}
  `;
  openModal('qrDetailModal');
  // Vẽ QR sau khi modal đã mở — chờ thư viện QRCode.js tải xong hẳn
  // (trước đây nếu thư viện chưa kịp tải, mã QR sẽ hiện chữ/số thay vì
  // hình ảnh mã QR thật)
  const el = $('qrDetailCanvas');
  if(el){
    el.innerHTML = '<span style="font-size:11px;color:var(--text4)">Đang tạo mã QR…</span>';
    ensureQrLib().then(()=>{
      const elNow = $('qrDetailCanvas');
      if(!elNow || _qrDetailId!==p.id) return; // modal đã đổi/đóng
      if(!window.QRCode){ elNow.innerHTML=''; elNow.textContent = p.qrCode; return; }
      elNow.innerHTML = '';
      const canvas = document.createElement('canvas');
      elNow.appendChild(canvas);
      QRCode.toCanvas(canvas, qrPublicUrl(p.qrCode), {width:140,margin:1}, function(err){
        if(err){ elNow.innerHTML=''; elNow.textContent = p.qrCode; }
      });
    });
  }
}
function touchQr(p){ p.updatedAt=Date.now(); p.updatedBy=currentUser?.id; }

function advanceQrStage(id, stageKey){if(guardViewer())return;
  const p = DB.qrProducts.find(x=>x.id===id); if(!p) return;
  const st = QR_STAGES.find(s=>s.key===stageKey); if(!st) return;
  p.currentStage = stageKey;
  p.history.push({stage:stageKey,label:st.label,time:Date.now(),by:currentUser?.name||'?'});
  if(stageKey==='kiemtra') p.status='qc_pending';
  else if(stageKey==='dongoi') p.status = p.qcResult==='fail' ? 'error' : 'in_stock';
  else if(stageKey==='xuatkho') p.status='out_stock';
  else if(p.status!=='error') p.status='producing';
  if(stageKey==='xuatkho') p.endTime = fmtDateTime(Date.now());
  touchQr(p);
  log('Cập nhật công đoạn QR', `${p.qrCode} → ${st.label}`, p.orderId, null, {qrCode:p.qrCode,stage:stageKey});
  saveQrProducts();
  openQrDetail(id);
  showToast(`✅ Đã chuyển sang: ${st.label}`);
}
function promptQcResult(id, result){if(guardViewer())return;
  const p = DB.qrProducts.find(x=>x.id===id); if(!p) return;
  const inspector = (currentUser?.name)||'';
  p.qcResult = result;
  p.qcInspector = inspector;
  p.status = result==='fail' ? 'error' : (p.currentStage==='dongoi'||p.currentStage==='xuatkho' ? p.status : 'qc_pending');
  p.history.push({stage:'kiemtra',label:result==='pass'?'QC: Đạt':'QC: Không đạt',time:Date.now(),by:inspector});
  touchQr(p);
  log('QC thành phẩm', `${p.qrCode} → ${result==='pass'?'Đạt':'Không đạt'}`, p.orderId, null, {qrCode:p.qrCode,result});
  saveQrProducts();
  openQrDetail(id);
  showToast(result==='pass'?'✅ Đã ghi nhận QC Đạt':'❌ Đã ghi nhận QC Không đạt');
}
function transferQrWarehouse(id){if(guardViewer())return;
  const p = DB.qrProducts.find(x=>x.id===id); if(!p) return;
  const loc = prompt('Nhập vị trí lưu kho (VD: Kho A - Kệ 3):', p.location||'');
  if(loc===null) return;
  p.location = loc.trim();
  p.status = 'in_stock';
  p.history.push({stage:'dongoi',label:'Nhập/Chuyển kho: '+ (loc||'—'),time:Date.now(),by:currentUser?.name||'?'});
  touchQr(p);
  log('Chuyển kho QR', `${p.qrCode} → ${loc}`, p.orderId, null, {qrCode:p.qrCode,location:loc});
  saveQrProducts();
  openQrDetail(id);
  showToast('✅ Đã cập nhật vị trí kho');
}
function exportQrWarehouse(id){if(guardViewer())return;
  const p = DB.qrProducts.find(x=>x.id===id); if(!p) return;
  confirm2('Xuất kho', `Xác nhận xuất kho mã ${p.qrCode}?`, ()=>{
    p.status='out_stock';
    p.history.push({stage:'xuatkho',label:'Xuất kho',time:Date.now(),by:currentUser?.name||'?'});
    p.endTime = fmtDateTime(Date.now());
    touchQr(p);
    log('Xuất kho QR', p.qrCode, p.orderId, null, {qrCode:p.qrCode});
    saveQrProducts();
    closeModal('cfModal');
    openQrDetail(id);
    showToast('🚚 Đã xuất kho');
  });
}
function addQrNote(id){if(guardViewer())return;
  const p = DB.qrProducts.find(x=>x.id===id); if(!p) return;
  const inp = $('qrNoteInp-'+id); if(!inp) return;
  const txt = inp.value.trim(); if(!txt) return;
  p.note = p.note ? (p.note+' | '+txt) : txt;
  p.history.push({stage:p.currentStage,label:'Ghi chú',time:Date.now(),by:currentUser?.name||'?',note:txt});
  touchQr(p);
  saveQrProducts();
  openQrDetail(id);
  showToast('✅ Đã thêm ghi chú');
}
function attachQrImage(id, inputEl){if(guardViewer())return;
  const p = DB.qrProducts.find(x=>x.id===id); if(!p) return;
  const file = inputEl.files && inputEl.files[0]; if(!file) return;
  if(!p.images) p.images=[];
  if(p.images.length>=3){ showToast('❌ Tối đa 3 hình ảnh mỗi mã QR', true); return; }
  const reader = new FileReader();
  reader.onload = ()=>{
    // Thu nhỏ ảnh trước khi lưu để tránh phình dữ liệu Firebase
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      const maxW = 480; const scale = Math.min(1, maxW/img.width);
      canvas.width = img.width*scale; canvas.height = img.height*scale;
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      p.images.push(canvas.toDataURL('image/jpeg',0.7));
      touchQr(p);
      saveQrProducts();
      openQrDetail(id);
      showToast('✅ Đã đính kèm hình ảnh');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ── Sửa số lượng thanh của mã QR (chỉ Admin) ─────────────────────────
function editQrQuantity(id){if(guardViewer())return;
  if(!isAdmin()){ showToast('❌ Chỉ Admin mới được sửa số lượng', true); return; }
  const p = DB.qrProducts.find(x=>x.id===id); if(!p) return;
  const inp = $('qrQtyInp-'+id); if(!inp) return;
  const val = parseInt(inp.value);
  if(!val || val<1){ showToast('❌ Số lượng phải là số nguyên ≥ 1', true); inp.value = p.quantity||1; return; }
  const oldVal = p.quantity||1;
  if(val===oldVal){ showToast('Số lượng không đổi'); return; }
  p.quantity = val;
  p.history.push({stage:p.currentStage,label:`Sửa số lượng: ${oldVal} → ${val} thanh`,time:Date.now(),by:currentUser?.name||'?'});
  touchQr(p);
  log('Sửa số lượng QR', `${p.qrCode}: ${oldVal} → ${val} thanh`, p.orderId, null, {qrCode:p.qrCode,oldVal,newVal:val});
  saveQrProducts();
  openQrDetail(id);
  renderQR();
  showToast(`✅ Đã cập nhật số lượng: ${val} thanh`);
}

// ── Xóa mã QR (chỉ Admin) ─────────────────────────────────────────────
function deleteQrProduct(id){if(guardViewer())return;
  if(!isAdmin()){ showToast('❌ Chỉ Admin mới được xóa mã QR', true); return; }
  const p = DB.qrProducts.find(x=>x.id===id); if(!p) return;
  confirm2('Xóa mã QR', `Xác nhận xóa vĩnh viễn mã QR "${p.qrCode}"? Toàn bộ lịch sử, ghi chú và hình ảnh đính kèm của mã này sẽ bị xóa và KHÔNG thể khôi phục.`, ()=>{
    DB.qrProducts = DB.qrProducts.filter(x=>x.id!==id);
    log('Xóa mã QR', p.qrCode, p.orderId, null, {qrCode:p.qrCode});
    saveQrProducts();
    closeModal('cfModal');
    closeModal('qrDetailModal');
    renderQR();
    updateBadges();
    showToast('🗑 Đã xóa mã QR');
  });
}
function deleteQrProductsBulk(ids){if(guardViewer())return;
  if(!isAdmin()){ showToast('❌ Chỉ Admin mới được xóa mã QR', true); return; }
  if(!ids || !ids.length) return;
  confirm2('Xóa nhiều mã QR', `Xác nhận xóa vĩnh viễn ${ids.length} mã QR đã chọn? Hành động này KHÔNG thể khôi phục.`, ()=>{
    const idSet = new Set(ids);
    const removed = DB.qrProducts.filter(x=>idSet.has(x.id));
    DB.qrProducts = DB.qrProducts.filter(x=>!idSet.has(x.id));
    log('Xóa nhiều mã QR', `${removed.length} mã: ${removed.map(p=>p.qrCode).join(', ')}`, null, null, {count:removed.length});
    saveQrProducts();
    closeModal('cfModal');
    renderQR();
    updateBadges();
    showToast(`🗑 Đã xóa ${removed.length} mã QR`);
  });
}
