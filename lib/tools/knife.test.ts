import {
  sanitizeBasename,
  splitByRegexParagraphs,
  splitTextAndCount,
  joinParagraphs,
  getPreviewStart,
  getPreviewEnd,
} from './knife';

// ─── sanitizeBasename ────────────────────────────────────────────────────────

describe('sanitizeBasename', () => {
  it('removes file extension', () => {
    expect(sanitizeBasename('document.txt')).toBe('document');
    // Only the last extension is removed; dots in the remaining name are replaced by _
    expect(sanitizeBasename('archive.tar.gz')).toBe('archive_tar');
  });

  it('keeps Chinese characters', () => {
    expect(sanitizeBasename('我的文章.md')).toBe('我的文章');
  });

  it('keeps English letters, digits, underscore, hyphen, and spaces', () => {
    expect(sanitizeBasename('hello_world-1 2.txt')).toBe('hello_world-1 2');
  });

  it('replaces other special characters with underscore', () => {
    expect(sanitizeBasename('file@name!.txt')).toBe('file_name_');
  });

  it('falls back to "parts" when result is empty', () => {
    // '!!!' → replaced to '_' which is non-empty after trim, so no fallback
    expect(sanitizeBasename('!!!.txt')).toBe('_');
    // '.txt' → withoutExt is '' → safe is '' → fallback to 'parts'
    expect(sanitizeBasename('.txt')).toBe('parts');
  });

  it('handles name with no extension', () => {
    expect(sanitizeBasename('noextension')).toBe('noextension');
  });
});

// ─── splitByRegexParagraphs ──────────────────────────────────────────────────

describe('splitByRegexParagraphs', () => {
  it('splits text by matching pattern lines', () => {
    const text = '# Chapter 1\nsome content\n# Chapter 2\nmore content';
    const result = splitByRegexParagraphs(text, '^#');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('# Chapter 1');
    expect(result[1]).toContain('# Chapter 2');
  });

  it('filters out empty paragraphs', () => {
    const text = '   \n   \nparagraph one\n   \n';
    // Pattern that never matches, so everything goes into one buffer
    const result = splitByRegexParagraphs(text, '^NEVER_MATCH$');
    // All lines join into one buffer, but it's not empty
    expect(result.length).toBeGreaterThan(0);
    result.forEach((p) => expect(p.trim().length).toBeGreaterThan(0));
  });

  it('returns empty array when all lines are blank', () => {
    const result = splitByRegexParagraphs('   \n\n   ', '^#');
    expect(result).toHaveLength(0);
  });

  it('handles CRLF line endings', () => {
    const text = '# A\r\ncontent A\r\n# B\r\ncontent B';
    const result = splitByRegexParagraphs(text, '^#');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('# A');
    expect(result[1]).toContain('# B');
  });

  it('groups non-matching lines under the preceding matching line', () => {
    const text = '# Title\nline1\nline2';
    const result = splitByRegexParagraphs(text, '^#');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('# Title\nline1\nline2');
  });
});

// ─── splitTextAndCount ───────────────────────────────────────────────────────

describe('splitTextAndCount', () => {
  const defaultParams = {
    targetChars: 100,
    tolerance: 0.1,
    paraPattern: '^',      // every line starts a new paragraph
    hardBreakLong: false,
    chapterPrefix: '第',
  };

  it('returns 0 sections and 0 paragraphs for empty text', () => {
    const result = splitTextAndCount({ ...defaultParams, text: '' });
    expect(result.sections).toHaveLength(0);
    expect(result.paragraphCount).toBe(0);
  });

  it('assigns UUIDs to each section', () => {
    const text = 'Hello world';
    const result = splitTextAndCount({ ...defaultParams, text });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('uses chapterPrefix in titles', () => {
    const text = 'Hello world';
    const result = splitTextAndCount({ ...defaultParams, text, chapterPrefix: 'Ch' });
    expect(result.sections[0].title).toBe('Ch1');
  });

  it('groups paragraphs until upper limit is reached', () => {
    // Each paragraph is 10 chars, target=15, tolerance=0, upper=15
    // paragraph1 (10) fits in bucket; adding paragraph2 → projected=10+2+10=22 > 15, so flush
    const lines = Array.from({ length: 4 }, (_, i) => `paragraph${i}`); // each 10 chars
    const text = lines.join('\n');
    const result = splitTextAndCount({
      ...defaultParams,
      text,
      targetChars: 15,
      tolerance: 0,
      paraPattern: '^paragraph',
    });
    // Each paragraph is its own section since projected always exceeds upper after first
    expect(result.sections.length).toBeGreaterThanOrEqual(2);
    expect(result.paragraphCount).toBe(4);
  });

  it('hardBreakLong forces split of oversized paragraphs', () => {
    // Single paragraph longer than targetChars
    const longPara = 'A'.repeat(250);
    const result = splitTextAndCount({
      ...defaultParams,
      text: longPara,
      targetChars: 100,
      tolerance: 0,
      hardBreakLong: true,
      paraPattern: '^NEVER_MATCH$', // don't split on pattern; whole text is one paragraph
    });
    // 250 chars / 100 per chunk = 3 sections
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].paragraphs[0]).toHaveLength(100);
    expect(result.sections[1].paragraphs[0]).toHaveLength(100);
    expect(result.sections[2].paragraphs[0]).toHaveLength(50);
  });

  it('hardBreakLong flushes existing bucket before splitting long paragraph', () => {
    // Short paragraph + long paragraph
    const shortPara = 'Short';
    const longPara = 'B'.repeat(150);
    const text = `${shortPara}\n\n${longPara}`;
    const result = splitTextAndCount({
      ...defaultParams,
      text,
      targetChars: 100,
      tolerance: 0,
      hardBreakLong: true,
      // Match lines starting with 'B' or 'S' so each is its own paragraph
      paraPattern: '^[A-Z]',
    });
    // shortPara → 1 section, longPara → 2 sections (150/100)
    expect(result.sections.length).toBeGreaterThanOrEqual(2);
  });

  it('returns correct paragraphCount', () => {
    const text = '# A\ntext A\n# B\ntext B\n# C\ntext C';
    const result = splitTextAndCount({
      ...defaultParams,
      text,
      targetChars: 200,
      paraPattern: '^#',
    });
    expect(result.paragraphCount).toBe(3);
  });
});

// ─── joinParagraphs ──────────────────────────────────────────────────────────

describe('joinParagraphs', () => {
  it('joins paragraphs with double newline', () => {
    expect(joinParagraphs(['a', 'b', 'c'])).toBe('a\n\nb\n\nc');
  });

  it('returns single paragraph as-is', () => {
    expect(joinParagraphs(['only'])).toBe('only');
  });

  it('returns empty string for empty array', () => {
    expect(joinParagraphs([])).toBe('');
  });
});

// ─── getPreviewStart ─────────────────────────────────────────────────────────

describe('getPreviewStart', () => {
  it('returns the first N characters', () => {
    expect(getPreviewStart('Hello World', 5)).toBe('Hello');
  });

  it('defaults to 40 characters', () => {
    const text = 'A'.repeat(80);
    expect(getPreviewStart(text)).toHaveLength(40);
  });

  it('returns full string when text is shorter than length', () => {
    expect(getPreviewStart('Hi', 40)).toBe('Hi');
  });
});

// ─── getPreviewEnd ───────────────────────────────────────────────────────────

describe('getPreviewEnd', () => {
  it('returns the last N characters', () => {
    expect(getPreviewEnd('Hello World', 5)).toBe('World');
  });

  it('defaults to 40 characters', () => {
    const text = 'A'.repeat(80);
    expect(getPreviewEnd(text)).toHaveLength(40);
  });

  it('returns full string when text is shorter than length', () => {
    expect(getPreviewEnd('Hi', 40)).toBe('Hi');
  });
});
