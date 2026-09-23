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

export async function connectRoom(roomCode, { name, role, onPresence, onEvent, onStatus }) {
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

  channel
    .on('presence', { event: 'sync' }, () => {
      const raw = channel?.presenceState?.() || {};
      const people = Object.entries(raw).flatMap(([id, metas]) =>
        metas.map((meta) => ({ ...meta, id }))
      );
      onPresence?.(people);
    })
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
          joinedAt: new Date().toISOString(),
        });
        if (result !== 'ok') {
          onStatus?.('ERROR');
          finish({ ok: false, reason: 'presence_track_failed' });
          return;
        }
        onStatus?.('SYNCED');
        finish({ ok: true });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onStatus?.('ERROR');
        finish({ ok: false, reason: status });
      }
    });
  });
}

export async function askPanel(payload = {}) {
  try {
    const response = await fetch('/api/defend-panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data?.error || 'Gemini AI request failed.' };
    }
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error: error?.message || 'Could not reach the Gemini AI panel.' };
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
  }
}
