const PROMPTS_KEY = 'kenzy-ai-recent-prompts-v1';
const FILES_KEY = 'kenzy-ai-files-v1';
const SIDEBAR_ID = 'kenzy-ai-workspace-sidebar';

function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function escapeHtml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function formatSize(bytes) { if (!bytes) return ''; if (bytes < 1048576) return `${Math.max(1,Math.round(bytes/1024))} KB`; return `${(bytes/1048576).toFixed(1)} MB`; }
function renderSidebar() {
  const page = document.querySelector('.ai-page');
  const card = page?.querySelector('.chat-card');
  const existing = document.getElementById(SIDEBAR_ID);
  if (!page || !card) { existing?.remove(); return; }
  if (existing) return;
  const sidebar = document.createElement('aside'); sidebar.id=SIDEBAR_ID; sidebar.className='ai-workspace-sidebar'; sidebar.dataset.activeTab='prompts';
  sidebar.innerHTML=`<div class="ai-sidebar-head"><div><div class="eyebrow">WORKSPACE</div><h3>AI workspace</h3><p>Your prompts and files stay separated.</p></div><button class="ai-sidebar-close" type="button" aria-label="Collapse workspace panel">×</button></div><div class="ai-sidebar-tabs"><button class="ai-sidebar-tab active" data-tab="prompts">Recent prompts</button><button class="ai-sidebar-tab" data-tab="files">Files</button></div><div class="ai-sidebar-content"></div><div class="ai-sidebar-foot">Saved locally on this device.</div>`;
  card.parentElement.insertBefore(sidebar,card); bindSidebar(sidebar); refreshSidebar(sidebar);
}
function bindSidebar(sidebar){
  sidebar.querySelector('.ai-sidebar-close')?.addEventListener('click',()=>sidebar.classList.toggle('collapsed'));
  sidebar.querySelectorAll('.ai-sidebar-tab').forEach(tab=>tab.addEventListener('click',()=>{sidebar.dataset.activeTab=tab.dataset.tab;sidebar.querySelectorAll('.ai-sidebar-tab').forEach(x=>x.classList.toggle('active',x===tab));refreshSidebar(sidebar);}));
}
function refreshSidebar(sidebar){
  const content=sidebar.querySelector('.ai-sidebar-content'); if(!content)return; const tab=sidebar.dataset.activeTab||'prompts'; content.innerHTML=tab==='files'?renderFiles():renderPrompts();
  content.querySelector('[data-clear="prompts"]')?.addEventListener('click',()=>{writeJson(PROMPTS_KEY,[]);refreshSidebar(sidebar);});
  content.querySelector('[data-clear="files"]')?.addEventListener('click',()=>{writeJson(FILES_KEY,[]);refreshSidebar(sidebar);});
  content.querySelector('[data-add-file]')?.addEventListener('change',event=>{const incoming=Array.from(event.target.files||[]).map(file=>({id:`${file.name}-${file.size}-${file.lastModified}`,name:file.name,type:file.type||'File',size:file.size,addedAt:Date.now()}));const merged=[...incoming,...readJson(FILES_KEY)].filter((file,index,all)=>all.findIndex(x=>x.id===file.id)===index).slice(0,30);writeJson(FILES_KEY,merged);refreshSidebar(sidebar);});
  content.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{const textarea=document.querySelector('.chat-form textarea');if(!textarea)return;textarea.value=button.dataset.prompt;textarea.dispatchEvent(new Event('input',{bubbles:true}));textarea.focus();}));
}
function renderPrompts(){const prompts=readJson(PROMPTS_KEY);const rows=prompts.length?prompts.map(item=>`<button class="ai-sidebar-row" data-prompt="${escapeHtml(item.prompt)}" title="Use this prompt again"><span class="ai-row-icon">◉</span><span class="ai-row-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.prompt)}</small></span></button>`).join(''):`<div class="ai-sidebar-empty"><span class="ai-empty-icon">✦</span><strong>No recent prompts yet.</strong><small>Every question you send to Kenzy will appear here automatically.</small></div>`;return `<div class="ai-sidebar-section-top"><span>${prompts.length} saved</span>${prompts.length?'<button class="ai-sidebar-clear" data-clear="prompts">Clear</button>':''}</div>${rows}`;}
function renderFiles(){const files=readJson(FILES_KEY);const rows=files.length?files.map(file=>`<div class="ai-sidebar-row ai-file-row"><span class="ai-row-icon">${file.type.includes('pdf')?'PDF':'IMG'}</span><span class="ai-row-copy"><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.type)} · ${formatSize(file.size)}</small></span></div>`).join(''):`<div class="ai-sidebar-empty"><span class="ai-empty-icon">▤</span><strong>No files yet.</strong><small>Add study files here and keep them separate from your recent prompts.</small></div>`;return `<div class="ai-sidebar-file-actions"><label class="ai-add-file">＋ Add file<input data-add-file type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple /></label>${files.length?'<button class="ai-sidebar-clear" data-clear="files">Clear</button>':''}</div>${rows}`;}
function trackPrompt(form){const textarea=form.querySelector('textarea');if(!textarea)return;const prompt=textarea.value.trim();if(!prompt)return;const current=readJson(PROMPTS_KEY);writeJson(PROMPTS_KEY,[{id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,title:prompt.length>48?`${prompt.slice(0,48)}…`:prompt,prompt,createdAt:Date.now()},...current.filter(x=>x.prompt!==prompt)].slice(0,30));const sidebar=document.getElementById(SIDEBAR_ID);if(sidebar&&sidebar.dataset.activeTab==='prompts')refreshSidebar(sidebar);}
let observed=false;
function setup(){if(observed)return;observed=true;document.addEventListener('submit',event=>{if(event.target instanceof HTMLFormElement&&event.target.matches('.chat-form'))setTimeout(()=>trackPrompt(event.target),0)},true);const observer=new MutationObserver(renderSidebar);observer.observe(document.body,{childList:true,subtree:true});renderSidebar();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
