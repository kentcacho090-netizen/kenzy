import { upload } from '@vercel/blob/client';

const MAX_BYTES = 25 * 1024 * 1024;
const INLINE_LIMIT = 3 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function base64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function setReactValue(element, value) {
  if (!element) return;
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function getPage() { return document.querySelector('.notes-page'); }
function getTitle(page) { return page?.querySelector('.note-title'); }
function getContent(page) { return page?.querySelector('.note-content'); }
function buttonText(button) { return button?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || ''; }

function ensureStatus(page) {
  let status = page.querySelector('.notes-fix-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'notes-fix-status';
    status.setAttribute('role', 'status');
    page.querySelector('.note-editor')?.appendChild(status);
  }
  return status;
}

function showStatus(page, text, kind = 'info') {
  const status = ensureStatus(page);
  status.textContent = text;
  status.dataset.kind = kind;
  status.classList.add('visible');
}

function ensureAiPanel(page) {
  let panel = page.querySelector('.notes-fix-ai-panel');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.className = 'notes-fix-ai-panel';
  panel.innerHTML = `
    <div class="notes-fix-ai-head">
      <div><div class="eyebrow">KENZY AI</div><h3>AI suggestion</h3><p class="notes-fix-ai-status">Ready.</p></div>
      <div class="notes-fix-ai-actions"><button type="button" data-notes-apply>Apply to note</button><button type="button" data-notes-copy>Copy</button></div>
    </div>
    <pre class="notes-fix-ai-result"></pre>
  `;
  page.querySelector('.note-editor')?.appendChild(panel);
  panel.querySelector('[data-notes-apply]').addEventListener('click', () => {
    const result = panel.querySelector('.notes-fix-ai-result')?.textContent || '';
    if (!result.trim()) return;
    setReactValue(getContent(page), result);
    showStatus(page, 'AI result applied to your note.', 'success');
  });
  panel.querySelector('[data-notes-copy]').addEventListener('click', async () => {
    const result = panel.querySelector('.notes-fix-ai-result')?.textContent || '';
    if (!result.trim()) return;
    try {
      await navigator.clipboard.writeText(result);
      showStatus(page, 'AI result copied.', 'success');
    } catch {
      showStatus(page, 'Copy was blocked by your browser.', 'error');
    }
  });
  return panel;
}

async function callNotesApi(payload) {
  const response = await fetch('/api/study-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Kenzy could not process this request.');
  return data.result || '';
}

async function runAi(page, action) {
  const content = getContent(page)?.value?.trim() || '';
  const title = getTitle(page)?.value?.trim() || 'Untitled note';
  if (!content) {
    showStatus(page, 'Write some notes first, then choose an AI action.', 'error');
    return;
  }
  const panel = ensureAiPanel(page);
  panel.classList.add('visible', 'working');
  panel.querySelector('.notes-fix-ai-status').textContent = 'Kenzy is working on your notes…';
  try {
    const result = await callNotesApi({ action, title, content });
    panel.querySelector('.notes-fix-ai-result').textContent = result;
    panel.querySelector('.notes-fix-ai-status').textContent = 'Finished. Review before applying.';
    showStatus(page, 'Kenzy finished processing your note.', 'success');
  } catch (error) {
    panel.querySelector('.notes-fix-ai-result').textContent = '';
    panel.querySelector('.notes-fix-ai-status').textContent = 'Something went wrong.';
    showStatus(page, error.message || 'Kenzy could not process the note.', 'error');
  } finally {
    panel.classList.remove('working');
  }
}

function buildToolbar(page) {
  if (page.querySelector('.notes-fix-toolbar')) return;
  const editor = page.querySelector('.note-editor');
  if (!editor) return;
  const toolbar = document.createElement('div');
  toolbar.className = 'notes-fix-toolbar';
  toolbar.innerHTML = `
    <div class="notes-fix-toolbar-copy"><div class="eyebrow">TOOLS</div><strong>Bring your study material with you</strong><span>Import a PDF or image into this note, or export your finished notes as a PDF.</span></div>
    <div class="notes-fix-toolbar-actions">
      <button type="button" class="notes-fix-import">＋ Import PDF / image</button>
      <button type="button" class="notes-fix-export">⇩ Export PDF</button>
      <input class="notes-fix-input" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden />
    </div>
  `;
  editor.insertBefore(toolbar, editor.firstChild);
  toolbar.querySelector('.notes-fix-import').addEventListener('click', () => toolbar.querySelector('.notes-fix-input')?.click());
  toolbar.querySelector('.notes-fix-export').addEventListener('click', () => exportPdf(page));
  toolbar.querySelector('.notes-fix-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await importFile(page, file);
  });
}

async function importFile(page, file) {
  if (!ALLOWED.has(file.type)) {
    showStatus(page, 'Use PDF, PNG, JPG, or WebP files only.', 'error');
    return;
  }
  if (file.size > MAX_BYTES) {
    showStatus(page, 'That file is larger than 25 MB.', 'error');
    return;
  }
  showStatus(page, `Reading ${file.name} with Kenzy…`, 'working');
  try {
    const title = file.name.replace(/\.[^.]+$/, '') || 'Imported note';
    let payload;
    if (file.size <= INLINE_LIMIT) {
      payload = { action: 'Import this study file into clean, editable study notes. Preserve useful headings, definitions, formulas, examples, and important details.', title, files: [{ name: file.name, mimeType: file.type, data: await base64(file) }] };
    } else {
      const uploaded = await upload(`notes-material/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100)}`, file, {
        access: 'private',
        handleUploadUrl: '/api/blob-upload',
        multipart: file.size > 5 * 1024 * 1024,
      });
      payload = { action: 'Import this study file into clean, editable study notes. Preserve useful headings, definitions, formulas, examples, and important details.', title, blobFiles: [{ pathname: uploaded.pathname, name: file.name, mimeType: file.type }] };
    }
    const result = await callNotesApi(payload);
    setReactValue(getTitle(page), title);
    setReactValue(getContent(page), result);
    showStatus(page, `Imported ${file.name}. The note is editable now.`, 'success');
    ensureAiPanel(page).classList.remove('visible');
  } catch (error) {
    showStatus(page, error.message || 'Could not import that file.', 'error');
  }
}

async function exportPdf(page) {
  const title = getTitle(page)?.value?.trim() || 'Kenzy note';
  const content = getContent(page)?.value || '';
  if (!content.trim()) {
    showStatus(page, 'Add some note content before exporting.', 'error');
    return;
  }
  try {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 50;
    const width = 595.28 - margin * 2;
    let y = 70;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(title.slice(0, 100), margin, y);
    y += 32;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(content, width);
    for (const line of lines) {
      if (y > 770) { pdf.addPage(); y = 60; }
      pdf.text(line, margin, y);
      y += 17;
    }
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(110);
      pdf.text(`Kenzy · ${i} / ${pages}`, margin, 810);
    }
    pdf.save(`${title.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'kenzy-note'}.pdf`);
    showStatus(page, 'Your note PDF is ready.', 'success');
  } catch (error) {
    showStatus(page, error.message || 'Could not export the note as PDF.', 'error');
  }
}

function replaceAiButtons(page) {
  const mappings = [
    ['summarize', 'Summarize these study notes into concise revision points with the most important facts.'],
    ['simplify', 'Rewrite these study notes in simple, beginner-friendly language without removing important facts or terminology.'],
    ['study guide', 'Turn these study notes into a structured study guide with headings, key ideas, definitions, formulas, and review prompts.'],
  ];
  const buttons = Array.from(page.querySelectorAll('.ai-tool-buttons button'));
  for (const [label, action] of mappings) {
    const original = buttons.find((button) => buttonText(button) === label);
    if (!original || original.dataset.notesFixBound === '1') continue;
    const replacement = original.cloneNode(true);
    replacement.dataset.notesFixBound = '1';
    original.replaceWith(replacement);
    replacement.addEventListener('click', () => runAi(page, action));
  }
}

function init() {
  const page = getPage();
  if (!page) return;
  buildToolbar(page);
  replaceAiButtons(page);
  ensureAiPanel(page);
}

function boot() {
  init();
  window.setInterval(init, 1000);
}

boot();
