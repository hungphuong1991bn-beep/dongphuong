const path=require('path');const T=require('path').resolve(__dirname,'../../')+'/';
const {chromium}=require(T+'node_modules/playwright');const {seedData}=require(T+'e2e/seed');
const {MockDb,startServer,stubExternal,FB_PREFIX}=require(T+'e2e/mock-firebase');
(async()=>{const b=await chromium.launch();let fails=0;const ok=(n,c,x='')=>{console.log((c?'✓':'✗')+' '+n+(x?' — '+x:''));if(!c)fails++};
for(const [vn,w,h] of [['desktop',1440,900],['mobile',390,844]]){
const db=new MockDb(seedData);const {server,port}=await startServer(path.resolve(process.argv[2]),db);
const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});await stubExternal(ctx);
await ctx.addInitScript(({u})=>{localStorage.setItem('sx_fb_url',u)},{u:`http://127.0.0.1:${port}${FB_PREFIX}`});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${port}/index.html`);
await pg.fill('#lu','admin');await pg.fill('#lp','admin123');await pg.click('#loginBtn');
await pg.waitForFunction(()=>document.getElementById('appScreen').classList.contains('active'));await pg.waitForTimeout(1200);
console.log('— '+vn);
// 1) Nút đồng bộ ở mọi tab: bấm không lỗi, có hiệu ứng, KHÔNG ghi Firebase
const sel=vn==='desktop'?'#syncDot':'.topbar-mh button[onclick*=topbarRefreshClick]';
const wl=()=>db.log.filter(x=>/^(PUT|PATCH|POST|DELETE) /.test(x)&&!x.includes('/presence/')); const wr=()=>wl().length; const seen=[]; let dW=0;
for(const t of ['dashboard','dorDang','keHoach','soLieu']){
  await pg.evaluate(x=>goTab(x),t);await pg.waitForTimeout(2200); const n0=wr();
  await pg.click(sel);await pg.waitForTimeout(120);
  const sp=await pg.evaluate(s=>document.querySelector(s).hasAttribute('data-spin'),sel);
  await pg.waitForTimeout(500); dW+=wr()-n0; seen.push(...wl().slice(n0).map(x=>t+':'+x));
  ok(`bấm đồng bộ ở tab ${t}`,sp&&errs.length===0, sp?'có hiệu ứng':'KHÔNG có hiệu ứng');
}
ok('bấm đồng bộ ở 4 tab KHÔNG phát sinh lượt ghi Firebase nào', dW===0, 'số lượt ghi='+dW+' '+seen.join(' ; '));
if(vn==='desktop'){
  ok('chỉ có 1 nút đồng bộ trong Global Header', await pg.evaluate(()=>document.querySelectorAll('.topbar #syncDot,.topbar #topbarRefreshBtn,.topbar .ov-refresh-btn').length===1));
  ok('phím Enter kích hoạt đồng bộ', await (async()=>{await pg.focus('#syncDot');await pg.keyboard.press('Enter');await pg.waitForTimeout(100);return pg.evaluate(()=>document.getElementById('syncDot').hasAttribute('data-spin'))})());
  // 2) Thông báo: panel chuông có nút Soạn cho admin, bấm mở được hộp soạn
  await pg.click('#bellBtn');await pg.waitForTimeout(300);
  ok('admin thấy nút 📢 Soạn trong panel chuông', await pg.evaluate(()=>{const e=document.querySelector('#notifPanel #annWriteBtn');return !!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0}));
  ok('không còn nút 📢 ngoài Header', await pg.evaluate(()=>!document.querySelector('.topbar #annWriteBtn')));
  await pg.click('#notifPanel #annWriteBtn');await pg.waitForTimeout(400);
  ok('bấm Soạn mở hộp soạn thông báo (openAnnounce)', await pg.evaluate(()=>[...document.querySelectorAll('.modal,.overlay,[class*=ann]')].some(e=>e.getBoundingClientRect().width>200&&getComputedStyle(e).display!=='none'&&/thông báo|Thông báo|Gửi/.test(e.innerText||''))));
}
ok('không có lỗi JS',errs.length===0,errs[0]||'');
await ctx.close();server.close();}
await b.close();console.log(fails?`\n${fails} KIỂM TRA THẤT BẠI`:'\nTất cả kiểm tra hành vi đạt');process.exit(fails?1:0)})();
