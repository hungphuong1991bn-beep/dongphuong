// src/services/storage.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// LOCAL STORAGE  – cache + fallback
// ════════════════════════════════════════════════════════════
function lsSave(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify({orders:DB.orders,ordersTrash:DB.ordersTrash,users:DB.users,attendance:DB.attendance,workers:DB.workers,kyLuat:DB.kyLuat,nghiPhep:DB.nghiPhep,lichLamViec:DB.lichLamViec,baoTri:DB.baoTri,qrProducts:DB.qrProducts,khuonCatalog:DB.khuonCatalog,khuonQty:DB.khuonQty,csTemplates:DB.csTemplates,csData:DB.csData,nguyenLieuLog:DB.nguyenLieuLog,mayRutLog:DB.mayRutLog,mayDanhBongLog:DB.mayDanhBongLog})); }catch(e){}
}
function lsLoad(){
  try{
    const d = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    if(d.orders) DB.orders = d.orders;
    if(d.ordersTrash) DB.ordersTrash = d.ordersTrash;
    if(d.users && d.users.length) DB.users = d.users;
    if(d.attendance) DB.attendance = d.attendance;
    if(d.workers) DB.workers = d.workers;
    if(d.kyLuat) DB.kyLuat = d.kyLuat;
    if(d.nghiPhep) DB.nghiPhep = d.nghiPhep;
    if(d.lichLamViec) DB.lichLamViec = d.lichLamViec;
    if(d.baoTri) DB.baoTri = d.baoTri;
    if(d.qrProducts) DB.qrProducts = d.qrProducts;
    if(d.khuonCatalog && d.khuonCatalog.length) DB.khuonCatalog = d.khuonCatalog;
    if(d.khuonQty && d.khuonQty.length) DB.khuonQty = d.khuonQty;
    if(d.csTemplates && d.csTemplates.length) DB.csTemplates = d.csTemplates;
    if(d.csData) DB.csData = d.csData;
    if(d.nguyenLieuLog) DB.nguyenLieuLog = d.nguyenLieuLog;
    if(d.mayRutLog) DB.mayRutLog = d.mayRutLog;
    if(d.mayDanhBongLog) DB.mayDanhBongLog = d.mayDanhBongLog;
  }catch(e){}
}
function logLoad(){
  try{ actLog = JSON.parse(localStorage.getItem(LOG_KEY)||'[]'); }catch(e){ actLog=[]; }
}
function logSave(){
  try{ localStorage.setItem(LOG_KEY, JSON.stringify(actLog.slice(0,300))); }catch(e){}
}
