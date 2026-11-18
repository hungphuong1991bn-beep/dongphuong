// Kiểm tra lỗi "1 máy chỉ thấy tài khoản của chính mình" do lệch đồng hồ (v2.13.1)
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const src=fs.readFileSync(__dirname+'/../../src/services/presence.js','utf8');
const ctx={localStorage:{getItem:()=>'dX',setItem(){}},sessionStorage:{getItem:()=>'1',setItem(){}},navigator:{userAgent:''},window:{addEventListener(){}},document:{getElementById:()=>null},console};
vm.createContext(ctx); vm.runInContext(src+';this.api={presenceOnlineList,setOff:v=>{_clockOffset=v},TTL:PRESENCE_TTL_MS}',ctx);
const {presenceOnlineList,setOff}=ctx.api;
const real=Date.now; let fails=0;
const T=(n,f)=>{try{f();console.log('✓',n)}catch(e){fails++;console.log('✗',n,e.message)}};
const srvNow=Date.now();
const P={a:{name:'A',role:'admin',ts:srvNow-5000},b:{name:'B',role:'staff',ts:srvNow-40000},c:{name:'C',role:'viewer',ts:srvNow-200000},d:null,e:{name:'E',ts:'x'}};
T('offset đúng → thấy A,B (≤75s), bỏ C, bản ghi hỏng',()=>{setOff(0);assert.strictEqual(JSON.stringify(presenceOnlineList(P).map(u=>u.name)),'["A","B"]')});
T('đồng hồ máy chậm 1 phút, đã bù offset → các máy khác vẫn hiện',()=>{setOff(60000);const Q={a:{name:'A',ts:Date.now()+60000-3000},b:{name:'B',ts:Date.now()+60000-10000}};assert.strictEqual(presenceOnlineList(Q).length,2)});
T('ts ở tương lai (máy khác lệch) vẫn hiện',()=>{setOff(0);assert.strictEqual(presenceOnlineList({x:{name:'X',ts:srvNow+20000}}).length,1)});
T('null/undefined không lỗi',()=>{assert.strictEqual(presenceOnlineList(null).length,0)});
process.exit(fails?1:0);
