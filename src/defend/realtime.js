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
  const answer = String(payload.latestAnswer || '').trim();
  const question = String(payload.currentQuestion || '').trim();
  const language = String(payload.currentMember?.language || payload.language || 'taglish').toLowerCase();
  const lower = answer.toLowerCase();

  if (/predict|prediction|predictive|early warning|before failure/i.test(lower) || /predict|predictive|early warning/i.test(question)) {
    if (language === 'english') return 'Wait. You are calling this predictive maintenance, but if the system only reacts after the abnormal waveform or temperature appears, that is detection, not prediction. What exactly happens before the event that lets you call this predictive?';
    if (language === 'tagalog') return 'Wait lang. Tinatawag ninyo itong predictive maintenance, pero kung nagre-react lang ang system pagkatapos lumitaw ang abnormal waveform o temperature, detection iyon, hindi prediction. Ano mismo ang nangyayari bago ang event na nagpapatunay na predictive talaga ang system?';
    return 'Wait lang. Tinatawag ninyo itong predictive maintenance, pero kung nagre-react lang ang system pagkatapos lumitaw ang abnormal waveform or temperature, detection iyon, hindi prediction. Ano mismo ang nangyayari bago ang event na nagpapatunay na predictive talaga ang system?';
  }

  if (/temperature|thermal|heat/i.test(lower)) {
    if (language === 'english') return 'But temperature alone is not enough. Suppose the breaker gets hotter because the household suddenly draws more current while the breaker is healthy. What in your method tells those two cases apart?';
    if (language === 'tagalog') return 'Pero hindi sapat na umiinit lang ang breaker. Halimbawa, tumaas ang temperature dahil biglang lumaki ang current load pero healthy naman ang breaker. Paano ihihiwalay ng method ninyo ang dalawang sitwasyong iyon?';
    return 'Pero hindi sapat na umiinit lang ang breaker. Halimbawa, tumaas ang temperature dahil biglang lumaki ang current load pero healthy naman ang breaker. Paano ihihiwalay ng method ninyo ang dalawang sitwasyong iyon?';
  }

  if (/waveform|rms|voltage|current|sampling|sample rate|frequency/i.test(lower)) {
    if (language === 'english') return 'Okay, but that waveform can change even when the breaker is healthy. If another appliance suddenly changes the load, what stops your system from calling that a breaker fault?';
    if (language === 'tagalog') return 'Okay, pero puwedeng magbago ang waveform kahit healthy ang breaker. Kung biglang nagbago ang load dahil sa ibang appliance, ano ang pumipigil sa system ninyo na tawagin iyong breaker fault?';
    return 'Okay, pero puwedeng magbago ang waveform kahit healthy ang breaker. Kung biglang nagbago ang load dahil sa ibang appliance, ano ang pumipigil sa system ninyo na tawagin iyong breaker fault?';
  }

  if (/ai|model|dataset|training|classification|accuracy|precision|recall|false negative|false positive/i.test(lower)) {
    if (language === 'english') return 'You said the AI can recognize the condition. But what happens when the breaker and load combination is different from anything in training? Why should the model recognize the fault instead of treating it as normal?';
    if (language === 'tagalog') return 'Sabi ninyo kayang i-recognize ng AI ang condition. Pero paano kung ibang breaker at load combination ang gamitin na wala sa training data? Bakit ninyo aasahang makikilala pa rin ng model ang fault at hindi niya iyon ituring na normal?';
    return 'Sabi ninyo kayang i-recognize ng AI ang condition. Pero paano kung ibang breaker and load combination ang gamitin na wala sa training data? Bakit ninyo aasahang makikilala pa rin ng model ang fault at hindi niya iyon ituring na normal?';
  }

  if (/esp32|microcontroller|api|cloud|internet|wifi|edge ai|latency/i.test(lower)) {
    if (language === 'english') return 'Okay, but what happens at the exact moment the API or Wi-Fi goes down while the breaker condition is changing? Does the safety-critical part still decide locally, or does the system simply wait?';
    if (language === 'tagalog') return 'Okay, pero ano ang mangyayari sa exact moment na mawalan ng API o Wi-Fi habang nagbabago ang condition ng breaker? Magde-decide pa rin ba locally ang safety-critical part, o maghihintay lang ang system?';
    return 'Okay, pero ano ang mangyayari sa exact moment na mawalan ng API or Wi-Fi habang nagbabago ang condition ng breaker? Magde-decide pa rin ba locally ang safety-critical part, or maghihintay lang ang system?';
  }

  if (/deteriorat|abnormal|breaker|fault|failure|overheat|trip/i.test(lower)) {
    if (language === 'english') return 'Okay, but you said you want to identify a breaker problem. How will you know the signal change came from the breaker itself and not simply from a heavier load producing the same waveform or temperature change?';
    if (language === 'tagalog') return 'Okay, pero sinabi ninyo na gusto ninyong ma-identify ang breaker problem. Paano ninyo malalaman na galing talaga sa breaker ang signal change at hindi lang sa mas mabigat na load na puwedeng mag-produce ng parehong waveform o temperature change?';
    return 'Okay, pero sinabi ninyo na gusto ninyong ma-identify ang breaker problem. Paano ninyo malalaman na galing talaga sa breaker ang signal change at hindi lang sa mas mabigat na load na puwedeng mag-produce ng parehong waveform or temperature change?';
  }

  const focus = answer.replace(/\\s+/g, ' ').slice(0, 180);
  if (focus) {
    if (language === 'english') return 'Okay, you said “' + focus + '.” But let’s say a normal operating condition produces the same result. What specifically in your method separates that from the fault you are claiming to detect?';
    if (language === 'tagalog') return 'Okay, sinabi ninyo na “' + focus + '.” Pero paano kung may normal operating condition na puwedeng mag-produce ng parehong result? Ano mismo sa method ninyo ang naghihiwalay doon sa fault na gusto ninyong ma-detect?';
    return 'Okay, sinabi ninyo na “' + focus + '.” Pero paano kung may normal operating condition na puwedeng mag-produce ng parehong result? Ano mismo sa method ninyo ang naghihiwalay doon sa fault na gusto ninyong ma-detect?';
  }

  return language === 'english'
    ? 'Okay, let’s make this concrete. Suppose the same measurement can happen during normal operation. What would make your system call it a fault?'
    : language === 'tagalog'
      ? 'Okay, gawing concrete natin. Paano kung mangyari rin ang parehong measurement during normal operation? Ano ang magpapatawag sa system ninyo na fault iyon?'
      : 'Okay, gawing concrete natin. Paano kung mangyari rin ang parehong measurement during normal operation? Ano ang magpapatawag sa system ninyo na fault iyon?';
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
