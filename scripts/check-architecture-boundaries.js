#!/usr/bin/env node

import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(process.cwd(), 'src');

// fs.globSync 是 Node 22 才进 stdlib 的。旧版本上它是 undefined，
// 直接调会抛 TypeError，检查脚本本身挂掉而给不出结论。
if (typeof globSync !== 'function') {
  console.error(
    `架构边界检查需要 Node.js 22+（fs.globSync 不可用），当前版本：${process.version}`,
  );
  process.exit(1);
}

// 测试文件不参与生产代码的边界检查。
//
// 注意：这里刻意不使用 globSync 的 ignore / exclude 选项。
// 该处原本写成 `ignore`，但 Node 的 fs.globSync 只认 `exclude`，
// 参数被静默忽略后导致 src/**/__tests__/** 与 *.test.ts 一直在被扫描。
// 改为显式过滤，语义自证且不会因为选项名写错而失效。
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$|(^|\/)__tests__\//;

const files = globSync('src/**/*.{ts,vue}').filter(
  file => !TEST_FILE_PATTERN.test(file.replaceAll('\\', '/')),
);

const rules = [
  {
    name: 'Chat presentation must not import raw storage/constants',
    file: /src\/(components\/ChatPage\.vue|features\/chat\/presentation\/.*\.(ts|vue))$/,
    forbidden: [
      /@\/utils\/storage|\.\.\/.*utils\/storage/,
      /@\/constants|\.\.\/.*constants/,
    ],
  },
  {
    name: 'Chat application must stay Vue/UI/storage free',
    file: /src\/features\/chat\/application\/.*\.ts$/,
    forbidden: [
      /^vue$/,
      /@\/utils\/storage|\.\.\/.*utils\/storage/,
      /@\/components|\.\.\/.*components/,
      /@\/modules\/notification|\.\.\/.*modules\/notification/,
      /@\/composables|\.\.\/.*composables/,
    ],
  },
  {
    // 文件本身不允许存在（位置约束），与 imports 无关。
    name: 'Compression domain must not live in legacy util/composable/chat component paths',
    file: /src\/(utils\/conversationCompression\.ts|composables\/useConversationCompression\.ts|features\/chat\/presentation\/useChatCompressionController\.ts|components\/chat\/CompressionSummaryCard\.vue)$/,
    banned: true,
  },
  {
    name: 'Chat prompt adapter must not live in legacy feature/composable paths',
    file: /src\/(features\/chat\/application\/buildSystemMessages\.usecase\.ts|composables\/useChatPromptBuilder\.ts|composables\/useChatPageController\.ts)$/,
    banned: true,
  },
  {
    // 聊天专属 composable 属于 chat feature，不应放回全局 composables 目录。
    // 全局 composables 只放跨页面通用能力。
    name: 'Chat-specific composables must live under features/chat/presentation',
    file: /src\/composables\/useChat.*\.ts$/,
    banned: true,
  },
  {
    name: 'System prompt engine must stay adapter/repository/UI free',
    file: /src\/modules\/system-prompt\/.*\.ts$/,
    forbidden: [
      /@\/features|\.\.\/.*features/,
      /@\/composables|\.\.\/.*composables/,
      /@\/repositories|\.\.\/.*repositories/,
      /@\/components|\.\.\/.*components/,
    ],
  },
  {
    name: 'ChatPage must only depend on chat presentation entry, chat UI, compression module and shared styles',
    file: /src\/components\/ChatPage\.vue$/,
    forbidden: [
      /@\/composables|\.\.\/composables/,
      /@\/repositories|\.\.\/repositories/,
      /@\/services|\.\.\/services/,
      /@\/modules\/(?!conversation-compression)|\.\.\/modules\/(?!conversation-compression)/,
      /@\/api|\.\.\/api/,
    ],
  },
];

/**
 * 静态 import / re-export 的说明符。
 *
 * 关键是不能用 `.+?` 跨行：格式化后的具名导入经常写成多行
 * （`import {\n  a,\n  b,\n} from '@/utils/storage'`），旧正则会静默放过这类违规。
 * 这里用有界的 `[\s\S]{0,400}?`，既能跨行，又不会一路贪到下一个语句；
 * 没有 ` from ` 的裸导入（`import 'x'`）与 re-export（`export * from 'x'`）都能命中。
 */
const STATIC_IMPORT_PATTERN = /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]{0,400}?\s+from\s+)?['"]([^'"]+)['"]/g;
/** 动态 `import('x')` 同样绕过边界规则 */
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function getImports(source) {
  const imports = [];

  for (const regex of [STATIC_IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source))) {
      imports.push({ specifier: match[1], index: match.index });
    }
  }

  return imports;
}

const violations = [];

for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  const source = readFileSync(file, 'utf8');
  const imports = getImports(source);

  for (const rule of rules) {
    if (!rule.file.test(normalized)) continue;

    // banned 规则只看文件位置，与文件内容无关：
    // 这类规则之前用 forbidden: [/.*/] 表达，但 forbidden 匹配的是 import 说明符，
    // 所以一个没有任何 import 的文件会绕过检查。
    if (rule.banned) {
      violations.push({
        rule: rule.name,
        file: normalized,
        line: 1,
        specifier: null,
      });
      continue;
    }

    for (const imported of imports) {
      for (const forbidden of rule.forbidden) {
        if (forbidden.test(imported.specifier)) {
          const line = source.slice(0, imported.index).split('\n').length;
          violations.push({
            rule: rule.name,
            file: normalized,
            line,
            specifier: imported.specifier,
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary violations found:\n');
  for (const violation of violations) {
    if (violation.specifier === null) {
      console.error(`- ${violation.file} 不允许存在于该位置`);
    } else {
      console.error(`- ${violation.file}:${violation.line} imports "${violation.specifier}"`);
    }
    console.error(`  rule: ${violation.rule}`);
  }
  process.exit(1);
}

console.log(`Architecture boundary check passed (${files.length} files scanned under ${relative(process.cwd(), root)}).`);
