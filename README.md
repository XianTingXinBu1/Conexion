# Conexion

**English** | [简体中文](./README.zh-CN.md)

Conexion is a mobile-first LLM chat roleplay app that talks to any OpenAI-compatible endpoint.

The project consists of:

- A Vue 3 + TypeScript + Vite frontend
- A Node.js backend that proxies upstream requests and persists data as JSON

## Quick start

```bash
npm install
cp .env.example .env              # adjust upstream, port, data directory
sh scripts/dev/manage.sh start    # start backend + frontend, wait for health check
```

Then open `http://127.0.0.1:3100` in a browser.

The other `manage.sh` commands:

```bash
sh scripts/dev/manage.sh restart   # restart
sh scripts/dev/manage.sh status    # status / ports / log paths
sh scripts/dev/manage.sh logs      # follow logs, optionally frontend / backend
sh scripts/dev/manage.sh stop      # stop
```

PIDs and logs live under `.runtime/` (`pids/`, `logs/`). Both processes are started as their own
process group and terminated as a group: `npm run dev:server` spawns `sh -c` → `tsx` → `node`, so
terminating only npm's PID would leave orphaned processes still occupying the port. Before starting,
the script reclaims **this project's** leftover processes on 3100 / 3900; if either port is held by
something unrelated, it exits with an error instead of killing it.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `HOST` | `127.0.0.1` | Backend listen address |
| `PORT` | `3900` | Backend port |
| `CLIENT_ORIGIN` | `http://127.0.0.1:3100` | Allowed CORS origin |
| `DEFAULT_UPSTREAM_BASE_URL` | empty | Default OpenAI-compatible upstream |
| `DEFAULT_UPSTREAM_API_KEY` | empty | Default upstream API key |
| `ALLOW_PRIVATE_UPSTREAMS` | empty | Allow localhost / LAN upstreams |
| `MAX_BODY_BYTES` | `1048576` | Request body limit (1 MiB) |
| `CONEXION_DATA_DIR` | `.runtime/data` | Data directory |

## Data storage

Runtime data is plain local JSON:

```txt
.runtime/data/
  conversations.json       user-characters.json    ai-characters.json
  knowledge-bases.json     api-presets.json        prompt-presets.json
  regex-rules.json         settings.json
```

The backend is the source of truth; the frontend never reads or writes browser localStorage / IndexedDB.

## Backend

The frontend sends requests to the local `/api`, and the backend proxies them upstream; streaming
chat responses are passed through as-is.

```txt
server/index.ts        # process entry: reads config, starts @hono/node-server
server/app.ts          # Hono wiring: CORS, routes, error handling
server/routes/*.ts     # domain-split routes
```

- Error retries happen only in the backend: GET retries twice; POST failures are not retried
- `baseURL` only accepts `http` / `https`
- Localhost / LAN upstreams are allowed only while the backend is bound to a local address; binding to a public address disallows them by default
- Set `ALLOW_PRIVATE_UPSTREAMS=true` to allow them explicitly

The full API contract lives in `docs/backend-api.txt`.

## Key mechanics

### Macros and regex

User input and AI output go through the same pipeline:

```txt
raw --[before-macro rules]--> macro expansion --> [after-macro rules] --> stored / displayed
```

- **Every rule runs exactly once**: `before-macro` and `after-macro` are mutually exclusive
- **Macros expand exactly once**, between the two stages: a `{{char}}` introduced by an
  `after-macro` rule is never expanded again
- **Code regions are left untouched**: `{{...}}` inside fenced code blocks (``` / ~~~) and inline
  code stays as-is, so snippets like `{{ user }}` in Vue / Handlebars examples survive
- **Expansion happens before storage**: display, storage, and the upstream request always agree,
  and history is never re-expanded, so `{{date}}` does not drift from day to day
- **One timestamp per turn**: `now` is captured once on send, so a user message and its reply share it

Macro scope differs between the two sides:

| Location | Macros expanded? |
|---|---|
| Custom prompt item `prompt`, built-in templates themselves | yes |
| Chat content (user input / AI output) outside code regions | yes |
| Injected runtime data (character fields, knowledge base text, compression summary, chat history) | no, inserted verbatim |
| Code blocks and inline code inside chat content | no |

See `src/modules/system-prompt/README.md` for the variable list.

### Prompt building and conversation compression

Send, prompt preview, and context stats share a single build chain (`buildSystemPrompt`):

```txt
send / preview / stats -> buildChatSystemMessagesUseCase -> buildSystemPrompt
```

Compression marks everything outside the summary as summarized: **the original messages stay in the
conversation file** and are merely hidden from the message list and the prompt, replaced by the
summary. Manual compression consumes all current messages (keeps 0); automatic compression keeps the
last 2.

## Project layout

```txt
server/          built-in backend (Hono routes, repositories, JSON storage)
scripts/         architecture boundary check, health check, dev process management
e2e/             Selenium end-to-end tests
docs/            architecture, backend API contract, project status
src/
  api/           HTTP client and stream parsing
  app/           app-level providers / injection keys
  components/    page components and shared UI
  composables/   cross-page capabilities
  features/      feature-scoped modules (including chat's application / presentation layers)
  modules/       mostly self-contained modules (system-prompt, markdown, notification…)
  repositories/  storage access entry points
  router/        routing
  services/      service layer
  styles/ utils/ styles and shared helpers
```

## Architecture boundaries

```txt
View -> ViewModel -> Controller/Facade -> UseCase -> Repository/Gateway -> Storage/API
```

```bash
npm run check:architecture
```

- `ChatPage.vue` must not depend directly on the API, repositories, services, modules, or shared composable business logic
- chat presentation must not reach raw storage / constants
- chat application must not depend on Vue, UI, storage, notification, or composables

Layering details live in `docs/chat-architecture.md`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `dev:client` | Vite dev server (:3100) |
| `npm run dev:server` | Built-in backend (:3900) |
| `npm run build` | Type-check and build the frontend |
| `npm run preview` | Preview the build output |
| `npm run test:run` | Vitest unit tests (`test` runs in watch mode) |
| `npm run test:coverage` | Unit tests with coverage |
| `npm run check:architecture` | Architecture boundary check |
| `npm run e2e` | Selenium end-to-end tests, backend + frontend must be running (see `e2e/README.md`) |
| `npm run health-check` | Full health check (types / deps / architecture / tests / build / E2E) |
| `npm run health-check:quick` | Skip tests, build, and E2E |

Verification scope by change type:

| Type | Verification needed |
|---|---|
| General change | `test:run` + `check:architecture` + `build` |
| Chat module | `test:run` + `check:architecture` |
| Rendering / macros / routing (browser behavior) | additionally run `e2e` |
| Before committing | `health-check` |

## Docs

- `docs/chat-architecture.md`: chat module layering and boundary rules
- `docs/backend-api.txt`: backend API contract
- `docs/project-status.md`: current state, conventions, roadmap
- `e2e/README.md`: writing and running end-to-end tests

Module docs: `src/modules/{api-preset,character-card,debug,markdown,notification,system-prompt}/README.md`
(`chat-prompt` and `conversation-compression` are covered in `docs/chat-architecture.md`)

> Docs under `docs/`, module READMEs, and code comments are currently Chinese-only.

Other languages: [简体中文](./README.zh-CN.md)

## License

MIT
