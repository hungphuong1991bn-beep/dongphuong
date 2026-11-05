// src/modules/orders/orders-shared.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function statusInfo(s){
  if(s==='done') return {label:'✅ Hoàn thành',cls:'b-done',btnCls:'active-done'};
  if(s==='running'||s==='cutting') return {label:'⚙️ Đang sản xuất',cls:'b-run',btnCls:'active-run'};
  return {label:'⏳ Chờ sản xuất',cls:'b-wait',btnCls:'active-wait'};
}

// Lấy chữ cái đại diện cho tên khách hàng để hiển thị lên avatar tròn
// (ví dụ "Công Ty ABC" -> "CT", "Nguyễn Văn A" -> "NV")


function orderSpecGridHTML(o){
  if(o.isCoil){
    const isFi = o.isRound&&o.phi;
    const dimVal = isFi ? `Φ${o.phi}` : `${o.thickness||'?'}×${o.width||'?'}`;
    const dimLbl = isFi ? 'Đường kính' : 'Dày×Rộng (mm)';
    // Khi hiển thị fi (Φ): bỏ ô KG trong lưới vì bên dưới spec-row đã có
    // KG rồi — tránh lặp số kg trên cùng 1 hàng, nhìn rối mắt.
    return `<div class="spec-grid${isFi?' cols-3':''}">
           <div class="spec-box dim-t"><div class="spec-box-val" style="font-size:${isFi?'16px':'14px'}">${dimVal}</div><div class="spec-box-lbl">${dimLbl}</div></div>
           <div class="spec-box dim-l"><div class="spec-box-val">${o.meterPerCoil||'?'}m</div><div class="spec-box-lbl">Mét/cuộn</div></div>
           <div class="spec-box dim-qty"><div class="spec-box-val">${o.qty||0}</div><div class="spec-box-lbl">Số cuộn</div></div>
           ${isFi?'':`<div class="spec-box dim-kg"><div class="spec-box-val" style="font-size:12px">${o.kg||0}</div><div class="spec-box-lbl">KG</div></div>`}
         </div>
         <div class="spec-row">
           <span class="spec-tag mat">NL: <b>${o.material||'—'}</b></span>
           ${o.type?`<span class="spec-tag">${o.type}</span>`:''}
           <span class="spec-tag" style="background:#e0f2fe;color:#075985">📏 Tổng ${o.totalMeters||0}m</span>
           <span class="spec-tag kg">⚖️ KL: <b>${o.kg||0} kg</b></span>
         </div>`;
  }
  if(o.isRound&&o.phi){
    // Ô KG trong lưới đã bỏ (chỉ còn 3 ô: Φ / Dài / Số cây) vì KG đã có
    // sẵn ở spec-row bên dưới — tránh hiển thị trùng số kg trên cùng hàng.
    return `<div class="spec-grid cols-3">
           <div class="spec-box dim-phi"><div class="spec-box-val" style="font-size:17px">Φ${o.phi}</div><div class="spec-box-lbl">Đường kính</div></div>
           <div class="spec-box dim-l"><div class="spec-box-val">${o.length||'?'}mm</div><div class="spec-box-lbl">Dài (mm)</div></div>
           <div class="spec-box dim-qty"><div class="spec-box-val">${o.qty||0}</div><div class="spec-box-lbl">Số cây</div></div>
         </div>
         <div class="spec-row">
           <span class="spec-tag mat">NL: <b>${o.material||'—'}</b></span>
           ${o.type?`<span class="spec-tag">${o.type}</span>`:''}
           <span class="spec-tag kg">⚖️ KL: <b>${o.kg||0} kg</b></span>
         </div>`;
  }
  return `<div class="spec-grid">
           <div class="spec-box dim-t"><div class="spec-box-val">${o.thickness||'?'}</div><div class="spec-box-lbl">Dày (mm)</div></div>
           <div class="spec-box dim-w"><div class="spec-box-val">${o.width||'?'}</div><div class="spec-box-lbl">Rộng (mm)</div></div>
           <div class="spec-box dim-l"><div class="spec-box-val">${o.length||'?'}</div><div class="spec-box-lbl">Dài (mm)</div></div>
           <div class="spec-box dim-qty"><div class="spec-box-val">${o.qty||0}</div><div class="spec-box-lbl">Số thanh</div></div>
         </div>
         <div class="spec-row">
           <span class="spec-tag mat">NL: <b>${o.material||'—'}</b></span>
           ${o.type?`<span class="spec-tag">${o.type}</span>`:''}
           <span class="spec-tag kg">⚖️ KL: <b>${o.kg||0} kg</b></span>
         </div>`;
}

// ── Màu theo ưu tiên ──
function priColor(pri){
  return PRI_COLOR[pri]||'#64748b';
}

// Kế hoạch SX
// Spec string: thanh tròn "Φ6×300mm" hoặc thanh dẹt "12×50×4000mm"
function specStr(o){
  if(o.isCoil){
    return (o.phi && o.isRound) ? `Φ${o.phi}mm` : `${o.thickness||'?'}×${o.width||'?'}mm`;
  }
  if(o.phi && o.isRound){
    return `Φ${o.phi}×${o.length||'?'}mm`;
  }
  return `${o.thickness||'?'}×${o.width||'?'}×${o.length||'?'}mm`;
}
// Label số cây/thanh/cuộn
function qtyLabel(o){
  if(o.isCoil) return `${o.qty||0} cuộn${o.meterPerCoil?` × ${o.meterPerCoil}m`:''}${o.totalMeters?` = ${o.totalMeters}m`:''}`;
  return o.isRound?`${o.qty||0} cây`:`${o.qty||0} thanh`;
}

// Phần trăm tiến độ sản xuất thực tế = doneQty/qty*100 (đơn hoàn thành luôn
// 100%, đơn chưa sản xuất = 0%) — KHÔNG hard-code, dùng đúng dữ liệu hiện có.
function ddProgressPct(o){
  if(o.status==='done') return 100;
  const qty = Number(o.qty)||0, done = Number(o.doneQty)||0;
  if(!qty) return 0;
  return Math.max(0, Math.min(100, Math.round(done/qty*100)));
}
