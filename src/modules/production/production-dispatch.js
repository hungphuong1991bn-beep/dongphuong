// src/modules/production/production-dispatch.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── Hàng đợi "đơn nào chạy tiếp" của 1 máy — mọi đơn CHƯA CHẠY (pending) đã
// được phân công sẵn cho máy này (bất kỳ công đoạn nào), sắp xếp theo mức ưu
// tiên (GẤP 1 lên trước) rồi tới ngày tạo (đơn tạo trước xếp trước). Đây là
// nguồn DUY NHẤT cho biết "máy này chạy xong đơn hiện tại thì tới đơn nào" —
// cho phép phân công máy TRƯỚC cho đơn chưa chạy (xem assignMachine()), nên
// Bảng Điều hành SX luôn biết trước thứ tự chạy tiếp theo mà không cần đợi
// đơn hiện tại kết thúc mới gán máy.
function dhMachineQueue(machineId, excludeOrderId){
  const m = machineById(machineId);
  const myStage = m ? ASSIGN_STAGES.find(s=>s.group===m.group) : null;
  if(!myStage) return [];
  return DB.orders
    .filter(o=>o.id!==excludeOrderId && o.status!=='done' && orderMachineAssign(o)[myStage.key]===machineId)
    // Loại trừ đúng đơn ĐANG THỰC SỰ CHẠY tại máy này (hiển thị riêng bởi
    // dhOrderAtMachine, không phải "đơn chạy tiếp") — dùng CHUNG 1 điều kiện
    // duy nhất dhIsOrderRunningAtStage() để không bao giờ lệch với thẻ máy:
    // công đoạn ĐÃ CHẠY QUA (vẫn giữ đúng máy, không xung đột) HOẶC công đoạn
    // HIỆN TẠI đều tính là "đang chạy", chỉ công đoạn CHƯA TỚI mới là "chờ".
    .filter(o=>!dhIsOrderRunningAtStage(o, myStage.key, machineId))
    .sort((a,b)=>{
      const pa=parseInt(String(a.priority||'GẤP 9').replace('GẤP ',''))||9;
      const pb=parseInt(String(b.priority||'GẤP 9').replace('GẤP ',''))||9;
      if(pa!==pb) return pa-pb;
      return (a.createdAt||0)-(b.createdAt||0);
    });
}

// Trạng thái hiển thị của 1 máy — ưu tiên Sự cố/Bảo trì (từ tab Bảo trì máy,
// dữ liệu đã có sẵn), sau đó tới đang chạy/chờ theo phân công từ đơn hàng.
// Luôn kèm theo `queue` (hàng đợi đơn chưa chạy) để nơi gọi tự quyết định
// hiển thị "đơn chạy tiếp" mà không cần tính lại.
function machineRuntimeStatus(machineId){
  const bt = (typeof machineStatus==='function') ? machineStatus(machineId) : 'ok';
  const queue = dhMachineQueue(machineId);
  if(bt==='hong')   return {code:'sc', label:'🔴 Sự cố', dot:'🔴', queue};
  if(bt==='baotri') return {code:'bt', label:'🟣 Bảo trì', dot:'🟣', queue};
  const runningOrder = dhOrderAtMachine(machineId);
  if(runningOrder) return {code:'run', label:'🟢 Đang chạy', dot:'🟢', order:runningOrder, queue};
  if(queue.length) return {code:'cho', label:'🟡 Chờ', dot:'🟡', order:queue[0], queue};
  return {code:'sang', label:'🔵 Sẵn sàng', dot:'🔵', queue:[]};
}

// ════════════════════════════════════════════════════════════
// AUTO DISPATCH — SỬA TẬN GỐC LỖI "ĐƠN CHẠY TIẾP KHÔNG THỂ CHUYỂN
// THÀNH ĐƠN ĐANG CHẠY". Trước đây, khi 1 đơn (VD "A") hoàn thành hoặc
// nhả máy, đơn kế tiếp trong hàng đợi (VD "B") — dù ĐÃ được phân công
// sẵn đúng máy đó (o.machineAssign[stageKey] = machineId) — KHÔNG tự
// chuyển sang RUNNING, vẫn bị coi là "đơn đang chờ" mãi mãi, kể cả khi
// vào Phân công máy chọn lại đúng máy đó cho B. Nguyên nhân gốc: hệ
// thống trước đây lẫn lộn 3 khái niệm — machineAssign (được gán máy
// nào), queue (đang xếp hàng), running (đang THỰC SỰ chạy) — coi
// machineAssign=machineId gần như đồng nghĩa "đang chạy", trong khi
// không có bất kỳ bước nào chủ động đẩy trạng thái đơn từ hàng đợi lên
// RUNNING khi máy trống ra.
//
// promoteQueuedOrderToRunning(machineId) là NGUỒN DUY NHẤT thực hiện
// bước "đẩy" đó — được gọi mỗi khi 1 máy có khả năng vừa trống ra (đơn
// hoàn thành, đổi công đoạn nhả máy, vừa phân công máy thủ công cho 1
// đơn đang chờ vào đúng máy đang trống, hoặc dữ liệu Firebase báo thay
// đổi trạng thái liên quan) — KHÔNG gọi ở mọi lượt render để tránh vòng
// lặp realtime (xem lock _dhAutoDispatchLocks bên dưới).
//
// QUY TẮC BẮT BUỘC: hàm này CHỈ UPDATE bản ghi đơn đã có theo đúng id
// (o.status/o.stage) — KHÔNG tạo đơn mới, KHÔNG clone, KHÔNG đổi id,
// KHÔNG xoá rồi tạo lại trên Firebase, KHÔNG xoá machineAssign.
let _dhAutoDispatchLocks = {};

// Nhả các máy của những công đoạn ĐÃ ĐI QUA (trước newStageKey) khỏi
// o.machineAssign — dùng chung cho cả thao tác thủ công (setStage) và
// tự động (promoteQueuedOrderToRunning khi đơn đang chạy dở tới lượt
// công đoạn kế tiếp), trả về danh sách machineId vừa được nhả để nơi
// gọi tiếp tục dò xem có đơn nào khác đang xếp hàng tại đúng máy đó để
// tự động đẩy lên chạy tiếp (dây chuyền domino, không dừng ở giữa).
function dhReleaseEarlierMachines(o, newStageKey){
  const released = [];
  if(!o.machineAssign) return released;
  const newIdx = ASSIGN_STAGES.findIndex(s=>s.key===newStageKey);
  if(newIdx>0){
    ASSIGN_STAGES.slice(0,newIdx).forEach(s=>{
      if(o.machineAssign[s.key]){
        released.push(o.machineAssign[s.key]);
        delete o.machineAssign[s.key];
      }
    });
  }
  return released;
}

function promoteQueuedOrderToRunning(machineId){
  if(!machineId) return false;
  if(_dhAutoDispatchLocks[machineId]) return false; // chống vòng lặp realtime (mục 13)
  _dhAutoDispatchLocks[machineId] = true;
  try{
    // A. Máy đang có 1 đơn THỰC SỰ đang RUNNING → không đụng vào, dừng lại
    //    (chống 2 đơn cùng RUNNING 1 máy — mục 12).
    if(dhOrderAtMachine(machineId)) return false;
    const m = machineById(machineId);
    if(!m) return false;
    const myStage = ASSIGN_STAGES.find(s=>s.group===m.group);
    if(!myStage) return false;

    // B+C. Lấy hàng đợi của máy này (đã sắp theo ưu tiên/ngày tạo), lấy
    // đơn hợp lệ đầu tiên.
    const queue = dhMachineQueue(machineId);
    if(!queue.length) return false;
    const next = queue[0];

    // E. Đúng máy này đã được gán cho đúng công đoạn của máy.
    if(orderMachineAssign(next)[myStage.key] !== machineId) return false;
    // F. Đơn chưa hoàn thành.
    if(next.status==='done') return false;

    // G. Đơn có thể đang ở 1 trong 2 trạng thái hợp lệ để được đẩy lên đây:
    //    - 'pending' (chưa từng chạy) → đây là lần chạy ĐẦU TIÊN.
    //    - 'running' NHƯNG đã sang đúng công đoạn của máy này qua setStage()
    //      trong lúc máy còn bận (dhMachineQueue() ở trên đã tự lọc đúng
    //      trường hợp này rồi, nên tới đây chắc chắn hợp lệ) → SỬA LỖI GỐC:
    //      trước đây hàm này bỏ qua thẳng mọi đơn 'running', khiến đơn kiểu
    //      này không bao giờ được xác nhận chạy dù máy đã trống ra.

    // H. CHUYỂN CHÍNH đơn này (không tạo mới/không đổi id) → RUNNING,
    // giữ nguyên o.machineAssign hiện có, và XÁC NHẬN đang chạy thật tại
    // đúng máy này (machineActiveAt) — nguồn duy nhất chống 2 đơn cùng
    // "đang chạy" 1 máy (xem dhOrderAtMachine/dhMachineQueue).
    const before = next.status;
    next.status = 'running';
    if(!next.startedAt) next.startedAt = Date.now();
    if(!next.stage) next.stage = myStage.key;
    dhMarkActiveAtMachine(next, myStage.key, machineId);

    log('Tự động chạy tiếp', `${next.customer||''} · ${ASSIGN_STAGE_LABEL[myStage.key]||''} → ${m.name}`,
      next.id, {status:before}, {status:'running'});

    saveOrders(); // ghi Database + đồng bộ Realtime ngay — không cần F5 (mục 14)
    renderTab(currentTab);
    refreshKhDetailIfOpen(next.id);
    dhFitNextQueues();
    showToast(`⚙️ ${m.name}: tự động chạy tiếp ${ddCode(next)} (${next.customer||''})`);
    addNotif('order_run','⚙️ Tự động chạy tiếp: '+(next.customer||''),
      `${specStr(next)} · ${qtyLabel(next)} · ${next.priority||''} · ${m.name}`,'keHoach','Hệ thống');
    return true;
  } finally {
    delete _dhAutoDispatchLocks[machineId];
  }
}

// Quét toàn bộ máy trong xưởng và tự đẩy hàng đợi lên RUNNING ở những
// máy đang trống — dùng khi dữ liệu đơn hàng vừa được đồng bộ lại từ
// Firebase (SSE/poll) để không bỏ sót trường hợp máy trống ra do thao
// tác của 1 thiết bị khác. Bản thân promoteQueuedOrderToRunning() đã tự
// no-op (không ghi/không render) nếu máy đang bận hoặc hàng đợi rỗng,
// nên gọi hàm này thường xuyên là an toàn, không gây vòng lặp hay ghi
// thừa lên Firebase.
function dhAutoDispatchSweepAll(){
  if(typeof isStaff!=='function' || !isStaff()) return; // chỉ tài khoản có quyền ghi mới tự đẩy trạng thái
  MACHINES.forEach(m=>promoteQueuedOrderToRunning(m.id));
}

// Gán/đổi máy cho 1 công đoạn của 1 đơn hàng — CHỈ cập nhật bản ghi đã có
// theo id (giống mọi thao tác khác của Kế hoạch SX), không tạo đơn mới.
function assignMachine(orderId, stageKey, machineId){
  if(guardViewer()) return;
  if(!isStaff()){ showToast('❌ Bạn không có quyền phân công máy', true); renderTab(currentTab); return; }
  withPlanLock('assign_'+orderId+'_'+stageKey, ()=>{
    const o = DB.orders.find(x=>x.id===orderId); if(!o) return;
    machineId = machineId || '';
    const old = orderMachineAssign(o)[stageKey] || '';
    if(old===machineId) return;
    // Đơn khác đang thực sự CHIẾM máy này (status='running') ở đúng công đoạn?
    // — Chỉ chặn khi đây là CÔNG ĐOẠN ĐANG CHẠY THẬT SỰ của chính đơn này
    //   (o.stage === stageKey) — vì lúc đó 2 đơn sẽ "chạy chồng" cùng lúc
    //   trên 1 máy → chặn, yêu cầu đổi máy khác hoặc đợi.
    // — Mọi trường hợp còn lại (đơn đang pending, HOẶC đơn đang chạy nhưng ở
    //   1 công đoạn KHÁC — VD đang chạy Đùn mà phân công trước máy Rút/Cắt/
    //   Đánh bóng cho các công đoạn sau) đều cho phép PHÂN CÔNG TRƯỚC — đơn
    //   sẽ tự xếp vào HÀNG ĐỢI của máy đó và hiện là "đơn chạy tiếp" ngay
    //   trên Bảng Điều hành SX, không cần đợi máy trống mới được gán. Đây
    //   chính là lý do trước đây máy Rút/Cắt/Đánh bóng không phân công được
    //   đơn tiếp theo dù máy đùn của đơn hiện tại còn đang chạy — vì trước
    //   đây coi status='running' của ĐƠN là đủ để chặn, dù công đoạn định
    //   gán không hề trùng với công đoạn đơn đang thực sự chạy.
    let queueAfter = null;
    if(machineId){
      const conflict = machineConflictOrder(machineId, stageKey, orderId);
      if(conflict){
        const activeStageNow = orderActiveAssignStage(o);
        // Công đoạn định gán là công đoạn HIỆN TẠI hoặc ĐÃ CHẠY QUA của chính
        // đơn này (không phải công đoạn CHƯA TỚI ở phía sau) → máy đích đang
        // thực sự bận đơn khác nghĩa là XUNG ĐỘT THẬT, phải chặn (đồng bộ với
        // dhIsOrderRunningAtStage — công đoạn đã qua vẫn có thể đang "chạy song
        // song", nên cũng cần được bảo vệ khỏi 2 đơn tranh 1 máy như công đoạn
        // hiện tại, xem yêu cầu "vừa Rút vừa Đánh bóng").
        const isCurrentOrPastStage = o.status==='running' && activeStageNow && assignStageIndex(stageKey)<=assignStageIndex(activeStageNow.key);
        if(isCurrentOrPastStage){
          showToast(`⚠️ Máy đang chạy đơn ${ddCode(conflict)} (${conflict.customer||''}) — hãy đổi máy khác hoặc đợi đơn đó xong`, true);
          renderTab(currentTab);
          refreshKhDetailIfOpen(orderId);
          return;
        }
        queueAfter = conflict; // xếp hàng, không chặn
      }
    }
    if(!o.machineAssign) o.machineAssign = {};
    if(machineId) o.machineAssign[stageKey] = machineId; else delete o.machineAssign[stageKey];

    const m = machineById(machineId);
    log('Phân công máy', `${o.customer||''} · ${ASSIGN_STAGE_LABEL[stageKey]||stageKey} → ${m?m.name:'(bỏ gán)'}`, orderId, {[stageKey]:old}, {[stageKey]:machineId});
    renderTab(currentTab);
    refreshKhDetailIfOpen(orderId);
    if(m && queueAfter){
      const pos = dhMachineQueue(machineId).findIndex(x=>x.id===orderId);
      showToast(`🕐 Đã xếp hàng chờ ${m.name} — sẽ chạy tiếp sau đơn ${ddCode(queueAfter)}${pos>0?` (vị trí #${pos+1})`:''}`);
    } else {
      showToast(m?`🏭 Đã gán ${m.name} cho công đoạn ${ASSIGN_STAGE_LABEL[stageKey]}`:'↺ Đã bỏ gán máy');
    }
    saveOrders(); // ghi Database + đồng bộ Realtime ngay — Bảng Điều hành SX tự cập nhật theo

    // SỬA LỖI: nếu máy vừa được chọn ĐANG TRỐNG (không có đơn nào khác
    // thực sự RUNNING ở đó) và đơn này đang xếp đầu hàng đợi, đẩy NGAY
    // sang RUNNING — không bắt người dùng phải vào lại bấm "Bắt đầu sản
    // xuất" mới chạy được (mục 8: "TJ550-1 đã trống → B chuyển ngay
    // WAITING → RUNNING"). promoteQueuedOrderToRunning() tự no-op nếu
    // máy đang bận hoặc đơn chưa tới lượt, nên gọi vô điều kiện là an toàn.
    if(machineId) promoteQueuedOrderToRunning(machineId);
  });
}
// Tự động thăng cấp ưu tiên: mỗi mức GẤP luôn phải duy trì ĐỦ ÍT NHẤT 6 đơn
// đang active. Khi 1 đơn CHẠY XONG làm mức GẤP N hiện tại TỤT XUỐNG DƯỚI 6
// đơn (kể cả tụt về 0 khi "chạy hết" hoàn toàn) → tự kéo VỪA ĐỦ số đơn còn
// thiếu từ mức kế tiếp (GẤP N+1) lên GẤP N cho đủ 6, phòng trường hợp admin
// quên đổi ưu tiên thủ công. Nếu mức đó vẫn còn đủ 6 đơn trở lên (hoặc nhiều
// hơn) thì KHÔNG đẩy gì cả. Áp dụng đồng nhất cho MỌI mức GẤP, cascade nhiều
// bậc (GẤP2 thiếu do vừa bị kéo lên GẤP1 → tự kéo tiếp từ GẤP3...). Được gọi
// qua scheduleAiAutoPromoteCheck() ngay sau khi setStatus() chuyển 1 đơn sang
// 'done' (xem điểm gọi bên dưới).
function aiAutoPromote(){
  // Đây là tự-kiểm-tra chạy NGẦM ở nhiều thời điểm khác nhau, không phải do
  // người dùng chủ động bấm nút → không dùng guardViewer() (hàm đó hiện toast
  // "chỉ được xem", vô lý khi chẳng ai bấm gì). Tài khoản Xem/Chỉ nhập Số
  // liệu vốn không có quyền ghi dữ liệu nên lặng lẽ bỏ qua ở đây — chỉ cần 1
  // thiết bị Admin/Nhân viên đang mở app là đủ để việc thăng cấp tự chạy và
  // đồng bộ sang mọi thiết bị khác (kể cả tài khoản Xem) qua Firebase.
  if(!currentUser || isViewer()) return false;
  // Lấy số ưu tiên từ string "GẤP N"
  const getPri = o => parseInt((o.priority||'GẤP 9').replace('GẤP ',''))||9;

  // Ngưỡng tối thiểu mỗi mức GẤP phải duy trì — dưới mức này mới tự đẩy bù.
  const AI_MIN_ACTIVE_PER_PRIORITY = 6;
  // Mức GẤP cao nhất hệ thống hỗ trợ (xem tbGlobalSearch: "GẤP 1".."GẤP 8"),
  // +1 để còn phủ luôn mức mặc định "GẤP 9" (fallback khi thiếu/sai giá trị).
  const AI_MAX_PRIORITY_LEVEL = 9;

  // Trong số các đơn ở mức kế tiếp, đơn nào được kéo lên TRƯỚC khi chỉ cần bù
  // 1 phần (không phải cả mức)? Ưu tiên đơn có HẠN GIAO gần nhất; nếu không có
  // hạn giao hoặc bằng nhau thì đơn được TẠO SỚM NHẤT (chờ lâu nhất) lên trước.
  const promoteSortKey = o => {
    const d = o.deliveryDate ? Date.parse(o.deliveryDate) : NaN;
    return [isNaN(d) ? Infinity : d, Number(o.createdAt) || 0];
  };
  const cmpPromote = (a, b) => {
    const ka = promoteSortKey(a), kb = promoteSortKey(b);
    return ka[0]-kb[0] || ka[1]-kb[1];
  };

  // Cascade: lặp liên tục đến khi không còn mức nào cần bù nữa.
  // VD: GẤP1 chỉ còn 2 đơn (thiếu 4) → kéo 4 đơn GẤP2 (sớm hạn/chờ lâu nhất)
  // lên GẤP1 cho đủ 6 → GẤP2 tụt xuống dưới 6 → tự kéo tiếp từ GẤP3 lên GẤP2...
  const allPromoted = [];
  let changed = true;

  while(changed){
    changed = false;
    const active = DB.orders.filter(o=>o.status!=='done');
    if(!active.length) break;

    // QUAN TRỌNG: xét ĐỦ mọi mức từ 1 đến AI_MAX_PRIORITY_LEVEL theo đúng
    // trình tự — kể cả mức đang TRỐNG HOÀN TOÀN (0 đơn active, VD "GẤP1 chạy
    // hết sạch"). Nếu chỉ xét các mức hiện đang có đơn (như bản trước) thì
    // mức trống hẳn sẽ không xuất hiện trong danh sách đó → bị bỏ sót đúng
    // trường hợp cần xử lý nhất.
    for(let pri=1; pri<AI_MAX_PRIORITY_LEVEL; pri++){
      const atThisLevel = active.filter(o=>getPri(o)===pri);
      // Mức này vẫn ĐỦ 6 đơn trở lên (hoặc nhiều hơn) → không tự đẩy, bỏ qua
      if(atThisLevel.length >= AI_MIN_ACTIVE_PER_PRIORITY) continue;

      // Thiếu (kể cả về 0 khi chạy hết hoàn toàn) → CHỈ kéo bù từ ĐÚNG mức
      // liền kề sau nó (pri+1), không nhảy cóc qua nhiều mức trong 1 lần. Nếu
      // mức liền kề đó cũng đang thiếu/trống thì vòng lặp while sẽ tự bù cho
      // NÓ trước ở lượt kế tiếp (khi for chạy tới đúng mức đó), rồi quay lại
      // bù tiếp cho mức hiện tại — đúng trình tự "GẤP3 → GẤP2 → GẤP1".
      const nextPri = pri + 1;
      const candidates = active.filter(o=>getPri(o)===nextPri).sort(cmpPromote);
      if(!candidates.length) continue; // mức kế cũng trống/không có gì để kéo

      const need = AI_MIN_ACTIVE_PER_PRIORITY - atThisLevel.length;
      const toPromote = candidates.slice(0, need); // chỉ lấy VỪA ĐỦ số còn thiếu
      const newPriStr = 'GẤP '+pri;
      toPromote.forEach(o=>{
        allPromoted.push({customer:o.customer, from:o.priority, to:newPriStr});
        o.aiPromotedFrom = o.priority;
        o.priority = newPriStr;
        o.aiPromoted = true;
      });
      changed = true; // Có thăng cấp → chạy lại vòng lặp để re-check đúng trình tự
      break; // Restart while để luôn xét lại từ GẤP1 trước
    }
  }

  if(allPromoted.length){
    // Nhóm theo cấp mới để thông báo rõ hơn
    const byNew = {};
    allPromoted.forEach(p=>{ (byNew[p.to]=byNew[p.to]||[]).push(p.customer); });

    const msgs = Object.entries(byNew)
      .map(([pri,custs])=>`${custs.join(', ')} → ${pri}`)
      .join(' | ');

    log('AI Thăng cấp', `Tự động: ${msgs}`, '', null,
      {promoted:allPromoted.map(p=>p.customer), detail:msgs});

    // Thông báo từng nhóm
    Object.entries(byNew).forEach(([pri,custs])=>{
      showToast(`🤖 AI: ${custs.length} đơn nâng lên ${pri}`);
      addNotif('system',
        `🤖 AI nâng ưu tiên → ${pri}`,
        custs.join(', ')+` được nâng lên ${pri}`,
        'keHoach','Hệ thống AI');
    });

    saveOrders();
    return true;
  }
  return false;
}

// Gộp nhiều lần "có thể cần kiểm tra thăng cấp" xảy ra gần nhau (VD 1 loạt
// sự kiện đồng bộ SSE dồn về cùng lúc, hoặc xoá/sửa nhiều đơn liên tiếp)
// thành ĐÚNG 1 lần chạy aiAutoPromote() sau 400ms yên ắng — tránh quét lại
// DB.orders thừa nhiều lần cho cùng 1 thay đổi thực tế. Gọi hàm NÀY (thay vì
// gọi thẳng aiAutoPromote()) ở mọi nơi có thể làm cạn/hồi phục 1 mức GẤP.
let _aiPromoteTimer = null;
function scheduleAiAutoPromoteCheck(){
  if(_aiPromoteTimer) clearTimeout(_aiPromoteTimer);
  _aiPromoteTimer = setTimeout(()=>{
    _aiPromoteTimer = null;
    if(aiAutoPromote()){ renderTab(currentTab); updateBadges(); }
  }, 400);
}
