// src/modules/ai/ai-llm.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ══════════════════ LỚP AI THẬT (Claude API + Function Calling) ══════════════════
// Chỉ được gọi khi bộ luật cục bộ (processAiCommand) không hiểu được câu lệnh
// VÀ Admin đã cấu hình API key ở Cài đặt. Các "tool" bên dưới ánh xạ thẳng
// tới các hàm thao tác THẬT trên DB của hệ thống — AI không tự bịa dữ liệu,
// mọi hành động đều đi qua các hàm nghiệp vụ có sẵn (log, saveOrders...).
const AI_TOOLS = [
  { name:'search_orders', description:'Tìm đơn hàng theo tên khách hàng, mã PO, quy cách... Trả về tối đa 15 đơn khớp nhất.',
    input_schema:{type:'object', properties:{ query:{type:'string', description:'Từ khoá tìm kiếm, VD tên khách hàng hoặc mã đơn'} }, required:['query']} },
  { name:'update_order_priority', description:'Đổi mức ưu tiên (GẤP 1/2/3) cho TẤT CẢ đơn đang chạy của 1 khách hàng.',
    input_schema:{type:'object', properties:{ customer:{type:'string'}, priority:{type:'string', enum:['GẤP 1','GẤP 2','GẤP 3']} }, required:['customer','priority']} },
  { name:'update_order_status', description:'Đổi trạng thái đơn hàng: pending (chờ SX) / running (đang chạy) / done (hoàn thành). Chỉ áp dụng khi khớp đúng 1 đơn.',
    input_schema:{type:'object', properties:{ customer:{type:'string'}, status:{type:'string', enum:['pending','running','done']} }, required:['customer','status']} },
  { name:'update_order_progress', description:'Cập nhật số lượng đã sản xuất (tiến độ) của 1 đơn.',
    input_schema:{type:'object', properties:{ customer:{type:'string'}, doneQty:{type:'number'} }, required:['customer','doneQty']} },
  { name:'add_order_note', description:'Ghi chú vào 1 đơn hàng.',
    input_schema:{type:'object', properties:{ customer:{type:'string'}, note:{type:'string'} }, required:['customer','note']} },
  { name:'create_order', description:'Tạo đơn hàng mới.',
    input_schema:{type:'object', properties:{
      customer:{type:'string'}, thickness:{type:'number', description:'Dày (mm), bỏ qua nếu hàng tròn'},
      width:{type:'number', description:'Rộng (mm), bỏ qua nếu hàng tròn'}, length:{type:'number', description:'Dài (mm), mặc định 4000'},
      phi:{type:'number', description:'Đường kính (mm) nếu là hàng tròn/dây'}, qty:{type:'number', description:'Số lượng thanh/cây'},
      priority:{type:'string', enum:['GẤP 1','GẤP 2','GẤP 3']}, deliveryDate:{type:'string', description:'YYYY-MM-DD'}
    }, required:['customer','qty']} },
  { name:'list_overdue_orders', description:'Liệt kê các đơn đã quá hạn giao.', input_schema:{type:'object', properties:{}} },
  { name:'list_upcoming_deadline_orders', description:'Liệt kê các đơn sắp tới hạn giao trong 48h.', input_schema:{type:'object', properties:{}} },
  { name:'get_today_briefing', description:'Lấy tổng hợp tình hình hôm nay: đơn mới, đơn quá hạn, máy hỏng, nghỉ phép... để trả lời "hôm nay có gì cần làm".', input_schema:{type:'object', properties:{}} },
  { name:'list_machine_status', description:'Liệt kê tình trạng máy móc: máy nào đang hỏng/bảo trì/cần thay linh kiện.', input_schema:{type:'object', properties:{}} },
  { name:'list_pending_leave', description:'Liệt kê đơn nghỉ phép đang chờ duyệt hoặc người đang nghỉ phép hôm nay.',
    input_schema:{type:'object', properties:{ scope:{type:'string', enum:['pending','today']} }, required:['scope']} },
  { name:'broadcast_notification', description:'Gửi thông báo cho cả nhóm/toàn hệ thống.',
    input_schema:{type:'object', properties:{ message:{type:'string'} }, required:['message']} },
  { name:'navigate_tab', description:'Mở 1 màn hình/tab trong ứng dụng.',
    input_schema:{type:'object', properties:{ tab:{type:'string', enum:['dashboard','dorDang','keHoach','hoanThanh','baoCao','nhanSu','chamCong','baoTriMay','lichLamViec','nhatKy','settings','qrCode']} }, required:['tab']} },
  { name:'list_customers_with_active_orders', description:'Liệt kê các khách hàng đang có đơn chạy.', input_schema:{type:'object', properties:{}} },
];

// Thực thi 1 tool call — trả về {result, orders?, navigated?} để hiển thị lại cho Admin
function aiExecuteTool(name, input){
  input = input||{};
  switch(name){
    case 'search_orders': {
      const results = DB.orders.filter(o=>matchSearch(o, input.query||'')).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,15);
      aiRememberOrders(results);
      return {result:`Tìm thấy ${results.length} đơn`, orders:results};
    }
    case 'update_order_priority': {
      const matches = aiFindOrders(input.customer, true);
      if(!matches.length) return {result:'Không tìm thấy đơn đang chạy của khách hàng này.'};
      matches.forEach(o=>{ o.priority = input.priority; });
      matches.forEach(o=>log('AI Copilot - Đổi ưu tiên', `${o.customer} · → ${input.priority}`, o.id, null, {priority:input.priority}));
      saveOrders(); renderTab(currentTab); updateBadges();
      aiRememberOrders(matches);
      return {result:`Đã chuyển ${matches.length} đơn sang ${input.priority}`, orders:matches};
    }
    case 'update_order_status': {
      const matches = aiFindOrders(input.customer, true).filter(o=>o.status!==input.status);
      if(!matches.length) return {result:'Không tìm thấy đơn phù hợp để đổi trạng thái.'};
      if(matches.length>1) return {result:'Khớp nhiều hơn 1 đơn, cần chỉ rõ mã đơn/PO.', orders:matches};
      setStatus(matches[0].id, input.status);
      aiRememberOrder(matches[0]);
      return {result:`Đã đổi trạng thái đơn ${matches[0].customer} sang ${input.status}`, orders:matches};
    }
    case 'update_order_progress': {
      const matches = aiFindOrders(input.customer, true);
      if(!matches.length) return {result:'Không tìm thấy đơn đang chạy của khách hàng này.'};
      if(matches.length>1) return {result:'Khớp nhiều hơn 1 đơn, cần chỉ rõ mã đơn/PO.', orders:matches};
      const o = matches[0];
      o.doneQty = input.doneQty;
      log('AI Copilot - Cập nhật tiến độ', `${o.customer} · Đã chạy: ${input.doneQty}`, o.id, null, {doneQty:input.doneQty});
      saveOrders(); renderTab(currentTab); refreshKhDetailIfOpen(o.id);
      aiRememberOrder(o);
      return {result:`Đã cập nhật tiến độ đơn ${o.customer}: ${input.doneQty}/${o.qty||'?'}`, orders:[o]};
    }
    case 'add_order_note': {
      const matches = aiFindOrders(input.customer, true);
      if(!matches.length) return {result:'Không tìm thấy đơn đang chạy của khách hàng này.'};
      if(matches.length>1) return {result:'Khớp nhiều hơn 1 đơn, cần chỉ rõ mã đơn/PO.', orders:matches};
      const o = matches[0];
      o.note = input.note;
      log('AI Copilot - Ghi chú', `${o.customer} · ${input.note}`, o.id, null, {note:input.note});
      saveOrders(); renderTab(currentTab);
      aiRememberOrder(o);
      return {result:`Đã ghi chú cho đơn ${o.customer}`, orders:[o]};
    }
    case 'create_order': {
      const o = aiCreateOrder(input);
      return {result:`Đã tạo đơn mới cho ${o.customer}, mã ${ddCode(o)}`, orders:[o]};
    }
    case 'list_overdue_orders': {
      const list = DB.orders.filter(o=>o.status!=='done'&&o.deliveryDate&&new Date(o.deliveryDate)<new Date());
      aiRememberOrders(list);
      return {result:`${list.length} đơn quá hạn`, orders:list};
    }
    case 'list_upcoming_deadline_orders': {
      const list = DB.orders.filter(o=>{ if(o.status==='done'||!o.deliveryDate) return false; const d=(new Date(o.deliveryDate)-new Date())/86400000; return d>=0&&d<2; });
      return {result:`${list.length} đơn sắp tới hạn`, orders:list};
    }
    case 'get_today_briefing': {
      const r = aiHandleQuickReport('bao cao hom nay');
      return {result: r ? r.text : 'Không có dữ liệu'};
    }
    case 'list_machine_status': {
      const r = aiHandleMachineStatus('tinh trang may');
      return {result: r ? r.text : 'Tất cả máy đang hoạt động tốt'};
    }
    case 'list_pending_leave': {
      const r = aiHandleLeaveList(input.scope==='today' ? 'ai dang nghi phep hom nay' : 'nghi phep cho duyet');
      return {result: r ? r.text : 'Không có dữ liệu'};
    }
    case 'broadcast_notification': {
      addNotif('broadcast','📢 '+currentUser.name, input.message, '', currentUser.name);
      log('Gửi thông báo (AI Copilot)', input.message, '');
      if(fbOk()) fbWrite('/broadcast', {id:'b'+Date.now(), msg:input.message, from:currentUser.name, role:currentUser.role, ts:Date.now()}, 'PUT').catch(()=>{});
      return {result:`Đã gửi thông báo: "${input.message}"`};
    }
    case 'navigate_tab': {
      closeAiChatWindow(); goTab(input.tab);
      return {result:`Đã mở tab ${input.tab}`, navigated:input.tab};
    }
    case 'list_customers_with_active_orders': {
      const r = aiHandleCustomerList('danh sach khach hang');
      return {result: r ? r.text : 'Không có khách hàng nào đang chạy đơn'};
    }
    default:
      return {result:'Không hỗ trợ chức năng này.'};
  }
}

function aiOrdersToHtml(orders){
  if(!orders || !orders.length) return '';
  const html = orders.slice(0,10).map(o=>{
    const pc = priColor(o.priority);
    return `<div class="ai-result-card">
      <div class="ai-result-info"><b>${chatEsc(o.customer||'—')}</b> · <code>${chatEsc(ddCode(o))}</code><br>
        <span style="color:${pc}">🚩 ${chatEsc(o.priority||'—')}</span> · ${chatEsc(statusInfo(o.status).label||'')}</div>
      <button class="ai-result-view-btn" onclick="aiGoToOrder('${o.id}')">Xem</button>
    </div>`;
  }).join('');
  return `<div class="ai-result-list">${html}</div>`;
}

// Dịch lỗi từ Claude API thành hướng dẫn cụ thể, dễ hiểu cho Admin — phân
// biệt rõ "sai key" / "hết credit" / "quá tải" thay vì gộp chung 1 câu chung chung.
function aiFriendlyApiError(e){
  const status = e && e.aiStatus;
  const type = e && e.aiErrType;
  const msg = (e && e.message) || '';
  if(status===401 || type==='authentication_error'){
    return `❌ API key không hợp lệ hoặc đã bị thu hồi.\n\nBạn vào Cài đặt ▸ Cấu hình AI Copilot nâng cao, kiểm tra lại đã dán đúng key (dạng "sk-ant-...") chưa, hoặc tạo key mới tại console.anthropic.com ▸ API Keys.`;
  }
  if(status===400 && (type==='invalid_request_error') && /credit balance/i.test(msg)){
    return `❌ Tài khoản Anthropic Console chưa đủ credit để gọi API (key vẫn đúng, không cần đổi).\n\nBạn vào console.anthropic.com ▸ Plans & Billing, thêm phương thức thanh toán và nạp thêm credit, rồi thử lại — không cần sửa gì trong app.`;
  }
  if(status===403 || type==='permission_error'){
    return `❌ Key không có quyền dùng chức năng này (permission_error). Bạn kiểm tra lại phạm vi quyền của key hoặc cài đặt tổ chức trên console.anthropic.com.`;
  }
  if(status===404 || type==='not_found_error'){
    return `❌ Không tìm thấy model được yêu cầu (có thể tài khoản chưa được cấp quyền dùng model này). Bạn kiểm tra danh sách model khả dụng trên console.anthropic.com.`;
  }
  if(status===429 || type==='rate_limit_error'){
    return `⏳ Đang gửi yêu cầu quá nhanh so với hạn mức tài khoản (rate limit). Bạn đợi một chút rồi thử lại nhé.`;
  }
  if(status===529 || type==='overloaded_error'){
    return `⏳ Hệ thống AI đang quá tải tạm thời. Bạn thử lại sau ít phút nhé.`;
  }
  if(status===402 || type==='billing_error'){
    return `❌ Có vấn đề về thanh toán trên tài khoản Anthropic Console. Bạn vào Plans & Billing để kiểm tra/cập nhật phương thức thanh toán rồi mua thêm credit.`;
  }
  return `❌ Không gọi được AI nâng cao: ${msg}\n\nBạn kiểm tra lại API key và số dư credit ở console.anthropic.com nhé.`;
}

// Gọi Claude API thật với vòng lặp function-calling: model có thể gọi nhiều
// tool liên tiếp (VD: tìm đơn → rồi đổi ưu tiên đơn đó) trước khi trả lời.
async function aiCallClaudeAPI(userText){
  const sysPrompt = `Bạn là AI Copilot của hệ thống quản lý sản xuất "Đông Phương" (thanh cái đồng/nhôm). Bạn giúp Admin quản lý Đơn hàng, Kế hoạch sản xuất, Máy móc/Bảo trì, Nhân sự/Nghỉ phép, Báo cáo qua các tool được cung cấp. Luôn trả lời ngắn gọn, tự nhiên bằng tiếng Việt, xưng "em" gọi người dùng là "bạn" hoặc "Admin". Khi thực hiện xong hành động, xác nhận rõ ràng đã làm gì. Nếu thiếu thông tin để gọi tool, hỏi lại Admin. Không tự bịa số liệu — luôn dùng tool để lấy dữ liệu thật. Hôm nay là ${new Date().toLocaleDateString('vi-VN')}.`;

  const history = aiChatMessages.slice(-12).map(m=>({
    role: m.role==='user' ? 'user' : 'assistant',
    content: m.text||''
  })).filter(m=>m.content);
  history.push({role:'user', content:userText});

  let lastOrders = null, lastNav = null;
  for(let round=0; round<5; round++){
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': aiApiKey(),
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body: JSON.stringify({
        model: AI_API_MODEL, max_tokens: 1024,
        system: sysPrompt, tools: AI_TOOLS, messages: history
      })
    });
    if(!resp.ok){
      let errBody = null;
      try{ errBody = await resp.json(); }catch(e){}
      const apiErr = new Error((errBody && errBody.error && errBody.error.message) || ('HTTP '+resp.status));
      apiErr.aiStatus = resp.status;
      apiErr.aiErrType = errBody && errBody.error && errBody.error.type;
      throw apiErr;
    }
    const data = await resp.json();
    const toolUses = (data.content||[]).filter(b=>b.type==='tool_use');
    const textBlocks = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();

    if(!toolUses.length){
      return {text: textBlocks || 'Em chưa rõ ý bạn lắm 🤔', html: lastNav ? '' : aiOrdersToHtml(lastOrders)};
    }
    // Thực thi từng tool call thật, rồi gửi kết quả lại cho model để nó tiếp tục suy luận
    history.push({role:'assistant', content:data.content});
    const toolResults = toolUses.map(tu=>{
      let out;
      try{ out = aiExecuteTool(tu.name, tu.input); }
      catch(e){ out = {result:'Lỗi khi thực hiện: '+e.message}; }
      if(out.orders) lastOrders = out.orders;
      if(out.navigated) lastNav = out.navigated;
      return {type:'tool_result', tool_use_id:tu.id, content: JSON.stringify({result:out.result, count:out.orders?out.orders.length:undefined, orders:(out.orders||[]).slice(0,15).map(o=>({customer:o.customer,code:ddCode(o),priority:o.priority,status:o.status,deliveryDate:o.deliveryDate,qty:o.qty,doneQty:o.doneQty||0}))})};
    });
    history.push({role:'user', content:toolResults});
  }
  return {text:'Em xử lý hơi nhiều bước quá, bạn thử tách nhỏ yêu cầu giúp em nhé 🙏'};
}
