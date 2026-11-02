import { createHash } from 'node:crypto';

// Turns a lesson's saved blocks into the text the Hinglish script is written from (Spec 6, Step 0).
// Pure: the same lesson always gives the same source, and its hash is the audio cache key.
// MCQ blocks never get in, so quiz questions and answers can't reach the prompt or the audio.

export const CODE_CHAR_CAP = 800;
export const SOURCE_CHAR_CAP = 12_000;
export const MAX_KEY_TERMS = 15;

const TONE_LABEL = { tip: 'TIP', note: 'NOTE', warning: 'WARNING' };

// `**bold**` and `` `code` `` markers are removed; the words stay.
const plain = (value) =>
  String(value ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

// One block → its source text, or null when the block is left out.
function blockText(block) {
  switch (block?.type) {
    case 'heading':
      return block.text ? `SECTION: ${plain(block.text)}` : null;
    case 'paragraph':
      return block.text ? plain(block.text) : null;
    case 'list': {
      const items = (block.items ?? []).map(plain).filter(Boolean);
      return items.length ? items.map((item) => `- ${item}`).join('\n') : null;
    }
    case 'example': {
      const title = plain(block.title);
      const text = plain(block.text);
      if (!title && !text) return null;
      return `EXAMPLE: ${[title, text].filter(Boolean).join(' — ')}`;
    }
    case 'callout':
      return block.text ? `${TONE_LABEL[block.tone] ?? 'NOTE'}: ${plain(block.text)}` : null;
    case 'code': {
      const code = String(block.text ?? '').trim();
      if (!code) return null;
      return `CODE (${block.language || 'text'}, do not read aloud): ${code.slice(0, CODE_CHAR_CAP)}`;
    }
    default:
      return null; // mcq and unknown types
  }
}

/**
 * Returns { text, explainable, truncated }. `explainable` is false when no block produced text
 * (for example a lesson with only quiz questions). `truncated` is true when the 12,000-character cap
 * cut later blocks.
 */
export function buildAudioSource(lesson) {
  const header = [`LESSON: ${plain(lesson.title)}`];
  const objectives = (lesson.objectives ?? []).map(plain).filter(Boolean);
  if (objectives.length) header.push(`OBJECTIVES:\n${objectives.map((o) => `- ${o}`).join('\n')}`);
  if (lesson.summary) header.push(`SUMMARY: ${plain(lesson.summary)}`);

  const parts = [header.join('\n')];
  let length = parts[0].length;
  let explainable = false;
  let truncated = false;

  for (const block of lesson.content ?? []) {
    const text = blockText(block);
    if (!text) continue;
    if (length + 2 + text.length > SOURCE_CHAR_CAP) {
      truncated = true;
      break; // cut at a block boundary
    }
    parts.push(text);
    length += 2 + text.length;
    explainable = true;
  }

  return { text: parts.join('\n\n'), explainable, truncated };
}

// Terms the lesson marked as **bold** or `code` in non-quiz blocks: they must stay in English.
export function extractKeyTerms(lesson) {
  const seen = new Map(); // lower-case → first spelling
  const collect = (value) => {
    for (const match of String(value ?? '').matchAll(/\*\*(.+?)\*\*|`([^`]+)`/g)) {
      const term = (match[1] ?? match[2]).trim();
      if (term && term.length <= 60 && !seen.has(term.toLowerCase())) seen.set(term.toLowerCase(), term);
    }
  };
  for (const block of lesson.content ?? []) {
    if (block?.type === 'mcq' || block?.type === 'code') continue;
    collect(block.text);
    collect(block.title);
    for (const item of block.items ?? []) collect(item);
  }
  return [...seen.values()].slice(0, MAX_KEY_TERMS);
}

export const hashSource = (text) => createHash('sha256').update(text).digest('hex');

// The cache key of a lesson's current content.
export const sourceHashOf = (lesson) => hashSource(buildAudioSource(lesson).text);
