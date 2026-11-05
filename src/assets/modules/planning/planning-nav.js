// src/modules/planning/planning-nav.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// Nhảy từ "Đơn mới nhất" (Tổng quan) tới đúng đơn hàng ở Kế hoạch SX
// (hoặc tab Hoàn thành nếu đơn đã xong), rồi cuộn tới và highlight.
function goToOrderInPlan(orderId){
  const o = DB.orders.find(x=>x.id===orderId);
  if(!o) return;
  if(o.status==='done'){
    // Reset toàn bộ bộ lọc/tìm kiếm của tab Hoàn thành trước khi nhảy sang,
    // nếu không đơn có thể bị bộ lọc đang áp dụng dở (trạng thái/khách hàng/
    // khoảng ngày...) che mất, khiến nút bấm trông như "không hoạt động".
    htSearchQ=''; htFilterStatus='all'; htDoneFrom=''; htDoneTo=''; htCustomerFilter='all'; htFilterPriority='all'; htFilterSpec='all';
    goTab('hoanThanh');
  } else {
    // Tương tự cho tab Kế hoạch SX: reset toàn bộ filter + ô tìm kiếm.
    khFilterStatus = 'all'; khFilterCustomer = 'all'; khFilterPriority = 'all';
    khFilterStage = 'all'; khFilterOwner = 'all';
    khCreatedFrom = ''; khCreatedTo = ''; khDueFrom = ''; khDueTo = '';
    khSearchQ = '';
    goTab('keHoach');
  }
  setTimeout(()=>{
    const el = document.querySelector('[data-order-id="'+orderId+'"]');
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      el.classList.add('order-jump-highlight');
      setTimeout(()=>{ el.classList.remove('order-jump-highlight'); }, 2000);
    }
  }, 280);
}
