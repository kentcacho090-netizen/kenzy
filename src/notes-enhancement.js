const MAX_BYTES = 25 * 1024 * 1024;
const INLINE_LIMIT = 3 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const POLL_MS = 400;

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function setValue(element, value) {
  if (!element) return;
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function buttonText(button) {
  return (button?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function findButton(page, text) {
  return Array.from(page.querySelectorAll('button')).find((button) => buttonText(button) === text);
}

function getEditor(page) {
  return page.querySelector('.note-content');
}

function getTitle(page) {
  return page.querySelector('.note-title');
}

function setWorking(panel, text) {
  panel.classList.add('visible', 'working');
  panel.querySelector('.notes-live-status').textContent = text;
  panel.querySelector('.notes-live-result').textContent = '';
}

function showResult(panel, text, status) {
  panel.classList.add('visible');
  panel.classList.remove('working');
  panel.querySelector('.notes-live-status').textContent = status;
  panel.querySelector('.notes-live-result').textContent = text;
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

function ensurePanel(page) {
  let panel = page.querySelector('.notes-live-panel');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.className = 'notes-live-panel';
  panel.innerHTML = `
    <div class="notes-live-head">
      <div><div class="eyebrow">KENZY AI</div><h3>AI result</h3><p class="notes-live-status">Ready when you are.</p></div>
      <div class="notes-live-actions"><button type="button" class="notes-live-apply">Apply to note</button><button type="button" class="notes-live-copy">Copy</button></div>
    </div>
    <pre class="notes-live-result"></pre>
  `;
  page.querySelector('.note-editor')?.appendChild(panel);
  panel.querySelector('.notes-live-apply').onclick = () => {
    const value = panel.querySelector('.notes-live-result')?.textContent || '';
    if (!value.trim()) return;
    setValue(getEditor(page), value);
    panel.querySelector('.notes-live-status').textContent = 'Applied to your note.';
  };
  panel.querySelector('.notes-live-copy').onclick = async () => {
    const value = panel.querySelector('.notes-live-result')?.textContent || '';
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      panel.querySelector('.notes-live-status').textContent = 'Copied.';
    } catch {
      panel.querySelector('.notes-live-status').textContent = 'Copy was blocked by the browser.';
    }
  };
  return panel;
}

async function runAi(page, action) {
  const content = getEditor(page)?.value?.trim() || '';
  const panel = ensurePanel(page);
  if (!content) return showResult(panel, 'Write some notes first, then ask Kenzy to work on them.', 'Nothing to process yet.');
  setWorking(panel, 'Kenzy is working on your notes…');
  try {
    const result = await api({ action, title: getTitle(page)?.value || 'Untitled note', content });
    showResult(panel, result, 'Kenzy finished. Review the result before applying it.');
  } catch (error) {
    showResult(panel, error.message || 'Could not process the note.', 'Something went wrong.');
  }
}

async function importFile(page, file) {
  const panel = ensurePanel(page);
  if (!ALLOWED.has(file.type)) return showResult(panel, 'Please choose a PDF, PNG, JPG/JPEG, or WebP file.', 'Unsupported file.');
  if (file.size > MAX_BYTES) return showResult(panel, 'That file is larger than 25 MB.', 'File too large.');
  setWorking(panel, `Reading ${file.name}…`);
  try {
    let payload;
    if (file.size <= INLINE_LIMIT) {
      payload = { action: 'Import this file as clean, editable study notes. Preserve important headings, definitions, formulas, examples, and lists.', title: file.name.replace(/\.[^.]+$/, ''), files: [{ name: file.name, mimeType: file.type, data: await readBase64(file) }] };
    } else {
      const blob = await import('@vercel/blob/client');
      const uploaded = await blob.upload(`notes-material/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100)}`, file, { access: 'private', handleUploadUrl: '/api/blob-upload', multipart: file.size > 5 * 1024 * 1024 });
      payload = { action: 'Import this file as clean, editable study notes. Preserve important headings, definitions, formulas, examples, and lists.', title: file.name.replace(/\.[^.]+$/, ''), blobFiles: [{ pathname: uploaded.pathname, name: file.name, mimeType: file.type }] };
    }
    const result = await api(payload);
    setValue(getTitle(page), file.name.replace(/\.[^.]+$/, ''));
    setValue(getEditor(page), result);
    showResult(panel, result, 'Imported successfully. Your note is editable.');
  } catch (error) {
    showResult(panel, error.message || 'Could not import the file.', 'Import failed.');
  }
}

async function exportPdf(page) {
  const title = getTitle(page)?.value?.trim() || 'Kenzy note';
  const content = getEditor(page)?.value || '';
  const panel = ensurePanel(page);
  if (!content.trim()) return showResult(panel, 'Add some note content before exporting.', 'Nothing to export yet.');
  try {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    const width = 595.28 - margin * 2;
    let y = 72;
    pdf.setTextColor(20, 24, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(title.slice(0, 90), margin, y);
    y += 30;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(content.replace(/\t/g, '    '), width);
    for (const line of lines) {
      if (y > 760) { pdf.addPage(); y = 60; }
      pdf.text(line, margin, y);
      y += 17;
    }
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      pdf.setPage(i); pdf.setFontSize(9); pdf.setTextColor(110); pdf.text(`Kenzy · ${i} / ${pages}`, margin, 806);
    }
    pdf.save(`${title.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'kenzy-note'}.pdf`);
    panel.classList.add('visible'); panel.classList.remove('working'); panel.querySelector('.notes-live-status').textContent = 'PDF exported.'; panel.querySelector('.notes-live-result').textContent = 'Your note was exported successfully.';
  } catch (error) {
    showResult(panel, error.message || 'PDF export failed.', 'Export failed.');
  }
}

function addToolbar(page) {
  if (page.querySelector('.notes-live-toolbar')) return;
  const editor = page.querySelector('.note-editor');
  const title = getTitle(page);
  if (!editor || !title) return;
  const toolbar = document.createElement('div');
  toolbar.className = 'notes-live-toolbar';
  toolbar.innerHTML = `
    <div class="notes-live-tools">
      <button type="button" class="notes-import">📎 Import PDF / image</button>
      <button type="button" class="notes-export">⇩ Export PDF</button>
      <input class="notes-import-input" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden />
    </div>
    <span>Bring a study file into your notes, or export your finished notes as a PDF.</span>
  `;
  title.insertAdjacentElement('afterend', toolbar);
  const input = toolbar.querySelector('.notes-import-input');
  toolbar.querySelector('.notes-import').onclick = () => input.click();
  toolbar.querySelector('.notes-export').onclick = () => exportPdf(page);
  input.onchange = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) await importFile(page, file); };
}

function bindAiButtons(page) {
  const actions = [
    ['summarize', 'Summarize these notes into concise, high-value revision points.'],
    ['simplify', 'Rewrite these notes in simple, clear student-friendly language without removing important facts.'],
    ['study guide', 'Turn these notes into a structured study guide with headings, key ideas, definitions, and review prompts.'],
  ];
  actions.forEach(([label, action]) => {
    const button = findButton(page, label);
    if (!button || button.dataset.notesLiveBound === '1') return;
    button.dataset.notesLiveBound = '1';
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopImmediatePropagation(); runAi(page, action); });
  });
}

function ensure(page) {
  if (!page) return;
  addToolbar(page);
  bindAiButtons(page);
  ensurePanel(page);
  if (!page.dataset.notesLivePaste) {
    page.dataset.notesLivePaste = '1';
    page.addEventListener('paste', async (event) => {
      const file = Array.from(event.clipboardData?.files || []).find((item) => ALLOWED.has(item.type));
      if (!file) return;
      event.preventDefault();
      await importFile(page, file);
    });
  }
}

function boot() {
  if (window.__kenzyNotesLiveStarted) return;
  window.__kenzyNotesLiveStarted = true;
  const tick = () => ensure(document.querySelector('.notes-page'));
  tick();
  window.setInterval(tick, POLL_MS);
}

boot();
