// src/modules/ai/ai-commands.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── Bỏ các từ ra lệnh/hư từ, giữ lại phần được cho là TÊN KHÁCH HÀNG /
// TỪ KHOÁ TÌM KIẾM. So khớp theo từng từ (không phân biệt dấu) để hoạt
// động tốt dù người dùng gõ trước/sau các cụm ra lệnh.
const AI_STOPWORDS = new Set([
  'hay','vui','long','giup','giups','gium','lam','on','xin','chao','toi','minh','ban',
  'dua','nang','day','chuyen','de','dat','sua','doi','ha','giam','tang','keo','vao',
  'don','hang','cua','cho','len','xuong','ve','thanh','ho','ngay','gap','khan',
  'muc','uu','tien','xem','tim','tra','cuu','tracuu','kiem','kiemtra','search',
  'danh','sach','khach','tat','ca','tong','quan','1','2','3','duoc','di','nhe',
  'bat','dau','chay','dang','san','xuat','hoan','xong','roi','het','ket','thuc',
  'da','cap','nhat','tien do','tiendo','so','thanhtien','ghi','chu','note',
  'qua','han','sap','toi','giao','baocao','hom','nay','tinh','hinh','thong','bao'
]);
function aiExtractSubject(text, normText){
  const words = String(text||'').split(/\s+/).filter(Boolean);
  const normWords = String(normText||'').split(/\s+/).filter(Boolean);
  const kept = [];
  for(let i=0;i<words.length;i++){
    const raw = (normWords[i]||'').replace(/[^a-z0-9]/gi,'');
    if(!raw) continue;
    if(AI_STOPWORDS.has(raw)) continue;
    if(/^\d+$/.test(raw)) continue; // bỏ số lẻ (mức ưu tiên, số lượng...)
    kept.push(words[i]);
  }
  return kept.join(' ').trim().replace(/^["'“”]+|["'“”]+$/g,'');
}

// ── Tìm đơn theo tên khách hàng (hoặc đúng mã PO/mã đơn nếu gõ chính xác) ──
// activeOnly=true: chỉ lấy đơn chưa hoàn thành (dùng cho đổi ưu tiên/trạng thái/tiến độ/ghi chú)
function aiFindOrders(subject, activeOnly){
  const qNorm = _stripDiacritics(String(subject||'').toLowerCase()).trim();
  if(!qNorm) return [];
  // Ưu tiên khớp đúng mã PO / mã đơn (để xử lý khi có nhiều đơn trùng tên khách)
  const byCode = DB.orders.filter(o=>{
    if(activeOnly && o.status==='done') return false;
    return _stripDiacritics(String(ddCode(o)||'').toLowerCase())===qNorm
        || _stripDiacritics(String(o.po||'').toLowerCase())===qNorm;
  });
  if(byCode.length) return byCode;
  const tokens = qNorm.split(/\s+/).filter(Boolean);
  return DB.orders.filter(o=>{
    if(activeOnly && o.status==='done') return false;
    const custNorm = _stripDiacritics(String(o.customer||'').toLowerCase());
    return tokens.every(t=>custNorm.includes(t));
  });
}

// Danh sách rút gọn khi lệnh khớp nhiều hơn 1 đơn — để Admin chọn lại bằng mã PO/mã đơn
function aiAmbiguousList(matches, hintVerb){
  const html = matches.slice(0,10).map(o=>{
    const pc = priColor(o.priority);
    return `<div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(o.customer||'—')}</b> · <code>${chatEsc(ddCode(o))}</code><br>
        <span style="color:${pc}">🚩 ${chatEsc(o.priority||'—')}</span> · ${chatEsc(statusInfo(o.status).label||'')} · ${chatEsc(specStr(o))}</div>
      <button class="ai-result-view-btn" onclick="aiGoToOrder('${o.id}')">Xem</button>
    </div>`;
  }).join('');
  return {
    text:`⚠️ Có ${matches.length} đơn khớp, bạn cho em biết đơn nào bằng cách gõ lại lệnh kèm mã đơn (VD: ${hintVerb||''} ${chatEsc(ddCode(matches[0]))})`,
    html:`<div class="ai-result-list">${html}</div>`
  };
}

// ── Ý định: đổi mức ưu tiên đơn hàng theo tên khách hàng (áp dụng cho TẤT CẢ
// đơn đang chạy của khách đó — vì đây vốn là thao tác hàng loạt hợp lý) ──
function aiHandlePriorityChange(text, normText){
  const m = normText.match(/\b(?:gap|khan)\s*([1-3])\b/);
  if(!m) return null;
  const targetPri = 'GẤP '+m[1];
  const subject = aiResolveSubject(text, normText);
  if(!subject){
    return {text:`Bạn muốn chuyển đơn của khách hàng nào lên ${targetPri}? Hãy gõ ví dụ: "Đưa đơn Á Châu lên ${targetPri}".`};
  }
  const matches = aiFindOrders(subject, true);
  if(!matches.length){
    return {text:`❌ Không tìm thấy đơn nào đang chạy của khách hàng "${subject}". Bạn kiểm tra lại tên khách hàng giúp em nhé.`};
  }
  aiRememberOrders(matches);
  const changed = [];
  matches.forEach(o=>{
    if(o.priority===targetPri) return;
    changed.push({customer:o.customer, id:o.id, po:o.po, from:o.priority||'—', to:targetPri});
    o.priority = targetPri;
  });
  if(!changed.length){
    return {text:`ℹ️ ${matches.length} đơn của "${subject}" đang chạy đã ở mức ${targetPri} rồi, không cần đổi thêm.`};
  }
  changed.forEach(c=>{
    log('AI Trợ lý - Đổi ưu tiên', `${c.customer} · ${c.from} → ${c.to}`, c.id, {priority:c.from}, {priority:c.to});
  });
  addNotif('system', `🤖 AI Trợ lý nâng ưu tiên → ${targetPri}`,
    `${[...new Set(changed.map(c=>c.customer))].join(', ')} được chuyển sang ${targetPri}`,
    'keHoach', currentUser?.name);
  saveOrders();
  renderTab(currentTab);
  updateBadges();
  showToast(`✅ Đã chuyển ${changed.length} đơn sang ${targetPri}`);
  const html = changed.map(c=>`<div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(c.customer||'—')}</b>${c.po?' · PO '+chatEsc(c.po):''}<br>${chatEsc(c.from)} → <b style="color:${PRI_COLOR[targetPri]||'#7c3aed'}">${chatEsc(c.to)}</b></div>
      <button class="ai-result-view-btn" onclick="aiGoToOrder('${c.id}')">Xem</button>
    </div>`).join('');
  return {
    text:`✅ Đã chuyển ${changed.length} đơn của "${subject}" sang ${targetPri}:`,
    html:`<div class="ai-result-list">${html}</div>`
  };
}

// ── Ý định: đổi trạng thái đơn (đang chạy / hoàn thành / chờ sản xuất) ──
// Với thao tác này chỉ áp dụng khi khớp DUY NHẤT 1 đơn, tránh đổi nhầm hàng
// loạt khi khách có nhiều đơn khác nhau đang chạy.
function aiHandleStatusChange(text, normText){
  let target = null, verb = '';
  if(/\b(hoan thanh|da xong|xong roi|xong het|ket thuc)\b/.test(normText)){ target='done'; verb='hoàn thành'; }
  else if(/\b(bat dau chay|cho chay|dang chay|vao chay|chay ngay|chay lien|chay het)\b/.test(normText)
     || /\b(cho|bat dau|dang|vao)\b.{0,15}\bchay\b/.test(normText)){ target='running'; verb='cho chạy'; }
  else if(/\b(cho san xuat lai|tro lai cho|huy chay|dung chay)\b/.test(normText)){ target='pending'; verb='chuyển về chờ'; }
  if(!target) return null;
  const subject = aiResolveSubject(text, normText);
  if(!subject){
    return {text:`Bạn muốn ${verb} đơn của khách hàng nào? VD: "${verb==='hoàn thành'?'Hoàn thành':'Cho'} đơn Á Châu ${verb==='hoàn thành'?'':'chạy'}".`};
  }
  const matches = aiFindOrders(subject, target!=='pending').filter(o=>o.status!==target);
  if(!matches.length){
    return {text:`❌ Không tìm thấy đơn phù hợp của "${subject}" để ${verb} (có thể đã ở đúng trạng thái này rồi, hoặc sai tên khách).`};
  }
  if(matches.length>1) return aiAmbiguousList(matches, verb+' đơn');
  const o = matches[0];
  aiRememberOrder(o);
  const before = statusInfo(o.status).label;
  setStatus(o.id, target);
  return {text:`✅ Đã chuyển đơn ${chatEsc(o.customer)} (${chatEsc(ddCode(o))}) từ "${chatEsc(before)}" sang "${chatEsc(statusInfo(target).label)}".`};
}

// ── Ý định: cập nhật tiến độ (số lượng đã chạy) ──
function aiHandleProgress(text, normText){
  const m = normText.match(/\b(?:da chay|chay duoc|chay het|tien do)\D{0,10}(\d+)\b/) || normText.match(/\b(\d+)\s*(?:thanh|cay|cuon)\b/);
  if(!m) return null;
  const doneQty = parseInt(m[1], 10);
  const subject = aiResolveSubject(text, normText);
  if(!subject){
    return {text:'Bạn muốn cập nhật tiến độ cho đơn của khách hàng nào? VD: "Đơn Á Châu đã chạy 50 thanh".'};
  }
  const matches = aiFindOrders(subject, true);
  if(!matches.length){
    return {text:`❌ Không tìm thấy đơn đang chạy của "${subject}".`};
  }
  if(matches.length>1) return aiAmbiguousList(matches, 'Cập nhật tiến độ đơn');
  const o = matches[0];
  aiRememberOrder(o);
  const total = o.qty||0;
  if(total && doneQty>total){
    return {text:`❌ Số lượng đã chạy (${doneQty}) không thể lớn hơn tổng đơn (${total}).`};
  }
  const oldQty = o.doneQty||0;
  o.doneQty = doneQty;
  log('AI Trợ lý - Cập nhật tiến độ', `${o.customer} · Đã chạy: ${doneQty}/${total} `, o.id, {doneQty:oldQty}, {doneQty});
  saveOrders();
  renderTab(currentTab);
  refreshKhDetailIfOpen(o.id);
  showToast(`✅ Đã lưu tiến độ: ${doneQty}/${total||'?'}`);
  return {text:`✅ Đã cập nhật tiến độ đơn ${chatEsc(o.customer)} (${chatEsc(ddCode(o))}): ${doneQty}${total?'/'+total:''}.`};
}

// ── Ý định: ghi chú đơn hàng — cú pháp "Ghi chú đơn [khách]: [nội dung]" ──
function aiHandleNote(text, normText){
  if(!/\bghi\s*chu\b|\bnote\b/.test(normText)) return null;
  const colonIdx = text.indexOf(':');
  if(colonIdx===-1){
    return {text:'Bạn ghi chú theo cú pháp: "Ghi chú đơn [tên khách]: [nội dung]".'};
  }
  const before = text.slice(0,colonIdx);
  const noteContent = text.slice(colonIdx+1).trim();
  const beforeNorm = _stripDiacritics(before.toLowerCase());
  const subject = aiResolveSubject(before, beforeNorm);
  if(!subject || !noteContent){
    return {text:'Bạn ghi chú theo cú pháp: "Ghi chú đơn [tên khách]: [nội dung]".'};
  }
  const matches = aiFindOrders(subject, true);
  if(!matches.length) return {text:`❌ Không tìm thấy đơn đang chạy của "${subject}".`};
  if(matches.length>1) return aiAmbiguousList(matches, 'Ghi chú đơn');
  const o = matches[0];
  aiRememberOrder(o);
  const oldNote = o.note||'';
  o.note = noteContent;
  log('AI Trợ lý - Ghi chú', `${o.customer} · ${noteContent}`, o.id, {note:oldNote}, {note:noteContent});
  saveOrders();
  renderTab(currentTab);
  showToast('✅ Đã lưu ghi chú');
  return {text:`✅ Đã ghi chú cho đơn ${chatEsc(o.customer)} (${chatEsc(ddCode(o))}): "${chatEsc(noteContent)}"`};
}

// ── Ý định: liệt kê khách hàng đang có đơn chạy ──
function aiHandleCustomerList(normText){
  if(!/\b(danh sach|danhsach).*khach|khach hang.*danh sach/.test(normText) && normText.trim()!=='khach hang') return null;
  const active = DB.orders.filter(o=>o.status!=='done');
  if(!active.length) return {text:'Hiện không có đơn hàng nào đang chạy.'};
  const byCust = {};
  active.forEach(o=>{
    const k = o.customer||'—';
    if(!byCust[k]) byCust[k] = {count:0, minPri:9};
    byCust[k].count++;
    const p = parseInt((o.priority||'GẤP 9').replace('GẤP ',''))||9;
    if(p<byCust[k].minPri) byCust[k].minPri = p;
  });
  const rows = Object.entries(byCust).sort((a,b)=>a[1].minPri-b[1].minPri || b[1].count-a[1].count);
  const html = rows.map(([cust,info])=>{
    const pri = 'GẤP '+(info.minPri>3?'3':info.minPri);
    const pc = priColor(pri);
    return `<div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(cust)}</b><br>${info.count} đơn đang chạy · <span style="color:${pc}">ưu tiên cao nhất ${chatEsc(pri)}</span></div>
      <button class="ai-result-view-btn" onclick="aiFillPrompt('Tìm đơn ${chatEsc(cust)}')">Xem</button>
    </div>`;
  }).join('');
  return {
    text:`📋 Có ${rows.length} khách hàng đang có đơn chạy:`,
    html:`<div class="ai-result-list">${html}</div>`
  };
}

// ── Ý định: báo cáo đơn quá hạn / sắp tới hạn giao ──
function aiHandleDeadlineReport(normText){
  const now = new Date();
  const isOverdueQ = /\b(don|nao).*qua han|qua han giao|tre han/.test(normText) || normText.includes('qua han');
  const isUpcomingQ = /sap toi han|sap den han|sap giao/.test(normText);
  if(!isOverdueQ && !isUpcomingQ) return null;
  let list, title;
  if(isOverdueQ){
    list = DB.orders.filter(o=>o.status!=='done'&&o.deliveryDate&&new Date(o.deliveryDate)<now);
    title = `⚠️ Có ${list.length} đơn đã quá hạn giao:`;
  } else {
    list = DB.orders.filter(o=>{
      if(o.status==='done'||!o.deliveryDate) return false;
      const d=(new Date(o.deliveryDate)-now)/86400000; return d>=0&&d<2;
    });
    title = `⏰ Có ${list.length} đơn sắp tới hạn giao (trong 48h):`;
  }
  if(!list.length){
    return {text: isOverdueQ ? '✅ Hiện không có đơn nào quá hạn giao.' : '✅ Không có đơn nào sắp tới hạn trong 48h tới.'};
  }
  const html = list.slice(0,15).map(o=>{
    const pc = priColor(o.priority);
    return `<div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(o.customer||'—')}</b> · <code>${chatEsc(ddCode(o))}</code><br>
        <span style="color:${pc}">🚩 ${chatEsc(o.priority||'—')}</span> · 📅 ${chatEsc(fmtDate(o.deliveryDate))}</div>
      <button class="ai-result-view-btn" onclick="aiGoToOrder('${o.id}')">Xem</button>
    </div>`;
  }).join('');
  return { text: title, html: `<div class="ai-result-list">${html}</div>` };
}

// ── Ý định: báo cáo nhanh / "Hôm nay có gì cần làm?" — AI tự tổng hợp và
// suy luận rủi ro từ TẤT CẢ các mảng dữ liệu: đơn hàng, máy móc, nhân sự ──
function aiHandleQuickReport(normText){
  if(!/\b(bao cao|tinh hinh).*hom nay|hom nay.*(bao cao|tinh hinh|co gi|can lam)|tong quan|viec can lam|can uu tien|can xu ly/.test(normText)) return null;
  const orders = DB.orders;
  const pending = orders.filter(o=>o.status==='pending').length;
  const running = orders.filter(o=>o.status==='running'||o.status==='cutting').length;
  const doneToday = orders.filter(o=>o.status==='done' && o.doneAt && new Date(o.doneAt).toDateString()===new Date().toDateString()).length;
  const overdueList = orders.filter(o=>o.status!=='done'&&o.deliveryDate&&new Date(o.deliveryDate)<new Date());
  const upcomingList = orders.filter(o=>{
    if(o.status==='done'||!o.deliveryDate) return false;
    const d=(new Date(o.deliveryDate)-new Date())/86400000; return d>=0&&d<2;
  });
  const newToday = orders.filter(o=>o.createdAt && new Date(o.createdAt).toDateString()===new Date().toDateString()).length;
  const brokenMachines = (typeof MACHINES!=='undefined'?MACHINES:[]).filter(m=>machineStatus(m.id)==='hong');
  const maintMachines = (typeof MACHINES!=='undefined'?MACHINES:[]).filter(m=>machineStatus(m.id)==='baotri');
  const pendingLeave = (DB.nghiPhep||[]).filter(k=>k.status==='Chờ duyệt');
  const workerCount = (DB.workers||[]).length;
  const today = todayStr ? todayStr() : new Date().toISOString().slice(0,10);
  const onLeaveToday = (DB.nghiPhep||[]).filter(k=>k.status==='Đã duyệt' && (k.fromDate||'')<=today && today<=(k.toDate||''));

  const lines = [];
  lines.push(`📊 *Tổng quan hôm nay:*`);
  lines.push(`• Đơn mới: ${newToday} · Chờ sản xuất: ${pending} · Đang chạy: ${running} · Hoàn thành hôm nay: ${doneToday}`);
  lines.push(overdueList.length ? `⚠️ Có ${overdueList.length} đơn ĐÃ QUÁ HẠN giao — cần ưu tiên xử lý ngay!` : `✅ Không có đơn quá hạn.`);
  if(upcomingList.length) lines.push(`⏰ ${upcomingList.length} đơn sắp tới hạn giao trong 48h tới.`);
  if(brokenMachines.length) lines.push(`🔴 ${brokenMachines.length} máy đang hỏng: ${brokenMachines.map(m=>m.name).join(', ')} — có thể ảnh hưởng tiến độ sản xuất.`);
  if(maintMachines.length) lines.push(`🟡 ${maintMachines.length} máy đang bảo trì: ${maintMachines.map(m=>m.name).join(', ')}.`);
  if(pendingLeave.length) lines.push(`📝 ${pendingLeave.length} đơn nghỉ phép đang chờ duyệt.`);
  if(onLeaveToday.length) lines.push(`🏖️ ${onLeaveToday.length}/${workerCount} người lao động đang nghỉ phép hôm nay — kiểm tra xem có thiếu nhân lực không.`);

  // Đề xuất hành động ưu tiên, theo mức độ rủi ro
  const actions = [];
  if(overdueList.length) actions.push(`Xử lý ngay ${overdueList.length} đơn quá hạn (gõ "đơn quá hạn" để xem danh sách)`);
  if(brokenMachines.length) actions.push(`Kiểm tra/sửa máy đang hỏng để không chặn tiến độ sản xuất`);
  if(pendingLeave.length) actions.push(`Duyệt các đơn nghỉ phép đang chờ (mở Quản lý nhân sự)`);
  if(upcomingList.length) actions.push(`Ưu tiên chạy các đơn sắp tới hạn (gõ "đơn sắp tới hạn")`);
  if(!actions.length) actions.push('Chưa phát hiện vấn đề khẩn cấp — mọi thứ đang ổn 👍');

  lines.push(`\n👉 *Đề xuất ưu tiên hôm nay:*\n` + actions.map((a,i)=>`${i+1}. ${a}`).join('\n'));

  return { text: lines.join('\n') };
}

// ── Ý định: tình trạng máy móc / bảo trì ──
function aiHandleMachineStatus(normText){
  if(typeof MACHINES==='undefined') return null;
  if(!/\bmay\b.*\b(hong|bao tri|the nao|tinh trang|sao roi)\b|\bnhac bao tri\b|\btinh trang may\b/.test(normText)) return null;
  const broken = MACHINES.filter(m=>machineStatus(m.id)==='hong');
  const maint  = MACHINES.filter(m=>machineStatus(m.id)==='baotri');
  const due = MACHINES.filter(m=>{
    const st = getMaintTonState(m.id); return st && (st.level==='due'||st.level==='warn');
  });
  if(!broken.length && !maint.length && !due.length){
    return {text:'✅ Tất cả máy đang hoạt động tốt, chưa có máy nào cần bảo trì gấp.'};
  }
  const cards = [];
  broken.forEach(m=>cards.push({m, tag:'🔴 Đang hỏng'}));
  maint.forEach(m=>cards.push({m, tag:'🟡 Đang bảo trì'}));
  due.forEach(m=>{
    if(!broken.includes(m) && !maint.includes(m)){
      const st = getMaintTonState(m.id);
      cards.push({m, tag: st.level==='due' ? `🔧 Cần thay ${st.info.partName} (đã ${st.tonNow} ${st.info.unit})` : `⚠️ Sắp tới hạn thay ${st.info.partName} (${st.tonNow} ${st.info.unit})`});
    }
  });
  const html = cards.map(c=>`<div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(c.m.name)}</b><br>${chatEsc(c.tag)}</div>
      <button class="ai-result-view-btn" onclick="closeAiChatWindow();goTab('baoTriMay');btmSelectMachine('${c.m.id}')">Xem</button>
    </div>`).join('');
  return {
    text: `🛠️ Có ${cards.length} máy cần chú ý:`,
    html: `<div class="ai-result-list">${html}</div>`
  };
}

// ── Ý định: nghỉ phép / nhân sự ──
function aiHandleLeaveList(normText){
  if(!/\bnghi phep\b|\bai dang nghi\b|\bcho duyet\b.*nghi/.test(normText)) return null;
  const wantPending = /cho duyet/.test(normText);
  const today = todayStr ? todayStr() : new Date().toISOString().slice(0,10);
  let list, title;
  if(wantPending){
    list = (DB.nghiPhep||[]).filter(k=>k.status==='Chờ duyệt');
    title = `📝 Có ${list.length} đơn nghỉ phép đang chờ duyệt:`;
  } else {
    list = (DB.nghiPhep||[]).filter(k=>k.status==='Đã duyệt' && (k.fromDate||'')<=today && today<=(k.toDate||''));
    title = `🏖️ Có ${list.length} người đang nghỉ phép hôm nay:`;
  }
  if(!list.length) return {text: wantPending ? '✅ Không có đơn nghỉ phép nào đang chờ duyệt.' : '✅ Hôm nay không có ai nghỉ phép.'};
  const html = list.slice(0,15).map(k=>`<div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(k.workerName||'—')}</b><br>${chatEsc(k.loai||'Nghỉ phép')} · ${chatEsc(k.fromDate||'')} → ${chatEsc(k.toDate||'')}${k.lydo?' · '+chatEsc(k.lydo):''}</div>
      <button class="ai-result-view-btn" onclick="closeAiChatWindow();goTab('nhanSu')">Xem</button>
    </div>`).join('');
  return { text: title, html: `<div class="ai-result-list">${html}</div>` };
}

// ── Ý định: điều hướng nhanh tới 1 màn hình/chức năng bằng lời nói ──
const AI_NAV_MAP = [
  {tab:'dashboard', re:/\bmo\b.*(dashboard|tong quan|trang chu)/},
  {tab:'dorDang', re:/\bmo\b.*(don dang lam|don hang|quan ly don)/},
  {tab:'keHoach', re:/\bmo\b.*(ke hoach)/},
  {tab:'hoanThanh', re:/\bmo\b.*(don hoan thanh|hoan thanh)/},
  {tab:'baoCao', re:/\bmo\b.*(bao cao)/},
  {tab:'nhanSu', re:/\bmo\b.*(nhan su|danh sach nhan vien|ky luat|nghi phep)/},
  {tab:'chamCong', re:/\bmo\b.*(cham cong)/},
  {tab:'baoTriMay', re:/\bmo\b.*(bao tri|may moc)/},
  {tab:'lichLamViec', re:/\bmo\b.*(lich lam viec|lich phan cong)/},
  {tab:'nhatKy', re:/\bmo\b.*(nhat ky)/},
  {tab:'qrCode', re:/\bmo\b.*(qr|ma qr)/},
  {tab:'settings', re:/\bmo\b.*(cai dat)/},
];
function aiHandleNavigate(normText){
  const hit = AI_NAV_MAP.find(x=>x.re.test(normText));
  if(!hit) return null;
  const titles = {dashboard:'Tổng quan',dorDang:'Đơn Hàng',keHoach:'Kế hoạch SX',hoanThanh:'Đơn hoàn thành',baoCao:'Báo cáo',nhanSu:'Quản lý nhân sự',chamCong:'Chấm công',baoTriMay:'Bảo trì máy',lichLamViec:'Lịch làm việc',nhatKy:'Nhật ký thao tác',settings:'Cài đặt',qrCode:'Quản lý mã QR'};
  closeAiChatWindow();
  goTab(hit.tab);
  return {text:`✅ Đã mở "${titles[hit.tab]||hit.tab}" cho bạn.`};
}

// ── Ý định: tạo đơn hàng mới bằng hội thoại nhiều lượt — AI hỏi lần lượt
// những thông tin còn thiếu rồi tự tạo, không cần Admin tự mở form ──
const AI_CREATE_STEPS = [
  {key:'customer', ask:'Bạn cho em tên khách hàng của đơn mới nhé?'},
  {key:'dims', ask:'Thông số đơn: dày x rộng x dài (mm) và số lượng thanh là bao nhiêu? (VD: "3x100x4000, 200 thanh". Nếu là hàng tròn/cuộn, gõ ví dụ "phi 18, 50 cây")'},
  {key:'priority', ask:'Mức ưu tiên đơn này là gì? (GẤP 1 / GẤP 2 / GẤP 3 — hoặc gõ "bỏ qua" để mặc định GẤP 1)'},
  {key:'deliveryDate', ask:'Hạn giao hàng là ngày nào? (VD: 2026-08-15 — hoặc gõ "bỏ qua" nếu chưa rõ)'}
];
function aiStartCreateOrder(){
  aiCtx.pending = {intent:'create_order', data:{}, stepIdx:0};
  return {text: `Ok, mình tạo đơn hàng mới nhé 📦\n${AI_CREATE_STEPS[0].ask}`};
}
function aiParseDims(raw){
  const norm = _stripDiacritics(raw.toLowerCase());
  const phiM = norm.match(/phi\s*(\d+(?:\.\d+)?)/);
  const qtyM = norm.match(/(\d+)\s*(?:thanh|cay|cuon)\b/) || norm.match(/(\d+)\s*(?:cai|chiec)?\s*$/);
  if(phiM){
    return {isRound:true, phi:parseFloat(phiM[1]), qty: qtyM?parseInt(qtyM[1]):0};
  }
  const dimM = raw.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if(dimM){
    return {thickness:parseFloat(dimM[1]), width:parseFloat(dimM[2]), length:parseFloat(dimM[3]), qty: qtyM?parseInt(qtyM[1]):0};
  }
  return null;
}
// Tạo đơn hàng thật trong DB (không cần mở form) — dùng chung logic với saveOrder()
function aiCreateOrder(d){
  if(!canCreateOrder()) throw new Error('Chỉ Admin mới có quyền tạo đơn hàng');
  const phi = d.phi||0;
  const t = d.thickness||0;
  const w = d.width||0;
  const l = d.length||4000;
  const qty = d.qty||0;
  let kg = 0;
  if(phi&&l&&qty) kg=parseFloat((phi*phi*l*7/1000000*qty).toFixed(3));
  else if(t&&w&&l&&qty) kg=parseFloat((t*w*l*CU_DENSITY/1000000*qty).toFixed(3));
  const isRound = phi>0;
  const data = {
    customer:d.customer, po:'', type:'',
    material:'B*', thickness:t, width:w, length:l, qty, kg,
    phi:isRound?phi:0, isRound, isCoil:false, meterPerCoil:0, totalMeters:0,
    priority:d.priority||'GẤP 1', deliveryDate:d.deliveryDate||'',
    address:'', note:'Tạo qua AI Copilot'
  };
  const newId = uid();
  DB.orders.push({id:newId, status:'pending', createdAt:Date.now(), createdBy:currentUser?.id, ...data});
  _knownIds.add(newId);
  const dimStr = isRound?`Φ${phi}`:`${t}×${w}`;
  const specStrText = isRound?`Φ${phi}×${l}mm · ${qty} cây`:`${t}×${w}×${l}mm · ${qty} thanh`;
  log('AI Trợ lý - Thêm đơn', `${d.customer} · ${specStrText} · ${data.priority}`, newId, null, {customer:d.customer,qty,priority:data.priority});
  showToast('✅ Đã thêm đơn hàng mới (qua AI Copilot)');
  addNotif('order_new','📦 Đơn mới: '+d.customer, `${specStrText} · ${data.priority}`, 'keHoach', currentUser?.name);
  renderTab(currentTab);
  saveOrders();
  const o = DB.orders.find(x=>x.id===newId);
  aiRememberOrder(o);
  return o;
}
// Xử lý câu trả lời của Admin trong luồng tạo đơn nhiều lượt
function aiHandleCreateOrderFlow(text, normText){
  if(/^tao don|them don moi|tao don hang moi|tao 1 don/.test(normText) && !aiCtx.pending){
    return aiStartCreateOrder();
  }
  if(!aiCtx.pending || aiCtx.pending.intent!=='create_order') return null;
  if(/^(huy|thoi|dung lai|khong tao nua)\b/.test(normText)){
    aiCtx.pending = null;
    return {text:'Đã hủy tạo đơn hàng mới.'};
  }
  const step = AI_CREATE_STEPS[aiCtx.pending.stepIdx];
  const skip = /^bo qua$/.test(normText.trim());
  if(step.key==='customer'){
    if(!text.trim()) return {text:'Bạn cho em tên khách hàng nhé?'};
    aiCtx.pending.data.customer = text.trim();
  } else if(step.key==='dims'){
    const parsed = skip ? {} : aiParseDims(text);
    if(!skip && !parsed) return {text:'Em chưa hiểu thông số, bạn gõ lại theo mẫu "3x100x4000, 200 thanh" hoặc "phi 18, 50 cây" giúp em nhé.'};
    Object.assign(aiCtx.pending.data, parsed||{});
  } else if(step.key==='priority'){
    if(!skip){
      const pm = normText.match(/gap\s*([1-3])/);
      aiCtx.pending.data.priority = pm ? 'GẤP '+pm[1] : 'GẤP 1';
    }
  } else if(step.key==='deliveryDate'){
    if(!skip){
      const dm = text.match(/\d{4}-\d{2}-\d{2}/);
      aiCtx.pending.data.deliveryDate = dm ? dm[0] : '';
    }
  }
  aiCtx.pending.stepIdx++;
  if(aiCtx.pending.stepIdx < AI_CREATE_STEPS.length){
    return {text: AI_CREATE_STEPS[aiCtx.pending.stepIdx].ask};
  }
  // Đủ thông tin — tạo đơn thật
  const d = aiCtx.pending.data;
  aiCtx.pending = null;
  const o = aiCreateOrder(d);
  const dimStr = o.isRound?`Φ${o.phi}`:`${o.thickness}×${o.width}`;
  return {
    text:`✅ Đã tạo đơn hàng mới cho khách hàng ${chatEsc(o.customer)} (${chatEsc(ddCode(o))}):\n• ${dimStr}×${o.length}mm · ${o.qty} · ${o.priority}${o.deliveryDate?' · Giao '+fmtDate(o.deliveryDate):''}`,
    html: `<div class="ai-result-list"><div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(o.customer)}</b><br>${dimStr}×${o.length}mm · ${o.qty} · <span style="color:${priColor(o.priority)}">🚩 ${chatEsc(o.priority)}</span></div>
      <button class="ai-result-view-btn" onclick="aiGoToOrder('${o.id}')">Xem</button>
    </div></div>`
  };
}

// ── Ý định: gửi thông báo cho cả nhóm — cú pháp "Thông báo: nội dung" ──
function aiHandleBroadcast(text, normText){
  if(!/^thong bao\b/.test(normText.trim()) && !/^thong bao\s*:/.test(normText.trim())) return null;
  const colonIdx = text.indexOf(':');
  const msg = (colonIdx!==-1 ? text.slice(colonIdx+1) : text.replace(/^[^:]*?thông\s*báo/i,'')).trim();
  if(!msg){
    return {text:'Bạn gõ theo cú pháp: "Thông báo: nội dung cần gửi cho cả nhóm".'};
  }
  addNotif('broadcast','📢 '+currentUser.name, msg, '', currentUser.name);
  log('Gửi thông báo', msg, '');
  showToast('✅ Đã gửi thông báo cho cả nhóm');
  if(fbOk()) fbWrite('/broadcast', {
    id:'b'+Date.now(), msg, from:currentUser.name,
    role:currentUser.role, ts:Date.now()
  }, 'PUT').catch(()=>{});
  return {text:`📢 Đã gửi thông báo cho cả nhóm: "${chatEsc(msg)}"`};
}

// ── Ý định: tìm kiếm đơn hàng / khách hàng ──
function aiHandleSearch(text, normText){
  if(!/\b(tim|tra cuu|tracuu|kiem tra|kiemtra|kiem|search)\b/.test(normText)) return null;
  const query = aiExtractSubject(text, normText);
  if(!query){
    return {text:'Bạn muốn tìm đơn hàng hoặc khách hàng nào? VD: "Tìm đơn Á Châu" hoặc "Tìm đơn phi 18".'};
  }
  const results = DB.orders
    .filter(o=>matchSearch(o, query))
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
    .slice(0,15);
  if(!results.length){
    return {text:`❌ Không tìm thấy đơn hàng nào khớp với "${query}".`};
  }
  aiRememberOrders(results);
  const html = results.map(o=>{
    const pc = priColor(o.priority);
    return `<div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(o.customer||'—')}</b>${o.po?' · PO '+chatEsc(o.po):''}<br>
        <span style="color:${pc}">🚩 ${chatEsc(o.priority||'—')}</span> · ${chatEsc(statusInfo(o.status).label||'')}</div>
      <button class="ai-result-view-btn" onclick="aiGoToOrder('${o.id}')">Xem</button>
    </div>`;
  }).join('');
  return {
    text:`🔎 Tìm thấy ${results.length} đơn khớp với "${query}":`,
    html:`<div class="ai-result-list">${html}</div>`
  };
}

// ── Bộ định tuyến ý định chính — thứ tự ưu tiên từ cú pháp đặc thù nhất
// (ghi chú/thông báo có dấu ":") đến tổng quát nhất (tìm kiếm tự do) ──
function processAiCommand(text){
  if(!isAdmin()) return {text:'Chức năng này chỉ dành cho Admin.'};
  const normText = _stripDiacritics(String(text||'').toLowerCase()).trim();
  if(!normText) return null;

  // Nếu đang trong 1 luồng nhiều lượt (VD: đang hỏi dồn thông tin để tạo đơn
  // mới) thì ưu tiên xử lý tiếp luồng đó trước, trừ khi Admin xin hủy/trợ giúp
  if(aiCtx.pending && aiCtx.pending.intent==='create_order'){
    const r = aiHandleCreateOrderFlow(text, normText);
    if(r) return r;
  }

  if(/^(chao|hi|hello|xin chao)\b/.test(normText)){
    return {text:'Chào Admin 👋 Bạn cần đổi ưu tiên, đổi trạng thái đơn, tra cứu, tạo đơn mới hay xem việc cần làm hôm nay?'};
  }
  if(/^(giup|help|huong dan|lam sao|tro giup)\b/.test(normText) || normText==='?'){
    return {text: AI_WELCOME};
  }
  return aiHandleCreateOrderFlow(text, normText)
    || aiHandleBroadcast(text, normText)
    || aiHandleNote(text, normText)
    || aiHandlePriorityChange(text, normText)
    || aiHandleProgress(text, normText)
    || aiHandleStatusChange(text, normText)
    || aiHandleDeadlineReport(normText)
    || aiHandleMachineStatus(normText)
    || aiHandleLeaveList(normText)
    || aiHandleNavigate(normText)
    || aiHandleQuickReport(normText)
    || aiHandleCustomerList(normText)
    || aiHandleSearch(text, normText)
    || null;
}
