// src/modules/maintenance/maintenance-data.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ── AI cảnh báo bảo trì theo SẢN LƯỢNG (tấn) ─────────────────────────────
// Vành nước (tang) của Máy đùn: cảnh báo khi chạy được 100–150 tấn kể từ
// ngày thay gần nhất. Dầu máy rút (Máy rút 100 & Máy rút 50): cảnh báo khi
// chạy được mốc 100 tấn kể từ lần thay dầu gần nhất.
const MAINT_TON_INFO = {
  vanhNuoc:  {partName:'Tang vành nước', icon:'💧', warnFrom:100, dueFrom:150, unit:'tấn'},
  dauMayRut: {partName:'Dầu máy',        icon:'🛢️', warnFrom:80,  dueFrom:100, unit:'tấn'}
};
// Máy nào áp dụng theo dõi tấn nào — Máy đùn theo dõi vành nước; Máy rút 100 &
// Máy rút 50 theo dõi dầu máy (Máy rút 100 đang có 2 dây chuyền, cả 2 đều áp dụng)
function maintTypeOfMachine(m){
  if(!m) return null;
  if(m.group==='Máy đùn') return 'vanhNuoc';
  if(m.id==='m_rut100_1'||m.id==='m_rut100_2'||m.id==='m_rut50') return 'dauMayRut';
  return null;
}
