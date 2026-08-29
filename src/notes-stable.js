import { upload } from '@vercel/blob/client';

const MAX_BYTES = 25 * 1024 * 1024;
const INLINE_LIMIT = 3 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PPT_MIME = 'application/vnd.ms-powerpoint';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function page() { return document.querySelector('.notes-page'); }
function titleEl(p) { return p?.querySelector('.note-title'); }
function contentEl(p) { return p?.querySelector('.note-content'); }
function textOf(el) { return (el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function mimeFor(name, fallback) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.pptx')) return PPTX_MIME;
  if (lower.endsWith('.ppt')) return PPT_MIME;
  return fallback;
}

function setReactValue(el, value) {
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

async function api(payload) {
  const response = await fetch('/api/study-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Kenzy could not process this request.');
  return data.result || '';
}

function ensureStatus(p) {
  let el = p.querySelector('.notes-stable-status');
  if (!el) {
    el = document.createElement('div');
    el.className = 'notes-stable-status';
    el.setAttribute('role', 'status');
    p.querySelector('.note-editor')?.appendChild(el);
  }
  return el;
}

function status(p, message, kind = 'info') {
  const el = ensureStatus(p);
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add('visible');
}

function ensureResult(p) {
  let box = p.querySelector('.notes-stable-result');
  if (box) return box;
  box = document.createElement('section');
  box.className = 'notes-stable-result';
  box.innerHTML = `
    <div class="notes-stable-result-head">
      <div><div class="eyebrow">KENZY AI</div><h3>AI result</h3><p class="notes-stable-result-state">Ready.</p></div>
      <div class="notes-stable-result-actions"><button type="button" data-apply>Apply to note</button><button type="button" data-copy>Copy</button></div>
    </div>
    <pre class="notes-stable-result-body"></pre>
  `;
  p.querySelector('.note-editor')?.appendChild(box);

  box.querySelector('[data-apply]').onclick = () => {
    const value = box.querySelector('.notes-stable-result-body')?.textContent || '';
    if (!value.trim()) return;
    setReactValue(contentEl(p), value);
    box.querySelector('.notes-stable-result-state').textContent = 'Applied to your note.';
    status(p, 'AI result applied to your note.', 'success');
  };
  box.querySelector('[data-copy]').onclick = async () => {
    const value = box.querySelector('.notes-stable-result-body')?.textContent || '';
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      box.querySelector('.notes-stable-result-state').textContent = 'Copied.';
    } catch {
      status(p, 'Copy was blocked by the browser.', 'error');
    }
  };
  return box;
}

async function runAi(p, action) {
  const content = contentEl(p)?.value?.trim() || '';
  if (!content) return status(p, 'Write some notes first, then choose an AI action.', 'error');
  const box = ensureResult(p);
  box.classList.add('visible', 'working');
  box.querySelector('.notes-stable-result-state').textContent = 'Kenzy is working on your notes…';
  box.querySelector('.notes-stable-result-body').textContent = '';
  try {
    const result = await api({ action, title: titleEl(p)?.value || 'Untitled note', content });
    box.querySelector('.notes-stable-result-body').textContent = result;
    box.querySelector('.notes-stable-result-state').textContent = 'Finished. Review before applying.';
    status(p, 'Kenzy finished processing your note.', 'success');
  } catch (error) {
    box.querySelector('.notes-stable-result-state').textContent = 'Something went wrong.';
    status(p, error.message || 'Kenzy could not process the note.', 'error');
  } finally {
    box.classList.remove('working');
  }
}

function bindAiButtons(p) {
  const actions = [
    ['summarize', 'Summarize these notes into concise, high-value revision points.'],
    ['simplify', 'Rewrite these notes in simple, clear student-friendly language without removing important facts.'],
    ['study guide', 'Turn these notes into a structured study guide with headings, key ideas, definitions, and review prompts.'],
  ];
  for (const [label, action] of actions) {
    const button = Array.from(p.querySelectorAll('.ai-tool-buttons button')).find((b) => textOf(b) === label);
    if (!button || button.dataset.notesStableBound === '1') continue;
    button.dataset.notesStableBound = '1';
    button.onclick = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      runAi(p, action);
    };
  }
}

function addToolbar(p) {
  if (p.querySelector('.notes-stable-toolbar')) return;
  const editor = p.querySelector('.note-editor');
  if (!editor) return;
  const toolbar = document.createElement('div');
  toolbar.className = 'notes-stable-toolbar';
  toolbar.innerHTML = `
    <div><div class="eyebrow">STUDY MATERIAL</div><strong>Import or export your notes</strong><span>Bring a PDF, PowerPoint, or image into this note, or save your finished notes as a PDF.</span></div>
    <div class="notes-stable-toolbar-actions">
      <button type="button" data-import>📎 Import file</button>
      <button type="button" data-export>⇩ Export PDF</button>
      <input type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,image/png,image/jpeg,image/webp,.pdf,.ppt,.pptx" multiple hidden />
    </div>
  `;
  editor.insertBefore(toolbar, editor.firstChild);
  const input = toolbar.querySelector('input');
  toolbar.querySelector('[data-import]').onclick = () => input.click();
  toolbar.querySelector('[data-export]').onclick = () => exportPdf(p);
  input.onchange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await importFiles(p, files);
  };
}

async function importFiles(p, files) {
  if (!files.length) return;
  const allowedFiles = files.filter((file) => ALLOWED.has(mimeFor(file.name, file.type)));
  if (allowedFiles.length !== files.length) return status(p, 'Use PDF, PPT, PPTX, JPG/JPEG, PNG, or WebP files only.', 'error');
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_BYTES) return status(p, 'The combined import is larger than 25 MB.', 'error');
  status(p, `Reading ${files.length > 1 ? `${files.length} files` : files[0].name} with Kenzy…`, 'working');
  try {
    const title = files.length === 1
      ? files[0].name.replace(/\.[^.]+$/, '') || 'Imported note'
      : `${files.length} imported study files`;
    let payload;
    const normalized = files.map((file) => ({ name: file.name, mimeType: mimeFor(file.name, file.type), file }));
    if (total <= INLINE_LIMIT) {
      payload = {
        action: 'Import these files as clean, editable study notes. Preserve headings, definitions, formulas, examples, lists, and important details. Combine related content without inventing facts.',
        title,
        files: await Promise.all(normalized.map(async ({ name, mimeType, file }) => ({ name, mimeType, data: await readBase64(file) }))),
      };
    } else {
      const uploaded = [];
      for (const { name, mimeType, file } of normalized) {
        const result = await upload(`notes-material/${crypto.randomUUID()}-${name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100)}`, file, {
          access: 'private',
          handleUploadUrl: '/api/blob-upload',
          multipart: file.size > 5 * 1024 * 1024,
        });
        uploaded.push({ pathname: result.pathname, name, mimeType });
      }
      payload = {
        action: 'Import these files as clean, editable study notes. Preserve headings, definitions, formulas, examples, lists, and important details. Combine related content without inventing facts.',
        title,
        blobFiles: uploaded,
      };
    }
    const result = await api(payload);
    setReactValue(titleEl(p), title);
    setReactValue(contentEl(p), result);
    ensureResult(p).classList.remove('visible');
    status(p, `${files.length > 1 ? 'Files' : files[0].name} imported. Your note is editable now.`, 'success');
  } catch (error) {
    status(p, error.message || 'Could not import those files.', 'error');
  }
}

async function exportPdf(p) {
  const content = contentEl(p)?.value || '';
  if (!content.trim()) return status(p, 'Add some note content before exporting.', 'error');
  try {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    let y = 70;
    const width = 595.28 - margin * 2;
    const title = titleEl(p)?.value?.trim() || 'StudyKen note';
    pdf.setTextColor(20, 24, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(title.slice(0, 90), margin, y);
    y += 30;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    for (const line of pdf.splitTextToSize(content, width)) {
      if (y > 760) { pdf.addPage(); y = 60; }
      pdf.text(line, margin, y);
      y += 17;
    }
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(110);
      pdf.text(`StudyKen · ${i} / ${pages}`, margin, 806);
    }
    pdf.save(`${title.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'studyken-note'}.pdf`);
    status(p, 'Your note was exported as a PDF.', 'success');
  } catch (error) {
    status(p, error.message || 'Could not export the note as PDF.', 'error');
  }
}

function removeQuizAccessOnNotes(p) {
  if (p) document.getElementById('kenzy-visibility-panel')?.remove();
}

function ensurePage() {
  const p = page();
  if (!p) return;
  if (p.dataset.notesStableReady === '1') return removeQuizAccessOnNotes(p);
  addToolbar(p);
  bindAiButtons(p);
  ensureResult(p);
  p.addEventListener('paste', async (event) => {
    const file = Array.from(event.clipboardData?.files || []).find((item) => ALLOWED.has(mimeFor(item.name, item.type)));
    if (!file) return;
    event.preventDefault();
    await importFiles(p, [file]);
  });
  p.dataset.notesStableReady = '1';
  removeQuizAccessOnNotes(p);
}

function boot() {
  if (window.__kenzyNotesStableBooted) return;
  window.__kenzyNotesStableBooted = true;
  ensurePage();
  window.setInterval(ensurePage, 500);
}

boot();
