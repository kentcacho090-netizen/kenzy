import React, { useEffect, useMemo, useState } from 'react';
import './Kenzy.css';

const QUIZ_STORAGE = 'kenzy-quizzes-v4';
const NOTES_STORAGE = 'kenzy-notes-v1';
const THEME_STORAGE = 'kenzy-theme-v4';

const APPLICATIONS = [
  { name: 'Study app', description: 'A useful study application will be added here.', icon: '📚', url: '' },
  { name: 'Flashcard app', description: 'Flashcard software recommended for studying.', icon: '🗂️', url: '' },
  { name: 'Focus app', description: 'A focus and productivity tool for study sessions.', icon: '⏱️', url: '' },
];

const EMPTY_NOTE = {
  id: null,
  title: 'Untitled note',
  content: '',
  updatedAt: null,
};

function safeLoad(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return 'Not saved yet';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function App() {
  const [page, setPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE) || 'light');
  const [quizzes, setQuizzes] = useState(() => safeLoad(QUIZ_STORAGE, []));
  const [notes, setNotes] = useState(() => safeLoad(NOTES_STORAGE, []));
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [notesDraft, setNotesDraft] = useState(EMPTY_NOTE);

  useEffect(() => localStorage.setItem(QUIZ_STORAGE, JSON.stringify(quizzes)), [quizzes]);
  useEffect(() => localStorage.setItem(NOTES_STORAGE, JSON.stringify(notes)), [notes]);
  useEffect(() => localStorage.setItem(THEME_STORAGE, theme), [theme]);

  function navigate(nextPage) {
    setPage(nextPage);
    setMenuOpen(false);
  }

  function goHome() {
    setActiveQuiz(null);
    navigate('home');
  }

  function addQuiz(quiz) {
    setQuizzes((current) => [quiz, ...current]);
    setActiveQuiz(quiz);
    navigate('quiz');
  }

  function startQuiz(quiz) {
    setActiveQuiz(quiz);
    navigate('quiz');
  }

  function finishQuiz(attempt) {
    if (!activeQuiz) return;
    const updatedQuiz = {
      ...activeQuiz,
      attempts: [...(activeQuiz.attempts || []), attempt],
      lastAttempt: attempt,
    };
    setQuizzes((current) => current.map((quiz) => quiz.id === activeQuiz.id ? updatedQuiz : quiz));
    setActiveQuiz(updatedQuiz);
    navigate('results');
  }

  function deleteQuiz(id) {
    setQuizzes((current) => current.filter((quiz) => quiz.id !== id));
    if (activeQuiz?.id === id) goHome();
  }

  function createNote() {
    setNotesDraft(EMPTY_NOTE);
    navigate('notes');
  }

  function openNote(note) {
    setNotesDraft(note);
    navigate('notes');
  }

  function saveNote() {
    const cleanTitle = notesDraft.title.trim() || 'Untitled note';
    const updated = { ...notesDraft, title: cleanTitle, updatedAt: new Date().toISOString() };
    if (updated.id) {
      setNotes((current) => current.map((note) => note.id === updated.id ? updated : note));
    } else {
      const created = { ...updated, id: crypto.randomUUID() };
      setNotes((current) => [created, ...current]);
      setNotesDraft(created);
    }
  }

  function deleteNote(id) {
    setNotes((current) => current.filter((note) => note.id !== id));
    setNotesDraft(EMPTY_NOTE);
  }

  return (
    <div className={`kenzy-app ${theme === 'dark' ? 'dark' : ''}`}>
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="Go to Kenzy home">
          <span className="brand-mark">K</span>
          <span>Kenzy</span>
        </button>
        <div className="header-actions">
          <button
            className="theme-button"
            onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
            title="Toggle appearance"
            aria-label="Toggle appearance"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            className="profile-menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Open Kenzy menu"
            aria-expanded={menuOpen}
          >
            KC
          </button>
        </div>
      </header>

      {menuOpen && <NavigationMenu page={page} navigate={navigate} onClose={() => setMenuOpen(false)} />}
      {menuOpen && <button className="menu-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <main>
        {page === 'home' && <HomePage quizzes={quizzes} notes={notes} navigate={navigate} />}
        {page === 'quiz-maker' && <CreatePage onBack={goHome} onCreate={addQuiz} />}
        {page === 'quiz' && activeQuiz && <QuizPage quiz={activeQuiz} onExit={goHome} onFinish={finishQuiz} />}
        {page === 'results' && activeQuiz && <ResultsPage quiz={activeQuiz} onHome={goHome} onRetry={() => navigate('quiz')} />}
        {page === 'manage' && <ManagePage quizzes={quizzes} onBack={goHome} onOpen={startQuiz} onDelete={deleteQuiz} />}
        {page === 'ai' && <AIPage onBack={goHome} />}
        {page === 'notes' && <NotesPage notes={notes} draft={notesDraft} setDraft={setNotesDraft} onBack={goHome} onCreate={createNote} onSave={saveNote} onOpen={openNote} onDelete={deleteNote} />}
        {page === 'applications' && <ApplicationsPage onBack={goHome} />}
        {page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} onBack={goHome} />}
      </main>

      <footer>Kenzy · Your study workspace.</footer>
    </div>
  );
}

function NavigationMenu({ page, navigate, onClose }) {
  const item = (id, icon, label, detail) => (
    <button className={page === id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(id)}>
      <span className="nav-icon">{icon}</span>
      <span><strong>{label}</strong><small>{detail}</small></span>
    </button>
  );

  return (
    <aside className="side-menu">
      <div className="menu-heading">
        <div><div className="eyebrow">WORKSPACE</div><h3>Kenzy menu</h3></div>
        <button className="menu-close" onClick={onClose} aria-label="Close menu">×</button>
      </div>
      <div className="menu-section">
        {item('home', '⌂', 'Home', 'Your study dashboard')}
      </div>
      <div className="menu-section">
        <div className="menu-label">STUDY TOOLS</div>
        {item('quiz-maker', '✦', 'Quiz Maker', 'Create quizzes from files')}
        {item('ai', '◉', 'AI Study Assistant', 'Ask Kenzy anything about studying')}
        {item('notes', '▤', 'Study Notes', 'Write and improve your notes')}
        {item('applications', '⌘', 'Applications', 'Useful apps for studying')}
      </div>
      <div className="menu-section">
        <div className="menu-label">SETTINGS</div>
        {item('settings', '⚙', 'Settings', 'Appearance and preferences')}
        {item('manage', '◫', 'Saved quizzes', 'Your generated quizzes')}
      </div>
      <div className="menu-footer">More study tools can be added here later.</div>
    </aside>
  );
}

function HomePage({ quizzes, notes, navigate }) {
  return (
    <section className="page home-page">
      <div className="hero-copy">
        <div className="eyebrow">YOUR STUDY WORKSPACE</div>
        <h1>Everything you need to <span>study smarter.</span></h1>
        <p>Generate quizzes, ask AI for help, build study notes, and find useful study applications from one place.</p>
        <div className="hero-actions">
          <button className="button primary" onClick={() => navigate('quiz-maker')}>＋ Create a quiz</button>
          <button className="button secondary" onClick={() => navigate('ai')}>✦ Ask Kenzy AI</button>
        </div>
      </div>

      <div className="feature-grid">
        <Feature icon="✦" title="Quiz Maker" text="Turn PDFs and images into timed multiple-choice practice." action="Open" onClick={() => navigate('quiz-maker')} />
        <Feature icon="◉" title="AI Study Assistant" text="Ask questions, explain topics, and get study guidance." action="Open" onClick={() => navigate('ai')} />
        <Feature icon="▤" title="Study Notes" text="Keep your notes organized and ask AI to improve them." action="Open" onClick={() => navigate('notes')} />
      </div>

      <div className="workspace-grid">
        <section className="workspace-card">
          <div className="card-heading"><div><span>Saved work</span><small>{quizzes.length} quizzes · {notes.length} notes</small></div><button className="text-button" onClick={() => navigate('manage')}>View quizzes →</button></div>
          {quizzes.length === 0 && notes.length === 0 ? (
            <div className="empty-mini"><strong>Your workspace is ready.</strong><span>Open the menu or use the buttons above to start.</span></div>
          ) : (
            <div className="saved-list">
              {quizzes.slice(0, 2).map((quiz) => <button key={quiz.id} className="saved-row" onClick={() => navigate('manage')}><span>✦ {quiz.title}</span><small>{quiz.questions.length} questions</small></button>)}
              {notes.slice(0, 2).map((note) => <button key={note.id} className="saved-row" onClick={() => navigate('notes')}><span>▤ {note.title}</span><small>{formatDate(note.updatedAt)}</small></button>)}
            </div>
          )}
        </section>
        <section className="workspace-card applications-preview">
          <div className="card-heading"><div><span>Study applications</span><small>Tools you can download later</small></div><button className="text-button" onClick={() => navigate('applications')}>Browse →</button></div>
          <div className="app-preview-row"><span className="app-preview-icon">⌘</span><div><strong>Applications</strong><small>Curated study tools and download links.</small></div><span>→</span></div>
        </section>
      </div>
    </section>
  );
}

function Feature({ icon, title, text, action, onClick }) {
  return <article className="feature-card"><div className="feature-icon">{icon}</div><div className="feature-body"><h3>{title}</h3><p>{text}</p><button className="text-button" onClick={onClick}>{action} →</button></div></article>;
}

function CreatePage({ onBack, onCreate }) {
  const [files, setFiles] = useState([]);
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(10);
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState(0);
  const maxBytes = 3 * 1024 * 1024;
  const stages = [
    ['Uploading your material', 'Sending your PDF or image securely to Kenzy.'],
    ['Reading your material', 'Analyzing useful topics, facts, and concepts.'],
    ['Creating questions', 'Building clear multiple-choice questions.'],
    ['Checking the quiz', 'Validating every question and answer.'],
    ['Finishing your quiz', 'Preparing your practice session.'],
  ];

  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(() => setStage((value) => Math.min(value + 1, stages.length - 1)), 1800);
    return () => clearInterval(timer);
  }, [busy]);

  function choose(event) {
    const picked = Array.from(event.target.files || []);
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!picked.length) return;
    if (picked.some((file) => !allowed.includes(file.type))) return setError('Use PDF, PNG, JPG, or WebP files only.');
    if (picked.reduce((sum, file) => sum + file.size, 0) > maxBytes) return setError('Keep the combined upload size under 3 MB.');
    setFiles(picked);
    setError('');
  }

  async function generate() {
    if (!files.length) return setError('Please choose a PDF or image first.');
    setBusy(true); setStage(0); setError('');
    try {
      const encoded = await Promise.all(files.map(async (file) => ({ mimeType: file.type, data: await toBase64(file) })));
      setStage(1);
      const response = await fetch('/api/generate-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: encoded, count, suggestion: suggestion.trim().slice(0, 1000) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Quiz generation failed.');
      setStage(3);
      const questions = Array.isArray(data.questions) ? data.questions.filter(validQuestion) : [];
      if (!questions.length) throw new Error('The AI did not return a valid quiz.');
      setStage(4);
      setTimeout(() => onCreate({ id: crypto.randomUUID(), title: files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : `${files.length} study files`, questions, timeLimit: minutes, attempts: [], createdAt: new Date().toISOString() }), 450);
    } catch (generationError) {
      setBusy(false);
      setError(generationError.message || 'Could not generate the quiz.');
    }
  }

  return <section className="page narrow-page">
    <button className="back-button" onClick={onBack}>← Back</button>
    <div className="section-heading"><div className="eyebrow">QUIZ MAKER</div><h2>Create a quiz</h2><p>Use PDFs or images, choose from 1–100 questions, and practice against a timer.</p></div>
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
        onChange={(event) => setSuggestion(event.target.value.slice(0, 1500))}
        rows={4}
        maxLength={1500}
        placeholder={'Example:\npls also provide problem solving for me and make it really difficult'}
        aria-label="Optional quiz instructions"
        style={{ width: '100%', resize: 'vertical', minHeight: 105, border: '1px solid var(--border)', borderRadius: 13, padding: 13, background: 'var(--surface2)', color: 'var(--text)', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
      />
      <div style={{ textAlign: 'right', marginTop: 6, color: 'var(--muted)', fontSize: 11 }}>{suggestion.length}/1500</div>
    </div>
    <div className="settings-grid"><Range label="Questions" value={count} min={1} max={100} onChange={setCount} /><Range label="Time limit" value={minutes} min={1} max={180} suffix="min" onChange={setMinutes} /></div>
    {error && <div className="error-box">{error}</div>}
    <button className="button primary full-width" disabled={!files.length || busy} onClick={generate}>{busy ? 'Generating…' : 'Generate quiz'}</button>
    <p className="privacy-note">Files are sent to Kenzy’s server only when you press Generate quiz.</p>
    {busy && <GenerationPanel files={files} stage={stage} stages={stages} />}
  </section>;
}

function GenerationPanel({ files, stage, stages }) {
  const progress = ((stage + 1) / stages.length) * 100;
  return <div className="generation-overlay"><div className="generation-panel"><div className="generation-header"><div><div className="eyebrow">KENZY IS WORKING</div><h3>Building your quiz</h3><p>{files.map((file) => file.name).join(' · ')}</p></div><div className="ai-orb">✦</div></div><div className="generation-progress"><span style={{ width: `${progress}%` }} /></div><div className="generation-current"><span className="stage-spinner" /><div><strong>{stages[stage][0]}</strong><p>{stages[stage][1]}</p></div></div><div className="generation-steps">{stages.map((item, index) => <div className={`generation-step ${index < stage ? 'complete' : index === stage ? 'active' : 'waiting'}`} key={item[0]}><span>{index < stage ? '✓' : index + 1}</span><div><strong>{item[0]}</strong><small>{item[1]}</small></div></div>)}</div><div className="generation-safe-note">Kenzy shows status updates only; private model reasoning is never displayed.</div></div></div>;
}

function Range({ label, value, min, max, suffix = '', onChange }) {
  return <div className="range-setting"><div className="range-top"><strong>{label}</strong><b>{value} {suffix}</b></div><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}

function QuizPage({ quiz, onExit, onFinish }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => Array(quiz.questions.length).fill(-1));
  const [seconds, setSeconds] = useState(quiz.timeLimit * 60);
  const [submitted, setSubmitted] = useState(false);
  function submit() { if (submitted) return; setSubmitted(true); const correct = answers.reduce((n, a, i) => n + (a === quiz.questions[i].correctIndex ? 1 : 0), 0); onFinish({ timestamp: new Date().toISOString(), correct, score: Math.round((correct / quiz.questions.length) * 100), answers, timeSpent: Math.max(0, quiz.timeLimit * 60 - seconds) }); }
  useEffect(() => { if (submitted) return undefined; if (seconds <= 0) { submit(); return undefined; } const timer = setTimeout(() => setSeconds((value) => value - 1), 1000); return () => clearTimeout(timer); });
  const q = quiz.questions[index];
  return <section className="page quiz-page"><div className="quiz-toolbar"><button className="back-button" onClick={onExit}>← Exit</button><div className={seconds < 60 ? 'timer danger' : 'timer'}>◷ {String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:{String(Math.max(0, seconds) % 60).padStart(2, '0')}</div></div><div className="progress-track"><span style={{ width: `${((index + 1) / quiz.questions.length) * 100}%` }} /></div><div className="question-count">Question {index + 1} <span>of {quiz.questions.length}</span></div><h2 className="quiz-question">{q.question}</h2><div className="answer-list">{q.options.map((option, optionIndex) => <button key={`${optionIndex}-${option}`} className={answers[index] === optionIndex ? 'answer-button selected' : 'answer-button'} onClick={() => setAnswers((current) => current.map((answer, i) => i === index ? optionIndex : answer))}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong></button>)}</div><div className="quiz-navigation"><button className="button secondary" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>← Previous</button>{index === quiz.questions.length - 1 ? <button className="button primary" onClick={submit}>Submit quiz</button> : <button className="button primary" onClick={() => setIndex((value) => value + 1)}>Next →</button>}</div></section>;
}

function ResultsPage({ quiz, onHome, onRetry }) {
  const attempt = quiz.lastAttempt || quiz.attempts?.[quiz.attempts.length - 1];
  const [filter, setFilter] = useState('all');
  const items = useMemo(() => quiz.questions.map((q, i) => { const selected = attempt?.answers?.[i] ?? -1; return { ...q, number: i + 1, selected, correct: selected === q.correctIndex, unanswered: selected < 0 }; }), [quiz.questions, attempt]);
  const shown = items.filter((item) => filter === 'all' || (filter === 'correct' && item.correct) || (filter === 'wrong' && !item.correct && !item.unanswered) || (filter === 'unanswered' && item.unanswered));
  const incorrect = quiz.questions.length - (attempt?.correct || 0);
  return <section className="page results-wide"><div className="result-top"><div><div className="eyebrow">QUIZ COMPLETE</div><h2>Review your answers.</h2><p>{quiz.title}</p></div><div className="big-score"><span>{attempt?.score || 0}</span><small>/ 100</small></div></div><div className="stat-grid"><div><strong>{attempt?.correct || 0}</strong><span>Correct</span></div><div><strong>{incorrect}</strong><span>Incorrect</span></div><div><strong>{formatTime(attempt?.timeSpent || 0)}</strong><span>Time</span></div><div><strong>{quiz.questions.length}</strong><span>Total</span></div></div><div className="review-header"><div><h3>Answer review</h3><p>Compare your answer with the correct answer for every question.</p></div><div className="review-filters">{['all', 'correct', 'wrong', 'unanswered'].map((item) => <button key={item} className={filter === item ? 'filter-button active' : 'filter-button'} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div><div className="review-list">{shown.map((item) => <article className={`review-card ${item.correct ? 'correct' : 'wrong'}`} key={item.number}><div className="review-card-top"><span className="review-number">Q{item.number}</span><span className="review-status">{item.unanswered ? 'Unanswered' : item.correct ? 'Correct' : 'Incorrect'}</span></div><h4>{item.question}</h4><div className="review-options">{item.options.map((option, optionIndex) => { const selected = item.selected === optionIndex; const correct = item.correctIndex === optionIndex; return <div className={`review-option ${selected ? 'selected-answer' : ''} ${correct ? 'correct-answer' : ''}`} key={option}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong>{selected && <em>Your answer</em>}{correct && <em>Correct answer</em>}</div>; })}</div></article>)}</div><div className="hero-actions"><button className="button primary" onClick={onRetry}>Retake quiz</button><button className="button secondary" onClick={onHome}>Back to home</button></div></section>;
}

function ManagePage({ quizzes, onBack, onOpen, onDelete }) {
  return <section className="page narrow-page"><button className="back-button" onClick={onBack}>← Back</button><div className="section-heading"><div className="eyebrow">LIBRARY</div><h2>Saved quizzes</h2><p>Open a quiz to practice it again or remove it from this browser.</p></div>{quizzes.length === 0 ? <div className="empty-state">No quizzes yet.</div> : <div className="quiz-library">{quizzes.map((quiz) => <div className="library-row" key={quiz.id}><button className="library-main" onClick={() => onOpen(quiz)}><strong>{quiz.title}</strong><span>{quiz.questions.length} questions · {quiz.timeLimit} min · {quiz.attempts?.length || 0} attempts</span></button><button className="delete-button" onClick={() => onDelete(quiz.id)}>Delete</button></div>)}</div>}</section>;
}

function AIPage({ onBack }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi! I’m Kenzy. Ask me to explain a topic, make a study plan, compare concepts, or help you understand something from school.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput(''); setBusy(true); setError('');
    try {
      const response = await fetch('/api/ai-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: nextMessages.slice(-12) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'AI request failed.');
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
    } catch (requestError) {
      setError(requestError.message || 'Could not contact Kenzy AI.');
    } finally { setBusy(false); }
  }

  return <section className="page ai-page"><button className="back-button" onClick={onBack}>← Back</button><div className="ai-heading"><div><div className="eyebrow">AI STUDY ASSISTANT</div><h2>Ask Kenzy</h2><p>Get explanations and study guidance without leaving your workspace.</p></div><div className="ai-badge">✦ Gemini</div></div><div className="chat-card"><div className="chat-messages">{messages.map((message, index) => <div className={message.role === 'user' ? 'message user' : 'message assistant'} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === 'user' ? 'KC' : 'K'}</div><div className="message-bubble">{message.content}</div></div>)}{busy && <div className="message assistant"><div className="message-avatar">K</div><div className="message-bubble typing"><span /><span /><span /></div></div>}</div>{error && <div className="error-box">{error}</div>}<form className="chat-form" onSubmit={sendMessage}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Kenzy anything about your studies…" rows={2} /><button className="button primary" disabled={!input.trim() || busy}>{busy ? 'Thinking…' : 'Send'}</button></form><div className="chat-suggestions"><button onClick={() => setInput('Explain this topic like I am a beginner.')}>Explain simply</button><button onClick={() => setInput('Help me make a study plan for this week.')}>Make a study plan</button><button onClick={() => setInput('Give me practice questions about this topic.')}>Practice questions</button></div></div></section>;
}

function NotesPage({ notes, draft, setDraft, onBack, onCreate, onSave, onOpen, onDelete }) {
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState('');

  async function improve(action) {
    if (!draft.content.trim() || busy) return;
    setBusy(true); setAiError(''); setAiResult('');
    try {
      const response = await fetch('/api/study-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, title: draft.title, content: draft.content }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'AI notes request failed.');
      setAiResult(data.result || '');
    } catch (error) { setAiError(error.message || 'Could not improve the note.'); }
    finally { setBusy(false); }
  }

  const selected = draft.id ? notes.find((note) => note.id === draft.id) : null;
  return <section className="page notes-page"><div className="notes-toolbar"><div><button className="back-button" onClick={onBack}>← Back</button><div className="section-heading compact"><div className="eyebrow">STUDY NOTES</div><h2>Your notes</h2><p>Write, save, and ask AI to improve your notes.</p></div></div><button className="button primary" onClick={onCreate}>＋ New note</button></div><div className="notes-layout"><aside className="notes-list"><div className="notes-list-head"><strong>Saved notes</strong><span>{notes.length}</span></div>{notes.length === 0 ? <div className="empty-note">No notes yet.</div> : notes.map((note) => <button className={draft.id === note.id ? 'note-row selected' : 'note-row'} key={note.id} onClick={() => onOpen(note)}><strong>{note.title}</strong><small>{formatDate(note.updatedAt)}</small></button>)}</aside><section className="note-editor"><input className="note-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Note title" /><textarea className="note-content" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Start writing your study notes…" /><div className="editor-actions"><button className="button primary" onClick={onSave}>Save note</button>{selected && <button className="delete-button" onClick={() => onDelete(selected.id)}>Delete</button>}</div><div className="ai-tools-card"><div><div className="eyebrow">NOTE AI</div><h3>Improve this note</h3><p>Use AI to summarize, simplify, or turn your notes into a study guide.</p></div><div className="ai-tool-buttons"><button onClick={() => improve('Summarize these study notes into concise revision points.')}>Summarize</button><button onClick={() => improve('Rewrite these notes in simple, beginner-friendly language.')}>Simplify</button><button onClick={() => improve('Turn these notes into a clear study guide with headings and key ideas.')}>Study guide</button></div>{busy && <div className="ai-working">✦ Kenzy is working on your notes…</div>}{aiError && <div className="error-box">{aiError}</div>}{aiResult && <div className="ai-result"><div className="result-label">AI RESULT</div><pre>{aiResult}</pre></div>}</div></section></div></section>;
}

function ApplicationsPage({ onBack }) {
  return <section className="page narrow-page"><button className="back-button" onClick={onBack}>← Back</button><div className="section-heading"><div className="eyebrow">APPLICATIONS</div><h2>Study applications</h2><p>Useful applications you can download and use alongside Kenzy. More links can be added later.</p></div><div className="applications-grid">{APPLICATIONS.map((app) => <article className="application-card" key={app.name}><div className="application-icon">{app.icon}</div><div className="application-body"><h3>{app.name}</h3><p>{app.description}</p>{app.url ? <a className="download-button" href={app.url} target="_blank" rel="noreferrer">Download ↗</a> : <span className="coming-label">Link coming soon</span>}</div></article>)}</div></section>;
}

function SettingsPage({ theme, setTheme, onBack }) {
  return <section className="page narrow-page"><button className="back-button" onClick={onBack}>← Back</button><div className="section-heading"><div className="eyebrow">SETTINGS</div><h2>Customize Kenzy</h2><p>Choose the appearance you prefer. Your setting is saved on this device.</p></div><div className="settings-card"><div className="settings-row"><div><strong>Appearance</strong><span>Switch between light and high-contrast dark mode.</span></div><div className="segmented"><button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button><button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button></div></div></div></section>;
}

function toBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error('Could not read the uploaded file.')); reader.readAsDataURL(file); }); }
function validQuestion(q) { return q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.options) && q.options.length === 4 && q.options.every((option) => typeof option === 'string' && option.trim()) && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4; }
function formatTime(seconds) { return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }

export default App;
