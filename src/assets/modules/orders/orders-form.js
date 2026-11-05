// src/modules/orders/orders-form.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function openAddOrder(){if(guardViewer()||guardCreateOrder())return; _editOrderId=null; $('orderModalTitle').textContent='Thêm đơn hàng mới'; ['ofCust','ofPO','ofType','ofNote','ofAddr','ofKg','ofPhi'].forEach(id=>$(id).value=''); ['ofThk','ofW','ofQty'].forEach(id=>$(id).value=''); $('ofL').value='4000'; $('ofMat').value='B*'; $('ofPri').value='GẤP 1'; $('ofDate').value=''; $('orderErr').style.display='none'; const lbl=$('kgAutoLabel'); if(lbl) lbl.textContent=''; if($('ofIsCoil')) $('ofIsCoil').checked=false; toggleCoilMode(); openModal('orderModal'); }
// Chốt chặn quyền cuối cùng: chỉ Admin được sửa đơn hàng đã có (khớp đúng
// quyền canEdit=isAdmin() đang dùng để ẩn/hiện nút Sửa ở danh sách) — trước
// đây hàm này chỉ chặn tài khoản Xem (guardViewer), nên nhân viên vẫn sửa
// được nếu bấm trúng nút Sửa ở modal "Xem chi tiết" (nút đó trước đây luôn
// hiện sẵn, không ẩn theo vai trò).
function editOrder(id){
  if(guardViewer())return;
  if(!isAdmin()){ showToast('🔒 Chỉ Quản trị viên (Admin) mới có quyền sửa đơn hàng', true); return; }
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  _editOrderId=id;
  $('orderModalTitle').textContent='Sửa đơn hàng';
  $('ofCust').value=o.customer||''; $('ofPO').value=o.po||''; $('ofType').value=o.type||'';
  $('ofMat').value=o.material||'B*'; $('ofThk').value=o.thickness||''; $('ofW').value=o.width||'';
  $('ofPhi').value=o.phi||'';
  if($('ofIsCoil')) $('ofIsCoil').checked = !!o.isCoil;
  $('ofL').value = o.isCoil ? (o.meterPerCoil||100) : (o.length||4000);
  $('ofQty').value=o.qty||''; $('ofKg').value=o.kg||'';
  toggleCoilMode();
  const lbl=$('kgAutoLabel'); if(lbl) lbl.textContent=o.phi?(o.isCoil?`✓ Dây tròn Φ${o.phi}`:`✓ Thanh tròn Φ${o.phi}`):'';
  $('ofPri').value=o.priority||'GẤP 1'; $('ofDate').value=o.deliveryDate||'';
  $('ofAddr').value=o.address||''; $('ofNote').value=o.note||'';
  $('orderErr').style.display='none';
  openModal('orderModal');
}
// ── PROGRESS (Tiến độ sản xuất) ──────────────────────────────
let _progressOrderId = null;
let _pmMats = [];

function openProgress(id){if(guardViewer())return;
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  _progressOrderId = id;
  _pmMats = o.matCodes ? [...o.matCodes] : [];
  document.getElementById('progressModalTitle').textContent = `Tiến độ: ${o.customer||''}`;
  document.getElementById('pmDoneQty').value = o.doneQty||0;
  document.getElementById('pmQtyHint').textContent = `Tổng đơn: ${o.qty||0} thanh`;
  document.getElementById('pmNote').value = o.progressNote||'';
  document.getElementById('progressErr').style.display='none';
  renderPmMats();
  openModal('progressModal');
}

function renderPmMats(){
  const el = document.getElementById('pmMatList'); if(!el) return;
  el.innerHTML = _pmMats.map((m,i)=>
    `<span class="mat-chip">${m}<button onclick="_pmMats.splice(${i},1);renderPmMats()">×</button></span>`
  ).join('');
}

function pmAddMat(){if(guardViewer())return;
  const inp = document.getElementById('pmMatCode');
  const v = inp.value.trim(); if(!v) return;
  if(!_pmMats.includes(v)) _pmMats.push(v);
  inp.value='';
  renderPmMats();
}

function saveProgress(){if(guardViewer())return;
  const _pid = _progressOrderId;
  if(!_pid) return;
  withPlanLock(_pid, ()=>{
    const doneQty = parseInt(document.getElementById('pmDoneQty').value)||0;
    const note = document.getElementById('pmNote').value.trim();
    // CHỈ CẬP NHẬT đúng đơn hàng hiện có theo id — tuyệt đối không push/tạo
    // bản ghi mới, không đổi id của đơn.
    const o = DB.orders.find(x=>x.id===_pid); if(!o) return;
    if(doneQty > (o.qty||0)){
      const e=document.getElementById('progressErr');
      e.textContent=`Số thanh đã chạy (${doneQty}) không thể lớn hơn tổng đơn (${o.qty||0})`;
      e.style.display='block'; return;
    }
    const old = {doneQty:o.doneQty||0, matCodes:[...(o.matCodes||[])]};
    o.doneQty = doneQty;
    o.matCodes = [..._pmMats];
    o.progressNote = note;
    log('Cập nhật tiến độ',`${o.customer} · ${o.priority||''} · Đã chạy: ${doneQty}/${o.qty||0} thanh`,_pid,{doneQty:old.doneQty,matCodes:old.matCodes,note:o.progressNote},{doneQty,matCodes:[..._pmMats],note});
    closeModal('progressModal');
    renderTab(currentTab);
    refreshKhDetailIfOpen(_pid); // panel chi tiết (nếu đang mở đúng đơn) cập nhật ngay, không cần đóng/mở lại
    goToOrderCard(_pid);
    showToast(`✅ Đã lưu: ${doneQty}/${o.qty||0} thanh`);
    saveOrders(); // ghi Database ngay + đồng bộ Realtime tới tất cả thiết bị
  });
}

// Khối lượng riêng đồng đỏ (Cu) — dùng để tính KG thanh cái dẹt
// D ≈ 8.96 g/cm³. Công thức chuẩn: KG = T(mm) × W(mm) × L(mm) × D / 1.000.000
const CU_DENSITY = 8.96; // g/cm³

// Bật/tắt chế độ "Đơn hàng dạng cuộn": đổi nhãn Dài(mm)→Mét/cuộn, Số thanh→Số cuộn
function toggleCoilMode(){
  const isCoil = $('ofIsCoil').checked;
  $('ofLLabelTxt').textContent = isCoil ? 'Mét / cuộn (m)' : 'Dài (mm)';
  $('ofL').placeholder = isCoil ? 'VD: 100' : '4000';
  $('ofQtyLabelTxt').textContent = isCoil ? 'Số cuộn' : 'Số cây / Số thanh';
  $('ofQty').placeholder = isCoil ? 'VD: 15' : '0';
  const ex = $('ofCoilExample'); if(ex) ex.style.display = isCoil ? 'block' : 'none';
  if(!$('ofL').value) $('ofL').value = isCoil ? '100' : '4000';
  calcKgAuto();
}

// ── BO CẠNH ──────────────────────────────────────────────────
// Nhận diện Loại/Quy cách = "Bo cạnh" (không phân biệt hoa/thường, dấu, khoảng trắng thừa)
function isBoCanhType(val){
  const n = String(val||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/\s+/g,' ').trim();
  return n === 'bo canh' || n.indexOf('bo canh ') === 0;
}
// Hai bên cạnh bo tròn đối xứng: R = T/2 ; A = T×(W−2R) + π×R²  (mm²)
// Trả về null nếu thiếu dữ liệu hoặc W < 2R (hình học không hợp lệ).
function calcBoCanhArea(t, w){
  if(!(t>0) || !(w>0)) return null;
  const r = t/2;
  if(w - 2*r < 0) return null;
  return { r, area: t*(w-2*r) + Math.PI*r*r };
}
// Cập nhật khối hiển thị Bo cạnh (T, W, R, A, KG). calc = kết quả calcBoCanhArea hoặc null
function updateBoCanhPanel(show, t, w, calc, kgText){
  const panel = $('ofBcPanel'); if(!panel) return;
  panel.style.display = show ? 'block' : 'none';
  if(!show){
    ['ofBcT','ofBcW','ofR','ofA'].forEach(id=>{ const e=$(id); if(e) e.value=''; });
    const sm=$('ofBcSummary'); if(sm) sm.textContent='';
    const wn=$('ofBcWarn'); if(wn){ wn.style.display='none'; wn.textContent=''; }
    return;
  }
  $('ofBcT').value = t>0 ? t : '';
  $('ofBcW').value = w>0 ? w : '';
  $('ofR').value = t>0 ? (t/2).toFixed(2) : '';
  $('ofA').value = calc ? calc.area.toFixed(2) : '';
  const wn = $('ofBcWarn');
  if(t>0 && w>0 && !calc){ wn.textContent='⚠ Chiều rộng W phải ≥ độ dày T (W − 2R không được âm)'; wn.style.display='block'; }
  else { wn.textContent=''; wn.style.display='none'; }
  const sm = $('ofBcSummary');
  if(sm) sm.innerHTML = `A = T×(W−2R) + π×R² · KG = A × L × 8.96 / 1.000.000 × SL` + (kgText ? ` · <b>⚖️ ${kgText} kg</b>` : '');
}

// Tự tính KG khi nhập Φ hoặc dày/rộng/dài/qty (và Bo cạnh khi Loại/Quy cách = "Bo cạnh")
function calcKgAuto(){
  const isCoil = $('ofIsCoil') && $('ofIsCoil').checked;
  const phi = parseFloat($('ofPhi').value)||0;
  const lRaw = parseFloat($('ofL').value)||0; // mm bình thường, hoặc mét/cuộn nếu ở chế độ cuộn
  const l = isCoil ? lRaw*1000 : lRaw; // quy đổi mét/cuộn → mm để dùng chung công thức tính khối lượng
  const qty = parseInt($('ofQty').value)||0; // số thanh hoặc số cuộn
  const dT  = parseDimInput($('ofThk').value), dW = parseDimInput($('ofW').value);
  const t   = dT.num;
  const w   = dW.num;
  const lbl = $('kgAutoLabel');
  const coilInfo = $('ofCoilInfo');
  let kg = 0, computed = false;
  // Chế độ Bo cạnh: chỉ áp dụng khi Loại/Quy cách = "Bo cạnh" và KHÔNG nhập Φ (thanh tròn giữ nguyên công thức riêng)
  const boMode = isBoCanhType($('ofType') ? $('ofType').value : '') && !phi;
  const boCalc = boMode ? calcBoCanhArea(t, w) : null;

  if(phi && l && qty){
    // Thanh/dây tròn: KG = Φ² × L × 7 / 1,000,000 × qty
    kg = parseFloat((phi*phi*l*7/1000000*qty).toFixed(3));
    computed = true;
    if(lbl) lbl.textContent = isCoil ? `✓ Tự tính dây tròn Φ${phi}` : `✓ Tự tính thanh tròn Φ${phi}`;
  } else if(boMode){
    // Bo cạnh: R = T/2 ; A = T×(W−2R)+πR² ; KG = A × L × 8.96 / 1.000.000 × qty
    if(boCalc && l && qty){
      kg = parseFloat((boCalc.area*l*CU_DENSITY/1000000*qty).toFixed(3));
      computed = true;
      if(lbl) lbl.textContent = isCoil ? '✓ Tự tính Bo cạnh dạng cuộn (R=T/2, D=8.96)' : '✓ Tự tính Bo cạnh (R=T/2, D=8.96)';
    } else if(lbl) lbl.textContent = '';
  } else if(t && w && l && qty){
    // Thanh/băng dẹt (đồng đỏ): KG = T × W × L × D / 1.000.000 × qty  (D=8.96 g/cm³)
    kg = parseFloat((t*w*l*CU_DENSITY/1000000*qty).toFixed(3));
    computed = true;
    if(lbl) lbl.textContent = isCoil ? '✓ Tự tính băng/dây cuộn (đồng đỏ, D=8.96)' : '✓ Tự tính thanh dẹt (đồng đỏ, D=8.96)';
  } else {
    if(lbl) lbl.textContent = '';
  }
  if(computed) $('ofKg').value = kg;
  if(computed && lbl && (dT.multi||dW.multi)) lbl.textContent += ' · dày/rộng nhiều giá trị → tính theo trung bình';
  updateBoCanhPanel(boMode, t, w, boCalc, computed ? kg : '');

  if(coilInfo){
    if(isCoil && qty && lRaw){
      const totalM = parseFloat((qty*lRaw).toFixed(2));
      coilInfo.style.display = 'block';
      coilInfo.textContent = `📀 ${qty} cuộn × ${lRaw}m/cuộn = ${totalM.toLocaleString('vi-VN')}m tổng${computed?` · ⚖️ ${kg}kg`:''}`;
    } else {
      coilInfo.style.display = 'none';
    }
  }
}
