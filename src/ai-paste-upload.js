const PASTE_DB='kenzy-ai-files-v2';
const PASTE_META='kenzy-ai-file-meta-v2';
const PASTE_SELECTED='kenzy-ai-selected-files-v2';
const PASTE_MAX=3*1024*1024;
const ALLOWED=['application/pdf','image/png','image/jpeg','image/webp'];

const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const makeId=()=>`${Date.now()}-${Math.random().toString(36).slice(2)}`;

function formatSize(bytes){return bytes<1048576?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1048576).toFixed(1)} MB`;}
function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(PASTE_DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function storeFile(record){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}

function refreshUi(){
  document.querySelector('.ai-v2-files')?.replaceChildren();
  document.querySelector('.ai-v2-attachments')?.replaceChildren();
  window.dispatchEvent(new Event('kenzy-ai-files-updated'));
  document.querySelector('.ai-v2-file-input')?.dispatchEvent(new Event('change',{bubbles:true}));
}

async function pasteFiles(files){
  const incoming=Array.from(files||[]).filter(file=>ALLOWED.includes(file.type));
  if(!incoming.length)return false;
  const existing=read(PASTE_META,[]);
  const existingBytes=existing.reduce((sum,file)=>sum+Number(file.size||0),0);
  const incomingBytes=incoming.reduce((sum,file)=>sum+file.size,0);
  if(existingBytes+incomingBytes>PASTE_MAX){alert('Keep your saved AI files under 3 MB total for now.');return true;}
  const meta=[...existing];
  const selected=new Set(read(PASTE_SELECTED,[]));
  for(const file of incoming){
    const fileId=makeId();
    const name=file.name||`pasted-${Date.now()}.${file.type.split('/')[1]||'bin'}`;
    await storeFile({id:fileId,name,type:file.type,size:file.size,blob:file});
    meta.unshift({id:fileId,name,type:file.type,size:file.size,addedAt:Date.now()});
    selected.add(fileId);
  }
  write(PASTE_META,meta.slice(0,30));
  write(PASTE_SELECTED,[...selected].slice(0,10));
  refreshUi();
  const notice=document.querySelector('.ai-v2-paste-notice');
  if(notice){notice.textContent=`Attached ${incoming.length} pasted file${incoming.length===1?'':'s'} — ready to send.`;notice.classList.add('show');setTimeout(()=>notice.classList.remove('show'),2400);}
  return true;
}

function bindPaste(){
  document.addEventListener('paste',async event=>{
    const textarea=event.target instanceof HTMLTextAreaElement?event.target:null;
    if(!textarea||!textarea.closest('.ai-v2-form'))return;
    const items=Array.from(event.clipboardData?.items||[]);
    const files=[];
    for(const item of items){if(item.kind!=='file')continue;const file=item.getAsFile();if(file)files.push(file);}
    if(!files.length&&event.clipboardData?.files?.length)files.push(...Array.from(event.clipboardData.files));
    const hasSupported=files.some(file=>ALLOWED.includes(file.type));
    if(!hasSupported)return;
    event.preventDefault();
    await pasteFiles(files);
  },true);
}

function injectNotice(){
  if(document.querySelector('.ai-v2-paste-notice'))return;
  const wrap=document.querySelector('.ai-v2-compose-wrap');
  if(!wrap)return;
  const notice=document.createElement('div');
  notice.className='ai-v2-paste-notice';
  notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');
  notice.textContent='';
  wrap.insertBefore(notice,wrap.firstChild);
}
function boot(){bindPaste();injectNotice();new MutationObserver(injectNotice).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
