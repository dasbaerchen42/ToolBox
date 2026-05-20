import { validateContent } from './validators';

// ─── JSON mode ───────────────────────────────────────────────────────────────

describe('validateContent – json', () => {
  it('returns success for valid JSON', () => {
    const result = validateContent('json', '{"key": "value", "num": 42}');
    expect(result.status).toBe('success');
  });

  it('returns idle for empty content', () => {
    const result = validateContent('json', '');
    expect(result.status).toBe('idle');
  });

  it('returns idle for whitespace-only content', () => {
    const result = validateContent('json', '   ');
    expect(result.status).toBe('idle');
  });

  it('returns error for invalid JSON', () => {
    const result = validateContent('json', '{not valid json}');
    expect(result.status).toBe('error');
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it('returns error for malformed JSON (trailing comma)', () => {
    const result = validateContent('json', '{"a": 1,}');
    expect(result.status).toBe('error');
  });
});

// ─── YAML mode ───────────────────────────────────────────────────────────────

describe('validateContent – yaml', () => {
  it('returns success for valid YAML', () => {
    const result = validateContent('yaml', 'key: value\nnum: 42');
    expect(result.status).toBe('success');
  });

  it('returns idle for empty content', () => {
    const result = validateContent('yaml', '');
    expect(result.status).toBe('idle');
  });

  it('returns error when a line uses tab indentation (yaml parser rejects tabs)', () => {
    // The yaml parser treats tab indentation as a hard error, not just a warning
    const result = validateContent('yaml', 'parent:\n\tchild: value');
    expect(result.status).toBe('error');
    const tabError = result.messages.some((m) => m.toLowerCase().includes('tab'));
    expect(tabError).toBe(true);
  });

  it('returns warning for non-tab style issues (colon without space)', () => {
    // A colon without a following space triggers the warning path
    const result = validateContent('yaml', 'key:value');
    expect(result.status).toBe('warning');
    const colonWarning = result.messages.some((m) => m.includes('冒號'));
    expect(colonWarning).toBe(true);
  });

  it('returns error for YAML with syntax errors', () => {
    // Indentation inconsistency that yaml parser flags as an error
    const result = validateContent('yaml', 'key: [unclosed bracket');
    expect(result.status).toBe('error');
  });
});

// ─── Markdown mode ───────────────────────────────────────────────────────────

describe('validateContent – markdown', () => {
  it('returns success for normal markdown', () => {
    const result = validateContent('markdown', '# Heading\n\nSome paragraph text.');
    expect(result.status).toBe('success');
  });

  it('returns idle for empty content', () => {
    const result = validateContent('markdown', '');
    expect(result.status).toBe('idle');
  });

  it('returns warning when heading # has no following space', () => {
    const result = validateContent('markdown', '#NoSpace');
    expect(result.status).toBe('warning');
    const headingWarning = result.messages.some((m) => m.includes('標題') || m.includes('#'));
    expect(headingWarning).toBe(true);
  });

  it('returns success when heading has proper space', () => {
    const result = validateContent('markdown', '# Proper heading');
    expect(result.status).toBe('success');
  });
});

// ─── HTML mode ───────────────────────────────────────────────────────────────

describe('validateContent – html', () => {
  it('returns success for balanced div tags', () => {
    const result = validateContent('html', '<div>hello</div>');
    expect(result.status).toBe('success');
  });

  it('returns warning when a div tag is not closed', () => {
    const result = validateContent('html', '<div><div>hello</div>');
    expect(result.status).toBe('warning');
    const divWarning = result.messages.some((m) => m.includes('div'));
    expect(divWarning).toBe(true);
  });

  it('returns idle for empty content', () => {
    const result = validateContent('html', '');
    expect(result.status).toBe('idle');
  });

  it('returns warning for unbalanced angle brackets', () => {
    const result = validateContent('html', '<div>text without closing angle');
    // The < in <div> and no matching > at the end causes imbalance? No — let's
    // use a string that is clearly unbalanced in < vs >.
    // validateContent will be 'warning' if unbalanced < >
    // Actually, '<div>text without closing angle' has balanced < and > from <div>
    // Let's use a proper unbalanced case
    const r2 = validateContent('html', '<unclosed');
    expect(r2.status).toBe('warning');
  });
});

// ─── CSS mode ────────────────────────────────────────────────────────────────

describe('validateContent – css', () => {
  it('returns success for valid CSS', () => {
    const css = 'body {\n  color: red;\n  font-size: 16px;\n}';
    const result = validateContent('css', css);
    expect(result.status).toBe('success');
  });

  it('returns warning for unbalanced curly braces', () => {
    const css = 'body {\n  color: red;';
    const result = validateContent('css', css);
    expect(result.status).toBe('warning');
    const braceWarning = result.messages.some((m) => m.includes('大括號') || m.includes('{'));
    expect(braceWarning).toBe(true);
  });

  it('returns idle for empty content', () => {
    const result = validateContent('css', '');
    expect(result.status).toBe('idle');
  });
});

// ─── plain mode ──────────────────────────────────────────────────────────────

describe('validateContent – plain', () => {
  it('returns idle for any non-empty content', () => {
    const result = validateContent('plain', 'some text here');
    expect(result.status).toBe('idle');
  });

  it('returns idle for empty content', () => {
    const result = validateContent('plain', '');
    expect(result.status).toBe('idle');
  });

  it('returns idle for Chinese text', () => {
    const result = validateContent('plain', '這是中文內容。');
    expect(result.status).toBe('idle');
  });
});
