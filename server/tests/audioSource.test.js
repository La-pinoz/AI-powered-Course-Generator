import { describe, expect, it } from 'vitest';
import {
  CODE_CHAR_CAP,
  SOURCE_CHAR_CAP,
  buildAudioSource,
  extractKeyTerms,
  sourceHashOf,
} from '../services/audioSource.js';

const mcq = {
  type: 'mcq',
  question: 'What separates an agent from a chatbot entirely?',
  options: ['It uses an LLM', 'It takes actions toward a goal', 'It has a UI', 'It is trained on more data'],
  answer: 1,
  explanation: 'SECRET-EXPLANATION both may use LLMs',
};

const lesson = (content, extra = {}) => ({
  title: 'What are AI Agents',
  objectives: ['Define an agent', 'Contrast agents with chatbots'],
  summary: 'An **AI agent** acts toward a goal.',
  videoQuery: 'VIDEO-QUERY ai agents explained',
  content,
  ...extra,
});

const base = [
  { type: 'heading', text: 'The loop' },
  { type: 'paragraph', text: 'An **AI agent** perceives, decides and acts using a `tool`.' },
  { type: 'list', ordered: false, items: ['Perceive', 'Decide', 'Act'] },
  { type: 'example', title: 'Travel agent', text: 'It books a flight to Goa.' },
  { type: 'callout', tone: 'warning', text: 'A chatbot only answers.' },
  { type: 'code', language: 'python', text: 'def act():\n    return "done"' },
  { type: 'mystery', text: 'UNKNOWN-BLOCK' },
  mcq,
];

describe('buildAudioSource', () => {
  it('includes the explainable blocks with labels and strips inline markers', () => {
    const { text, explainable, truncated } = buildAudioSource(lesson(base));
    expect(explainable).toBe(true);
    expect(truncated).toBe(false);
    expect(text).toContain('LESSON: What are AI Agents');
    expect(text).toContain('- Define an agent');
    expect(text).toContain('SUMMARY: An AI agent acts toward a goal.');
    expect(text).toContain('SECTION: The loop');
    expect(text).toContain('An AI agent perceives, decides and acts using a tool.');
    expect(text).toContain('- Perceive\n- Decide\n- Act');
    expect(text).toContain('EXAMPLE: Travel agent — It books a flight to Goa.');
    expect(text).toContain('WARNING: A chatbot only answers.');
    expect(text).toContain('CODE (python, do not read aloud): def act()');
    expect(text).not.toMatch(/\*\*|`/);
  });

  it('never contains quiz questions, options, answers or explanations', () => {
    const { text } = buildAudioSource(lesson(base));
    expect(text).not.toContain(mcq.question);
    for (const option of mcq.options) expect(text).not.toContain(option);
    expect(text).not.toContain('SECRET-EXPLANATION');
  });

  it('leaves out videoQuery and unknown block types', () => {
    const { text } = buildAudioSource(lesson(base));
    expect(text).not.toContain('VIDEO-QUERY');
    expect(text).not.toContain('UNKNOWN-BLOCK');
  });

  it('caps each code body', () => {
    const { text } = buildAudioSource(lesson([{ type: 'code', language: 'js', text: 'x'.repeat(5000) }]));
    expect(text).toContain(`CODE (js, do not read aloud): ${'x'.repeat(CODE_CHAR_CAP)}`);
    expect(text).not.toContain('x'.repeat(CODE_CHAR_CAP + 1));
  });

  it('cuts at a block boundary when the source is too long', () => {
    const blocks = Array.from({ length: 20 }, (_, i) => ({ type: 'paragraph', text: `P${i} ${'w'.repeat(1100)}` }));
    const { text, truncated } = buildAudioSource(lesson(blocks));
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(SOURCE_CHAR_CAP);
    // Every included paragraph is whole.
    const included = text.split('\n\n').filter((part) => part.startsWith('P'));
    expect(included.length).toBeGreaterThan(0);
    expect(included.length).toBeLessThan(20);
    for (const part of included) expect(part).toMatch(/^P\d+ w{1100}$/);
  });

  it('reports a lesson with only quiz questions as not explainable', () => {
    expect(buildAudioSource(lesson([mcq])).explainable).toBe(false);
  });
});

describe('sourceHashOf', () => {
  it('is deterministic', () => {
    expect(sourceHashOf(lesson(base))).toBe(sourceHashOf(lesson(structuredClone(base))));
  });

  it('ignores quiz and videoQuery changes', () => {
    const changed = base.map((b) => (b.type === 'mcq' ? { ...b, question: 'Something else entirely?' } : b));
    expect(sourceHashOf(lesson(changed, { videoQuery: 'other' }))).toBe(sourceHashOf(lesson(base)));
  });

  it('changes when an explanation block changes', () => {
    const changed = base.map((b) => (b.type === 'paragraph' ? { ...b, text: 'Different text.' } : b));
    expect(sourceHashOf(lesson(changed))).not.toBe(sourceHashOf(lesson(base)));
  });
});

describe('extractKeyTerms', () => {
  it('collects bold and inline-code terms from explanation blocks, deduplicated', () => {
    const terms = extractKeyTerms(
      lesson([
        { type: 'paragraph', text: 'An **AI agent** uses a `tool` and an **ai agent** loop.' },
        { type: 'list', items: ['**Planner** step'] },
        { type: 'mcq', question: '**QuizTerm**?', options: [], answer: 0, explanation: '' },
      ]),
    );
    expect(terms).toEqual(['AI agent', 'tool', 'Planner']);
  });

  it('keeps at most 15 terms', () => {
    const text = Array.from({ length: 20 }, (_, i) => `**term${i}**`).join(' ');
    expect(extractKeyTerms(lesson([{ type: 'paragraph', text }]))).toHaveLength(15);
  });
});
