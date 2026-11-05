// src/modules/attendance/attendance-view.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// CHẤM CÔNG & NHÂN SỰ
// Bảng chấm công tay theo ngày (giống bảng giấy/Excel) — không
// gắn với tài khoản đăng nhập. Tích/ghi điểm công thủ công,
// quản lý danh sách người lao động tự do, xuất Excel & in A4.
// ════════════════════════════════════════════════════════════
let _attYM = null;

function changeAttMonth(ym){ _attYM = ym; _attAutoFollow = (ym===todayStr().slice(0,7)); renderChamCong(); }
function shiftAttMonth(delta){
  const [y,m] = curYM().split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  _attYM = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  _attAutoFollow = (_attYM===todayStr().slice(0,7));
  renderChamCong();
}

function setCell(workerId, day, value){if(guardViewer())return;
  const ym = curYM();
  if(!DB.attendance[ym]) DB.attendance[ym] = {};
  if(!DB.attendance[ym][workerId]) DB.attendance[ym][workerId] = {};
  value = value.trim();
  const old = DB.attendance[ym][workerId][day]!==undefined ? DB.attendance[ym][workerId][day] : '';
  if(old===value) return;
  if(value==='') delete DB.attendance[ym][workerId][day];
  else DB.attendance[ym][workerId][day] = value;
  saveAttendance();
  const wName = DB.workers.find(w=>w.id===workerId)?.name || '(chưa có tên)';
  log('Chấm công', `${wName} · Ngày ${day}/${ym.split('-')[1]}/${ym.split('-')[0]}`, '',
    {công: old||'—'}, {công: value||'—'});
  // Cập nhật tổng công của dòng này không cần render lại cả bảng (giữ focus)
  const totalEl = document.getElementById('wkTotal_'+workerId);
  if(totalEl) totalEl.textContent = computeTotal(workerId);
}

// Chuyển 1 ô nhập công thành {cong, otHours}.
// Quy ước nhập: "1" = 1 công (8 giờ) · "0.5" = nửa công · "0" = nghỉ.
// Phần thập phân (sau dấu chấm, khi phần nguyên ≥1) được hiểu là SỐ GIỜ
// LÀM THÊM trong ngày đó, ví dụ "1.2" = 1 công + làm thêm 2 giờ.
// Nếu phần nguyên = 0 thì phần thập phân vẫn là phần lẻ công bình thường
// (ví dụ "0.5" = nửa công, không phải 5 giờ).
function parseCongValue(raw){
  if(raw===undefined||raw===null) return {cong:0, ot:0};
  const s = String(raw).trim().replace(',', '.');
  if(s==='') return {cong:0, ot:0};
  const m = s.match(/^(\d+)(?:\.(\d+))?$/);
  if(!m){ const n=parseFloat(s); return {cong:isNaN(n)?0:n, ot:0}; } // fallback giá trị lạ
  const intPart = parseInt(m[1], 10);
  const decStr = m[2] || '';
  if(decStr==='') return {cong:intPart, ot:0};
  if(intPart===0) return {cong:parseFloat('0.'+decStr), ot:0}; // phần lẻ công (vd 0.5 = nửa công)
  // Phần thập phân = số giờ làm thêm (1 chữ số thập phân ⇄ 1 chữ số giờ):
  // "1.2" → 2 giờ · "1.25" → 2.5 giờ (hỗ trợ làm thêm nửa giờ)
  const otHours = parseFloat('0.'+decStr) * 10;
  return {cong:intPart, ot:otHours};
}

// Tổng công của cả tháng: cộng dồn riêng số công và số giờ làm thêm của
// từng ngày, sau đó GIỜ LÀM THÊM ĐỦ 8 GIỜ sẽ được quy đổi thành 1 công.
// Ví dụ: ngày 1 chấm 1.2 (1 công + 2h thêm giờ), ngày 2 chấm 1.2 (1 công +
// 2h thêm giờ) ⇒ tổng = 2 công + 4 giờ thêm giờ ⇒ hiển thị "2.4" (chưa đủ
// 8h nên chưa quy đổi). Nếu giờ thêm giờ cộng dồn đủ/vượt 8h thì cứ mỗi 8h
// được +1 công, phần dư còn lại vẫn hiển thị là số giờ thêm giờ.
// Công thức DUY NHẤT tính tổng công từ dữ liệu thô 1 dòng chấm công
// ({ngày: giá trị nhập}) — dùng chung cho CẢ tab quản lý nhân sự (computeTotal)
// LẪN trang công khai quét mã QR (pubComputeTotal) để 2 nơi luôn ra cùng 1 kết
// quả. Trước đây trang công khai dùng công thức cộng dồn khác (chỉ parseFloat
// đơn giản, không quy đổi giờ làm thêm ≥8h thành công) nên bị lệch tổng công
// so với tab quản lý nhân sự (VD 28.6 công ở tab quản lý nhưng quét QR lại
// hiện 27.6 công vì thiếu 1 công quy đổi từ giờ làm thêm).
function computeCongTotalStr(rowData){
  let cong = 0, ot = 0;
  Object.values(rowData||{}).forEach(v=>{
    const p = parseCongValue(v);
    cong += p.cong;
    ot += p.ot;
  });
  // Quy đổi giờ làm thêm đủ 8h thành công, phần dư (<8h) giữ lại làm giờ thêm giờ
  const extraCong = Math.floor(ot/8 + 1e-9);
  let otRest = Math.round((ot - extraCong*8) * 10) / 10;
  if(otRest >= 8) { otRest = 0; } // an toàn, tránh sai số float
  cong += extraCong;
  cong = Math.round(cong*10)/10;
  if(otRest <= 0) return cong.toString();
  // Có giờ thêm giờ dư: ghép "phần công.giờ dư" theo đúng quy ước nhập ban đầu
  const congInt = Math.floor(cong + 1e-9);
  const congFrac = Math.round((cong - congInt) * 10) / 10; // phần lẻ công (nửa công) nếu có
  if(congFrac > 0){
    // Trường hợp hiếm: vừa có nửa công lẻ vừa có giờ thêm giờ dư → ghi rõ riêng
    return cong.toString() + ' +' + otRest + 'h';
  }
  const otDigit = otRest % 1 === 0 ? Math.round(otRest) : otRest;
  return congInt + '.' + otDigit;
}
function computeTotal(workerId){
  const ym = curYM();
  const rowData = DB.attendance[ym]?.[workerId] || {};
  return computeCongTotalStr(rowData);
}

// Tự động theo dõi tháng hiện tại theo thời gian thực: khi hết tháng (sang
// tháng mới, kể cả lúc đang mở app qua đêm) hệ thống sẽ:
//  1) Tự lưu/chốt lại toàn bộ bảng công của tháng vừa kết thúc.
//  2) Tự chuyển sang tháng mới với bảng công TRỐNG (chưa có ai chấm công)
//     để chấm lại từ đầu, không bị dính dữ liệu của tháng cũ.
let _attAutoFollow = true;
function maintainAttMonth(){
  const realYM = todayStr().slice(0,7);
  if(_attAutoFollow && _attYM!==realYM){
    const oldYM = _attYM;
    // Chốt sổ tháng cũ trước khi chuyển sang tháng mới
    if(oldYM && currentTab==='chamCong') saveAllAttendance(oldYM, true);
    else if(oldYM) saveAttendance();
    // Tháng mới luôn bắt đầu trống — chỉ tạo nếu chưa có để không đè dữ liệu
    // đã được chấm trước cho tháng đó (nếu có)
    if(!DB.attendance[realYM]) DB.attendance[realYM] = {};
    _attYM = realYM;
    if(currentTab==='chamCong') renderChamCong();
    else if(currentTab==='nhanSu') renderNhanSu();
  }
}
setInterval(maintainAttMonth, 30000);

// Lưu TOÀN BỘ bảng chấm công cùng lúc bằng 1 nút duy nhất: đọc lại mọi ô
// đang hiển thị trên màn hình rồi ghi vào DB + đồng bộ Firebase 1 lần,
// tránh phải bấm lưu riêng cho từng người và tránh sót dữ liệu khi mất
// focus ô nhập (onchange) lúc mạng chập chờn.
// silent=true: dùng khi hệ thống tự lưu lúc chuyển tháng, không hiện toast.
function saveAllAttendance(ymParam, silent){if(guardViewer())return;
  const ym = ymParam || curYM();
  if(!DB.attendance[ym]) DB.attendance[ym] = {};
  const nDays = daysInMonth(ym);
  DB.workers.forEach(w=>{
    if(!DB.attendance[ym][w.id]) DB.attendance[ym][w.id] = {};
    for(let day=1; day<=nDays; day++){
      const el = document.getElementById('cell_'+w.id+'_'+day);
      if(!el) return;
      const value = el.value.trim();
      if(value==='') delete DB.attendance[ym][w.id][day];
      else DB.attendance[ym][w.id][day] = value;
    }
    const totalEl = document.getElementById('wkTotal_'+w.id);
    if(totalEl) totalEl.textContent = computeTotal(w.id);
  });
  saveAttendance();
  if(!silent) showToast('✅ Đã lưu toàn bộ bảng chấm công tháng '+ym.split('-')[1]+'/'+ym.split('-')[0]);
  log(silent?'Tự chốt sổ chấm công':'Lưu chấm công', `Tháng ${ym.split('-')[1]}/${ym.split('-')[0]} · ${DB.workers.length} người lao động`, '');
}

// ─── state cho sub-tab nhân sự ───
function renderChamCong(){
  const ym = curYM();
  const [y,m] = ym.split('-').map(Number);
  const nDays = daysInMonth(ym);
  const admin = isAdmin();
  const viewer = isViewer();
  const monthData = DB.attendance[ym] || {};
  const dayCols = Array.from({length:nDays}, (_,i)=>i+1);
  const workers = DB.workers;
  const totalCong = workers.reduce((s,w)=>s + parseCongValNum(computeTotal(w.id)), 0);

  $('mc').innerHTML = `
    <!-- ── HEADER + THÁNG ── -->
    <div class="card" style="padding:12px 14px;margin-bottom:0">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Bảng chấm công tháng ${m}/${y}</div>
          <div style="font-size:20px;font-weight:800;color:var(--green);margin-top:2px">${totalCong.toFixed(1)} <span style="font-size:12px;font-weight:600;color:var(--text3)">tổng công · ${workers.length} người lao động</span></div>
        </div>
        <button class="chip" style="font-size:11.5px;padding:6px 12px;font-weight:700" onclick="goTab('nhanSu')" title="Xem hồ sơ, nghỉ phép, kỷ luật...">👥 Quản lý nhân sự →</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="chip" onclick="shiftAttMonth(-1)">←</button>
        <input type="month" class="field-inp" style="width:auto;flex:1;min-width:130px" value="${ym}" onchange="changeAttMonth(this.value)">
        <button class="chip" onclick="shiftAttMonth(1)">→</button>
        <button class="chip" onclick="changeAttMonth(todayStr().slice(0,7))">Tháng này</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        ${viewer?'':`
        <button class="set-btn" style="width:auto;padding:9px 16px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700" onclick="saveAllAttendance()">💾 Lưu chấm công</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="printAttendance('A4')">🖨️ In A4</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="printAttendance('A3')">🖨️ In A3</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="captureAttendance()">📷 Chụp ảnh gửi nhóm</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="exportAttendanceExcel()">⬇️ Xuất Excel</button>
        <button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px;background:var(--brand);color:#fff;font-weight:700" onclick="openCcllvQrModal()">🏷 Tạo mã QR xem Chấm công &amp; Lịch làm việc</button>
        ${admin?`<button class="set-btn" style="width:auto;padding:8px 14px;font-size:12.5px" onclick="addWorker()">➕ Thêm người lao động</button>`:''}
        `}
      </div>
    </div>
    <div class="card" style="padding:8px;overflow-x:auto;margin-top:8px">
      <div id="attCaptureArea" style="background:#fff;padding:6px">
      <div style="text-align:center;font-weight:700;font-size:14px;margin-bottom:6px;text-transform:uppercase">Bảng chấm công tháng ${m}/${y}</div>
      <table id="attTable" style="border-collapse:collapse;font-size:11.5px;white-space:nowrap">
        <thead>
          <tr>
            <th style="position:sticky;left:0;background:var(--card);border:1px solid var(--border);padding:5px 6px;min-width:24px">STT</th>
            <th style="position:sticky;left:24px;background:var(--card);border:1px solid var(--border);padding:5px 8px;min-width:140px;text-align:left">Họ và tên</th>
            <th style="border:1px solid var(--border);padding:5px 6px;min-width:90px">Bộ phận</th>
            ${dayCols.map(day=>`<th style="border:1px solid var(--border);padding:4px 2px;min-width:32px;text-align:center">
              <div style="font-size:12px;font-weight:700">${day}</div>
              <div style="font-weight:700;color:${weekdayVN(y,m,day)==='CN'?'var(--red-m)':'var(--brand2)'};font-size:9.5px;margin-top:1px">${weekdayVN(y,m,day)}</div>
            </th>`).join('')}
            <th style="border:1px solid var(--border);padding:5px 6px;min-width:50px;background:var(--green-l);color:var(--green)">Tổng công</th>
            ${admin?'<th style="border:1px solid var(--border);padding:5px 6px;min-width:30px"></th>':''}
          </tr>
        </thead>
        <tbody>
          ${workers.map((w,i)=>{
            const rowData = monthData[w.id] || {};
            return `<tr>
              <td style="position:sticky;left:0;background:var(--card);border:1px solid var(--border);padding:5px 6px;text-align:center">${i+1}</td>
              <td style="position:sticky;left:24px;background:var(--card);border:1px solid var(--border);padding:2px 4px">
                <input id="wkName_${w.id}" value="${w.name||''}" placeholder="Tên người lao động" ${admin?'':'readonly'} onchange="renameWorker('${w.id}', this.value)" style="width:130px;border:none;background:transparent;font-size:12px;font-family:inherit;padding:4px 2px;outline:none;color:var(--text)">
              </td>
              <td style="border:1px solid var(--border);padding:5px 6px;text-align:center">${llvDeptBadgeHtml(w.boPhan)}</td>
              ${dayCols.map(day=>{
                const v = rowData[day]!==undefined ? rowData[day] : '';
                return `<td style="border:1px solid var(--border);padding:0">
                  <input id="cell_${w.id}_${day}" value="${v}" inputmode="decimal" ${viewer?'readonly':''} onchange="setCell('${w.id}', ${day}, this.value)" style="width:30px;height:30px;border:none;background:transparent;text-align:center;font-size:11.5px;font-family:inherit;outline:none;color:var(--text)${viewer?';cursor:default':''}">
                </td>`;
              }).join('')}
              <td id="wkTotal_${w.id}" style="border:1px solid var(--border);padding:5px 6px;text-align:center;font-weight:700;background:var(--green-l);color:var(--green)">${computeTotal(w.id)}</td>
              ${admin?`<td style="border:1px solid var(--border);padding:2px;text-align:center"><button class="icon-btn del" onclick="deleteWorker('${w.id}')" style="font-size:12px">🗑</button></td>`:''}
            </tr>`;
          }).join('')}
          ${workers.length===0?`<tr><td colspan="${4+nDays}" style="padding:16px;text-align:center;color:var(--text4);border:1px solid var(--border)">Chưa có người lao động nào${admin?' · bấm "➕ Thêm người lao động" để bắt đầu':''}</td></tr>`:''}
        </tbody>
      </table>
      </div>
    </div>
    <div class="card" style="padding:12px 14px;margin-top:8px;font-size:12px;color:var(--text3);line-height:1.6">
      <b>Ghi chú cách chấm:</b> Đủ ngày công = <b>1</b> · Nửa ngày công = <b>0.5</b> · Không công = <b>0</b> · Làm thêm giờ ví dụ 2 tiếng ghi <b>1.2</b> (1 công 8h, .2 là 2h thêm). Đủ 8 giờ thêm giờ = +1 công.
    </div>
  `;
}
