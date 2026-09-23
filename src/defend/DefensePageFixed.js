import React, { useEffect, useMemo, useState } from 'react';
import './DefensePage.css';
import { askPanel, clientId, connectRoom, disconnectRoom, realtimeConfigured, sendEvent } from './realtime';

const OPENING_QUESTION = 'Before we begin, what is your thesis topic or title? Please state it clearly, and briefly explain what your study is trying to solve.';
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
  const [panelChat, setPanelChat] = useState([]);
  const [teamChat, setTeamChat] = useState([]);
  const [panelMessage, setPanelMessage] = useState('');
  const [teamMessage, setTeamMessage] = useState('');
  const [panelBusy, setPanelBusy] = useState(false);
  const [error, setError] = useState('');

  const memberMap = useMemo(() => Object.fromEntries(participants.map((p) => [p.id, p])), [participants]);
  const currentName = memberName(participants, currentMember, name);

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
        panelChat,
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
      setPanelChat(event.panelChat || []);
      setTeamChat(event.teamChat || []);
      if (event.started) setScreen('room');
      else setScreen('lobby');
    } else if (event.event === 'start') {
      setCurrentMember(event.currentMember || clientId);
      setQuestion(event.question || OPENING_QUESTION);
      setTopic(event.topic || '');
      setLanguage(event.language || language);
      setStyle(event.style || style);
      setScreen('room');
    } else if (event.event === 'answer') {
      setTranscript((items) => items.some((item) => item.id === event.answer.id) ? items : [...items, event.answer]);
      setCurrentMember(event.nextMember || clientId);
      setQuestion(event.nextQuestion || OPENING_QUESTION);
      setTopic(event.topic || topic);
      setAiBusy(false);
      setAiError('');
    } else if (event.event === 'panel_chat') {
      setPanelChat((items) => items.some((item) => item.id === event.message?.id) ? items : [...items, event.message]);
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
    const opening = OPENING_QUESTION;
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

  async function sendPanelMessage() {
    const text = panelMessage.trim();
    if (!text || panelBusy) return;
    const message = { id: crypto.randomUUID(), member: clientId, name, text, createdAt: new Date().toISOString() };
    const next = [...panelChat, message];
    setPanelChat(next);
    setPanelMessage('');
    setPanelBusy(true);
    const result = await askPanel({
      topic,
      latestAnswer: '',
      currentMember: { id: clientId, name },
      members: participants.map((p) => ({ id: p.id, name: p.name })),
      transcript,
      panelChat: next,
      userMessage: text,
      language,
      style,
      phase: 'panel_chat',
    });
    if (result.ok && result.reply) {
      const reply = { id: crypto.randomUUID(), member: 'ai-panel', name: 'AI PANEL', text: result.reply, createdAt: new Date().toISOString(), ai: true };
      setPanelChat((items) => [...items, reply]);
      await sendEvent('panel_chat', { message: reply });
    } else if (!result.ok) {
      setAiError(result.error || 'The AI panel could not respond.');
    }
    await sendEvent('panel_chat', { message });
    setPanelBusy(false);
  }

  async function sendTeamMessage() {
    const text = teamMessage.trim();
    if (!text) return;
    const message = { id: crypto.randomUUID(), member: clientId, name, text, createdAt: new Date().toISOString() };
    setTeamChat((items) => [...items, message]);
    setTeamMessage('');
    // IMPORTANT: team_chat is never sent to askPanel, so the AI cannot see this private team discussion.
    await sendEvent('team_chat', { message });
  }

  async function submitAnswer() {
    const text = answer.trim();
    if (!text || currentMember !== clientId || aiBusy) return;

    const item = {
      id: crypto.randomUUID(),
      member: clientId,
      answer: text,
      createdAt: new Date().toISOString(),
    };

    const nextTranscript = [...transcript, item];
    setTranscript(nextTranscript);
    setAnswer('');
    setAiBusy(true);
    setAiError('');

    const people = participants.length ? participants : [{ id: clientId, name }];
    const result = await askPanel({
      topic,
      latestAnswer: text,
      currentMember: { id: clientId, name },
      members: people.map((p) => ({ id: p.id, name: p.name })),
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

    if (result.topic) setTopic(result.topic);
    if (result.finish) {
      setQuestion(result.question || 'The panel has enough evidence for this defense.');
      setCurrentMember(clientId);
      setAiBusy(false);
      await sendEvent('answer', {
        answer: item,
        nextMember: clientId,
        nextQuestion: result.question || 'The panel has enough evidence for this defense.',
        topic: result.topic || topic,
      });
      return;
    }

    const nextMember = people.some((p) => p.id === result.nextMember)
      ? result.nextMember
      : people[(people.findIndex((p) => p.id === clientId) + 1) % people.length]?.id || clientId;
    const nextQuestion = result.question || 'Please clarify your previous answer and provide the evidence supporting it.';

    setCurrentMember(nextMember);
    setQuestion(nextQuestion);
    setTopic(result.topic || topic);
    setAiBusy(false);

    await sendEvent('answer', {
      answer: item,
      nextMember,
      nextQuestion,
      topic: result.topic || topic,
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
      <header className="defend-top"><button className="defend-back" onClick={() => setScreen('home')}>← Exit</button><strong>DEFEND</strong><span className={status === 'SYNCED' ? 'defend-sync' : 'defend-sync warn'}>● {status}</span><b>{room}</b></header>
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
    </section>
  );

  return (
    <section className="defend-shell">
      <header className="defend-top"><button className="defend-back" onClick={() => setScreen('home')}>← Exit</button><strong>DEFEND · LIVE</strong><span className={status === 'SYNCED' ? 'defend-sync' : 'defend-sync warn'}>● {status}</span><b>{room}</b></header>
      <div className="defend-room">
        <aside className="defend-card defend-sidebar">
          <div className="defend-side-title">THESIS TEAM <span>{participants.length} online</span></div>
          {participants.map((person) => <div className={person.id === currentMember ? 'defend-member active' : 'defend-member'} key={person.id}><i>{initials(person.name)}</i><div><strong>{person.name}</strong><small>{person.id === currentMember ? 'ANSWERING NOW' : 'ONLINE'}</small></div></div>)}
          <label>LANGUAGE<select value={language} onChange={async (e) => { const value = e.target.value; setLanguage(value); await sendEvent('settings', { language: value, style }); }}><option value="taglish">🇵🇭 Taglish</option><option value="tagalog">🇵🇭 Tagalog</option><option value="english">🇺🇸 English</option></select></label>
          <label>STYLE<select value={style} onChange={async (e) => { const value = e.target.value; setStyle(value); await sendEvent('settings', { language, style: value }); }}><option value="aggressive">🔥 Aggressive</option><option value="balanced">⚖️ Balanced</option><option value="technical">🧠 Technical</option><option value="formal">🎓 Formal</option></select></label>
          <div className="defend-topic-mini"><small>THESIS TOPIC</small><strong>{topic || THESIS_FALLBACK}</strong></div>
        </aside>
        <main>
          <div className="defend-thesis"><small>LIVE DEFENSE · SHARED TOPIC</small><strong>{topic || THESIS_FALLBACK}</strong></div>
          <section className="defend-panel">
            <div className="defend-panel-meta">● AI PANELIST · {language.toUpperCase()} <em>{aiBusy ? 'Analyzing the group…' : 'Listening to the entire defense'}</em></div>
            <h1>{question || OPENING_QUESTION}</h1>
            <div className="defend-attack"><b>{aiBusy ? 'AI THINKING' : 'ADAPTIVE ATTACK'}</b><span>{aiBusy ? 'The panel is analyzing the latest answer and the full group transcript before choosing its next target.' : 'The panel uses the group’s previous answers to target unsupported claims, contradictions, and methodology gaps.'}</span></div>
          </section>
          <section className="defend-answer defend-card">
            <div><small>ANSWERING</small><strong>{currentName}</strong></div>
            <span className="defend-turn">{currentMember === clientId ? 'YOUR TURN' : 'WATCHING'}</span>
            <textarea disabled={currentMember !== clientId || aiBusy} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={currentMember === clientId ? 'Your answer is shared with everyone in the room…' : 'Wait for your turn…'} />
            <button className="defend-primary wide" disabled={currentMember !== clientId || !answer.trim() || aiBusy} onClick={submitAnswer}>{aiBusy ? 'AI is analyzing…' : 'Submit to AI panel →'}</button>
            {aiError && <div className="defend-error">{aiError}</div>}
          </section>
          <section className="defend-chat-grid">
            <div className="defend-chat defend-card">
              <div className="defend-chat-head"><div><strong>AI PANEL CHAT</strong><small>Visible to the AI · use this to address the panel</small></div><span>AI SEES THIS</span></div>
              <div className="defend-chat-messages">
                {panelChat.map((item) => <div className={item.ai ? 'defend-chat-msg ai' : 'defend-chat-msg'} key={item.id}><b>{item.ai ? 'AI PANEL' : item.name}</b><p>{item.text}</p></div>)}
                {!panelChat.length && <div className="defend-empty">Ask the panel something. The AI can see this chat together with the defense transcript.</div>}
              </div>
              <div className="defend-chat-compose"><input value={panelMessage} onChange={(e) => setPanelMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendPanelMessage()} placeholder="Talk to the AI panel…" disabled={panelBusy}/><button onClick={sendPanelMessage} disabled={!panelMessage.trim() || panelBusy}>Send</button></div>
            </div>
            <div className="defend-chat defend-card">
              <div className="defend-chat-head"><div><strong>TEAM CHAT</strong><small>For your group only · AI cannot see this</small></div><span>AI BLIND</span></div>
              <div className="defend-chat-messages">
                {teamChat.map((item) => <div className="defend-chat-msg team" key={item.id}><b>{item.name}</b><p>{item.text}</p></div>)}
                {!teamChat.length && <div className="defend-empty">Chitchat here. Discuss how to answer without feeding the AI your strategy.</div>}
              </div>
              <div className="defend-chat-compose"><input value={teamMessage} onChange={(e) => setTeamMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendTeamMessage()} placeholder="Talk to your group…"/><button onClick={sendTeamMessage} disabled={!teamMessage.trim()}>Send</button></div>
            </div>
          </section>
          <section className="defend-feed defend-card">
            <div className="defend-feed-head">LIVE DEFENSE FEED <span>Shared with the entire group</span></div>
            {transcript.length ? [...transcript].reverse().map((item) => <article key={item.id}><i>{initials(memberMap[item.member]?.name || (item.member === clientId ? name : 'Member'))}</i><div><strong>{memberMap[item.member]?.name || (item.member === clientId ? name : 'Member')}</strong><p>{item.answer}</p></div></article>) : <div className="defend-empty">No answers yet. The AI is waiting for the opening topic.</div>}
          </section>
        </main>
      </div>
    </section>
  );
}
