// Quét mọi tab × mọi kích thước: tràn ngang, trang trắng, lỗi console. node scan.js <webroot> <out.json>
const fs=require('fs'),path=require('path'); const T=require('path').resolve(__dirname,'../../')+'/';
const {chromium}=require(T+'node_modules/playwright'); const {seedData}=require(T+'e2e/seed');
const {MockDb,startServer,stubExternal,FB_PREFIX}=require(T+'e2e/mock-firebase');
const root=path.resolve(process.argv[2]);
const VPS={desktop:[1440,900],laptop:[1024,768],tablet:[820,1180],mobile:[390,844],small:[360,640]};
const TABS=['dashboard','dorDang','keHoach','dieuHanh','hoanThanh','baoCao','khachHang','qrCode','nhanSu','lichLamViec','chamCong','baoTriMay','khuon','checkSheet','soLieu','nhatKy','settings','truyXuat','controlPlan'];
(async()=>{const b=await chromium.launch(); const rep={errors:[],cases:{}};
 for(const [vn,[w,h]] of Object.entries(VPS)){
  const db=new MockDb(seedData); const {server,port}=await startServer(root,db);
  const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',locale:'vi-VN'}); await stubExternal(ctx);
  await ctx.addInitScript(({u})=>{try{localStorage.setItem('sx_fb_url',u)}catch(e){}},{u:`http://127.0.0.1:${port}${FB_PREFIX}`});
  const pg=await ctx.newPage(); let cur='';
  pg.on('pageerror',e=>rep.errors.push(`[${vn}:${cur}] ${e.message.slice(0,140)}`));
  await pg.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load'});
  await pg.fill('#lu','admin'); await pg.fill('#lp','admin123'); await pg.click('#loginBtn');
  await pg.waitForFunction(()=>document.getElementById('appScreen').classList.contains('active'),null,{timeout:8000}); await pg.waitForTimeout(1200);
  for(const t of TABS){ cur=t;
    await pg.evaluate(x=>{try{goTab(x)}catch(e){}},t); await pg.waitForTimeout(450);
    rep.cases[`${vn}:${t}`]=await pg.evaluate(()=>{
      const mc=document.getElementById('mc'); const W=window.innerWidth;
      const off=[]; mc&&mc.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width>0&&r.right>W+2&&off.length<3){ let p=e,clip=false; while(p&&p!==mc){const s=getComputedStyle(p); if(/(auto|scroll|hidden)/.test(s.overflowX)&&p!==e){clip=true;break;} p=p.parentElement;} if(!clip) off.push((e.id?'#'+e.id:e.tagName.toLowerCase())+'.'+String(e.className).split(' ')[0]+' r='+Math.round(r.right));}});
      return {pageOverflowX:document.documentElement.scrollWidth>W+1, blank:!mc||mc.innerText.trim().length<5, textLen:mc?mc.innerText.trim().length:0, offenders:off};});
  }
  await ctx.close(); server.close();}
 await b.close(); fs.writeFileSync(process.argv[3],JSON.stringify(rep,null,1));
 const R=Object.entries(rep.cases);
 console.log('cases',R.length,'| js errors',rep.errors.length,'| pageOverflowX',R.filter(([k,v])=>v.pageOverflowX).length,'| blank',R.filter(([k,v])=>v.blank).length,'| with offenders',R.filter(([k,v])=>v.offenders.length).length);
 R.filter(([k,v])=>v.pageOverflowX||v.blank).forEach(([k,v])=>console.log('  ',k,v.pageOverflowX?'OVERFLOW':'','blank:'+v.blank,'len:'+v.textLen,v.offenders.join(' | ')));
 rep.errors.slice(0,6).forEach(e=>console.log('  ERR',e));
})().catch(e=>{console.error(e);process.exit(1)});
