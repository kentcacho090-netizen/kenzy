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
  const language = String(payload.currentMember?.language || payload.language || 'taglish').toLowerCase();
  const topic = String(payload.topic || '').trim();
  const focus = answer ? answer.slice(0, 180) : topic.slice(0, 180);

  if (language === 'english') {
    return focus
      ? `You said “${focus}”. What specific evidence supports that claim, and what is the main limitation or assumption that could make your conclusion wrong?`
      : 'What is the weakest assumption in your study, and what evidence would you use to defend it?';
  }

  if (language === 'tagalog') {
    return focus
      ? `Sinabi ninyo na “${focus}”. Anong specific evidence ang sumusuporta rito, at ano ang pangunahing limitation o assumption na puwedeng magpahina sa conclusion ninyo?`
      : 'Ano ang pinakamahinang assumption sa study ninyo, at anong evidence ang gagamitin ninyo para ipagtanggol ito?';
  }

  return focus
    ? `Okay, sinabi ninyo na “${focus}”. Anong specific evidence ang sumusuporta rito, at ano ang pinaka-critical na limitation o assumption na puwedeng magpabagsak sa conclusion ninyo?`
    : 'Okay, ano ang pinaka-mahinang assumption sa study ninyo, at paano ninyo mapapatunayang valid iyon?';
}

export async function askPanel(payload = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9500);
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
