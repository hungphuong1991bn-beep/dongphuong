// src/components/shared/dp-table.js — DataTable dùng chung (Bước 3). TÙY CHỌN: chỉ chạy khi một module gọi dpUI.table(...).
// Không thay bảng hiện có nào. Nội dung ô luôn là textContent (hoặc Node do module tự dựng) → không chèn HTML thô.
// Nạp SAU dp-ui.js. Gỡ: bỏ <script> + dòng trong sw.js.
(function(){
  'use strict';
  if(!window.dpUI || window.dpUI.table) return;

  function el(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
  // Chuẩn hoá để tìm không dấu, không phân biệt hoa thường: "Đơn Hàng" khớp "don hang"
  function norm(v){
    return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  }
  var collator=(typeof Intl!=='undefined' && Intl.Collator)?new Intl.Collator('vi',{numeric:true,sensitivity:'base'}):null;
  function isNum(v){ return typeof v==='number' ? isFinite(v) : (typeof v==='string' && v.trim()!=='' && isFinite(Number(v))); }
  function cmp(a,b){
    var ea=(a==null||a===''), eb=(b==null||b==='');
    if(ea||eb) return ea&&eb?0:(ea?1:-1);          // ô trống luôn xếp cuối (cả khi giảm dần: xử lý ở dưới)
    if(isNum(a)&&isNum(b)) return Number(a)-Number(b);
    return collator?collator.compare(String(a),String(b)):(String(a)<String(b)?-1:String(a)>String(b)?1:0);
  }

  // dpUI.table(host, opts) → controller
  // opts: columns:[{key,label,value?(row),render?(row)->string|Node,sort?:true,priority?:'low',width?,sticky?,align?}]
  //       rows, rowKey?, pageSize=25, pageSizes=[10,25,50,100], search=true, searchKeys?, onRowClick?(row),
  //       emptyTitle?, emptyText?, caption?, onRetry?
  function dpTable(host, opts){
    if(!host) throw new Error('dpTable: thiếu phần tử chứa');
    opts=opts||{}; var cols=opts.columns||[];
    var st={rows:opts.rows||[], q:'', sortKey:null, dir:1, page:1, size:opts.pageSize||25, mode:'ready', err:null, open:{}};
    var sizes=opts.pageSizes||[10,25,50,100];
    var listeners=[];                                   // để destroy() gỡ sạch, tránh rò khi chuyển tab
    function on(t,ev,fn){ t.addEventListener(ev,fn); listeners.push([t,ev,fn]); }
    function val(row,c){ return c.value?c.value(row):row[c.key]; }

    function view(){
      var rows=st.rows, q=norm(st.q).trim();
      if(q){
        var keys=opts.searchKeys, getters=keys?keys.map(function(k){return function(r){return r[k];};}):cols.map(function(c){return function(r){return val(r,c);};});
        rows=rows.filter(function(r){ for(var i=0;i<getters.length;i++){ if(norm(getters[i](r)).indexOf(q)>=0) return true; } return false; });
      }
      if(st.sortKey){
        var c=cols.filter(function(x){return x.key===st.sortKey;})[0];
        if(c){ rows=rows.map(function(r,i){return [r,i];}).sort(function(A,B){
          var a=val(A[0],c), b=val(B[0],c), ea=(a==null||a===''), eb=(b==null||b==='');
          if(ea||eb) return ea&&eb?(A[1]-B[1]):(ea?1:-1);       // trống luôn cuối
          return (cmp(a,b)*st.dir) || (A[1]-B[1]);               // ổn định
        }).map(function(x){return x[0];}); }
      }
      return rows;
    }
    function cellNode(c,row){
      var v=c.render?c.render(row):val(row,c);
      if(v && typeof v==='object' && v.nodeType) return v;
      return document.createTextNode(v==null?'':String(v));
    }

    function render(){
      while(host.firstChild) host.removeChild(host.firstChild);
      host.classList.add('dp-tbl');
      if(st.mode==='loading'){ window.dpUI.state.loading(host,{rows:6}); return; }
      if(st.mode==='error'){ window.dpUI.state.error(host,{title:'Không tải được dữ liệu',error:st.err,onRetry:opts.onRetry}); return; }
      var all=view(), total=all.length, pages=Math.max(1,Math.ceil(total/st.size));
      if(st.page>pages) st.page=pages;
      var tools=el('div','dp-tbl__tools');
      if(opts.search!==false){
        var inp=el('input','dp-tbl__search'); inp.type='search'; inp.placeholder='Tìm trong bảng…'; inp.value=st.q;
        inp.setAttribute('aria-label','Tìm trong bảng'); inp.setAttribute('data-dp-nodirty','');
        on(inp,'input',function(){ st.q=inp.value; st.page=1; var pos=inp.selectionStart; render(); var n=host.querySelector('.dp-tbl__search'); if(n){ n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){} } });
        tools.appendChild(inp);
      }
      var cnt=el('div','dp-tbl__count', total+' bản ghi'+(st.q?' (đã lọc từ '+st.rows.length+')':'')); cnt.setAttribute('aria-live','polite'); tools.appendChild(cnt);
      host.appendChild(tools);
      if(!total){
        window.dpUI.state.empty(host.appendChild(el('div','dp-tbl__empty')),{filtered:!!st.q||false, title:st.q?undefined:opts.emptyTitle, text:st.q?undefined:opts.emptyText});
        return;
      }
      var wrap=el('div','dp-tbl__wrap'), t=el('table','dp-tbl__table');
      if(opts.caption){ t.appendChild(el('caption','dp-tbl__cap',opts.caption)); }
      var thead=el('thead'), hr=el('tr');
      cols.forEach(function(c){
        var th=el('th','dp-tbl__th'+(c.sticky?' is-sticky':'')+(c.priority==='low'?' is-low':''));
        th.scope='col'; if(c.width) th.style.minWidth=c.width; if(c.align) th.style.textAlign=c.align;
        if(c.sort){
          var b=el('button','dp-tbl__sort',c.label); b.type='button';
          var active=st.sortKey===c.key; th.setAttribute('aria-sort', active?(st.dir===1?'ascending':'descending'):'none');
          if(active) b.appendChild(el('span','dp-tbl__arrow',st.dir===1?' ▲':' ▼'));
          on(b,'click',function(){ if(st.sortKey===c.key){ st.dir=-st.dir; } else { st.sortKey=c.key; st.dir=1; } st.page=1; render(); });
          th.appendChild(b);
        } else th.textContent=c.label;
        hr.appendChild(th);
      }); thead.appendChild(hr); t.appendChild(thead);
      var tb=el('tbody'), start=(st.page-1)*st.size, slice=all.slice(start,start+st.size);
      slice.forEach(function(r,ri){
        var key=opts.rowKey?r[opts.rowKey]:(start+ri), tr=el('tr','dp-tbl__row'+(opts.onRowClick?' is-click':'')+(st.open[key]?' is-open':''));
        cols.forEach(function(c){
          var td=el('td','dp-tbl__td'+(c.sticky?' is-sticky':'')+(c.priority==='low'?' is-low':'')); td.setAttribute('data-label',c.label);
          if(c.align) td.style.textAlign=c.align;
          var n=cellNode(c,r); td.appendChild(n);
          if(!(n.nodeType===1) ){ var txt=td.textContent; if(txt && txt.length>28) td.title=txt; }   // tooltip cho nội dung dài/bị rút gọn
          tr.appendChild(td);
        });
        if(cols.some(function(c){return c.priority==='low';})){
          var mb=el('button','dp-tbl__more',st.open[key]?'Thu gọn':'Chi tiết'); mb.type='button'; mb.setAttribute('aria-expanded',st.open[key]?'true':'false');
          on(mb,'click',function(e){ e.stopPropagation(); st.open[key]=!st.open[key]; render(); });
          var mtd=el('td','dp-tbl__moretd'); mtd.appendChild(mb); tr.appendChild(mtd);
        }
        if(opts.onRowClick){ on(tr,'click',function(){ opts.onRowClick(r); }); tr.tabIndex=0; on(tr,'keydown',function(e){ if(e.key==='Enter') opts.onRowClick(r); }); }
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      if(cols.some(function(c){return c.priority==='low';})){ var extra=el('th','dp-tbl__th dp-tbl__morehd'); extra.setAttribute('aria-label','Chi tiết'); hr.appendChild(extra); }
      wrap.appendChild(t); host.appendChild(wrap);
      var pg=el('div','dp-tbl__pager');
      var sel=el('select','dp-tbl__size'); sel.setAttribute('aria-label','Số dòng mỗi trang'); sel.setAttribute('data-dp-nodirty','');
      sizes.forEach(function(s){ var o=el('option',null,s+' dòng/trang'); o.value=String(s); if(s===st.size) o.selected=true; sel.appendChild(o); });
      on(sel,'change',function(){ st.size=Number(sel.value)||25; st.page=1; render(); });
      var prev=el('button','dp-tbl__pbtn','‹ Trước'), next=el('button','dp-tbl__pbtn','Sau ›'); prev.type=next.type='button';
      prev.disabled=st.page<=1; next.disabled=st.page>=pages;
      on(prev,'click',function(){ if(st.page>1){ st.page--; render(); } }); on(next,'click',function(){ if(st.page<pages){ st.page++; render(); } });
      pg.appendChild(sel); pg.appendChild(prev); pg.appendChild(el('span','dp-tbl__pinfo','Trang '+st.page+'/'+pages)); pg.appendChild(next);
      host.appendChild(pg);
    }
    render();
    return {
      setRows:function(r){ st.rows=r||[]; st.mode='ready'; st.err=null; render(); },   // giữ nguyên tìm kiếm/sắp xếp/trang khi dữ liệu cập nhật
      setLoading:function(){ st.mode='loading'; render(); },
      setError:function(e){ st.mode='error'; st.err=e; render(); },
      getState:function(){ return {q:st.q, sortKey:st.sortKey, dir:st.dir, page:st.page, size:st.size, total:view().length}; },
      destroy:function(){ listeners.forEach(function(l){ l[0].removeEventListener(l[1],l[2]); }); listeners=[]; while(host.firstChild) host.removeChild(host.firstChild); host.classList.remove('dp-tbl'); }
    };
  }
  dpTable._norm=norm; dpTable._cmp=cmp;
  window.dpUI.table=dpTable;
})();
