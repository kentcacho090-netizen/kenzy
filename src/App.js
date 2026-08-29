import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'kenzy-quizzes-v1';

const SAMPLE_QUIZ = {
  id: 'sample',
  title: 'Quick Science Review',
  questions: [
    { question: 'What is the basic unit of life?', options: ['Atom', 'Cell', 'Tissue', 'Organ'], correctIndex: 1 },
    { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Mars', 'Mercury'], correctIndex: 2 },
    { question: 'What gas do plants primarily absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctIndex: 2 }
  ],
  timeLimit: 5,
  attempts: []
};

function loadQuizzes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function App() {
  const [page, setPage] = useState('home');
  const [quizzes, setQuizzes] = useState(loadQuizzes);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem('kenzy-dark') === 'true');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
  }, [quizzes]);

  useEffect(() => {
    localStorage.setItem('kenzy-dark', String(dark));
  }, [dark]);

  function goHome() {
    setActiveQuiz(null);
    setPage('home');
  }

  function startQuiz(quiz) {
    setActiveQuiz(quiz);
    setPage('quiz');
  }

  function addQuiz(quiz) {
    setQuizzes((current) => [quiz, ...current]);
    setActiveQuiz(quiz);
    setPage('quiz');
  }

  function finishQuiz(attempt) {
    setQuizzes((current) => current.map((quiz) => {
      if (quiz.id !== activeQuiz.id) return quiz;
      return { ...quiz, attempts: [...(quiz.attempts || []), attempt] };
    }));
    setActiveQuiz({
      ...activeQuiz,
      attempts: [...(activeQuiz.attempts || []), attempt],
      lastAttempt: attempt
    });
    setPage('results');
  }

  function deleteQuiz(id) {
    setQuizzes((current) => current.filter((quiz) => quiz.id !== id));
    if (activeQuiz?.id === id) goHome();
  }

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="Go to home">
          <span className="brand-mark">K</span>
          <span>Kenzy</span>
        </button>
        <div className="header-actions">
          <button className="ghost-icon" onClick={() => setDark((value) => !value)} aria-label="Toggle dark mode">
            {dark ? '☀' : '☾'}
          </button>
          <span className="profile">KC</span>
        </div>
      </header>

      <main>
        {page === 'home' && (
          <HomePage quizzes={quizzes} onCreate={() => setPage('create')} onManage={() => setPage('manage')} onSample={() => addQuiz({ ...SAMPLE_QUIZ, id: `sample-${Date.now()}` })} />
        )}
        {page === 'create' && (
          <CreatePage onBack={goHome} onCreate={addQuiz} />
        )}
        {page === 'quiz' && activeQuiz && (
          <QuizPage quiz={activeQuiz} onExit={goHome} onFinish={finishQuiz} />
        )}
        {page === 'results' && activeQuiz && (
          <ResultsPage quiz={activeQuiz} onHome={goHome} onRetry={() => setPage('quiz')} />
        )}
        {page === 'manage' && (
          <ManagePage quizzes={quizzes} onBack={goHome} onOpen={startQuiz} onDelete={deleteQuiz} />
        )}
      </main>

      <footer>Kenzy · Turn your study material into practice.</footer>
    </div>
  );
}

function HomePage({ quizzes, onCreate, onManage, onSample }) {
  return (
    <section className="page home-page">
      <div className="hero-copy">
        <div className="eyebrow">AI STUDY TOOL</div>
        <h1>Turn your notes into <span>better quizzes.</span></h1>
        <p>Upload a study PDF, choose how many questions you want, and generate a focused multiple-choice quiz.</p>
        <div className="hero-actions">
          <button className="button primary" onClick={onCreate}>＋ Create a quiz</button>
          {quizzes.length > 0 && <button className="button secondary" onClick={onManage}>Your quizzes ({quizzes.length})</button>}
        </div>
      </div>

      <div className="feature-grid">
        <Feature icon="↥" title="Upload" text="Use reviewers, modules, lecture notes, or handouts in PDF format." />
        <Feature icon="✦" title="Generate" text="Kenzy creates clear four-choice questions from your material." />
        <Feature icon="◷" title="Practice" text="Take the quiz with a timer, track your answers, and see your score." />
      </div>

      {quizzes.length === 0 ? (
        <div className="sample-banner">
          <div>
            <strong>Try the experience first</strong>
            <span>Use a small built-in quiz before connecting your AI key.</span>
          </div>
          <button className="text-button" onClick={onSample}>Try sample →</button>
        </div>
      ) : (
        <div className="recent-card">
          <div className="card-heading">
            <span>Recent quizzes</span>
            <button className="text-button" onClick={onManage}>View all →</button>
          </div>
          {quizzes.slice(0, 3).map((quiz) => (
            <button className="recent-row" key={quiz.id} onClick={() => onManage()}>
              <span>{quiz.title}</span>
              <small>{quiz.questions.length} questions · {quiz.attempts?.length || 0} attempts</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Feature({ icon, title, text }) {
  return (
    <article className="feature-card">
      <div className="feature-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function CreatePage({ onBack, onCreate }) {
  const [file, setFile] = useState(null);
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const MAX_BYTES = 2.7 * 1024 * 1024;

  function chooseFile(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setError(selected && selected.size > MAX_BYTES ? 'Please choose a PDF smaller than 2.7 MB.' : '');
  }

  async function generateQuiz() {
    if (!file) {
      setError('Please choose a PDF first.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Please choose a PDF smaller than 2.7 MB.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const dataUrl = await fileToDataUrl(file);
      const base64 = dataUrl.split(',')[1] || '';

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: base64, count })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Quiz generation failed.');

      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('The AI did not return any questions.');
      }

      const safeQuestions = data.questions.filter((question) => (
        question &&
        typeof question.question === 'string' &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        Number.isInteger(question.correctIndex) &&
        question.correctIndex >= 0 &&
        question.correctIndex < 4
      ));

      if (!safeQuestions.length) throw new Error('The AI returned an invalid quiz format.');

      onCreate({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.pdf$/i, ''),
        questions: safeQuestions,
        timeLimit: minutes,
        createdAt: new Date().toISOString(),
        attempts: []
      });
    } catch (generationError) {
      setError(generationError.message || 'Could not generate the quiz.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page narrow-page">
      <button className="back-button" onClick={onBack}>← Back</button>
      <div className="section-heading">
        <div className="eyebrow">NEW QUIZ</div>
        <h2>Create a quiz</h2>
        <p>Give Kenzy your study material and choose your practice settings.</p>
      </div>

      <label className="upload-box">
        <input type="file" accept="application/pdf,.pdf" onChange={chooseFile} />
        <span className="upload-symbol">↑</span>
        <strong>{file ? file.name : 'Choose a PDF file'}</strong>
        <small>{file ? `${Math.ceil(file.size / 1024)} KB selected` : 'PDF only · maximum 2.7 MB'}</small>
      </label>

      <div className="settings-grid">
        <RangeSetting label="Questions" value={count} min={3} max={30} onChange={setCount} />
        <RangeSetting label="Time limit" value={minutes} min={1} max={60} suffix="min" onChange={setMinutes} />
      </div>

      {error && <div className="error-box">{error}</div>}

      <button className="button primary full-width" disabled={!file || busy || file.size > MAX_BYTES} onClick={generateQuiz}>
        {busy ? 'Generating…' : 'Generate quiz'}
      </button>
      <p className="privacy-note">The PDF is sent to Kenzy’s server endpoint only when you press Generate quiz.</p>
    </section>
  );
}

function RangeSetting({ label, value, min, max, suffix = '', onChange }) {
  return (
    <div className="range-setting">
      <div className="range-top">
        <strong>{label}</strong>
        <b>{value} {suffix}</b>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function QuizPage({ quiz, onExit, onFinish }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => Array(quiz.questions.length).fill(-1));
  const [secondsLeft, setSecondsLeft] = useState(quiz.timeLimit * 60);
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (submitted) return;
    setSubmitted(true);
    const correct = answers.reduce((total, answer, questionIndex) => total + (answer === quiz.questions[questionIndex].correctIndex ? 1 : 0), 0);
    onFinish({
      timestamp: new Date().toISOString(),
      correct,
      score: Math.round((correct / quiz.questions.length) * 100),
      answers,
      timeSpent: Math.max(0, quiz.timeLimit * 60 - secondsLeft)
    });
  }

  useEffect(() => {
    if (submitted) return undefined;
    if (secondsLeft <= 0) {
      submit();
      return undefined;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => value - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  });

  const question = quiz.questions[index];
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const progress = ((index + 1) / quiz.questions.length) * 100;

  return (
    <section className="page quiz-page">
      <div className="quiz-toolbar">
        <button className="back-button" onClick={onExit}>← Exit</button>
        <div className={secondsLeft < 60 ? 'timer danger' : 'timer'}>◷ {minutes}:{seconds}</div>
      </div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      <div className="question-count">Question {index + 1} <span>of {quiz.questions.length}</span></div>
      <h2 className="quiz-question">{question.question}</h2>

      <div className="answer-list">
        {question.options.map((option, optionIndex) => (
          <button
            key={`${optionIndex}-${option}`}
            className={answers[index] === optionIndex ? 'answer-button selected' : 'answer-button'}
            onClick={() => setAnswers((current) => current.map((answer, i) => i === index ? optionIndex : answer))}
          >
            <span>{String.fromCharCode(65 + optionIndex)}</span>
            <strong>{option}</strong>
          </button>
        ))}
      </div>

      <div className="quiz-navigation">
        <button className="button secondary" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>← Previous</button>
        {index === quiz.questions.length - 1 ? (
          <button className="button primary" onClick={submit}>Submit quiz</button>
        ) : (
          <button className="button primary" onClick={() => setIndex((value) => value + 1)}>Next →</button>
        )}
      </div>
    </section>
  );
}

function ResultsPage({ quiz, onHome, onRetry }) {
  const attempt = quiz.lastAttempt || quiz.attempts?.[quiz.attempts.length - 1];
  const incorrect = quiz.questions.length - (attempt?.correct || 0);
  return (
    <section className="page narrow-page result-page">
      <div className="eyebrow">QUIZ COMPLETE</div>
      <h2>Nice work.</h2>
      <p>You scored on <strong>{quiz.title}</strong>.</p>
      <div className="big-score"><span>{attempt?.score || 0}</span><small>/ 100</small></div>
      <div className="stat-grid">
        <div><strong>{attempt?.correct || 0}</strong><span>Correct</span></div>
        <div><strong>{incorrect}</strong><span>Incorrect</span></div>
        <div><strong>{formatTime(attempt?.timeSpent || 0)}</strong><span>Time</span></div>
      </div>
      <div className="hero-actions">
        <button className="button primary" onClick={onRetry}>Retake quiz</button>
        <button className="button secondary" onClick={onHome}>Back to home</button>
      </div>
    </section>
  );
}

function ManagePage({ quizzes, onBack, onOpen, onDelete }) {
  return (
    <section className="page narrow-page">
      <button className="back-button" onClick={onBack}>← Back</button>
      <div className="section-heading">
        <div className="eyebrow">LIBRARY</div>
        <h2>Your quizzes</h2>
        <p>Open a quiz to practice it again or remove it from this browser.</p>
      </div>
      {quizzes.length === 0 ? (
        <div className="empty-state">No quizzes yet.</div>
      ) : (
        <div className="quiz-library">
          {quizzes.map((quiz) => (
            <div className="library-row" key={quiz.id}>
              <button className="library-main" onClick={() => onOpen(quiz)}>
                <strong>{quiz.title}</strong>
                <span>{quiz.questions.length} questions · {quiz.timeLimit} min · {quiz.attempts?.length || 0} attempts</span>
              </button>
              <button className="delete-button" onClick={() => onDelete(quiz.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that PDF.'));
    reader.readAsDataURL(file);
  });
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export default App;
