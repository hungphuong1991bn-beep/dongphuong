// src/modules/checklist/checklist-data.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// CHECK SHEET THIẾT BỊ — Bảng kiểm tra thiết bị hàng ngày
// (nhóm thiết bị → khu vực máy → hạng mục kiểm tra, tick theo từng
// ngày trong tháng). Dữ liệu mẫu khởi tạo lấy đúng theo "BẢNG KIỂM
// THIẾT BỊ THANH CÁI" gốc — Admin có thể thêm/sửa/xoá tự do sau đó.
// ════════════════════════════════════════════════════════════
const CS_STATUS = {
  ok: {label:'Đủ điều kiện sản xuất',              short:'✓', color:'#15803d', bg:'#dcfce7', border:'#86efac'},
  ng: {label:'Không đủ điều kiện sản xuất, cần bảo trì', short:'✗', color:'#b91c1c', bg:'#fee2e2', border:'#fca5a5'}
};
function csMkItems(names){ return names.map((n,i)=>({id:'i'+(i+1)+'_'+_csSlug(n), name:n, std:''})); }
function _csSlug(s){ return _khStripAccents(String(s||'')).toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,18); }
const CS_TEMPLATE_SEED = [
  { id:'csg_tj300_400', name:'TJ300 & TJ400, Rút, Đánh Bóng', sections:[
    { id:'css_tj300_400', name:'TJ300 & TJ400', items: csMkItems([
      'Kiểm tra dầu 46','Kiểm tra dầu 150','Kiểm tra dầu 320','Kiểm tra nước làm mát Tang',
      'Kiểm tra Tang','Kiểm tra vành nước','Kiểm tra dao gọt phoi','Kiểm tra bánh tì',
      'Kiểm tra chốt khuôn','Kiểm tra bể nước làm mát','Kiểm tra bộ đếm Mét','Kiểm tra hệ thống thu Lô'
    ])},
    { id:'css_mayrut', name:'MÁY RÚT', items: csMkItems([
      'Kiểm tra nước làm mát Tang','Kiểm tra Pittong','Kiểm tra hệ thống bơm dầu',
      'Kiểm tra bộ định tâm khuôn','Kiểm tra đầu kẹp','Kiểm tra dầu rút',
      'Kiểm bàn kẹp & con Lăn','Kiểm tra hệ thống máy cắt'
    ])},
    { id:'css_maydanhbong', name:'MÁY ĐÁNH BÓNG', items: csMkItems([
      'Kiểm tra hệ thống băng tải','Kiểm tra các con lăn tì','Kiểm tra hệ thống trục','Kiểm tra Lô Nỉ đánh bóng'
    ])}
  ]},
  { id:'csg_tj550', name:'TJ550, Rút 100', sections:[
    { id:'css_tj550', name:'TJ550', items: csMkItems([
      'Kiểm tra dầu 46','Kiểm tra dầu 150','Kiểm tra dầu 320','Kiểm tra nước làm mát Tang',
      'Kiểm tra Tang','Kiểm tra vành nước','Kiểm tra dao gọt phoi','Kiểm tra bánh tì',
      'Kiểm tra chốt khuôn','Kiểm tra bể nước làm mát','Kiểm tra bộ đếm Mét','Kiểm tra hệ thống thu Lô'
    ])},
    { id:'css_mayrut100', name:'MÁY RÚT 100', items: csMkItems([
      'Kiểm tra nước làm mát','Kiểm tra Pittong','Kiểm tra hệ thống bơm dầu',
      'Kiểm tra bộ định tâm khuôn','Kiểm tra đầu kẹp','Kiểm tra dầu rút',
      'Kiểm bàn kẹp & con Lăn','Kiểm tra hệ thống máy cắt'
    ])}
  ]}
];
