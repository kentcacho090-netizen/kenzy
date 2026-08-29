(() => {
  const MAX_BYTES = 25 * 1024 * 1024;
  const ALLOWED = new Set(['application/pdf','image/png','image/jpeg','image/webp']);
  const DB_NAME = 'kenzy-ai-files-v2';
  const META_KEY = 'kenzy-ai-file-meta-v2';
  const SELECTED_KEY = 'kenzy-ai-selected-files-v2';
  const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function db(){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    });
  }
  async function put(record){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('files','readwrite');t.objectStore('files').put(record);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
  function load(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}}
  function save(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function sizeText(bytes){return bytes<1048576?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1048576).toFixed(1)} MB`;}
  function updateFileUi(){
    document.querySelectorAll('.ai-v2-files-section small').forEach(n=>n.textContent='Files stay on this device until you attach them to a message. Maximum 25 MB combined.');
  }
  async function handle(input,event){
    const files=Array.from(input.files||[]);
    if(!files.length)return;
    const page=document.querySelector('.ai-page');
    if(!page)return;
    if(files.some(f=>!ALLOWED.has(f.type))){event.preventDefault();event.stopImmediatePropagation();alert('Use PDF, PNG, JPG, or WebP files only.');return;}
    const existing=load(META_KEY,[]);
    const existingBytes=existing.reduce((sum,f)=>sum+Number(f.size||0),0);
    const incomingBytes=files.reduce((sum,f)=>sum+f.size,0);
    if(existingBytes+incomingBytes>MAX_BYTES){event.preventDefault();event.stopImmediatePropagation();alert(`Keep your saved AI files at or below 25 MB total. Current: ${sizeText(existingBytes)}.`);return;}
    event.preventDefault();event.stopImmediatePropagation();
    const meta=[...existing];
    const selected=new Set(load(SELECTED_KEY,[]));
    for(const file of files){
      const fileId=id();
      await put({id:fileId,name:file.name,type:file.type,size:file.size,blob:file});
      meta.unshift({id:fileId,name:file.name,type:file.type,size:file.size,addedAt:Date.now()});
      selected.add(fileId);
    }
    save(META_KEY,meta.slice(0,30));
    save(SELECTED_KEY,[...selected].slice(0,10));
    updateFileUi();
    window.dispatchEvent(new CustomEvent('kenzy-ai-files-updated'));
    document.querySelector('.ai-v2-files')?.scrollTo({top:0,behavior:'smooth'});
    // The AI workspace exposes these refresh helpers on the page after initialization.
    document.querySelectorAll('.ai-v2-files-section').forEach(section=>{
      section.querySelector('.ai-v2-files')?.dispatchEvent(new Event('kenzy-refresh-files'));
    });
  }
  function bind(){
    const inputs=document.querySelectorAll('.ai-v2-file-input,.ai-v2-compose-file-input');
    inputs.forEach(input=>{
      if(input.dataset.limitFixBound==='1')return;
      input.dataset.limitFixBound='1';
      input.addEventListener('change',e=>handle(input,e),true);
    });
    updateFileUi();
  }
  const tick=()=>bind();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
  setInterval(tick,500);
})();
