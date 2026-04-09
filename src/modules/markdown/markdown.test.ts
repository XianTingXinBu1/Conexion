// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useMarkdown } from './useMarkdown';

describe('markdown security boundaries', () => {
  beforeEach(() => {
    const { reset } = useMarkdown();
    reset();
  });

  it('keeps external links hardened after safe rendering', () => {
    const { renderSafe } = useMarkdown();

    const html = renderSafe('[safe](https://example.com)');

    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('does not allow quoted title payloads to break into real link attributes', () => {
    const { render } = useMarkdown();

    const html = render('[safe](https://example.com "bad\" onclick=\"alert(1)")');

    expect(html).toContain('<a href="https://example.com"');
    expect(html).not.toContain(' onclick="alert(1)"');
  });

  it('escapes image attributes during raw markdown rendering', () => {
    const { render } = useMarkdown();

    const html = render('![safe alt](https://example.com/test.png "title &quot;quoted&quot;")');

    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/test.png"');
    expect(html).toContain('title="title &amp;quot;quoted&amp;quot;"');
  });
});
