// Bước 2 (jsdom, KHÔNG phải trình duyệt thật): dp-ui.js + Modal.js + Toast.js + setSyncDot THẬT đọc từ file.
// Chạy: NODE_PATH=<nơi có jsdom> node tests/static/dp-ui.test.js
const path=require('path'),fs=require('fs'),assert=require('assert'),{JSDOM}=require('jsdom');
const R=p=>fs.readFileSync(path.join(__dirname,'..','..',p),'utf8');
let n=0; const ok=m=>{n++;console.log('✓',m);}; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function fnSrc(src,name){ const s=src.indexOf('function '+name+'('); assert(s>=0,name); let d=0,i=src.indexOf('{',s);
  for(let j=i;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){d--; if(!d) return src.slice(s,j+1);} } }
(async()=>{
const dom=new JSDOM('<body><div id="toast"></div><div class="modal" id="m1"><div class="modal-box"><input id="f1" type="text"><input id="fs" type="search"><input id="fr" type="text" readonly></div></div><div class="modal" id="m2"><div class="modal-box"><input id="g1"></div></div><div class="modal" id="cfModal"><div id="cfTitle"></div><div id="cfBody"></div></div><div id="host"></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window; const doc=w.document;
w.eval('function $(i){return document.getElementById(i);}');
// Toast.js thật bỏ phần document.write (markup #toast đã có sẵn)
w.eval(R('src/components/shared/Toast.js').replace(/document\.write\(`[\s\S]*?`\);/,''));
w.eval(R('src/components/shared/Modal.js'));
w.eval(R('src/components/shared/dp-ui.js'));
const U=w.dpUI;
ok('nạp dp-ui.js không lỗi, có dpNotify/dpUI');

// ── dpNotify
w.dpNotify('success','Đã lưu',{ttl:30});
let t=doc.querySelector('.dp-toast--success'); assert(t); assert.strictEqual(t.getAttribute('role'),'status');
await sleep(80); assert(!doc.querySelector('.dp-toast--success'),'success tự ẩn'); ok('Success: có role status, tự ẩn sau ttl');
const idE=w.dpNotify('error','Lỗi lưu đơn');
await sleep(80); assert(doc.querySelector('.dp-toast--error'),'error còn'); assert.strictEqual(doc.querySelector('.dp-toast--error').getAttribute('role'),'alert');
doc.querySelector('.dp-toast--error .dp-toast__x').click(); assert(!doc.querySelector('.dp-toast--error')); ok('Error: giữ đến khi người dùng đóng; nút đóng hoạt động');
w.dpNotify('warning','Đơn sắp trễ',{scope:'business',ttl:0}); w.dpNotify('warning','Đơn sắp trễ',{scope:'business',ttl:0}); w.dpNotify('warning','Đơn sắp trễ',{scope:'business',ttl:0});
assert.strictEqual(doc.querySelectorAll('.dp-toast--warning').length,1); assert.strictEqual(doc.querySelector('.dp-toast__n').textContent,'×3');
assert(doc.querySelector('.dp-toast--biz .dp-toast__title').textContent==='Cảnh báo nghiệp vụ'); ok('Chống trùng: 3 lần cùng nội dung → 1 thẻ ×3; phân biệt cảnh báo nghiệp vụ');
doc.querySelectorAll('.dp-toast__x').forEach(b=>b.click());
w.dpNotify('info','<img src=x onerror=window.__x=1><script>window.__x=1<\/script>',{ttl:0});
assert(!doc.querySelector('.dp-toast img,.dp-toast script')); assert.strictEqual(w.__x,undefined);
assert(doc.querySelector('.dp-toast__msg').textContent.includes('<img src=x')); doc.querySelectorAll('.dp-toast__x').forEach(b=>b.click()); ok('Nội dung hiển thị dạng chữ, không chèn HTML (XSS)');
assert.strictEqual(w.dpNotify('error',''),0); ok('Nội dung rỗng → không tạo thông báo');

// ── lịch sử + bọc showToast
U.clearHistory(); w.dpNotify('success','ok1'); w.dpNotify('error','E1'); w.dpNotify('warning','W1',{scope:'business'});
let h=U.history(); assert.strictEqual(JSON.stringify(h.map(x=>x.type)),'["error","warning"]'); assert.strictEqual(h[1].scope,'business'); ok('Lịch sử chỉ lưu warning/error, ghi scope hệ thống/nghiệp vụ');
U.clearHistory(); w.showToast('Lỗi cũ',true); w.showToast('Thường');
assert.strictEqual(U.history().length,1); assert.strictEqual(U.history()[0].msg,'Lỗi cũ');
assert(doc.getElementById('toast').textContent==='Thường' && doc.getElementById('toast').classList.contains('show')); ok('showToast cũ: hiển thị y như trước (#toast), lỗi được ghi vào lịch sử');
assert(!U.history().some(x=>x.msg==='Thường')); w.eval('showToast("a");'); ok('Toast thường không vào lịch sử');
doc.querySelectorAll('.dp-toast__x').forEach(b=>b.click());

// ── dpState
const host=doc.getElementById('host');
U.state.loading(host,{rows:4}); assert.strictEqual(host.querySelectorAll('.dp-skel__row').length,4); assert.strictEqual(host.firstChild.getAttribute('aria-busy'),'true'); ok('Loading: skeleton đúng số dòng, aria-busy');
U.state.empty(host,{filtered:true}); assert(host.textContent.includes('Không có kết quả phù hợp')); assert(host.querySelector('.dp-state--empty') && !host.querySelector('.dp-state--error'));
U.state.empty(host,{}); assert(host.textContent.includes('Chưa có dữ liệu')); ok('Empty: phân biệt "chưa có dữ liệu" và "bộ lọc không khớp", không giống Error');
let retried=0; const origErr=w.console.error; w.console.error=()=>{};
U.state.error(host,{title:'<b>x</b>',error:'boom',onRetry:()=>retried++}); const rb=host.querySelector('.dp-state__btn');
assert(rb && rb.textContent==='Thử lại'); assert(!host.querySelector('b')); rb.click(); assert.strictEqual(retried,1); ok('Error: có nút Thử lại gọi đúng callback, tiêu đề không chèn HTML');
U.state.error(host,{}); assert(!host.querySelector('.dp-state__btn')); w.console.error=origErr; ok('Error không có onRetry → không hiện nút giả');
U.state.offline(host,{onRetry:()=>{}}); assert(host.querySelector('.dp-state--offline') && host.textContent.includes('chưa được xác nhận')); assert.strictEqual(host.querySelector('.dp-state__btn').textContent,'Đồng bộ lại'); ok('Offline: nêu rõ dữ liệu chưa xác nhận lưu, có nút Đồng bộ lại');
U.state.clear(host); assert.strictEqual(host.childNodes.length,0);

// ── dpModal
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const type=(el)=>{ el.value='abc'; el.dispatchEvent(new w.Event('input',{bubbles:true})); };
w.openModal('m1'); click(doc.getElementById('m1')); assert(!doc.getElementById('m1').classList.contains('open')); ok('Modal chưa nhập gì: bấm nền vẫn đóng như cũ');
w.openModal('m1'); type(doc.getElementById('f1')); assert(U.modal.isDirty('m1'));
click(doc.getElementById('m1')); assert(doc.getElementById('m1').classList.contains('open'),'vẫn mở'); assert(doc.getElementById('cfModal').classList.contains('open')); assert(doc.getElementById('cfTitle').textContent==='Đóng biểu mẫu?'); ok('Modal đã nhập: bấm nền KHÔNG đóng, hiện xác nhận cụ thể');
w.cfOK(); assert(!doc.getElementById('m1').classList.contains('open')); assert(!U.modal.isDirty('m1')); ok('Xác nhận "đóng" → modal đóng và hết cờ chưa lưu');
w.openModal('m1'); type(doc.getElementById('fs')); type(doc.getElementById('fr')); assert(!U.modal.isDirty('m1')); w.closeModal('m1'); ok('Ô tìm kiếm và ô chỉ đọc không bị coi là dữ liệu nhập');
w.openModal('m2'); type(doc.getElementById('g1')); doc.getElementById('m2').classList.remove('open'); await sleep(20); assert(!U.modal.isDirty('m2'));
w.openModal('m2'); click(doc.getElementById('m2')); assert(!doc.getElementById('m2').classList.contains('open')); ok('Đóng bằng cách khác (lưu xong) → cờ chưa lưu tự xoá, lần mở sau không bị hỏi nhầm');
w.openModal('m1'); type(doc.getElementById('f1')); U.modal.markClean('m1'); click(doc.getElementById('m1')); assert(!doc.getElementById('m1').classList.contains('open')); ok('markClean() cho phép luồng lưu xong rồi đóng');
w.openModal('cfModal'); click(doc.getElementById('cfModal')); assert(!doc.getElementById('cfModal').classList.contains('open')); ok('Hộp xác nhận không bị chặn bởi chính cơ chế chặn');

// ── Header: 4 trạng thái đồng bộ (mã THẬT của setSyncDot)
const gh=R('src/components/GlobalHeader.js');
const w2=new JSDOM('<body><span id="syncDot"></span><span id="mhSyncDot"></span><span id="syncLabel"></span><span id="syncTimeAgo"></span></body>',{runScripts:'outside-only'}).window;
w2.eval('function $(i){return document.getElementById(i);} let _lastSyncOkAt=null,_syncTickTimer=null; function tickSyncAgo(){} function fmtSyncAgo(){return "";} '+fnSrc(gh,'setSyncDot'));
const probe=s=>{ w2.eval(`setSyncDot('${s}')`); const d=w2.document; return [d.getElementById('syncDot').className,d.getElementById('syncLabel').textContent,d.getElementById('syncDot').title,d.getElementById('mhSyncDot').className]; };
let r=probe('ok');      assert.strictEqual(r[0],'topbar-sync'); assert.strictEqual(r[1],'Đồng bộ');
r=probe('saving');      assert.strictEqual(r[0],'topbar-sync offline'); assert.strictEqual(r[1],'Đang lưu...');   // hành vi cũ giữ nguyên
r=probe('error');       assert.strictEqual(r[0],'topbar-sync error'); assert.strictEqual(r[1],'Lỗi đồng bộ');
r=probe('offline');     assert.strictEqual(r[0],'topbar-sync net-off'); assert.strictEqual(r[1],'Ngoại tuyến'); assert(r[2].includes('chưa được xác nhận')); assert.strictEqual(r[3],'topbar-mh-sync net-off');
ok('Header: 4 trạng thái Đồng bộ / Đang lưu / Lỗi đồng bộ / Ngoại tuyến (desktop + mobile), saving giữ hành vi cũ');
const sy=R('src/services/sync.js'); assert(sy.includes("addEventListener('offline', ()=>{ setSyncDot('offline'); })")); ok('sync.js: mất mạng → trạng thái Ngoại tuyến');
console.log(`\n${n} nhóm kiểm thử đạt`); process.exit(0);
})().catch(e=>{console.error('✗',e);process.exit(1);});
