// src/modules/attendance/attendance-capture.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function captureAttendance(){if(guardViewer())return;
  const ym = curYM();
  captureAndShareElement('attCaptureArea', `Bang_cham_cong_${ym}.png`, `Bảng chấm công tháng ${ym}`);
}

function llvCapture(sheetId){if(guardViewer())return;
  const s = DB.lichLamViec.find(x=>x.id===sheetId); if(!s) return;
  const fname = (s.name||'bo_phan').replace(/\s+/g,'_');
  captureAndShareElement(`llvCaptureArea_${sheetId}`, `Lich_lam_viec_${fname}.png`, `Lịch làm việc ${s.name||''}`);
}
