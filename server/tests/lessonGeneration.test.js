import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();
vi.mock('../config/env.js', () => ({
  default: {
    geminiApiKey: 'test-key',
    geminiModel: 'test-model',
    geminiFallbackModel: null,
    lessonAttemptTimeoutMs: 60_000,
    lessonTotalTimeoutMs: 120_000,
  },
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER' },
}));

const { buildLessonPrompt, validateLessonContent, generateLessonContent, toContent } = await import(
  '../services/lessonGenerationService.js'
);

const mcq = (n = 1) => ({
  type: 'mcq',
  question: `Question ${n}?`,
  options: ['A', 'B', 'C', 'D'].map((o) => `${o} ${n}`),
  answer: 1,
  explanation: 'Because.',
});

const valid = () => ({
  summary: 'An AI agent is a program that perceives, decides and acts in a loop toward a goal.',
  videoQuery: 'what are AI agents perceive reason act loop explained',
  content: [
    { type: 'paragraph', text: 'An **AI agent** is software that pursues a goal by ...' },
    { type: 'example', title: 'A travel-booking agent', text: "Given 'book me a flight to Goa', it ..." },
    { type: 'callout', tone: 'tip', text: 'A chatbot answers; an agent acts.' },
    { type: 'mcq', question: 'What separates an agent from a chatbot?', options: ['It uses an LLM', 'It takes actions toward a goal', 'It has a UI', 'It is trained on more data'], answer: 1, explanation: 'Both may use LLMs; the agent decides and acts in a loop.' },
    mcq(2),
    mcq(3),
    mcq(4),
  ],
});

// A copy of the valid lesson with `change` applied to it.
const mutated = (change) => {
  const lesson = valid();
  change(lesson);
  return lesson;
};

describe('validateLessonContent', () => {
  it('accepts the spec example and returns cleaned content', () => {
    const result = validateLessonContent(valid());
    expect(result.content).toHaveLength(7);
    expect(result.summary).toMatch(/^An AI agent/);
    expect(result.videoQuery).toBe('what are AI agents perceive reason act loop explained');
  });

  it('accepts 5 questions and every block type', () => {
    const lesson = valid();
    lesson.content.unshift(
      { type: 'heading', text: 'Intro' },
      { type: 'list', ordered: true, items: ['one', 'two'] },
      { type: 'code', language: 'python', text: 'print(1)' },
    );
    lesson.content.push(mcq(5));
    expect(validateLessonContent(lesson).content).toHaveLength(11);
  });

  it('drops fields that do not belong to the block type', () => {
    const lesson = valid();
    lesson.content[0] = { type: 'paragraph', text: 'Hello', answer: 2, options: ['x'], items: ['y'], url: 'http://evil' };
    expect(validateLessonContent(lesson).content[0]).toEqual({ type: 'paragraph', text: 'Hello' });
  });

  it('turns an unknown code language into "text" and lower-cases a known one', () => {
    const lesson = valid();
    lesson.content.unshift({ type: 'code', language: 'Brainfuck', text: '+++' }, { type: 'code', language: 'Python', text: 'x' });
    const [unknown, known] = validateLessonContent(lesson).content;
    expect(unknown.language).toBe('text');
    expect(known.language).toBe('python');
  });

  describe('leniency (shapes the model really returns)', () => {
    const withBlocks = (...blocks) => mutated((l) => l.content.unshift(...blocks));

    it('cuts questions beyond 5 instead of rejecting the lesson', () => {
      const lesson = valid();
      lesson.content.push(mcq(5), mcq(6), mcq(7));
      const { content } = validateLessonContent(lesson);
      expect(content.filter((b) => b.type === 'mcq')).toHaveLength(5);
      expect(content.at(-1).question).toBe('Question 5?');
    });

    it('drops a list with no items, or only one, and keeps the lesson', () => {
      const { content } = validateLessonContent(
        withBlocks({ type: 'list', ordered: false, tone: 'tip' }, { type: 'list', items: ['only'] }, { type: 'list', items: [] }),
      );
      expect(content.some((b) => b.type === 'list')).toBe(false);
      expect(content).toHaveLength(7);
    });

    it('drops an example with no text but keeps another example that has it', () => {
      const { content } = validateLessonContent(withBlocks({ type: 'example', title: 'Empty', tone: 'tip' }));
      expect(content.filter((b) => b.type === 'example')).toHaveLength(1);
      expect(content.find((b) => b.type === 'example').title).toBe('A travel-booking agent');
    });

    it('drops empty paragraph, heading, callout and code blocks', () => {
      const { content } = validateLessonContent(
        withBlocks(
          { type: 'paragraph', text: '  ' },
          { type: 'heading', text: '' },
          { type: 'callout', tone: 'tip', text: '' },
          { type: 'code', language: 'python', text: '' },
        ),
      );
      expect(content).toHaveLength(7);
    });

    it('titles an example "Example" when the model left the title empty', () => {
      const lesson = valid();
      lesson.content[1] = { type: 'example', title: '', text: 'Body' };
      expect(validateLessonContent(lesson).content[1].title).toBe('Example');
    });

    it('still rejects when so much is dropped that the minimum is not met', () => {
      const lesson = valid();
      lesson.content = [lesson.content[1], { type: 'list', ordered: true }, { type: 'paragraph', text: '' }, ...lesson.content.slice(3)];
      expect(() => validateLessonContent(lesson)).toThrow(/explanation blocks/);
    });
  });

  it.each([
    ['an example with no text (the only example)', (l) => (l.content[1] = { type: 'example', title: 'Ex', tone: 'tip' })],
    ['a missing example block', (l) => (l.content = l.content.filter((b) => b.type !== 'example'))],
    ['a missing paragraph', (l) => (l.content = l.content.filter((b) => b.type !== 'paragraph'))],
    ['3 questions', (l) => l.content.pop()],
    ['a question before an explanation block', (l) => l.content.splice(1, 0, mcq(9))],
    ['a duplicate option', (l) => (l.content.at(-1).options[1] = l.content.at(-1).options[0])],
    ['answer out of range', (l) => (l.content.at(-1).answer = 4)],
    ['a non-integer answer', (l) => (l.content.at(-1).answer = '1')],
    ['an empty mcq explanation', (l) => (l.content.at(-1).explanation = '  ')],
    ['3 options', (l) => l.content.at(-1).options.pop()],
    ['an over-long paragraph', (l) => (l.content[0].text = 'x'.repeat(1201))],
    ['an over-long option', (l) => (l.content.at(-1).options[0] = 'x'.repeat(201))],
    ['an over-long summary', (l) => (l.summary = 'x'.repeat(401))],
    ['a too-short video query', (l) => (l.videoQuery = 'ab')],
    ['an over-long video query', (l) => (l.videoQuery = 'x'.repeat(101))],
    ['an unknown block type', (l) => l.content.splice(1, 0, { type: 'video', text: 'x' })],
    ['too few explanation blocks', (l) => (l.content = [l.content[0], l.content[1], ...l.content.slice(3)])],
    ['too many explanation blocks', (l) => l.content.unshift(...Array.from({ length: 40 }, () => ({ type: 'paragraph', text: 'p' })))],
  ])('rejects %s', (_name, change) => {
    expect(() => validateLessonContent(mutated(change))).toThrow();
  });

  it('rejects non-object input', () => {
    expect(() => validateLessonContent(null)).toThrow();
    expect(() => validateLessonContent({ summary: 's', videoQuery: 'query' })).toThrow();
  });
});

describe('buildLessonPrompt', () => {
  const input = {
    course: { title: 'Agentic AI', description: 'About agents.' },
    module: { title: 'Foundations' },
    lesson: { title: 'What are AI Agents', objectives: ['Define an agent', 'Name its parts'] },
    prevLesson: { title: 'Course intro' },
    nextLesson: { title: 'Tools and memory' },
  };

  it('keeps every title inside the delimited data block', () => {
    const prompt = buildLessonPrompt(input);
    const start = prompt.indexOf('<<<DATA');
    const end = prompt.indexOf('DATA>>>');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const inside = prompt.slice(start, end);
    const outside = prompt.slice(0, start) + prompt.slice(end);
    for (const text of ['Agentic AI', 'About agents.', 'Foundations', 'What are AI Agents', 'Define an agent', 'Course intro', 'Tools and memory']) {
      expect(inside).toContain(text);
      expect(outside).not.toContain(text);
    }
  });

  it('says so when there is no previous or next lesson', () => {
    const prompt = buildLessonPrompt({ ...input, prevLesson: null, nextLesson: null });
    expect(prompt).toContain('this is the first lesson');
    expect(prompt).toContain('this is the last lesson');
  });

  it('spells out the fields each block type needs and asks for exactly 5 questions', () => {
    const prompt = buildLessonPrompt(input);
    expect(prompt).toMatch(/"example": BOTH title and text/);
    expect(prompt).toMatch(/"list": items/);
    expect(prompt).toContain('exactly 5 multiple-choice questions');
  });

  it('does not mention the Side Quest or Hinglish flags', () => {
    expect(buildLessonPrompt(input)).not.toMatch(/side quest|hinglish/i);
  });
});

// What the model returns: an `explanation` array and a separate `quiz` array.
const modelOutput = () => {
  const { summary, videoQuery, content } = valid();
  return {
    summary,
    videoQuery,
    explanation: content.filter((b) => b.type !== 'mcq'),
    quiz: content.filter((b) => b.type === 'mcq').map(({ type: _type, ...question }) => question),
  };
};

describe('toContent', () => {
  it('merges the quiz into trailing mcq blocks', () => {
    const { content } = toContent(modelOutput());
    expect(content).toHaveLength(7);
    expect(content.slice(0, 3).every((b) => b.type !== 'mcq')).toBe(true);
    expect(content.slice(3).every((b) => b.type === 'mcq')).toBe(true);
    expect(validateLessonContent(toContent(modelOutput())).content).toHaveLength(7);
  });

  it('passes the stored shape and junk through unchanged', () => {
    const stored = valid();
    expect(toContent(stored)).toBe(stored);
    expect(toContent(null)).toBeNull();
  });

  it('survives a missing quiz (validation then rejects it)', () => {
    const output = { ...modelOutput(), quiz: undefined };
    expect(() => validateLessonContent(toContent(output))).toThrow(/questions/);
  });
});

describe('generateLessonContent', () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const input = {
    course: { title: 'C', description: 'D' },
    module: { title: 'M' },
    lesson: { title: 'L', objectives: [] },
  };

  async function settle(promise, ms = 130_000) {
    const outcome = promise.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await vi.advanceTimersByTimeAsync(ms);
    return outcome;
  }

  it('returns validated content', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify(modelOutput()) });
    const { value } = await settle(generateLessonContent(input));
    expect(value.content).toHaveLength(7);
    expect(generateContent.mock.calls[0][0].config.responseMimeType).toBe('application/json');
  });

  it('retries invalid content and then succeeds', async () => {
    generateContent
      .mockResolvedValueOnce({ text: JSON.stringify({ ...modelOutput(), quiz: modelOutput().quiz.slice(0, 2) }) })
      .mockResolvedValueOnce({ text: JSON.stringify(modelOutput()) });
    const { value } = await settle(generateLessonContent(input));
    expect(value.content).toHaveLength(7);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('asks Gemini for separate explanation and quiz arrays with every block field required', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify(modelOutput()) });
    await settle(generateLessonContent(input));
    const { responseSchema } = generateContent.mock.calls[0][0].config;
    expect(responseSchema.required).toEqual(['summary', 'videoQuery', 'explanation', 'quiz']);
    const block = responseSchema.properties.explanation.items;
    expect([...block.required].sort()).toEqual(Object.keys(block.properties).sort());
    expect(block.properties.type.enum).not.toContain('mcq');
    const question = responseSchema.properties.quiz.items;
    expect([...question.required].sort()).toEqual(['answer', 'explanation', 'options', 'question']);
  });

  it('logs why an output was rejected, but never puts that text on the thrown error', async () => {
    const broken = { ...modelOutput(), explanation: [{ type: 'paragraph', text: 'Only one block' }] };
    generateContent.mockResolvedValue({ text: JSON.stringify(broken) });
    const { error } = await settle(generateLessonContent(input));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('needs 3-40 explanation blocks, got 1'));
    expect(error.message).not.toContain('explanation blocks');
  });

  it('gives a 502 with a lesson message after 3 bad outputs, never the upstream text', async () => {
    generateContent.mockResolvedValue({ text: 'not json SECRET' });
    const { error } = await settle(generateLessonContent(input));
    expect(error).toMatchObject({ status: 502, message: "The AI couldn't write this lesson. Please try again." });
    expect(error.message).not.toContain('SECRET');
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('gives a 503 when the service stays busy', async () => {
    generateContent.mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }));
    const { error } = await settle(generateLessonContent(input));
    expect(error).toMatchObject({ status: 503 });
  });
});
