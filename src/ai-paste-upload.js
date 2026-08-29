const PASTE_DB='kenzy-ai-files-v2';
const PASTE_META='kenzy-ai-file-meta-v2';
const PASTE_SELECTED='kenzy-ai-selected-files-v2';
const PASTE_MAX=3*1024*1024;
const ALLOWED=['application/pdf','image/png','image/jpeg','image/webp'];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const makeId=()=>`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
function formatSize(bytes){return bytes<1048576?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1048576).toFixed(1)} MB`;}
function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(PASTE_DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function storeFile(record){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function renderPastedUi(){
  const files=read(PASTE_META,[]); const selected=new Set(read(PASTE_SELECTED,[]));
  const filesEl=document.querySelector('.ai-v2-files');
  if(filesEl){
    filesEl.innerHTML=files.length?files.map(f=>`<div class="ai-v2-file ${selected.has(f.id)?'selected':''}"><input type="checkbox" data-paste-select="${esc(f.id)}" ${selected.has(f.id)?'checked':''}/><span class="ai-v2-file-type">${f.type.includes('pdf')?'PDF':'IMG'}</span><span><strong>${esc(f.name)}</strong><small>${formatSize(f.size)}</small></span><button type="button" data-paste-delete="${esc(f.id)}" title="Remove">×</button></div>`).join(''):'<div class="ai-v2-empty">No study files yet.<br/>Add a PDF or image to ask Kenzy about it.</div>';
    filesEl.querySelectorAll('[data-paste-select]').forEach(input=>input.addEventListener('change',()=>{const now=new Set(read(PASTE_SELECTED,[]));input.checked?now.add(input.dataset.pasteSelect):now.delete(input.dataset.pasteSelect);write(PASTE_SELECTED,[...now]);renderPastedUi();}));
    filesEl.querySelectorAll('[data-paste-delete]').forEach(button=>button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();write(PASTE_META,files.filter(f=>f.id!==button.dataset.pasteDelete));write(PASTE_SELECTED,[...selected].filter(id=>id!==button.dataset.pasteDelete));renderPastedUi();}));
  }
  const attachments=document.querySelector('.ai-v2-attachments');
  if(attachments)attachments.innerHTML=files.filter(f=>selected.has(f.id)).map(f=>`<span>📎 ${esc(f.name)} <button type="button" data-paste-unattach="${esc(f.id)}" title="Remove attachment">×</button></span>`).join('');
  attachments?.querySelectorAll('[data-paste-unattach]').forEach(button=>button.addEventListener('click',()=>{write(PASTE_SELECTED,[...selected].filter(id=>id!==button.dataset.pasteUnattach));renderPastedUi();}));
}
async function pasteFiles(files){
  const incoming=Array.from(files||[]).filter(file=>ALLOWED.includes(file.type));
  if(!incoming.length)return false;
  const existing=read(PASTE_META,[]);
  const existingBytes=existing.reduce((sum,file)=>sum+Number(file.size||0),0);
  const incomingBytes=incoming.reduce((sum,file)=>sum+file.size,0);
  if(existingBytes+incomingBytes>PASTE_MAX){alert('Keep your saved AI files under 3 MB total for now.');return true;}
  const meta=[...existing]; const selected=new Set(read(PASTE_SELECTED,[]));
  for(const file of incoming){
    const fileId=makeId();
    const name=file.name||`pasted-${Date.now()}.${file.type.split('/')[1]||'bin'}`;
    await storeFile({id:fileId,name,type:file.type,size:file.size,blob:file});
    meta.unshift({id:fileId,name,type:file.type,size:file.size,addedAt:Date.now()});
    selected.add(fileId);
  }
  write(PASTE_META,meta.slice(0,30));
  write(PASTE_SELECTED,[...selected].slice(0,10));
  renderPastedUi();
  const notice=document.querySelector('.ai-v2-paste-notice');
  if(notice){notice.textContent=`Attached ${incoming.length} pasted file${incoming.length===1?'':'s'} — ready to send.`;notice.classList.add('show');setTimeout(()=>notice.classList.remove('show'),2400);}
  return true;
}
function bindPaste(){
  if(window.__kenzyPasteBound)return;
  window.__kenzyPasteBound=true;
  document.addEventListener('paste',async event=>{
    const textarea=event.target instanceof HTMLTextAreaElement?event.target:null;
    if(!textarea||!textarea.closest('.ai-v2-form'))return;
    const items=Array.from(event.clipboardData?.items||[]); const files=[];
    for(const item of items){if(item.kind==='file'){const file=item.getAsFile();if(file)files.push(file);}}
    if(!files.length&&event.clipboardData?.files?.length)files.push(...Array.from(event.clipboardData.files));
    if(!files.some(file=>ALLOWED.includes(file.type)))return;
    event.preventDefault();
    await pasteFiles(files);
  },true);
}
function injectNotice(){
  if(document.querySelector('.ai-v2-paste-notice'))return;
  const wrap=document.querySelector('.ai-v2-compose-wrap'); if(!wrap)return;
  const notice=document.createElement('div');
  notice.className='ai-v2-paste-notice';
  notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite');
  wrap.insertBefore(notice,wrap.firstChild);
}
function injectStyles(){
  if(document.getElementById('kenzy-paste-style'))return;
  const style=document.createElement('style');style.id='kenzy-paste-style';style.textContent='.ai-v2-paste-notice{display:none;padding:7px 10px;margin-bottom:8px;border:1px solid rgba(91,85,232,.18);background:var(--soft);color:var(--accent);border-radius:10px;font-size:11px;font-weight:800}.ai-v2-paste-notice.show{display:block;animation:kenzyPasteIn .2s ease}@keyframes kenzyPasteIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}';document.head.appendChild(style);
}
function boot(){
  if(window.__kenzyPasteBooted)return;
  window.__kenzyPasteBooted=true;
  bindPaste();
  injectStyles();
  const check=()=>{if(document.querySelector('.ai-v2-compose-wrap'))injectNotice();};
  check();
  setInterval(check,500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
