import React, { useEffect, useState } from 'react';
import './App.css';

const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const STORAGE = 'kenzy-quizzes-v4';
const THEME = 'kenzy-theme-v4';
const STAGES = [
  ['Uploading your material', 'Sending your PDF or image securely.'],
  ['Reading your material', 'Analyzing topics, facts, and concepts.'],
  ['Creating questions', 'Building your multiple-choice questions.'],
  ['Checking the quiz', 'Validating every question and answer.'],
  ['Finishing your quiz', 'Preparing your practice session.'],
];
const SAMPLE = {
  id: 'sample',
  title: 'Quick Science Review',
  timeLimit: 5,
  attempts: [],
  questions: [
    { question: 'What is the basic unit of life?', options: ['Atom', 'Cell', 'Tissue', 'Organ'], correctIndex: 1 },
    { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Mars', 'Mercury'], correctIndex: 2 },
    { question: 'What gas do plants primarily absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctIndex: 2 },
  ],
};

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { return []; }
};

const valid = (q) => q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.options)
  && q.options.length === 4 && q.options.every((x) => typeof x === 'string' && x.trim())
  && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4;

const b64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error('Could not read the uploaded file.'));
  r.readAsDataURL(file);
});

const fmt = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

// Fisher-Yates shuffle. The correct answer travels with its option so the
// quiz never exposes a predictable answer position.
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomizeQuiz(questions) {
  return shuffle(questions).map((q) => {
    const optionPairs = q.options.map((text, index) => ({ text, correct: index === q.correctIndex }));
    const shuffledOptions = shuffle(optionPairs);
    return {
      ...q,
      options: shuffledOptions.map((item) => item.text),
      correctIndex: shuffledOptions.findIndex((item) => item.correct),
    };
  });
}

export default function App() {
  const [page, setPage] = useState('home');
  const [quizzes, setQuizzes] = useState(load);
  const [active, setActive] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME) || 'light');

  useEffect(() => localStorage.setItem(STORAGE, JSON.stringify(quizzes)), [quizzes]);
  useEffect(() => localStorage.setItem(THEME, theme), [theme]);

  const home = () => { setActive(null); setPage('home'); };
  const add = (q) => { setQuizzes((x) => [q, ...x]); setActive(q); setPage('quiz'); };
  const finish = (a) => {
    if (!active) return;
    const q = { ...active, attempts: [...(active.attempts || []), a], lastAttempt: a };
    setQuizzes((xs) => xs.map((x) => x.id === active.id ? { ...x, attempts: q.attempts, lastAttempt: a } : x));
    setActive(q);
    setPage('results');
  };
  const remove = (id) => { setQuizzes((x) => x.filter((q) => q.id !== id)); if (active?.id === id) home(); };
  const retryActive = () => {
    if (!active) return;
    const randomized = { ...active, questions: randomizeQuiz(active.questions), attempts: active.attempts || [] };
    setActive(randomized);
    setPage('quiz');
  };

  return <div className={`app ${theme === 'dark' ? 'dark' : ''}`}>
    <header className="topbar">
      <button className="brand" onClick={home}><span className="brand-mark">K</span><span>Kenzy</span></button>
      <div className="header-actions">
        <button className="ghost-icon" onClick={() => setTheme((x) => x === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode">{theme === 'dark' ? '☀' : '☾'}</button>
        <span className="profile">KC</span>
      </div>
    </header>
    <main>
      {page === 'home' && <Home quizzes={quizzes} create={() => setPage('create')} manage={() => setPage('manage')} sample={() => add({ ...SAMPLE, id: `sample-${Date.now()}`, questions: randomizeQuiz(SAMPLE.questions) })} />}
      {page === 'create' && <Create onBack={home} onCreate={add} />}
      {page === 'quiz' && active && <Quiz quiz={active} onExit={home} onFinish={finish} />}
      {page === 'results' && active && <Results quiz={active} home={home} retry={retryActive} />}
      {page === 'manage' && <Manage quizzes={quizzes} back={home} open={(q) => { setActive(q); setPage('quiz'); }} remove={remove} />}
    </main>
    <footer>Kenzy · Turn your study material into practice.</footer>
  </div>;
}

function Home({ quizzes, create, manage, sample }) {
  return <section className="page home">
    <div className="hero-copy">
      <div className="eyebrow">AI STUDY TOOL</div>
      <h1>Turn your notes into <span>better quizzes.</span></h1>
      <p>Upload a PDF or image, choose 1–100 questions, add your own instructions, and practice with a timed quiz.</p>
      <div className="hero-actions">
        <button className="button primary" onClick={create}>＋ Create a quiz</button>
        {quizzes.length > 0 && <button className="button secondary" onClick={manage}>Your quizzes ({quizzes.length})</button>}
      </div>
    </div>
    <div className="feature-grid">
      <Card icon="↥" title="PDF or image" text="Use notes, modules, screenshots, reviewers, and clear study images." />
      <Card icon="✦" title="1–100 questions" text="Choose as few as one question or generate up to 100." />
      <Card icon="↻" title="Randomized" text="Question order and answer choices are shuffled so the answer pattern cannot be memorized." />
    </div>
    {quizzes.length === 0 ? <div className="sample-banner"><div><strong>Try it first</strong><span>Take a small built-in quiz before making your own.</span></div><button className="text-button" onClick={sample}>Try sample →</button></div> : <div className="recent-card"><div className="card-heading"><span>Recent quizzes</span><button className="text-button" onClick={manage}>View all →</button></div>{quizzes.slice(0, 3).map((q) => <button className="recent-row" key={q.id} onClick={manage}><span>{q.title}</span><small>{q.questions.length} questions · {q.attempts?.length || 0} attempts</small></button>)}</div>}
  </section>;
}

function Card({ icon, title, text }) {
  return <article className="feature-card"><div className="feature-icon">{icon}</div><div><h3>{title}</h3><p>{text}</p></div></article>;
}

function Create({ onBack, onCreate }) {
  const [files, setFiles] = useState([]);
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(10);
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!busy) return undefined;
    const t = setInterval(() => setStage((x) => Math.min(x + 1, STAGES.length - 1)), 1800);
    return () => clearInterval(t);
  }, [busy]);

  function choose(e) {
    const picked = Array.from(e.target.files || []);
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!picked.length) return;
    if (picked.some((f) => !allowed.includes(f.type))) { setError('Use PDF, PNG, JPG, or WebP files only.'); return; }
    if (picked.reduce((a, f) => a + f.size, 0) > MAX_TOTAL_BYTES) { setError('Keep the combined upload size under 3 MB.'); return; }
    setFiles(picked); setError('');
  }

  async function generate() {
    if (!files.length) { setError('Please choose a PDF or image first.'); return; }
    setBusy(true); setStage(0); setError('');
    try {
      const encoded = await Promise.all(files.map(async (f) => ({ mimeType: f.type, data: await b64(f), name: f.name })));
      setStage(1);
      const r = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: encoded, count, suggestion: suggestion.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Quiz generation failed.');
      const questions = Array.isArray(data.questions) ? data.questions.filter(valid) : [];
      if (!questions.length) throw new Error('The AI did not return a valid quiz.');
      setStage(4);
      setTimeout(() => onCreate({
        id: crypto.randomUUID(),
        title: files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : `${files.length} study files`,
        questions: randomizeQuiz(questions),
        timeLimit: minutes,
        attempts: [],
        suggestion: suggestion.trim(),
        createdAt: new Date().toISOString(),
      }), 500);
    } catch (e) {
      setError(e.message || 'Could not generate the quiz.');
      setBusy(false);
    }
  }

  return <section className="page narrow">
    <button className="back-button" onClick={onBack}>← Back</button>
    <div className="section-heading"><div className="eyebrow">NEW QUIZ</div><h2>Create a quiz</h2><p>Give Kenzy your study material and choose your practice settings.</p></div>
    <label className={`upload-box ${files.length ? 'has-files' : ''}`}>
      <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple onChange={choose} />
      <span className="upload-symbol">↑</span>
      <strong>{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Choose PDF or image files'}</strong>
      <small>{files.length ? `${Math.ceil(files.reduce((a, f) => a + f.size, 0) / 1024)} KB total · ${files.map((f) => f.name).join(', ')}` : 'PDF, PNG, JPG, or WebP · maximum 3 MB combined'}</small>
      <span className="upload-hint">Drop files here or click to browse</span>
    </label>

    <div style={{ marginTop: 16, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
      <div className="eyebrow">OPTIONAL SUGGESTION</div>
      <strong style={{ display: 'block', marginTop: 6, color: 'var(--text)', fontSize: 16 }}>Tell Kenzy how you want the quiz made</strong>
      <p style={{ margin: '6px 0 12px', color: 'var(--muted)', lineHeight: 1.5, fontSize: 13 }}>Add extra instructions about difficulty, question style, focus, or problem-solving.</p>
      <textarea
        value={suggestion}
        onChange={(e) => setSuggestion(e.target.value.slice(0, 1500))}
        rows={4}
        maxLength={1500}
        placeholder={'Example:\npls also provide problem solving for me and make it really difficult'}
        style={{ width: '100%', resize: 'vertical', minHeight: 105, border: '1px solid var(--border)', borderRadius: 13, padding: 13, background: 'var(--surface2)', color: 'var(--text)', outline: 'none', lineHeight: 1.5 }}
      />
      <div style={{ textAlign: 'right', marginTop: 6, color: 'var(--muted)', fontSize: 11 }}>{suggestion.length}/1500</div>
    </div>

    <div className="settings-grid"><Range label="Questions" value={count} min={1} max={100} onChange={setCount} /><Range label="Time limit" value={minutes} min={1} max={180} suffix="min" onChange={setMinutes} /></div>
    {error && <div className="error-box">{error}</div>}
    <button className="button primary full-width" disabled={!files.length || busy} onClick={generate}>{busy ? 'Generating…' : 'Generate quiz'}</button>
    <p className="privacy-note">Your files and optional suggestion are sent to Kenzy’s server only when you press Generate quiz.</p>
    {busy && <GenerationPanel files={files} stage={stage} />}
  </section>;
}

function Range({ label, value, min, max, suffix = '', onChange }) {
  return <div className="range-setting"><div className="range-top"><strong>{label}</strong><b>{value} {suffix}</b></div><input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}

function GenerationPanel({ files, stage }) {
  return <div className="generation-overlay"><div className="generation-panel">
    <div className="generation-header"><div><div className="eyebrow">KENZY IS WORKING</div><h3>Building your quiz</h3><p>{files.map((f) => f.name).join(' · ')}</p></div><div className="ai-orb">✦</div></div>
    <div className="generation-progress"><span style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }} /></div>
    <div className="generation-current"><span className="stage-spinner" /><div><strong>{STAGES[stage][0]}</strong><p>{STAGES[stage][1]}</p></div></div>
    <div className="generation-steps">{STAGES.map((s, i) => <div className={`generation-step ${i < stage ? 'complete' : i === stage ? 'active' : 'waiting'}`} key={s[0]}><span>{i < stage ? '✓' : i + 1}</span><div><strong>{s[0]}</strong><small>{s[1]}</small></div></div>)}</div>
    <div className="generation-safe-note">Status updates only — private model reasoning is never displayed.</div>
  </div></div>;
}

function Quiz({ quiz, onExit, onFinish }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => Array(quiz.questions.length).fill(-1));
  const [seconds, setSeconds] = useState(quiz.timeLimit * 60);
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (submitted) return;
    setSubmitted(true);
    const correct = answers.reduce((n, a, i) => n + (a === quiz.questions[i].correctIndex ? 1 : 0), 0);
    onFinish({ timestamp: new Date().toISOString(), correct, score: Math.round(correct / quiz.questions.length * 100), answers, timeSpent: Math.max(0, quiz.timeLimit * 60 - seconds) });
  }

  useEffect(() => {
    if (submitted) return undefined;
    if (seconds <= 0) { submit(); return undefined; }
    const t = setTimeout(() => setSeconds((x) => x - 1), 1000);
    return () => clearTimeout(t);
  });

  const q = quiz.questions[index];
  return <section className="page quiz-page">
    <div className="quiz-toolbar"><button className="back-button" onClick={onExit}>← Exit</button><div className={seconds < 60 ? 'timer danger' : 'timer'}>◷ {String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:{String(Math.max(0, seconds) % 60).padStart(2, '0')}</div></div>
    <div className="progress-track"><span style={{ width: `${((index + 1) / quiz.questions.length) * 100}%` }} /></div>
    <div className="question-count">Question {index + 1} <span>of {quiz.questions.length}</span></div>
    <h2 className="quiz-question">{q.question}</h2>
    <div className="answer-list">{q.options.map((o, i) => <button key={`${i}-${o}`} className={answers[index] === i ? 'answer-button selected' : 'answer-button'} onClick={() => setAnswers((xs) => xs.map((a, j) => j === index ? i : a))}><span>{String.fromCharCode(65 + i)}</span><strong>{o}</strong></button>)}</div>
    <div className="quiz-navigation"><button className="button secondary" disabled={index === 0} onClick={() => setIndex((x) => x - 1)}>← Previous</button>{index === quiz.questions.length - 1 ? <button className="button primary" onClick={submit}>Submit quiz</button> : <button className="button primary" onClick={() => setIndex((x) => x + 1)}>Next →</button>}</div>
  </section>;
}

function Results({ quiz, home, retry }) {
  const attempt = quiz.lastAttempt || quiz.attempts?.[quiz.attempts.length - 1];
  const [filter, setFilter] = useState('all');
  const items = quiz.questions.map((q, i) => { const selected = attempt?.answers?.[i] ?? -1; return { ...q, number: i + 1, selected, correct: selected === q.correctIndex, unanswered: selected < 0 }; });
  const shown = items.filter((x) => filter === 'all' || (filter === 'correct' && x.correct) || (filter === 'wrong' && !x.correct && !x.unanswered) || (filter === 'unanswered' && x.unanswered));
  const incorrect = quiz.questions.length - (attempt?.correct || 0);
  return <section className="page results-wide">
    <div className="result-top"><div><div className="eyebrow">QUIZ COMPLETE</div><h2>Review your answers.</h2><p>{quiz.title}</p></div><div className="big-score"><span>{attempt?.score || 0}</span><small>/ 100</small></div></div>
    <div className="stat-grid"><div><strong>{attempt?.correct || 0}</strong><span>Correct</span></div><div><strong>{incorrect}</strong><span>Incorrect</span></div><div><strong>{fmt(attempt?.timeSpent || 0)}</strong><span>Time</span></div><div><strong>{quiz.questions.length}</strong><span>Total</span></div></div>
    <div className="review-header"><div><h3>Answer review</h3><p>Compare your answer with the correct answer for every question.</p></div><div className="review-filters">{['all', 'correct', 'wrong', 'unanswered'].map((x) => <button key={x} className={filter === x ? 'filter-button active' : 'filter-button'} onClick={() => setFilter(x)}>{x[0].toUpperCase() + x.slice(1)}</button>)}</div></div>
    <div className="review-list">{shown.map((q) => <article className={`review-card ${q.correct ? 'correct' : 'wrong'}`} key={q.number}><div className="review-card-top"><span className="review-number">Q{q.number}</span><span className="review-status">{q.unanswered ? 'Unanswered' : q.correct ? 'Correct' : 'Incorrect'}</span></div><h4>{q.question}</h4><div className="review-options">{q.options.map((o, i) => { const selected = q.selected === i; const correct = q.correctIndex === i; return <div className={`review-option ${selected ? 'selected-answer' : ''} ${correct ? 'correct-answer' : ''}`} key={o}><span>{String.fromCharCode(65 + i)}</span><strong>{o}</strong>{selected && <em>Your answer</em>}{correct && <em>Correct answer</em>}</div>; })}</div></article>)}</div>
    <div className="hero-actions"><button className="button primary" onClick={retry}>Retake with randomized order</button><button className="button secondary" onClick={home}>Back to home</button></div>
  </section>;
}

function Manage({ quizzes, back, open, remove }) {
  return <section className="page narrow"><button className="back-button" onClick={back}>← Back</button><div className="section-heading"><div className="eyebrow">LIBRARY</div><h2>Your quizzes</h2><p>Open a quiz to practice it again or remove it from this browser.</p></div>{quizzes.length === 0 ? <div className="empty-state">No quizzes yet.</div> : <div className="quiz-library">{quizzes.map((q) => <div className="library-row" key={q.id}><button className="library-main" onClick={() => open(q)}><strong>{q.title}</strong><span>{q.questions.length} questions · {q.timeLimit} min · {q.attempts?.length || 0} attempts</span></button><button className="delete-button" onClick={() => remove(q.id)}>Delete</button></div>)}</div>}</section>;
}
