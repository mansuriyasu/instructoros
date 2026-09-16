// Local-only fixture server. Does not connect to Firebase or production APIs.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let simulateFailure = false;
const files = new Set(['offline.html', 'offline.css', 'offline-app.js', 'offline-store.js', 'firebase-messaging-sw.js', 'icons/icon-192.png']);
const fixture = `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline tests · local only</title><h1>Local offline workflow tests</h1><p>No production data or API calls.</p><button id="prepare">Prepare local sample</button><button id="tests">Run storage checks</button><button id="failure">Simulate lost network and open app</button><a href="/offline.html">Open saved workspace</a><pre id="result"></pre><script type="module">
import * as store from '/offline-store.js?v=2';
const scope='local-user:local-school';
const snapshot={scope,uid:'local-user',tenantId:'local-school',workspaceName:'Local test workspace',downloadedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7*86400000).toISOString(),canWrite:true,students:[{id:'sample',name:'Local Sample Student',address:'Local test address',mobileNumber:'',licenseType:'G2',status:'active'}],lessons:[{id:'lesson',studentId:'sample',studentName:'Local Sample Student',start:new Date(Date.now()+3600000).toISOString(),end:new Date(Date.now()+7200000).toISOString(),notes:'Existing lesson notes',version:'1:1',canWriteNotes:true,canEvaluate:true}],criteria:[{id:'parking',label:'Parking',testTypes:['G2','G'],maneuvers:[{id:'parking',label:'Parallel parking'}]}]};
const result=document.getElementById('result');
document.getElementById('prepare').onclick=async()=>{try{await store.clearOffline();await store.enableOffline(scope);await store.saveSnapshot(snapshot);const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js');await navigator.serviceWorker.ready;result.textContent='READY: local sample and service worker installed';}catch(e){result.textContent=e.stack;}};
document.getElementById('failure').onclick=async()=>{await fetch('/__failure');location.href='/app/schedule';};
document.getElementById('tests').onclick=async()=>{let checks=0;const assert=(condition,label)=>{if(!condition)throw Error(label);checks++;};try{
await store.clearOffline();await store.enableOffline(scope);await store.saveSnapshot(snapshot);
const id=await store.saveDraft(scope,'note','Test note',{studentId:'sample',lessonId:'lesson',version:'1:1',notes:'Persist me'});
assert((await store.readOfflineState()).drafts[0].id===id,'Durable draft');
const claims=await Promise.all([store.claimNextDraft(scope),store.claimNextDraft(scope)]);assert(claims.filter(Boolean).length===1,'One uploader per draft');
let refused=false;try{await store.deleteDraft(scope,id);}catch{refused=true;}assert(refused,'Cannot remove in-flight draft');
await store.setDraftResult(scope,id,'pending','Interrupted');assert((await store.claimNextDraft(scope)).id===id,'Retry keeps original ID');
await store.setDraftResult(scope,id,'conflict','Changed');await store.saveDraft(scope,'note','Reviewed note',{studentId:'sample',lessonId:'lesson',version:'2:1',notes:'Reviewed'},id);
let state=await store.readOfflineState();assert(state.drafts.length===1&&state.drafts[0].id!==id,'Review creates new operation');
await store.activateOffline('local-user:other');assert(!(await store.readOfflineState()).config.active,'Workspace switch hides snapshot');
refused=false;try{await store.saveDraft(scope,'student','Wrong scope',{});}catch{refused=true;}assert(refused,'Inactive scope blocks writes');
await store.activateOffline(scope);await store.saveSnapshot({...snapshot,expiresAt:new Date(0).toISOString()});
refused=false;try{await store.saveDraft(scope,'student','Expired',{});}catch{refused=true;}assert(refused,'Expired snapshot blocks new drafts');
assert((await store.readOfflineState()).drafts.length===1,'Expiry retains pending work');
await store.clearOffline();state=await store.readOfflineState();assert(!state.snapshot&&!state.config&&!state.drafts.length,'Logout clears all local data');
await store.enableOffline(scope);await store.saveSnapshot(snapshot);
result.textContent='PASS: '+checks+' storage checks; sample restored';
}catch(e){result.textContent='FAIL: '+e.stack;}};
</script></html>`;
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/__failure') { simulateFailure = true; res.end('ok'); return; }
  if (pathname === '/__fixture') { simulateFailure = false; res.setHeader('Content-Type', 'text/html'); res.end(fixture); return; }
  if (simulateFailure && pathname.startsWith('/app')) { req.socket.destroy(); return; }
  const name = pathname.slice(1);
  if (!files.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', ({ '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png' })[path.extname(name)]);
  res.end(fs.readFileSync(path.join(__dirname, '../public', name)));
}).listen(9003, '0.0.0.0', () => console.log('Local offline fixture: http://localhost:9003/__fixture'));
