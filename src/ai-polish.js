const CONV_KEY = 'kenzy-ai-conversations-v2';
const FILE_META_KEY = 'kenzy-ai-file-meta-v2';
const DB_NAME = 'kenzy-ai-files-v2';

const SUPERSCRIPT = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻' };
const SUBSCRIPT = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋' };

function mapChars(value, table) {
  return [...value].map((char) => table[char] || char).join('');
}

function cleanMath(value) {
  let text = String(value);
  text = text.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1 / $2)');
  text = text.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  text = text.replace(/\\text\{([^{}]*)\}/g, '$1');
  text = text.replace(/\\mathrm\{([^{}]*)\}/g, '$1');
  text = text.replace(/\\log_\{([^{}]*)\}/g, (_, sub) => `log${mapChars(sub, SUBSCRIPT)}`);
  text = text.replace(/log_([0-9]+)/g, (_, sub) => `log${mapChars(sub, SUBSCRIPT)}`);
  text = text.replace(/\^\{([^{}]*)\}/g, (_, sup) => mapChars(sup, SUPERSCRIPT));
  text = text.replace(/\^([0-9+-]+)/g, (_, sup) => mapChars(sup, SUPERSCRIPT));
  text = text.replace(/_\{([^{}]*)\}/g, (_, sub) => mapChars(sub, SUBSCRIPT));
  text = text.replace(/_([0-9]+)/g, (_, sub) => mapChars(sub, SUBSCRIPT));
  text = text.replace(/\\(times|cdot)/g, '×');
  text = text.replace(/\\(div)/g, '÷');
  text = text.replace(/\\(pm)/g, '±');
  text = text.replace(/\\(approx)/g, '≈');
  text = text.replace(/\\(leq|le)/g, '≤');
  text = text.replace(/\\(geq|ge)/g, '≥');
  text = text.replace(/\\(neq)/g, '≠');
  text = text.replace(/\\sqrt/g, '√');
  text = text.replace(/\\left|\\right/g, '');
  text = text.replace(/\\([{}])/g, '$1');
  text = text.replace(/[$]/g, '');
  text = text.replace(/\\[()[\]]/g, '');
  text = text.replace(/\\+/g, '');
  return text;
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function formatReadable(value) {
  const clean = cleanMath(value);
  return escapeHtml(clean)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getFile(fileId) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction('files', 'readonly').objectStore('files').get(fileId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

function decorateMessages() {
  document.querySelectorAll('.ai-v2-content').forEach((node) => {
    const source = node.textContent || '';
    const signature = `${source}::readable-v2`;
    if (node.dataset.readable === signature) return;
    node.innerHTML = formatReadable(source);
    node.dataset.readable = signature;
  });
  renderMessageAttachments();
}

function selectedFileMeta() {
  const selected = new Set(loadJson('kenzy-ai-selected-files-v2', []));
  return loadJson(FILE_META_KEY, []).filter((file) => selected.has(file.id)).slice(0, 10).map((file) => ({ id: file.id, name: file.name, type: file.type, size: file.size }));
}

function rememberPendingAttachments() {
  const textarea = document.querySelector('.ai-v2-form textarea');
  if (!textarea) return;
  const prompt = textarea.value.trim();
  if (!prompt) return;
  const attachments = selectedFileMeta();
  if (!attachments.length) return;
  setTimeout(() => {
    const conversations = loadJson(CONV_KEY, []);
    const activeId = localStorage.getItem('kenzy-ai-active-v2');
    const conversation = conversations.find((item) => item.id === activeId);
    if (!conversation) return;
    const message = [...conversation.messages].reverse().find((item) => item.role === 'user' && item.content === prompt && !item.attachments);
    if (!message) return;
    message.attachments = attachments;
    saveJson(CONV_KEY, conversations);
    renderMessageAttachments();
  }, 650);
}

function attachmentMarkup(attachments) {
  const list = attachments || [];
  return list.map((file) => `<span class="ai-v2-inline-attachment" data-file-id="${escapeHtml(file.id)}"><span class="ai-v2-inline-attachment-icon">${file.type?.startsWith('image/') ? 'IMG' : 'PDF'}</span><span><strong>${escapeHtml(file.name)}</strong><small>${file.type?.startsWith('image/') ? 'Image' : 'PDF'} · ${formatSize(file.size)}</small></span></span>`).join('');
}

function renderMessageAttachments() {
  const conversations = loadJson(CONV_KEY, []);
  const activeId = localStorage.getItem('kenzy-ai-active-v2');
  const conversation = conversations.find((item) => item.id === activeId);
  if (!conversation) return;
  const messages = [...document.querySelectorAll('.ai-v2-message.user')];
  messages.forEach((messageNode, index) => {
    const userMessages = conversation.messages.filter((item) => item.role === 'user');
    const messageData = userMessages[index];
    if (!messageData?.attachments?.length) return;
    let holder = messageNode.querySelector('.ai-v2-message-attachments');
    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'ai-v2-message-attachments';
      holder.innerHTML = attachmentMarkup(messageData.attachments);
      messageNode.querySelector('.ai-v2-bubble')?.appendChild(holder);
    }
    messageData.attachments.forEach(async (file, fileIndex) => {
      const chip = holder.querySelector(`[data-file-id="${CSS.escape(file.id)}"]`);
      if (!chip || !file.type?.startsWith('image/')) return;
      if (chip.querySelector('img')) return;
      try {
        const record = await getFile(file.id);
        if (!record?.blob) return;
        const url = URL.createObjectURL(record.blob);
        const image = document.createElement('img');
        image.src = url;
        image.alt = file.name;
        image.className = 'ai-v2-inline-image';
        chip.prepend(image);
        if (fileIndex > -1) image.onload = () => URL.revokeObjectURL(url);
      } catch {}
    });
  });
}

function formatSize(bytes) { return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }

function bind() {
  const form = document.querySelector('.ai-v2-form');
  if (form && form.dataset.polished !== '1') {
    form.dataset.polished = '1';
    form.addEventListener('submit', rememberPendingAttachments, true);
  }
}

let observer;
function boot() {
  if (observer) return;
  observer = new MutationObserver(() => { bind(); decorateMessages(); });
  observer.observe(document.body, { childList: true, subtree: true });
  bind();
  decorateMessages();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
