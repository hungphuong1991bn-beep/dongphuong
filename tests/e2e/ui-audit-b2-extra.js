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
const VIEWPORTS = {w320:{width:320,height:640},w390:{width:390,height:844},w768:{width:768,height:1024},w1024:{width:1024,height:768},w1366:{width:1366,height:768},w1920:{width:1920,height:1080}};

(async()=>{
  const browser = await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--headless=new','--disable-gpu']});
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
    if(vpName==='w1440') report.sidebar = await page.evaluate(()=>[...document.querySelectorAll('#sidebar .sb-nav > *')].filter(e=>e.offsetParent!==null||e.classList.contains('sb-section')).map(e=>e.classList.contains('sb-section')?('## '+e.textContent.trim()):('   '+e.id+' | '+e.textContent.trim().replace(/\s+/g,' '))));

    for(const tab of TABS){
      try{
        await page.evaluate(t=>goTab(t), tab);
        await page.waitForTimeout(500);
        const m = await page.evaluate(()=>{
          const mc=document.getElementById('mc')||document.body, W=document.documentElement.clientWidth, H=window.innerHeight;
          const vis=el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&cs.position!=='fixed'};
          const inScroller=el=>{let p=el.parentElement;while(p&&p!==mc){const o=getComputedStyle(p).overflowX;if(/(auto|scroll)/.test(o))return true;p=p.parentElement}return false};
          const desc=el=>(el.id?'#'+el.id:el.tagName.toLowerCase())+'.'+String(el.className).split(' ').filter(Boolean).slice(0,2).join('.');
          const clip=[],tbl=[],tap=[],modal=[];
          mc.querySelectorAll('*').forEach(el=>{
            if(!vis(el)) return;
            const cs=getComputedStyle(el);
            // chữ bị cắt âm thầm (không có dấu …)
            if(el.children.length===0 && el.textContent.trim().length>2 && /(hidden|clip)/.test(cs.overflowX) && cs.textOverflow!=='ellipsis' && el.scrollWidth>el.clientWidth+2) clip.push(desc(el)+' '+el.scrollWidth+'>'+el.clientWidth+' "'+el.textContent.trim().slice(0,20)+'"');
            if(el.tagName==='TABLE'){ const p=el.parentElement; if(!inScroller(el) && el.getBoundingClientRect().width>p.clientWidth+2) tbl.push(desc(el)+' '+Math.round(el.getBoundingClientRect().width)+'>'+p.clientWidth); }
            if(W<=768 && /^(BUTTON|A|INPUT|SELECT)$/.test(el.tagName) && el.type!=='hidden' && el.type!=='checkbox' && el.type!=='radio'){ const r=el.getBoundingClientRect(); if(r.height<32||r.width<28) tap.push(desc(el)+' '+Math.round(r.width)+'x'+Math.round(r.height)); }
          });
          document.querySelectorAll('.modal,.dp-modal,[role=dialog]').forEach(m=>{ if(vis(m)){const r=m.getBoundingClientRect(); if(r.width>W+1||r.right>W+1) modal.push(desc(m)); } });
          return {clip:clip.slice(0,5),clipN:clip.length,tbl:tbl.slice(0,3),tblN:tbl.length,tapN:tap.length,tap:tap.slice(0,4),modal};
        });
        if(m.clipN||m.tblN||m.tapN>0||m.modal.length) report.overflow.push({vp:vpName,tab,W:0,doc:0,main:0,mainClient:0,off:[],...m});
      }catch(e){ report.errors.push(`[${vpName}] tab ${tab}: ${e.message.slice(0,160)}`); }
    }
    server.close(); await ctx.close();
  }
  await browser.close();
  if(outFile) fs.writeFileSync(outFile, JSON.stringify(report,null,1));
  console.log('=== SIDEBAR (desktop) ==='); (Array.isArray(report.sidebar)?report.sidebar:[]).forEach(l=>console.log(l));
  console.log('\n=== GLOBAL HEADER order ==='); for(const [vp,rows] of Object.entries(report.header)) console.log(vp.padEnd(12), rows.map(r=>r.k+'@'+r.x+','+r.y).join(' | '));
  console.log('\n=== OVERFLOW ('+report.overflow.length+') ==='); report.overflow.forEach(o=>console.log(`${o.vp}:${o.tab} clip=${o.clipN} tbl=${o.tblN} tap=${o.tapN}`, o.clip&&o.clip.length?'CLIP['+o.clip.join(' | ')+']':'', o.tbl&&o.tbl.length?'TBL['+o.tbl.join(' | ')+']':'', o.tap&&o.tap.length?'TAP['+o.tap.join(' | ')+']':'', o.modal&&o.modal.length?'MODAL['+o.modal+']':''));
  console.log('\n=== ERRORS ('+report.errors.length+') ==='); report.errors.slice(0,15).forEach(e=>console.log(e));
})().catch(e=>{ console.error(e); process.exit(1); });
