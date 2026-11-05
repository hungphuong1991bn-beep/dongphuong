#!/usr/bin/env node
// Đo độ ổn định đồng bộ A↔B nhiều vòng, ghi lại trạng thái nội bộ khi nhận chậm/không nhận.
//   node sync-stress.js <thư-mục-gốc-web> [số-vòng=8] [giây-chờ=6]
const path = require('path');
const { chromium } = require('playwright');
const { MockDb, startServer, stubExternal, FB_PREFIX } = require('./mock-firebase');
const { seedData } = require('./seed');
const root = path.resolve(process.argv[2]); const ROUNDS = +process.argv[3] || 8; const WAIT = (+process.argv[4] || 6) * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function dev(browser, port){
  const ctx = await browser.newContext({viewport:{width:1440,height:900}, serviceWorkers:'block'});
  await stubExternal(ctx);
  await ctx.addInitScript(({u})=>{ try{ localStorage.setItem('sx_fb_url', u); }catch(e){} }, {u:`http://127.0.0.1:${port}${FB_PREFIX}`});
  const page = await ctx.newPage(); page.on('dialog', d=>d.accept().catch(()=>{}));
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'}); await page.waitForTimeout(600);
  await page.fill('#lu','admin'); await page.fill('#lp','admin123'); await page.click('#loginBtn'); await page.waitForTimeout(2000);
  await page.evaluate(TRACE); return {ctx, page};
}
const TRACE = ()=>{ window.__tr=[]; const t0=performance.now(); const L=(k,x)=>window.__tr.push(Math.round(performance.now()-t0)+'ms '+k+(x?' '+x:'')+' pend='+_pendingSaves+' has='+(window.__w&&DB.orders.some(o=>o.customer===window.__w)?1:0));
  { const fr=window.fbRead; window.fbRead=async function(p){ L('>fbRead',p); const v=await fr.call(this,p); let h=''; if(p==='/data'&&window.__w){ const os=v&&v.orders?Object.values(v.orders):[]; h=' srvHas='+(os.some(o=>o.customer===window.__w)?1:0); } L('<fbRead',p+h); return v; }; }
  for(const n of ['handleRealtimeChange','doPoll','applySingleOrderChange','applyFieldChange','applyDataSnapshot','beginSave','endSave']){ const f=window[n]; if(typeof f!=='function') continue;
    window[n]=function(...a){ const lab=n==='handleRealtimeChange'?String(a[0]):(n==='applySingleOrderChange'?String(a[0]).slice(-5)+(a[1]==null?' DEL':''):''); L('>'+n,lab);
      const r=f.apply(this,a); if(r&&r.then) return r.then(v=>{ L('<'+n+' (async)'); return v; }); if(n==='applyDataSnapshot') L('<'+n,'changed='+r+' n='+DB.orders.length); return r; }; } };
const probe = p => p.evaluate(()=>({pend:_pendingSaves, sse:_sseConnected, sseObj:!!_sse, poll:!!_pollTimer, n:DB.orders.length, hidden:document.hidden, tr:window.__tr.slice(-60)}));
async function add(p, name){
  await p.evaluate(()=>openAddOrder()); await p.waitForTimeout(150);
  await p.fill('#ofCust', name); await p.fill('#ofThk','5'); await p.fill('#ofW','30'); await p.fill('#ofL','4000'); await p.fill('#ofQty','3');
  await p.evaluate(()=>saveOrder());
}
(async()=>{
  const browser = await chromium.launch(); const db = new MockDb(seedData); const {server, port} = await startServer(root, db);
  const A = await dev(browser, port), B = await dev(browser, port); const fails = []; let ok=0, lat=[];
  for(let i=0;i<ROUNDS;i++){
    const [from, to, tag] = i%2 ? [B.page, A.page, 'B→A'] : [A.page, B.page, 'A→B']; const name = 'STRESS '+i;
    await Promise.all([from,to].map(p=>p.evaluate(n=>{ window.__w=n; window.__tr.length=0; }, name))); const t0 = Date.now(); await add(from, name); let got=false;
    while(Date.now()-t0 < WAIT){ if(await to.evaluate(n=>DB.orders.some(o=>o.customer===n), name)){ got=true; break; } await sleep(100); }
    if(got){ ok++; lat.push(Date.now()-t0); } else fails.push({round:i, tag, from:await probe(from), to:await probe(to), server:Object.values(db.get('/data/orders')||{}).some(o=>o.customer===name)});
    await sleep(500);
  }
  console.log(`  ${ok}/${ROUNDS} vòng nhận đủ đơn · ${fails.length} lỗi · trễ nhận ${lat.length?Math.min(...lat)+'–'+Math.max(...lat)+'ms':'—'}`);
  if(process.env.STRESS_TRACE) console.log(JSON.stringify(fails, null, 1)); else fails.slice(0,3).forEach(f=>console.log('   ✗ vòng', f.round, f.tag, 'server có đơn =', f.server, '· máy nhận:', JSON.stringify({pend:f.to.pend, sse:f.to.sse, poll:f.to.poll, n:f.to.n})));
  await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
