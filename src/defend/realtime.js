import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL || '';
const key = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || '';
export const realtimeConfigured = Boolean(url && key);

function getClientId() {
  try {
    const saved = localStorage.getItem('defend_client_id');
    if (saved) return saved;
    const id = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'client-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('defend_client_id', id);
    return id;
  } catch {
    return 'client-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export const clientId = getClientId();
const supabase = realtimeConfigured ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

let channel = null;
let presenceState = {};

export async function connectRoom(roomCode, { name, role, language, style, onPresence, onEvent, onStatus }) {
  if (!supabase) {
    onStatus?.('LOCAL_MODE');
    return { ok: false, reason: 'missing_env' };
  }

  if (channel) {
    await supabase.removeChannel(channel);
    channel = null;
  }

  const safeRoom = String(roomCode || '').trim().toUpperCase();
  channel = supabase.channel('defend:' + safeRoom, {
    config: { broadcast: { ack: true }, presence: { key: clientId } },
  });

  const emitPresence = () => {
    const raw = channel?.presenceState?.() || {};
    const people = Object.entries(raw).flatMap(([id, metas]) =>
      metas.map((meta) => ({ ...meta, id }))
    );
    presenceState = Object.fromEntries(people.map((person) => [person.id, person]));
    onPresence?.(people);
  };

  channel
    .on('presence', { event: 'sync' }, emitPresence)
    .on('broadcast', { event: 'defend_event' }, (payload) => {
      onEvent?.(payload?.payload);
    });

  onStatus?.('CONNECTING');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      onStatus?.('TIMEOUT');
      finish({ ok: false, reason: 'timeout' });
    }, 9000);

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const result = await channel.track({
          id: clientId,
          name: String(name || 'Member').trim(),
          role: role || 'member',
          language: String(language || 'taglish'),
          style: String(style || 'aggressive'),
          joinedAt: new Date().toISOString(),
        });
        if (result !== 'ok') {
          onStatus?.('ERROR');
          finish({ ok: false, reason: 'presence_track_failed' });
          return;
        }
        emitPresence();
        onStatus?.('SYNCED');
        finish({ ok: true });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onStatus?.('ERROR');
        finish({ ok: false, reason: status });
      }
    });
  });
}

export async function updateRoomPresence({ name, role, language, style }) {
  if (!channel) return false;
  try {
    const result = await channel.track({
      id: clientId,
      name: String(name || 'Member').trim(),
      role: role || 'member',
      language: String(language || 'taglish'),
      style: String(style || 'aggressive'),
      joinedAt: presenceState[clientId]?.joinedAt || new Date().toISOString(),
    });
    return result === 'ok';
  } catch {
    return false;
  }
}

function localDefenseFallback(payload = {}) {
  const answer = String(payload.latestAnswer || '').replace(/\s+/g, ' ').trim();
  const question = String(payload.currentQuestion || '').replace(/\s+/g, ' ').trim();
  const language = String(payload.currentMember?.language || payload.language || 'taglish').toLowerCase();
  const lower = answer.toLowerCase();

  // This fallback is deliberately thesis-agnostic. It must never turn a
  // temporary AI outage into a hard-coded question about one project's topic.
  if (!answer) {
    if (language === 'english') return 'Wait. I did not get a clear answer to the point I asked. Clarify that specific part first.';
    if (language === 'tagalog') return 'Wait lang. Hindi ko nakuha nang malinaw yung point na tinanong ko. I-clarify muna ninyo yung specific part na iyon.';
    return 'Wait lang. Hindi ko nakuha nang malinaw yung point na tinanong ko. I-clarify muna ninyo yung specific part na iyon.';
  }

  const focus = answer.slice(0, 220);

  if (/because|dahil|kasi|since|therefore|so that|para|which means|ibig sabihin|meaning/i.test(lower)) {
    if (language === 'english') return 'Okay, I follow your reasoning. But what if the same result can happen for a different reason? What observation would distinguish your explanation from that alternative?';
    if (language === 'tagalog') return 'Okay, gets ko yung reasoning ninyo. Pero paano kung mangyari rin yung same result dahil sa ibang dahilan? Anong observation ang maghihiwalay sa explanation ninyo sa alternative na iyon?';
    return 'Okay, gets ko yung reasoning ninyo. Pero what if mangyari rin yung same result dahil sa ibang dahilan? Anong observation ang maghihiwalay sa explanation ninyo sa alternative na iyon?';
  }

  if (/predict|prediction|forecast|early warning|before|future/i.test(lower) || /predict|forecast|early warning/i.test(question.toLowerCase())) {
    if (language === 'english') return 'Wait. You are saying the system knows something before the event. What evidence shows that the information genuinely appears early rather than the system reacting after the change has already started?';
    if (language === 'tagalog') return 'Wait lang. Sinasabi ninyo na may nalalaman ang system bago mangyari ang event. Anong evidence ang magpapakitang nauuna talaga iyon at hindi lang nagre-react ang system pagkatapos magsimula ang change?';
    return 'Wait lang. Sinasabi ninyo na may nalalaman ang system before the event. Anong evidence ang magpapakitang nauuna talaga iyon at hindi lang nagre-react ang system pagkatapos magsimula ang change?';
  }

  if (/accuracy|accurate|effective|reliable|successful|works|improve|better|efficient|performance/i.test(lower)) {
    if (language === 'english') return 'You said the method works well. But what if it works on the cases you tested and fails on a slightly different case? What test would expose that limitation?';
    if (language === 'tagalog') return 'Sinabi ninyo na effective o reliable yung method. Pero paano kung gumana sa mga na-test ninyo tapos bumagsak sa slightly different case? Anong test ang magre-reveal ng limitation na iyon?';
    return 'Sinabi ninyo na effective or reliable yung method. Pero what if gumana sa mga na-test ninyo pero bumagsak sa slightly different case? Anong test ang magre-reveal ng limitation na iyon?';
  }

  if (/dataset|data|sample|respondent|participant|training|model|ai|machine learning|algorithm/i.test(lower)) {
    if (language === 'english') return 'Okay, but your conclusion depends on the data. What if a new case has an important characteristic that your data did not represent? What would make you trust the method on that unseen case?';
    if (language === 'tagalog') return 'Okay, pero naka-depend yung conclusion ninyo sa data. Paano kung may bagong case na may important characteristic na hindi represented sa data ninyo? Ano ang basis ninyo para pagkatiwalaan yung method sa unseen case?';
    return 'Okay, pero naka-depend yung conclusion ninyo sa data. What if may bagong case na may important characteristic na wala sa data ninyo? Ano ang basis ninyo para pagkatiwalaan yung method sa unseen case?';
  }

  if (/sensor|measurement|measure|signal|reading|value|feature|parameter|image/i.test(lower)) {
    if (language === 'english') return 'You are relying on that measurement. But what if another normal condition changes the same measurement? What in your method separates the condition you care about from that ordinary change?';
    if (language === 'tagalog') return 'Umaasa kayo sa measurement na iyan. Pero paano kung may ibang normal condition na nagbabago rin ng parehong measurement? Ano sa method ninyo ang maghihiwalay sa condition na hinahanap ninyo sa normal change na iyon?';
    return 'Umaasa kayo sa measurement na iyan. Pero what if may ibang normal condition na nagbabago rin ng same measurement? Ano sa method ninyo ang maghihiwalay sa condition na hinahanap ninyo sa normal change na iyon?';
  }

  if (/hardware|software|api|server|cloud|wifi|internet|latency|microcontroller|arduino|esp32/i.test(lower)) {
    if (language === 'english') return 'Okay, but that part of the system can fail too. If it becomes unavailable exactly when the system needs it, what happens to your result or decision?';
    if (language === 'tagalog') return 'Okay, pero puwede ring mag-fail yung part na iyan. Kung mawala o mag-fail siya exactly when kailangan ng system, ano ang mangyayari sa result o decision ninyo?';
    return 'Okay, pero puwede ring mag-fail yung part na iyan. What if mawala or mag-fail siya exactly when kailangan ng system? Ano ang mangyayari sa result or decision ninyo?';
  }

  // Last-resort attack: quote the student's actual answer, then introduce one
  // plausible alternative explanation. No sample thesis or project-specific terms.
  if (language === 'english') return 'You said, "' + focus + '". Okay, but suppose a different cause produces the same outcome. What specific test would distinguish your explanation from that alternative?';
  if (language === 'tagalog') return 'Sinabi ninyo, "' + focus + '". Okay, pero paano kung ibang dahilan ang mag-produce ng parehong outcome? Anong specific test ang maghihiwalay sa explanation ninyo sa alternative na iyon?';
  return 'Sinabi ninyo, "' + focus + '". Okay, pero paano kung ibang dahilan ang mag-produce ng parehong outcome? Anong specific test ang maghihiwalay sa explanation ninyo sa alternative na iyon?';
}
export async function askPanel(payload = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10500);
  try {
    const response = await fetch('/api/defend-panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: true,
        question: localDefenseFallback(payload),
        nextMember: payload.currentMember?.id || '',
        topic: payload.topic || payload.latestAnswer || '',
        finish: false,
        degraded: true,
      };
    }
    return { ok: true, ...data, finish: false };
  } catch {
    return {
      ok: true,
      question: localDefenseFallback(payload),
      nextMember: payload.currentMember?.id || '',
      topic: payload.topic || payload.latestAnswer || '',
      finish: false,
      degraded: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendEvent(event, payload = {}) {
  if (!channel) return false;
  try {
    return (await channel.send({
      type: 'broadcast',
      event: 'defend_event',
      payload: { event, ...payload },
    })) === 'ok';
  } catch {
    return false;
  }
}

export async function disconnectRoom() {
  if (channel && supabase) {
    await supabase.removeChannel(channel);
    channel = null;
    presenceState = {};
  }
}
