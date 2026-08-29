const REVIEW_KEY='kenzy-quiz-review-v1';
let quizObserver;
let quizState={id:'',answered:{},marked:{}};
function loadState(){try{return JSON.parse(sessionStorage.getItem(REVIEW_KEY)||'{}');}catch{return {};}}
function saveState(){sessionStorage.setItem(REVIEW_KEY,JSON.stringify(quizState));}
function currentNumber(page){const match=page.querySelector('.question-count')?.textContent.match(/Question\s+(\d+)/i);return match?Number(match[1]):1;}
function totalNumber(page){const match=page.querySelector('.question-count')?.textContent.match(/of\s+(\d+)/i);return match?Number(match[1]):1;}
function setupQuiz(){
 const page=document.querySelector('.quiz-page');
 if(!page){document.getElementById('quiz-upgrade-panel')?.remove();return;}
 const total=totalNumber(page), current=currentNumber(page); const quizTitle=document.querySelector('.quiz-question')?.textContent||'';
 if(!quizState.id || quizState.id!==`${total}-${quizTitle.slice(0,40)}`){quizState={id:`${total}-${quizTitle.slice(0,40)}`,answered:{},marked:{}};saveState();}
 const selected=page.querySelector('.answer-button.selected'); quizState.answered[current]=!!selected; saveState();
 let panel=document.getElementById('quiz-upgrade-panel');
 if(!panel){panel=document.createElement('section');panel.id='quiz-upgrade-panel';panel.className='quiz-upgrade-panel';const toolbar=page.querySelector('.quiz-toolbar');toolbar?.after(panel);}
 panel.innerHTML=`<div class="quiz-upgrade-head"><div><strong>Question navigator</strong><small>Jump to a question or mark one to review later.</small></div><button class="quiz-mark-button ${quizState.marked[current]?'marked':''}" type="button">${quizState.marked[current]?'★ Marked for review':'☆ Mark for review'}</button></div><div class="quiz-upgrade-grid">${Array.from({length:total},(_,i)=>{const n=i+1;return `<button type="button" class="quiz-grid-dot ${n===current?'current':''} ${quizState.answered[n]?'answered':''} ${quizState.marked[n]?'marked':''}" data-q="${n}">${n}</button>`}).join('')}</div><div class="quiz-upgrade-legend"><span><i class="current"></i> Current</span><span><i class="answered"></i> Answered</span><span><i class="marked"></i> Review</span></div>`;
 panel.querySelector('.quiz-mark-button').onclick=()=>{quizState.marked[current]=!quizState.marked[current];saveState();setupQuiz();};
 panel.querySelectorAll('[data-q]').forEach(btn=>btn.onclick=()=>jumpTo(page,Number(btn.dataset.q),current));
 const submitButtons=[...page.querySelectorAll('.quiz-navigation .primary')];
 submitButtons.forEach(btn=>{if(btn.dataset.warnBound==='1')return;btn.dataset.warnBound='1';btn.addEventListener('click',event=>{if(!/^Submit quiz/i.test(btn.textContent.trim()))return;const unanswered=Array.from({length:total},(_,i)=>i+1).filter(n=>!quizState.answered[n]);if(unanswered.length&&!window.confirm(`You have ${unanswered.length} unanswered question${unanswered.length===1?'':'s'}. Submit anyway?`)){event.preventDefault();event.stopImmediatePropagation();}},true);});
}
function jumpTo(page,target,current){if(target===current)return;const next=target>current;const button=[...page.querySelectorAll('.quiz-navigation button')].find(b=>next?/Next/.test(b.textContent):/Previous/.test(b.textContent));if(!button)return;let steps=Math.abs(target-current);const tick=()=>{if(steps<=0){setupQuiz();return;}button.click();steps--;setTimeout(tick,30);};tick();}
function boot(){if(quizObserver)return;quizObserver=new MutationObserver(()=>{if(document.querySelector('.quiz-page'))setupQuiz();});quizObserver.observe(document.body,{childList:true,subtree:true});setupQuiz();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
