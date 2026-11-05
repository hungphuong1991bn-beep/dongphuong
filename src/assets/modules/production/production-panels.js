// src/modules/production/production-panels.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Dữ liệu hiển thị cho khối đồng hồ: giờ, ngày, ca và % tiến độ của ca hiện tại
function dhClockParts(now){
  now = now || new Date();
  const h = now.getHours(), m = now.getMinutes(), sec = now.getSeconds();
  let key, name, range, startH;
  if(h>=6 && h<14){ key='1'; name='Ca 1'; range='06:00–14:00'; startH=6; }
  else if(h>=14 && h<22){ key='2'; name='Ca 2'; range='14:00–22:00'; startH=14; }
  else { key='3'; name='Ca 3'; range='22:00–06:00'; startH = h>=22 ? 22 : -2; }
  const elapsed = ((h-startH)*3600 + m*60 + sec);
  const pct = Math.max(0, Math.min(100, Math.round(elapsed/(8*3600)*1000)/10));
  const hh = String(h).padStart(2,'0'), mm = String(m).padStart(2,'0'), ss = String(sec).padStart(2,'0');
  return {
    key, pct,
    timeHTML: `${hh}<b class="dhx-colon">:</b>${mm}<small>:${ss}</small>`,
    dateHTML: `<span class="dhx-wd">${VN_WEEKDAYS[now.getDay()]}</span><span class="dhx-dsep"></span><span class="dhx-dmy">${vnDateDMY(now)}</span>`,
    shiftHTML: `<b>${name}</b><em>${range}</em>`
  };
}
function dhCurrentShift(){
  const h = new Date().getHours();
  if(h>=6 && h<14) return 'Ca 1 · 06:00–14:00';
  if(h>=14 && h<22) return 'Ca 2 · 14:00–22:00';
  return 'Ca 3 · 22:00–06:00';
}

// ── XÁC NHẬN "ĐANG CHẠY THẬT" TẠI 1 MÁY (SỬA LỖI GỐC: "chuyển công đoạn
// xong nhưng đơn chờ tiếp theo không tự chạy") ──
// Trước đây hệ thống suy luận "đơn X đang chạy tại máy M" chỉ bằng:
//   o.status==='running' && o.stage===stageKey && o.machineAssign[stageKey]===M
// Điều này KHÔNG đủ để phân biệt 2 trường hợp khác nhau:
//   1) Đơn THỰC SỰ đang chạy tại M (đã được xác nhận trước đó).
//   2) Đơn VỪA chuyển sang đúng công đoạn của M (setStage) nhưng M đang bận
//      đơn khác — đơn này phải được coi là ĐANG XẾP HÀNG chờ M, không phải
//      "đang chạy". Trước đây setStage() xử lý việc này bằng cách... CHẶN
//      LUÔN cả việc chuyển công đoạn nếu M đang bận — hậu quả: đơn không
//      bao giờ rời khỏi công đoạn cũ, máy cũ (VD Đùn) không bao giờ được
//      nhả, khiến đơn xếp hàng ở máy cũ bị kẹt vĩnh viễn — ĐÂY LÀ NGUYÊN
//      NHÂN GỐC của lỗi "B không chuyển sang RUNNING".
// o.machineActiveAt = { [stageKey]: machineId } là nguồn XÁC NHẬN DUY NHẤT
// cho biết đơn đã thực sự được cấp phép chạy tại đúng máy đó ở đúng công
// đoạn đó — chỉ được set bởi promoteQueuedOrderToRunning()/setStage() (khi
// máy đang trống) — nhờ đó KHÔNG BAO GIỜ có 2 đơn cùng được coi là "đang
// chạy" trên 1 máy, dù cả hai cùng status='running' + cùng stage.
function dhMarkActiveAtMachine(o, stageKey, machineId){
  if(!o.machineActiveAt) o.machineActiveAt = {};
  if(!o.machineActiveStartAt) o.machineActiveStartAt = {};
  // Chỉ ghi THỜI ĐIỂM BẮT ĐẦU CHẠY khi đây là lần xác nhận MỚI cho đúng máy
  // này ở đúng công đoạn này (máy trước đó trống, hoặc đơn vừa chuyển sang
  // máy khác) — gọi lại nhiều lần cho cùng 1 lượt chạy (VD do render lại)
  // sẽ KHÔNG làm mất mốc giờ bắt đầu thật, để "Điều hành SX" luôn hiển thị
  // đúng thời gian máy bắt đầu chạy đơn này.
  if(o.machineActiveAt[stageKey] !== machineId){
    o.machineActiveStartAt[stageKey] = Date.now();
  }
  o.machineActiveAt[stageKey] = machineId;
}


// Công đoạn PHÂN CÔNG MÁY tương ứng với 1 máy vật lý (mỗi máy chỉ thuộc đúng
// 1 nhóm/công đoạn — Máy rút luôn là công đoạn 'rut', v.v).
function assignStageOfMachine(machineId){
  const m = machineById(machineId);
  return m ? ASSIGN_STAGES.find(s=>s.group===m.group) : null;
}

// ── NÂNG CẤP: cho phép 1 đơn "đang chạy song song ở 2 công đoạn liền nhau"
// (VD vừa Rút vừa Đánh bóng) ──
// Trước đây chỉ ĐÚNG công đoạn HIỆN TẠI (o.stage) của đơn mới được coi là
// "đang chạy thật" tại máy tương ứng — công đoạn đã chạy qua (dù máy đó vẫn
// còn giữ đúng đơn, do người dùng chủ động gán/giữ máy để tiếp tục chạy song
// song theo thực tế sản xuất — VD vật liệu vừa rút xong tới đâu đưa qua đánh
// bóng tới đó) bị rơi xuống "Chờ/Đơn chạy tiếp" dù máy KHÔNG hề trống và đơn
// đó vẫn đang thực sự chiếm máy. SỬA: 1 công đoạn (đã qua HOẶC đang là công
// đoạn hiện tại — KHÔNG áp dụng cho công đoạn CHƯA TỚI, tức sau o.stage, vẫn
// giữ nguyên là "Chờ" như cũ) được coi là "đang chạy thật" nếu:
//   - đơn đang o.status==='running'
//   - đúng máy này được gán cho đúng công đoạn này (o.machineAssign[stageKey])
//   - công đoạn này KHÔNG ở sau công đoạn hiện tại của đơn (assignStageIndex)
//   - không có đơn KHÁC đang thực sự chiếm đúng máy này (machineActiveAt xác
//     nhận, hoặc dữ liệu cũ/gán lại chưa có machineActiveAt thì coi là hợp lệ
//     — fallback an toàn, giống cơ chế đã có).
function dhIsOrderRunningAtStage(o, stageKey, machineId){
  if(!machineId || o.status!=='running') return false;
  if(orderMachineAssign(o)[stageKey]!==machineId) return false;
  // Công đoạn CHƯA TỚI (ở sau công đoạn hiện tại) — đơn chưa hề chạy tới đó,
  // dù được gán trước cũng chỉ là "Chờ" (giữ nguyên hành vi cũ, xem case 1).
  if(assignStageIndex(stageKey) > assignStageIndex(o.stage||'dun')) return false;
  if(o.machineActiveAt && Object.prototype.hasOwnProperty.call(o.machineActiveAt, stageKey)){
    return o.machineActiveAt[stageKey]===machineId;
  }
  return true;
}

// Tìm đơn hàng đang thực sự CHẠY tại 1 máy (dựa trên phân công máy + trạng
// thái running) — đây là nguồn suy ra toàn bộ nội dung 1 thẻ máy. Từ nay 1
// đơn có thể được trả về ĐỒNG THỜI ở 2 máy khác nhau (2 công đoạn liền kề
// đang chạy song song) — xem dhIsOrderRunningAtStage().
function dhOrderAtMachine(machineId){
  const myStage = assignStageOfMachine(machineId);
  if(!myStage) return null;
  return DB.orders.find(o=>dhIsOrderRunningAtStage(o, myStage.key, machineId)) || null;
}
function dhStageAtMachine(o, machineId){
  const a = orderMachineAssign(o);
  const entry = Object.entries(a).find(([stage,mid])=>mid===machineId);
  return entry ? entry[0] : null;
}

// ── Thẻ máy hiện đại (thay bảng cũ) — vòng tiến độ + trạng thái phát sáng,
// tự co giãn theo lưới (grid auto-fit) nên nhiều/ít máy vẫn luôn gọn màn hình.
// Thời gian đã chạy kể từ mốc bắt đầu, dạng "đã chạy 1 ngày 2 giờ" / "2 giờ 15 phút" / "35 phút".
function dhRutElapsed(ts){
  const ms = Date.now() - new Date(ts).getTime();
  if(!(ms>0)) return '';
  const m = Math.floor(ms/60000), d = Math.floor(m/1440), h = Math.floor((m%1440)/60), mm = m%60;
  if(d) return `đã chạy ${d} ngày${h?` ${h} giờ`:''}`;
  if(h) return `đã chạy ${h} giờ${mm?` ${mm} phút`:''}`;
  return `đã chạy ${mm} phút`;
}
function dhMachineCard(m){
  const o = dhOrderAtMachine(m.id);
  const rs = machineRuntimeStatus(m.id);
  const statusCls = {run:'st-run',sang:'st-ready',cho:'st-wait',bt:'st-maint',sc:'st-fault'}[rs.code]||'st-ready';
  // Hàng đợi "đơn chạy tiếp" — loại trừ chính đơn đang hiển thị làm đơn hiện
  // tại (trường hợp máy đang 'cho': rs.order chính là item đầu hàng đợi).
  const queue = (rs.queue||[]).filter(q=>!o || q.id!==o.id);
  const queueHTML = dhNextQueueHTML(queue);

  if(!o){
    const emptyMsg = rs.code==='sc' ? '🔴 Đang sự cố'
      : rs.code==='bt' ? '🟣 Đang bảo trì'
      : queue.length ? '🔵 Sẵn sàng — chuẩn bị chạy đơn kế tiếp'
      : '⚪ Chưa có đơn — sẵn sàng nhận lệnh';
    return `<div class="dh-card ${statusCls}">
      <div class="dh-card-hd"><span class="dh-card-ic">${m.icon}</span><span class="dh-card-name">${m.name}</span><span class="dh-status-chip">${rs.label}</span></div>
      <div class="dh-card-body">
        <div class="dh-card-main"><div class="dh-card-empty">${emptyMsg}</div></div>
        ${queue.length ? `<div class="dh-card-empty-queue-hint">🔵 ${queue.length} đơn đang chờ — xem tại "Đơn kế tiếp"</div>` : ''}
      </div>
    </div>`;
  }

  const stageKey = dhStageAtMachine(o, m.id);
  const st = ASSIGN_STAGES.find(x=>x.key===stageKey);
  const pct = khStageProgressPct(o);
  const qty = o.qty||0, done = o.doneQty||0;
  const qtyPct = qty ? Math.min(100,Math.round(done/qty*100)) : 0;
  const overdue = khIsOverdue(o);
  const pc = PRI_COLOR[o.priority]||'#64748b';
  // Thời gian máy này BẮT ĐẦU CHẠY đơn hiện tại — ưu tiên mốc riêng theo
  // từng máy/công đoạn (machineActiveStartAt), nếu đơn cũ chưa có dữ liệu
  // này thì tạm lấy o.startedAt (thời điểm bắt đầu sản xuất chung của đơn)
  // để không hiện trống.
  const runStartAt = (o.machineActiveStartAt && o.machineActiveStartAt[stageKey]) || o.startedAt || null;
  const isRut = stageKey==='rut';
  const qUnit = o.isCoil ? 'cuộn' : (o.isRound ? 'cây' : 'thanh');
  return `<div class="dh-card ${statusCls}${overdue?' dh-card-overdue':''}${isRut?' dh-card-rut':''}" onclick="khViewDetail('${o.id}')">
    <div class="dh-card-hd"><span class="dh-card-ic">${m.icon}</span><span class="dh-card-name">${m.name}</span><span class="dh-status-chip">${rs.label}</span></div>
    <div class="dh-card-body">
      <div class="dh-card-main">
        <!-- Dòng khách hàng: "Tên khách hàng | Nguyên liệu | Loại", ví dụ
             "Á Châu | B* | Bo cạnh" — thêm "Loại" (o.type) vào SAU tên khách
             hàng và nguyên liệu (trước đây chỉ có "Tên khách hàng (Nguyên
             liệu)"), ngăn cách bằng dấu "|" cho dễ đọc, chỉ hiện "| Loại" khi
             đơn CÓ dữ liệu Loại (tránh dư dấu "|" nếu thiếu). LUÔN xuống dòng
             tự nhiên (white-space:normal + break-word ở CSS) — KHÔNG cắt/
             ellipsis dù tên dài, card tự cao lên theo nội dung. -->
        <div class="dh-card-cust"><span class="dh-card-cust-name">${o.customer||'—'} <span class="dh-card-cust-mat">| ${o.material||'—'}${o.type?` | ${o.type}`:''}</span></span>${overdue?'<span class="dh-card-flag">⚠️ TRỄ</span>':''}</div>
        <!-- Hàng "Quy cách | Khối lượng | Ưu tiên | Bắt đầu chạy" — cả 4 đều
             hiển thị ĐẦY ĐỦ, to hơn trước, tự xuống dòng (flex-wrap) khi
             không đủ chỗ ngang, không bao giờ bị cắt chữ hay tràn ra ngoài
             viền thẻ. -->
        <div class="dh-card-spec-row">
          <span class="dh-card-spec">${specStr(o)}</span>
          <span class="dh-card-kg">⚖️ ${fmtNum(o.kg)||0} kg</span>
          <span class="dh-card-pri" style="background:${pc}22;color:${pc};border-color:${pc}77">🚩 ${o.priority||'—'}</span>
          ${(runStartAt && !isRut)?`<span class="dh-card-time">🕐 Chạy từ ${fmtDateTime(runStartAt)}</span>`:''}
        </div>
        ${isRut ? `<!-- Máy RÚT: hàng ngang riêng gồm 2 ô — "Chạy từ" (mốc bắt đầu) và
             "Sản lượng" (đã rút / kế hoạch + còn lại) — đủ chữ, không cắt, tự
             xuống dòng thành 2 hàng khi thẻ quá hẹp. -->
        <div class="dh-rut-strip">
          <div class="dh-rut-cell dh-rut-start">
            <span class="dh-rut-lbl">🕐 CHẠY TỪ</span>
            <b class="dh-rut-val">${runStartAt?fmtDateTime(runStartAt):'—'}</b>
            ${runStartAt?`<span class="dh-rut-sub">${dhRutElapsed(runStartAt)}</span>`:''}
          </div>
          <div class="dh-rut-cell dh-rut-out">
            <span class="dh-rut-lbl">📦 SẢN LƯỢNG</span>
            <b class="dh-rut-val">${done.toLocaleString('vi-VN')}<i> / ${qty.toLocaleString('vi-VN')} ${qUnit}</i></b>
            <span class="dh-rut-sub">còn ${Math.max(0,qty-done).toLocaleString('vi-VN')}${o.deliveryDate?` · giao ${dhFmtDate(o.deliveryDate)}`:''}${overdue?' · TRỄ':''}</span>
          </div>
        </div>` : ''}
        ${isRut ? '' : `<div class="dh-card-ring-row">
          <div class="dh-ring" style="--p:${pct}"><span>${pct}%</span></div>
          <div class="dh-card-qty">
            <div class="dh-prog-wrap"><div class="dh-prog-bar" style="width:${qtyPct}%"></div></div>
            <span>${done.toLocaleString('vi-VN')}/${qty.toLocaleString('vi-VN')||0} thanh · còn ${Math.max(0,qty-done).toLocaleString('vi-VN')}${o.deliveryDate?` · giao ${dhFmtDate(o.deliveryDate)}`:''}${overdue?' · TRỄ':''}</span>
          </div>
        </div>`}
      </div>
    </div>
  </div>`;
}

// ── Khối "ĐƠN CHẠY TIẾP" trên thẻ máy — hiển thị các đơn CHƯA CHẠY kế tiếp
// đã được phân công sẵn cho máy này (đã sắp xếp theo mức ưu tiên/ngày tạo ở
// dhMachineQueue), ĐẦY ĐỦ mọi field bắt buộc: STT, Khách hàng, Quy cách, Số
// lượng. Bấm vào 1 dòng sẽ mở thẳng Panel chi tiết đơn đó, không làm nổ bong
// bóng click ra ngoài thẻ (stopPropagation) để không trùng với onclick mở
// đơn đang chạy.
//
// Hiển thị tối đa NEXT_QUEUE_MAX_SHOW đơn dạng danh sách gọn (không hard-code
// theo từng loại màn hình) — mỗi dòng co giãn TỈ LỆ với các dòng còn lại
// (giống cơ chế thẻ máy: flex-grow/shrink + min-height:0 + overflow:hidden
// riêng từng dòng) để luôn vừa khít cột "ĐƠN CHẠY TIẾP" ở mọi độ phân giải,
// không cuộn. dhFitNextQueues() vẫn chạy sau mỗi lần render như một lưới an
// toàn bổ sung (giảm spacing/font 1-2 nấc nếu vẫn còn tràn), KHÔNG xoá bớt
// đơn khỏi DOM — số đơn hiển thị luôn đúng như đã render, phần dư nằm gọn ở
// dòng "+N đơn khác" nên không bao giờ mất thông tin.
// ── Ước tính "GIỜ sản xuất dự kiến" cho 1 đơn CHƯA CHẠY — chỉ hiển thị khi dữ
// liệu hiện có cho phép suy ra (không bịa số): ưu tiên field ước tính có sẵn
// trên đơn hàng (o.estHours/o.prodHours/o.estimateHours — tuỳ dữ liệu nhập
// tay), nếu không có field nào thì trả về null để cột "GIỜ" hiện "—" thay vì
// một con số không có căn cứ.


// ── Nhãn ngắn cho cột TRẠNG THÁI của "ĐƠN CHẠY TIẾP" trong bảng compact.
// ── Khối "ĐƠN CHẠY TIẾP" — hiển thị NHIỀU đơn kế tiếp cùng lúc (không chỉ 1
// đơn), mỗi đơn xếp DỌC từng thông tin (không còn bảng ngang nhiều cột dễ
// rối mắt, không còn số thứ tự), đúng mẫu:
//   Á Châu
//   10×20×4000
//   SL: 50
//
//   Vietstar
//   8×50×4000
//   SL: 1.800
// Giới hạn NEXT_QUEUE_MAX_SHOW đơn hiển thị trực tiếp (đủ để đọc rõ từ xa mà
// không phải chia nhỏ chữ tới mức khó đọc); phần dư ra (nếu có) vẫn được
// cộng dồn hiển thị ở dòng "+N đơn khác trong hàng đợi" — do đó KHÔNG BAO GIỜ
// mất thông tin, tổng số luôn đúng. Mỗi dòng co giãn TỈ LỆ với nhau (giống cơ
// chế của thẻ máy) để cùng vừa khít chiều cao cột phải; tên khách hàng/quy
// cách được phép xuống dòng khi dài thay vì bị cắt bằng "...".
var NEXT_QUEUE_MAX_SHOW = 6;
function dhNextQueueHTML(queue){
  if(!queue || !queue.length) return '';
  const shown = queue.slice(0, NEXT_QUEUE_MAX_SHOW);
  const rest = queue.length - shown.length;
  const rowsHTML = shown.map((q,i)=>{
    const qty = q.qty||0;
    // Đồng bộ format với thẻ đơn đang chạy: "Tên khách hàng | Nguyên liệu |
    // Loại" (xem giải thích chi tiết ở dhMachineCard()).
    return `<div class="dh-next-row" onclick="event.stopPropagation();khViewDetail('${q.id}')">
      <span class="dh-next-row-cust">${q.customer||'—'} <span class="dh-next-row-mat">| ${q.material||'—'}${q.type?` | ${q.type}`:''}</span></span>
      <span class="dh-next-row-spec">${specStr(q)}</span>
      <span class="dh-next-row-qty"><b>SL:</b> ${qty.toLocaleString('vi-VN')}</span>
    </div>`;
  }).join('');
  return `<div class="dh-card-next" data-queue-total="${queue.length}" data-rest="${rest}">
    <div class="dh-next-hd">⏭️ ĐƠN CHẠY TIẾP <b>· ${queue.length} đang chờ</b></div>
    <div class="dh-next-list">${rowsHTML}</div>
    <div class="dh-next-more"${rest>0?'':' style="display:none"'}>${rest>0?`+${rest} đơn khác trong hàng đợi`:''}</div>
  </div>`;
}

// ── Lưới AN TOÀN CUỐI CÙNG chống mất/cắt "ĐƠN CHẠY TIẾP": mỗi dòng trong
// .dh-next-list đã tự co giãn tỉ lệ + cho phép xuống dòng khi khách
// hàng/quy cách dài (không còn ellipsis cắt chữ). dhFitNextQueues() bên
// dưới lo phần còn lại theo đúng thứ tự ưu tiên (mục 4 của spec): PADDING/
// GAP trước → font "nặng" nhất (KPI/biểu đồ) → font khu máy (khách hàng/
// quy cách/tiến độ) → CUỐI CÙNG mới đo THẬT chiều cao từng cột "ĐƠN CHẠY
// TIẾP" và tự BỚT DÒNG (không cắt giữa dòng — dòng bị bớt được cộng dồn
// đúng vào "+N đơn khác" nên không mất thông tin, chỉ gọn lại theo đúng chỗ
// trống thật). fitToScreenProductionDashboard() = tên gọi chung của toàn bộ
// cơ chế này (áp dụng cho MỌI card/bảng trong tab, không riêng khu máy).
function dhFitNextQueues(){
  if(!dhTvMode) return;
  const wrap = document.getElementById('dhWrap');
  if(!wrap) return;
  // Luôn reset về trạng thái đầy đủ trước khi đo lại, tránh cộng dồn qua
  // nhiều lần resize liên tiếp (VD: TV phóng to lại sau khi đã thu nhỏ).
  wrap.classList.remove('dh-tv-compact','dh-tv-compact-2','dh-tv-compact-3');
  wrap.querySelectorAll('.dh-card-next').forEach(el=>{
    el.querySelectorAll('.dh-next-row').forEach(r=>{ r.style.display=''; });
    const rest = parseInt(el.dataset.rest||'0',10);
    const moreEl = el.querySelector('.dh-next-more');
    if(moreEl){
      moreEl.textContent = rest>0 ? `+${rest} đơn khác trong hàng đợi` : '';
      moreEl.style.display = rest>0 ? '' : 'none';
    }
  });
  // dh3Wrap (bố cục v3 hiện tại) tự có overflow-y:auto riêng nên PHẦN TRÀN
  // bị "nuốt" âm thầm vào thanh cuộn nội bộ của chính nó — nếu chỉ đo
  // wrap (#dhWrap) như trước, wrap sẽ KHÔNG BAO GIỜ báo tràn và các nấc
  // thu gọn (dh-tv-compact/-2/-3) sẽ không bao giờ được kích hoạt. Đo
  // thêm cả dh3Wrap để phát hiện đúng tình trạng tràn thật.
  const dh3Wrap = wrap.querySelector('.dh3-wrap');
  const isOverflowing = ()=> wrap.scrollHeight > wrap.clientHeight + 1 || wrap.scrollWidth > wrap.clientWidth + 1 || (dh3Wrap && (dh3Wrap.scrollHeight > dh3Wrap.clientHeight + 1 || dh3Wrap.scrollWidth > dh3Wrap.clientWidth + 1));
  // Bước 1: chỉ padding/gap/spacing — chưa đụng chữ.
  if(isOverflowing()){
    wrap.classList.add('dh-tv-compact');
    // Bước 2: thêm 1 nấc nhỏ font KPI/biểu đồ (vẫn có sàn min qua clamp()).
    if(isOverflowing()){
      wrap.classList.add('dh-tv-compact-2');
      // Bước 3: thêm 1 nấc nhỏ font khu máy (khách hàng/quy cách/trạng
      // thái/tiến độ) — vẫn có sàn min, chỉ áp dụng khi 2 bước trên chưa đủ.
      if(isOverflowing()) wrap.classList.add('dh-tv-compact-3');
    }
  }
  // Bước 4 — LƯỚI AN TOÀN RIÊNG cho từng cột "ĐƠN CHẠY TIẾP": dù cả khung
  // đã vừa, 1 vài card cụ thể (máy có nhiều đơn chờ + tên khách hàng dài)
  // vẫn có thể khiến DANH SÁCH ĐƠN của RIÊNG card đó tràn khỏi phần cột
  // được chia. Đo THẬT scrollHeight/clientHeight của từng danh sách và bớt
  // dần đúng dòng CUỐI của ĐÚNG card đó cho tới khi vừa khít — không cắt
  // giữa dòng, luôn cộng dồn số dòng bị bớt vào "+N đơn khác" của card đó.
  wrap.querySelectorAll('.dh-card-next').forEach(el=>{
    const list = el.querySelector('.dh-next-list');
    const moreEl = el.querySelector('.dh-next-more');
    if(!list || !moreEl) return;
    const rows = Array.from(list.querySelectorAll('.dh-next-row'));
    let hidden = 0;
    // Luôn giữ ít nhất 1 dòng (nếu có đơn) — không bao giờ ẩn hết sạch.
    while(rows.length - hidden > 1 && list.scrollHeight > list.clientHeight + 1){
      rows[rows.length - 1 - hidden].style.display = 'none';
      hidden++;
    }
    if(hidden>0){
      const rest = parseInt(el.dataset.rest||'0',10) + hidden;
      moreEl.textContent = `+${rest} đơn khác trong hàng đợi`;
      moreEl.style.display = '';
    }
  });
  // Nếu sau tất cả các bước trên vẫn còn tràn (trường hợp cực đoan), các
  // overflow:hidden sẵn có ở .dh-card/.dh2-side-list/.dh2-content... đóng
  // vai trò lưới an toàn cuối cùng chống vỡ layout — không cuộn trang.
}

// Debounce đo lại khi đổi kích thước/độ phân giải màn hình TV (đổi nguồn
// HDMI, kéo cửa sổ qua màn khác, xoay màn...) — chỉ chạy khi đang ở đúng tab
// Điều hành SX + TV Mode để không tốn tài nguyên lúc ở tab khác.
let _dhFitNextTimer = null;
function dhScheduleFitNextQueues(){
  if(currentTab!=='dieuHanh') return;
  clearTimeout(_dhFitNextTimer);
  _dhFitNextTimer = setTimeout(()=>requestAnimationFrame(dhFitNextQueues), 120);
}

// ── Đếm trạng thái toàn bộ máy trong xưởng (5 nhóm) — dùng cho khối
// "TRẠNG THÁI TOÀN NHÀ MÁY" ở đầu Bảng điều hành SX.
function dhMachineStatusCounts(){
  const c = {run:0,cho:0,dung:0,sc:0,bt:0};
  MACHINES.forEach(m=>{
    const code = machineRuntimeStatus(m.id).code;
    if(code==='run') c.run++;
    else if(code==='cho') c.cho++;
    else if(code==='sc') c.sc++;
    else if(code==='bt') c.bt++;
    else c.dung++; // 'sang' (sẵn sàng/không có việc) = máy đang dừng
  });
  return c;
}

// ── Đếm trạng thái đơn hàng đang quản lý (loại trừ đã hoàn thành) — dùng
// cho khối "ĐƠN HÀNG" cùng widget trên. "Chờ" = đã gán máy nhưng chưa chạy;
// "Chưa chạy" = chưa được phân công máy nào (khác nhau để điều hành biết
// đơn nào cần gán máy gấp).
function dhOrderStatusCounts(){
  const activeOrders = DB.orders.filter(o=>o.status!=='done');
  const running = activeOrders.filter(o=>o.status==='running'||o.status==='cutting').length;
  const tre = activeOrders.filter(khIsOverdue).length;
  const pendingOrders = activeOrders.filter(o=>o.status==='pending');
  const cho = pendingOrders.filter(o=>Object.keys(orderMachineAssign(o)).length>0).length;
  const chuaChay = pendingOrders.filter(o=>!Object.keys(orderMachineAssign(o)).length).length;
  return {running,cho,tre,chuaChay};
}

// ── Thời điểm bắt đầu ca hiện tại (xử lý cả ca 3 vắt qua nửa đêm) — dùng
// để tính "Thời gian chạy" = thời gian đã trôi qua từ đầu ca tới giờ.
function dhShiftStartDate(){
  const now = new Date();
  const h = now.getHours();
  const d = new Date(now);
  if(h>=6 && h<14) d.setHours(6,0,0,0);
  else if(h>=14 && h<22) d.setHours(14,0,0,0);
  else { if(h<6) d.setDate(d.getDate()-1); d.setHours(22,0,0,0); }
  return d;
}
function dhRuntimeElapsedStr(){
  let diff = Math.floor((Date.now()-dhShiftStartDate().getTime())/1000);
  if(diff<0) diff = 0;
  const hh=Math.floor(diff/3600), mm=Math.floor((diff%3600)/60), ss=diff%60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}
// Giờ kết thúc ca hiện tại (bắt đầu ca + 8 tiếng) — dùng để tính "Thời gian còn lại ca".
function dhShiftEndDate(){
  return new Date(dhShiftStartDate().getTime() + 8*3600*1000);
}
function dhRuntimeRemainStr(){
  let diff = Math.floor((dhShiftEndDate().getTime()-Date.now())/1000);
  if(diff<0) diff = 0;
  const hh=Math.floor(diff/3600), mm=Math.floor((diff%3600)/60), ss=diff%60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

// ── Lấy sẵn logo công ty từ topbar chung của app để hiển thị trong ô
// "NHÀ MÁY" của Bảng điều hành SX, tránh nhúng lại base64 trùng lặp.
function dhLogoSrc(){
  if(!window._dhLogoSrc){
    const img = document.querySelector('.topbar-logo');
    window._dhLogoSrc = img ? img.src : '';
  }
  return window._dhLogoSrc;
}

// ── Donut nhiều màu thuần CSS (conic-gradient) dùng chung cho các khối KPI
// "NHÀ MÁY"/"ĐƠN HÀNG" — segments:[{value,color}], không cần canvas/SVG nên
// luôn sắc nét ở mọi độ phân giải TV, không tốn thêm request nào.
function dhDonutHTML(segments, centerVal, centerLbl){
  const total = segments.reduce((s,x)=>s+(x.value||0),0);
  let acc = 0;
  const stops = segments.filter(s=>s.value>0).map(s=>{
    const start = total ? (acc/total*100) : 0;
    acc += s.value;
    const end = total ? (acc/total*100) : 0;
    return `${s.color} ${start}% ${end}%`;
  });
  const bg = stops.length ? `conic-gradient(${stops.join(',')})` : 'rgba(255,255,255,.12)';
  return `<div class="dh2-donut" style="background:${bg}"><div class="dh2-donut-hole"><b>${centerVal}</b><span>${centerLbl}</span></div></div>`;
}

// ── Danh sách CẢNH BÁO thực tế của nhà máy — hoàn toàn suy ra từ dữ liệu hiện
// có (không hard-code): đơn hàng trễ hạn, máy đang sự cố, máy đang bảo trì.
function dhAlertsList(){
  const alerts = [];
  const overdue = dhOverdueOrdersList();
  if(overdue.length){
    alerts.push({level:'danger', icon:'⚠️', text:`${overdue.length} đơn hàng trễ hạn`, onclick:"goToKeHoachFilter('overdue')"});
  }
  MACHINES.forEach(m=>{
    const st = machineStatus(m.id);
    if(st==='hong'){
      alerts.push({level:'danger', icon:'⚠️', text:`Sự cố: ${m.name}`, onclick:`goTab('baoTriMay')`});
    } else if(st==='baotri'){
      alerts.push({level:'warn', icon:'⚠️', text:`Bảo trì: ${m.name}`, onclick:`goTab('baoTriMay')`});
    }
  });
  const chuaChay = DB.orders.filter(o=>o.status==='pending' && !Object.keys(orderMachineAssign(o)).length).length;
  if(chuaChay>0){
    alerts.push({level:'warn', icon:'⚠️', text:`${chuaChay} đơn chưa được phân công máy`, onclick:"goToKeHoachFilter('pending')"});
  }
  return alerts;
}

// ── Đơn hàng TRỄ HẠN, sắp xếp trễ nhiều nhất lên đầu — dùng cho Cảnh báo +
// panel "ĐƠN HÀNG TRỄ HẠN" bên sidebar.
function dhOverdueOrdersList(limit){
  const today0 = new Date(new Date().toDateString());
  const list = DB.orders.filter(khIsOverdue).map(o=>({
    o, days: Math.max(1, Math.round((today0 - new Date(o.deliveryDate))/86400000))
  })).sort((a,b)=>b.days-a.days);
  return typeof limit==='number' ? list.slice(0,limit) : list;
}

// ── Đơn hàng SẮP GIAO (chưa trễ, có hạn giao), hạn gần nhất lên đầu — dùng
// cho panel "ĐƠN HÀNG SẮP GIAO" bên sidebar.


// ── Đơn HOÀN THÀNH, mới hoàn thành gần nhất lên đầu — dùng cho panel
// "ĐƠN HOÀN THÀNH" bên sidebar TV Mode. Lấy REALTIME trực tiếp từ đúng nguồn
// dữ liệu tab "Đơn hoàn thành" (DB.orders status==='done'), KHÔNG hard-code,
// nên hễ 1 đơn được xác nhận hoàn thành ở bất kỳ đâu trong hệ thống là panel
// này tự cập nhật theo (cùng nguồn dữ liệu, không lưu bản sao riêng).
function dhCompletedOrdersList(limit){
  const list = DB.orders.filter(o=>o.status==='done')
    .sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
  return typeof limit==='number' ? list.slice(0,limit) : list;
}

// ── Hiệu suất hôm nay: sản lượng kế hoạch/thực tế của các đơn ĐANG CHẠY +
// chi tiết KẾ HOẠCH/THỰC TẾ/ĐẠT %/HIỆU SUẤT theo từng công đoạn (Đùn/Rút/
// Đánh bóng/Cắt) — toàn bộ suy ra trực tiếp từ DB.orders hiện tại, không lưu
// số liệu riêng nào khác (không hard-code).
function dhPerformanceData(){
  const running = DB.orders.filter(o=>o.status==='running'||o.status==='cutting');
  const planned = running.reduce((s,o)=>s+(o.qty||0),0);
  const actual  = running.reduce((s,o)=>s+(o.doneQty||0),0);
  const pct = planned ? Math.round(actual/planned*1000)/10 : 0;
  const stages = ASSIGN_STAGES.map(st=>{
    const list = running.filter(o=>(o.stage||'dun')===st.key);
    const stPlanned = list.reduce((s,o)=>s+(o.qty||0),0);
    const stActual  = list.reduce((s,o)=>s+(o.doneQty||0),0);
    const stPct = stPlanned ? Math.round(stActual/stPlanned*1000)/10 : 0;
    return {label:st.label, icon:st.icon, planned:stPlanned, actual:stActual, pct:stPct};
  });
  // Hiệu suất OEE tổng: trung bình % đạt của các công đoạn ĐANG có đơn chạy
  // (bỏ qua công đoạn rỗng để không kéo số liệu xuống sai lệch).
  const activeStages = stages.filter(s=>s.planned>0);
  const oee = activeStages.length ? Math.round(activeStages.reduce((s,x)=>s+x.pct,0)/activeStages.length*10)/10 : 0;
  return {planned, actual, pct, oee, stages};
}

// ── Header trên cùng (v3) — logo/tên công ty · tiêu đề trung tâm · ngày ·
// đồng hồ · nút Đồng bộ · chuông thông báo · tài khoản · TV Mode. Toàn bộ số
// liệu (đếm thông báo...) đọc trực tiếp từ dữ liệu hiện có, không hard-code.
function dhTopbarV3HTML(){
  const alerts = dhAlertsList();
  const notifCount = alerts.length + (typeof actLog!=='undefined' ? Math.min(actLog.length,9) : 0);
  const roleTxt = (typeof roleLabel==='function' && currentUser) ? roleLabel(currentUser.role) : '';
  const nameTxt = (currentUser && currentUser.name) ? currentUser.name : '—';
  const initials = (typeof userInitials==='function') ? userInitials(nameTxt) : (nameTxt[0]||'?').toUpperCase();
  const avatarHTML = (currentUser && currentUser.avatar) ? `<img src="${currentUser.avatar}" alt="avatar">` : initials;
  const now = new Date();
  const dateStr = `${VN_WEEKDAYS[now.getDay()]} • ${vnDateDMY(now)}`;
  return `
    <div class="dh-company-bar dh2-topbar">
      <div class="dh2-tb-left">
        <img class="dh-company-logo" src="${dhLogoSrc()}" alt="Logo Đông Phương">
        <div class="dh-company-info">
          <div class="dh-company-name">Công ty Cổ phần Công thương Đông Phương</div>
          <div class="dh-company-sub">🏭 Hệ thống quản lý sản xuất</div>
        </div>
      </div>
      <div class="dh2-tb-center">ĐIỀU HÀNH SẢN XUẤT</div>
      <div class="dh2-tb-right">
        <div class="dh3-tb-datebox dhx-clock" id="dhClockBox" data-shift="${dhClockParts(now).key}">
          <div class="dhx-time" id="dhClockTime">${dhClockParts(now).timeHTML}</div>
          <div class="dhx-vline"></div>
          <div class="dhx-info">
            <div class="dhx-date" id="dhClockDate">${dhClockParts(now).dateHTML}</div>
            <div class="dhx-shiftrow"><i class="dhx-dot"></i><span id="dhShift" class="dhx-shift">${dhClockParts(now).shiftHTML}</span></div>
            <div class="dhx-prog" title="Tiến độ ca hiện tại"><i id="dhShiftBar" style="width:${dhClockParts(now).pct}%"></i></div>
          </div>
        </div>
        <button class="dh3-tb-sync-btn" onclick="renderDieuHanh();showToast&&showToast('Đã đồng bộ dữ liệu mới nhất')">🔄 Đồng bộ</button>
        <button class="dh3-tb-bell" onclick="goTab('nhatKy')" title="Thông báo">🔔${notifCount>0?`<span class="dh3-tb-bell-badge">${notifCount>9?'9+':notifCount}</span>`:''}</button>
        <div class="dh3-tb-account" onclick="goTab('settings')">
          <div class="dh3-tb-account-av">${avatarHTML}</div>
          <div>
            <div class="dh3-tb-account-name">${(nameTxt||'').replace(/</g,'&lt;')}</div>
            <div class="dh3-tb-account-role">${roleTxt}</div>
          </div>
        </div>
        <button class="dh-tv-btn" onclick="dhToggleTv()">${dhTvMode?'🡼 Thoát TV':'⛶ TV MODE'}</button>
      </div>
    </div>`;
}

// ── Hàng 6 thẻ KPI tổng quan (Tổng đơn hàng/Đang SX/Hoàn thành/Sản lượng/
// Hiệu suất/Trễ hạn) — số liệu suy trực tiếp từ DB.orders, không hard-code.
function dhTopKpisV3HTML(){
  const orders = DB.orders;
  const total = orders.length;
  const running = orders.filter(o=>o.status==='running'||o.status==='cutting').length;
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const yesterday0 = today0.getTime()-86400000;
  const doneArr = orders.filter(o=>o.status==='done');
  const doneToday = doneArr.filter(o=>(o.doneAt||0)>=today0.getTime()).length;
  const doneYesterday = doneArr.filter(o=>(o.doneAt||0)>=yesterday0 && (o.doneAt||0)<today0.getTime()).length;
  const doneDelta = doneYesterday ? Math.round((doneToday-doneYesterday)/doneYesterday*100) : (doneToday>0?100:0);
  const totalKg = orders.reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
  const runningKg = orders.filter(o=>o.status==='running'||o.status==='cutting').reduce((s,o)=>s+(parseFloat(o.kg)||0),0);
  const overdue = dhOverdueOrdersList().length;
  const perf = dhPerformanceData();

  const mCnt={run:0,cho:0,sc:0,bt:0,sang:0};
  MACHINES.forEach(m=>{ const c=machineRuntimeStatus(m.id).code; mCnt[c]=(mCnt[c]||0)+1; });
  const remain=Math.max(0,perf.planned-perf.actual);
  const fmt=n=>(n||0).toLocaleString('vi-VN');
  const cards = [
    {ic:'📋',col:'#5d9cff',lbl:'Kế hoạch SX',val:fmt(perf.planned)+' <small>thanh</small>',delta:'tổng đơn đang chạy',cls:'flat',click:"goToKeHoachFilter('running')"},
    {ic:'✅',col:'#4ade80',lbl:'Đã sản xuất',val:fmt(perf.actual)+' <small>thanh</small>',delta:perf.pct+'% kế hoạch',cls:'up',click:"goToKeHoachFilter('running')"},
    {ic:'⏳',col:'#fbbf24',lbl:'Còn lại',val:fmt(remain)+' <small>thanh</small>',delta:(perf.planned?Math.round(remain/perf.planned*1000)/10:0)+'% kế hoạch',cls:'flat',click:"goToKeHoachFilter('running')"},
    {ic:'📈',col:'#22d3ee',lbl:'Tiến độ',val:perf.pct+'%',delta:'đã SX / kế hoạch',cls:'up',click:"goTab('baoCao')"},
    {ic:'🏭',col:'#4ade80',lbl:'Máy đang chạy',val:mCnt.run+'<small>/'+MACHINES.length+'</small>',delta:mCnt.cho+' chờ · '+mCnt.sang+' rảnh',cls:'flat',click:"goTab('baoTriMay')"},
    {ic:'🛑',col:'#ff5c5c',lbl:'Máy dừng',val:String(mCnt.sc),delta:mCnt.bt+' đang bảo trì',cls:mCnt.sc>0?'warn':'flat',click:"goTab('baoTriMay')"},
    {ic:'🧾',col:'#a78bfa',lbl:'Đơn đang SX',val:String(running),delta:total?Math.round(running/total*100)+'% tổng đơn':'',cls:'flat',click:"goToKeHoachFilter('running')"},
    {ic:'⚠️',col:'#ff5c5c',lbl:'Đơn trễ',val:String(overdue),delta:overdue>0?'quá hạn giao':'không trễ',cls:overdue>0?'warn':'flat',click:"goToKeHoachFilter('overdue')"}
  ];
  return `<div class="dh3-kpi-row dh4-kpi8">${cards.map(c=>`
    <div class="dh3-kpi-card" style="--kc:${c.col}" onclick="${c.click}">
      <div class="dh3-kpi-top"><div class="dh3-kpi-ic" style="color:${c.col}">${c.ic}</div><div class="dh3-kpi-lbl">${c.lbl}</div></div>
      <div class="dh3-kpi-val">${c.val}</div>
      <div class="dh3-kpi-delta ${c.cls}">${c.delta}</div>
    </div>`).join('')}</div>`;
}

// ── Cột "ĐƠN TRỄ HẠN" đứng cạnh 4 nhóm máy (chỉ Khách hàng/Quy cách/Số ngày
// trễ — KHÔNG hiển thị mã đơn hàng theo yêu cầu).
function dhOverdueColV3HTML(){
  const list = dhOverdueOrdersList(7);
  const all = dhOverdueOrdersList().length;
  const rows = list.length ? list.map(({o,days})=>`
    <div class="dh3-overdue-row" onclick="khViewDetail('${o.id}')">
      <span class="dh3-overdue-cust">${(o.customer||'—').replace(/</g,'&lt;')}</span>
      <span class="dh3-overdue-spec">${specStr(o)}</span>
      <span class="dh3-overdue-days">${days}</span>
    </div>`).join('') : `<div class="dh3-overdue-empty">✅ Không có đơn hàng trễ hạn</div>`;
  return `
    <div class="dh3-overdue-col">
      <div class="dh3-overdue-hd">🔴 ĐƠN TRỄ HẠN (${all})</div>
      <div class="dh3-overdue-table">
        <div class="dh3-overdue-cols"><span>Khách hàng</span><span>Quy cách</span><span>Trễ (ngày)</span></div>
        <div class="dh3-overdue-list">${rows}</div>
      </div>
      ${all>list.length ? `<div class="dh3-overdue-more" onclick="goToKeHoachFilter('overdue')">Xem tất cả (${all}) →</div>` : ''}
    </div>`;
}

// ── Khối "LỊCH LÀM VIỆC" — nay đặt Ở VỊ TRÍ cột thứ 3 hàng dưới (thay cho
// khối "THÔNG BÁO" cũ). Lấy TRỰC TIẾP từ DB.lichLamViec (CÙNG NGUỒN với tab
// Lịch làm việc — dùng chung llvGroupRows/llvActiveLeave/LLV_SHIFT_META với
// tab đó) nên luôn đồng bộ 100% với dữ liệu đã cập nhật, không lưu số liệu
// riêng nào khác:
//   • Cột STT đánh số riêng theo TỪNG NHÓM CA (giống đúng cách đánh số ở
//     bảng chính tab Lịch làm việc), không đánh số dồn toàn bộ danh sách.
//   • Mỗi NHÓM CA (Ca 1/Ca 2/Ca 3/HC/Tăng ca/Nghỉ/Chưa phân ca) có 1 khung
//     riêng, đầu khung là thanh tiêu đề màu theo đúng LLV_SHIFT_META — tách
//     bạch rõ ràng, không còn trộn lẫn các ca vào 1 danh sách phẳng.
//   • Hiển thị "📅 Thời gian áp dụng" (sheet.period) ngay dưới tên bộ phận —
//     đúng chuỗi ngày (VD "07/07 đến hết ngày 12/07/2026") người dùng đã
//     nhập ở tab Lịch làm việc, KHÔNG tự suy diễn/định dạng lại ngày.
//   • Hiển thị ĐẦY ĐỦ toàn bộ nhân viên mọi bộ phận/ca — không cắt bớt,
//     CUỘN TỰ ĐỘNG (xem DH_AUTOSCROLL_BOXES) khi danh sách tràn khung.
function dhSchedulePanelV3HTML(){
  const sheets = (DB.lichLamViec||[]).filter(s=>(s.rows||[]).length);
  const multiDept = sheets.length > 1;
  let totalCount = 0, totalLeave = 0;
  // ── "📅 Thời gian áp dụng" (sheet.period) giờ ĐÓNG BĂNG — tách khỏi khung
  // cuộn (dhScheduleScrollBox), đặt CỐ ĐỊNH ngay dưới tiêu đề panel, KHÔNG
  // bị cuốn trôi mất khi danh sách nhân viên tự cuộn. Nếu nhiều bộ phận có
  // period khác nhau, liệt kê từng dòng kèm tên bộ phận để phân biệt.
  const periodsFixedHTML = sheets.filter(s=>s.period).map(s=>{
    const label = multiDept ? `${(s.name||'Bộ phận').replace(/</g,'&lt;')}: ` : '';
    return `<div class="dh3-sched-period">📅 ${label}${(s.period||'').replace(/</g,'&lt;')}</div>`;
  }).join('');
  const blocksHTML = sheets.length ? sheets.map(s=>{
    const groups = llvGroupRows(s.rows||[]);
    totalCount += (s.rows||[]).length;
    totalLeave += (s.rows||[]).filter(r=>llvActiveLeave(r.name,null,s)).length;
    const deptHd = multiDept ? `<div class="dh3-sched-dept-hd">${(s.name||'Bộ phận').replace(/</g,'&lt;')}</div>` : '';
    const groupsHTML = groups.map(g=>{
      const rowsHTML = g.items.map(({r},gi)=>{
        const esc = v=>(v==null?'':String(v)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
        const leaveRec = llvActiveLeave(r.name, null, s);
        const nm = (r.name||'').trim();
        const initial = nm ? Array.from(nm.split(/\s+/).pop())[0].toUpperCase() : '?';
        // Màu theo loại nghỉ — nhận biết nhanh ốm / phép năm / việc riêng... từ xa trên TV
        const loai = (leaveRec && leaveRec.loai ? leaveRec.loai : 'Nghỉ').toString();
        const LT = /ốm/i.test(loai) ? ['#fb7185','rgba(251,113,133,.15)']
                 : /thai/i.test(loai) ? ['#f0abfc','rgba(240,171,252,.15)']
                 : /không\s*lương/i.test(loai) ? ['#cbd5e1','rgba(203,213,225,.13)']
                 : /phép/i.test(loai) ? ['#4ade80','rgba(74,222,128,.14)']
                 : /riêng/i.test(loai) ? ['#22d3ee','rgba(34,211,238,.14)']
                 : ['#fbbf24','rgba(251,191,36,.14)'];
        const dm = d => { const m=(d||'').match(/^\d{4}-(\d{2})-(\d{2})/); return m?`${m[2]}/${m[1]}`:''; };
        let range = '';
        if(leaveRec){
          const f=dm(leaveRec.fromDate), t=dm(leaveRec.toDate);
          range = (f&&t&&f!==t) ? `${f} → ${t}` : (t||f);
        }
        const leaveHtml = leaveRec ? `<div class="dh3-sched-leave"><span class="dh3-sched-badge">🏖️ ${esc(loai)}</span>${range?`<span class="dh3-sched-leave-date">${range}</span>`:''}</div>` : '';
        const dept = llvWorkerDept(r.name);
        const shiftShort = LLV_SHIFT_SHORT[g.key] || '';
        const subHtml = (dept||shiftShort) ? `<div class="dh3-sched-sub">${dept?`<span class="dh3-sched-meta">${esc(dept)}</span>`:''}${shiftShort?`<span class="dh3-sched-meta">${esc(shiftShort)}</span>`:''}</div>` : '';
        return `<div class="dh3-sched-row-v${leaveRec?' is-leave':''}" style="--lc:${LT[0]};--lb:${LT[1]}" title="${esc(nm)}${leaveRec?' — '+esc(loai)+(leaveRec.lydo?': '+esc(leaveRec.lydo):''):''}" onclick="goTab('lichLamViec')">
          <span class="dh3-sched-stt">${gi+1}</span>
          <span class="dh3-sched-av">${esc(initial)}</span>
          <div class="dh3-sched-main">
            <div class="dh3-sched-name">${esc(nm||'—')}</div>
            ${subHtml}
            ${leaveHtml}
          </div>
        </div>`;
      }).join('');
      return `<div class="dh3-sched-group">
        <div class="dh3-sched-group-hd" style="background:${g.meta.bg};color:${g.meta.color}">${g.meta.label} <span class="dh3-sched-count">· ${g.items.length} người</span>${(()=>{const n=g.items.filter(({r})=>llvActiveLeave(r.name,null,s)).length;return n?`<span class="dh3-sched-count off">🏖️ ${n} nghỉ</span>`:'';})()}</div>
        ${rowsHTML}
      </div>`;
    }).join('');
    return `<div class="dh3-sched-block">${deptHd}${groupsHTML}</div>`;
  }).join('') : `<div class="dh3-next-empty">Chưa có lịch làm việc nào · vào tab "Lịch làm việc" để tạo</div>`;
  return `
    <div class="dh3-panel">
      <div class="dh3-panel-hd">📅 LỊCH LÀM VIỆC <b style="font-size:10.5px;color:#8fc0ff;font-weight:700">· ${totalCount} người</b>${totalLeave?`<b style="font-size:10.5px;color:#22d3ee;font-weight:800"> · 🏖️ ${totalLeave} nghỉ</b>`:''}</div>
      ${periodsFixedHTML}
      <div class="dh3-sched-rows-v" id="dhScheduleScrollBox">${blocksHTML}</div>
    </div>`;
}

// ── TỰ ĐỘNG CUỘN các ô danh sách dài (Thông báo, Đơn kế tiếp...) — cuộn dần
// xuống hết danh sách, dừng lại đọc ở cuối, cuộn ngược lên đầu, dừng lại ở
// đầu, rồi lặp lại vô hạn. Chạy như MỘT VÒNG LẶP ĐỘC LẬP theo mốc THỜI GIAN
// THẬT (Date.now()) cho TỪNG Ô riêng biệt (đăng ký qua DH_AUTOSCROLL_BOXES
// bên dưới), KHÔNG gắn vào vòng đời của 1 phần tử DOM cụ thể — vì
// renderDieuHanh() có thể dựng lại toàn bộ khung bất cứ lúc nào khi có dữ
// liệu mới, nên nếu tính theo phần tử sẽ bị giật/nhảy lại từ đầu mỗi lần
// re-render. Nhờ tính theo thời gian, dù phần tử bị thay mới giữa chừng,
// hiệu ứng cuộn vẫn liền mạch, không giật.
// CHỈ cuộn khi danh sách THỰC SỰ tràn khung (còn chỗ để cuộn) — nếu ít, vừa
// khít khung thì đứng yên, không cuộn thừa.
var DH_AUTOSCROLL_BOXES = [
  {id:'dhScheduleScrollBox', pauseTop:4000, pauseBottom:6000, speed:2.5, backMs:3500, minDownMs:9000, maxDownMs:45000},
  {id:'dhNextScrollBox',  pauseTop:1800, pauseBottom:2600, speed:32, backMs:900},
  {id:'dhOrdersScrollBox',  pauseTop:3000, pauseBottom:3000, speed:28, backMs:900}
];
var _dhAutoScrollCycleStart = {};
function _dhAutoScrollTick(){
  DH_AUTOSCROLL_BOXES.forEach(cfg=>{
    const el = document.getElementById(cfg.id);
    if(!el){
      _dhAutoScrollCycleStart[cfg.id] = null; // ô không có mặt (đang ở tab khác) — lần sau xuất hiện sẽ bắt đầu lại từ đầu chu kỳ cho tự nhiên
      return;
    }
    const maxScroll = el.scrollHeight - el.clientHeight;
    if(maxScroll <= 4){
      if(el.scrollTop !== 0) el.scrollTop = 0;
      _dhAutoScrollCycleStart[cfg.id] = null; // không có gì để cuộn — giữ chu kỳ ở trạng thái nghỉ
      return;
    }
    // Thời lượng cuộn xuống tỉ lệ với độ dài thực tế cần cuộn (danh sách
    // càng dài cuộn càng lâu để vẫn đọc kịp), có trần/sàn tránh quá
    // nhanh/quá chậm — mỗi ô có thể tự đặt riêng minDownMs/maxDownMs (xem
    // DH_AUTOSCROLL_BOXES) để cuộn chậm hơn hẳn cho danh sách quan trọng
    // như lịch làm việc; nếu không đặt thì dùng mặc định chung 2500–20000ms.
    const downMs = Math.max(cfg.minDownMs||2500, Math.min(cfg.maxDownMs||20000, (maxScroll / cfg.speed) * 1000));
    const total = cfg.pauseTop + downMs + cfg.pauseBottom + cfg.backMs;
    if(_dhAutoScrollCycleStart[cfg.id]==null) _dhAutoScrollCycleStart[cfg.id] = Date.now();
    const t = (Date.now() - _dhAutoScrollCycleStart[cfg.id]) % total;
    const ease = p => 0.5 - 0.5*Math.cos(Math.PI*p); // ease-in-out, cuộn êm không giật
    let pos;
    if(t < cfg.pauseTop){
      pos = 0;
    } else if(t < cfg.pauseTop + downMs){
      pos = maxScroll * ease((t - cfg.pauseTop) / downMs);
    } else if(t < cfg.pauseTop + downMs + cfg.pauseBottom){
      pos = maxScroll;
    } else {
      const p = (t - cfg.pauseTop - downMs - cfg.pauseBottom) / cfg.backMs;
      pos = maxScroll * (1 - ease(p));
    }
    el.scrollTop = pos;
  });
  requestAnimationFrame(_dhAutoScrollTick);
}
requestAnimationFrame(_dhAutoScrollTick);

// ── "THÔNG TIN CA LÀM VIỆC" — chia đúng 3 ca × 8 giờ (06:00-14:00 /
// 14:00-22:00 / 22:00-06:00), ca hiện tại nổi bật + đếm ngược thời gian còn
// lại. Không còn bảng "phân bổ nhân sự theo công đoạn" (đã bỏ theo yêu cầu).
function dhShiftsSummaryV3(){
  const wf = (typeof buildWorkforceData==='function') ? buildWorkforceData() : null;
  const total = wf ? wf.totalWorkers : 0;
  const offDuty = wf ? wf.offDutyCount : 0;
  const h = new Date().getHours();
  const curKey = (h>=6&&h<14) ? 'ca1' : (h>=14&&h<22) ? 'ca2' : 'ca3';
  const defs = [
    {key:'ca1', label:'Ca 1 (Sáng)', time:'06:00 - 14:00'},
    {key:'ca2', label:'Ca 2 (Chiều)', time:'14:00 - 22:00'},
    {key:'ca3', label:'Ca 3 (Đêm)', time:'22:00 - 06:00'}
  ];
  const shifts = defs.map(d=>{
    const shiftTotal = wf ? (wf.shiftCounts[d.key]||0) : 0;
    // Phân bổ số người vắng theo tỉ lệ số người đăng ký của từng ca (không có
    // dữ liệu chấm công riêng theo ca nên dùng tỉ lệ hợp lý, không bịa số).
    const absent = total ? Math.round(offDuty * (shiftTotal/total)) : 0;
    const present = Math.max(0, shiftTotal-absent);
    return {...d, total:shiftTotal, present, absent, current:d.key===curKey};
  });
  return {shifts, curKey, totalWorkers:total, present:Math.max(0,total-offDuty), absent:offDuty};
}
function dhShiftPanelV3HTML(){
  const s = dhShiftsSummaryV3();
  const cur = s.shifts.find(x=>x.current);
  const rowsHTML = s.shifts.map(x=>`
    <div class="dh3-shift-row${x.current?' current':''}">
      <span class="dh3-shift-row-lbl">${x.label}${x.current?'<span class="dh3-shift-tag">Đang diễn ra</span>':''}</span>
      <span>${x.total}</span><span>${x.present}</span><span>${x.absent}</span>
    </div>`).join('');
  return `
    <div class="dh3-panel">
      <div class="dh3-panel-hd">🕐 THÔNG TIN CA LÀM VIỆC</div>
      <div class="dh3-shift-current">
        <div>
          <div class="dh3-shift-current-lbl">${cur?cur.label:''} · ${cur?cur.time:''}</div>
          <div class="dh3-shift-current-time" id="dhRuntimeClockLbl">Đang diễn ra · <span id="dhRuntimeClock">${dhRuntimeElapsedStr()}</span></div>
        </div>
        <div>
          <div class="dh3-shift-current-remain" id="dhRuntimeRemain">${dhRuntimeRemainStr()}</div>
          <div class="dh3-shift-current-remain-lbl">Còn lại</div>
        </div>
      </div>
      <div class="dh3-att-grid">
        <div class="dh3-att-stat"><b>${s.totalWorkers}</b><span>Tổng số người</span></div>
        <div class="dh3-att-stat"><b>${s.present}</b><span>Có mặt</span></div>
        <div class="dh3-att-stat warn"><b>${s.absent}</b><span>Vắng</span></div>
      </div>
      <div class="dh3-shift-table">
        <div class="dh3-shift-row" style="background:none;border:none;padding:0 9px;font-size:9px;color:#9db3e0;text-transform:uppercase;font-weight:800">
          <span>Ca làm việc</span><span>Tổng</span><span>Có mặt</span><span>Vắng</span>
        </div>
        ${rowsHTML}
      </div>
    </div>`;
}

// ── Tên máy RÚT GỌN cho khu vực "ĐƠN KẾ TIẾP" (TV Mode) — cột "Máy" chỉ cần
// đủ để NHẬN DIỆN đúng máy, không cần lặp lại cả cụm dài (đã có cột "Công
// đoạn" đứng ngay trước rồi nên chữ "Máy" là dư). Quy tắc:
//   1. Luôn bỏ chữ "Máy " ở đầu.
//   2. Riêng nhóm "Máy đùn": mã máy (TJ550/TJ400/TJ300...) đã đủ nhận diện,
//      bỏ luôn từ "đùn" — VD "Máy đùn TJ550 (1)" → "TJ550 (1)".
//   3. Các nhóm còn lại (Rút/Đánh bóng/Cắt): giữ tên nhóm (viết hoa chữ đầu)
//      + số hiệu, chuẩn hoá thành dạng gọn "Tên nhóm - số (chỉ số)" —
//      VD "Máy rút 100 - 1" → "Rút - 100 (1)", "Máy cắt 1" → "Cắt - 1".
function dhShortMachineName(m){
  if(!m || !m.name) return m?m.group||'':'';
  let rest = String(m.name).replace(/^Máy\s+/i, '').trim();
  if(m.group === 'Máy đùn'){
    return rest.replace(/^đùn\s+/i, '').trim() || rest;
  }
  const groupWord = String(m.group||'').replace(/^Máy\s+/i, '').trim();
  if(!groupWord) return rest;
  let suffix = rest.replace(new RegExp('^'+groupWord+'\\s*','i'), '').trim();
  suffix = suffix.replace(/^-\s*/, '').trim();
  suffix = suffix.replace(/^(\d+)\s*-\s*(\d+)$/, '$1 ($2)');
  const groupLabel = groupWord.charAt(0).toUpperCase() + groupWord.slice(1);
  return suffix ? `${groupLabel} - ${suffix}` : groupLabel;
}

// ── "ĐƠN KẾ TIẾP (SẮP CHẠY)" — TỰ ĐỘNG lấy đúng từ hàng đợi phân công máy
// (dhMachineQueue/machineRuntimeStatus, CÙNG NGUỒN với khu vực máy) nên luôn
// đồng bộ 100% với phân công thực tế — không lưu số liệu riêng nào khác. Từ
// khi khu vực máy không còn hiển thị "ĐƠN CHẠY TIẾP" riêng trên từng thẻ nữa,
// khối này liệt kê ĐẦY ĐỦ TẤT CẢ đơn đang chờ của MỌI máy (không chỉ đơn kế
// tiếp gần nhất mỗi máy), sắp theo mức ưu tiên/ngày tạo. Chỉ hiển thị TÊN
// KHÁCH HÀNG, không hiển thị mã đơn hàng. Cột "Máy" hiển thị tên RÚT GỌN
// (xem dhShortMachineName ở trên) — VD "TJ550 (1)" / "Rút - 100 (1)" — thay
// vì tên đầy đủ, cho gọn & dễ đọc từ xa trên màn TV.
// Thẻ "Loại": đơn Bo cạnh → nhãn cam nổi bật; loại khác → chữ thường; không có → "—"
function dhTypeTag(o){
  const t=o&&o.type;
  if(!t) return '—';
  if(typeof isBoCanhType==='function' && isBoCanhType(t)) return '<b class="dh4-tag dh4-tag-bo">BO CẠNH</b>';
  return dhEsc(t);
}
function dhNextQueueListV3(){
  const rows = [];
  MACHINES.forEach(m=>{
    const rs = machineRuntimeStatus(m.id);
    const runningOrder = dhOrderAtMachine(m.id);
    const queue = (rs.queue||[]).filter(q=>!runningOrder || q.id!==runningOrder.id);
    const st = ASSIGN_STAGES.find(s=>s.group===m.group);
    queue.forEach((q,qi)=>rows.push({stage: st?st.label:m.group, machine:dhShortMachineName(m), order:q, mid:m.id, qi}));
  });
  rows.sort((a,b)=>{
    const pa=parseInt(String(a.order.priority||'GẤP 9').replace('GẤP ',''))||9;
    const pb=parseInt(String(b.order.priority||'GẤP 9').replace('GẤP ',''))||9;
    if(pa!==pb) return pa-pb;
    return (a.order.createdAt||0)-(b.order.createdAt||0);
  });
  return rows;
}
var DH3_NEXT_QUEUE_MAX_SHOW = 200; // trần an toàn (phòng dữ liệu lỗi/vô hạn) — bình thường danh sách cuộn hết, không còn cắt bớt như trước
function dhNextQueuePanelV3HTML(){
  const all = dhNextQueueListV3();
  const rows = all.slice(0, DH3_NEXT_QUEUE_MAX_SHOW);
  const rest = all.length - rows.length;
  const ca = dhShiftShort();
  const rowsHTML = rows.length ? rows.map((r,i)=>{
    const o=r.order;
    return `<div class="dh4-row dh4-nrow" onclick="khViewDetail('${o.id}')">
      <span class="dh4-c-stt">${i+1}</span>
      <span class="dh4-c-cust">${dhEsc(o.customer||'—')}</span>
      <span class="dh4-c-mat">${dhEsc(o.material||'—')}</span>
      <span class="dh4-c-type">${dhTypeTag(o)}</span>
      <span><b class="dh4-spec">${dhEsc(specStr(o)).replace(/×/g,'×\u200b')}</b></span>
      <span class="dh4-num">${(o.qty||0).toLocaleString('vi-VN')}</span>
      <span class="dh4-c-mc"><b class="dh4-chip">${dhEsc(r.machine)}</b><i class="dh4-mc-stage">${dhEsc(r.stage)}</i></span>
    </div>`;}).join('') : `<div class="dh3-next-empty">Không có đơn chờ chạy tiếp</div>`;
  return `
    <div class="dh3-panel dh4-next">
      <div class="dh3-panel-hd dh4-hd-big">⏭️ ĐƠN SẮP CHẠY <b>· ${all.length} đơn</b></div>
      <div class="dh4-tbl dh4-ntbl">
        <div class="dh4-row dh4-head"><span>STT</span><span>Khách hàng</span><span>Nguyên liệu</span><span>Loại</span><span>Quy cách</span><span>Số lượng</span><span>Máy</span></div>
        <div class="dh4-body" id="dhNextScrollBox">${rowsHTML}${rest>0?`<div class="dh3-next-more">+${rest} đơn khác trong hàng đợi</div>`:''}</div>
      </div>
    </div>`;
}

function dhEsc(s){ return s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function dhShiftShort(){ return String(dhCurrentShift()).split(' ·')[0]; }
function dhFmtDate(s){
  if(!s) return '—';
  const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : esc(s);
}
function dhFmtStart(ts){
  if(!ts) return '—';
  const d=new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`;
}

// ── "ĐƠN HÀNG ĐANG SẢN XUẤT" — lấy TRỰC TIẾP từ DB.orders (status running/cutting),
// cùng nguồn với khu máy. Đơn vị sản lượng: THANH (o.qty / o.doneQty), không quy đổi kg.
// Trạng thái hiển thị (chỉ để hiển thị, không ghi DB): TRỄ (khIsOverdue) > SẮP XONG (>=90%)
// > SẮP HẠN (giao trong <=2 ngày) > ĐANG SX. Ưu tiên = o.priority sẵn có ("GẤP n").
function dhRunningOrdersTableHTML(){
  const today0=new Date(new Date().toDateString()).getTime();
  const list=DB.orders.filter(o=>o.status==='running'||o.status==='cutting');
  const pn=o=>parseInt(String(o.priority||'GẤP 9').replace('GẤP ',''))||9;
  list.sort((a,b)=>(khIsOverdue(b)-khIsOverdue(a))||(pn(a)-pn(b))||((a.createdAt||0)-(b.createdAt||0)));
  const ca=dhShiftShort();
  const rowsHTML=list.length?list.map((o,i)=>{
    const qty=o.qty||0, done=o.doneQty||0, left=Math.max(0,qty-done);
    const pct=qty?Math.min(100,Math.round(done/qty*100)):0;
    const late=khIsOverdue(o);
    const dl=o.deliveryDate?Math.round((new Date(o.deliveryDate+'T00:00:00')-today0)/86400000):null;
    let st=['ĐANG SX','run'];
    if(late) st=['TRỄ','late'];
    else if(pct>=90) st=['SẮP XONG','done'];
    else if(dl!==null && dl<=2) st=['SẮP HẠN','soon'];
    const sk=orderActiveAssignStage(o).key;
    const mid=orderMachineAssign(o)[sk];
    const mc=mid?machineById(mid):null;
    const pc=PRI_COLOR[o.priority]||'#64748b';
    return `<div class="dh4-row dh4-orow" style="--pc:${pc}" data-order-id="${o.id}" onclick="khViewDetail('${o.id}')">
      <span class="dh4-c-stt">${i+1}</span>
      <span class="dh4-c-cust">${dhEsc(o.customer||'—')}${o.priority?`<i class="dh4-sub"><b class="dh4-pri" style="color:${pc}">${dhEsc(o.priority)}</b></i>`:''}</span>
      <span class="dh4-c-mat">${dhEsc(o.material||'—')}</span>
      <span class="dh4-c-type">${dhTypeTag(o)}</span>
      <span><b class="dh4-spec">${dhEsc(specStr(o)).replace(/×/g,'×\u200b')}</b></span>
      <span class="dh4-num">${qty.toLocaleString('vi-VN')}</span>
      <span class="dh4-num dh4-left${left?'':' zero'}">${left.toLocaleString('vi-VN')}</span>
      <span class="dh4-c-mc">${mc?`<b class="dh4-chip">${dhEsc(dhShortMachineName(mc))}</b>`:'—'}</span>
      <span><b class="dh4-badge dh4-b-${st[1]}">${st[0]}</b></span>
      <span class="dh4-act" onclick="event.stopPropagation()">
        <button title="Xem chi tiết" onclick="khViewDetail('${o.id}')">👁</button>
        <button title="Ghi sản lượng" onclick="openProgress('${o.id}')">✏️</button>
        <button title="Mã QR" onclick="openQrGenForOrder('${o.id}')">🔳</button>
      </span>
    </div>`;}).join(''):`<div class="dh3-next-empty">Hiện không có đơn nào đang sản xuất</div>`;
  return `
    <div class="dh3-panel dh4-orders">
      <div class="dh3-panel-hd dh4-hd-big">🏭 ĐƠN HÀNG ĐANG SẢN XUẤT <b>· ${list.length} đơn</b></div>
      <div class="dh4-tbl dh4-otbl">
        <div class="dh4-row dh4-head"><span>STT</span><span>Khách hàng</span><span>Nguyên liệu</span><span>Loại</span><span>Quy cách</span><span>Số lượng</span><span>Còn lại</span><span>Máy</span><span>Trạng thái</span><span class="dh4-act"></span></div>
        <div class="dh4-body" id="dhOrdersScrollBox">${rowsHTML}</div>
      </div>
    </div>`;
}

// ── (Đã bỏ khối "TỔNG HỢP THEO CÔNG ĐOẠN" theo yêu cầu — vị trí này nay do
// khối "LỊCH LÀM VIỆC" đảm nhiệm, xem dhSchedulePanelV3HTML() ở trên.)

// ── "TIẾN ĐỘ SẢN XUẤT TOÀN NHÀ MÁY" — full width, cuối trang.
function dhTotalProgressV3HTML(){
  const perf = dhPerformanceData();
  const remain = Math.max(0, perf.planned-perf.actual);
  const pct = perf.pct;
  return `
    <div class="dh3-total-panel">
      <div class="dh3-total-hd">📈 TIẾN ĐỘ SẢN XUẤT TOÀN NHÀ MÁY</div>
      <div class="dh3-total-stats">
        <div class="dh3-total-stat"><b>${perf.planned.toLocaleString('vi-VN')}</b><span>Kế hoạch ngày (kg)</span></div>
        <div class="dh3-total-stat"><b>${perf.actual.toLocaleString('vi-VN')}</b><span>Thực tế (kg)</span></div>
        <div class="dh3-total-stat"><b>${remain.toLocaleString('vi-VN')}</b><span>Còn lại (kg)</span></div>
        <div class="dh3-total-stat"><b>${pct}%</b><span>Đạt (%)</span></div>
      </div>
      <div class="dh3-total-bar-wrap"><span class="dh3-total-bar-fill" style="width:${Math.min(100,pct)}%"></span></div>
      <div class="dh3-total-donut-wrap">
        ${dhDonutHTML([{value:pct,color:'#4ade80'},{value:100-pct,color:'#fb923c'}], pct+'%', 'ĐẠT')}
        <div class="dh3-total-legend">
          <span><i style="background:#4ade80"></i>Đạt ${pct}%</span>
          <span><i style="background:#fb923c"></i>Chưa đạt ${100-pct}%</span>
        </div>
      </div>
    </div>`;
}
