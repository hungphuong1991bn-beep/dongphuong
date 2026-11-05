#!/usr/bin/env node
// Chụp "dấu vân tay" giao diện + hành vi của 1 bản build để so sánh TRƯỚC/SAU refactor.
//   node capture.js <thư-mục-gốc-web> <thư-mục-xuất> [--no-shots]
// Xuất: DOM từng tab, computed-style, ảnh chụp 3 kích thước màn hình, lỗi console, request Firebase.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { seedData, T0 } = require('./seed');

const root = path.resolve(process.argv[2]); const out = path.resolve(process.argv[3]);
fs.mkdirSync(out, {recursive:true});
const { MockDb, startServer, stubExternal, FB_PREFIX } = require('./mock-firebase');
const TABS = ['dashboard','dorDang','keHoach','dieuHanh','hoanThanh','baoCao','khachHang','qrCode','nhanSu','lichLamViec','chamCong','baoTriMay','khuon','checkSheet','soLieu','nhatKy','settings'];
const VIEWPORTS = {desktop:{width:1440,height:900}, tablet:{width:820,height:1180}, mobile:{width:390,height:844}};

// Chuẩn hoá DOM để so sánh: bỏ <script>/<link stylesheet>/<style>, giữ nguyên mọi thứ còn lại
// Các chuỗi phụ thuộc đồng hồ thật (thời lượng online…) → chuẩn hoá trước khi lưu/so sánh
const norm = s => s.replace(/(Online|⏱) (\d+ (giờ|phút|giây|ngày)( \d+ (phút|giây))?)/g,'$1 <DUR>').replace(/\d+ (giờ|phút|giây|ngày) trước/g,'<AGO> trước').replace(/⏱ [\d:\-]+/g,'⏱ <CLK>');
const SERIALIZE = ()=>{
  const c = document.documentElement.cloneNode(true);
  c.querySelectorAll('script').forEach(s=>s.remove());
  c.querySelectorAll('style').forEach(s=>s.remove());
  c.querySelectorAll('link[rel=stylesheet]').forEach(s=>s.remove());
  // bỏ comment HTML (ghi chú của lập trình viên, không ảnh hưởng hiển thị)
  const w = document.createTreeWalker(c, NodeFilter.SHOW_COMMENT); const cm=[]; while(w.nextNode()) cm.push(w.currentNode); cm.forEach(x=>x.remove());
  // Chỉ báo đồng bộ phụ thuộc thời điểm (SSE bị chặn trong môi trường test → nhấp nháy) → che đi
  const sd = c.querySelector('#syncDot'); if(sd){ sd.removeAttribute('class'); sd.removeAttribute('title'); }
  ['syncLabel','syncTimeAgo'].forEach(id=>{ const e=c.querySelector('#'+id); if(e) e.textContent=''; });
  return c.outerHTML;
};
// Computed style của MỌI phần tử (bắt mọi thay đổi CSS do chuyển file / đổi thứ tự cascade)
// Toàn bộ luật CSS theo đúng thứ tự cascade của mọi stylesheet (trừ Google Fonts)
const CSSOM = ()=>{
  const out = [];
  for(const sh of document.styleSheets){
    if(sh.href && sh.href.includes('googleapis')) continue;
    let rules; try{ rules = sh.cssRules; }catch(e){ out.push('UNREADABLE'); continue; }
    for(const r of rules) out.push(r.cssText);
  }
  return out;
};
const STYLEHASH = ()=>{
  const props = ['display','position','color','background-color','font-family','font-size','font-weight','width','height','margin-top','margin-left','padding-top','padding-left','border-top-width','border-top-color','border-radius','box-shadow','opacity','z-index','overflow-x','flex-direction','gap','transform','line-height','letter-spacing','text-align','visibility','grid-template-columns','background-image'];
  const rows = [];
  document.querySelectorAll('body, body *').forEach(el=>{
    if(el.tagName==='SCRIPT'||el.tagName==='STYLE') return;
    const cs = getComputedStyle(el);
    rows.push((el.id?'#'+el.id:el.tagName)+'.'+(typeof el.className==='string'?el.className:'')+'|'+props.map(p=>cs.getPropertyValue(p)).join(';'));
  });
  return rows;
};

(async()=>{
  const browser = await chromium.launch();
  const report = {errors:[], consoleWarn:[], tabs:{}, fbWrites:[], resources:[]};
  const noShots = process.argv.includes('--no-shots');

  for(const [vpName, vp] of Object.entries(VIEWPORTS)){
    const db = new MockDb(seedData);
    const {server, port} = await startServer(root, db); const base = `http://127.0.0.1:${port}/index.html`;
    const ctx = await browser.newContext({viewport:vp, deviceScaleFactor:1, serviceWorkers:'block', locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh'});
    await stubExternal(ctx);
    await ctx.addInitScript(({u})=>{ try{ localStorage.setItem('sx_fb_url', u); }catch(e){} }, {u:`http://127.0.0.1:${port}${FB_PREFIX}`});
    // Xác định hoá: Math.random theo hạt giống cố định, Date cố định
    await ctx.addInitScript(()=>{ let s=123456789; Math.random=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(T0 + 3600000*3));
    page.on('pageerror', e=>report.errors.push(`[${vpName}] pageerror: ${e.message}`));
    page.on('console', m=>{ if(m.type()==='error') report.errors.push(`[${vpName}] console.error: ${m.text()}`); if(m.type()==='warning') report.consoleWarn.push(`[${vpName}] ${m.text().slice(0,200)}`); });
    page.on('requestfailed', r=>report.resources.push(`[${vpName}] FAILED ${r.method()} ${r.url().replace(/\?.*/,'').slice(0,120)}`));
    page.on('response', r=>{ if(r.status()>=400 && r.url().startsWith('http://127.0.0.1')) report.errors.push(`[${vpName}] HTTP ${r.status()} ${r.url()}`); });
    await page.goto(base, {waitUntil:'load'});
    // Tắt animation/transition để computed-style không phụ thuộc thời điểm chụp
    // (keyframes được kiểm tra riêng qua CSSOM bên dưới)
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
    await page.waitForTimeout(800);
    if(vpName==='desktop') fs.writeFileSync(path.join(out,'cssom.json'), JSON.stringify(await page.evaluate(CSSOM)));
    fs.writeFileSync(path.join(out,`dom-login-${vpName}.html`), norm(await page.evaluate(SERIALIZE)));
    if(!noShots) await page.screenshot({path:path.join(out,`login-${vpName}.png`), animations:'disabled', mask:[page.locator('.topbar-sync')]});
    // Đăng nhập thật qua giao diện
    await page.fill('#lu','admin'); await page.fill('#lp','admin123'); await page.click('#loginBtn');
    await page.waitForFunction(()=>document.getElementById('appScreen').classList.contains('active'), null, {timeout:8000});
    await page.waitForTimeout(2500);
    for(const tab of TABS){
      await page.evaluate(t=>goTab(t), tab);
      await page.waitForTimeout(700);
      await page.evaluate(()=>document.querySelectorAll('[id^=clk-seed]').forEach(e=>{ e.textContent='⏱ 00:00:00'; })); // đồng hồ chạy theo giờ thật → cố định
      const mc = await page.evaluate(()=>document.getElementById('mc').innerHTML);
      fs.writeFileSync(path.join(out,`mc-${vpName}-${tab}.html`), norm(mc));
      if(vpName==='desktop'){
        fs.writeFileSync(path.join(out,`dom-${vpName}-${tab}.html`), norm(await page.evaluate(SERIALIZE)));
        fs.writeFileSync(path.join(out,`style-${vpName}-${tab}.json`), JSON.stringify(await page.evaluate(STYLEHASH)));
      }
      if(!noShots) await page.screenshot({path:path.join(out,`shot-${vpName}-${tab}.png`), animations:'disabled', mask:[page.locator('.topbar-sync')]});
      report.tabs[`${vpName}:${tab}`] = {mcLen:mc.length};
    }
    // Các lớp phủ dùng chung: modal thêm đơn, panel thông báo
    await page.evaluate(()=>goTab('dorDang')); await page.waitForTimeout(400);
    for(const [name, open, close] of [
      ['orderModal', ()=>openAddOrder(), ()=>closeModal('orderModal')],
      ['notifPanel', ()=>{ document.getElementById('notifPanel').classList.add('open'); document.getElementById('notifOverlay').classList.add('show'); }, ()=>closeNotifPanel()],
    ]){
      try{
        await page.evaluate(open); await page.waitForTimeout(500);
        if(!noShots) await page.screenshot({path:path.join(out,`overlay-${vpName}-${name}.png`), animations:'disabled', mask:[page.locator('.topbar-sync')]});
        fs.writeFileSync(path.join(out,`overlay-${vpName}-${name}.html`), norm(await page.evaluate(SERIALIZE)));
        await page.evaluate(close);
      }catch(e){ report.errors.push(`[${vpName}] overlay ${name}: ${e.message}`); }
    }
    report.fbWrites.push({vp:vpName, writes: db.log.filter(x=>!x.startsWith('GET')).sort()});
    server.close();
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out,'report.json'), JSON.stringify(report,null,1));
  console.log('errors:', report.errors.length); report.errors.slice(0,15).forEach(e=>console.log('  ',e));
  console.log('tabs captured:', Object.keys(report.tabs).length);
})().catch(e=>{ console.error(e); process.exit(1); });
