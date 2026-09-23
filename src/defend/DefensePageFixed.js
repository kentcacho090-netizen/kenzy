import React, { useEffect, useMemo, useState } from 'react';
import './DefensePage.css';
import { clientId, connectRoom, disconnectRoom, realtimeConfigured, sendEvent } from './realtime';

const ATTACKS = [
  'Your title says predictive maintenance. What exactly is being predicted, and what evidence proves the system predicts risk before failure rather than detecting an existing fault?',
  'Why do you need AI instead of fixed voltage, current, waveform, or temperature thresholds?',
  'What are the exact input features extracted from the waveform and thermal measurements?',
  'What happens when the model encounters a fault condition that was not represented in its training data?',
  'How will you prevent the model from learning your laboratory setup instead of the underlying electrical behavior?',
  'What is your ground truth, and how is each training sample labeled?',
  'How will you demonstrate that the model generalizes to different residential loads and conditions?',
  'Explain the difference between fault detection, fault classification, and predictive maintenance in your proposed system.',
  'If waveform and temperature disagree, how does your system resolve the conflict?',
  'What is the consequence of a false negative in this application?',
  'Which part of your predictive-maintenance claim can your prototype actually demonstrate, and which part remains a limitation?',
  'Why did you select your sensing hardware and sampling rate?',
  'How will noise, sensor error, and changing household loads affect the model?',
  'Why are your selected fault conditions representative of residential conditions?',
  'What non-AI baseline will you compare against?',
  'Which evaluation metrics will you report, and why are they appropriate?',
  'How large and diverse must your dataset be before you can make a defensible claim about model performance?',
  'How will you communicate uncertainty when the model is confident but potentially wrong?',
  'What is the strongest unsupported assumption your group has made so far?',
  'If the panel removed the AI component, what useful functionality would remain?',
];

const TAGLISH = {
  0: 'Okay, so predictive maintenance yung title ninyo. What exactly is being predicted? And what evidence do you have na kaya niyang mag-predict before failure, instead na dine-detect lang niya yung fault na existing na?',
  1: 'Okay, bakit kailangan ng AI dito instead of using fixed voltage, current, waveform, or temperature thresholds? Ano yung advantage ng AI na wala sa simple threshold approach?',
  3: 'Let’s say may fault condition na wala sa training data ninyo. What exactly happens? Paano magre-respond yung model kapag unseen yung condition?',
  5: 'What is your ground truth, and paano ninyo bina-label each training sample? Ano yung basis na normal siya or faulty?',
  6: 'How will you prove na nagge-generalize yung model sa different residential loads and conditions, hindi lang sa exact setup ninyo?',
  7: 'Can you clearly explain the difference between fault detection, fault classification, and predictive maintenance? Kasi these are not the same thing, so saan exactly pumapasok yung system ninyo?',
  10: 'Alin sa predictive-maintenance claim ninyo ang kaya talagang ipakita ng prototype, at alin doon ang limitation pa ng study ninyo?',
};

const TAGALOG = {
  0: 'Okay, ang title ninyo ay predictive maintenance. Ano ba talaga ang pini-predict ng system ninyo, at anong ebidensya ang magpapatunay na kaya nitong mag-predict bago mangyari ang failure?',
  1: 'Bakit kailangan pa ninyo ng AI kung puwede namang gumamit ng fixed voltage, current, waveform, o temperature thresholds?',
  3: 'Paano kapag nakakita ang model ng fault condition na wala sa training data ninyo? Ano mismo ang gagawin ng system?',
  7: 'Ano ang pagkakaiba ng fault detection, fault classification, at predictive maintenance sa proposed system ninyo?',
  10: 'Alin sa predictive-maintenance claim ninyo ang kaya talagang ipakita ng prototype, at alin ang limitation pa ng study ninyo?',
};

const THESIS = 'AI-IoT Predictive Maintenance for Residential Breakers via Waveform and Thermal Analysis in Dagupan.';

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'DFND-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function initials(name) {
  return String(name || '??').slice(0, 2).toUpperCase();
}

function questionFor(question, language) {
  const index = ATTACKS.indexOf(question);
  if (language === 'taglish' && TAGLISH[index]) return TAGLISH[index];
  if (language === 'tagalog' && TAGALOG[index]) return TAGALOG[index];
  return question;
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
  const [round, setRound] = useState(1);
  const [currentMember, setCurrentMember] = useState(clientId);
  const [question, setQuestion] = useState(ATTACKS[0]);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const memberMap = useMemo(() => Object.fromEntries(participants.map((p) => [p.id, p])), [participants]);
  const currentName = memberMap[currentMember]?.name || (currentMember === clientId ? name : 'Member');

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
    if (!result.ok) setError(result.reason === 'timeout' ? 'Realtime connection timed out. Check the Supabase variables in Vercel.' : 'Could not connect to the defense room.');
    if (result.ok && !isCreator) await sendEvent('request_snapshot', { requester: clientId });
  }

  function handleEvent(event) {
    if (!event) return;
    if (event.event === 'request_snapshot' && isCreator) {
      sendEvent('snapshot', { round, currentMember, question, transcript, language, style });
    } else if (event.event === 'snapshot' && !isCreator) {
      setRound(event.round);
      setCurrentMember(event.currentMember);
      setQuestion(event.question);
      setTranscript(event.transcript || []);
      setLanguage(event.language || 'taglish');
      setStyle(event.style || 'aggressive');
      setScreen('lobby');
    } else if (event.event === 'start') {
      setRound(event.round);
      setCurrentMember(event.currentMember);
      setQuestion(event.question);
      setLanguage(event.language || language);
      setStyle(event.style || style);
      setScreen('room');
    } else if (event.event === 'answer') {
      setTranscript((items) => items.some((item) => item.id === event.answer.id) ? items : [...items, event.answer]);
      setRound(event.nextRound);
      setCurrentMember(event.nextMember);
      setQuestion(event.nextQuestion);
    } else if (event.event === 'settings') {
      setLanguage(event.language);
      setStyle(event.style);
    }
  }

  function openCreate() {
    setRoom(makeRoomCode());
    setName('You');
    setIsCreator(true);
    setScreen('join');
    setError('');
  }

  function openJoin() {
    setRoom('');
    setIsCreator(false);
    setScreen('join');
    setError('');
  }

  async function enterRoom() {
    const cleanRoom = room.trim().toUpperCase().replace(/\s+/g, '');
    const cleanName = name.trim();
    if (!/^DFND-[A-Z0-9]{4}$/.test(cleanRoom)) return setError('Use a room code like DFND-7K4P.');
    if (cleanName.length < 2) return setError('Enter your name first.');
    setRoom(cleanRoom);
    setName(cleanName.slice(0, 24));
    setParticipants([]);
    setTranscript([]);
    setRound(1);
    setCurrentMember(clientId);
    setQuestion(ATTACKS[0]);
    setScreen('lobby');
    setError('');
    await joinRealtime(cleanRoom);
  }

  async function startDefense() {
    if (!isCreator) return;
    const first = participants[0]?.id || clientId;
    setCurrentMember(first);
    setRound(1);
    setQuestion(ATTACKS[0]);
    setScreen('room');
    await sendEvent('start', { round: 1, currentMember: first, question: ATTACKS[0], language, style });
  }

  async function submitAnswer() {
    const text = answer.trim();
    if (!text || currentMember !== clientId) return;
    const item = { id: crypto.randomUUID(), member: clientId, round, answer: text };
    const people = participants.length ? participants : [{ id: clientId, name }];
    const index = people.findIndex((person) => person.id === clientId);
    const nextMember = people[(index + 1) % people.length]?.id || clientId;
    const nextRound = round + 1;
    const nextQuestion = ATTACKS[Math.min(nextRound - 1, ATTACKS.length - 1)];
    setTranscript((items) => [...items, item]);
    setRound(nextRound);
    setCurrentMember(nextMember);
    setQuestion(nextQuestion);
    setAnswer('');
    await sendEvent('answer', { answer: item, nextRound, nextMember, nextQuestion });
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
        <label>ROOM CODE<input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} placeholder="DFND-7K4P" maxLength={9} /></label>
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
          <h2>Waiting for the defense to start.</h2>
          <p>Everyone joins first. Then the AI panelist takes control.</p>
          <div className="defend-thesis"><small>SHARED THESIS</small><strong>{THESIS}</strong></div>
          <div className="defend-ready">● <div><strong>AI PANELIST READY</strong><span>No human host. The AI chooses targets, follow-ups, and when the defense ends.</span></div></div>
          {status === 'LOCAL_MODE' && <div className="defend-warning">Realtime is not configured yet. Add the Supabase variables to the StudyKen Vercel project to synchronize devices.</div>}
          {status === 'ERROR' || status === 'TIMEOUT' ? <div className="defend-warning">Realtime could not connect. Check the Supabase variables and redeploy.</div> : null}
          <button className="defend-primary wide" disabled={!isCreator} onClick={startDefense}>{isCreator ? 'Start AI Defense →' : 'Waiting for room creator →'}</button>
        </main>
        <aside className="defend-card"><div className="defend-side-title">JOINED MEMBERS <span>{participants.length}</span></div>{participants.map((person) => <div className={person.id === currentMember ? 'defend-member active' : 'defend-member'} key={person.id}><i>{initials(person.name)}</i><div><strong>{person.name}</strong><small>{person.id === clientId ? 'YOU · JOINED' : 'JOINED'}</small></div></div>)}{!participants.length && <div className="defend-empty">Waiting for members…</div>}</aside>
      </div>
    </section>
  );

  return (
    <section className="defend-shell">
      <header className="defend-top"><button className="defend-back" onClick={() => setScreen('home')}>← Exit</button><strong>DEFEND · LIVE</strong><span className="defend-sync">● {status}</span><b>{room}</b></header>
      <div className="defend-room">
        <aside className="defend-card defend-sidebar">
          <div className="defend-side-title">THESIS TEAM <span>{participants.length} online</span></div>
          {participants.map((person) => <div className={person.id === currentMember ? 'defend-member active' : 'defend-member'} key={person.id}><i>{initials(person.name)}</i><div><strong>{person.name}</strong><small>{person.id === currentMember ? 'ANSWERING NOW' : 'ONLINE'}</small></div></div>)}
          <label>LANGUAGE<select value={language} onChange={async (e) => { const value = e.target.value; setLanguage(value); await sendEvent('settings', { language: value, style }); }}><option value="taglish">🇵🇭 Taglish</option><option value="tagalog">🇵🇭 Tagalog</option><option value="english">🇺🇸 English</option></select></label>
          <label>STYLE<select value={style} onChange={async (e) => { const value = e.target.value; setStyle(value); await sendEvent('settings', { language, style: value }); }}><option value="aggressive">🔥 Aggressive</option><option value="balanced">⚖️ Balanced</option><option value="technical">🧠 Technical</option><option value="formal">🎓 Formal</option></select></label>
          <div className="defend-round">ROUND <strong>{round} <small>/ 20</small></strong><div><i style={{ width: Math.min(100, (round / 20) * 100) + '%' }} /></div></div>
        </aside>
        <main>
          <div className="defend-thesis"><small>LIVE DEFENSE · SHARED THESIS</small><strong>{THESIS}</strong></div>
          <section className="defend-panel">
            <div className="defend-panel-meta">● AI PANELIST · {language.toUpperCase()} <em>Question for {currentName}</em></div>
            <h1>{questionFor(question, language)}</h1>
            <div className="defend-attack"><b>ADAPTIVE ATTACK</b><span>The panel uses the group's previous answers to target unsupported claims, contradictions, and methodology gaps.</span></div>
          </section>
          <section className="defend-answer defend-card">
            <div><small>ANSWERING</small><strong>{currentName}</strong></div>
            <span className="defend-turn">{currentMember === clientId ? 'YOUR TURN' : 'WATCHING'}</span>
            <textarea disabled={currentMember !== clientId} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={currentMember === clientId ? 'Your answer is shared with everyone in the room…' : 'Wait for your turn…'} />
            <button className="defend-primary wide" disabled={currentMember !== clientId || !answer.trim()} onClick={submitAnswer}>Submit to AI panel →</button>
          </section>
          <section className="defend-feed defend-card">
            <div className="defend-feed-head">LIVE DEFENSE FEED <span>Shared with the entire group</span></div>
            {transcript.length ? [...transcript].reverse().map((item) => <article key={item.id}><i>{initials(memberMap[item.member]?.name || (item.member === clientId ? name : 'Member'))}</i><div><strong>{memberMap[item.member]?.name || (item.member === clientId ? name : 'Member')} <small>· Round {item.round}</small></strong><p>{item.answer}</p></div></article>) : <div className="defend-empty">No answers yet. The defense has just started.</div>}
          </section>
        </main>
      </div>
    </section>
  );
}
