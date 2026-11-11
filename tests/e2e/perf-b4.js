#!/usr/bin/env node
// Bước 4 — đo hiệu năng: khởi động, chuyển tab, request/SSE, listener & timer bị tích luỹ, bộ nhớ.
//   CHROMIUM_PATH=... node perf-b4.js <thư-mục-gốc-web> [file.json]
// Dùng mock Firebase + dữ liệu mẫu cố định (không chạm Firebase thật). Giữ nguyên dữ liệu.
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {seedData}=require('./seed');
const {MockDb,startServer,stubExternal,FB_PREFIX}=require('./mock-firebase');
const root=path.resolve(process.argv[2]||'.'), outFile=process.argv[3]?path.resolve(process.argv[3]):null;
const TABS=['dashboard','dorDang','keHoach','dieuHanh','hoanThanh','baoCao','khachHang','qrCode','nhanSu','lichLamViec','chamCong','baoTriMay','khuon','checkSheet','soLieu','nhatKy','settings','controlPlan','truyXuat'];
const CYCLES=+(process.env.CYCLES||4);
(async()=>{
  const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--headless=new','--disable-gpu','--enable-precise-memory-info','--js-flags=--expose-gc']});
  const db=new MockDb(seedData); const {server,port}=await startServer(root,db);
  const ctx=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block',locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});
  await stubExternal(ctx);
  await ctx.addInitScript(({u})=>{ try{localStorage.setItem('sx_fb_url',u)}catch(e){}
    // đếm listener & timer đang sống (nhận diện trùng theo target+type+nội dung hàm)
    const reg=new Map(); window.__lst=reg; window.__timers=new Set();
    const key=(t,type,fn)=>(t===window?'win':t===document?'doc':t===document.body?'body':(t.id?'#'+t.id:t.nodeName))+'|'+type+'|'+String(fn).slice(0,120);
    const add=EventTarget.prototype.addEventListener, rem=EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener=function(type,fn,o){ if(fn&&(this===window||this===document||this===document.body||this===document.documentElement)){ const k=key(this,type,fn); const m=reg.get(k)||new Set(); m.add(fn); reg.set(k,m);} return add.call(this,type,fn,o); };
    EventTarget.prototype.removeEventListener=function(type,fn,o){ if(fn){ const m=reg.get(key(this,type,fn)); if(m) m.delete(fn);} return rem.call(this,type,fn,o); };
    const si=window.setInterval, ci=window.clearInterval; window.setInterval=function(f,t,...a){const id=si.call(window,f,t,...a);window.__timers.add(id);return id}; window.clearInterval=function(id){window.__timers.delete(id);return ci.call(window,id)};
  },{u:`http://127.0.0.1:${port}${FB_PREFIX}`});
  const page=await ctx.newPage(); const cdp=await ctx.newCDPSession(page);
  let reqs=[],sse=0,exAt=null; const tStart=Date.now(); page.on('request',r=>{ if(/exceljs/.test(r.url())&&exAt===null) exAt=Date.now()-tStart; }); page.on('request',r=>{ if(r.url().includes(FB_PREFIX)){ reqs.push(r.method()+' '+r.url().split(FB_PREFIX)[1].slice(0,40)); if((r.headers()['accept']||'').includes('event-stream')) sse++; } });
  const errors=[]; page.on('pageerror',e=>errors.push(e.message)); 
  const t0=Date.now(); await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'domcontentloaded'});
  const loadMs=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd||0)}});
  await page.waitForSelector('#loginBtn'); const loginReadyMs=Date.now()-t0;
  await page.fill('#lu','admin'); await page.fill('#lp','admin123'); const t1=Date.now(); await page.click('#loginBtn');
  await page.waitForFunction(()=>document.getElementById('appScreen').classList.contains('active')); const appReadyMs=Date.now()-t1;
  await page.waitForTimeout(2000);
  const res=await page.evaluate(()=>{const r=performance.getEntriesByType('resource');const js=r.filter(x=>x.name.endsWith('.js')),css=r.filter(x=>x.name.endsWith('.css'));return {scripts:js.length,styles:css.length,jsBytes:js.reduce((a,x)=>a+(x.transferSize||x.encodedBodySize||0),0),cssBytes:css.reduce((a,x)=>a+(x.transferSize||x.encodedBodySize||0),0)}});
  const snap=async()=>{ await cdp.send('HeapProfiler.collectGarbage'); const h=await page.evaluate(()=>({heapMB:+(performance.memory.usedJSHeapSize/1048576).toFixed(1),nodes:document.getElementsByTagName('*').length,timers:window.__timers.size,lst:[...window.__lst.values()].reduce((a,s)=>a+s.size,0),dupLst:[...window.__lst.entries()].filter(([k,s])=>s.size>1).map(([k,s])=>s.size+'x '+k.slice(0,90))})); return h; };
  const base=await snap();
  const perTab={}; const cycles=[];
  for(let c=0;c<CYCLES;c++){
    for(const tab of TABS){
      reqs=[]; const before=sse;
      const ms=await page.evaluate(async t=>{const s=performance.now(); goTab(t); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); return performance.now()-s},tab);
      await page.waitForTimeout(120);
      const p=perTab[tab]||(perTab[tab]={ms:[],reqs:[]}); p.ms.push(Math.round(ms)); p.reqs.push(reqs.length);
      if(sse!==before) p.newSSE=(p.newSSE||0)+(sse-before);
    }
    cycles.push(await snap());
  }
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
  const out={exceljsRequestedAtMs:exAt,loadMs,loginReadyMs,appReadyMs,resources:res,base,cycles,sseTotal:sse,errors,
    tabs:Object.fromEntries(Object.entries(perTab).map(([k,v])=>[k,{first:v.ms[0],median:med(v.ms),max:Math.max(...v.ms),reqsPerSwitch:med(v.reqs),newSSE:v.newSSE||0}]))};
  if(outFile) fs.writeFileSync(outFile,JSON.stringify(out,null,1));
  console.log('KHỞI ĐỘNG: DCL',loadMs.dcl,'ms | load',loadMs.load,'ms | login hiện',loginReadyMs,'ms | đăng nhập→app',appReadyMs,'ms');
  console.log('ExcelJS được yêu cầu sau',exAt,'ms kể từ lúc mở trang');console.log('TÀI NGUYÊN:',JSON.stringify(res)); console.log('SSE mở tổng cộng:',sse);
  console.log('CHUYỂN TAB (ms, lần đầu/median/max | request FB/lần chuyển):'); for(const [k,v] of Object.entries(out.tabs)) console.log('  '+k.padEnd(12),String(v.first).padStart(5),String(v.median).padStart(5),String(v.max).padStart(5),'|',v.reqsPerSwitch,v.newSSE?('SSE+'+v.newSSE):'');
  console.log('TÍCH LUỸ qua',CYCLES,'vòng 19 tab:'); console.log('  base  ',JSON.stringify({...base,dupLst:base.dupLst.length})); cycles.forEach((c,i)=>console.log('  vòng',i+1,JSON.stringify({...c,dupLst:c.dupLst.length})));
  const last=cycles[cycles.length-1]; if(last.dupLst.length){console.log('LISTENER TRÙNG (cùng target/type/hàm):');last.dupLst.slice(0,12).forEach(x=>console.log('  ',x));}
  console.log('LỖI JS:',errors.length,errors.slice(0,3));
  await browser.close(); server.close();
})();
