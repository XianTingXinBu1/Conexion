# 角色卡模块

负责角色卡的导入与导出。字段命名对齐 SillyTavern v2 角色卡，目标是**能互相导入**。

```txt
src/modules/character-card/
├── index.ts
├── cardCodec.ts
└── __tests__/
    └── cardCodec.test.ts
```

## 支持的输入

| 格式 | 结构 |
|------|------|
| SillyTavern v2 单卡 | `{ spec: 'chara_card_v2', data: { ... } }` |
| SillyTavern v1 扁平卡 | `{ name, description, first_mes, ... }` |
| 本应用备份 | `{ spec: 'conexion.characters/v1', characters: [...] }` |
| 裸数组 | 上面两种对象组成的数组 |

容错策略：整体结构不对就抛 `CharacterCardParseError`；单个角色缺 `name` 就跳过。

## 支持的输出

- `serializeCharacterCard(character)`：单张 ST v2 卡，给别的应用用。
  刻意不带 `id` / `knowledgeBaseId` 等应用内字段，避免污染可移植数据。
- `serializeCharacterBackup(characters)`：全量备份，保留知识库绑定等应用内字段。

## 字段映射

| 内部字段（camelCase） | ST 字段（snake_case） |
|---|---|
| `description` | `description` |
| `personality` | `personality` |
| `scenario` | `scenario` |
| `firstMessage` | `first_mes` |
| `exampleDialogue` | `mes_example` |
| `creatorNotes` | `creator_notes` |
| `creator` | `creator` |
| `characterVersion` | `character_version` |
| `tags` | `tags`（兼容 v1 的逗号分隔字符串） |
| `alternateGreetings` | `alternate_greetings` |

未映射（导入时忽略）：`system_prompt`、`post_history_instructions`、`character_book`、`extensions`。

## 导入语义

导入是**新增**而不是覆盖：每次导入都分配新 `id`，并丢掉指向已不存在知识库的
`knowledgeBaseId`（校验在 `RoleManagementPage.handleImportFile` 里做）。

## 验证建议

```bash
npm run test:run
```
