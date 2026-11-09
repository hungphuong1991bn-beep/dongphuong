// Kiểm thử Global Header: node hdr.js <webroot> <outdir>
const fs=require('fs'),path=require('path');
const T=require('path').resolve(__dirname,'../../')+'/';
const {chromium}=require(T+'node_modules/playwright');
const {seedData,T0}=require(T+'e2e/seed');
const {MockDb,startServer,stubExternal,FB_PREFIX}=require(T+'e2e/mock-firebase');
const root=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]); fs.mkdirSync(out,{recursive:true});
const VPS={wide:[1700,900],desktop:[1440,900],d1280:[1280,800],d1100:[1100,800],laptop:[1024,768],d900:[900,800],tablet:[820,1180],t700:[700,900],mobile:[390,844],small:[360,640]};
const TABS=['dashboard','dorDang','keHoach','dieuHanh','controlPlan','truyXuat','soLieu','settings'];
const probe=()=>{
  const tb=document.querySelector('.topbar'); const vis=e=>{ if(!e) return false; const r=e.getBoundingClientRect(), s=getComputedStyle(e); return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&r.left>=-1&&r.right<=window.innerWidth+1; };  /* phải NẰM TRONG khung màn hình */
  const txt=(tb.innerText||'').toLowerCase();
  const q=s=>[...document.querySelectorAll(s)].some(vis);
  return {
    companyText: /công thương đông phương|công ty cổ phần/.test(txt) || !!tb.querySelector('.topbar-company,.topbar-mh-company,.tcm-1,.tcm-2'),
    companyAnywhereInTopbarHTML: /Công Thương Đông Phương/i.test(tb.innerHTML),
    title: q('#pageTitle,#pageTitleMobile'), titleText:(document.getElementById('pageTitle')||{}).textContent,
    date: q('#clockDate,#clockDateMobile'), time: q('#clockTime,#clockTimeMobile'),
    sync: q('#syncDot,#mhSyncDot'), refreshOnMobile: q('.topbar-mh button[onclick*="topbarRefreshClick"]'), bell: q('#bellBtn,.topbar-mh button[aria-label="Thông báo"]'), avatar: q('#avatarBtn,#mhAvatarBtn'),
    search: q('#tbGlobalSearch,#topbarMhSearchBtn'),
    syncControls: document.querySelectorAll('#syncDot,#mhSyncDot').length,
    topbarH: Math.round(tb.getBoundingClientRect().height),
    pageOverflowX: document.documentElement.scrollWidth>window.innerWidth+1,
    topbarOverflowX: tb.scrollWidth>tb.clientWidth+1,
    headers: document.querySelectorAll('.topbar').length, annInTopbar: !!tb.querySelector('#annWriteBtn'), refreshBtnInTopbar: !!tb.querySelector('#topbarRefreshBtn'), annInPanel: !!document.querySelector('#notifPanel #annWriteBtn')
  };
};
(async()=>{
  const b=await chromium.launch(); const rep={errors:[],res:{}};
  for(const [vn,[w,h]] of Object.entries(VPS)){
    const db=new MockDb(seedData); const {server,port}=await startServer(root,db);
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});
    await stubExternal(ctx);
    await ctx.addInitScript(({u})=>{try{localStorage.setItem('sx_fb_url',u)}catch(e){}},{u:`http://127.0.0.1:${port}${FB_PREFIX}`});
    const pg=await ctx.newPage();
    pg.on('pageerror',e=>rep.errors.push(`[${vn}] pageerror: ${e.message}`));
    pg.on('console',m=>{if(m.type()==='error')rep.errors.push(`[${vn}] console: ${m.text().slice(0,160)}`)});
    await pg.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load'});
    await pg.fill('#lu','admin'); await pg.fill('#lp','admin123'); await pg.click('#loginBtn');
    await pg.waitForFunction(()=>document.getElementById('appScreen').classList.contains('active'),null,{timeout:8000});
    await pg.waitForTimeout(1500);
    for(const t of TABS){
      await pg.evaluate(x=>goTab(x),t); await pg.waitForTimeout(500);
      rep.res[`${vn}:${t}`]=await pg.evaluate(probe);
      await pg.screenshot({path:path.join(out,`${vn}-${t}.png`),clip:{x:0,y:0,width:w,height:Math.min(h,360)}});
    }
    await ctx.close(); server.close();
  }
  await b.close(); fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(rep,null,1));
  const rows=Object.entries(rep.res); 
  const bad=k=>rows.filter(([n,r])=>r[k]).length;
  console.log('cases:',rows.length,'| errors:',rep.errors.length);
  console.log('company text present:',bad('companyText'),'| page overflowX:',bad('pageOverflowX'),'| topbar overflowX:',bad('topbarOverflowX'));
  for(const k of ['title','date','time','sync','bell','avatar','search']) console.log(k.padEnd(8),'visible in',rows.filter(([n,r])=>r[k]).length,'/',rows.length);
  console.log('📢 in header:',rows.filter(([n,r])=>r.annInTopbar).length,'| Làm mới riêng in header:',rows.filter(([n,r])=>r.refreshBtnInTopbar).length,'| 📢 trong panel chuông:',rows.filter(([n,r])=>r.annInPanel).length,'/',rows.length);
  rows.filter(([n,r])=>!(r.title&&r.date&&r.time&&r.sync&&r.bell&&r.avatar&&r.search)).forEach(([n,r])=>console.log('  THIẾU/NGOÀI KHUNG',n,JSON.stringify({t:r.title,d:r.date,ti:r.time,s:r.sync,b:r.bell,a:r.avatar,se:r.search})));
  console.log('multi-header cases:',rows.filter(([n,r])=>r.headers!==1).length,'| heights:',[...new Set(rows.map(([n,r])=>n.split(':')[0]+'='+r.topbarH))].join(' '));
  rep.errors.slice(0,8).forEach(e=>console.log('  ',e));
})().catch(e=>{console.error(e);process.exit(1)});
