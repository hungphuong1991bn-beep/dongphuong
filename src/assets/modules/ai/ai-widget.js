// src/modules/ai/ai-widget.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// Markup bên dưới được document.write đúng tại vị trí cũ trong DOM (xem index.html).
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────
document.write(`<!-- Bong bóng AI Trợ lý — chỉ Admin nhìn thấy -->
<div class="ai-bubble-wrap" id="aiBubbleWrap">
  <button class="ai-bubble-btn" id="aiBubbleBtn" onclick="toggleAiChatWindow()" title="AI Trợ lý">
    <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <rect x="6" y="7" width="12" height="10" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9.5 15.5c.7.6 1.6 1 2.5 1s1.8-.4 2.5-1"/><path d="M3 11h1M20 11h1"/>
    </svg>
    <span class="ai-bubble-badge" id="aiBubbleBadge"></span>
  </button>
</div>

<!-- Cửa sổ AI Trợ lý nổi (chỉ Admin) -->
<div class="ai-float-window" id="aiFloatWindow">
  <div class="ai-float-header">
    <div>
      <div class="ai-float-header-title">🤖 AI Trợ lý</div>
      <div class="ai-float-header-sub">Đổi ưu tiên · Tìm đơn / khách hàng</div>
    </div>
    <div class="ai-float-header-actions">
      <button class="ai-float-icon-btn" onclick="minimizeAiChatWindow()" title="Thu nhỏ">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button class="ai-float-icon-btn" onclick="closeAiChatWindow()" title="Đóng">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>
  <div class="ai-msgs" id="aiMsgsEl"></div>
  <div class="ai-hint-row" id="aiHintRow">
    <span class="ai-hint-chip" onclick="aiFillPrompt('Đưa đơn ')">Đổi ưu tiên</span>
    <span class="ai-hint-chip" onclick="aiFillPrompt('Cho đơn ')">Cho chạy</span>
    <span class="ai-hint-chip" onclick="aiFillPrompt('Tìm đơn ')">Tìm đơn</span>
    <span class="ai-hint-chip" onclick="aiFillPrompt('Đơn quá hạn')">Đơn quá hạn</span>
    <span class="ai-hint-chip" onclick="aiFillPrompt('Báo cáo hôm nay')">Báo cáo hôm nay</span>
    <span class="ai-hint-chip" onclick="aiFillPrompt('Danh sách khách hàng')">Danh sách khách hàng</span>
  </div>
  <div class="ai-inputbar">
    <textarea class="ai-input" id="aiInputEl" rows="1" placeholder="VD: Đưa đơn Á Châu lên gấp 1..." onkeydown="aiInputKeydown(event)" oninput="chatAutoGrow(this)"></textarea>
    <button class="ai-send-btn" id="aiSendBtn" onclick="sendAiChatMessage()" title="Gửi">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>`);
