// ════════════════════════════════════════════════════════════
// MÁY CHỦ GIẢ LẬP: web tĩnh + Firebase Realtime Database (in-memory)
// Cùng 1 origin → không cần CORS. Mô phỏng đúng phần REST mà app dùng:
// GET/PUT/PATCH/POST/DELETE "<path>.json", ETag + if-match (412 khi xung đột),
// và SSE (text/event-stream) đẩy thay đổi realtime xuống mọi client.
// App được trỏ tới DB giả bằng localStorage 'sx_fb_url' (cơ chế cấu hình sẵn có).
// ════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const MIME = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.md':'text/plain'};
const FB_PREFIX = '/__fb';

class MockDb {
  constructor(seed){ this.root = seed ? JSON.parse(JSON.stringify(seed)) : null; this.sse = new Set(); this.log = []; }
  get(p){ const parts=p.split('/').filter(Boolean); let n=this.root; for(const k of parts){ if(n==null||typeof n!=='object') return null; n=n[k]; } return n===undefined?null:n; }
  set(p, val){
    const parts=p.split('/').filter(Boolean);
    if(!parts.length){ this.root=val; }
    else {
      if(this.root==null||typeof this.root!=='object') this.root={};
      let n=this.root;
      for(let i=0;i<parts.length-1;i++){ if(n[parts[i]]==null||typeof n[parts[i]]!=='object') n[parts[i]]={}; n=n[parts[i]]; }
      const last=parts[parts.length-1]; if(val===null) delete n[last]; else n[last]=val;
    }
    // đẩy realtime tới mọi client SSE
    const msg = `event: put\ndata: ${JSON.stringify({path:p||'/', data:val})}\n\n`;
    for(const res of this.sse) res.write(msg);
  }
  etag(p){ return crypto.createHash('md5').update(JSON.stringify(this.get(p))).digest('hex'); }
}

function startServer(webRoot, db){
  return new Promise(resolve=>{
    const server = http.createServer((req,res)=>{
      const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
      if(p.startsWith(FB_PREFIX)){
        const fbPath = p.slice(FB_PREFIX.length).replace(/\.json$/,'');
        if((req.headers.accept||'').includes('text/event-stream')){
          res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});
          res.write(`event: put\ndata: ${JSON.stringify({path:'/', data:db.get('/')})}\n\n`);
          db.sse.add(res); const ka=setInterval(()=>res.write('event: keep-alive\ndata: null\n\n'),15000);
          req.on('close',()=>{ db.sse.delete(res); clearInterval(ka); }); return;
        }
        let chunks=[]; req.on('data',c=>chunks.push(c)); req.on('end',()=>{
          let body=null; try{ const t=Buffer.concat(chunks).toString(); body=t?JSON.parse(t):null; }catch(e){}
          const h={'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'ETag'};
          const m=req.method; db.log.push(m+' '+fbPath);
          if(m==='OPTIONS'){ res.writeHead(204,{...h,'access-control-allow-headers':'*','access-control-allow-methods':'*'}); return res.end(); }
          if(m==='GET'){ let v=db.get(fbPath); if(u.searchParams.get('shallow')==='true'&&v&&typeof v==='object') v=Object.fromEntries(Object.keys(v).map(k=>[k,true])); res.writeHead(200,{...h,'ETag':db.etag(fbPath)}); return res.end(JSON.stringify(v)); }
          const im=req.headers['if-match'];
          if(im && im!=='*' && im!==db.etag(fbPath)){ res.writeHead(412,h); return res.end(JSON.stringify(db.get(fbPath))); }
          if(m==='PUT') db.set(fbPath, body);
          else if(m==='PATCH'){ for(const [k,v] of Object.entries(body||{})) db.set(fbPath+'/'+k, v); }
          else if(m==='DELETE') db.set(fbPath, null);
          else if(m==='POST'){ const key='-K'+crypto.randomBytes(6).toString('hex'); db.set(fbPath+'/'+key, body); res.writeHead(200,h); return res.end(JSON.stringify({name:key})); }
          res.writeHead(200,{...h,'ETag':db.etag(fbPath)}); res.end(JSON.stringify(m==='DELETE'?null:body));
        }); return;
      }
      if(p.endsWith('/')) p+='index.html';
      const f = path.join(webRoot,p);
      if(!f.startsWith(webRoot) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('not found'); }
      res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'}); fs.createReadStream(f).pipe(res);
    }).listen(0,'127.0.0.1',()=>resolve({server, port:server.address().port, db}));
  });
}

// Chặn mọi request ra ngoài Internet (môi trường test không có mạng ngoài) và giả lập Firebase Auth ẩn danh
async function stubExternal(context){
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async route=>{
    const host = new URL(route.request().url()).hostname;
    if(host==='identitytoolkit.googleapis.com') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({idToken:'mock-id-token',refreshToken:'mock-refresh',expiresIn:'3600'})});
    if(host==='securetoken.googleapis.com') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id_token:'mock-id-token',refresh_token:'mock-refresh',expires_in:'3600'})});
    if(host.endsWith('googleapis.com')||host.endsWith('gstatic.com')) return route.fulfill({status:200,contentType:'text/css',body:''});
    if(['cdn.jsdelivr.net','unpkg.com','cdnjs.cloudflare.com'].includes(host)) return route.fulfill({status:200,contentType:'application/javascript',body:''});
    return route.abort('failed');
  });
}
module.exports = { MockDb, startServer, stubExternal, FB_PREFIX };
