#!/usr/bin/env node
// Kiểm tra giao diện tự động (không sửa dữ liệu): tràn ngang từng tab ở 3 kích thước màn hình,
// thứ tự các phần tử của Global Header, danh sách nhóm menu Sidebar, lỗi console.
//   node ui-audit.js <thư-mục-gốc-web> [file-kết-quả.json]
// Dùng cùng mock Firebase và dữ liệu mẫu cố định với capture.js (không chạm Firebase thật).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { seedData, T0 } = require('./seed');
const { MockDb, startServer, stubExternal, FB_PREFIX } = require('./mock-firebase');

const root = path.resolve(process.argv[2] || '.');
const outFile = process.argv[3] ? path.resolve(process.argv[3]) : null;
const TABS = ['dashboard','dorDang','keHoach','dieuHanh','hoanThanh','baoCao','khachHang','qrCode','nhanSu','lichLamViec','chamCong','baoTriMay','khuon','checkSheet','soLieu','nhatKy','settings','controlPlan','truyXuat'];
const VIEWPORTS = {desktop:{width:1440,height:900}, laptop:{width:1180,height:760}, tablet:{width:820,height:1180}, mobile:{width:390,height:844}, mobileSmall:{width:360,height:640}};

(async()=>{
  const browser = await chromium.launch();
  const report = {overflow:[], header:{}, sidebar:{}, errors:[]};
  for(const [vpName, vp] of Object.entries(VIEWPORTS)){
    const db = new MockDb(seedData);
    const {server, port} = await startServer(root, db);
    const ctx = await browser.newContext({viewport:vp, serviceWorkers:'block', locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh'});
    await stubExternal(ctx);
    await ctx.addInitScript(({u})=>{ try{ localStorage.setItem('sx_fb_url', u); }catch(e){} }, {u:`http://127.0.0.1:${port}${FB_PREFIX}`});
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(T0 + 3600000*3));
    page.on('pageerror', e=>report.errors.push(`[${vpName}] pageerror: ${e.message}`));
    page.on('console', m=>{ if(m.type()==='error') report.errors.push(`[${vpName}] console.error: ${m.text().slice(0,200)}`); });
    await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
    await page.waitForTimeout(600);
    await page.fill('#lu','admin'); await page.fill('#lp','admin123'); await page.click('#loginBtn');
    await page.waitForFunction(()=>document.getElementById('appScreen').classList.contains('active'), null, {timeout:8000});
    await page.waitForTimeout(2000);

    // Thứ tự Global Header (trái → phải, theo toạ độ thật) — chỉ phần tử đang hiển thị
    report.header[vpName] = await page.evaluate(()=>{
      const ids = {title:['pageTitle','pageTitleMobile'], date:['clockDate','clockDateMobile'], time:['clockTime','clockTimeMobile'], sync:['syncDot','mhSyncDot'], search:['tbGlobalSearch','tbGlobalSearchMobile','topbarMhSearchBtn'], bell:['bellBtn'], account:['avatarBtn','mhAvatarBtn']};
      const rows=[];
      for(const [k,list] of Object.entries(ids)){
        for(const id of list){
          const el=document.getElementById(id); if(!el) continue;
          const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
          if(r.width>0 && r.height>0 && cs.visibility!=='hidden'){ rows.push({k, id, x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width)}); break; }
        }
      }
      return rows.sort((a,b)=>a.y-b.y||a.x-b.x);
    });
    if(vpName==='desktop') report.sidebar = await page.evaluate(()=>[...document.querySelectorAll('#sidebar .sb-nav > *')].filter(e=>e.offsetParent!==null||e.classList.contains('sb-section')).map(e=>e.classList.contains('sb-section')?('## '+e.textContent.trim()):('   '+e.id+' | '+e.textContent.trim().replace(/\s+/g,' '))));

    for(const tab of TABS){
      try{
        await page.evaluate(t=>goTab(t), tab);
        await page.waitForTimeout(500);
        const m = await page.evaluate(()=>{
          const W = document.documentElement.clientWidth;
          const de = document.documentElement, b = document.body, mw = document.getElementById('mainWrap'), mc = document.getElementById('mc');
          const res = {W, doc:de.scrollWidth, body:b.scrollWidth, main:mw?mw.scrollWidth:0, mainClient:mw?mw.clientWidth:0, mc:mc?mc.scrollWidth:0, mcClient:mc?mc.clientWidth:0, off:[]};
          const root = mc || document.body;
          root.querySelectorAll('*').forEach(el=>{
            const r = el.getBoundingClientRect(); if(r.width===0||r.height===0) return;
            const cs = getComputedStyle(el); if(cs.position==='fixed'||cs.visibility==='hidden'||cs.display==='none') return;
            // bỏ phần tử nằm trong vùng tự cuộn ngang có chủ đích
            let p = el.parentElement, scrolled=false;
            while(p && p!==root){ const ps=getComputedStyle(p); if(/(auto|scroll|hidden)/.test(ps.overflowX) && p.scrollWidth>p.clientWidth){ scrolled=true; break; } p=p.parentElement; }
            if(!scrolled && r.right > W+1) res.off.push((el.id?'#'+el.id:el.tagName.toLowerCase())+'.'+String(el.className).split(' ').slice(0,2).join('.')+' right='+Math.round(r.right));
          });
          res.off = res.off.slice(0,4);
          return res;
        });
        const bad = (m.doc>m.W+1) || (m.main>m.mainClient+1) || m.off.length>0;
        if(bad) report.overflow.push({vp:vpName, tab, ...m});
      }catch(e){ report.errors.push(`[${vpName}] tab ${tab}: ${e.message.slice(0,160)}`); }
    }
    server.close(); await ctx.close();
  }
  await browser.close();
  if(outFile) fs.writeFileSync(outFile, JSON.stringify(report,null,1));
  console.log('=== SIDEBAR (desktop) ==='); report.sidebar.forEach(l=>console.log(l));
  console.log('\n=== GLOBAL HEADER order ==='); for(const [vp,rows] of Object.entries(report.header)) console.log(vp.padEnd(12), rows.map(r=>r.k+'@'+r.x+','+r.y).join(' | '));
  console.log('\n=== OVERFLOW ('+report.overflow.length+') ==='); report.overflow.forEach(o=>console.log(`${o.vp}:${o.tab}  W=${o.W} doc=${o.doc} main=${o.main}/${o.mainClient} off=[${o.off.join('; ')}]`));
  console.log('\n=== ERRORS ('+report.errors.length+') ==='); report.errors.slice(0,15).forEach(e=>console.log(e));
})().catch(e=>{ console.error(e); process.exit(1); });
