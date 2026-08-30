// Keep Kenzy AI responses comfortable to read without changing the underlying reply text.
// This is intentionally limited to assistant bubbles and only restructures dense blocks.
const SENTENCE_END = /([.!?])\s+(?=[A-Z0-9“"'])/g;
const GREETING_START = /^(?:hey|hi|hello|good (?:morning|afternoon|evening))\b/i;

function splitIntoParagraphs(text) {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const explicitBlocks = normalized.split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
  if (explicitBlocks.length > 1) return explicitBlocks;

  if (normalized.includes('\n')) return normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (normalized.length < 180) return [normalized];

  const sentences = normalized.split(SENTENCE_END).reduce((acc, part, index, parts) => {
    if (index % 2 === 0) {
      acc.push(part + (parts[index + 1] || ''));
    }
    return acc;
  }, []).map((sentence) => sentence.trim()).filter(Boolean);

  if (sentences.length < 3) return [normalized];

  const paragraphs = [];
  let current = [];
  sentences.forEach((sentence, index) => {
    const standaloneGreeting = index === 0 && GREETING_START.test(sentence) && sentence.length <= 120;
    if (standaloneGreeting) {
      paragraphs.push(sentence);
      return;
    }

    current.push(sentence);
    const isLast = index === sentences.length - 1;
    if (current.length >= 2 || isLast) {
      paragraphs.push(current.join(' '));
      current = [];
    }
  });

  return paragraphs.length ? paragraphs : [normalized];
}

function formatAssistantBubble(bubble) {
  if (bubble.dataset.kenzyFormatting === 'busy') return;

  const source = bubble.textContent || '';
  if (!source.trim()) return;
  if (bubble.dataset.kenzySource === source && bubble.querySelector('.kenzy-message-paragraph')) return;

  const paragraphs = splitIntoParagraphs(source);
  if (paragraphs.length <= 1) {
    bubble.dataset.kenzySource = source;
    return;
  }

  bubble.dataset.kenzyFormatting = 'busy';
  const fragment = document.createDocumentFragment();
  paragraphs.forEach((paragraph) => {
    const block = document.createElement('div');
    block.className = 'kenzy-message-paragraph';
    block.textContent = paragraph;
    fragment.appendChild(block);
  });
  bubble.replaceChildren(fragment);
  bubble.dataset.kenzySource = source;
  delete bubble.dataset.kenzyFormatting;
}

function scan() {
  document.querySelectorAll('.message.assistant .message-bubble:not(.typing)').forEach(formatAssistantBubble);
}

function start() {
  if (!document.body) return;
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (typeof window !== 'undefined') {
  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start, { once: true });
}
