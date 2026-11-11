// src/modules/planning/planning-machines.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// PHÂN CÔNG MÁY (Kế hoạch SX) + BẢNG ĐIỀU HÀNH SẢN XUẤT
// ────────────────────────────────────────────────────────────
// Nguồn dữ liệu gốc DUY NHẤT là o.machineAssign trong từng đơn hàng
// (DB.orders) — Bảng Điều hành SX chỉ ĐỌC lại từ đây, không lưu máy riêng,
// nên không bao giờ lệch nhau và không tạo dữ liệu trùng trên Firebase.
// ════════════════════════════════════════════════════════════
function orderMachineAssign(o){ return o.machineAssign || {}; }
function machineById(id){ return MACHINES.find(m=>m.id===id); }
function machinesForStage(stageKey){
  const st = ASSIGN_STAGES.find(x=>x.key===stageKey);
  return st ? MACHINES.filter(m=>m.group===st.group) : [];
}

// Công đoạn PHÂN CÔNG MÁY mà 1 đơn đang THỰC SỰ chạy ngay bây giờ — SỬA LỖI:
// trước đây các hàm dưới đây dựa vào o.status (chỉ có pending/running) để
// suy ra "đơn đã tới lượt máy này chưa", nhưng 1 đơn "running" có thể đang
// chạy Đùn dù ĐÃ được gán trước máy Rút/Cắt/Đánh bóng cho công đoạn kế tiếp
// (phân công trước, chưa chạy tới) — khiến máy đó bị hiểu nhầm là "đang
// chạy" đơn này, còn hàng đợi thật (Đùn) thì không thấy nó đâu. Nguồn đáng
// tin cậy DUY NHẤT cho biết "đơn đang ở công đoạn nào" là o.stage (được
// setStage() cập nhật tường minh mỗi khi đơn thực sự chuyển công đoạn) —
// dùng trực tiếp o.stage thay vì suy luận qua machineAssign, để việc GÁN
// TRƯỚC máy cho công đoạn sau (đơn vẫn đang ở công đoạn hiện tại) không bị
// hiểu nhầm là đơn đã chuyển sang công đoạn đó.
function orderActiveAssignStage(o){
  const key = o.stage || 'dun';
  return ASSIGN_STAGES.find(s=>s.key===key) || ASSIGN_STAGES[0];
}

// Đơn hàng khác (không phải excludeOrderId) có đang CHIẾM máy này ở đúng
// công đoạn này không (chỉ tính đơn đang ở trạng thái "Đang sản xuất"). Dùng
// chung dhIsOrderRunningAtStage() để nhất quán tuyệt đối với dhOrderAtMachine
// — 1 đơn được gán trước cho công đoạn CHƯA TỚI (ở sau công đoạn hiện tại
// của chính nó) không tính là "đang chiếm máy thật", chỉ là xếp hàng, nên
// không được coi là xung đột chặn đơn khác.
function machineConflictOrder(machineId, stageKey, excludeOrderId){
  if(!machineId) return null;
  return DB.orders.find(o=>o.id!==excludeOrderId && dhIsOrderRunningAtStage(o, stageKey, machineId)) || null;
}

// Chip gọn hiển thị máy đang gán cho công đoạn HIỆN TẠI của đơn (dùng ở thẻ
// Kế hoạch SX, để không phải mở Panel chi tiết mới biết đơn đang chạy máy nào)
function khMachineChip(o){
  const s = o.status==='cutting'?'running':o.status;
  const assign = orderMachineAssign(o);
  if(s==='pending' && !Object.keys(assign).length) return '';
  // Đơn CHƯA CHẠY nhưng đã được phân công máy trước (o.stage chưa có vì chưa
  // bắt đầu) → coi như đang nhắm tới công đoạn 'dun' đầu tiên, để chip vẫn
  // hiện đúng máy + vị trí hàng đợi ngay trên thẻ, không cần mở panel chi tiết.
  const stageKey = o.stage || (s==='pending' ? 'dun' : '');
  const cur = stageKey ? assign[stageKey] : '';
  if(!cur) return '';
  const m = machineById(cur);
  if(!m) return '';
  if(s==='pending' && machineRuntimeStatus(cur).code==='run'){
    const pos = dhMachineQueue(cur).findIndex(x=>x.id===o.id);
    return `<span class="kh-meta-item info">🏭 ${m.name} · 🕐 xếp hàng${pos>0?' #'+(pos+1):''}</span>`;
  }
  return `<span class="kh-meta-item info">🏭 ${m.name}</span>`;
}

// Khối "Phân công máy" trong Panel chi tiết Kế hoạch SX — 1 dòng / công đoạn,
// mỗi dòng có <select> chọn máy (chỉ Admin/Staff thao tác được) + chấm trạng
// thái máy realtime. Đổi máy tại đây tự đồng bộ ngay sang Bảng Điều hành SX.
function khMachineAssignHTML(o){
  const canAssign = isStaff();
  const rows = ASSIGN_STAGES.map(st=>{
    const opts = machinesForStage(st.key);
    const cur = orderMachineAssign(o)[st.key] || '';
    const optionsHTML = ['<option value="">— Chưa gán —</option>']
      .concat(opts.map(m=>{
        const rs = machineRuntimeStatus(m.id);
        const busyOther = rs.code==='run' && rs.order && rs.order.id!==o.id;
        const q = dhMachineQueue(m.id, o.id).length;
        // Máy đang chạy đơn khác: KHÔNG chặn chọn nữa — cho phép "xếp hàng
        // trước" (xem assignMachine). Chỉ ghi chú rõ để người phân công biết
        // đơn sẽ CHẠY TIẾP THEO chứ không chạy ngay.
        const tag = busyOther
          ? ` — 🟢 đang chạy ${ddCode(rs.order)}${q?`, ${q} chờ`:''} · chọn = xếp hàng tiếp theo`
          : (q ? ` — 🟡 ${q} đơn đang chờ` : '');
        return `<option value="${m.id}" ${cur===m.id?'selected':''}>${m.name}${tag}</option>`;
      })).join('');
    const curMachine = machineById(cur);
    const curStatus = curMachine ? machineRuntimeStatus(cur) : null;
    // Đơn NÀY chưa tới lượt máy này (đang 'pending', HOẶC đang 'running'
    // nhưng công đoạn hiện tại của nó là công đoạn KHÁC — VD đang chạy Đùn,
    // đã gán trước máy Rút cho công đoạn kế tiếp) mà máy được gán đang chạy
    // đơn KHÁC → hiển thị rõ vị trí trong hàng đợi thay vì im lặng hoặc
    // trông như một cảnh báo lỗi.
    let queueNote = '';
    const notYetHere = o.status==='pending' || (o.status==='running' && (()=>{ const as=orderActiveAssignStage(o); return !as || as.key!==st.key; })());
    if(cur && notYetHere && curStatus && curStatus.code==='run' && curStatus.order && curStatus.order.id!==o.id){
      const queue = dhMachineQueue(cur);
      const pos = queue.findIndex(x=>x.id===o.id);
      queueNote = `<div class="kh-machine-queue-note">🕐 Đang xếp hàng chờ <b>${curMachine.name}</b> — sẽ chạy tiếp theo sau đơn <b>${ddCode(curStatus.order)}</b>${pos>0?` (vị trí #${pos+1})`:''}</div>`;
    }
    // Ghi chú trạng thái công đoạn: đã qua (có lịch sử máy) / đang chạy mà chưa gán máy
    let stageNote = '';
    if(o.status==='running'){
      const aIdx = assignStageIndex(orderActiveAssignStage(o).key), sIdx = assignStageIndex(st.key);
      const hist = o.machineHistory && o.machineHistory[st.key];
      if(!cur && sIdx<aIdx){
        const hm = hist && machineById(hist.machineId);
        stageNote = hm
          ? `<div class="kh-machine-stage-note done">✓ Đã qua công đoạn này — đã chạy trên <b>${hm.name}</b>${hist.endAt?` · ${fmtDateTime(hist.endAt)}`:''}</div>`
          : `<div class="kh-machine-stage-note warn">ℹ️ Đã qua công đoạn này nhưng chưa ghi nhận máy nào</div>`;
      } else if(!cur && sIdx===aIdx){
        stageNote = `<div class="kh-machine-stage-note warn">⚠️ Đơn đang ở công đoạn này nhưng CHƯA gán máy</div>`;
      }
    }
    return `<div class="kh-machine-row">
      <div class="kh-machine-lbl">${st.icon} ${st.label}</div>
      <select class="field-inp kh-machine-sel" ${canAssign?'':'disabled'} onchange="assignMachine('${o.id}','${st.key}',this.value)">${optionsHTML}</select>
      ${curStatus?`<span class="kh-machine-dot" title="${curStatus.label}">${curStatus.dot}</span>`:''}
      ${queueNote}
      ${stageNote}
    </div>`;
  }).join('');
  return `<div class="kh-machine-assign" data-dp-nodirty="1">${rows}</div>`;
}
