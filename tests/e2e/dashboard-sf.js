#!/usr/bin/env node
// E2E Tổng quan Smart Factory: dữ liệu mẫu có phiên chạy/QR/sổ → chụp nhiều kích thước + kiểm tra tương tác.
//   node tests/e2e/dashboard-sf.js <thư-mục-gốc> <thư-mục-ảnh>
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {MockDb,startServer,stubExternal,FB_PREFIX}=require('./mock-firebase');
const root=path.resolve(process.argv[2]||'.'), out=path.resolve(process.argv[3]||'/tmp/sf-shots'); fs.mkdirSync(out,{recursive:true});
const H=3600000,D=86400000, now=Date.now(), d0=new Date(); d0.setHours(0,0,0,0); const t0=d0.getTime();
const ds=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const mk=(i,o)=>Object.assign({id:'o'+i,status:'pending',createdAt:now-(i+1)*6*H,customer:'Khách '+i,po:'PO-'+i,type:'Đồng thanh dẹt',qty:100,kg:500+i*40,priority:'GẤP '+(1+i%8),deliveryDate:ds(t0+(i%6-1)*D),version:1,updatedAt:now},o);
const orders=[
 mk(1,{status:'running',stage:'dun',startedAt:now-5*H,doneQty:40,machineAssign:{dun:'m_tj400'},runSessions:[{id:'s1',no:1,stage:'dun',machineId:'m_tj400',startAt:now-5*H,endAt:null,runMs:0}]}),
 mk(2,{status:'running',stage:'rut',startedAt:now-8*H,runSessions:[{id:'s2',no:1,stage:'rut',machineId:'m_rut50',startAt:now-8*H,endAt:now-2*H,runMs:6*H}],accumulatedRunMs:6*H}),
 mk(3,{status:'paused',stage:'rut',pausedAt:now-H,pauseHistory:[{id:'p1',no:1,at:now-H,resumeAt:null,machineId:'m_rut100_1',stage:'rut'}]}),
 mk(4,{status:'done',doneAt:now-2*H,whIn:true,whAt:now-H,kg:1200,deliveryDate:ds(t0)}),
 mk(5,{status:'done',doneAt:now-D-H,kg:800,whIn:true,whAt:now-D,delivered:true,deliveredAt:now-H,deliveryDate:ds(t0-D)}),
 mk(6,{status:'done',doneAt:now-3*D,kg:600,deliveryDate:ds(t0-5*D)}),
 mk(7,{status:'pending',deliveryDate:ds(t0-2*D)}), mk(8,{status:'pending',deliveryDate:''}), mk(9,{status:'pending',deliveryDate:ds(t0+D)}),
 mk(10,{status:'running',stage:'danhbong',kg:0,doneQty:'',qty:50}),
];
const rows=(n,f)=>Object.fromEntries(Array.from({length:n},(_,i)=>{const r=f(i);return [r.id,r];}));
const seed={data:{orders:Object.fromEntries(orders.map(o=>[o.id,o])),
 qrProducts:rows(4,i=>({id:'q'+i,qrCode:'QR'+i,customer:'K',productCode:'P',quantity:10,qcResult:['pass','pass','fail','pending'][i],prodDate:ds(t0),machine:'Máy rút 50',shift:'1',createdAt:now})),
 mayRutLog:rows(3,i=>({id:'r'+i,ngay:ds(t0-i*D),soThanh:100+i*20,may:'Máy rút 50',ca:'1',congDoan:'Rút',donHangId:i?'o2':''})),
 mayDanhBongLog:rows(2,i=>({id:'d'+i,ngay:ds(t0),soThanh:80,may:'Máy đánh bóng - 1',ca:'2',congDoan:i?'Cắt':'Đánh bóng'})),
 nguyenLieuLog:rows(2,i=>({id:'n'+i,ngay:ds(t0),soLuong:1500,phe:10,phoi:5,heatLot:'H'+i,may:'Máy đùn TJ400'})),
 workers:rows(5,i=>({id:'w'+i,name:'NV'+i,trangThai:'Đang làm',boPhan:'SX'}))}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let fail=0;
const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fail++;};
(async()=>{
  const db=new MockDb(seed); const {server,port}=await startServer(root,db);
  const browser=await chromium.launch(process.env.PW_EXE?{executablePath:process.env.PW_EXE}:{});
  const VPS={desktop:[1440,900],laptop:[1280,720],tablet:[820,1180],phone:[390,844],tv43:[1920,1080],tv75:[3840,2160]};
  for(const [name,[w,h]] of Object.entries(VPS)){
    const ctx=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:'block',locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',deviceScaleFactor:1});
    await stubExternal(ctx); await ctx.addInitScript(({u})=>{try{localStorage.setItem('sx_fb_url',u);}catch(e){}},{u:`http://127.0.0.1:${port}${FB_PREFIX}`});
    const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
    await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForTimeout(500);
    await page.fill('#lu','admin'); await page.fill('#lp','admin123'); await page.click('#loginBtn'); await page.waitForTimeout(2500);
    ok(await page.evaluate(()=>!!document.querySelector('.sf-wrap')),name+': render Smart Factory');
    const m=await page.evaluate(()=>({kpis:document.querySelectorAll('.sf-kpi').length,panels:document.querySelectorAll('.sf-panel').length,hs:document.documentElement.scrollWidth>innerWidth+1||document.getElementById('mainWrap').scrollWidth>document.getElementById('mainWrap').clientWidth+1}));
    ok(m.kpis===5&&m.panels>=10,name+`: ${m.kpis} KPI, ${m.panels} widget`); ok(!m.hs,name+': không tràn ngang');
    await page.screenshot({path:`${out}/${name}.png`,fullPage:false});
    if(name==='desktop'){
      await page.evaluate(()=>{document.getElementById('mainWrap').style.height='auto';});
      const kv=await page.evaluate(()=>[...document.querySelectorAll('.sf-kpi-v')].map(e=>e.textContent.trim()));
      console.log('   KPI:',kv.join(' | '));
      ok(/Chưa đủ dữ liệu/.test(await page.textContent('[data-w=oee]')),'OEE không hiển thị số khi thiếu đầu vào');
      await page.click('.sf-seg:nth-child(2)'); await page.waitForTimeout(200); ok(await page.evaluate(()=>sfF.period)==='week','lọc Tuần');
      await page.selectOption('.sf-sel[aria-label="Công đoạn"]','rut'); await page.waitForTimeout(200); ok(await page.evaluate(()=>sfF.stage)==='rut','lọc công đoạn');
      await page.selectOption('.sf-sel[aria-label="Ca"]','1'); await page.waitForTimeout(200); ok(await page.evaluate(()=>!!document.querySelector('.sf-note')),'lọc ca có ghi chú phạm vi');
      await page.click('text=Xóa lọc'); await page.click('.sf-kpi.k1'); await page.waitForTimeout(200); ok(await page.evaluate(()=>document.getElementById('dpDrawer').classList.contains('open')),'bấm KPI mở drawer');
      await page.evaluate(()=>dpCloseDrawer()); await page.click('.sf-bk >> nth=6'); await page.waitForTimeout(200); ok(await page.evaluate(()=>document.getElementById('dpDrawer').classList.contains('open')),'bấm cột biểu đồ mở drawer');
      await page.evaluate(()=>dpCloseDrawer()); await page.click('text=⚙ Tùy chỉnh'); await page.locator('.ds-drawer .sf-cz input').nth(2).click({force:true}); await page.waitForTimeout(300);
      ok(await page.evaluate(()=>JSON.parse(localStorage.sx_sf_layout_v1).find(x=>x.id==='progress').show===false),'Admin ẩn widget → lưu cục bộ');
      await sleep(1000); ok(!!db.get('/dashCfg/layout'),'bố cục lưu lên /dashCfg');
      await page.evaluate(()=>{sfCzReset();dpCloseDrawer();});
      await page.click('text=📺 TV Mode'); await page.waitForTimeout(400); ok(await page.evaluate(()=>document.body.classList.contains('sf-tv')),'TV Mode bật');
      await page.screenshot({path:`${out}/desktop-tv.png`}); await page.click('.sf-tvx'); await page.waitForTimeout(300);
      ok(await page.evaluate(()=>!document.body.classList.contains('sf-tv')),'thoát TV Mode');
      await ctx.setOffline(true); await page.evaluate(()=>window.dispatchEvent(new Event('offline'))); await page.waitForTimeout(300);
      ok(/Ngoại tuyến/.test(await page.textContent('.sf-wrap')),'trạng thái offline'); await page.screenshot({path:`${out}/desktop-offline.png`}); await ctx.setOffline(false);
      await page.evaluate(()=>goTab('dorDang')); await page.waitForTimeout(400);
      ok(await page.evaluate(()=>getComputedStyle(document.querySelector('.main-wrap')).backgroundImage==='none'),'tab khác không bị nền navy');
    }
    ok(errs.filter(e=>!/Failed to load resource|net::ERR|jspdf|fonts/i.test(e)).length===0,name+': không lỗi JS '+JSON.stringify(errs.slice(0,3)));
    await ctx.close();
  }
  await browser.close(); server.close(); console.log(fail?`\n${fail} LỖI`:'\nTẤT CẢ ĐẠT'); process.exit(fail?1:0);
})();
