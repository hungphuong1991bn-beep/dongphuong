// src/core/state-manager.js  — tách nguyên văn từ index.html gốc (v2.5.141), KHÔNG đổi logic
// ───────────── (hết phần mô tả — bên dưới là mã GỐC, chuyển nguyên văn) ─────────────


// ════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════
let currentUser = null;
let currentTab  = 'dashboard';
let DB = { orders:[], ordersTrash:[], attendance:{}, workers:[], kyLuat:[], nghiPhep:[], lichLamViec:[], baoTri:[], qrProducts:[], khuonCatalog:[], khuonQty:[], csTemplates:[], csData:{}, nguyenLieuLog:[], mayRutLog:[], mayDanhBongLog:[], users:[
  {id:'u1',username:'admin',password:'admin123',role:'admin',name:'Quản trị viên',email:'admin@dongphuong.vn',phone:''},
  {id:'u2',username:'nhanvien',password:'nv123',role:'staff',name:'Nhân viên SX',email:'',phone:''},
  {id:'u3',username:'sonhap',password:'sl123456',role:'solieu',name:'Nhân viên Nhập Số liệu',email:'',phone:''}
]};
let actLog = [];
let searchQ = '';
let filterStatus = 'all';
