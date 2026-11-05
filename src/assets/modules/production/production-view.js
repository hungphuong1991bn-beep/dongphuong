// src/modules/production/production-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function renderDieuHanh(){
  dhSyncFullscreenClass();
  const groups = [...new Set(MACHINES.map(m=>m.group))];

  $('mc').innerHTML = `
    <div class="dh-wrap dh2${dhTvMode?' dh-tv':''}" id="dhWrap">
      <div class="dh-fit-outer" id="dhFitOuter"><div class="dh-fit-inner" id="dhFitInner">
      ${dhTopbarV3HTML()}
      <div class="dh3-wrap">
        ${dhTopKpisV3HTML()}
        <div class="dh3-machine-row">
          ${groups.map(g=>{
            const list = MACHINES.filter(m=>m.group===g);
            const cols = list.length>=4 ? 2 : 1;
            const rows = Math.max(1, Math.ceil(list.length/cols));
            // Khu "Máy Đùn" được ưu tiên rộng hơn 1 chút so với các khu máy
            // còn lại (--gw = trọng số flex-grow chiều rộng cột) để hiển thị
            // rõ ràng hơn — không phụ thuộc số lượng máy, chỉ áp dụng riêng
            // cho đúng nhóm có tên chứa "đùn".
            const isDun = /đùn/i.test(g);
            const gw = isDun ? 1.55 : 1;
            const gc = dhGroupColor(g);
            return `
            <div class="dh-group" style="--cols:${cols};--gw:${gw};--gc:${gc}">
              <div class="dh-group-title">${g}<span class="dh-group-count">· ${list.length} máy</span></div>
              <div class="dh-card-grid" style="--n:${list.length};--cols:${cols};--rows:${rows}">${list.map(dhMachineCard).join('')}</div>
            </div>
          `;}).join('')}
        </div>
        <div class="dh4-lower">
          <div class="dh4-lower-left">
            ${dhRunningOrdersTableHTML()}
            ${dhNextQueuePanelV3HTML()}
          </div>
          <div class="dh4-lower-right">${dhSchedulePanelV3HTML()}</div>
        </div>
      </div>
      </div></div>
    </div>
  `;
  dhTickClock();
  dhBindAutoFit();
  // Đo lại "ĐƠN CHẠY TIẾP" ngay sau khi DOM vừa render xong (đợi 1 khung hình
  // để trình duyệt tính layout thật trước khi đo scrollHeight/clientHeight)
  // — chạy ở MỌI chế độ (PC/Mobile/TV), không riêng TV Mode.
  requestAnimationFrame(()=>requestAnimationFrame(dhFitNextQueues));
}

// Đồng hồ realtime của Bảng Điều hành SX — cập nhật đúng 2 span, không vẽ
// lại cả bảng mỗi giây (updateTopbarClock() gọi hàm này mỗi giây sẵn có).
function dhTickClock(){
  const tEl = document.getElementById('dhClockTime');
  const dEl = document.getElementById('dhClockDate');
  if(!tEl && !dEl) return;
  const now = new Date();
  const cp = dhClockParts(now);
  if(tEl) tEl.innerHTML = cp.timeHTML;
  if(dEl && dEl.dataset.d !== vnDateDMY(now)){ dEl.innerHTML = cp.dateHTML; dEl.dataset.d = vnDateDMY(now); }
  const shiftEl = document.getElementById('dhShift'); if(shiftEl && shiftEl.dataset.k !== cp.key){ shiftEl.innerHTML = cp.shiftHTML; shiftEl.dataset.k = cp.key; }
  const boxEl = document.getElementById('dhClockBox'); if(boxEl) boxEl.dataset.shift = cp.key;
  const barEl = document.getElementById('dhShiftBar'); if(barEl) barEl.style.width = cp.pct + '%';
  const rtEl = document.getElementById('dhRuntimeClock'); if(rtEl) rtEl.textContent = dhRuntimeElapsedStr();
  const remEl = document.getElementById('dhRuntimeRemain'); if(remEl) remEl.textContent = dhRuntimeRemainStr();
}
