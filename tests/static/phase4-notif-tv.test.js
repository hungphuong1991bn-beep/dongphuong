// Giai đoạn 4 (jsdom, KHÔNG phải trình duyệt thật): (a) renderNotifList escape dữ liệu người dùng; (b) wake lock TV Mode.
const path=require('path'),fs=require('fs'),{JSDOM}=require('jsdom'),assert=require('assert');
const R=p=>fs.readFileSync(path.join(__dirname,'..','..',p),'utf8');
let n=0; const ok=m=>{n++;console.log('✓',m);};
// ── (a) lấy NGUYÊN văn hàm renderNotifList + hằng NOTIF_ICO từ file thật
const src=R('src/components/NotificationCenter.js');
const grab=(re)=>{ const m=src.match(re); assert(m,'không tìm thấy '+re); return m[0]; };
const ico=grab(/const NOTIF_ICO = \{[\s\S]*?\};/);
const start=src.indexOf('function renderNotifList()'); let depth=0,i=src.indexOf('{',start),end=i;
for(;end<src.length;end++){ if(src[end]==='{')depth++; else if(src[end]==='}'){depth--; if(!depth)break;} }
const fn=src.slice(start,end+1);
let w=new JSDOM('<body><div id="notifList"></div></body>',{runScripts:'dangerously'}).window;
w.eval(`var notifList=[]; function vnDateTimeShort(d){return 'T';} `+fs.readFileSync(path.join(__dirname,'..','..','src/utils/helpers.js'),'utf8')+';'+ico+fn);
w.eval(`notifList=[{id:'n1',ts:1,type:'order_new',title:'📦 Đơn mới: <img src=x onerror=window.__x=1>',body:'a<script>window.__x=1<\/script>&amp;',from:'<b>evil</b>',read:false},{id:"x'),alert(1);//",ts:2,title:'ok',read:true}]; renderNotifList();`);
const el=w.document.getElementById('notifList');
assert(!el.querySelector('img,script,b'),'không có thẻ chèn vào'); assert.strictEqual(w.__x,undefined);
assert(el.textContent.includes('<img src=x onerror=window.__x=1>'),'nội dung hiển thị nguyên dạng chữ');
assert(el.textContent.includes('<b>evil</b>'),'tên người gửi hiển thị nguyên dạng chữ');
ok('Thông báo: title/body/from được escape, hiển thị như chữ thường');
// Bấm thật: id lạ phải đến clickNotif NGUYÊN VẸN như một chuỗi, không thực thi mã
w.eval(`window.__alert=0; window.alert=function(){window.__alert++}; window.__got=[]; function clickNotif(id){window.__got.push(id);}`);
const items=el.querySelectorAll('.notif-item'); assert.strictEqual(items.length,2,'id lạ không phá cấu trúc DOM');
items[1].click(); items[0].click();
assert.strictEqual(w.__alert,0,'không thực thi mã trong id'); assert.strictEqual(JSON.stringify(w.__got),JSON.stringify(["x'),alert(1);//",'n1']));
ok('Bấm mục thông báo: id ký tự đặc biệt đến clickNotif nguyên vẹn, không thực thi mã');
// ── (b) wake lock
function mk(supported){
  const d=new JSDOM('<body></body>',{runScripts:'outside-only',url:'http://localhost/',pretendToBeVisual:true}); const w=d.window;
  const log={req:0,rel:0}; let released=[];
  if(supported) Object.defineProperty(w.navigator,'wakeLock',{value:{request:async()=>{log.req++; const l={addEventListener:(e,f)=>released.push(f),release:async()=>{log.rel++;}}; return l;}}});
  w.eval(`var dhTvMode=false; function dhTvLocked(){return window.__locked===true;} function dhToggleTv(){dhTvMode=!dhTvMode;}`);
  w.eval(R('src/components/shared/ModuleEnhance.js')); w.eval(R('src/modules/tv-mode/tv-wakelock.js'));
  return {w,log,released};
}
(async()=>{
  let {w,log}=mk(true);
  await w.tvSyncWakeLock(); assert.strictEqual(log.req,0,'TV tắt → không xin khoá');
  w.dhToggleTv(); await new Promise(r=>setTimeout(r,10)); assert.strictEqual(log.req,1,'bật TV → xin khoá'); ok('Bật TV Mode → xin wake lock');
  await w.tvSyncWakeLock(); await w.tvSyncWakeLock(); assert.strictEqual(log.req,1,'không xin lặp'); ok('Gọi lại nhiều lần không xin trùng');
  w.dhToggleTv(); await new Promise(r=>setTimeout(r,10)); assert.strictEqual(log.rel,1,'tắt TV → nhả khoá'); ok('Tắt TV Mode → nhả wake lock');
  ({w,log}=mk(true)); w.__locked=true; await w.tvSyncWakeLock(); assert.strictEqual(log.req,1); ok('TV đã khoá cứng (?tv=1 / khởi động lại) → cũng xin khoá');
  ({w,log}=mk(false)); w.dhToggleTv(); await w.tvSyncWakeLock(); ok('Trình duyệt không hỗ trợ → bỏ qua, không lỗi');
  const d=mk(true); d.w.navigator.wakeLock.request=async()=>{throw new Error('NotAllowedError');}; d.w.dhToggleTv(); await d.w.tvSyncWakeLock(); ok('Bị từ chối → bỏ qua, không văng lỗi');
  console.log(`\n${n} nhóm kiểm thử đạt`); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
