const MAX_FILE_BYTES = 25 * 1024 * 1024;
const INLINE_LIMIT = 3 * 1024 * 1024;
const DB_NAME = 'studyken-ai-files-v3';
const META_KEY = 'studyken-ai-file-meta-v3';
const CONV_KEY = 'studyken-ai-conversations-v3';
const ACTIVE_KEY = 'studyken-ai-active-v3';
const SELECTED_KEY = 'studyken-ai-selected-v3';
const ALLOWED = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);

const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const formatSize = (bytes) => bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function formatText(value) {
  let text = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  const codeBlocks = [];
  text = text.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.push(`<pre class="ai-v3-code"><code>${escapeHtml(code.trim())}</code></pre>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });
  text = escapeHtml(text)
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong class="ai-v3-heading">$1</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`\n]+)`/g, '<code class="ai-v3-inline-code">$1</code>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<span class="ai-v3-list-item">• $1</span>')
    .replace(/^\s*\d+[.)]\s+(.+)$/gm, '<span class="ai-v3-list-item">$&</span>')
    .replace(/\n/g, '<br>');
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codeBlocks[Number(i)] || '');
  return text;
}

function openDb() { return new Promise((resolve, reject) => { const req=indexedDB.open(DB_NAME,1); req.onupgradeneeded=()=>req.result.createObjectStore('files',{keyPath:'id'}); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
async function putFile(record) { const db=await openDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put(record); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); }); }
async function getFile(id) { const db=await openDb(); return new Promise((resolve,reject)=>{ const req=db.transaction('files','readonly').objectStore('files').get(id); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
async function deleteFile(id) { const db=await openDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').delete(id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); }); }
function fileToBase64(file) { return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result).split(',')[1]||''); r.onerror=()=>reject(new Error('Could not read the file.')); r.readAsDataURL(file); }); }

function page() { return document.querySelector('.ai-page'); }
function setStatus(message, kind='info') { const el=document.querySelector('.ai-v3-status-message'); if(!el)return; el.textContent=message; el.dataset.kind=kind; el.classList.add('visible'); }
function clearStatus() { const el=document.querySelector('.ai-v3-status-message'); if(el){el.classList.remove('visible');el.textContent='';} }
function totalSavedBytes(meta) { return meta.reduce((n,f)=>n+(Number(f.size)||0),0); }

function render() {
  const p=page();
  if(!p || p.dataset.aiV3==='1') return;
  p.dataset.aiV3='1';
  p.innerHTML=`
  <div class="ai-v3-shell">
    <button class="ai-v3-back" type="button">← Back</button>
    <aside class="ai-v3-sidebar">
      <div class="ai-v3-side-head"><div><div class="eyebrow">STUDYKEN AI</div><h2>Workspace</h2></div><button class="ai-v3-new" type="button">＋ New chat</button></div>
      <div class="ai-v3-section"><div class="ai-v3-label">RECENT</div><div class="ai-v3-conversations"></div></div>
      <div class="ai-v3-section"><div class="ai-v3-label">FILES</div><label class="ai-v3-add-file">＋ Add study file<input class="ai-v3-file-input" type="file" accept=".pdf,.ppt,.pptx,image/png,image/jpeg,image/webp" multiple></label><div class="ai-v3-files"></div><small>PDF, PPT, PPTX, PNG, JPG, or WebP · 25 MB combined</small></div>
    </aside>
    <section class="ai-v3-chat">
      <header class="ai-v3-chat-head"><div><div class="eyebrow">AI STUDY ASSISTANT</div><h2>Ask StudyKen</h2><p>Ask a question, explain a topic, or attach study material.</p></div><span class="ai-v3-provider"><i></i> Fast AI</span></header>
      <div class="ai-v3-messages"></div>
      <div class="ai-v3-status-message" role="status"></div>
      <form class="ai-v3-form">
        <div class="ai-v3-attachments"></div>
        <textarea rows="2" placeholder="Ask StudyKen anything about your studies…"></textarea>
        <div class="ai-v3-compose"><div><button class="ai-v3-attach" type="button">📎 Attach</button><input class="ai-v3-compose-input" type="file" accept=".pdf,.ppt,.pptx,image/png,image/jpeg,image/webp" multiple hidden><div class="ai-v3-quick"><button type="button" data-quick="Explain this simply.">Explain simply</button><button type="button" data-quick="Make a study plan for this topic.">Study plan</button><button type="button" data-quick="Give me practice questions for this topic.">Practice questions</button></div></div><button class="button primary ai-v3-send" type="submit">Send ↵</button></div>
      </form>
    </section>
  </div>`;
  bind();
  loadConversation(load(ACTIVE_KEY,null));
}

function conversations(){ return load(CONV_KEY,[]); }
function activeConversation(){ return load(ACTIVE_KEY,null); }
function ensureConversation(){ const rows=conversations(); let c=rows.find(x=>x.id===activeConversation()); if(!c){ c={id:uid(),title:'New chat',messages:[{role:'assistant',content:'Hi! I’m StudyKen. What are you studying today?'}],updatedAt:Date.now()}; save(CONV_KEY,[c,...rows]); save(ACTIVE_KEY,c.id); } return c; }
function persist(c){ const rows=conversations().filter(x=>x.id!==c.id); save(CONV_KEY,[c,...rows].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,50)); save(ACTIVE_KEY,c.id); }
function renderConversations(){ const el=document.querySelector('.ai-v3-conversations'); if(!el)return; const active=activeConversation(); const rows=conversations(); el.innerHTML=rows.length?rows.map(c=>`<div class="ai-v3-conv ${c.id===active?'active':''}"><button type="button" data-open="${c.id}"><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.messages?.slice().reverse().find(m=>m.role==='user')?.content||'New conversation')}</small></button><button type="button" data-delete="${c.id}" aria-label="Delete conversation">×</button></div>`).join(''):'<div class="ai-v3-empty">No conversations yet.</div>'; el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>loadConversation(b.dataset.open)); el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const id=b.dataset.delete; const next=rows.filter(x=>x.id!==id); save(CONV_KEY,next); if(activeConversation()===id) save(ACTIVE_KEY,next[0]?.id||null); if(!next.length) ensureConversation(); loadConversation(activeConversation());}); }

function renderFiles(){ const el=document.querySelector('.ai-v3-files'); if(!el)return; const rows=load(META_KEY,[]); const selected=new Set(load(SELECTED_KEY,[])); el.innerHTML=rows.length?rows.map(f=>`<div class="ai-v3-file ${selected.has(f.id)?'selected':''}"><input type="checkbox" data-select="${f.id}" ${selected.has(f.id)?'checked':''}><span class="ai-v3-type">${f.type.includes('presentation')||f.type.includes('powerpoint')?'PPT':f.type.includes('pdf')?'PDF':'IMG'}</span><div><strong>${escapeHtml(f.name)}</strong><small>${formatSize(f.size)}</small></div><button type="button" data-remove="${f.id}">×</button></div>`).join(''):'<div class="ai-v3-empty">No study files yet.</div>'; el.querySelectorAll('[data-select]').forEach(i=>i.onchange=()=>{const s=new Set(load(SELECTED_KEY,[])); i.checked?s.add(i.dataset.select):s.delete(i.dataset.select); save(SELECTED_KEY,[...s]); renderFiles(); renderAttachments();}); el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{await deleteFile(b.dataset.remove); save(META_KEY,rows.filter(x=>x.id!==b.dataset.remove)); save(SELECTED_KEY,load(SELECTED_KEY,[]).filter(x=>x!==b.dataset.remove)); renderFiles(); renderAttachments();}); }
function renderAttachments(){ const el=document.querySelector('.ai-v3-attachments'); if(!el)return; const rows=load(META_KEY,[]); const selected=new Set(load(SELECTED_KEY,[])); el.innerHTML=rows.filter(f=>selected.has(f.id)).map(f=>`<span>📎 ${escapeHtml(f.name)} <button type="button" data-unattach="${f.id}">×</button></span>`).join(''); el.querySelectorAll('[data-unattach]').forEach(b=>b.onclick=()=>{save(SELECTED_KEY,load(SELECTED_KEY,[]).filter(x=>x!==b.dataset.unattach));renderFiles();renderAttachments();}); }

function renderMessages(c){ const el=document.querySelector('.ai-v3-messages'); if(!el)return; el.innerHTML=c.messages.map(m=>`<article class="ai-v3-message ${m.role}"><div class="ai-v3-avatar">${m.role==='user'?'KC':'K'}</div><div class="ai-v3-bubble"><div class="ai-v3-label">${m.role==='user'?'You':'StudyKen'}</div>${m.content?`<div class="ai-v3-content">${formatText(m.content)}</div>`:''}${m.attachments?.length?`<div class="ai-v3-message-files">${m.attachments.map(a=>`<span>📎 ${escapeHtml(a.name)}</span>`).join('')}</div>`:''}</div></article>`).join(''); scrollMessagesToBottom(); }
function scrollMessagesToBottom(){ const el=document.querySelector('.ai-v3-messages'); if(el)requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight;}); }
function loadConversation(id){ const c=conversations().find(x=>x.id===id)||ensureConversation(); save(ACTIVE_KEY,c.id); renderConversations(); renderMessages(c); renderFiles(); renderAttachments(); document.querySelector('.ai-v3-form textarea')?.focus(); }

function showThinking(){
  const el=document.querySelector('.ai-v3-messages');
  if(!el || el.querySelector('.ai-v3-thinking-message')) return;
  const article=document.createElement('article');
  article.className='ai-v3-message assistant ai-v3-thinking-message';
  article.innerHTML=`<div class="ai-v3-avatar">K</div><div class="ai-v3-bubble ai-v3-thinking-bubble"><div class="ai-v3-label">StudyKen</div><div class="ai-v3-thinking"><span class="ai-v3-thinking-orb" aria-hidden="true"><i></i><i></i><i></i></span><span class="ai-v3-thinking-text" aria-live="polite">Reading your question…</span></div></div>`;
  el.appendChild(article);
  scrollMessagesToBottom();
  const messages=['Reading your question…','Connecting the ideas…','Checking the details…','Building a clear explanation…','Almost there…'];
  let index=0;
  article._thinkingTimer=window.setInterval(()=>{
    if(!document.body.contains(article)){window.clearInterval(article._thinkingTimer);return;}
    index=(index+1)%messages.length;
    const label=article.querySelector('.ai-v3-thinking-text');
    if(label){label.classList.remove('is-changing');void label.offsetWidth;label.textContent=messages[index];label.classList.add('is-changing');}
  },1500);
}
function hideThinking(){ const node=document.querySelector('.ai-v3-thinking-message'); if(node){if(node._thinkingTimer)window.clearInterval(node._thinkingTimer);node.remove();} }

async function addFiles(list){ const files=Array.from(list||[]); if(!files.length)return; const bad=files.find(f=>!ALLOWED.has(f.type)); if(bad){setStatus(`Unsupported file type: ${bad.name}`,'error');return;} const meta=load(META_KEY,[]); const incoming=files.reduce((n,f)=>n+f.size,0); if(totalSavedBytes(meta)+incoming>MAX_FILE_BYTES){setStatus('Keep saved study files at or below 25 MB combined.','error');return;} const selected=new Set(load(SELECTED_KEY,[])); for(const file of files){const id=uid(); await putFile({id,name:file.name,type:file.type,size:file.size,blob:file}); meta.unshift({id,name:file.name,type:file.type,size:file.size,addedAt:Date.now()}); selected.add(id);} save(META_KEY,meta.slice(0,30)); save(SELECTED_KEY,[...selected].slice(0,10)); renderFiles(); renderAttachments(); setStatus(`${files.length} file${files.length>1?'s':''} ready to attach.`,'success'); }

async function prepareSelected(){ const ids=load(SELECTED_KEY,[]); const inline=[]; const blobs=[]; const attachments=[]; for(const id of ids){ const f=await getFile(id); if(!f?.blob)continue; attachments.push({id:f.id,name:f.name,type:f.type,size:f.size}); if(f.size<=INLINE_LIMIT){ inline.push({name:f.name,mimeType:f.type,data:await fileToBase64(f.blob)}); } else { const {upload}=await import('@vercel/blob/client'); const uploaded=await upload(`kenzy-material/${uid()}-${f.name.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(0,100)}`,f.blob,{access:'private',handleUploadUrl:'/api/blob-upload',multipart:f.size>5*1024*1024}); blobs.push({pathname:uploaded.pathname,name:f.name,mimeType:f.type,size:f.size}); } } return {inline,blobs,attachments}; }

async function send(e){
  e.preventDefault();
  const ta=document.querySelector('.ai-v3-form textarea');
  const text=ta?.value.trim()||'';
  const selected=load(SELECTED_KEY,[]);
  if(!text&&!selected.length)return;
  const c=ensureConversation();
  setBusy(true);
  clearStatus();
  showThinking();
  try {
    const prepared=await prepareSelected();
    const user={role:'user',content:text||'Please analyze my attached study material.',attachments:prepared.attachments};
    c.messages.push(user);
    if(c.title==='New chat'){const base=text||prepared.attachments[0]?.name||'Study material';c.title=base.length>45?`${base.slice(0,45)}…`:base;}
    c.updatedAt=Date.now();
    persist(c);
    save(SELECTED_KEY,[]);
    renderConversations();
    renderMessages(c);
    renderAttachments();
    ta.value='';
    showThinking();
    if(prepared.attachments.length) setStatus(`Checking ${prepared.attachments.length} attached file${prepared.attachments.length>1?'s':''}…`,'working');
    const body={messages:c.messages.slice(-8).map(m=>({role:m.role,content:m.content})),files:prepared.inline,blobFiles:prepared.blobs};
    const response=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'AI request failed.');
    hideThinking();
    c.messages.push({role:'assistant',content:data.reply});
    c.updatedAt=Date.now();
    persist(c);
    renderConversations();
    renderMessages(c);
    setStatus('Ready.','success');
  } catch(error) {
    hideThinking();
    c.messages.push({role:'assistant',content:`Sorry, I couldn't answer that. ${error.message||'Please try again.'}`});
    c.updatedAt=Date.now();
    persist(c);
    renderMessages(c);
    setStatus(error.message||'AI request failed.','error');
  } finally { setBusy(false); }
}
function setBusy(busy){const btn=document.querySelector('.ai-v3-send');const provider=document.querySelector('.ai-v3-provider');if(btn){btn.disabled=busy;btn.textContent=busy?'Thinking…':'Send ↵';}if(provider)provider.innerHTML=busy?'<i class="busy"></i> Thinking…':'<i></i> Fast AI';}
function bind(){ const back=document.querySelector('.ai-v3-back'); if(back)back.onclick=()=>{window.dispatchEvent(new CustomEvent('studyken:navigate',{detail:{page:'home'}}));}; const n=document.querySelector('.ai-v3-new'); if(n)n.onclick=()=>{const c={id:uid(),title:'New chat',messages:[{role:'assistant',content:'New chat started. What are you studying?'}],updatedAt:Date.now()};save(CONV_KEY,[c,...conversations()].slice(0,50));save(ACTIVE_KEY,c.id);loadConversation(c.id);}; const form=document.querySelector('.ai-v3-form'); if(form)form.addEventListener('submit',send); const input=document.querySelector('.ai-v3-file-input'); if(input)input.onchange=e=>{addFiles(e.target.files);e.target.value='';}; const attach=document.querySelector('.ai-v3-attach'); const compose=document.querySelector('.ai-v3-compose-input'); if(attach&&compose){attach.onclick=()=>compose.click();compose.onchange=e=>{addFiles(e.target.files);e.target.value='';};} document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{const ta=document.querySelector('.ai-v3-form textarea');if(ta){ta.value=b.dataset.quick;ta.focus();}}); const ta=document.querySelector('.ai-v3-form textarea'); if(ta)ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form?.requestSubmit();}}); }
function boot(){if(window.__studykenAiV3)return;window.__studykenAiV3=true;const check=()=>{if(page()&&!page().dataset.aiV3)render();};check();setInterval(check,400);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
