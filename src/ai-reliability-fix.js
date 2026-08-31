/* Final AI v3 send-button repair. Delegated capture handler replaces the broken send() path. */
(function () {
  if (window.__kenzyAiReliabilityFix) return;
  window.__kenzyAiReliabilityFix = true;

  const DB_NAME = 'studyken-ai-files-v3';
  const META_KEY = 'studyken-ai-file-meta-v3';
  const CONV_KEY = 'studyken-ai-conversations-v3';
  const ACTIVE_KEY = 'studyken-ai-active-v3';
  const SELECTED_KEY = 'studyken-ai-selected-v3';
  const INLINE_LIMIT = 3 * 1024 * 1024;
  const MAX_TOTAL = 25 * 1024 * 1024;
  const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const PPT = 'application/vnd.ms-powerpoint';

  const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const esc = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function format(value) {
    let text = String(value ?? '').replace(/\r\n?/g, '\n').trim();
    if (!text) return '';
    text = esc(text)
      .replace(/^#{1,3}\s+(.+)$/gm, '<strong class="ai-v3-heading">$1</strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g, '<code class="ai-v3-inline-code">$1</code>')
      .replace(/^\s*[-*]\s+(.+)$/gm, '<span class="ai-v3-list-item">• $1</span>')
      .replace(/^\s*\d+[.)]\s+(.+)$/gm, '<span class="ai-v3-list-item">$&</span>')
      .replace(/\n/g, '<br>');
    return text;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files', { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function getFile(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction('files', 'readonly').objectStore('files').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function toBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the attached file.'));
      reader.readAsDataURL(blob);
    });
  }
  function mimeFor(name, fallback) {
    const lower = String(name || '').toLowerCase();
    if (lower.endsWith('.pptx')) return PPTX;
    if (lower.endsWith('.ppt')) return PPT;
    return fallback;
  }

  function setStatus(message, kind) {
    const el = document.querySelector('.ai-v3-status-message');
    if (!el) return;
    el.textContent = message;
    el.dataset.kind = kind || 'info';
    el.classList.add('visible');
  }
  function clearStatus() {
    const el = document.querySelector('.ai-v3-status-message');
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
  }
  function messagesEl() { return document.querySelector('.ai-v3-messages'); }
  function scrollDown() { const el = messagesEl(); if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); }

  function appendMessage(role, content, attachments) {
    const el = messagesEl();
    if (!el) return null;
    const article = document.createElement('article');
    article.className = `ai-v3-message ${role}`;
    const files = (attachments || []).map((a) => `<span>📎 ${esc(a.name)}</span>`).join('');
    article.innerHTML = `<div class="ai-v3-avatar">${role === 'user' ? 'KC' : 'K'}</div><div class="ai-v3-bubble"><div class="ai-v3-label">${role === 'user' ? 'You' : 'StudyKen'}</div><div class="ai-v3-content">${format(content)}</div>${files ? `<div class="ai-v3-message-files">${files}</div>` : ''}</div>`;
    el.appendChild(article);
    scrollDown();
    return article;
  }

  function thinking() {
    const el = messagesEl();
    if (!el) return null;
    const old = el.querySelector('.ai-v3-thinking-message');
    if (old) old.remove();
    const article = document.createElement('article');
    article.className = 'ai-v3-message assistant ai-v3-thinking-message';
    article.innerHTML = '<div class="ai-v3-avatar">K</div><div class="ai-v3-bubble ai-v3-thinking-bubble"><div class="ai-v3-label">StudyKen</div><div class="ai-v3-thinking"><span class="ai-v3-thinking-orb" aria-hidden="true"><i></i><i></i><i></i></span><span class="ai-v3-thinking-text">Kenzy is thinking</span></div></div>';
    el.appendChild(article);
    scrollDown();
    return article;
  }

  async function prepareFiles(ids) {
    const inline = [];
    const blobs = [];
    const attachments = [];
    let total = 0;
    for (const id of ids.slice(0, 10)) {
      const record = await getFile(id);
      if (!record?.blob) continue;
      const mimeType = mimeFor(record.name, record.type);
      total += Number(record.size) || 0;
      attachments.push({ id: record.id, name: record.name, type: mimeType, size: record.size });
      if (record.size <= INLINE_LIMIT) {
        inline.push({ name: record.name, mimeType, data: await toBase64(record.blob) });
      } else {
        const { upload } = await import('@vercel/blob/client');
        const result = await upload(`kenzy-material/${uid()}-${String(record.name).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100)}`, record.blob, {
          access: 'private', handleUploadUrl: '/api/blob-upload', multipart: record.size > 5 * 1024 * 1024,
        });
        blobs.push({ pathname: result.pathname, name: record.name, mimeType, size: record.size });
      }
    }
    if (total > MAX_TOTAL) throw new Error('Keep attached AI material at or below 25 MB combined.');
    return { inline, blobs, attachments };
  }

  async function handleSubmit(form) {
    if (form.dataset.aiReliabilityBusy === '1') return;
    const ta = form.querySelector('textarea');
    const text = ta?.value.trim() || '';
    const selected = load(SELECTED_KEY, []);
    if (!text && !selected.length) {
      ta?.focus();
      return;
    }

    form.dataset.aiReliabilityBusy = '1';
    const sendButton = form.querySelector('.ai-v3-send');
    if (sendButton) { sendButton.disabled = true; sendButton.textContent = 'Thinking…'; }
    clearStatus();
    const wait = thinking();

    try {
      const prepared = await prepareFiles(selected);
      const conversations = load(CONV_KEY, []);
      let activeId = load(ACTIVE_KEY, null);
      let conversation = conversations.find((item) => item.id === activeId);
      if (!conversation) {
        conversation = { id: uid(), title: 'New chat', messages: [{ role: 'assistant', content: 'Hi! I’m StudyKen. What are you studying today?' }], updatedAt: Date.now() };
        activeId = conversation.id;
      }

      const userContent = text || 'Please analyze my attached study material.';
      conversation.messages = Array.isArray(conversation.messages) ? conversation.messages : [];
      conversation.messages.push({ role: 'user', content: userContent, attachments: prepared.attachments });
      if (conversation.title === 'New chat') {
        const base = text || prepared.attachments[0]?.name || 'Study material';
        conversation.title = base.length > 45 ? `${base.slice(0, 45)}…` : base;
      }
      conversation.updatedAt = Date.now();
      save(CONV_KEY, [conversation, ...conversations.filter((x) => x.id !== conversation.id)].slice(0, 50));
      save(ACTIVE_KEY, conversation.id);
      save(SELECTED_KEY, []);

      const payload = {
        messages: conversation.messages.slice(-8).map((m) => ({ role: m.role, content: String(m.content || '') })),
        files: prepared.inline,
        blobFiles: prepared.blobs,
      };
      const response = await fetch('/api/ai-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `AI request failed (${response.status}).`);
      const reply = String(data.reply || '').trim();
      if (!reply) throw new Error('StudyKen returned an empty response.');

      conversation.messages.push({ role: 'assistant', content: reply });
      conversation.updatedAt = Date.now();
      save(CONV_KEY, [conversation, ...load(CONV_KEY, []).filter((x) => x.id !== conversation.id)].slice(0, 50));
      if (wait) wait.remove();
      appendMessage('assistant', reply);
      renderConversationList();
      setStatus('Answer ready.', 'success');
      setTimeout(clearStatus, 1800);
      if (ta) ta.value = '';
    } catch (error) {
      if (wait) wait.remove();
      setStatus(error?.message || 'Kenzy could not complete that request.', 'error');
    } finally {
      form.dataset.aiReliabilityBusy = '0';
      if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send ↵'; }
      scrollDown();
    }
  }

  function renderConversationList() {
    const el = document.querySelector('.ai-v3-conversations');
    if (!el) return;
    const rows = load(CONV_KEY, []);
    const active = load(ACTIVE_KEY, null);
    el.querySelectorAll('[data-open]').forEach((b) => b.classList.toggle('active', b.dataset.open === active));
    if (!rows.length) return;
  }

  function bind() {
    document.addEventListener('submit', (event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form?.matches('.ai-v3-form')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void handleSubmit(form);
    }, true);

    document.addEventListener('keydown', (event) => {
      const ta = event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (!ta?.closest('.ai-v3-form')) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        ta.form?.requestSubmit();
      }
    }, true);

    document.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('.ai-v3-send') : null;
      if (!button) return;
      const form = button.closest('.ai-v3-form');
      if (!form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void handleSubmit(form);
    }, true);
  }

  function style() {
    if (document.getElementById('kenzy-ai-reliability-style')) return;
    const s = document.createElement('style');
    s.id = 'kenzy-ai-reliability-style';
    s.textContent = `
      .ai-v3-send{transition:opacity .16s ease,transform .16s ease}.ai-v3-send:disabled{opacity:.65;cursor:wait}
      .ai-v3-status-message[data-kind=success]{background:rgba(24,162,105,.09)!important;color:#16845b!important}
      .ai-v3-status-message[data-kind=error]{background:rgba(201,62,84,.09)!important;color:var(--danger)!important}
      .ai-v3-thinking{display:flex;align-items:center;gap:10px;min-height:24px;color:var(--muted,#68728a)}
      .ai-v3-thinking-orb{display:inline-flex;gap:4px}.ai-v3-thinking-orb i{width:6px;height:6px;border-radius:50%;background:currentColor;animation:kenzyAiDot 1s infinite ease-in-out}.ai-v3-thinking-orb i:nth-child(2){animation-delay:.14s}.ai-v3-thinking-orb i:nth-child(3){animation-delay:.28s}
      @keyframes kenzyAiDot{0%,70%,100%{opacity:.25;transform:translateY(0)}35%{opacity:1;transform:translateY(-4px)}}
      @media(prefers-reduced-motion:reduce){.ai-v3-thinking-orb i{animation:none}}
    `;
    document.head.appendChild(s);
  }

  function boot() { style(); bind(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
