// KIỂM THỬ: mức lương cơ bản CHỈ ADMIN xem được (v2.9.0). Chạy: node tests/static/hr-salary.test.js
// Firebase + localStorage giả lập trong bộ nhớ. Không cần trình duyệt.
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const root = path.join(__dirname, '../..'); const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const ok = m => console.log('✓', m, ++n);

function setup({role = 'admin', workers = [], server = {}, failWrites = false, online = true} = {}){
  const store = JSON.parse(JSON.stringify(server));          // "Firebase": {path: value}
  const ls = {};                                              // localStorage
  const reads = [], writes = [], logs = [], toasts = [];
  const st = {fail: failWrites};
  const ctx = {
    console, JSON, Object, Array, Number, String, Math, isFinite, Promise, setTimeout, clearTimeout,
    DB: {workers: JSON.parse(JSON.stringify(workers)), hrSalary: {}},
    currentUser: {id: 'u1', role},
    isAdmin: () => ctx.currentUser && ctx.currentUser.role === 'admin',
    isViewer: () => ctx.currentUser && (ctx.currentUser.role === 'viewer' || ctx.currentUser.role === 'solieu'),
    guardViewer: () => ctx.isViewer(),
    fbOk: () => online,
    fbRead: async p => { reads.push(p); return store[p] === undefined ? null : JSON.parse(JSON.stringify(store[p])); },
    fbWrite: async (p, data) => {
      writes.push([p, data]);
      if(st.fail) throw new Error('mất mạng');
      if(data === null) delete store[p]; else store[p] = data;
      // mô phỏng nhánh con: /hrPrivate/salary/{id} → gộp vào /hrPrivate/salary
      const m = /^(\/hrPrivate\/salary)\/(.+)$/.exec(p);
      if(m){ store[m[1]] = store[m[1]] || {}; if(data === null) delete store[m[1]][m[2]]; else store[m[1]][m[2]] = data; if(!Object.keys(store[m[1]]).length) delete store[m[1]]; }
    },
    localStorage: {getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; }},
    lsSave: () => { ctx._lsSaved = (ctx._lsSaved || 0) + 1; },
    syncArrFieldToServer: () => { ctx._synced = (ctx._synced || 0) + 1; },
    hrLinkSyncSchedule: () => 0,
    log: (a, d) => logs.push([a, d]), showToast: m => toasts.push(m),
    currentTab: 'dashboard', renderNhanSu: () => { ctx._rendered = (ctx._rendered || 0) + 1; },
  };
  vm.createContext(ctx);
  ['src/modules/hr/hr-service.js', 'src/modules/hr/hr-salary.js'].forEach(f => vm.runInContext(rd(f), ctx));
  return {ctx, store, ls, reads, writes, logs, toasts, st, run: c => vm.runInContext(c, ctx)};
}
const W = () => [
  {id: 'w1', name: 'An', luongCoBan: '6000000', trangThai: 'Đang làm'},
  {id: 'w2', name: 'Bình', luongCoBan: '', trangThai: 'Đang làm'},
  {id: 'w3', name: 'Cường', luongCoBan: 7500000, trangThai: 'Đã nghỉ việc'},
];

(async () => {
  // 1. Chuẩn hoá số
  { const t = setup();
    assert.strictEqual(t.run('hrSalaryNum("6.500.000")'), 6500000); assert.strictEqual(t.run('hrSalaryNum("")'), 0);
    assert.strictEqual(t.run('hrSalaryNum(-5)'), 0); assert.strictEqual(t.run('hrSalaryNum("abc")'), 0); assert.strictEqual(t.run('hrSalaryNum(null)'), 0);
    ok('Chuẩn hoá số lương (dấu chấm ngăn cách, rỗng, âm, chữ)'); }

  // 2. Tài khoản KHÔNG phải Admin: không đọc/ghi được lương dù bộ nhớ có dữ liệu
  for(const role of ['staff', 'viewer', 'solieu']){
    const t = setup({role}); t.ctx.DB.hrSalary = {w1: 6000000};
    assert.strictEqual(t.run('hrSalaryGet("w1")'), 0, role); assert.strictEqual(t.run('hrSalaryTotalActive()'), 0);
    assert.strictEqual(t.run('hrSalarySet("w1", 9999999)'), false); assert.strictEqual(t.writes.length, 0);
    assert.strictEqual(await t.run('hrSalaryFetch()'), false); assert.strictEqual(t.reads.length, 0);
    assert.strictEqual(await t.run('hrSalaryFlush()'), false);
  }
  ok('staff / viewer / solieu: hrSalaryGet luôn 0, không đọc, không ghi, không gọi Firebase');

  // 3. Admin đặt / xoá lương → ghi đúng nhánh riêng, không đụng /data
  { const t = setup({workers: W().map(w => { delete w.luongCoBan; return w; })});
    assert.strictEqual(t.run('hrSalarySet("w1", "6500000")'), true); await t.run('hrSalaryFlush()');
    assert.strictEqual(t.store['/hrPrivate/salary/w1'], 6500000); assert.strictEqual(t.run('hrSalaryGet("w1")'), 6500000);
    assert(t.writes.every(w => w[0].startsWith('/hrPrivate/'))); assert(!JSON.stringify(t.ctx.DB.workers).includes('6500000'));
    t.run('hrSalarySet("w1", 0)'); await t.run('hrSalaryFlush()');
    assert.strictEqual(t.store['/hrPrivate/salary/w1'], undefined); assert.strictEqual(t.run('hrSalaryGet("w1")'), 0);
    ok('Admin đặt/xoá lương → chỉ ghi /hrPrivate/salary/{id}; hồ sơ chung không chứa số tiền'); }

  // 4. Tổng quỹ lương bỏ người đã nghỉ việc
  { const t = setup({workers: [{id: 'a', trangThai: 'Đang làm'}, {id: 'b', trangThai: 'Tạm nghỉ'}, {id: 'c', trangThai: 'Đã nghỉ việc'}]});
    t.ctx.DB.hrSalary = {a: 5000000, b: 4000000, c: 9000000};
    assert.strictEqual(t.run('hrSalaryTotalActive()'), 9000000); ok('Quỹ lương không tính nhân viên Đã nghỉ việc'); }

  // 5. Di trú: lương cũ trong hồ sơ → nhánh riêng, rồi gỡ khỏi hồ sơ chung; chạy lại không đổi gì
  { const t = setup({workers: W()});
    t.ctx.DB.workers[2].luongCoBan = 7500000;
    const moved = await t.run('hrSalaryMigrate()');
    assert.strictEqual(moved, 2); assert.strictEqual(t.store['/hrPrivate/salary/w1'], 6000000); assert.strictEqual(t.store['/hrPrivate/salary/w3'], 7500000);
    assert(!t.store['/hrPrivate/salary/w2']);
    assert(t.ctx.DB.workers.every(w => !('luongCoBan' in w)), 'mọi hồ sơ đã gỡ luongCoBan');
    assert(t.ctx._synced >= 1, 'đã đồng bộ lại /data/workers (đã bỏ lương)');
    assert(t.logs.some(l => l[0] === 'Bảo mật hồ sơ') && !t.logs.some(l => /6000000|7500000/.test(l[1])), 'nhật ký không chứa số tiền');
    const w0 = t.writes.length; assert.strictEqual(await t.run('hrSalaryMigrate()'), 0); assert.strictEqual(t.writes.length, w0);
    ok('Di trú lương cũ → /hrPrivate, gỡ khỏi hồ sơ chung, nhật ký không lộ số, chạy lại không đổi gì'); }

  // 6. Di trú thất bại (mất mạng) → KHÔNG được gỡ lương khỏi hồ sơ (không mất dữ liệu)
  { const t = setup({workers: W(), failWrites: true});
    const moved = await t.run('hrSalaryMigrate()');
    assert.strictEqual(moved, 0); assert.strictEqual(t.ctx.DB.workers[0].luongCoBan, '6000000', 'lương còn nguyên trong hồ sơ');
    assert(Object.keys(JSON.parse(t.ls['dp_hr_salary_pending_v1'] || '{}')).length >= 1, 'đã lưu hàng đợi bền');
    t.st.fail = false; assert.strictEqual(await t.run('hrSalaryMigrate()'), 2); assert(t.ctx.DB.workers.every(w => !('luongCoBan' in w)));
    ok('Mất mạng khi di trú → giữ nguyên lương trong hồ sơ + hàng đợi bền; có mạng lại thì tự chuyển nốt'); }

  // 7. Giá trị đã có ở nhánh riêng được ưu tiên, không bị lương cũ ghi đè
  { const t = setup({workers: W(), server: {'/hrPrivate/salary': {w1: 7000000}}});
    await t.run('hrSalaryFetch()'); await t.run('hrSalaryMigrate()');
    assert.strictEqual(t.run('hrSalaryGet("w1")'), 7000000); assert.strictEqual(t.store['/hrPrivate/salary'].w1, 7000000);
    assert(!t.writes.some(w => w[0] === '/hrPrivate/salary/w1'), 'không ghi đè w1'); assert(t.ctx.DB.workers.every(w => !('luongCoBan' in w))); ok('Lương đã có ở nhánh riêng được ưu tiên hơn lương cũ trong hồ sơ'); }

  // 8. Nhập lương lúc mất mạng: không mất; tải bản server cũ không đè lên số vừa nhập; có mạng thì gửi nốt
  { const t = setup({workers: [{id: 'w1', name: 'An'}], server: {'/hrPrivate/salary': {w1: 5000000}}, failWrites: true});
    t.run('hrSalarySet("w1", 8000000)'); await new Promise(r => setTimeout(r, 5));
    await t.run('hrSalaryFetch()'); assert.strictEqual(t.run('hrSalaryGet("w1")'), 8000000, 'bản server cũ không đè số vừa nhập');
    t.st.fail = false; assert.strictEqual(await t.run('hrSalaryFlush()'), true); assert.strictEqual(t.store['/hrPrivate/salary/w1'], 8000000);
    assert.strictEqual(t.ls['dp_hr_salary_pending_v1'], undefined); ok('Nhập lương lúc mất mạng không bị mất, có mạng lại tự gửi'); }

  // 9. Thay đổi được thêm trong lúc đang gửi vẫn được gửi nốt
  { const t = setup({workers: [{id: 'a'}, {id: 'b'}]});
    t.run('hrSalarySet("a", 1000000)'); t.run('hrSalarySet("b", 2000000)');
    await t.run('hrSalaryFlush()'); assert.strictEqual(t.store['/hrPrivate/salary/a'], 1000000); assert.strictEqual(t.store['/hrPrivate/salary/b'], 2000000);
    ok('Flush không bỏ sót thay đổi phát sinh trong lúc đang gửi'); }

  // 10. saveWorkers: mọi vai trò đều gỡ luongCoBan (máy cũ không đẩy ngược lương lên vùng chung)
  for(const role of ['admin', 'staff']){
    const t = setup({role, workers: W()}); t.run('saveWorkers()');
    assert(t.ctx.DB.workers.every(w => !('luongCoBan' in w)), role);
    if(role === 'admin') assert.strictEqual(t.run('hrSalaryGet("w1")'), 6000000, 'admin: lương được nhặt sang nhánh riêng trước khi gỡ');
    else assert.strictEqual(t.writes.length, 0, 'staff không ghi gì vào hrPrivate');
  }
  ok('saveWorkers() gỡ luongCoBan ở mọi vai trò; Admin được nhặt lương sang nhánh riêng trước khi gỡ');

  // 11. Đăng nhập tài khoản không phải Admin: dọn cache, gỡ lương cục bộ, KHÔNG chạm /hrPrivate
  { const t = setup({role: 'staff', workers: W()}); t.ls['dp_hr_salary_v1'] = '{"w1":6000000}';
    await t.run('hrSalaryOnLogin()');
    assert.strictEqual(t.ls['dp_hr_salary_v1'], undefined); assert.deepStrictEqual(JSON.parse(JSON.stringify(t.ctx.DB.hrSalary)), {});
    assert(t.ctx.DB.workers.every(w => !('luongCoBan' in w))); assert(t.ctx._lsSaved >= 1);
    assert(!t.reads.some(p => p.includes('hrPrivate')) && !t.writes.length); ok('Đăng nhập non-Admin: xoá cache lương, gỡ lương cục bộ, không đọc/ghi /hrPrivate'); }

  // 12. Đăng nhập Admin: tải lương, di trú, vẽ lại tab nếu đang ở Quản lý nhân sự
  { const t = setup({workers: W(), server: {'/hrPrivate/salary': {w9: 1234567}}}); t.ctx.currentTab = 'nhanSu';
    await t.run('hrSalaryOnLogin()');
    assert.strictEqual(t.run('hrSalaryGet("w9")'), 1234567); assert.strictEqual(t.run('hrSalaryGet("w1")'), 6000000);
    assert(t.ctx._rendered >= 1); assert(t.toasts.some(x => /vùng bảo mật/.test(x))); ok('Đăng nhập Admin: tải + di trú lương và vẽ lại tab'); }

  // 13. Đăng xuất xoá sạch lương khỏi bộ nhớ và máy; đổi sang tài khoản khác không thấy gì
  { const t = setup({workers: [{id: 'w1'}]}); t.run('hrSalarySet("w1", 6000000)'); await t.run('hrSalaryFlush()');
    assert(t.ls['dp_hr_salary_v1']); t.run('hrSalaryOnLogout()');
    assert.strictEqual(t.ls['dp_hr_salary_v1'], undefined); assert.deepStrictEqual(JSON.parse(JSON.stringify(t.ctx.DB.hrSalary)), {});
    t.ctx.currentUser = {id: 'u2', role: 'staff'}; assert.strictEqual(t.run('hrSalaryGet("w1")'), 0);
    ok('Đăng xuất xoá lương khỏi bộ nhớ + localStorage; tài khoản kế tiếp không thấy gì'); }

  // 14. Realtime: chỉ Admin tải lại
  { const a = setup({workers: [{id: 'w1'}], server: {'/hrPrivate/salary': {w1: 111}}}); a.run('hrSalaryOnRealtime()'); await new Promise(r => setTimeout(r, 800));
    assert(a.reads.includes('/hrPrivate/salary')); assert.strictEqual(a.run('hrSalaryGet("w1")'), 111);
    const s = setup({role: 'staff', server: {'/hrPrivate/salary': {w1: 111}}}); s.run('hrSalaryOnRealtime()'); await new Promise(r => setTimeout(r, 800));
    assert.strictEqual(s.reads.length, 0); ok('Realtime /hrPrivate: Admin tải lại, tài khoản khác bỏ qua'); }

  // 15. Cấu hình tĩnh: không còn nơi nào hiển thị / lưu luongCoBan trong mã giao diện
  { const pub = rd('src/modules/qr/qr-public-nhansu.js'); assert(!/luongCoBan|Lương cơ bản/.test(pub), 'trang QR công khai không còn lương');
    const lsSrc = rd('src/services/storage.js'); assert(!/hrSalary/.test(lsSrc), 'lsSave không đưa lương vào cache chung');
    const syncSrc = rd('src/services/sync.js'); assert(!/hrSalary|hrPrivate/.test(syncSrc), '/data không chứa lương');
    const wk = rd('src/modules/hr/hr-workers.js'); assert(!/w\.luongCoBan\s*=/.test(wk) && !/luongCoBan:/.test(wk));
    const view = rd('src/modules/hr/hr-view.js'); assert(!/luongCoBan/.test(view));
    ok('Mã nguồn: QR công khai / cache chung / sync /data / hồ sơ không còn dính tới lương'); }

  // 16. Tăng lương: ghi nhận theo ngày hiệu lực, lương hiện tại cập nhật, lưu nhánh riêng
  { const t = setup({workers: [{id: 'w1', name: 'An', trangThai: 'Đang làm'}]}); t.run('hrSalarySet("w1", 6000000)');
    let r = t.run('hrRaiseAdd({workerId:"w1",date:"2020-03-01",to:"7000000",reason:"Định kỳ"})'); assert(r.ok, JSON.stringify(r));
    assert.strictEqual(r.raise.from, 6000000); assert.strictEqual(r.raise.to, 7000000); assert.strictEqual(r.raise.applied, true);
    assert.strictEqual(t.run('hrSalaryGet("w1")'), 7000000, 'lương hiện tại cập nhật vì ngày hiệu lực đã qua');
    await t.run('hrSalaryFlush()'); assert.strictEqual(t.store['/hrPrivate/raises/' + r.raise.id].to, 7000000); assert.strictEqual(t.store['/hrPrivate/salary/w1'], 7000000);
    assert(t.writes.every(w => w[0].startsWith('/hrPrivate/'))); assert(!JSON.stringify(t.ctx.DB.workers).includes('7000000'));
    r = t.run('hrRaiseAdd({workerId:"w1",date:"2021-06-15",to:"7000000"})'); assert(!r.ok && /cao hơn/.test(r.error), 'không cho mức mới <= mức trước');
    r = t.run('hrRaiseAdd({workerId:"w1",date:"2021-06-15",to:"7500000"})'); assert(r.ok && r.raise.from === 7000000);
    assert.strictEqual(t.run('hrRaiseLast("w1").date'), '2021-06-15'); assert.strictEqual(t.run('hrRaiseList("w1").length'), 2);
    for(const bad of ['{workerId:"",date:"2020-01-01",to:1}', '{workerId:"w1",date:"",to:1}', '{workerId:"w1",date:"2020-01-01",to:0}', '{workerId:"zz",date:"2020-01-01",to:5}']) assert(!t.run('hrRaiseAdd(' + bad + ')').ok);
    ok('Tăng lương: ghi theo ngày hiệu lực, tự tính lương cũ, cập nhật lương hiện tại, lưu /hrPrivate, chặn dữ liệu sai'); }

  // 17. Ngày hiệu lực tương lai → chờ hiệu lực, KHÔNG đổi lương hiện tại; tới hạn thì tự áp dụng
  { const t = setup({workers: [{id: 'w1', name: 'An'}]}); t.run('hrSalarySet("w1", 6000000)');
    const r = t.run('hrRaiseAdd({workerId:"w1",date:"2999-01-01",to:"9000000"})'); assert(r.ok && r.raise.applied === false);
    assert.strictEqual(t.run('hrSalaryGet("w1")'), 6000000); assert.strictEqual(t.run('hrRaiseLast("w1")'), null);
    t.ctx.DB.hrRaises[0].date = '2020-01-01';                       // "đến ngày"
    assert.strictEqual(t.run('hrRaiseApplyDue()'), 1); assert.strictEqual(t.run('hrSalaryGet("w1")'), 9000000); assert.strictEqual(t.ctx.DB.hrRaises[0].applied, true);
    assert.strictEqual(t.run('hrRaiseApplyDue()'), 0, 'chạy lại không đổi gì');
    ok('Tăng lương ngày tương lai: chờ hiệu lực, tới ngày tự áp dụng, idempotent'); }

  // 18. Nhập bù ngày cũ chen giữa: lương cũ lấy theo mốc trước đó; xoá lần ghi nhận không đổi lương hiện tại
  { const t = setup({workers: [{id: 'w1', name: 'An'}]}); t.run('hrSalarySet("w1", 5000000)');
    t.run('hrRaiseAdd({workerId:"w1",date:"2020-01-01",to:"6000000"})'); t.run('hrRaiseAdd({workerId:"w1",date:"2022-01-01",to:"8000000"})');
    const mid = t.run('hrRaiseAdd({workerId:"w1",date:"2021-01-01",to:"7000000"})'); assert(mid.ok && mid.raise.from === 6000000);
    assert.strictEqual(t.run('hrSalaryGet("w1")'), 8000000, 'lương hiện tại = mức của lần mới nhất theo NGÀY');
    assert.strictEqual(t.run('hrRaiseList("w1").map(r=>r.date).join()'), '2020-01-01,2021-01-01,2022-01-01');
    assert.strictEqual(t.run('hrRaiseDelete("' + mid.raise.id + '")'), true); await t.run('hrSalaryFlush()');
    assert.strictEqual(t.store['/hrPrivate/raises/' + mid.raise.id], undefined); assert.strictEqual(t.run('hrSalaryGet("w1")'), 8000000);
    ok('Nhập bù ngày cũ đúng thứ tự; xoá bản ghi lịch sử không đổi lương hiện tại'); }

  // 19. Mất mạng: lịch sử tăng lương không mất, tải server cũ không đè; non-Admin không thấy / không ghi
  { const t = setup({workers: [{id: 'w1', name: 'An'}], failWrites: true}); t.run('hrSalarySet("w1", 5000000)');
    const r = t.run('hrRaiseAdd({workerId:"w1",date:"2020-01-01",to:"6000000"})'); await new Promise(x => setTimeout(x, 5));
    await t.run('hrSalaryFetch()'); assert.strictEqual(t.run('hrRaiseList("w1").length'), 1); assert.strictEqual(t.run('hrSalaryGet("w1")'), 6000000);
    t.st.fail = false; assert.strictEqual(await t.run('hrSalaryFlush()'), true); assert.strictEqual(t.store['/hrPrivate/raises/' + r.raise.id].to, 6000000);
    // đăng xuất + người khác
    t.run('hrSalaryOnLogout()'); assert.strictEqual(t.ls['dp_hr_raises_v1'], undefined); t.ctx.currentUser = {id: 'u2', role: 'staff'};
    assert.strictEqual(t.run('hrRaiseList().length'), 0); assert.strictEqual(t.run('hrRaiseLast("w1")'), null);
    const x = t.run('hrRaiseAdd({workerId:"w1",date:"2020-01-01",to:"9000000"})'); assert(!x.ok); assert.strictEqual(t.run('hrRaiseDelete("' + r.raise.id + '")'), false);
    ok('Lịch sử tăng lương: không mất khi mất mạng, xoá khi đăng xuất, non-Admin không đọc/ghi được'); }

  console.log('\nhr-salary.test: ' + n + ' nhóm kiểm thử đạt');
})().catch(e => { console.error('✗', e); process.exit(1); });
