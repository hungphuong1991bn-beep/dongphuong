// Bước 3 (jsdom, KHÔNG phải trình duyệt thật): Sidebar nhóm lại + dpUI.table. Mã THẬT đọc từ file.
const path=require('path'),fs=require('fs'),assert=require('assert'),{JSDOM}=require('jsdom');
const R=(p,root)=>fs.readFileSync(path.join(root||path.join(__dirname,'..','..'),p),'utf8');
let n=0; const ok=m=>{n++;console.log('✓',m);}; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const BASE=process.env.BASELINE_DIR;                           // tuỳ chọn: thư mục bản gốc để đối chiếu Sidebar
function sidebarHTML(src){ const m=src.match(/document\.write\(`([\s\S]*?)`\);/); assert(m); return m[1]; }
function parseNav(html){ const d=new JSDOM('<body>'+html+'</body>').window.document; return d; }
(async()=>{
// ── Sidebar
const html=sidebarHTML(R('src/components/Sidebar.js')); const doc=parseNav(html);
const items=[...doc.querySelectorAll('.sb-item')];
assert.strictEqual(items.length,19); ok('Sidebar: còn đủ 19 mục (không mất tab nào)');
const ids=items.map(i=>i.id); assert.strictEqual(new Set(ids).size,19);
items.forEach(i=>assert.strictEqual(i.getAttribute('onclick'),`goTab('${i.id.slice(4)}')`)); ok('Mỗi mục vẫn gọi đúng goTab(<id>) và giữ id sbi-*');
let cur=null,groups=[],bad=0; [...doc.querySelector('.sb-nav').children].forEach(c=>{ if(c.classList.contains('sb-section')){ cur=c.getAttribute('data-g'); groups.push([cur,c.textContent.trim(),[]]); } else if(c.classList.contains('sb-item')){ if(c.getAttribute('data-g')!==cur) bad++; groups[groups.length-1][2].push(c.id.slice(4)); } });
assert.strictEqual(bad,0); ok('Mỗi mục nằm dưới tiêu đề đúng nhóm (data-g khớp)');
assert.strictEqual(groups.map(g=>g[1]).join('|'),'Tổng quan|Đơn hàng|Sản xuất|Số liệu và kho|Chất lượng|Khuôn, thiết bị và bảo trì|Nhân sự|Quản trị hệ thống');
assert(groups.every(g=>g[2].length>=1)); ok('8 nhóm theo nghiệp vụ, không nhóm rỗng');
// phần còn lại của template (badge id, nút thu gọn, đăng xuất) không đổi so với bản gốc
const keep=['sbBadge','sbKhcBadge','sbBtmBadge','sbKhuonBadge','sbLogBadge','sbVerBadge','sbCollapseBtn','sbOverlay','sbOnline','sbScanStats'];
keep.forEach(k=>assert(doc.getElementById(k),k)); assert(doc.querySelector('.sb-logout[onclick="doLogout()"]')); ok('Huy hiệu, nút thu gọn, overlay Drawer, đăng xuất vẫn còn');
if(BASE){ const b=parseNav(sidebarHTML(R('src/components/Sidebar.js',BASE)));
  const sig=d=>[...d.querySelectorAll('.sb-item')].map(i=>i.id+'|'+i.getAttribute('onclick')+'|'+i.getAttribute('title')+'|'+i.querySelector('svg').outerHTML+'|'+i.textContent.replace(/\s+/g,' ').trim()+'|'+(i.getAttribute('style')||'')).sort().join('\n');
  assert.strictEqual(sig(doc),sig(b)); ok('Đối chiếu bản gốc: biểu tượng, nhãn, tooltip, style từng mục giống hệt (chỉ đổi nhóm/thứ tự)'); }

// ── dpNav.sync (mã thật trong dp-ui.js) trên chính markup Sidebar
const dom=new JSDOM('<body>'+html+'<div id="toast"></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://localhost/'}); const w=dom.window;
w.eval('function $(i){return document.getElementById(i);}'); w.eval(R('src/components/shared/dp-ui.js'));
const vis=()=>[...w.document.querySelectorAll('.sb-section')].filter(s=>s.style.display!=='none').map(s=>s.getAttribute('data-g')).join(',');
w.dpUI.nav.sync(); assert.strictEqual(vis(),'dieuHanh,kinhDoanh,sanXuat,kho,chatLuong,nhaMay,nhanSu,heThong'); ok('Đủ quyền: hiện đủ 8 tiêu đề nhóm');
// tài khoản "Số liệu": router.applyRoleNav ẩn mọi mục trừ sbi-soLieu → chỉ còn nhóm của nó
w.document.querySelectorAll('.sb-item').forEach(x=>{ x.style.display = x.id==='sbi-soLieu' ? '' : 'none'; });
await sleep(20); assert.strictEqual(vis(),'kho'); ok('Vai trò "Số liệu": tiêu đề nhóm trống tự ẩn (tự động qua MutationObserver)');
w.document.querySelectorAll('.sb-item').forEach(x=>{ x.style.display=''; }); w.document.getElementById('sbi-khachHang').style.display='none'; await sleep(20);
assert(vis().includes('kinhDoanh')); ok('Ẩn 1 mục (Khách hàng) nhưng nhóm còn mục khác → tiêu đề vẫn hiện');
w.document.querySelectorAll('.sb-item[data-g="nhanSu"]').forEach(x=>x.style.display='none'); await sleep(20); assert(!vis().includes('nhanSu')); ok('Ẩn hết mục một nhóm → tiêu đề nhóm ẩn theo');

// ── dpUI.table
const d2=new JSDOM('<body><div id="h"></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://localhost/'}).window;
d2.eval('function $(i){return document.getElementById(i);} function showToast(){}'); d2.eval(R('src/components/shared/dp-ui.js')); d2.eval(R('src/components/shared/dp-table.js'));
const H=d2.document.getElementById('h'); const T=d2.dpUI.table;
const rows=[]; for(let i=1;i<=57;i++) rows.push({id:'DH'+i, ten:i%2?'Đơn Hàng Cũ '+i:'Khách Đặc Biệt '+i, sl:i*10, ghi:i===5?'<img src=x onerror=window.__x=1>':'', ngay:i%7?'2026-11-'+String(i%28+1).padStart(2,'0'):null});
const cols=[{key:'id',label:'Mã đơn',sort:true,sticky:true},{key:'ten',label:'Tên',sort:true},{key:'sl',label:'Số lượng',sort:true,align:'right'},{key:'ngay',label:'Ngày',sort:true,priority:'low'},{key:'ghi',label:'Ghi chú',priority:'low'}];
const tb0=T(H,{columns:cols,rows,rowKey:'id',pageSize:10}); let tb=tb0;
const q=s=>H.querySelectorAll(s); const txt=s=>H.querySelector(s).textContent;
assert.strictEqual(q('tbody tr').length,10); assert(txt('.dp-tbl__count').startsWith('57 bản ghi')); assert(txt('.dp-tbl__pinfo')==='Trang 1/6'); ok('Bảng: phân trang 10 dòng/trang, hiện tổng 57 bản ghi, "Trang 1/6"');
assert.strictEqual(d2.__x,undefined); assert(!H.querySelector('img')); ok('Ô dữ liệu có thẻ HTML chỉ hiển thị dạng chữ (XSS)');
const nextB=()=>[...q('.dp-tbl__pbtn')].find(b=>b.textContent.includes('Sau')); nextB().click(); assert(txt('.dp-tbl__pinfo')==='Trang 2/6'); assert.strictEqual(H.querySelector('tbody td').textContent,'DH11'); ok('Chuyển trang đúng dữ liệu (DH11 đầu trang 2)');
const sizeSel=H.querySelector('.dp-tbl__size'); sizeSel.value='50'; sizeSel.dispatchEvent(new d2.Event('change')); assert.strictEqual(q('tbody tr').length,50); assert(txt('.dp-tbl__pinfo')==='Trang 1/2'); ok('Đổi số dòng/trang = 50 → 50 dòng, về trang 1');
const th=[...q('th')].find(t=>t.textContent.startsWith('Số lượng')); th.querySelector('button').click();
assert.strictEqual(H.querySelectorAll('tbody tr')[0].children[2].textContent,'10'); assert.strictEqual([...q('th')].find(t=>t.textContent.startsWith('Số lượng')).getAttribute('aria-sort'),'ascending'); 
[...q('th')].find(t=>t.textContent.startsWith('Số lượng')).querySelector('button').click(); assert.strictEqual(H.querySelectorAll('tbody tr')[0].children[2].textContent,'570'); ok('Sắp xếp theo SỐ (không theo chữ: 570 > 60) tăng/giảm, có aria-sort');
const sort2=()=>[...q('th')].find(t=>t.textContent.startsWith('Mã đơn')).querySelector('button'); sort2().click(); assert.strictEqual(H.querySelectorAll('tbody tr')[0].children[0].textContent,'DH1'); sort2().click(); assert.strictEqual(H.querySelectorAll('tbody tr')[0].children[0].textContent,'DH57'); ok('Sắp xếp mã dạng DH1…DH57 theo thứ tự tự nhiên (DH2 < DH10)');
tb.destroy(); const tbBig=T(H,{columns:cols,rows,rowKey:'id',pageSize:100,pageSizes:[100]});
const ngBtn=()=>[...H.querySelectorAll('th')].find(t=>t.textContent.startsWith('Ngày')).querySelector('button');
ngBtn().click(); let col=[...H.querySelectorAll('tbody tr')].map(r=>r.children[3].textContent); let firstBlank=col.indexOf('');
assert(firstBlank>0 && col.slice(firstBlank).every(v=>v==='') && col.slice(0,firstBlank).every(v=>v!=='')); ngBtn().click();
col=[...H.querySelectorAll('tbody tr')].map(r=>r.children[3].textContent); firstBlank=col.indexOf(''); assert(firstBlank>0 && col.slice(firstBlank).every(v=>v==='')); ok('Ô trống luôn xếp cuối, cả khi sắp tăng lẫn giảm');
tbBig.destroy(); tb=T(H,{columns:cols,rows,rowKey:'id',pageSize:10}); tb.getState();
const s=H.querySelector('.dp-tbl__search'); s.value='khach dac biet 4'; s.dispatchEvent(new d2.Event('input')); 
assert(txt('.dp-tbl__count').includes('đã lọc từ 57')); assert([...q('tbody tr')].every(r=>/Khách Đặc Biệt 4/.test(r.textContent))); ok('Tìm không dấu: "khach dac biet 4" khớp "Khách Đặc Biệt 4x"');
ngBtn().click(); assert.strictEqual(tb.getState().q,'khach dac biet 4'); tb.setRows(rows.slice().reverse()); assert.strictEqual(tb.getState().q,'khach dac biet 4'); assert.strictEqual(tb.getState().sortKey,'ngay'); ok('Cập nhật dữ liệu (setRows) giữ nguyên bộ lọc và sắp xếp');
const s2=H.querySelector('.dp-tbl__search'); s2.value='zzzz'; s2.dispatchEvent(new d2.Event('input')); assert(H.querySelector('.dp-state--empty') && txt('.dp-state--empty').includes('Không có kết quả phù hợp')); ok('Không khớp → trạng thái rỗng có hướng dẫn chỉnh bộ lọc');
tb.setLoading(); assert(H.querySelector('.dp-skel')); let retried=0; d2.console.error=()=>{};
const tb2=T(H,{columns:cols,rows:[],onRetry:()=>retried++}); assert(H.querySelector('.dp-state--empty')); assert(txt('.dp-state--empty').includes('Chưa có dữ liệu')); tb2.setLoading(); assert(H.querySelector('.dp-skel')); tb2.setError('boom'); H.querySelector('.dp-state__btn').click(); assert.strictEqual(retried,1); ok('Trạng thái Loading / Empty / Error (nút Thử lại) hoạt động trong bảng');
tb2.setRows(rows.slice(0,3)); const long=T(H,{columns:[{key:'a',label:'A'}],rows:[{a:'x'.repeat(60)}]}); assert.strictEqual(H.querySelector('td').title.length,60); ok('Nội dung dài có tooltip (title)');
// mobile: cột ưu tiên thấp có nút Chi tiết
const m=T(H,{columns:cols,rows:rows.slice(0,3),rowKey:'id'}); const more=H.querySelector('.dp-tbl__more'); assert(more && more.textContent==='Chi tiết'); more.click(); assert(H.querySelector('.dp-tbl__row.is-open')); assert(H.querySelector('.dp-tbl__more').textContent==='Thu gọn'); ok('Cột ưu tiên thấp: nút Chi tiết/Thu gọn bật-tắt từng dòng');
let clicked=null; const c=T(H,{columns:cols,rows:rows.slice(0,3),rowKey:'id',onRowClick:r=>clicked=r.id}); H.querySelector('tbody tr').click(); assert.strictEqual(clicked,'DH1'); ok('Bấm dòng gọi onRowClick đúng bản ghi (giữ thao tác xem/sửa)');
// destroy gỡ sạch (chống rò listener khi rời tab)
const before=H.querySelectorAll('*').length; c.destroy(); assert.strictEqual(H.childNodes.length,0); assert(!H.classList.contains('dp-tbl')); ok('destroy() dọn DOM + gỡ listener');
console.log(`\n${n} nhóm kiểm thử đạt`); process.exit(0);
})().catch(e=>{console.error('✗',e);process.exit(1);});
