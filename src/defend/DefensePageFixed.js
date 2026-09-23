import React, { useEffect, useMemo, useState } from 'react';
import './DefensePage.css';
import { askPanel, clientId, connectRoom, disconnectRoom, realtimeConfigured, sendEvent, updateRoomPresence } from './realtime';

const OPENING_QUESTION = 'Before we begin, what is your thesis topic or title? Please state it clearly, and briefly explain what your study is trying to solve.';

function openingQuestion(language) {
  if (language === 'tagalog') return 'Bago tayo magsimula, ano ang thesis topic o title ninyo? Sabihin nang malinaw, at maikling ipaliwanag kung anong problema ang sinusubukan ninyong solusyunan ng study.';
  if (language === 'taglish') return 'Before we begin, ano ang thesis topic or title ninyo? Sabihin nang malinaw, then briefly explain kung anong problem ang sinusubukan ninyong i-solve ng study.';
  return OPENING_QUESTION;
}
const THESIS_FALLBACK = 'Your thesis topic has not been provided yet.';

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'DFND-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 16);
}

function initials(name) {
  return String(name || '??').slice(0, 2).toUpperCase();
}

function memberName(people, id, fallbackName) {
  return people.find((p) => p.id === id)?.name || (id === clientId ? fallbackName : 'Member');
}

function compactTopic(value) {
  const raw = String(value || '').replace(/\\s+/g, ' ').trim();
  if (!raw) return '';
  const cleaned = raw
    .replace(/^(?:our\\s+)?(?:thesis\\s+)?(?:topic|title)\\s*(?:is|:|-)?\\s*/i, '')
    .trim();
  const first = cleaned.split(/(?<=[.!?])\\s+/)[0].trim();
  if (first.length <= 180 && !/^(?:our study|the study|we aim|our objective|the problem|this study)\\b/i.test(first)) {
    return first.replace(/[.!?]+$/, '');
  }
  const compact = cleaned.split(/\\s+(?:our study|the study|we aim|our objective|the problem|this study)\\b/i)[0].trim();
  return (compact || first || cleaned).replace(/[.!?]+$/, '').slice(0, 180);
}

function ExitConfirm({ onCancel, onConfirm }) {
  return (
    <div className="defend-exit-overlay" role="dialog" aria-modal="true" aria-labelledby="defend-exit-title">
      <div className="defend-exit-dialog">
        <div className="defend-exit-icon">!</div>
        <div className="defend-eyebrow">LEAVE DEFENSE ROOM</div>
        <h2 id="defend-exit-title">Exit this room?</h2>
        <p>Your live defense connection will be closed. Your group can continue, but you will leave this room.</p>
        <div className="defend-exit-actions">
          <button className="defend-secondary" onClick={onCancel}>Stay in room</button>
          <button className="defend-exit-confirm" onClick={onConfirm}>Exit room</button>
        </div>
      </div>
    </div>
  );
}

export default function DefensePage({ onBack }) {
  const [screen, setScreen] = useState('home');
  const [isCreator, setIsCreator] = useState(false);
  const [room, setRoom] = useState('');
  const [name, setName] = useState('You');
  const [language, setLanguage] = useState('taglish');
  const [style, setStyle] = useState('aggressive');
  const [status, setStatus] = useState(realtimeConfigured ? 'CONNECTING' : 'LOCAL_MODE');
  const [participants, setParticipants] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [currentMember, setCurrentMember] = useState(clientId);
  const [answer, setAnswer] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [panelClarification, setPanelClarification] = useState('');
  const [clarifyBusy, setClarifyBusy] = useState(false);
  const [teamChat, setTeamChat] = useState([]);
  const [teamMessage, setTeamMessage] = useState('');
  const [error, setError] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const memberMap = useMemo(() => Object.fromEntries(participants.map((p) => [p.id, p])), [participants]);
  const currentName = memberName(participants, currentMember, name);

  function requestExit() {
    setShowExitConfirm(true);
  }

  async function confirmExit() {
    setShowExitConfirm(false);
    await disconnectRoom();
    setParticipants([]);
    setTranscript([]);
    setTeamChat([]);
    setQuestion('');
    setTopic('');
    setAnswer('');
    setAiBusy(false);
    setAiError('');
    setError('');
    setRoom('');
    setScreen('home');
  }

  useEffect(() => () => { disconnectRoom(); }, []);

  async function joinRealtime(roomCode = room) {
    if (!realtimeConfigured) {
      setStatus('LOCAL_MODE');
      return;
    }
    setStatus('CONNECTING');
    const result = await connectRoom(roomCode, {
      name,
      role: isCreator ? 'controller' : 'member',
      language,
      style,
      onStatus: setStatus,
      onPresence: (people) => setParticipants(
        people.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))
      ),
      onEvent: handleEvent,
    });
    if (!result.ok) {
      setError(result.reason === 'timeout'
        ? 'Realtime connection timed out. Check the Supabase variables in Vercel.'
        : 'Could not connect to the defense room.');
    }
    if (result.ok && !isCreator) await sendEvent('request_snapshot', { requester: clientId });
  }

  function handleEvent(event) {
    if (!event) return;
    if (event.event === 'request_snapshot' && isCreator) {
      sendEvent('snapshot', {
        currentMember,
        question,
        transcript,
        topic,
        language,
        style,
        teamChat,
        started: Boolean(question),
      });
    } else if (event.event === 'snapshot' && !isCreator) {
      setCurrentMember(event.currentMember || clientId);
      setQuestion(event.question || '');
      setTranscript(event.transcript || []);
      setTopic(event.topic || '');
      setLanguage(event.language || 'taglish');
      setStyle(event.style || 'aggressive');
      setTeamChat(event.teamChat || []);
      if (event.started) setScreen('room');
      else setScreen('lobby');
    } else if (event.event === 'start') {
      setCurrentMember(event.currentMember || clientId);
      setQuestion(event.question || openingQuestion(event.language || language));
      setTopic(event.topic || '');
      setLanguage(event.language || language);
      setStyle(event.style || style);
      setScreen('room');
    } else if (event.event === 'answer') {
      setTranscript((items) => items.some((item) => item.id === event.answer.id) ? items : [...items, event.answer]);
      setCurrentMember(event.nextMember || clientId);
      setQuestion(event.nextQuestion || openingQuestion(language));
      setTopic(event.topic || topic);
      setAiBusy(false);
      setAiError('');
    } else if (event.event === 'team_chat') {
      setTeamChat((items) => items.some((item) => item.id === event.message?.id) ? items : [...items, event.message]);
    } else if (event.event === 'settings') {
      setLanguage(event.language || language);
      setStyle(event.style || style);
    }
  }

  function openCreate() {
    setRoom(makeRoomCode());
    setName('You');
    setIsCreator(true);
    setTopic('');
    setScreen('join');
    setError('');
  }

  function openJoin() {
    setRoom('');
    setIsCreator(false);
    setTopic('');
    setScreen('join');
    setError('');
  }

  async function enterRoom() {
    const cleanRoom = normalizeRoomCode(room);
    const cleanName = name.trim();
    if (!/^[A-Z0-9][A-Z0-9-]{3,15}$/.test(cleanRoom)) {
      return setError('Use 4–16 letters/numbers, with optional hyphens. Example: KEN-DEFEND.');
    }
    if (cleanName.length < 2) return setError('Enter your name first.');

    setRoom(cleanRoom);
    setName(cleanName.slice(0, 24));
    setParticipants([]);
    setTranscript([]);
    setQuestion('');
    setTopic('');
    setCurrentMember(clientId);
    setScreen('lobby');
    setError('');
    await joinRealtime(cleanRoom);
  }

  async function startDefense() {
    if (!isCreator || !participants.length) return;
    setAiBusy(true);
    setAiError('');
    const first = participants[0]?.id || clientId;
    const opening = openingQuestion(participants[0]?.language || language);
    setCurrentMember(first);
    setQuestion(opening);
    setScreen('room');
    await sendEvent('start', {
      currentMember: first,
      question: opening,
      topic: '',
      language,
      style,
    });
    setAiBusy(false);
  }

  async function sendTeamMessage() {
    const text = teamMessage.trim();
    if (!text) return;
    const message = { id: crypto.randomUUID(), member: clientId, name, text, createdAt: new Date().toISOString() };
    setTeamChat((items) => [...items, message]);
    setTeamMessage('');
    // Team chat is deliberately never sent to the AI.
    await sendEvent('team_chat', { message });
  }

  function looksLikeClarification(text) {
    const value = String(text || '').trim().toLowerCase();
    return /(^|\\b)(what do you mean|what does that mean|what do you mean by|can you clarify|please clarify|clarify that|explain that|explain what|ano ibig sabihin|anong ibig sabihin|ibig sabihin ba|paki[- ]?explain|paki[- ]?clarify|pa[na]no ibig sabihin)(\\b|$)/i.test(value);
  }

  async function askPanelClarification(text) {
    const message = String(text || '').trim();
    if (!message || clarifyBusy || aiBusy) return;
    setClarifyBusy(true);
    setAiError('');
    try {
      const people = participants.length ? participants : [{ id: clientId, name, language, style }];
      const result = await askPanel({
        topic,
        latestAnswer: '',
        currentQuestion: question,
        currentMember: { id: clientId, name, language, style },
        members: people.map((p) => ({
          id: p.id,
          name: p.name,
          language: p.language || language,
          style: p.style || style,
        })),
        transcript,
        language,
        style,
        phase: 'panel_chat',
        userMessage: message,
        panelChat: [{ question, userMessage: message }],
      });
      if (result.ok && result.reply) {
        setPanelClarification(result.reply);
      } else {
        setAiError('The AI panel could not explain the question. Please try again.');
      }
    } catch {
      setAiError('The AI panel could not explain the question. Please try again.');
    } finally {
      setClarifyBusy(false);
    }
  }

  async function submitAnswer() {
    const text = answer.trim();
    if (!text || currentMember !== clientId || aiBusy || clarifyBusy) return;

    if (looksLikeClarification(text)) {
      setAnswer('');
      await askPanelClarification(text);
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      member: clientId,
      question,
      answer: text,
      createdAt: new Date().toISOString(),
    };

    const nextTranscript = [...transcript, item];
    setTranscript(nextTranscript);
    setAnswer('');
    setAiBusy(true);
    setAiError('');

    const people = participants.length ? participants : [{ id: clientId, name, language, style }];
    const result = await askPanel({
      topic,
      latestAnswer: text,
      currentQuestion: question,
      currentMember: { id: clientId, name, language, style },
      members: people.map((p) => ({
        id: p.id,
        name: p.name,
        language: p.language || language,
        style: p.style || style,
      })),
      transcript: nextTranscript,
      language,
      style,
      phase: topic ? 'defense' : 'topic_intake',
    });

    if (!result.ok) {
      setAiBusy(false);
      setAiError(result.error || 'The AI panel could not respond.');
      return;
    }

    if (result.topic) setTopic(compactTopic(result.topic));
    // DEFEND is intentionally continuous: every answer produces another attack.
    // There is no "finished" state during the live defense.
    const nextMember = people.some((p) => p.id === result.nextMember)
      ? result.nextMember
      : people[(people.findIndex((p) => p.id === clientId) + 1) % people.length]?.id || clientId;
    const nextQuestion = result.question || 'Please clarify your previous answer and provide the evidence supporting it.';

    setCurrentMember(nextMember);
    setQuestion(nextQuestion);
    setTopic(compactTopic(result.topic || topic));
    setAiBusy(false);

    await sendEvent('answer', {
      answer: item,
      nextMember,
      nextQuestion,
      topic: compactTopic(result.topic || topic),
    });
  }

  if (screen === 'home') return (
    <section className="defend-shell">
      <button className="defend-back" onClick={onBack}>← Back to Kenzy</button>
      <div className="defend-hero">
        <div className="defend-brand"><span>D</span><strong>DEFEND</strong><em>AI THESIS DEFENSE</em></div>
        <div className="defend-eyebrow">THESIS DEFENSE · AI PANELIST</div>
        <h1>Defend your thesis.<br /><span>Under pressure.</span></h1>
        <p>A live group defense simulator. The AI panelist listens to the whole transcript, finds weak claims, attacks contradictions, and chooses who answers next.</p>
        <div className="defend-actions">
          <button className="defend-primary" onClick={openCreate}>＋ Create defense room</button>
          <button className="defend-secondary" onClick={openJoin}>Join an existing room</button>
        </div>
        <div className="defend-features">
          <div><b>01</b><strong>AI-controlled</strong><small>No human host. The panel controls the defense.</small></div>
          <div><b>02</b><strong>Group-aware</strong><small>Every answer becomes shared panel memory.</small></div>
          <div><b>03</b><strong>Adaptive attacks</strong><small>Contradictions trigger follow-up pressure.</small></div>
        </div>
      </div>
    </section>
  );

  if (screen === 'join') return (
    <section className="defend-shell">
      <button className="defend-back" onClick={() => setScreen('home')}>← Back</button>
      <div className="defend-form-card">
        <div className="defend-eyebrow">{isCreator ? 'ROOM CREATED' : 'JOIN DEFENSE ROOM'}</div>
        <h2>{isCreator ? 'Your room is ready.' : 'Enter the room.'}</h2>
        <p>{isCreator ? 'Share the code with your group. Everyone joins before the AI begins.' : 'Use the room code your group shared with you.'}</p>
        <label>ROOM CODE<input value={room} onChange={(e) => setRoom(normalizeRoomCode(e.target.value))} placeholder="KEN-DEFEND" maxLength={16} /><small>{isCreator ? 'Custom codes make it easier for your group to join. Keep it 4–16 characters.' : 'Ask your room creator for the exact code.'}</small></label>
        <label>YOUR NAME<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ken" maxLength={24} /></label>
        <div className="defend-two"><label>LANGUAGE<select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="taglish">🇵🇭 Taglish</option><option value="tagalog">🇵🇭 Tagalog</option><option value="english">🇺🇸 English</option></select></label><label>STYLE<select value={style} onChange={(e) => setStyle(e.target.value)}><option value="aggressive">🔥 Aggressive</option><option value="balanced">⚖️ Balanced</option><option value="technical">🧠 Technical</option><option value="formal">🎓 Formal</option></select></label></div>
        {error && <div className="defend-error">{error}</div>}
        <button className="defend-primary wide" onClick={enterRoom}>Join room →</button>
        <small>Joining does not start the defense. The AI controls the actual questioning.</small>
      </div>
    </section>
  );

  if (screen === 'lobby') return (
    <section className="defend-shell">
      <header className="defend-top"><button className="defend-back defend-exit-trigger" onClick={requestExit}>← Exit</button><strong>DEFEND</strong><span className={status === 'SYNCED' ? 'defend-sync' : 'defend-sync warn'}>● {status}</span><b>{room}</b></header>
      <div className="defend-lobby">
        <main className="defend-card">
          <div className="defend-eyebrow">ROOM LOBBY</div>
          <h2>Everyone joins first.</h2>
          <p>Once the group is ready, the AI panelist will begin by asking for your thesis topic.</p>
          <div className="defend-thesis"><small>DEFENSE TOPIC</small><strong>{topic || 'The AI will collect this from the opening answer.'}</strong></div>
          <div className="defend-room-code"><div><small>ROOM CODE · SHARE THIS</small><strong>{room}</strong></div><button onClick={() => navigator.clipboard?.writeText(room)}>Copy code</button></div>
          <div className="defend-ready">● <div><strong>AI PANELIST READY</strong><span>No human host. The AI chooses targets, follow-ups, contradictions, and when the defense is sufficiently tested.</span></div></div>
          {status === 'LOCAL_MODE' && <div className="defend-warning">Realtime is not configured yet. Add the Supabase variables to the StudyKen Vercel project to synchronize devices.</div>}
          {status === 'ERROR' || status === 'TIMEOUT' ? <div className="defend-warning">Realtime could not connect. Check the Supabase variables and redeploy.</div> : null}
          {aiError && <div className="defend-warning">{aiError}</div>}
          <button className="defend-primary wide" disabled={!isCreator || participants.length === 0 || aiBusy} onClick={startDefense}>{isCreator ? (participants.length ? 'Start AI Defense →' : 'Waiting for members →') : 'Waiting for room creator →'}</button>
        </main>
        <aside className="defend-card"><div className="defend-side-title">JOINED MEMBERS <span>{participants.length}</span></div>{participants.map((person) => <div className="defend-member" key={person.id}><i>{initials(person.name)}</i><div><strong>{person.name}</strong><small>{person.id === clientId ? 'YOU · JOINED' : 'JOINED'}</small></div></div>)}{!participants.length && <div className="defend-empty">Waiting for members…</div>}</aside>
      </div>
      {showExitConfirm && <ExitConfirm onCancel={() => setShowExitConfirm(false)} onConfirm={confirmExit} />}
    </section>
  );

  return (
    <section className="defend-shell">
      <header className="defend-top"><button className="defend-back defend-exit-trigger" onClick={requestExit}>← Exit</button><strong>DEFEND · LIVE</strong><span className={status === 'SYNCED' ? 'defend-sync' : 'defend-sync warn'}>● {status}</span><b>{room}</b></header>
      <div className="defend-room">
        <aside className="defend-card defend-sidebar">
          <div className="defend-side-title">THESIS TEAM <span>{participants.length} online</span></div>
          {participants.map((person) => <div className={person.id === currentMember ? 'defend-member active' : 'defend-member'} key={person.id}><i>{initials(person.name)}</i><div><strong>{person.name}</strong><small>{person.id === currentMember ? 'ANSWERING NOW' : 'ONLINE'}</small></div></div>)}
          <label>LANGUAGE<select value={language} onChange={async (e) => { const value = e.target.value; setLanguage(value); await updateRoomPresence({ name, role: isCreator ? 'controller' : 'member', language: value, style }); }}><option value="taglish">🇵🇭 Taglish</option><option value="tagalog">🇵🇭 Tagalog</option><option value="english">🇺🇸 English</option></select></label>
          <label>STYLE<select value={style} onChange={async (e) => { const value = e.target.value; setStyle(value); await updateRoomPresence({ name, role: isCreator ? 'controller' : 'member', language, style: value }); }}><option value="aggressive">🔥 Aggressive</option><option value="balanced">⚖️ Balanced</option><option value="technical">🧠 Technical</option><option value="formal">🎓 Formal</option></select></label>
          <div className="defend-topic-mini"><small>THESIS TOPIC</small><strong>{topic || THESIS_FALLBACK}</strong></div>
          <div className="defend-side-chat">
            <div className="defend-side-chat-head"><strong>TEAM CHAT</strong><span>AI BLIND</span></div>
            <div className="defend-side-chat-messages">
              {teamChat.map((item) => <div className="defend-side-chat-msg" key={item.id}><b>{item.name}</b><p>{item.text}</p></div>)}
              {!teamChat.length && <small>Talk privately with your group. The AI cannot see this.</small>}
            </div>
            <div className="defend-side-chat-compose"><input value={teamMessage} onChange={(e) => setTeamMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendTeamMessage()} placeholder="Talk to your group…"/><button onClick={sendTeamMessage} disabled={!teamMessage.trim()}>→</button></div>
          </div>
        </aside>
        <main>
          <div className="defend-thesis"><small>LIVE DEFENSE · SHARED TOPIC</small><strong>{topic || THESIS_FALLBACK}</strong></div>
          <section className="defend-panel">
            <div className="defend-panel-meta">● AI PANELIST · {language.toUpperCase()} <em>{aiBusy ? 'Thinking about what to ask next…' : 'Listening to the entire defense'}</em></div>
            {aiBusy && <div className="defend-ai-thinking"><span className="defend-thinking-dot"></span><div><strong>AI PANELIST IS THINKING</strong><small>Reviewing your answer, the thesis topic, and the group's previous answers before responding.</small></div></div>}
            <h1>{question || openingQuestion(language)}</h1>
            <div className="defend-attack"><b>{aiBusy ? 'ANALYZING' : 'ADAPTIVE ATTACK'}</b><span>{aiBusy ? 'The panel is analyzing the latest answer and the full group transcript before choosing what to say next.' : 'The panel uses the group’s previous answers to target unsupported claims, contradictions, and methodology gaps.'}</span></div>
            {panelClarification && <div className="defend-panel-clarification"><small>AI PANEL CLARIFICATION</small><p>{panelClarification}</p></div>}
          </section>
          <section className="defend-answer defend-card">
            <div><small>ANSWERING</small><strong>{currentName}</strong></div>
            <span className="defend-turn">{currentMember === clientId ? 'YOUR TURN' : 'WATCHING'}</span>
            <textarea disabled={currentMember !== clientId || aiBusy} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={currentMember === clientId ? 'Your answer is shared with everyone in the room…' : 'Wait for your turn…'} />
            <button className="defend-primary wide" disabled={currentMember !== clientId || !answer.trim() || aiBusy || clarifyBusy} onClick={submitAnswer}>{aiBusy ? 'AI is analyzing…' : clarifyBusy ? 'AI is explaining…' : 'Submit to AI panel →'}</button>
            {aiError && <div className="defend-error">{aiError}</div>}
          </section>
          <section className="defend-feed defend-card">
            <div className="defend-feed-head">LIVE DEFENSE FEED <span>Shared with the entire group</span></div>
            {transcript.length ? [...transcript].reverse().map((item) => <article key={item.id}><i>{initials(memberMap[item.member]?.name || (item.member === clientId ? name : 'Member'))}</i><div><strong>{memberMap[item.member]?.name || (item.member === clientId ? name : 'Member')}</strong><p>{item.answer}</p></div></article>) : <div className="defend-empty">No answers yet. The AI is waiting for the opening topic.</div>}
          </section>
        </main>
      </div>
      {showExitConfirm && <ExitConfirm onCancel={() => setShowExitConfirm(false)} onConfirm={confirmExit} />}
    </section>
  );
}
