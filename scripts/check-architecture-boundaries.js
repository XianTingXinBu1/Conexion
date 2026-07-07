#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { globSync } from 'node:fs';

const root = resolve(process.cwd(), 'src');
const files = globSync('src/**/*.{ts,vue}', {
  ignore: [
    'src/**/*.test.ts',
    'src/**/__tests__/**',
  ],
});

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
    name: 'Compression domain must not live in legacy util/composable/chat component paths',
    file: /src\/(utils\/conversationCompression\.ts|composables\/useConversationCompression\.ts|features\/chat\/presentation\/useChatCompressionController\.ts|components\/chat\/CompressionSummaryCard\.vue)$/,
    forbidden: [/.*/],
  },
  {
    name: 'Chat prompt adapter must not live in legacy feature/composable paths',
    file: /src\/(features\/chat\/application\/buildSystemMessages\.usecase\.ts|composables\/useChatPromptBuilder\.ts|composables\/useChatPageController\.ts)$/,
    forbidden: [/.*/],
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

function getImports(source) {
  const imports = [];
  const regex = /^import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let match;
  while ((match = regex.exec(source))) {
    imports.push({ specifier: match[1], index: match.index });
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
    console.error(`- ${violation.file}:${violation.line} imports "${violation.specifier}"`);
    console.error(`  rule: ${violation.rule}`);
  }
  process.exit(1);
}

console.log(`Architecture boundary check passed (${files.length} files scanned under ${relative(process.cwd(), root)}).`);
