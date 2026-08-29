const CONV_KEY = 'kenzy-ai-conversations-v2';
const FILE_META_KEY = 'kenzy-ai-file-meta-v2';
const DB_NAME = 'kenzy-ai-files-v2';
const MAX_FILE_BYTES = 3 * 1024 * 1024;

const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function putFile(record) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(record); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
async function getFile(fileId) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction('files', 'readonly'); const r = tx.objectStore('files').get(fileId); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
async function deleteFile(fileId) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(fileId); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
function blobToBase64(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = reject; reader.readAsDataURL(blob); }); }

function render() {
  const page = document.querySelector('.ai-page');
  if (!page || page.dataset.workspaceV2 === '1') return false;
  page.dataset.workspaceV2 = '1';
  page.innerHTML = `
    <div class="ai-v2-shell">
      <aside class="ai-v2-sidebar">
        <div class="ai-v2-side-head"><div><div class="eyebrow">KENZY AI</div><h3>Workspace</h3></div><button class="ai-v2-new" type="button">＋ New chat</button></div>
        <div class="ai-v2-side-section"><div class="ai-v2-side-label">RECENT</div><div class="ai-v2-conversations"></div></div>
        <div class="ai-v2-side-section ai-v2-files-section"><div class="ai-v2-side-label">FILES</div><label class="ai-v2-add-file">＋ Add study file<input class="ai-v2-file-input" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple></label><div class="ai-v2-files"></div><small>Files stay on this device until you attach them to a message.</small></div>
      </aside>
      <section class="ai-v2-chat">
        <div class="ai-v2-chat-head"><div><div class="eyebrow">AI STUDY ASSISTANT</div><h2>Ask Kenzy</h2><p>Ask questions, explain topics, or work directly with your study files.</p></div><span class="ai-v2-status"><i></i> Ready</span></div>
        <div class="ai-v2-messages"></div>
        <div class="ai-v2-compose-wrap"><div class="ai-v2-attachments"></div><form class="ai-v2-form"><textarea rows="2" placeholder="Ask Kenzy anything about your studies…"></textarea><div class="ai-v2-compose-bottom"><div class="ai-v2-compose-tools"><button class="ai-v2-attach-button" type="button" title="Attach a PDF or image">📎 <span>Attach</span></button><input class="ai-v2-compose-file-input" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple hidden><div class="ai-v2-quick"><button type="button" data-quick="Explain this simply">Explain simply</button><button type="button" data-quick="Make me a study plan for this topic">Study plan</button><button type="button" data-quick="Give me practice questions on this topic">Practice questions</button></div></div><button class="button primary ai-v2-send" type="submit">Send <span>↵</span></button></div></form></div>
      </section>
    </div>`;
  bind();
  loadConversation(load('kenzy-ai-active-v2', null));
  return true;
}

function getConversations() { return load(CONV_KEY, []); }
function getActive() { return load('kenzy-ai-active-v2', null); }
function ensureConversation() {
  const conversations = getConversations();
  let activeId = getActive();
  let active = conversations.find(c => c.id === activeId);
  if (!active) { active={id:id(),title:'New chat',messages:[{role:'assistant',content:'Hi! I’m Kenzy. Ask me to explain a topic, build a study plan, or help you understand your study material.'}],updatedAt:Date.now()}; conversations.unshift(active); save(CONV_KEY,conversations); save('kenzy-ai-active-v2',active.id); }
  return active;
}
function persistConversation(conversation) { const all=getConversations().filter(c=>c.id!==conversation.id); save(CONV_KEY,[conversation,...all].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,50)); save('kenzy-ai-active-v2',conversation.id); }
function renderConversations(){const el=document.querySelector('.ai-v2-conversations');if(!el)return;const active=getActive();const rows=getConversations();el.innerHTML=rows.length?rows.map(c=>`<div class="ai-v2-conv ${c.id===active?'active':''}"><button class="ai-v2-conv-open" type="button" data-open="${c.id}"><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(lastText(c))}</small></button><button class="ai-v2-conv-menu" type="button" data-delete="${c.id}" title="Delete conversation">×</button></div>`).join(''):'<div class="ai-v2-empty">No conversations yet.</div>';el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>loadConversation(b.dataset.open));el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();deleteConversation(b.dataset.delete);});}
function lastText(c){const m=[...c.messages].reverse().find(x=>x.role==='user');return m?.content||'New conversation';}
function renderFiles(){const el=document.querySelector('.ai-v2-files');if(!el)return;const files=load(FILE_META_KEY,[]);const active=new Set(load('kenzy-ai-selected-files-v2',[]));el.innerHTML=files.length?files.map(f=>`<div class="ai-v2-file ${active.has(f.id)?'selected':''}"><input type="checkbox" data-file-select="${f.id}" ${active.has(f.id)?'checked':''}/><span class="ai-v2-file-type">${f.type.includes('pdf')?'PDF':'IMG'}</span><span><strong>${escapeHtml(f.name)}</strong><small>${formatSize(f.size)}</small></span><button type="button" data-file-delete="${f.id}" title="Remove">×</button></div>`).join(''):'<div class="ai-v2-empty">No study files yet.<br/>Add a PDF or image to ask Kenzy about it.</div>';el.querySelectorAll('[data-file-select]').forEach(input=>input.onchange=()=>{const selected=new Set(load('kenzy-ai-selected-files-v2',[]));input.checked?selected.add(input.dataset.fileSelect):selected.delete(input.dataset.fileSelect);save('kenzy-ai-selected-files-v2',[...selected]);renderFiles();renderAttachments();});el.querySelectorAll('[data-file-delete]').forEach(btn=>btn.onclick=async e=>{e.preventDefault();e.stopPropagation();await deleteFile(btn.dataset.fileDelete);save(FILE_META_KEY,files.filter(f=>f.id!==btn.dataset.fileDelete));save('kenzy-ai-selected-files-v2',load('kenzy-ai-selected-files-v2',[]).filter(x=>x!==btn.dataset.fileDelete));renderFiles();renderAttachments();});}
function renderAttachments(){const el=document.querySelector('.ai-v2-attachments');if(!el)return;const files=load(FILE_META_KEY,[]);const selected=new Set(load('kenzy-ai-selected-files-v2',[]));el.innerHTML=files.filter(f=>selected.has(f.id)).map(f=>`<span>📎 ${escapeHtml(f.name)} <button type="button" data-unattach="${f.id}" title="Remove attachment">×</button></span>`).join('');el.querySelectorAll('[data-unattach]').forEach(b=>b.onclick=()=>{save('kenzy-ai-selected-files-v2',load('kenzy-ai-selected-files-v2',[]).filter(x=>x!==b.dataset.unattach));renderFiles();renderAttachments();});}

async function hydrateMessageAttachments(container, attachments=[]) {
  for (const attachment of attachments) {
    try {
      const record = await getFile(attachment.id);
      if (!record?.blob) continue;
      if (record.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'ai-v2-message-image';
        img.alt = attachment.name || 'Attached study image';
        const url = URL.createObjectURL(record.blob);
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
        container.appendChild(img);
      } else {
        const chip = document.createElement('div');
        chip.className = 'ai-v2-message-file';
        chip.textContent = `📎 ${attachment.name || 'Attached PDF'}`;
        container.appendChild(chip);
      }
    } catch {}
  }
}

function renderMessages(conversation){
  const el=document.querySelector('.ai-v2-messages');if(!el)return;
  el.innerHTML=conversation.messages.map((m,index)=>`<article class="ai-v2-message ${m.role}"><div class="ai-v2-avatar">${m.role==='user'?'KC':'K'}</div><div class="ai-v2-bubble">${m.attachments?.length?`<div class="ai-v2-message-attachments" data-message-attachments="${index}"></div>`:''}<div class="ai-v2-message-label">${m.role==='user'?'You':'Kenzy'}</div><div class="ai-v2-content">${formatText(m.content)}</div></div></article>`).join('');
  conversation.messages.forEach((m,index)=>{if(m.attachments?.length){const target=el.querySelector(`[data-message-attachments="${index}"]`);if(target)hydrateMessageAttachments(target,m.attachments);}});
  el.scrollTop=el.scrollHeight;
}
function loadConversation(conversationId){const c=getConversations().find(x=>x.id===conversationId)||ensureConversation();save('kenzy-ai-active-v2',c.id);renderConversations();renderMessages(c);renderAttachments();const ta=document.querySelector('.ai-v2-form textarea');if(ta)ta.focus();}
function deleteConversation(conversationId){const rows=getConversations().filter(c=>c.id!==conversationId);save(CONV_KEY,rows);if(getActive()===conversationId)save('kenzy-ai-active-v2',rows[0]?.id||null);if(!rows.length)ensureConversation();loadConversation(getActive());}
async function addFiles(fileList){const files=Array.from(fileList||[]);if(!files.length)return;const existing=load(FILE_META_KEY,[]);const existingBytes=existing.reduce((n,f)=>n+f.size,0);const incomingBytes=files.reduce((n,f)=>n+f.size,0);if(existingBytes+incomingBytes>MAX_FILE_BYTES)return alert('Keep your saved AI files under 3 MB total for now.');const allowed=['application/pdf','image/png','image/jpeg','image/webp'];if(files.some(f=>!allowed.includes(f.type)))return alert('Use PDF, PNG, JPG, or WebP files only.');const meta=[...existing];const selected=new Set(load('kenzy-ai-selected-files-v2',[]));for(const file of files){const fileId=id();await putFile({id:fileId,name:file.name,type:file.type,size:file.size,blob:file});meta.unshift({id:fileId,name:file.name,type:file.type,size:file.size,addedAt:Date.now()});selected.add(fileId);}save(FILE_META_KEY,meta.slice(0,30));save('kenzy-ai-selected-files-v2',[...selected].slice(0,10));renderFiles();renderAttachments();}
async function send(event){event.preventDefault();const ta=document.querySelector('.ai-v2-form textarea');const text=ta?.value.trim();const selected=load('kenzy-ai-selected-files-v2',[]);if(!text&&!selected.length)return;const conversation=ensureConversation();const files=[];const attachments=[];for(const fid of selected){const f=await getFile(fid);if(f?.blob){files.push({name:f.name,mimeType:f.type,data:await blobToBase64(f.blob)});attachments.push({id:fid,name:f.name,type:f.type,size:f.size});}}const userMessage={role:'user',content:text||'Please analyze the attached study material.',attachments};conversation.messages.push(userMessage);if(conversation.title==='New chat'){const title=text||attachments[0]?.name||'Study material';conversation.title=title.length>45?`${title.slice(0,45)}…`:title;}conversation.updatedAt=Date.now();save('kenzy-ai-selected-files-v2',[]);persistConversation(conversation);renderConversations();renderMessages(conversation);renderAttachments();ta.value='';setBusy(true);try{const response=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:conversation.messages.slice(-10).map(m=>({role:m.role,content:m.content})),files})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'AI request failed.');conversation.messages.push({role:'assistant',content:data.reply});conversation.updatedAt=Date.now();persistConversation(conversation);renderMessages(conversation);}catch(e){conversation.messages.push({role:'assistant',content:`Sorry, I couldn't answer that. ${e.message||''}`.trim()});persistConversation(conversation);renderMessages(conversation);}finally{setBusy(false);}}
function setBusy(busy){const btn=document.querySelector('.ai-v2-send');const status=document.querySelector('.ai-v2-status');if(btn){btn.disabled=busy;btn.innerHTML=busy?'Thinking… <span class="ai-v2-mini-spin"></span>':'Send <span>↵</span>';}if(status)status.innerHTML=busy?'<i class="busy"></i> Thinking…':'<i></i> Ready';}
function bind(){
  const newChat=document.querySelector('.ai-v2-new'); if(newChat)newChat.onclick=()=>{const c={id:id(),title:'New chat',messages:[{role:'assistant',content:'New chat started. What are you studying?'}],updatedAt:Date.now()};save('kenzy-ai-active-v2',c.id);save(CONV_KEY,[c,...getConversations()].slice(0,50));loadConversation(c.id);};
  const form=document.querySelector('.ai-v2-form'); if(form)form.addEventListener('submit',send);
  const fileInput=document.querySelector('.ai-v2-file-input'); if(fileInput)fileInput.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
  const composeButton=document.querySelector('.ai-v2-attach-button'); const composeInput=document.querySelector('.ai-v2-compose-file-input');
  if(composeButton&&composeInput){composeButton.onclick=()=>composeInput.click();composeInput.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});}
  document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{const ta=document.querySelector('.ai-v2-form textarea');if(ta){ta.value=b.dataset.quick;ta.focus();}});
  const ta=document.querySelector('.ai-v2-form textarea'); if(ta)ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form?.requestSubmit();}});
}
function formatText(text){return escapeHtml(text).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br/>');}
function escapeHtml(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function formatSize(bytes){return bytes<1048576?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1048576).toFixed(1)} MB`;}
function boot(){
  if(window.__kenzyAiWorkspaceStarted)return;
  window.__kenzyAiWorkspaceStarted=true;
  const tryInit=()=>{
    const page=document.querySelector('.ai-page');
    if(page && page.dataset.workspaceV2!=='1') render();
  };
  tryInit();
  setInterval(tryInit,300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
