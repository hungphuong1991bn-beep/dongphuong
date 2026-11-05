// src/modules/ai/ai-chat.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// AI TRỢ LÝ (chỉ Admin) — ra lệnh bằng tiếng Việt tự nhiên để:
//  1) Nâng/hạ mức ưu tiên đơn hàng theo tên khách hàng
//  2) Tìm kiếm đơn hàng / khách hàng nhanh, không cần lọc thủ công
// Toàn bộ lịch sử chat AI chỉ lưu cục bộ (localStorage) trên từng máy,
// không đồng bộ Firebase vì đây là công cụ thao tác riêng của Admin.
// ════════════════════════════════════════════════════════════
const AI_CHAT_KEY = 'sx_ai_chat_v1';
let aiChatMessages = [];   // [{id,role:'user'|'bot',text,html,ts}]
let aiChatWindowOpen = false;

// ── NGỮ CẢNH HỘI THOẠI: nhớ đơn/khách hàng vừa nhắc tới + luồng nhiều lượt
// (VD: đang chờ Admin điền nốt thông tin để tạo đơn mới) ──
let aiCtx = { lastOrderId:null, lastCustomer:null, pending:null };

// ── Cấu hình gọi AI thật (Claude API) làm lớp dự phòng khi bộ luật cục bộ
// không hiểu được câu lệnh. Key lưu cục bộ trên từng máy (localStorage),
// KHÔNG đồng bộ Firebase. Đây là chế độ "lai": ưu tiên xử lý nhanh bằng
// luật cục bộ (không tốn phí, không cần mạng), chỉ gọi API thật khi cần. ──
const AI_API_KEY_LS = 'sx_ai_api_key';
const AI_API_MODEL = 'claude-sonnet-4-6';
function aiApiKey(){ try{ return localStorage.getItem(AI_API_KEY_LS)||''; }catch(e){ return ''; } }
function aiApiEnabled(){ return !!aiApiKey(); }
function saveAiCfg(){
  const v = ($('aiKeyInp')?.value||'').trim();
  try{ localStorage.setItem(AI_API_KEY_LS, v); }catch(e){}
  $('aiSetup').style.display='none';
  showToast(v ? '✅ Đã bật chế độ AI Copilot nâng cao' : '✅ Đã lưu (chưa nhập API key nên vẫn dùng bộ luật cục bộ)');
}
function skipAiCfg(){ $('aiSetup').style.display='none'; }

// Ghi nhớ đơn hàng vừa được xác định duy nhất, để các câu lệnh tiếp theo
// như "đơn này", "đơn đó" không cần nhắc lại tên khách hàng
function aiRememberOrder(o){ if(!o) return; aiCtx.lastOrderId=o.id; aiCtx.lastCustomer=o.customer; }
function aiRememberOrders(list){ if(list && list.length===1) aiRememberOrder(list[0]); }

// Như aiExtractSubject nhưng có thêm bước "hiểu ngầm": nếu câu không nêu tên
// khách hàng cụ thể mà có nhắc "đơn này/đơn đó/nó" → dùng lại khách hàng
// đang được nhớ trong ngữ cảnh hội thoại gần nhất.
function aiResolveSubject(text, normText){
  const explicit = aiExtractSubject(text, normText);
  if(explicit) return explicit;
  if(/\b(don nay|don do|don vua|don ay|no|day)\b/.test(normText) && aiCtx.lastCustomer) return aiCtx.lastCustomer;
  return explicit;
}

function chatEsc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function chatAutoGrow(ta){
  ta.style.height='auto';
  ta.style.height = Math.min(110, ta.scrollHeight)+'px';
}

// ══════════════════ AI TRỢ LÝ — CỬA SỔ CHAT ══════════════════
function aiCacheLoad(){
  try{ aiChatMessages = JSON.parse(localStorage.getItem(AI_CHAT_KEY)||'[]'); }catch(e){ aiChatMessages=[]; }
}
function aiCacheSave(){
  try{ localStorage.setItem(AI_CHAT_KEY, JSON.stringify(aiChatMessages.slice(-200))); }catch(e){}
}

// Hiện/ẩn bong bóng AI: chỉ Admin mới thấy, kể cả trước khi mở cửa sổ
function updateAiBubble(){
  const wrap = $('aiBubbleWrap');
  if(wrap) wrap.classList.toggle('show', isAdmin());
}

const AI_WELCOME =
`Xin chào Admin 👋 Em là AI Copilot, trung tâm điều khiển của cả hệ thống. Em có thể giúp:

📦 *Đơn hàng*
• Tạo đơn mới: "Tạo đơn hàng mới" (em sẽ hỏi dồn thông tin còn thiếu)
• Đổi ưu tiên: "Đưa đơn Á Châu lên gấp 1"
• Đổi trạng thái: "Cho đơn Á Châu chạy" / "Đơn Á Châu xong rồi"
• Cập nhật tiến độ: "Đơn Á Châu đã chạy 50 thanh"
• Ghi chú đơn: "Ghi chú đơn Á Châu: khách đổi màu"
• Tìm kiếm: "Tìm đơn phi 18" / "Tìm khách Hoàng Gia"
• Nhớ ngữ cảnh: sau khi nhắc 1 đơn, có thể nói tiếp "chuyển đơn này lên ưu tiên" mà không cần lặp tên khách

📊 *Báo cáo & rủi ro*
• "Hôm nay có gì cần làm?" — em tổng hợp đơn trễ, máy hỏng, nghỉ phép, đề xuất ưu tiên
• "Đơn quá hạn", "Đơn sắp tới hạn", "Danh sách khách hàng"

🛠️ *Máy móc & Nhân sự*
• "Máy nào đang hỏng?", "Tình trạng máy móc"
• "Nghỉ phép đang chờ duyệt?", "Ai đang nghỉ phép hôm nay?"

🧭 *Điều hướng*
• "Mở kế hoạch sản xuất", "Mở bảo trì máy", "Mở lịch làm việc"...

📢 *Khác*
• Gửi thông báo cả nhóm: "Thông báo: nghỉ lễ 2/9"
${aiApiEnabled()?'• Chế độ AI nâng cao đang BẬT — em có thể hiểu cả những câu phức tạp/mơ hồ hơn.':'• Muốn em hiểu được cả câu phức tạp hơn? Bật "AI Copilot nâng cao" ở Cài đặt.'}

Gõ "trợ giúp" bất cứ lúc nào để xem lại danh sách này.`;

function openAiChatWindow(){
  if(!isAdmin()) return;
  aiChatWindowOpen = true;
  closeSB();
  if(!aiChatMessages.length) aiCacheLoad();
  const win = $('aiFloatWindow');
  if(win) win.classList.add('open');
  if(!aiChatMessages.length){
    aiChatMessages.push({id:'a0', role:'bot', text:AI_WELCOME, ts:Date.now()});
    aiCacheSave();
  }
  renderAiMessages();
  aiScrollBottom();
}
function closeAiChatWindow(){
  aiChatWindowOpen = false;
  const win = $('aiFloatWindow');
  if(win) win.classList.remove('open');
}
function minimizeAiChatWindow(){ closeAiChatWindow(); }
function toggleAiChatWindow(){ aiChatWindowOpen ? closeAiChatWindow() : openAiChatWindow(); }

function aiFillPrompt(text){
  if(!aiChatWindowOpen) openAiChatWindow();
  const inp = $('aiInputEl');
  if(!inp) return;
  inp.value = text;
  chatAutoGrow(inp);
  inp.focus();
  if(inp.setSelectionRange) inp.setSelectionRange(text.length, text.length);
}

function aiInputKeydown(e){
  if(e.key==='Enter' && !e.shiftKey){
    e.preventDefault();
    sendAiChatMessage();
  }
}

function aiScrollBottom(){
  const box = $('aiMsgsEl');
  if(box) setTimeout(()=>{ box.scrollTop = box.scrollHeight; }, 30);
}

function renderAiMessages(){
  const box = $('aiMsgsEl');
  if(!box) return;
  box.innerHTML = aiChatMessages.map(m=>{
    const isMe = m.role==='user';
    const av = isMe ? (userInitials(currentUser?.name||'A')) : '🤖';
    return `<div class="ai-msg-row ${isMe?'me':''}">
      <div class="ai-msg-av">${av}</div>
      <div class="ai-msg-bubble">${chatEsc(m.text||'')}${m.html||''}</div>
    </div>`;
  }).join('');
}

function aiShowTyping(){
  const box = $('aiMsgsEl');
  if(!box) return;
  const el = document.createElement('div');
  el.className = 'ai-msg-row';
  el.id = 'aiTypingRow';
  el.innerHTML = `<div class="ai-msg-av">🤖</div><div class="ai-msg-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}
function aiHideTyping(){
  const el = $('aiTypingRow');
  if(el) el.remove();
}

// Điều hướng tới đơn hàng từ kết quả AI trả về, rồi đóng cửa sổ AI
function aiGoToOrder(id){
  const o = DB.orders.find(x=>x.id===id);
  if(o) aiRememberOrder(o);
  closeAiChatWindow();
  goToOrderInPlan(id);
}

async function sendAiChatMessage(){
  if(!isAdmin()) return;
  const inp = $('aiInputEl');
  if(!inp) return;
  const text = (inp.value||'').trim();
  if(!text) return;
  aiChatMessages.push({id:'a'+Date.now()+Math.random().toString(36).slice(2,6), role:'user', text, ts:Date.now()});
  inp.value=''; inp.style.height='auto';
  renderAiMessages();
  aiScrollBottom();
  aiCacheSave();
  aiShowTyping();

  let res;
  try{
    res = processAiCommand(text);
  }catch(e){
    res = {text:'❌ Có lỗi khi xử lý yêu cầu: '+e.message};
  }

  // Bộ luật cục bộ không hiểu được câu này → nếu đã bật AI nâng cao (có API
  // key), chuyển sang hỏi Claude API thật với function calling. Nếu chưa
  // bật, báo cho Admin biết cách bật lên.
  if(!res){
    if(aiApiEnabled()){
      try{
        res = await aiCallClaudeAPI(text);
      }catch(e){
        res = {text: aiFriendlyApiError(e)};
      }
    } else {
      res = {text:'Em chưa hiểu ý bạn bằng bộ lệnh có sẵn 🤔\nGõ "trợ giúp" để xem các lệnh em hỗ trợ, hoặc bật "AI Copilot nâng cao" ở Cài đặt để em hiểu được cả những câu phức tạp hơn.'};
    }
  }

  aiHideTyping();
  if(!res) res = {text:'Em chưa hiểu ý bạn. Gõ "trợ giúp" để xem các lệnh em hỗ trợ nhé.'};
  aiChatMessages.push({id:'a'+Date.now()+Math.random().toString(36).slice(2,6), role:'bot', text:res.text||'', html:res.html||'', ts:Date.now()});
  renderAiMessages();
  aiScrollBottom();
  aiCacheSave();
}
