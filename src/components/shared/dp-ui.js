// src/components/shared/dp-ui.js — lớp dùng chung MỚI (Bước 2). Chỉ THÊM, không đổi hành vi cũ.
//  1) dpNotify: thông báo 5 loại (success/info/warning/error) + chống trùng + lịch sử.
//  2) showToast cũ được bọc: vẫn hiển thị như trước, chỉ ghi thêm lỗi vào lịch sử.
//  3) dpState: trạng thái Loading / Empty / Error / Offline dựng bằng DOM (không innerHTML nối chuỗi).
//  4) dpModal: chặn đóng nhầm modal (bấm nền mờ) khi người dùng đã nhập dữ liệu chưa lưu.
// Nạp SAU Toast.js, Modal.js, ConfirmModal.js; TRƯỚC core/app.js. Gỡ: bỏ <script> + dòng trong sw.js.
(function(){
  'use strict';
  if(window.dpUI) return;

  var HIST_KEY='dp_notify_history_v1', HIST_MAX=50, DEDUP_MS=3000;
  var TYPES={
    success:{ico:'✓', ttl:3500, label:'Thành công'},
    info:   {ico:'i', ttl:4500, label:'Thông tin'},
    warning:{ico:'!', ttl:7000, label:'Cảnh báo'},
    error:  {ico:'✕', ttl:0,    label:'Lỗi'}          // ttl 0 = giữ đến khi người dùng đóng
  };
  var seq=0, live={}, hist=[];

  function el(tag, cls, text){
    var e=document.createElement(tag); if(cls) e.className=cls;
    if(text!=null) e.textContent=text; return e;
  }
  function loadHist(){
    try{ var r=JSON.parse(localStorage.getItem(HIST_KEY)||'[]'); if(Array.isArray(r)) hist=r.slice(-HIST_MAX); }catch(e){ hist=[]; }
  }
  function saveHist(){ try{ localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(-HIST_MAX))); }catch(e){} }
  // Chỉ lưu thông báo quan trọng (warning/error). scope: 'system' (hệ thống) | 'business' (cảnh báo nghiệp vụ)
  function record(type, msg, scope){
    if(type!=='warning' && type!=='error') return;
    var last=hist[hist.length-1];
    if(last && last.type===type && last.msg===msg && Date.now()-last.ts<DEDUP_MS){ last.n=(last.n||1)+1; saveHist(); return; }
    hist.push({ts:Date.now(), type:type, msg:String(msg), scope:scope||'system', n:1});
    if(hist.length>HIST_MAX) hist=hist.slice(-HIST_MAX);
    saveHist();
  }
  function box(){
    var b=document.getElementById('dpToasts');
    if(!b){
      b=el('div','dp-toasts'); b.id='dpToasts'; b.setAttribute('role','region'); b.setAttribute('aria-label','Thông báo');
      b.setAttribute('aria-live','polite'); (document.body||document.documentElement).appendChild(b);
    }
    return b;
  }
  function remove(id){
    var it=live[id]; if(!it) return;
    clearTimeout(it.timer); delete live[id];
    if(it.node && it.node.parentNode) it.node.parentNode.removeChild(it.node);
  }
  function arm(it, ttl){
    clearTimeout(it.timer);
    if(ttl>0) it.timer=setTimeout(function(){ remove(it.id); }, ttl);
  }

  // dpNotify('success'|'info'|'warning'|'error', 'Nội dung', {ttl, scope, title})
  function dpNotify(type, msg, opts){
    opts=opts||{};
    if(!TYPES[type]) type='info';
    msg=(msg==null?'':String(msg)); if(!msg) return 0;
    var scope=opts.scope||'system';
    record(type,msg,scope);
    var key=type+'|'+scope+'|'+msg, k;
    for(k in live){ if(live[k].key===key){            // trùng nội dung đang hiển thị → chỉ tăng bộ đếm
      var d=live[k]; d.n++; d.badge.textContent='×'+d.n; d.badge.hidden=false;
      arm(d, opts.ttl!=null?opts.ttl:TYPES[type].ttl); return d.id;
    } }
    var id=++seq, T=TYPES[type];
    var node=el('div','dp-toast dp-toast--'+type+(scope==='business'?' dp-toast--biz':''));
    node.setAttribute('role', type==='error'||type==='warning' ? 'alert' : 'status');
    node.appendChild(el('span','dp-toast__ico',T.ico));
    var body=el('div','dp-toast__body');
    body.appendChild(el('div','dp-toast__title', opts.title || (scope==='business'?'Cảnh báo nghiệp vụ':T.label)));
    body.appendChild(el('div','dp-toast__msg',msg));
    node.appendChild(body);
    var badge=el('span','dp-toast__n','×1'); badge.hidden=true; node.appendChild(badge);
    var x=el('button','dp-toast__x','×'); x.type='button'; x.setAttribute('aria-label','Đóng thông báo');
    x.addEventListener('click', function(){ remove(id); }); node.appendChild(x);
    box().appendChild(node);
    var it={id:id,key:key,n:1,node:node,badge:badge,timer:0}; live[id]=it;
    arm(it, opts.ttl!=null?opts.ttl:T.ttl);
    return id;
  }

  // ── Bọc showToast cũ: giữ nguyên hiển thị, chỉ ghi lỗi vào lịch sử ──
  if(typeof window.showToast==='function' && !window.showToast.__dpWrapped){
    var _orig=window.showToast;
    var wrapped=function(msg,isErr){
      try{ if(isErr) record('error', String(msg), 'system'); }catch(e){}
      return _orig.apply(this, arguments);
    };
    wrapped.__dpWrapped=true; window.showToast=wrapped;
  }

  // ── dpState: Loading / Empty / Error / Offline ──
  function clear(host){ while(host && host.firstChild) host.removeChild(host.firstChild); }
  function stateBox(kind, title, text, actionLabel, onAction){
    var b=el('div','dp-state dp-state--'+kind);
    b.setAttribute('role', kind==='error'||kind==='offline' ? 'alert' : 'status');
    b.appendChild(el('div','dp-state__ico', kind==='error'?'⚠':kind==='offline'?'⏻':'∅'));
    b.appendChild(el('div','dp-state__title',title));
    if(text) b.appendChild(el('div','dp-state__text',text));
    if(actionLabel && typeof onAction==='function'){
      var btn=el('button','btn dp-state__btn',actionLabel); btn.type='button';
      btn.addEventListener('click', onAction); b.appendChild(btn);
    }
    return b;
  }
  var dpState={
    clear:clear,
    loading:function(host, o){ o=o||{}; if(!host) return; clear(host);
      var w=el('div','dp-skel'); w.setAttribute('role','status'); w.setAttribute('aria-busy','true');
      w.setAttribute('aria-label', o.text||'Đang tải dữ liệu');
      var n=Math.max(1,Math.min(12,o.rows||5));
      for(var i=0;i<n;i++){ var r=el('div','dp-skel__row'); r.style.width=(100-(i%3)*12)+'%'; w.appendChild(r); }
      host.appendChild(w); },
    // Chưa có dữ liệu (KHÔNG phải lỗi). o.filtered=true → gợi ý chỉnh bộ lọc
    empty:function(host, o){ o=o||{}; if(!host) return; clear(host);
      host.appendChild(stateBox('empty', o.title||(o.filtered?'Không có kết quả phù hợp':'Chưa có dữ liệu'),
        o.text||(o.filtered?'Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.':''), o.actionLabel, o.onAction)); },
    // Lỗi tải/lưu: có nút Thử lại; ghi log để kiểm tra
    error:function(host, o){ o=o||{}; if(!host) return; clear(host);
      try{ console.error('[dpState.error]', o.title||'', o.error||o.text||''); }catch(e){}
      host.appendChild(stateBox('error', o.title||'Không tải được dữ liệu', o.text||'Kiểm tra kết nối rồi thử lại.',
        o.onRetry?(o.actionLabel||'Thử lại'):null, o.onRetry)); },
    offline:function(host, o){ o=o||{}; if(!host) return; clear(host);
      host.appendChild(stateBox('offline', o.title||'Đang ngoại tuyến',
        o.text||'Dữ liệu hiển thị là bản lưu trên máy này. Thay đổi chưa được xác nhận lưu lên máy chủ.',
        o.onRetry?(o.actionLabel||'Đồng bộ lại'):null, o.onRetry)); }
  };

  // ── dpModal: chặn đóng nhầm khi đang nhập dở ──
  var dirty=(typeof WeakSet==='function')?new WeakSet():null, watched=(typeof WeakSet==='function')?new WeakSet():null;
  function watch(m){
    if(!watched || watched.has(m) || typeof MutationObserver!=='function') return;
    watched.add(m);
    new MutationObserver(function(){ if(!m.classList.contains('open')) dirty.delete(m); })
      .observe(m,{attributes:true, attributeFilter:['class']});
  }
  function markIfUserInput(e){
    if(!dirty) return;
    var t=e.target; if(!t || !t.closest) return;
    var m=t.closest('.modal.open'); if(!m || m.id==='cfModal') return;
    if(t.type==='search' || t.readOnly || t.disabled || t.closest('[data-dp-nodirty]')) return;
    dirty.add(m); watch(m);
  }
  document.addEventListener('input', markIfUserInput, true);
  document.addEventListener('change', markIfUserInput, true);
  // Bắt ở pha capture để chạy TRƯỚC listener đóng-modal cũ trong Modal.js
  document.addEventListener('click', function(e){
    var m=e.target;
    if(!dirty || !m || !m.classList || !m.classList.contains('modal') || !m.classList.contains('open')) return;
    if(!dirty.has(m)) return;                       // chưa nhập gì → để Modal.js đóng như cũ
    e.stopPropagation();
    var id=m.id;
    if(typeof confirm2==='function'){
      confirm2('Đóng biểu mẫu?','Dữ liệu đã nhập chưa được lưu và sẽ mất nếu đóng.', function(){ dirty.delete(m); if(typeof closeModal==='function') closeModal(id); });
    }
  }, true);
  var dpModal={
    isDirty:function(id){ var m=document.getElementById(id); return !!(m && dirty && dirty.has(m)); },
    markClean:function(id){ var m=document.getElementById(id); if(m && dirty) dirty.delete(m); }
  };


  // ── dpNav: ẩn tiêu đề nhóm Sidebar khi mọi mục trong nhóm đều bị ẩn (do phân quyền/khoá vai trò) ──
  function navSync(root){
    root=root||document.getElementById('sidebar'); if(!root) return;
    var secs=root.querySelectorAll('.sb-section[data-g]');
    for(var i=0;i<secs.length;i++){
      var g=secs[i].getAttribute('data-g'), items=root.querySelectorAll('.sb-item[data-g="'+g+'"]'), any=false;
      for(var j=0;j<items.length;j++){ if(items[j].style.display!=='none'){ any=true; break; } }
      secs[i].style.display = any ? '' : 'none';
    }
  }
  function navWatch(){
    var nav=document.querySelector('#sidebar .sb-nav'); if(!nav || nav.__dpWatch || typeof MutationObserver!=='function') return;
    nav.__dpWatch=true; var queued=false;
    new MutationObserver(function(recs){
      for(var i=0;i<recs.length;i++){ if(recs[i].target.classList && recs[i].target.classList.contains('sb-item')){
        if(!queued){ queued=true; Promise.resolve().then(function(){ queued=false; navSync(); }); } break; } }
    }).observe(nav,{attributes:true, attributeFilter:['style'], subtree:true});
    navSync();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', navWatch); else navWatch();

  loadHist();
  window.dpNotify=dpNotify;
  window.dpUI={
    notify:dpNotify,
    dismiss:remove,
    history:function(){ return hist.slice(); },
    clearHistory:function(){ hist=[]; saveHist(); },
    state:dpState,
    modal:dpModal,
    nav:{sync:navSync}
  };
})();
