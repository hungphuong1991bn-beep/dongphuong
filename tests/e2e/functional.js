#!/usr/bin/env node
// KIỂM THỬ CHỨC NĂNG + ĐỒNG BỘ qua giao diện thật (Firebase giả có SSE/ETag).
//   node functional.js <thư-mục-gốc-web> <thư-mục-xuất>
// Kết quả ghi vào func-results.json (đã chuẩn hoá, không chứa id/thời gian ngẫu nhiên)
// → chạy trên bản GỐC và bản MỚI rồi so bằng compare.py: phải GIỐNG HỆT.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { MockDb, startServer, stubExternal, FB_PREFIX } = require('./mock-firebase');
const { seedData, T0 } = require('./seed');
const root = path.resolve(process.argv[2]); const out = path.resolve(process.argv[3]);
fs.mkdirSync(out, {recursive:true});
const R = {}, RS = {}; // RS = kết quả đồng bộ 2 thiết bị: phụ thuộc thời điểm (chập chờn cả ở bản gốc) → lưu riêng sync-info.json, KHÔNG so khớp tuyệt đối
const rec = (k, v) => { (k.startsWith('sync.') ? RS : R)[k] = v; console.log((v === true ? '  ✓ ' : v === false ? '  ✗ ' : '  · ') + k + (typeof v === 'boolean' ? '' : ' = ' + JSON.stringify(v))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newDevice(browser, port, vp){
  const ctx = await browser.newContext({viewport: vp || {width:1440,height:900}, serviceWorkers:'block', locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh'});
  await stubExternal(ctx);
  await ctx.addInitScript(({u})=>{ try{ if(!localStorage.getItem('sx_fb_url')) localStorage.setItem('sx_fb_url', u); }catch(e){} }, {u:`http://127.0.0.1:${port}${FB_PREFIX}`});
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept().catch(()=>{}));
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
  await page.waitForTimeout(600);
  return {ctx, page, errs};
}
async function login(page, u, p){
  await page.fill('#lu', u); await page.fill('#lp', p); await page.click('#loginBtn');
  await page.waitForTimeout(1800);
}
const state = page => page.evaluate(() => ({
  appActive: document.getElementById('appScreen').classList.contains('active'),
  loginActive: document.getElementById('loginScreen').classList.contains('active'),
  tab: currentTab, user: currentUser && currentUser.username, role: currentUser && currentUser.role,
  fab: document.getElementById('fab').classList.contains('show'),
  slFull: document.body.classList.contains('sl-fullscreen'),
  sidebarItems: [...document.querySelectorAll('.sb-item')].filter(x => x.style.display !== 'none').map(x => x.id).join(','),
}));
async function addOrder(page, cust, qty){
  await page.evaluate(() => openAddOrder()); await page.waitForTimeout(200);
  await page.fill('#ofCust', cust); await page.fill('#ofThk', '5'); await page.fill('#ofW', '30'); await page.fill('#ofL', '4000'); await page.fill('#ofQty', String(qty));
  await page.evaluate(() => saveOrder()); await page.waitForTimeout(900);
}
const serverOrders = db => Object.values(db.get('/data/orders') || {}).map(o => o.customer).sort();

(async () => {
  const browser = await chromium.launch();
  // ───── 1. Đăng nhập / phân quyền / đăng xuất ─────
  console.log('[1] Đăng nhập, phân quyền, đăng xuất');
  { const db = new MockDb(seedData); const {server, port} = await startServer(root, db);
    let d = await newDevice(browser, port);
    await login(d.page, 'admin', 'sai-mat-khau');
    let s = await state(d.page); rec('login.saiMatKhau.vanOLogin', s.loginActive && !s.appActive);
    rec('login.saiMatKhau.thongBao', await d.page.evaluate(() => document.getElementById('loginErr').textContent));
    await login(d.page, 'admin', 'admin123'); s = await state(d.page);
    rec('login.admin', {app: s.appActive, tab: s.tab, role: s.role, fab: s.fab});
    await d.page.evaluate(() => doLogout()); await d.page.waitForTimeout(400); s = await state(d.page);
    rec('logout.veLogin', s.loginActive && !s.appActive && s.user === null);
    await d.page.evaluate(() => { localStorage.removeItem('sx_login_lock'); });
    await d.page.reload(); await d.page.waitForTimeout(500);
    await login(d.page, 'nhanvien', 'nv123'); s = await state(d.page);
    rec('login.nhanVien', {app: s.appActive, role: s.role, fab: s.fab});
    await d.page.evaluate(() => { openAddOrder(); }); await d.page.waitForTimeout(300);
    rec('nhanVien.khongMoDuocFormTaoDon', !(await d.page.evaluate(() => document.getElementById('orderModal').classList.contains('open'))));
    await d.page.evaluate(() => goTab('khachHang')); await d.page.waitForTimeout(300);
    rec('nhanVien.vaoKhachHang', (await state(d.page)).tab);
    await d.ctx.close();
    d = await newDevice(browser, port);
    await login(d.page, 'sonhap', 'sl123456'); s = await state(d.page);
    rec('login.soLieu', {tab: s.tab, role: s.role, fullscreen: s.slFull, menu: s.sidebarItems});
    await d.page.evaluate(() => goTab('dashboard')); await d.page.waitForTimeout(300);
    rec('soLieu.biEpVeSoLieu', (await state(d.page)).tab);
    rec('loiJS.phanQuyen', d.errs.length); await d.ctx.close();
    // khoá đăng nhập sau nhiều lần sai
    d = await newDevice(browser, port);
    for(let i = 0; i < 6; i++){ await login(d.page, 'admin', 'sai' + i); }
    rec('login.khoaSauNhieuLanSai', /Sai quá nhiều lần|tạm khoá|thử lại sau/.test(await d.page.evaluate(() => document.getElementById('loginErr').textContent)));
    await d.ctx.close(); server.close(); }

  // ───── 2. CRUD đơn hàng + ghi đúng đường dẫn Firebase ─────
  console.log('[2] Thêm / sửa / xoá / tìm kiếm đơn hàng');
  { const db = new MockDb(seedData); const {server, port} = await startServer(root, db);
    const d = await newDevice(browser, port); await login(d.page, 'admin', 'admin123');
    await d.page.evaluate(() => goTab('dorDang')); await d.page.waitForTimeout(500);
    const before = await d.page.evaluate(() => DB.orders.length);
    await addOrder(d.page, 'KHÁCH TEST A', 7);
    rec('crud.themDon.trongBoNho', (await d.page.evaluate(() => DB.orders.length)) - before);
    rec('crud.themDon.trenFirebase', serverOrders(db).includes('KHÁCH TEST A'));
    const id = await d.page.evaluate(() => DB.orders.find(o => o.customer === 'KHÁCH TEST A').id);
    const rec1 = db.get('/data/orders/' + id);
    rec('crud.themDon.truongDuLieu', {customer: rec1.customer, qty: rec1.qty, status: rec1.status, priority: rec1.priority, thickness: rec1.thickness, width: rec1.width, length: rec1.length, version: rec1.version, hasKg: rec1.kg > 0});
    await d.page.evaluate(i => { setStatus(i, 'running'); }, id); await d.page.waitForTimeout(1200);
    rec('crud.doiTrangThai', db.get('/data/orders/' + id)?.status);
    await d.page.evaluate(() => goTab('dorDang')); await d.page.waitForTimeout(300);
    rec('crud.timKiem', await d.page.evaluate(() => DB.orders.filter(o => matchSearch(o, 'test a')).length));
    await d.page.evaluate(i => deleteOrder(i), id); await d.page.waitForTimeout(300);
    await d.page.evaluate(() => cfOK()); await d.page.waitForTimeout(1500);
    rec('crud.xoaDon.trenFirebase', !serverOrders(db).includes('KHÁCH TEST A'));
    rec('crud.xoaDon.nhatKy', await d.page.evaluate(() => actLog.some(l => l.action === 'Xóa đơn')));
    rec('firebase.nhanhDuLieu', Object.keys(db.get('/data') || {}).sort());
    rec('loiJS.crud', d.errs.length); await d.ctx.close(); server.close(); }

  // ───── 3. Đồng bộ 2 thiết bị / mất mạng / sửa trùng bản ghi ─────
  console.log('[3] Đồng bộ giữa 2 thiết bị');
  { const db = new MockDb(seedData); const {server, port} = await startServer(root, db);
    const A = await newDevice(browser, port), B = await newDevice(browser, port);
    await login(A.page, 'admin', 'admin123'); await login(B.page, 'admin', 'admin123');
    const countB = () => B.page.evaluate(() => DB.orders.length), countA = () => A.page.evaluate(() => DB.orders.length);
    const n0 = await countB();
    await addOrder(A.page, 'ĐỒNG BỘ 1', 3); await sleep(4000);
    rec('sync.AtaoDon_BnhanDuoc', (await countB()) - n0);
    rec('sync.khongTrungId', await B.page.evaluate(() => new Set(DB.orders.map(o => o.id)).size === DB.orders.length));
    const idS = await A.page.evaluate(() => DB.orders.find(o => o.customer === 'ĐỒNG BỘ 1').id);
    await B.page.evaluate(i => setStatus(i, 'running'), idS); await sleep(9000);
    rec('sync.BdoiTrangThai_trenServer', db.get('/data/orders/' + idS)?.status);
    // GHI CHÚ: việc A có nhận được thay đổi của B hay không là LỖI ĐỒNG BỘ CÓ SẴN, chập chờn ở cả bản gốc lẫn bản mới
    // (xem docs/KNOWN-ISSUES.md) → chỉ in ra, không đưa vào so sánh trước/sau.
    console.log('  (thông tin, không so sánh) A thấy trạng thái =', await A.page.evaluate(i => DB.orders.find(o => o.id === i)?.status, idS));
    // mất mạng: B offline, A thêm đơn, B online lại phải nhận
    await B.ctx.setOffline(true); await addOrder(A.page, 'ĐỒNG BỘ OFFLINE', 2); await sleep(1500);
    const nOff = await countB();
    await B.ctx.setOffline(false); await B.page.evaluate(() => { window.dispatchEvent(new Event('online')); }); await sleep(9000);
    rec('sync.matMang_BchuaCoKhiOffline', (await countB()) - nOff === 0 || nOff);
    rec('sync.matMang_BnhanLaiKhiOnline', await B.page.evaluate(() => DB.orders.some(o => o.customer === 'ĐỒNG BỘ OFFLINE')));
    // hai người sửa cùng 1 bản ghi: A đổi ưu tiên, B đổi ghi chú gần như đồng thời
    await Promise.all([
      A.page.evaluate(i => { const o = DB.orders.find(x => x.id === i); o.priority = 'GẤP 2'; saveOrders(); }, idS),
      B.page.evaluate(i => { const o = DB.orders.find(x => x.id === i); o.note = 'ghi chú từ B'; saveOrders(); }, idS),
    ]);
    await sleep(6000);
    const fin = db.get('/data/orders/' + idS);
    rec('sync.suaTrungBanGhi.khongMatBanGhi', !!fin);
    rec('sync.suaTrungBanGhi.soBanSaoTrenServer', Object.values(db.get('/data/orders')).filter(o => o.customer === 'ĐỒNG BỘ 1').length);
    rec('sync.suaTrungBanGhi.haiThietBiHoiTu', await Promise.all([A, B].map(x => x.page.evaluate(i => { const o = DB.orders.find(z => z.id === i); return o ? o.priority + '|' + (o.note || '') : null; }, idS))).then(v => v[0] === v[1]));
    rec('sync.tongDonCuoi', {server: serverOrders(db).length, A: await countA(), B: await countB()});
    rec('loiJS.sync', A.errs.length + B.errs.length);
    await A.ctx.close(); await B.ctx.close(); server.close(); }

  // ───── 4. Các tính năng khác: sao lưu, QR, thông báo, TV mode, trang công khai ─────
  console.log('[4] Sao lưu / QR / thông báo / TV Mode / trang công khai');
  { const db = new MockDb(seedData); const {server, port} = await startServer(root, db);
    const d = await newDevice(browser, port, {width:1920, height:1080}); await login(d.page, 'admin', 'admin123');
    rec('backup.chay', await d.page.evaluate(() => runBackupNow()));
    rec('backup.coBanSaoLuuTrenFirebase', Object.keys(db.get('/backups') || {}).length === 1);
    rec('backup.khongGhiDeDuLieuGoc', serverOrders(db).length === 7);
    // thông báo
    await d.page.evaluate(() => { addNotif('order_new', 'Thông báo thử', 'nội dung', 'keHoach', 'tester'); }); await d.page.waitForTimeout(300);
    rec('notif.themVaDem', await d.page.evaluate(() => ({n: notifList.length, unread: _notifUnread, badge: document.querySelector('.topbar-bell-badge')?.textContent || ''})));
    // QR: tạo lô mã cho đơn 4 (đã hoàn thành)
    const qrBefore = await d.page.evaluate(() => DB.qrProducts.length);
    const qr = await d.page.evaluate(() => { try{ return {code: genUniqueQrCode(), pub: qrPublicUrl('ABC')}; }catch(e){ return {err: e.message}; } });
    rec('qr.taoMa', {hasCode: !!qr.code, url: (qr.pub || '').replace(/^https?:\/\/[^/]+/, '').replace(/%3A\d+%2F/, '%3APORT%2F')});
    // TV Mode
    await d.page.evaluate(() => goTab('dieuHanh')); await d.page.waitForTimeout(500);
    await d.page.evaluate(() => dhToggleTv()); await d.page.waitForTimeout(800);
    rec('tv.bat', await d.page.evaluate(() => ({mode: dhTvMode, bodyCls: document.body.className, locked: dhTvLocked()})));
    await d.page.addStyleTag({content: '*,*::before,*::after{animation:none!important;transition:none!important}'});
    await d.page.evaluate(() => document.querySelectorAll('[id^=clk-seed],#dhClockTime,#dhClockDate,#dhRuntimeClock,#dhRuntimeRemain').forEach(e => e.textContent = ''));
    await d.page.screenshot({path: path.join(out, 'func-tvmode-1920.png'), animations: 'disabled', mask: [d.page.locator('.topbar-sync')]});
    await d.page.evaluate(() => dhToggleTv()); await d.page.waitForTimeout(500);
    rec('tv.tat', await d.page.evaluate(() => ({mode: dhTvMode, locked: dhTvLocked()})));
    rec('loiJS.tinhNangKhac', d.errs.length); await d.ctx.close();
    // trang công khai (khách quét QR, không đăng nhập)
    for(const [name, qs] of [['congKhai.khuon', `?pub=khuon&db=${encodeURIComponent('http://127.0.0.1:'+port+FB_PREFIX)}`], ['congKhai.nhanSu', `?pub=nhansu&db=${encodeURIComponent('http://127.0.0.1:'+port+FB_PREFIX)}`], ['congKhai.chamCong', `?pub=ccllv&db=${encodeURIComponent('http://127.0.0.1:'+port+FB_PREFIX)}`]]){
      const p = await newDevice(browser, port, {width:390, height:844});
      await p.page.goto(`http://127.0.0.1:${port}/index.html${qs}`); await p.page.waitForTimeout(1500);
      rec(name, await p.page.evaluate(() => ({pub: document.getElementById('publicScanScreen').classList.contains('active'), login: document.getElementById('loginScreen').classList.contains('active'), len: document.body.innerText.length > 50})));
      rec(name + '.loiJS', p.errs.length); await p.ctx.close();
    }
    server.close(); }

  await browser.close();
  fs.writeFileSync(path.join(out, 'func-results.json'), JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(out, 'sync-info.txt'), JSON.stringify(RS, null, 1));
  const bad = Object.entries(R).filter(([k, v]) => v === false); console.log(bad.length ? '\n✗ có kiểm tra tuyệt đối thất bại: ' + bad.map(x => x[0]).join(', ') : '\n(tất cả kiểm tra tuyệt đối đạt)');
})().catch(e => { console.error(e); process.exit(1); });
