// src/modules/dashboard/insights.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


function aiAnalyzeOrder(o){
  const now = Date.now();
  const s = o.status==='cutting'?'running':o.status;
  const warnings = []; // {level, tag, sev, icon, msg} — sev = độ nghiêm trọng, dùng để chọn dòng quan trọng nhất
  let score = 0;
  let urgencyTag = ''; // '' | 'normal' | 'warning' | 'critical' | 'overdue'

  // Ưu tiên cơ bản (GẤP 1 = điểm cao nhất)
  const priNum = parseInt((o.priority||'GẤP 9').replace('GẤP ',''));
  score += (9 - priNum) * 25;

  if(s === 'running' && o.startedAt){
    const hrs = (now - o.startedAt) / 3600000;
    const pct = o.qty&&o.doneQty ? o.doneQty/o.qty*100 : 0;
    const timeStr = fmtHrs(hrs);

    if(hrs >= 48){
      // Chạy hơn 2 ngày — cực kỳ nghiêm trọng
      warnings.push({level:'red', tag:'run', sev:500, icon:'🆘', msg:`Chạy ${timeStr} — PHẢI HOÀN THÀNH NGAY!`});
      score += 500;
      urgencyTag = 'critical';
    } else if(hrs >= 24){
      // Chạy hơn 1 ngày
      warnings.push({level:'red', tag:'run', sev:350, icon:'🚨', msg:`Chạy ${timeStr} — cần hoàn thiện gấp!`});
      score += 350;
      urgencyTag = 'critical';
    } else if(hrs >= 12){
      warnings.push({level:'red', tag:'run', sev:200, icon:'⛔', msg:`Chạy ${timeStr} — đã quá nửa ngày!`});
      score += 200;
      urgencyTag = 'warning';
    } else if(hrs >= 8){
      warnings.push({level:'red', tag:'run', sev:150, icon:'🚨', msg:`Chạy ${timeStr} — kiểm tra ngay!`});
      score += 150;
      urgencyTag = 'warning';
    } else if(hrs >= 4){
      warnings.push({level:'amber', tag:'run', sev:70, icon:'⏱', msg:`Chạy ${timeStr} — theo dõi tiến độ`});
      score += 70;
      urgencyTag = 'normal';
    } else if(hrs >= 2){
      score += 25;
    }

    // Tiến độ cực chậm
    if(hrs >= 4 && pct < 10 && o.qty > 0){
      warnings.push({level:'red', tag:'progress', sev:90, icon:'📉', msg:`Tiến độ chỉ ${Math.round(pct)}% sau ${timeStr} — rất chậm!`});
      score += 80;
    } else if(hrs >= 2 && pct < 25 && o.qty > 0){
      warnings.push({level:'amber', tag:'progress', sev:40, icon:'📉', msg:`Tiến độ ${Math.round(pct)}% sau ${timeStr}`});
      score += 35;
    }
  }

  if(s !== 'done' && o.deliveryDate){
    const daysLeft = (new Date(o.deliveryDate) - now) / 86400000;
    if(daysLeft < 0){
      const overDays = Math.abs(Math.floor(daysLeft));
      // Trễ càng lâu → điểm leo thang, đẩy đơn lên đầu hàng đợi càng mạnh
      warnings.push({level:'red', tag:'deadline', sev:600+overDays*10, icon:'🔥', msg:`Trễ ${overDays>0?overDays+' ngày':'hôm nay'}!`});
      score += 300 + overDays*15;
      urgencyTag = 'overdue';
    } else if(daysLeft < 1){
      warnings.push({level:'red', tag:'deadline', sev:260, icon:'🔴', msg:`Hạn giao HÔM NAY`});
      score += 180;
    } else if(daysLeft < 2){
      warnings.push({level:'amber', tag:'deadline', sev:90, icon:'🟡', msg:`Hạn giao ngày mai`});
      score += 80;
    } else if(daysLeft <= 3){
      score += 25;
    }
  }

  // Combo nguy cấp: vừa trễ/gần hạn vừa chạy quá lâu → AI cộng điểm gấp bội
  // để đẩy đơn này vượt hẳn lên trên, bất kể đang ở cấp GẤP nào
  const hasDeadlineCrit = warnings.some(w=>w.tag==='deadline'&&w.level==='red');
  const hasRunCrit = warnings.some(w=>w.tag==='run'&&w.level==='red');
  if(hasDeadlineCrit && hasRunCrit){ score += 150; urgencyTag = 'overdue'; }

  // Sắp xếp cảnh báo theo độ nghiêm trọng — mục nào nguy cấp nhất lên đầu
  warnings.sort((a,b)=>b.sev-a.sev);

  // Gộp tối đa 2 tín hiệu nguy cấp nhất thành ĐÚNG 1 DÒNG gọn gàng cho mỗi đơn
  // (thay vì hiện từng cảnh báo riêng lẻ gây rối mắt)
  let oneLine = null;
  if(warnings.length){
    const top = warnings.slice(0,2);
    const level = top[0].level;
    const icon = top[0].icon;
    const parts = top.map(w=>w.msg.replace(/[!]+$/,''));
    const bang = top.some(w=>w.msg.endsWith('!'));
    oneLine = { level, icon, msg: parts.join(' · ') + (bang?'!':'') };
  }

  // Đơn thật sự khẩn cấp (quá hạn / hạn hôm nay / chạy quá lâu) — AI cho phép
  // "vượt cấp" hiển thị lên đầu danh sách chờ xử lý, bất kể mức GẤP gốc
  const critical = urgencyTag==='overdue' || urgencyTag==='critical' ||
    warnings.some(w=>w.tag==='deadline'&&w.level==='red');

  return { warnings, score, urgencyTag, oneLine, critical };
}

// AI tổng hợp insights — phân loại nghiêm trọng → nhẹ
function aiGetInsights(orders){
  const now = Date.now();
  const insights = [];
  const running = orders.filter(o=>o.status==='running'||o.status==='cutting');
  const pending = orders.filter(o=>o.status==='pending');

  // Cực nghiêm trọng: chạy hơn 24h
  const veryLong = running.filter(o=>o.startedAt&&(now-o.startedAt)>=86400000);
  if(veryLong.length){
    veryLong.forEach(o=>{
      const hrs=(now-o.startedAt)/3600000;
      insights.push({icon:'🆘',level:'critical',
        text:`<b>${o.customer}</b> chạy <b>${fmtHrs(hrs)}</b> — ${o.priority||''} · PHẢI HOÀN THIỆN NGAY!`});
    });
  }

  // Nghiêm trọng: chạy 8–24h
  const longRun = running.filter(o=>o.startedAt&&(now-o.startedAt)>=28800000&&(now-o.startedAt)<86400000);
  if(longRun.length){
    longRun.forEach(o=>{
      const hrs=(now-o.startedAt)/3600000;
      insights.push({icon:'🚨',level:'warning',
        text:`<b>${o.customer}</b> chạy <b>${fmtHrs(hrs)}</b> — ${o.priority||''} · cần hoàn thiện gấp`});
    });
  }

  // Quá hạn giao — dùng CHUNG ddOverdue() (so với đầu ngày, không phải so
  // với giờ hiện tại) để khớp đúng với số liệu ở tab Đơn Hàng/Kế hoạch SX
  const overdue=orders.filter(ddOverdue);
  if(overdue.length){
    insights.push({icon:'🔥',level:'critical',
      text:`<b>${overdue.length} đơn quá hạn giao hàng</b>: ${overdue.slice(0,3).map(o=>`<b>${o.customer}</b>`).join(', ')}`});
  }

  // Hạn giao hôm nay/ngày mai
  const soon=orders.filter(o=>{
    if(o.status==='done'||!o.deliveryDate) return false;
    const d=(new Date(o.deliveryDate)-now)/86400000; return d>=0&&d<2;
  });
  if(soon.length){
    insights.push({icon:'🔔',level:'warning',
      text:`<b>${soon.length} đơn</b> hạn giao trong 2 ngày: ${soon.map(o=>`<b>${o.customer}</b>`).join(', ')}`});
  }

  // Gợi ý bắt đầu đơn tiếp theo
  if(!running.length&&pending.length){
    const next=pending.sort((a,b)=>parseInt((a.priority||'GẤP 9').replace('GẤP ',''))-parseInt((b.priority||'GẤP 9').replace('GẤP ','')))[0];
    insights.push({icon:'💡',level:'info',
      text:`Không có đơn đang chạy — hãy bắt đầu <b>${next.customer}</b> (${next.priority||''})`});
  }

  if(!insights.length&&running.length){
    insights.push({icon:'✅',level:'ok',
      text:`<b>${running.length} đơn đang chạy</b> đúng tiến độ — hiệu suất tốt!`});
  }

  return insights.slice(0,5);
}
