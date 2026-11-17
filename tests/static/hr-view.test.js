// KIỂM THỬ GIAO DIỆN Quản lý nhân sự (v2.9.0) — mã THẬT (hr-*, attendance-core/view) + DOM jsdom.
// Trọng tâm: lương CHỈ Admin thấy; lọc/sắp xếp; thống kê; nghỉ phép/kỷ luật; hồ sơ.
// Chạy: NODE_PATH=tests/node_modules node tests/static/hr-view.test.js   (cần jsdom)
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const {JSDOM} = require('jsdom');
const root = path.join(__dirname, '../..'); const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const ok = m => console.log('✓', m, ++n);

const TODAY = '2026-11-17';
function setup(user, workers, extra = {}){
  const dom = new JSDOM('<body><div id="mc"></div><div id="toast"></div><div id="nsTabBar"></div></body>', {url: 'http://localhost/'});
  dom.window.Element.prototype.scrollIntoView = function(){};   // jsdom không có
  const document = dom.window.document, store = new Map(), toasts = [], confirms = [], exported = [];
  const ctx = {
    console, Date, Object, Math, JSON, parseInt, parseFloat, String, Number, Array, Set, Promise, isNaN, isFinite, document,
    localStorage: {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)},
    navigator: {onLine: true}, window: {addEventListener(){}},
    DB: {attendance: extra.att || {}, attMeta: {}, workers: JSON.parse(JSON.stringify(workers)), nghiPhep: extra.nghiPhep || [], kyLuat: extra.kyLuat || [], lichLamViec: [], hrSalary: {}},
    currentUser: user, currentTab: 'nhanSu',
    showToast: (m, e) => toasts.push({m, e}), log(){}, lsSave(){}, syncArrFieldToServer(){}, saveLichLamViec(){},
    fbOk: () => true, fbRead: async p => extra.server && extra.server[p] !== undefined ? extra.server[p] : null, fbWrite: async () => ({}),
    scheduleUIRefresh(){}, goTab(){}, openNhanSuQrModal(){}, setSyncDot(){},
    openModal: id => document.getElementById(id).classList.add('open'), closeModal: id => document.getElementById(id).classList.remove('open'),
    confirm2: (t, b, cb) => confirms.push({t, b, cb}),
    uid: () => 'x' + Math.random().toString(36).slice(2, 6), ensureExcelJs: async () => {},
  };
  ctx.setTimeout = () => 0; ctx.clearTimeout = () => {}; ctx.setInterval = () => 0; ctx.$ = id => document.getElementById(id);
  vm.createContext(ctx); const run = c => vm.runInContext(c, ctx);
  // Modal hồ sơ nhân viên (document.write → nạp qua DOM)
  const modalSrc = rd('src/modules/hr/hr-modal.js'); let html = ''; ctx.document = Object.assign(Object.create(document), {write: h => { html += h; }});
  // hr-modal.js dùng document.write: chạy với document giả để lấy HTML rồi gắn vào body thật
  const tmp = Object.assign({}, ctx); vm.createContext(tmp); tmp.document = {write: h => { html += h; }}; vm.runInContext(modalSrc, tmp);
  ctx.document = document; document.body.insertAdjacentHTML('beforeend', html);
  ['src/core/permissions.js', 'src/utils/date.js'].forEach(f => run(rd(f)));
  run(`todayStr=function(d){ if(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } return '${TODAY}'; }; function esc(s){return s==null?'':String(s).replace(/</g,'&lt;').replace(/"/g,'&quot;');}`);
  ['src/modules/attendance/attendance-core.js', 'src/modules/attendance/attendance-view.js', 'src/modules/hr/hr-service.js', 'src/modules/hr/hr-salary.js',
   'src/modules/hr/hr-insight.js', 'src/modules/hr/hr-raise.js', 'src/modules/hr/hr-view.js', 'src/modules/hr/hr-leave-discipline.js', 'src/modules/hr/hr-workers.js'].forEach(f => run(rd(f)));
  run(`_attYM='2026-11'`);
  return {ctx, run, document, toasts, confirms, exported};
}

const ADMIN = {id: 'u1', name: 'Admin', role: 'admin'}, STAFF = {id: 'u2', name: 'NV', role: 'staff'}, VIEW = {id: 'u3', name: 'Xem', role: 'viewer'}, SOL = {id: 'u4', name: 'SL', role: 'solieu'};
const SAL = {w1: 6543210, w2: 8765432};
const W = [
  {id: 'w1', name: 'Nguyễn Văn An', maNV: 'NV001', boPhan: 'Lò', chucVu: 'Công nhân', sdt: '0901111111', trangThai: 'Đang làm', ngayVaoLam: '2024-09-10', ngaySinh: '1990-11-20', gioiTinh: 'Nam'},
  {id: 'w2', name: 'Trần Thị Bình <i>', maNV: 'NV002', boPhan: 'Kéo', chucVu: 'Tổ trưởng', sdt: '', trangThai: 'Đang làm', ngayVaoLam: '2026-11-01', ngaySinh: '1995-03-02'},
  {id: 'w3', name: 'Lê Cường', maNV: 'NV003', boPhan: '', chucVu: '', trangThai: 'Đã nghỉ việc', ngayVaoLam: '2023-01-05', ngayNghiViec: '2024-01-05'},
  {id: 'w4', name: 'Đỗ Dũng', maNV: 'NV004', boPhan: 'Lò', chucVu: 'Trưởng ca', sdt: '0902222222', trangThai: 'Tạm nghỉ', ngayVaoLam: '2020-11-17'},
];
const LEAVES = [
  {id: 'np1', workerId: 'w1', workerName: 'Nguyễn Văn An', loai: 'Nghỉ ốm', fromDate: '2026-11-16', toDate: '2026-11-18', lydo: 'Sốt', status: 'Đã duyệt'},
  {id: 'np2', workerId: 'w2', workerName: 'Trần Thị Bình', loai: 'Nghỉ phép năm', fromDate: '2026-11-25', toDate: '2026-11-25', lydo: '', status: 'Chờ duyệt'},
  {id: 'np3', workerId: 'w4', workerName: 'Đỗ Dũng', loai: 'Nghỉ việc riêng', fromDate: '2026-10-05', toDate: '2026-10-06', lydo: 'x', status: 'Từ chối'},
];
const KL = [{id: 'kl1', workerId: 'w1', workerName: 'Nguyễn Văn An', date: '2026-11-03', loai: 'Khiển trách', lydo: 'Đi trễ', nguoiqd: 'QĐ'}];
const server = {'/hrPrivate/salary': SAL};
const MAKE = (user, extra = {}) => { const t = setup(user, W, Object.assign({nghiPhep: JSON.parse(JSON.stringify(LEAVES)), kyLuat: JSON.parse(JSON.stringify(KL)), server}, extra)); if(user.role === 'admin') t.ctx.DB.hrSalary = Object.assign({}, SAL); return t; };
const SALARY_RE = /6[.,\s]?543[.,\s]?210|8[.,\s]?765[.,\s]?432|6543210|8765432|Lương cơ bản|Quỹ lương|••••/;

(async () => {
  // 1. Giao diện: KHÔNG phải Admin → không có bất kỳ dấu vết lương nào trong DOM (kể cả khi dữ liệu có trong bộ nhớ)
  for(const u of [STAFF, VIEW, SOL]){
    const t = MAKE(u); t.ctx.DB.hrSalary = Object.assign({}, SAL);    // cố tình để lọt dữ liệu vào bộ nhớ
    t.run('renderNhanSu()'); const html = t.document.getElementById('mc').innerHTML;
    assert(!SALARY_RE.test(html), u.role + ': DOM tab nhân sự chứa lương');
    t.run(`openWorkerProfile('w1')`); const modal = t.document.getElementById('workerProfileModal');
    assert.strictEqual(t.document.getElementById('wpLuongCoBan').value, '', u.role + ': ô lương phải rỗng');
    assert.strictEqual(t.document.getElementById('wpSalaryField').style.display, 'none', u.role + ': ô lương phải ẩn');
    assert(!/6543210|8765432/.test(t.document.body.innerHTML));
  }
  ok('staff / viewer / solieu: DOM (bảng, thẻ, hồ sơ) không có cột/ô/số lương, kể cả khi bộ nhớ lỡ có dữ liệu');

  // 2. Admin: thấy cột + ô lương; mặc định bị che; bấm hiện mới thấy số
  { const t = MAKE(ADMIN); t.run('renderNhanSu()');
    let html = t.document.getElementById('mc').innerHTML;
    assert(/Lương cơ bản/.test(html) && /Quỹ lương/.test(html)); assert(!/6\.?543\.?210|8\.?765\.?432/.test(html), 'mặc định số lương bị che');
    assert(/••••••••/.test(html));
    t.run('nsToggleSalary()'); html = t.document.getElementById('mc').innerHTML;
    assert(/6\.543\.210/.test(html) && /8\.765\.432/.test(html), 'bấm hiện → thấy số');
    assert(/15,3 tr|15\.3 tr/.test(html.replace(/\s/g, '')) || /15,3\s*tr/.test(html), 'quỹ lương = 6.543.210+8.765.432 (Đang làm) ≈ 15,3 tr: ' + (html.match(/class="ns-stat-val"[^>]*>[^<]*tr</) || ''));
    t.run('nsResetPrivacy()'); t.run('renderNhanSu()'); assert(!/6\.543\.210/.test(t.document.getElementById('mc').innerHTML));
    ok('Admin: có cột + quỹ lương, mặc định che số, bấm 👁 mới hiện, reset khi đăng xuất'); }

  // 3. Hồ sơ Admin: ô lương hiện đúng giá trị; lưu → ghi nhánh riêng, hồ sơ chung không có lương
  { const t = MAKE(ADMIN); t.run(`openWorkerProfile('w1')`);
    assert.strictEqual(t.document.getElementById('wpSalaryField').style.display, ''); assert.strictEqual(t.document.getElementById('wpLuongCoBan').value, '6543210');
    t.document.getElementById('wpLuongCoBan').value = '7000000'; t.run('saveWorkerProfile()');
    assert.strictEqual(t.run('hrSalaryGet("w1")'), 7000000); assert(t.ctx.DB.workers.every(w => !('luongCoBan' in w)));
    assert.strictEqual(t.document.getElementById('wpLuongCoBan').value, '', 'ô lương được xoá sau khi lưu');
    t.run(`openWorkerProfile('w1')`); t.run('closeWorkerProfile()'); assert.strictEqual(t.document.getElementById('wpLuongCoBan').value, '');
    ok('Admin sửa lương trong hồ sơ → lưu nhánh riêng, hồ sơ chung sạch, ô nhập được dọn sau khi đóng'); }

  // 4. Non-Admin không thể lưu lương dù cố tình sửa DOM; viewer không sửa được hồ sơ
  { const t = MAKE(STAFF); t.run(`openWorkerProfile('w1')`); t.document.getElementById('wpLuongCoBan').value = '99999999'; t.run('saveWorkerProfile()');
    assert.strictEqual(t.run('hrSalaryGet("w1")'), 0); assert(!JSON.stringify(t.ctx.DB.workers).includes('99999999'));
    assert(t.toasts.some(x => /Chỉ Admin/.test(x.m))); ok('Non-Admin cố sửa DOM để lưu lương → bị chặn, không lưu đâu cả'); }

  // 5. Lọc / tìm / sắp xếp / lọc nhanh
  { const t = MAKE(STAFF); t.run('renderNhanSu()'); const rows = () => t.document.querySelectorAll('#nsWorkerTableBody tr').length;
    assert.strictEqual(rows(), 4);
    t.run(`nsApplyWorkerFilter(undefined,'Đang làm')`); assert.strictEqual(rows(), 2);
    t.run(`nsApplyWorkerFilter(undefined,'all'); nsSetFilter('dept','Lò')`); assert.strictEqual(rows(), 2);
    t.run(`nsSetFilter('pos','Trưởng ca')`); assert.strictEqual(rows(), 1);
    t.run('nsResetFilters()'); assert.strictEqual(rows(), 4);
    t.run(`nsApplyWorkerFilter('0902222222')`); assert.strictEqual(rows(), 1); t.run(`nsApplyWorkerFilter('')`);
    t.run(`nsSetQuick('thieu')`); assert.strictEqual(rows(), 1, 'chỉ Bình thiếu SĐT (Cường đã nghỉ việc không tính)');
    t.run(`nsSetQuick('thieu')`); assert.strictEqual(rows(), 4, 'bấm lần 2 → bỏ lọc');
    t.run(`nsSetQuick('sinhnhat')`); assert.strictEqual(rows(), 1, 'An sinh 20/11'); t.run(`nsSetQuick('sinhnhat')`);
    t.run(`nsSetQuick('nghiphep')`); assert.strictEqual(rows(), 1, 'An đang nghỉ (đã duyệt 16–18/11)'); t.run(`nsSetQuick('nghiphep')`);
    t.run(`nsSortBy('name')`); t.run(`nsSortBy('name')`); t.run(`nsSortBy('name')`);
    t.run(`nsSortBy('ngayVaoLam')`); const first = t.document.querySelector('#nsWorkerTableBody tr td:nth-child(2) [style*="font-size:13px"]').textContent;
    assert(/Đỗ Dũng/.test(first), 'vào làm sớm nhất lên đầu: ' + first);
    t.run(`nsSortBy('ngayVaoLam')`); assert(/Trần Thị Bình/.test(t.document.querySelector('#nsWorkerTableBody tr td:nth-child(2) [style*="font-size:13px"]').textContent), 'đảo chiều');
    t.run(`nsSortBy('ngayVaoLam')`); assert.strictEqual(t.run('_nsSort.key'), '', 'lần 3 bỏ sắp xếp');
    assert.strictEqual(t.document.getElementById('nsWorkerCount').textContent, '4 nhân viên');
    ok('Danh sách: tìm, lọc trạng thái/bộ phận/chức vụ, lọc nhanh (thiếu TT/sinh nhật/nghỉ phép), sắp xếp 3 chiều, bộ đếm'); }

  // 6. XSS: tên có thẻ HTML không được chạy
  { const t = MAKE(STAFF); t.run('renderNhanSu()'); const html = t.document.getElementById('mc').innerHTML;
    assert(!/<i>/.test(html.replace(/&lt;i&gt;/g, '')), 'tên chứa <i> phải bị escape'); assert(t.document.querySelectorAll('#nsWorkerTableBody i').length === 0);
    ok('Tên nhân viên chứa HTML được escape (không chèn được thẻ)'); }

  // 7. Thâm niên, thiếu thông tin, sinh nhật, số ngày nghỉ
  { const t = MAKE(STAFF);
    assert.strictEqual(t.run(`nsSeniorityText({ngayVaoLam:'2024-09-10'})`), '2 năm 2 tháng'); assert.strictEqual(t.run(`nsSeniorityText({ngayVaoLam:'2026-11-01'})`), '< 1 tháng');
    assert.strictEqual(t.run(`nsSeniorityText({ngayVaoLam:'2020-11-17'})`), '6 năm'); assert.strictEqual(t.run(`nsSeniorityText({ngayVaoLam:'2026-05-20'})`), '5 tháng');
    assert.strictEqual(t.run(`nsSeniorityText({ngayVaoLam:'2023-01-05',ngayNghiViec:'2024-01-05',trangThai:'Đã nghỉ việc'})`), '1 năm', 'tính tới ngày nghỉ việc');
    assert.strictEqual(t.run(`nsSeniorityText({})`), '');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(t.run(`nsMissingFields({name:'A',trangThai:'Đang làm'})`))), ['Bộ phận', 'Chức vụ', 'SĐT', 'Ngày vào làm']);
    assert.strictEqual(t.run(`nsMissingFields({name:'',trangThai:'Đã nghỉ việc'}).length`), 0);
    assert.strictEqual(t.run(`nsLeaveDays({fromDate:'2026-11-16',toDate:'2026-11-18'})`), 3); assert.strictEqual(t.run(`nsLeaveDays({fromDate:'2026-11-16'})`), 1);
    assert.strictEqual(t.run(`nsLeaveDays({fromDate:'2026-11-20',toDate:'2026-11-18'})`), 0);
    assert.strictEqual(t.run(`nsBirthdayDay({ngaySinh:'1990-11-20'})`), 20); assert.strictEqual(t.run(`nsBirthdayDay({ngaySinh:'1990-03-02'})`), 0);
    ok('Thâm niên (kể cả đã nghỉ việc), thiếu thông tin, sinh nhật, số ngày nghỉ tính đúng'); }

  // 8. Nghỉ phép: lọc + số ngày + tổng; thẻ "Đơn chờ duyệt" nhảy sang lọc Chờ duyệt
  { const t = MAKE(ADMIN); t.run('renderNhanSu()');
    let list = t.document.getElementById('nghiPhepList').innerHTML; assert(/3 đơn/.test(list) && /<b>3<\/b> ngày nghỉ đã duyệt/.test(list));
    t.run(`npSetFilter('status','Chờ duyệt')`); list = t.document.getElementById('nghiPhepList').innerHTML; assert(/1 đơn \/ 3/.test(list) && /Trần Thị Bình/.test(list) && !/Nguyễn Văn An/.test(list));
    t.run(`npResetFilter(); npSetFilter('month','2026-10')`); assert(/Đỗ Dũng/.test(t.document.getElementById('nghiPhepList').innerHTML)); t.run('npResetFilter()');
    t.run('nsGoLeavePending()'); assert.strictEqual(t.run('_npFilter.status'), 'Chờ duyệt'); assert.strictEqual(t.document.getElementById('npFilterStatus').value, 'Chờ duyệt');
    ok('Nghỉ phép: lọc trạng thái/tháng/từ khoá, cột số ngày, tổng ngày đã duyệt, thẻ chờ duyệt'); }

  // 9. Nghỉ phép: cảnh báo trùng ngày
  { const t = MAKE(ADMIN); t.run('renderNhanSu()'); t.run('openNghiPhepForm()'); const set = (i, v) => { t.document.getElementById(i).value = v; };
    set('np_worker', 'w1'); set('np_from', '2026-11-17'); set('np_to', '2026-11-19'); t.run('saveNghiPhep()');
    assert.strictEqual(t.confirms.length, 1); assert(/trùng/.test(t.confirms[0].t + t.confirms[0].b)); assert.strictEqual(t.ctx.DB.nghiPhep.length, 3, 'chưa lưu khi chưa xác nhận');
    t.confirms[0].cb(); assert.strictEqual(t.ctx.DB.nghiPhep.length, 4, 'xác nhận → lưu');
    set('np_worker', 'w2'); set('np_from', '2026-12-01'); set('np_to', '2026-12-02'); t.run('saveNghiPhep()'); assert.strictEqual(t.confirms.length, 1, 'không trùng → không hỏi'); assert.strictEqual(t.ctx.DB.nghiPhep.length, 5);
    ok('Đơn nghỉ trùng ngày → hỏi xác nhận; không trùng → lưu thẳng; đơn bị Từ chối không tính trùng'); }

  // 10. Kỷ luật: sửa bản ghi + lọc
  { const t = MAKE(ADMIN); t.run('renderNhanSu()'); assert(/editKyLuat/.test(t.document.getElementById('kyLuatList').innerHTML));
    t.run(`editKyLuat('kl1')`); assert.strictEqual(t.document.getElementById('kl_lydo').value, 'Đi trễ'); assert(/Sửa hồ sơ kỷ luật/.test(t.document.getElementById('klFormTitle').textContent));
    t.document.getElementById('kl_lydo').value = 'Đi trễ 3 lần'; t.document.getElementById('kl_loai').value = 'Cảnh cáo'; t.run('saveKyLuat()');
    assert.strictEqual(t.ctx.DB.kyLuat.length, 1, 'sửa chứ không tạo mới'); assert.strictEqual(t.ctx.DB.kyLuat[0].lydo, 'Đi trễ 3 lần'); assert.strictEqual(t.ctx.DB.kyLuat[0].loai, 'Cảnh cáo'); assert(t.ctx.DB.kyLuat[0].updatedAt);
    t.run(`klSetFilter('loai','Sa thải')`); assert(/Không có bản ghi nào khớp/.test(t.document.getElementById('kyLuatList').innerHTML));
    t.run('openKyLuatForm()'); assert.strictEqual(t.document.getElementById('kl_lydo').value, '', 'mở form thêm mới → xoá dữ liệu cũ');
    ok('Kỷ luật: sửa bản ghi tại chỗ (không nhân đôi), lọc theo hình thức, form thêm mới luôn sạch'); }

  // 11. Thống kê theo bộ phận
  { const t = MAKE(STAFF); t.run('renderNhanSu()'); const html = t.document.querySelector('.ns-panel[data-tab="thongke"]').innerHTML;
    assert(/Theo bộ phận/.test(html) && /Lò/.test(html) && /Kéo/.test(html)); assert(/Chưa có bộ phận/.test(html) === false, 'Cường nghỉ việc nên không tính vào cảnh báo thiếu bộ phận');
    ok('Thống kê theo bộ phận hiển thị; người đã nghỉ việc không bị cảnh báo thiếu bộ phận'); }

  // 12. Hồ sơ: validate tên / mã NV trùng; tự ghi ngày nghỉ việc
  { const t = MAKE(ADMIN); t.run(`openWorkerProfile('w1')`);
    t.document.getElementById('wpName').value = ''; t.run('saveWorkerProfile()'); assert(t.toasts.some(x => /họ và tên/.test(x.m)));
    t.document.getElementById('wpName').value = 'An'; t.document.getElementById('wpMaNV').value = 'nv002'; t.run('saveWorkerProfile()'); assert(t.toasts.some(x => /đã có người khác dùng/.test(x.m)));
    t.document.getElementById('wpMaNV').value = 'NV001'; t.document.getElementById('wpTrangThai').value = 'Đã nghỉ việc'; t.run('saveWorkerProfile()');
    assert.strictEqual(t.ctx.DB.workers[0].ngayNghiViec, TODAY); t.run(`openWorkerProfile('w1')`); t.document.getElementById('wpTrangThai').value = 'Đang làm'; t.run('saveWorkerProfile()');
    assert(!('ngayNghiViec' in t.ctx.DB.workers[0])); ok('Hồ sơ: bắt buộc họ tên, chặn trùng Mã NV, tự ghi/bỏ ngày nghỉ việc'); }

  // 13. Lịch sử trong hồ sơ
  { const t = MAKE(STAFF); t.run(`openWorkerProfile('w1')`); const h = t.document.getElementById('wpHistory').innerHTML;
    assert(/Thâm niên/.test(h) && /2 năm 2 tháng/.test(h) && /Nghỉ ốm/.test(h) && /Đi trễ/.test(h) && /3 ngày/.test(h)); ok('Hồ sơ có tóm tắt thâm niên/công/nghỉ phép/kỷ luật + lịch sử gần đây'); }

  // 14. Xuất Excel: Admin có cột lương, non-Admin không; viewer bị chặn
  for(const [u, wantSal] of [[ADMIN, true], [STAFF, false]]){
    const t = MAKE(u); let captured = null;
    t.ctx.attExcelReady = async () => true; t.ctx.attDownloadWb = async () => {};
    t.ctx.ExcelJS = {Workbook: function(){ }}; t.ctx.attAddSheet = (wb, name, rows, opts) => { captured = rows; return {getCell: () => ({})}; };
    await t.run('exportWorkersExcel()');
    assert(captured, u.role + ': phải tạo sheet'); const head = captured[2]; assert.strictEqual(head.some(h => /Lương/.test(h)), wantSal, u.role);
    const flat = JSON.stringify(captured); assert.strictEqual(/6543210/.test(flat), wantSal, u.role + ': số lương trong file'); assert(!/CCCD|Số tài khoản/.test(flat));
    assert.strictEqual(captured.length, 3 + 4);
  }
  { const t = MAKE(VIEW); let called = false; t.ctx.attExcelReady = async () => { called = true; return true; }; await t.run('exportWorkersExcel()'); assert(!called, 'viewer không xuất được'); }
  ok('Xuất Excel: Admin có cột lương, nhân viên thì không, viewer bị chặn; không xuất CCCD/số tài khoản'); 

  // 15. Tab Tăng lương: CHỈ Admin có nút tab + panel; thêm theo ngày/năm, lọc năm, xoá, hồ sơ có lịch sử
  for(const u of [STAFF, VIEW, SOL]){
    const t = MAKE(u); t.ctx.DB.hrRaises = [{id: 'r1', workerId: 'w1', workerName: 'An', date: '2025-05-01', from: 1234500, to: 2345600, reason: 'x', applied: true}];
    t.run('renderNhanSu()'); const html = t.document.getElementById('mc').innerHTML;
    assert(!/tangluong|Tăng lương|2\.345\.600|2345600/.test(html), u.role + ': không có dấu vết tab tăng lương');
    t.run(`goNsTab('tangluong')`); assert.strictEqual(t.run('_nsTab'), 'danhsach', 'không vào được tab tăng lương');
    t.run(`openWorkerProfile('w1')`); assert(!/tăng lương|2\.345\.600/i.test(t.document.getElementById('wpHistory').innerHTML));
    assert.strictEqual(t.run('renderRaisePanel()'), '');
  }
  ok('staff / viewer / solieu: không có nút tab, panel, số liệu hay lịch sử tăng lương trong DOM; goNsTab bị chặn');
  { const t = MAKE(ADMIN); t.run('renderNhanSu()'); assert(/data-tab="tangluong"/.test(t.document.getElementById('mc').innerHTML));
    t.run('openRaiseForm("w1")'); assert.strictEqual(t.document.getElementById('rs_worker').value, 'w1'); assert(/Lương hiện tại: 6\.543\.210/.test(t.document.getElementById('rs_hint').textContent));
    const set = (i, v) => { t.document.getElementById(i).value = v; };
    set('rs_date', '2025-04-01'); set('rs_to', '7000000'); set('rs_reason', 'Định kỳ'); t.run('saveRaise()');
    assert.strictEqual(t.ctx.DB.hrRaises.length, 1); assert.strictEqual(t.run('hrSalaryGet("w1")'), 7000000);
    t.run('openRaiseForm("w1")'); set('rs_date', '2026-01-10'); set('rs_to', '7500000'); t.run('saveRaise()');
    t.run('openRaiseForm("w2")'); set('rs_date', '2026-02-01'); set('rs_to', '9000000'); t.run('saveRaise()'); assert.strictEqual(t.ctx.DB.hrRaises.length, 3);
    t.run('nsToggleSalary()'); let list = t.document.getElementById('raiseList').innerHTML;
    assert(/01\/04\/2025|1\/4\/2025/.test(list) && /10\/01\/2026|10\/1\/2026/.test(list), 'hiển thị ngày/tháng/năm hiệu lực'); assert(/\+7,1%|\+7\.1%/.test(list) || /7,1/.test(list), 'phần trăm tăng');
    t.run(`rsSetFilter('year','2025')`); list = t.document.getElementById('raiseList').innerHTML; assert(/1 lượt/.test(list) && /Định kỳ|01\/04\/2025|1\/4\/2025/.test(list) && !/10\/01\/2026|10\/1\/2026/.test(list));
    t.run(`rsSetFilter('year','all'); rsSetFilter('worker','w2')`); assert(/1 lượt/.test(t.document.getElementById('raiseList').innerHTML)); t.run(`rsSetFilter('worker','all')`);
    t.run(`openWorkerProfile('w1')`); const h = t.document.getElementById('wpHistory').innerHTML; assert(/Lịch sử tăng lương \(2\)/.test(h) && /nsOpenRaiseForm/.test(h));
    t.run('saveRaise()'); assert(t.toasts.some(x => /chọn nhân viên/.test(x.m)), 'thiếu dữ liệu → báo lỗi');
    t.run(`deleteRaise('${t.ctx.DB.hrRaises[0].id}')`); assert.strictEqual(t.confirms.length, 1); t.confirms[0].cb(); assert.strictEqual(t.ctx.DB.hrRaises.length, 2);
    ok('Admin: thêm tăng lương theo ngày/năm, tự cập nhật lương, lọc theo năm/nhân viên, lịch sử trong hồ sơ, xoá có xác nhận'); }
  { const t = MAKE(ADMIN); t.ctx.DB.hrRaises = [{id: 'r1', workerId: 'w1', workerName: 'An', date: '2025-05-01', from: 1, to: 2, applied: true}]; let cap = null;
    t.ctx.attExcelReady = async () => true; t.ctx.attDownloadWb = async () => {}; t.ctx.ExcelJS = {Workbook: function(){}}; t.ctx.attAddSheet = (a, b, rows) => { cap = rows; return {getCell: () => ({})}; };
    await t.run('exportRaisesExcel()'); assert(cap && cap.length === 4 && /Ngày hiệu lực/.test(cap[2][1])); ok('Xuất Excel lịch sử tăng lương'); }

  console.log('\nhr-view.test: ' + n + ' nhóm kiểm thử đạt');
})().catch(e => { console.error('✗', e); process.exit(1); });
