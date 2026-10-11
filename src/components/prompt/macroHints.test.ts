/**
 * 变量 chips 与运行时宏定义的一致性测试
 *
 * 放在组件目录而不是 system-prompt 模块内：模块侧不允许依赖 components
 * （见 scripts/check-architecture-boundaries.js）。
 */

import { describe, expect, it } from 'vitest';
import { PROMPT_MACRO_HINTS } from './macroHints';
import { DISPLAYED_MACROS, MACRO_DEFINITIONS, SUPPORTED_MACROS } from '@/modules/system-prompt/core/macro';

describe('prompt macro hints', () => {
  it('derives chips from the runtime macro definitions', () => {
    expect(PROMPT_MACRO_HINTS.map(hint => hint.token)).toEqual(
      DISPLAYED_MACROS.map(definition => `{{${definition.name}}}`),
    );
  });

  it('exposes every chip token in the runtime macro table', () => {
    for (const hint of PROMPT_MACRO_HINTS) {
      expect(SUPPORTED_MACROS).toContain(hint.token.slice(2, -2));
    }
  });

  it('hides aliases from chips but keeps them supported', () => {
    const tokens = PROMPT_MACRO_HINTS.map(hint => hint.token);

    expect(tokens).not.toContain('{{charname}}');
    expect(tokens).not.toContain('{{username}}');
    expect(SUPPORTED_MACROS).toContain('charname');
    expect(SUPPORTED_MACROS).toContain('username');
  });

  it('labels every displayed macro', () => {
    for (const hint of PROMPT_MACRO_HINTS) {
      expect(hint.label.length).toBeGreaterThan(0);
    }
    expect(MACRO_DEFINITIONS.length).toBeGreaterThan(PROMPT_MACRO_HINTS.length);
  });
});
