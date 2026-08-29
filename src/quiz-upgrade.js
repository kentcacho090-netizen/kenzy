const REVIEW_KEY='kenzy-quiz-review-v2';
const SHARE_VIS_KEY='kenzy-quiz-visibility-v2';
let state={id:null,total:0,answered:{},marked:{}};
let lastPage=null;

function load(){try{return JSON.parse(sessionStorage.getItem(REVIEW_KEY)||'{}');}catch{return {};}}
function save(){sessionStorage.setItem(REVIEW_KEY,JSON.stringify(state));}
function currentNumber(page){const m=page.querySelector('.question-count')?.textContent.match(/Question\s+(\d+)/i);return m?Number(m[1]):1;}
function totalNumber(page){const m=page.querySelector('.question-count')?.textContent.match(/of\s+(\d+)/i);return m?Number(m[1]):1;}
function isMaker(page){return !!page&&!!page.querySelector('button.button.primary.full-width');}
function isQuiz(page){return !!page&&page.classList.contains('quiz-page');}
function remove(id){document.getElementById(id)?.remove();}

function setupNavigator(page){
  if(!isQuiz(page))return;
  const total=totalNumber(page), current=currentNumber(page), selected=!!page.querySelector('.answer-button.selected');
  if(!state.id||state.total!==total){state={id:`quiz-${Date.now()}`,total,answered:{},marked:{}};}
  state.answered[current]=selected;save();
  let panel=document.getElementById('quiz-upgrade-panel');
  if(!panel){panel=document.createElement('section');panel.id='quiz-upgrade-panel';panel.className='quiz-upgrade-panel';page.querySelector('.quiz-toolbar')?.after(panel);}
  panel.innerHTML=`<div class="quiz-upgrade-head"><div><strong>Question navigator</strong><small>Jump to a question or mark one to review later.</small></div><button class="quiz-mark-button ${state.marked[current]?'marked':''}" type="button">${state.marked[current]?'★ Marked for review':'☆ Mark for review'}</button></div><div class="quiz-upgrade-grid">${Array.from({length:total},(_,i)=>{const n=i+1;return `<button type="button" class="quiz-grid-dot ${n===current?'current':''} ${state.answered[n]?'answered':''} ${state.marked[n]?'marked':''}" data-q="${n}">${n}</button>`}).join('')}</div><div class="quiz-upgrade-legend"><span><i class="current"></i> Current</span><span><i class="answered"></i> Answered</span><span><i class="marked"></i> Review</span></div>`;
  panel.querySelector('.quiz-mark-button').onclick=()=>{state.marked[current]=!state.marked[current];save();setupNavigator(page);};
  panel.querySelectorAll('[data-q]').forEach(btn=>btn.onclick=()=>jumpTo(page,Number(btn.dataset.q),current));
}
function jumpTo(page,target,current){if(target===current)return;const forward=target>current;const button=[...page.querySelectorAll('.quiz-navigation button')].find(b=>forward?/Next/.test(b.textContent):/Previous/.test(b.textContent));if(!button)return;let steps=Math.abs(target-current);const tick=()=>{if(steps<=0){setupNavigator(page);return;}button.click();steps--;setTimeout(tick,35);};tick();}

function shareStyle(){if(document.getElementById('kenzy-share-style'))return;const s=document.createElement('style');s.id='kenzy-share-style';s.textContent='.kenzy-visibility-panel,.kenzy-share-panel{margin:16px 0;padding:18px;background:var(--surface);border:1px solid var(--border);border-radius:18px}.kenzy-visibility-panel strong,.kenzy-share-panel strong{display:block;color:var(--text)}.kenzy-visibility-panel>small,.kenzy-share-panel>small{display:block;margin-top:4px;color:var(--muted);line-height:1.4}.kenzy-visibility-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.kenzy-visibility-option{display:flex;gap:10px;padding:13px;border:1px solid var(--border);border-radius:14px;background:var(--surface2);cursor:pointer}.kenzy-visibility-option.selected{border-color:var(--accent);box-shadow:0 0 0 3px rgba(91,85,232,.12)}.kenzy-visibility-option input{accent-color:var(--accent)}.kenzy-share-row{display:flex;gap:8px;margin-top:12px}.kenzy-share-row input{min-width:0;flex:1;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--text)}.kenzy-share-row button{border:0;border-radius:10px;padding:10px 14px;background:var(--accent);color:#fff;font-weight:800}.kenzy-share-note{margin-top:9px!important;font-size:11px}@media(max-width:700px){.kenzy-visibility-options{grid-template-columns:1fr}.kenzy-share-row{flex-direction:column}}';document.head.appendChild(s);}
function shareEncode(q){const b=new TextEncoder().encode(JSON.stringify({title:q.title,timeLimit:q.timeLimit,questions:q.questions}));let s='';b.forEach(x=>s+=String.fromCharCode(x));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function shareDecode(t){try{t=t.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-t.length%4)%4);const s=atob(t),b=Uint8Array.from(s,c=>c.charCodeAt(0));const q=JSON.parse(new TextDecoder().decode(b));return q&&Array.isArray(q.questions)&&q.questions.length?q:null;}catch{return null;}}
function shareUrl(q){return location.origin+location.pathname+'#quiz='+encodeURIComponent(shareEncode(q));}
function getLatestQuiz(){try{return JSON.parse(localStorage.getItem('kenzy-quizzes-v4')||'[]')[0]||null;}catch{return null;}}
function setupMaker(page){
  if(!isMaker(page)||document.getElementById('kenzy-visibility-panel'))return;
  shareStyle();
  const mode=sessionStorage.getItem(SHARE_VIS_KEY)||'personal';
  const panel=document.createElement('section');panel.id='kenzy-visibility-panel';panel.className='kenzy-visibility-panel';
  panel.innerHTML=`<strong>Quiz access</strong><small>Choose whether this quiz is personal or shareable with friends.</small><div class="kenzy-visibility-options"><label class="kenzy-visibility-option ${mode==='personal'?'selected':''}"><input type="radio" name="kenzy-visibility" value="personal" ${mode==='personal'?'checked':''}><span><b>Personal</b><small>Keep it in your Kenzy app like the original quiz.</small></span></label><label class="kenzy-visibility-option ${mode==='shareable'?'selected':''}"><input type="radio" name="kenzy-visibility" value="shareable" ${mode==='shareable'?'checked':''}><span><b>Shareable</b><small>Create a link friends can open and answer.</small></span></label></div>`;
  const btn=page.querySelector('button.button.primary.full-width');
  btn?.parentElement?.insertBefore(panel,btn.parentElement.lastElementChild||null);
  panel.querySelectorAll('input').forEach(i=>i.onchange=()=>{sessionStorage.setItem(SHARE_VIS_KEY,i.value);panel.querySelectorAll('.kenzy-visibility-option').forEach(x=>x.classList.toggle('selected',x.querySelector('input').checked));});
}
function setupShareOnQuiz(page){
  if(!isQuiz(page)||document.getElementById('kenzy-share-panel'))return;
  const quiz=getLatestQuiz();
  if(!quiz||quiz.visibility!=='shareable')return;
  shareStyle();
  const u=shareUrl(quiz),p=document.createElement('section');p.id='kenzy-share-panel';p.className='kenzy-share-panel';
  p.innerHTML=`<strong>Share this quiz with friends</strong><small>Anyone with this link can open and answer the same quiz.</small><div class="kenzy-share-row"><input readonly value="${u.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"><button type="button">Copy link</button></div><small class="kenzy-share-note">Friends do not need your Kenzy account.</small>`;
  page.querySelector('.quiz-toolbar')?.after(p);
  p.querySelector('button').onclick=async()=>{try{await navigator.clipboard.writeText(u);p.querySelector('button').textContent='Copied!';setTimeout(()=>{if(p.isConnected)p.querySelector('button').textContent='Copy link';},1500);}catch{const i=p.querySelector('input');i.focus();i.select();document.execCommand('copy');}};
}
function cleanOutside(){if(!document.querySelector('.quiz-page'))remove('kenzy-share-panel');if(!isMaker(document.querySelector('.page')))remove('kenzy-visibility-panel');}
function markLatestVisibility(){try{const rows=JSON.parse(localStorage.getItem('kenzy-quizzes-v4')||'[]');if(!rows.length)return;rows[0].visibility=sessionStorage.getItem(SHARE_VIS_KEY)||'personal';localStorage.setItem('kenzy-quizzes-v4',JSON.stringify(rows));}catch{}}

function boot(){
  if(window.__kenzyQuizUpgradeV2)return;window.__kenzyQuizUpgradeV2=true;
  state=load();
  const tick=()=>{const page=document.querySelector('.page');cleanOutside();if(isMaker(page)){setupMaker(page);markLatestVisibility();}if(isQuiz(page))setupNavigator(page);setupShareOnQuiz(page);lastPage=page;};
  tick();window.setInterval(tick,350);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
