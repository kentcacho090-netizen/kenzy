import { upload } from '@vercel/blob/client';

const MAX_BYTES = 25 * 1024 * 1024;
const INLINE_LIMIT = 3 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const POLL_MS = 600;

function base64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function safeName(name) {
  return String(name || 'study-file').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100);
}

async function sendToNotesApi(payload) {
  const response = await fetch('/api/study-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Kenzy could not process the note.');
  return data.result || '';
}

function getTitleInput(page) {
  return page.querySelector('input[type="text"]:not(.notes-upgrade-input), input:not([type]):not(.notes-upgrade-input)');
}

function getContentArea(page) {
  return page.querySelector('textarea');
}

function setReactValue(element, value) {
  if (!element) return;
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function textOf(button) {
  return button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
}

function findButton(page, labels) {
  return Array.from(page.querySelectorAll('button')).find((button) => labels.includes(textOf(button)));
}

function addTopControls(page) {
  if (page.querySelector('.notes-upgrade-toolbar')) return;
  const heading = page.querySelector('.section-heading') || page.querySelector('h2')?.parentElement || page.firstElementChild;
  if (!heading) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'notes-upgrade-toolbar';
  toolbar.innerHTML = `
    <div class="notes-upgrade-actions">
      <button type="button" class="notes-upgrade-primary">＋ New note</button>
      <button type="button" class="notes-upgrade-secondary">⇩ Import PDF / image</button>
      <button type="button" class="notes-upgrade-secondary">⇧ Export PDF</button>
      <input class="notes-upgrade-file-input" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden />
    </div>
    <p class="notes-upgrade-hint">Import a PDF or image and Kenzy will turn it into editable study notes.</p>
  `;
  heading.insertAdjacentElement('afterend', toolbar);

  const fileInput = toolbar.querySelector('.notes-upgrade-file-input');
  toolbar.querySelector('.notes-upgrade-primary').addEventListener('click', () => {
    const back = Array.from(page.querySelectorAll('button')).find((b) => textOf(b) === '← back');
    const newButton = Array.from(page.querySelectorAll('button')).find((b) => textOf(b).includes('new note'));
    if (newButton) newButton.click(); else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  toolbar.querySelectorAll('.notes-upgrade-secondary')[0].addEventListener('click', () => fileInput?.click());
  toolbar.querySelectorAll('.notes-upgrade-secondary')[1].addEventListener('click', () => exportPdf(page));
  fileInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await importStudyFile(page, file);
  });
}

function ensureResultPanel(page) {
  let panel = page.querySelector('.notes-upgrade-result');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.className = 'notes-upgrade-result';
  panel.innerHTML = `
    <div class="notes-upgrade-result-head">
      <div><div class="eyebrow">KENZY AI</div><h3>Suggested improvement</h3><p class="notes-upgrade-result-status">Ready when you are.</p></div>
      <div class="notes-upgrade-result-actions">
        <button type="button" class="notes-upgrade-apply">Apply to note</button>
        <button type="button" class="notes-upgrade-copy">Copy result</button>
      </div>
    </div>
    <div class="notes-upgrade-result-body"></div>
  `;
  page.appendChild(panel);
  panel.querySelector('.notes-upgrade-apply').addEventListener('click', () => {
    const area = getContentArea(page);
    const body = panel.querySelector('.notes-upgrade-result-body');
    if (area && body) setReactValue(area, body.textContent || '');
    panel.querySelector('.notes-upgrade-result-status').textContent = 'Applied to your note.';
  });
  panel.querySelector('.notes-upgrade-copy').addEventListener('click', async () => {
    const body = panel.querySelector('.notes-upgrade-result-body');
    if (!body) return;
    try { await navigator.clipboard.writeText(body.textContent || ''); panel.querySelector('.notes-upgrade-result-status').textContent = 'Copied.'; } catch { panel.querySelector('.notes-upgrade-result-status').textContent = 'Copy was blocked by the browser.'; }
  });
  return panel;
}

function showResult(page, result, status = 'Kenzy finished.') {
  const panel = ensureResultPanel(page);
  panel.querySelector('.notes-upgrade-result-status').textContent = status;
  panel.querySelector('.notes-upgrade-result-body').textContent = result;
  panel.classList.add('visible');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function runAction(page, action) {
  const area = getContentArea(page);
  const title = getTitleInput(page)?.value || 'Untitled note';
  const content = area?.value?.trim() || '';
  if (!content) return showResult(page, 'Add some note text first, then ask Kenzy to work on it.', 'Nothing to process yet.');
  const panel = ensureResultPanel(page);
  panel.classList.add('visible', 'working');
  panel.querySelector('.notes-upgrade-result-status').textContent = 'Kenzy is working on your notes…';
  try {
    const result = await sendToNotesApi({ action, title, content });
    showResult(page, result, 'Kenzy finished. Review it before applying.');
  } catch (error) {
    showResult(page, error.message || 'Could not process the note.', 'Something went wrong.');
  } finally {
    panel.classList.remove('working');
  }
}

async function importStudyFile(page, file) {
  if (!ALLOWED.has(file.type)) return showResult(page, 'Use PDF, PNG, JPG, or WebP files only.', 'Unsupported file.');
  if (file.size > MAX_BYTES) return showResult(page, 'That file is larger than 25 MB. Please choose a smaller file.', 'File too large.');
  const panel = ensureResultPanel(page);
  panel.classList.add('visible', 'working');
  panel.querySelector('.notes-upgrade-result-status').textContent = `Reading ${file.name}…`;
  try {
    let payload;
    if (file.size <= INLINE_LIMIT) {
      payload = { action: 'Import this study file into clean editable notes.', title: file.name.replace(/\.[^.]+$/, ''), files: [{ name: file.name, mimeType: file.type, data: await base64(file) }] };
    } else {
      const uploaded = await upload(`notes-material/${crypto.randomUUID()}-${safeName(file.name)}`, file, {
        access: 'private',
        handleUploadUrl: '/api/blob-upload',
        multipart: file.size > 5 * 1024 * 1024,
      });
      payload = { action: 'Import this study file into clean editable notes.', title: file.name.replace(/\.[^.]+$/, ''), blobFiles: [{ pathname: uploaded.pathname, name: file.name, mimeType: file.type }] };
    }
    const result = await sendToNotesApi(payload);
    const title = getTitleInput(page);
    const area = getContentArea(page);
    if (title) setReactValue(title, file.name.replace(/\.[^.]+$/, ''));
    if (area) setReactValue(area, result);
    showResult(page, result, 'Imported successfully. Your note is editable now.');
  } catch (error) {
    showResult(page, error.message || 'Could not import that file.', 'Import failed.');
  } finally {
    panel.classList.remove('working');
  }
}

async function exportPdf(page) {
  const title = getTitleInput(page)?.value?.trim() || 'Kenzy note';
  const content = getContentArea(page)?.value || '';
  if (!content.trim()) return showResult(page, 'Add some note content before exporting.', 'Nothing to export yet.');
  try {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    const width = 595.28 - margin * 2;
    const lines = pdf.splitTextToSize(content, width);
    let y = 72;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(title.slice(0, 100), margin, y);
    y += 30;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    const lineHeight = 17;
    for (const line of lines) {
      if (y > 760) {
        pdf.addPage();
        y = 60;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(110);
      pdf.text(`Kenzy · ${i} / ${pages}`, 48, 806);
    }
    pdf.save(`${title.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'kenzy-note'}.pdf`);
  } catch (error) {
    showResult(page, `PDF export could not start. ${error.message || ''}`.trim(), 'Export failed.');
  }
}

function wireAiButtons(page) {
  const mapping = [
    [['summarize'], 'Summarize these notes into the most important study points.'],
    [['simplify'], 'Simplify these notes into clear, student-friendly language without removing important facts.'],
    [['study guide'], 'Turn these notes into a structured study guide with headings, key points, and useful review prompts.'],
  ];
  mapping.forEach(([labels, action]) => {
    const button = findButton(page, labels);
    if (!button || button.dataset.notesUpgradeBound === '1') return;
    const replacement = button.cloneNode(true);
    replacement.dataset.notesUpgradeBound = '1';
    button.replaceWith(replacement);
    replacement.addEventListener('click', () => runAction(page, action));
  });
}

function init(page) {
  if (!page) return;
  addTopControls(page);
  wireAiButtons(page);
  ensureResultPanel(page);
  page.dataset.notesUpgradeReady = '1';
}

function boot() {
  const tick = () => {
    const page = document.querySelector('.notes-page');
    if (!page) return;
    init(page);
    if (!page.__notesUpgradeObserver) {
      const observer = new MutationObserver(() => {
        if (!page.isConnected) return;
        addTopControls(page);
        wireAiButtons(page);
      });
      observer.observe(page, { childList: true, subtree: true });
      page.__notesUpgradeObserver = observer;
    }
  };
  tick();
  window.setInterval(tick, POLL_MS);
}

boot();
