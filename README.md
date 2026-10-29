# CopilotKit + LlamaIndex Test Suite

A navigable, working test harness for the CopilotKit ↔ LlamaIndex integration — one route per doc page, each running against a real agent and showing the exact source that makes it work.

| | |
| --- | --- |
| **Doc sync date** | Machine-maintained — `doc-snapshot/manifest.json` → `syncedAt`, rewritten on every sync |
| **Docs tracked** | <https://docs.copilotkit.ai/llamaindex> |
| **CopilotKit** | `@copilotkit/react-core` ^1.75.1 (v2 surface) · `@copilotkit/runtime` ^1.75.1 · `@copilotkit/a2ui-renderer` ^1.75.1 |
| **AG-UI** | `@ag-ui/llamaindex` ^0.2.0 · `@ag-ui/client` 0.0.59 · `llama-index-protocols-ag-ui` 0.5.0 (installed) |
| **zod** | ^3.25.76 — pinned to 3.x for the A2UI renderer; see Known issues |
| **Runtime** | v2 multi-route — `createCopilotRuntimeHandler` at `app/api/copilotkit/[[...slug]]/route.ts`, 4 verbs. Verified: `/info` 200 with 5 agents, `mode` flips `sse` → `intelligence` with a key. |
| **Build** | `tsc --noEmit` ❌ 7 errors, all in `shared-state/predictive-state-updates/demo-chat/page.tsx` (doc's `useAgent({ render })`, no suppression in place) — every other file type-checks · backend imports and mounts all ten routers ✅ · `next build` not re-run since the A2UI / OGUI / HITL / Sub-Agents routes were added |
| **CI** | none |

---

## Overview

LlamaIndex agents speak [AG-UI](https://ag-ui.com) through `llama-index-protocols-ag-ui`, which wraps a `Workflow` in a FastAPI router exposing a single streaming `POST /run` endpoint. CopilotKit's runtime binds that endpoint with a `LlamaIndexAgent` and gives the React app hooks and chat components on top of it.

This repo turns every page under <https://docs.copilotkit.ai/llamaindex> into a route you can actually click, type into, and watch fail or succeed. Every tool, system prompt, and state shape in `backend/agents.py` is lifted from a doc sample — nothing was designed here. Where a doc sample does not compile or does not run against the shipped packages, the route says so in an on-page callout and the discrepancy is listed in [Known issues](#9-known-issues--doc-vs-implementation-discrepancies) below.

---

## Architecture

```
Browser
  │  CopilotChat / CopilotSidebar / useAgent      (@copilotkit/react-core/v2)
  ▼
Next.js app  ──  /api/copilotkit/[[...slug]]        (@copilotkit/runtime/v2)
  │              createCopilotRuntimeHandler serves /info, runs, threads
  │              CopilotRuntime resolves an agent id → LlamaIndexAgent
  │              (@ag-ui/llamaindex — an HttpAgent subclass)
  │                        │
  │                        └── optional: CopilotKitIntelligence
  ▼                             (threads + the Inspector's Threads tab)
FastAPI  ──  POST /run, /sample_agent/run, …       (llama-index-protocols-ag-ui)
  │          AGUIChatWorkflow: folds state into the last user message,
  │          streams the model, runs backend tools, emits AG-UI events as SSE
  ▼
OpenAI
```

- **Backend language:** Python 3.10+ / FastAPI. (This varies per framework — LlamaIndex is Python.)
- **The OpenAI key lives only in the Python process.** The browser never talks to the agent directly; the runtime proxies every run server-side.
- **Frontend tools need no backend registration.** `AGUIChatWorkflow` reads `RunAgentInput.tools` on every run and converts anything unknown into a pass-through tool, so `sayHello`, `showWeather`, and `humanApprovedCommand` never appear in `agents.py`.
- **The runtime route is a catch-all, not a URL.** `createCopilotRuntimeHandler` serves a subtree — `/info`, agent runs, thread list/rename/delete — so the file lives at `[[...slug]]/route.ts` and exports GET, POST, PATCH, and DELETE. Mounted at a plain `route.ts` it answers `GET /info` with a 200 while 404-ing every run, which looks like a connected app that never replies.

---

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | The docs state 20+; this repo was built and verified on the Node bundled with `next@16.3.0`. |
| Python | 3.10+ | `backend/.python-version` pins 3.12 for `uv`. |
| `uv` | any recent | <https://docs.astral.sh/uv/> — used for the backend venv and lockfile. |
| npm | bundled with Node | Any package manager works; commands below use npm. |
| OpenAI API key | — | The only credential this repo needs. |

Optional: a **CopilotKit Intelligence** project API key (`cpk-…`). Provision one with `npx copilotkit login && npx copilotkit project select`, or copy it from the [cloud dashboard](https://docs.copilotkit.ai/llamaindex/premium/managed-intelligence-platform). Without it the runtime falls back to SSE mode with an in-memory runner: every route in this harness still works, and only persistent Threads and the Inspector's Threads tab stay locked.

---

## Setup

```bash
# 1. Clone
git clone <this-repo> llamaindex
cd llamaindex

# 2. Frontend dependencies
cd frontend && npm install && cd ..

# 3. Backend dependencies (creates backend/.venv)
cd backend && uv sync && cd ..

# 4. Environment
cp .env.example backend/.env
# then edit backend/.env
```

`backend/.env` variables:

| Variable | Required | What it does |
| --- | --- | --- |
| `OPENAI_API_KEY` | **yes** | The key every agent uses. `main.py` exits at startup if it is unset. |
| `OPENAI_CHAT_MODEL_ID` | no | Overrides the model. Defaults to `gpt-4o-mini`. Set it to `gpt-5.4` to reproduce the doc's literal call — see [Known issues](#9-known-issues--doc-vs-implementation-discrepancies). |
| `AGENT_PORT` | no | Uvicorn port. Defaults to `8000`. Change this and `LLAMAINDEX_AGENT_URL` together. |

Frontend variables go in `frontend/.env.local` (Next.js does not read `backend/.env`):

| Variable | Required | What it does |
| --- | --- | --- |
| `LLAMAINDEX_AGENT_URL` | no | Where the runtime reaches the agent. Defaults to `http://localhost:8000`. Use `http://127.0.0.1:8000` if `localhost` resolves to IPv6 while uvicorn binds IPv4. |
| `COPILOTKIT_LICENSE_TOKEN` | no | **Separate from the key below, and the one the Threads Drawer gates on.** The runtime builds a `licenseChecker` from it; `/info` reports `licenseStatus` off that checker and returns `"none"` without it. The drawer renders its locked Upgrade view unless the status is `valid` or `expiring` — even when threads work. Server-side secret. |
| `INTELLIGENCE_API_KEY` | no | CopilotKit Intelligence project key. **Server-side secret — never give it a `NEXT_PUBLIC_` prefix.** Set it and the runtime switches from SSE mode to Intelligence mode, unlocking Threads. |
| `NEXT_PUBLIC_DEMO_USER_ID` / `NEXT_PUBLIC_DEMO_USER_NAME` | no | Identity the provider sends as `x-user-id` / `x-user-name`, which the runtime's `identifyUser` turns into a per-user thread history. Defaults to `harness-local` / `Harness User`. Change them to watch two "users" get separate thread lists. |
| `NEXT_PUBLIC_SITE_ORIGIN` | no | Origin the home page uses for its server-side `GET /api/copilotkit/info` probe. Defaults to `http://127.0.0.1:$PORT`; set it only behind a proxy. |

**Ports:** frontend `3000`, backend `8000`.

---

## Running the project

Two terminals — there is no combined dev script in this repo.

```bash
# Terminal 1 — agent
cd backend
uv run main.py
```

Successful startup prints:

```
INFO:     Started server process [...]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://localhost:8000 (Press CTRL+C to quit)
```

```bash
# Terminal 2 — app
cd frontend
npm run dev
```

Successful startup prints `▲ Next.js 16.3.0` and `- Local: http://localhost:3000`.

Open **<http://localhost:3000>**. The home page runs a live probe against `http://localhost:8000/health` and shows a green row when the agent is reachable. Sanity-check the backend on its own with:

```bash
curl http://localhost:8000/health
# {"status":"healthy","agent":"llamaindex"}
```

And sanity-check the runtime the same way. `/info` is how the frontend negotiates
its transport, so a 200 here is what proves the multi-route handler is mounted at
the catch-all path:

```bash
curl -s http://localhost:3000/api/copilotkit/info | head -c 120
# {"version":"1.66.4","agents":{"my_agent":{...},"mode":"sse",...
```

`mode` is the honest answer to "is Intelligence on": `"sse"` without a key,
`"intelligence"` with one. Note that the bare `POST /api/copilotkit` **404s by
design** — it is not the transport. That 404 alongside a 200 on `/info` is the
signature of a correctly mounted multi-route handler, and also of a mis-mounted
one, which is why the connection panel reads `mode` rather than guessing.

### How the app is laid out

Every doc page gets **two** routes:

- `/<path>` — notes, the discrepancies found on that page, and the implementation source read live off disk.
- `/<path>/demo-chat` — the interactive surface with no harness chrome, so it can be screen-recorded on its own. The "Open demo ↗" button on each notes page goes there.

`/status` lists every route and its status in one table.

---

## What to expect — walkthrough per section

### Getting Started

**`/` — Introduction.** Orientation, a live connection check, and the table of five agents. The panel probes two things per render: the agent's `/health`, and the runtime's own `GET /api/copilotkit/info`.
*Try:* press **Re-check** with the backend stopped.
*Pass:* the "LlamaIndex AG-UI server" row turns red with the connection error while "Copilot Runtime (multi-route)" stays green — they are independent processes. Restart the agent and re-check: both green.
*Fail:* the runtime row is red too, or reports a non-200 from `/info` — the handler is not mounted at the catch-all path.

**`/quickstart` → `/quickstart/demo-chat` — Quickstart.** The bring-your-own-agent path, running on the doc's own `app/providers.tsx` (`<CopilotKit runtimeUrl="/api/copilotkit" agent="my_agent" useSingleEndpoint={false}>`), rendered by a route `layout.tsx` in place of the doc's root layout. The page is the doc's: a heading and a bare `<CopilotSidebar />`.
*Try:* `Can you tell me a joke?`
*Pass:* the sidebar is open on load; tokens stream in a word at a time and render as markdown.
*Fail:* nothing streams, or an error banner appears — the agent process is down, or `OPENAI_CHAT_MODEL_ID` names a model your key cannot reach.

### CopilotKit Intelligence

Not a route — a mode the whole harness runs in, reported on the home page.

*Try:* with no `INTELLIGENCE_API_KEY`, open `/` and read the "CopilotKit Intelligence" row, then open any demo and click the Inspector's **Threads** tab.
*Pass:* the row reads `mode "sse"` and explains the in-memory fallback; Threads shows three local example threads and an **Enable Intelligence** action. Every chat route still works.
*Then:* put a `cpk-…` key in `frontend/.env.local` as `INTELLIGENCE_API_KEY` and restart.
*Pass:* the row flips to `mode "intelligence"` with all four `threadEndpoints` on, and the Inspector's Threads tab lists real threads. Send a message and the thread appears in your project dashboard.
*Fail:* the row still says `mode "sse"` — the key is in the wrong file, or was given a `NEXT_PUBLIC_` prefix, which the runtime does not read.

A caveat the panel states and the docs are explicit about: `mode "intelligence"` proves the key was *read*, not that the platform *accepted* it. A rejected key reports the same thing. The dashboard is the only real confirmation.

### Basics

**`/prebuilt-components` → demo — Prebuilt Components.** `CopilotChat`, `CopilotSidebar`, and `CopilotPopup` on tabs, all driving `my_agent`. Only one mounts at a time — the sidebar and popup both use fixed positioning and would overlap.
*Try:* `What is CopilotKit?` on one tab, then switch tabs.
*Pass:* the conversation carries across tabs; only the chrome changes.
*Fail:* a tab renders blank, or the popup launcher never appears in the corner.

### Rich Threads

All three interactive routes below need the runtime in **Intelligence mode** — see the CopilotKit Intelligence section above. Verified against a live Intelligence-mode runtime: `/api/copilotkit/threads?agentId=my_agent` returns real rows with LLM-generated names, scoped to the `endUserId` the provider sends.

**`/prebuilt-components/copilot-threads-drawer` → demo — Threads Drawer.** `<CopilotThreadsDrawer>` beside `<CopilotChat>`, both inside one shared `<CopilotChatConfigurationProvider>` — which is the whole integration. No active-thread state, no selection handler, no props between them.
*Try:* say `Hello`, press **New Conversation** in the drawer, say `Hello` again, then click the first row.
*Pass:* two rows, each with a generated name. Clicking a row replays that conversation into the chat; New Conversation clears to the welcome screen.
*Fail:* the drawer shows a locked view instead of a list — that is the no-key state, not a bug.

The demo has three tabs at the top, one per sample on the doc page. The above is tab 1.

- **Tab 2 · Drawer + CopilotSidebar.** The same drawer, but the chat is hosted in `<CopilotSidebar defaultOpen>`. The layout is the doc's as written. The doc never defines `<YourMainContent />`, so a labelled placeholder stands in for it.
  *Try:* say `Hello`, then select the new row and press New Conversation. *Pass:* the sidebar is open on load, selecting a row replays it inside the sidebar, and New Conversation resets it. *Fail:* selecting a row leaves the sidebar unchanged.
- **Tab 3 · Your own "New conversation" button.** This tab has a second row of controls:
  - **`startNewThread()`** — the doc's header button, using `useCopilotChatConfiguration()`.
  - **Controlled threadId** — the doc's `ControlledChat`, with the thread id held in app state and passed to the drawer through `onThreadSelect` and `onNewThread`.
  - **A CSS checkbox** — injects the doc's `::part(new-thread-button)` / `::part(launcher-new-thread)` rule.

  *Try:* say `Hello`, press the header button, say `Hi`. Repeat in controlled mode, then tick the box. *Pass:* each press shows the welcome screen with no row selected, and a second row appears after the next reply. Ticking the box hides the drawer's own New Conversation row. *Fail:* the button does nothing, or controlled mode logs a "threadId is controlled" warning when you click a drawer row.

**`/headless-threads` → demo — Headless Threads.** The same data through `useThreads`, drawn by hand, with the `threadId` passed to the chat as ordinary React state.
*Try:* send a message, then press **Rename** on its row.
*Pass:* the row relabels to "Renamed" with no refresh, and selecting rows swaps the chat's history.
*Fail:* Rename throws — the runtime is in SSE mode, where `/info` reports `mutations: false`.
*Why it exists alongside the drawer:* rename is a `useThreads` action the prebuilt drawer's row menu does not surface. That is the doc's own stated reason to go headless.

**`/threads-lifecycle` → demo — Thread & History Lifecycle.** Where a `threadId` comes from, and the difference between switching and starting fresh.
*Try:* note the `threadId`, press **New chat**, then pick the earlier conversation and press **Open conversation**.
*Pass:* New chat mints a different id and clears the view. Open conversation restores the earlier id, flips `explicit` to `true`, and replays that conversation.
*Also try:* **Set id, no replay** — same id, but the welcome screen instead of history. That is `explicit: false`.
*Fail:* Open conversation changes the id but the chat stays empty — there is no server-side store to replay from.

**`/threads-import` — Synchronize Thread History.** 📄 Notes only, and not because of a gap in this repo: the importer supports Google ADK and LangGraph, and there is no LlamaIndex source. The page records the CLI flow as published.

### Custom Look and Feel

**`/custom-look-and-feel/slots` → demo — Slots.** Three tabs, one per customization level: a Tailwind class string merged into the slot, a props object set on the default component, and a whole replacement component.
*Try:* `Hello there`, then switch tabs.
*Pass:* level 1 tints the messages and outlines the input; level 2 focuses the input on mount; level 3 shows a plainly different message layout.
*Fail:* all three tabs look identical — the slot props are not reaching the component.

**`/custom-look-and-feel/headless-ui` → demo — Headless UI.** A chat built entirely from `useAgent` + `useCopilotKit`, with no CopilotKit chrome at all.
*Try:* `Tell me a joke`, then press **Stop** mid-stream.
*Pass:* messages land in the hand-written bubbles, "Thinking..." shows while running, and Stop halts the stream.
*Fail:* Send does nothing, or the assistant reply never appears — `copilotkit.runAgent()` is not being awaited.

**`/programmatic-control` → demo — Programmatic Control.** No chat component anywhere: a state panel, a message box, Run and Stop buttons, plus the doc's `ThemeSelector` writing straight into `agent.state`.
*Try:* `What's the weather in Tokyo?` via **Run agent**; then press **Dark Mode**.
*Pass:* status flips to Running, the message count climbs, the reply streams into the transcript, and `user_theme` appears in the raw state block immediately.
*Fail:* nothing happens on Run — the `agentId` does not match a registered agent.

**`/inspector` → demo — Inspector.** The provider mounts the overlay via `showDevConsole="auto"`; the demo just gives it traffic.
*Try:* `What's the weather in San Francisco?`, then open the inspector docked at the window edge.
*Pass:* AG-UI Events fills, and Available Agents lists all five ids.
*Fail:* the overlay never appears — you are running a production build, where it is force-disabled.

### Generative UI

**`/generative-ui/your-components/display-only` → demo — Display-only.** `useComponent` registers a React component as a tool with no handler.
*Try:* `Show the weather card for Tokyo: 77 degrees, clear`
*Pass:* a bordered weather card renders inline in the chat with the values the agent chose.
*Fail:* a plain-text answer with no card — the model did not call the tool.

**`/generative-ui/your-components/interactive` → demo — Interactive.** `useHumanInTheLoop` builds an approval gate; the run suspends until you click.
*Try:* `Run the command rm -rf /tmp/cache`
*Pass:* an approval card with the command in a code block, and nothing further streams until you press Approve or Deny. The agent's next message reflects which you chose.
*Fail:* the agent describes the command in prose and carries on without waiting.

**`/generative-ui/tool-rendering` → demo — Tool Rendering.** A named renderer for the backend `getWeather` tool, plus a wildcard fallback for everything else.
*Try:* `What's the weather in Tokyo?`
*Pass:* "Calling weather API..." appears, then becomes "Called the weather API for Tokyo."
*Fail:* the tool call renders as raw JSON — the renderer name and the Python function name disagree (note the docs' prose says `get_weather`; the function is `getWeather`).

**`/generative-ui/state-rendering` → demo — State Rendering ⚠️.** `search_agent`'s `searches` list, streamed by `StateSnapshotWorkflowEvent` and rendered beside the chat.
*Try:* `Search for the tallest mountains`, then `Now also search for the deepest oceans`
*Pass:* an item appears on ❌ while `addSearch` runs, flips to ✅ about a second later when `runSearches` completes it, and the second prompt adds a row without dropping the first.
*Fail:* the list stays empty while the chat replies — the model answered without calling `addSearch`.
*Partial because:* the doc's in-chat variant uses a `render` prop that `useAgent` does not have.

The next three routes are built from each page's **demo Code tab** — the full llamaindex source the docs site shows under the interactive demo — copied byte-for-byte. Each mounts its own `<CopilotKit>` against its own single-route runtime, exactly as the demo does. The backend halves live in `backend/demos/`.

**`/generative-ui/a2ui/dynamic-schema` → demo — A2UI · Dynamic Schema ⚠️.** A plain LlamaIndex router (prompt only, no backend tools) calls the runtime-injected `render_a2ui` tool to design a surface from the page's catalog; the A2UI middleware mounts the streamed call. The demo Code tab's planner agent was replaced with this, by request.
*Try:* `Show me my sales dashboard for this quarter.`
*Pass:* one short sentence, then a surface of metric tiles / a table / a chart under it, laid out differently per prompt.
*Fail:* text only (the model answered without calling `render_a2ui`), or a "Catalog not found" render error.
*Partial because:* not yet checked in a browser.

**`/generative-ui/a2ui/fixed-schema` → demo — A2UI · Fixed Schema ⚠️.** A pre-authored `flight_schema.json`; `display_flight` supplies four data fields bound by JSON Pointer.
*Try:* `Find me a flight from SFO to JFK on United for $289.`
*Pass:* a flight card — "Flight Details", SFO → JFK, a UNITED badge, $289, and a "Book flight" button that does nothing (by design).
*Fail:* blank codes/airline/price means the binder did not resolve `{ "path": … }` bindings (it only understands zod 3 schemas — see Known issues); React error #31 means a bound prop reached a renderer as a raw object.
*Partial because:* not yet checked in a browser.

**`/generative-ui/open-generative-ui` → demo — Open Generative UI ⚠️.** The runtime's `openGenerativeUI` flag injects `generateSandboxedUi`; the model writes HTML/CSS/JS into a sandboxed iframe. A minimal/advanced switcher flips between the page's two demos.
*Try:* minimal — `Quicksort visualization`; advanced — `Calculator (calls evaluateExpression)`.
*Pass:* minimal — placeholder lines, then one animated, labelled SVG visual in an iframe, and the run ends. Advanced — one interactive widget at full height; using it logs `[open-gen-ui/advanced] evaluateExpression …` in the browser console and shows the host's result.
*Fail:* a prose description and no iframe — the tool never reached the model.
*Partial because:* both agents' unpublished `make_request_aware_router` import is swapped for the stock router, and both published prompts loop without a harness remedy (see Known issues).

### Human-in-the-loop

**`/human-in-the-loop/index` → demo — HITL Overview ⚠️.** The page's `hitl-in-chat` demo, verbatim: `useHumanInTheLoop` registers `book_call`, which renders a time picker and holds the run until you choose.
*Try:* `Please book an intro call with the sales team to discuss pricing.`
*Pass:* a time-picker card appears and the reply stops; pick a slot and the agent confirms that exact time.
*Fail:* the agent invents a time with no card, or picking a slot does nothing.
*Partial because:* not yet checked in a browser; the docs' dedicated `/hitl-in-chat` backend is unpublished, so the Quickstart router serves it.

**`/human-in-the-loop/governed-actions` → demo — Governed Action Approval UI ❌.** The `useHumanInTheLoop` half: `approve_governed_action` renders `GovernedActionCard`, which auto-approves `allow`, blocks `deny`, and waits on `require_approval`.
*Try:* `Use approve_governed_action to apply a 30% discount to account NW-8812, verdict require_approval.`
*Pass (only because the prompt names the verdict):* "User approval required", the summary/tool/reference, an arguments block (likely a quoted string) and two unstyled buttons; the run waits, and the reply follows your choice.
*Fail:* no card and a prose answer — name the tool explicitly as above.
*Broken because:* without `verdict require_approval` in the prompt, the card renders with no buttons (observed). The adapter flattens frontend-tool schemas to strings — see Known issues. The `useInterrupt` half also cannot run (the LlamaIndex adapter never emits interrupts) and is shown as text.

### App Control

**`/frontend-tools` → demo — Frontend Tools.** The doc's `sayHello` tool, executing in the browser.
*Try:* `Say hello to Damien`
*Pass:* a browser alert reads "Hello, Damien!"; after you dismiss it the agent confirms.
*Fail:* a text reply with no alert — you are not on the demo route, so the tool was never registered.

### Shared State

**`/shared-state/in-app-agent-read` → demo — Reading agent state.** `sample_agent`'s `language`, read through `agent.state` next to the chat.
*Try:* `Hello`, then `What language are you using?`
*Pass:* the Language line reads `english` as soon as the run starts (not when it ends), and the agent answers in English.
*Fail:* the panel stays on `—` after a full reply.
*Note:* this router has no backend tools, so asking it to "switch to Spanish" changes the reply language but not the state. That is what the next route is for.

**`/shared-state/in-app-agent-write` → demo — Writing agent state.** Two buttons, showing the difference between a passive `setState` and one followed by a hint message and a re-run.
*Try:* **Toggle Language**, then ask `what language are you using?`; then press **Toggle + re-run agent**.
*Pass:* the panel flips instantly; the agent answers in Spanish on the next message. Toggle + re-run makes it answer immediately without you typing.
*Fail:* the panel changes but the agent keeps answering in English.

**`/shared-state/workflow-execution` → demo — Workflow Execution.** One state object split three ways: `question` in, `answer` out, `resources` server-side only.
*Try:* `What's the capital of France?`, then `Who wrote The Left Hand of Darkness? Track your sources.`
*Pass:* Question fills immediately, Answer fills when `answerQuestion` runs, and `resources` stays `[]` in the raw state block even on the second prompt.
*Fail:* Answer never appears — the model replied in prose instead of calling `answerQuestion`.

**`/shared-state/predictive-state-updates` → demo — Predictive State Updates ⚠️.** `execute_task` emits a snapshot after every step it finishes.
*Try:* `Teach me how to fix a tire`
*Pass:* a step list appears with everything on ⏳, then items flip to ✅ one at a time roughly half a second apart, before the chat reply finishes.
*Fail:* the whole list appears already completed in one jump.
*Partial because:* same missing `render` prop as State Rendering.

### LlamaIndex

**`/multi-agent-flows` → demo — Multi-Agent Flows ⚠️.** Agent Lock across all five ids, plus the two provider snippets side by side.
*Try:* ask `What's the weather in Oslo?` on `my_agent`, switch to `search_agent`, ask it to search for something.
*Pass:* each agent answers only with its own tools, and switching shows an empty conversation rather than the previous agent's history.
*Fail:* an agent-not-found error on one tab.
*Partial because:* Router Mode needs an LLM service adapter on the runtime, which this repo deliberately does not configure — the workflows call the model themselves.

**`/multi-agent/subagents` → demo — Sub-Agents ⚠️.** The page's demo, verbatim: a supervisor whose three tools each run a separate `FunctionAgent` (research, writing, critique), logging every delegation into shared state.
*Try:* `Produce a short blog post about the benefits of cold exposure training. Research first, then write, then critique.`
*Pass:* a "Supervisor running" pill, then Research → Writing → Critique entries land in the log one by one with task and result, and the chat ends with a short summary.
*Fail:* a direct answer with an empty log, or entries appearing only after the run ends.
*Partial because:* not yet checked in a browser.

### Backend

**`/copilot-runtime` → demo — Copilot Runtime.** The live runtime config, routing across five ids, the `default` agent, and the direct-connection tradeoff.
*Try:* `Hello` on each of the five tabs.
*Pass:* all five stream a reply; each keeps its own message list.
*Fail:* one id errors — it is missing from the runtime's `agents` map, or its router is not included in `main.py`.

**`/ag-ui` → demo — AG-UI.** A live capture of the raw event stream beside the chat producing it, with Pause and Clear.
*Try:* `What's the weather in Tokyo?`
*Pass:* `RUN_STARTED`, an early `STATE_CHANGED` from the workflow's opening snapshot, a burst of `TEXT_MESSAGE_CONTENT`, `TOOL_CALL_START`/`END` around `getWeather`, `TOOL_CALL_RESULT`, then `RUN_FINISHED`.
*Fail:* the log stays empty while the chat streams — the subscription is bound to a different agent than the chat.

---

## Testing checklist / current status

| Doc page | Route | Status | Notes |
| --- | --- | --- | --- |
| [Introduction](https://docs.copilotkit.ai/llamaindex) | `/` | ✅ Working | Reference/landing page with a live health probe. |
| [Quickstart](https://docs.copilotkit.ai/llamaindex/quickstart?agent=bring-your-own) | `/quickstart` | ✅ Working | Demo runs on the doc's own `providers.tsx` via a route layout. Model id in the sample does not exist — see Known issues. |
| [Prebuilt Components](https://docs.copilotkit.ai/llamaindex/prebuilt-components) | `/prebuilt-components` | ✅ Working | Doc page renders from a component, so there is no markdown sample to diff. |
| [Threads Drawer](https://docs.copilotkit.ai/llamaindex/prebuilt-components/copilot-threads-drawer) | `/prebuilt-components/copilot-threads-drawer` | ✅ Working | Needs Intelligence mode; renders a locked view without a key. |
| [Headless Threads](https://docs.copilotkit.ai/llamaindex/headless-threads) | `/headless-threads` | ✅ Working | Needs Intelligence mode. Implements rename, which the drawer omits. |
| [Thread & History Lifecycle](https://docs.copilotkit.ai/llamaindex/threads-lifecycle) | `/threads-lifecycle` | ✅ Working | Switch/start always live; replay needs a server-side store. |
| [Synchronize Thread History](https://docs.copilotkit.ai/llamaindex/threads-import) | `/threads-import` | 📄 Reference | **Not implementable** — the importer supports ADK and LangGraph only. No LlamaIndex source exists. |
| [Slots](https://docs.copilotkit.ai/llamaindex/custom-look-and-feel/slots) | `/custom-look-and-feel/slots` | ✅ Working | Not in the doc sidebar. Custom-component sample needs a cast. |
| [Headless UI](https://docs.copilotkit.ai/llamaindex/custom-look-and-feel/headless-ui) | `/custom-look-and-feel/headless-ui` | ✅ Working | Not in the doc sidebar. |
| [Programmatic Control](https://docs.copilotkit.ai/llamaindex/programmatic-control) | `/programmatic-control` | ✅ Working | Bare `useAgent()` replaced with an explicit `agentId`. |
| [Inspector](https://docs.copilotkit.ai/llamaindex/inspector) | `/inspector` | ✅ Working | Enabled via `showDevConsole="auto"`, not `enableInspector`. |
| [Display-only](https://docs.copilotkit.ai/llamaindex/generative-ui/your-components/display-only) | `/generative-ui/your-components/display-only` | ✅ Working | Not in the doc sidebar. |
| [Interactive](https://docs.copilotkit.ai/llamaindex/generative-ui/your-components/interactive) | `/generative-ui/your-components/interactive` | ✅ Working | Not in the doc sidebar. Generic supplied explicitly. |
| [Tool Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/tool-rendering) | `/generative-ui/tool-rendering` | ✅ Working | Tool name and render props both drift from the samples. |
| [State Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/state-rendering) | `/generative-ui/state-rendering` | ⚠️ Partial | State streams; the doc's in-chat `render` prop does not exist. |
| [A2UI · Dynamic Schema](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/dynamic-schema) | `/generative-ui/a2ui/dynamic-schema` | ⚠️ Partial | From the demo Code tab, verbatim. Not yet checked in a browser. Demo runtime sets `injectA2UITool: true`; prose says no `a2ui` block is needed. |
| [A2UI · Fixed Schema](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/fixed-schema) | `/generative-ui/a2ui/fixed-schema` | ⚠️ Partial | From the demo Code tab, verbatim. Not yet checked in a browser. Demo sets `injectA2UITool: true` where prose says `false`. Book button inert by design. |
| [MCP Apps](https://docs.copilotkit.ai/llamaindex/generative-ui/mcp-apps) | — | 🚧 Not started | Skipped by request. The page's sample is a `BuiltInAgent`, not LlamaIndex. |
| [Open Generative UI](https://docs.copilotkit.ai/llamaindex/generative-ui/open-generative-ui) | `/generative-ui/open-generative-ui` | ⚠️ Partial | From the demo Code tabs. Not yet checked in a browser. Unpublished `make_request_aware_router` swapped for the stock router. |
| [HITL Overview](https://docs.copilotkit.ai/llamaindex/human-in-the-loop/index) | `/human-in-the-loop/index` | ⚠️ Partial | From the demo Code tab, verbatim. Not yet checked in a browser. Unpublished `/hitl-in-chat` router → Quickstart router. |
| [Governed Action Approval UI](https://docs.copilotkit.ai/llamaindex/human-in-the-loop/governed-actions) | `/human-in-the-loop/governed-actions` | ❌ Broken | Observed: card renders without Approve/Reject unless the prompt names the verdict — the adapter flattens frontend-tool params to strings. `useInterrupt` and `executeSideEffect` are reference text. |
| [Frontend Tools](https://docs.copilotkit.ai/llamaindex/frontend-tools) | `/frontend-tools` | ✅ Working | |
| [Reading agent state](https://docs.copilotkit.ai/llamaindex/shared-state/in-app-agent-read) | `/shared-state/in-app-agent-read` | ✅ Working | Not in the doc sidebar. `initialState` on `useAgent` does not exist. |
| [Writing agent state](https://docs.copilotkit.ai/llamaindex/shared-state/in-app-agent-write) | `/shared-state/in-app-agent-write` | ✅ Working | Not in the doc sidebar. |
| [Workflow Execution](https://docs.copilotkit.ai/llamaindex/shared-state/workflow-execution) | `/shared-state/workflow-execution` | ✅ Working | Not in the doc sidebar. |
| [Predictive State Updates](https://docs.copilotkit.ai/llamaindex/shared-state/predictive-state-updates) | `/shared-state/predictive-state-updates` | ⚠️ Partial | Progress streams; the doc's in-chat `render` prop does not exist. |
| [Multi-Agent Flows](https://docs.copilotkit.ai/llamaindex/multi-agent-flows) | `/multi-agent-flows` | ⚠️ Partial | Agent Lock works. Router Mode needs a service adapter this repo omits. |
| [Sub-Agents](https://docs.copilotkit.ai/llamaindex/multi-agent/subagents) | `/multi-agent/subagents` | ⚠️ Partial | From the demo Code tab, verbatim. Not yet checked in a browser. |
| [Copilot Runtime](https://docs.copilotkit.ai/llamaindex/copilot-runtime) | `/copilot-runtime` | ✅ Working | `a2ui` / `mcpApps` middleware not configured — no route needs them. |
| [AG-UI](https://docs.copilotkit.ai/llamaindex/ag-ui) | `/ag-ui` | ✅ Working | |

Pages in the LlamaIndex sidebar that this repo does **not** cover, because they were outside the requested scope: CopilotKit CLI, Build with agents, the whole Rich Threads group, MCP Apps, A2UI, the Intelligence Platform group, and Troubleshooting.

---

## 9. Known issues / doc-vs-implementation discrepancies

### Two credentials gate Intelligence, and the Threads Drawer uses the less obvious one

The docs consistently say threads "require CopilotKit Intelligence" and point at the project API key. That is necessary but not sufficient for the prebuilt drawer. Traced through the shipped code:

| Credential | What it controls | How to check |
| --- | --- | --- |
| `INTELLIGENCE_API_KEY` (`cpk-…`) | Runtime → platform. Makes `/info` report `mode: "intelligence"`; makes the thread endpoints return real rows. | `curl .../info \| grep mode` |
| `COPILOTKIT_LICENSE_TOKEN` / `licenseToken` | The runtime's `licenseChecker`. `/info` reports `licenseStatus` off it, `"none"` when absent. | `curl .../info \| grep licenseStatus` |

`<CopilotThreadsDrawer>` computes `licensed = licensePresent && checkFeature("threads")`, where `licensePresent` is `status === "valid" || status === "expiring"` — reading the **second** row. So with only the project key set, the drawer renders "Threads are a CopilotKit Intelligence feature / Upgrade" while `useThreads` on `/headless-threads` lists the same threads without complaint. While unlicensed the drawer also skips its thread fetch entirely, so it issues no network requests to debug from.

The connection panel now reports both axes on separate rows for exactly this reason.

### The Threads Drawer page now names a different credential and env var

As of the 2026-10-29 sync, the [Threads Drawer page](https://docs.copilotkit.ai/llamaindex/prebuilt-components/copilot-threads-drawer#intelligence-access) says three things that conflict with this repo:

- For cloud-hosted projects the credential is `CPK_INTELLIGENCE_API_KEY`. This repo, and `.env.example`, use `INTELLIGENCE_API_KEY`.
- With that key alone, the runtime grants the drawer's entitlement from the organization's subscription.
- `COPILOTKIT_LICENSE_TOKEN` is "only for offline or self-hosted licensing".

That contradicts the two-credential behaviour recorded above, which was observed on 1.75.1. With `@copilotkit/runtime` 1.83.0, `/info` no longer returns a `licenseStatus` field at all, so the old way of checking (`grep licenseStatus`) no longer works. Neither claim has been re-verified against a live Intelligence project on 1.83.0. Until it is, treat both the doc's version and the repo's version as unconfirmed.

### Threads Drawer samples that need filling in or adapting

- The sidebar sample renders `<YourMainContent />` without defining it. The demo uses a labelled placeholder.
- No sample sets an `agentId`. Under this repo's root `<CopilotKitProvider>`, which names no agent, the drawer and chat would resolve to `"default"`, and the runtime does not register that id. Every tab therefore sets `agentId="my_agent"` on the configuration provider.
- The controlled `ControlledChat` sample has no layout wrapper, so the drawer, button and chat stack in normal document flow. It is rendered that way, unchanged.
- `useState(() => crypto.randomUUID())` also runs during the server render, so the server and client start with different thread ids. That is harmless unless the id ends up in the markup. Watch the console for a hydration warning on the controlled tab.

### Two `startNewThread` functions, and only one moves the chat

`useThreads()` and `useCopilotChatConfiguration()` both return a `startNewThread`, and they do different jobs. The prebuilt drawer calls **both**: the `useThreads` one dispatches `newThreadStarted()` to the thread store (deselects the row, nothing more), and the configuration one mints the new id and shows the welcome screen.

In a prop-controlled chat — which is the shape of the docs' own headless `App.tsx` sample — the configuration setters no-op and warn, so the second step has to be yours. And clearing the `threadId` prop to `undefined` does **not** do it: the chat's fallback id is computed with `useMemo` at mount, so clearing the prop returns to the same id every time and the button appears dead. Bumping a React `key` forces the remount that re-runs that memo. The Lifecycle page documents this exact behaviour as a footgun ("a changed React `key` … produces a new id and silently starts a new conversation"); `/headless-threads` uses it deliberately.

### There is no LlamaIndex thread importer

[Synchronize Thread History](https://docs.copilotkit.ai/llamaindex/threads-import).

The page is served under `/llamaindex/`, but its supported-sources table lists only Google ADK and LangGraph, each linking to a framework-specific guide. Nothing on the page imports LlamaIndex conversations, so `/threads-import` in this harness is a notes route rather than a working one — not a gap in this repo. The final step of that flow ("keep future conversations synced") *is* implemented, by the Threads Drawer and Headless Threads routes.

### The Rich Threads group is absent from the sidebar's own framework pages

The LlamaIndex sidebar lists Rich Threads (Overview, Threads Drawer, Headless Threads, Thread & History Lifecycle, Synchronize Thread History), and all of those pages resolve. But their samples are framework-neutral — `useThreads`, `CopilotThreadsDrawer`, and `setActiveThreadId` are the same on every integration, and the only LlamaIndex-specific content is the URL prefix. Nothing on these four pages needed adapting for LlamaIndex; the runtime half was already in place from the Intelligence wiring.

### The runtime route moved, and the old shape fails silently

[Quickstart](https://docs.copilotkit.ai/llamaindex/quickstart?agent=bring-your-own), [Copilot Runtime](https://docs.copilotkit.ai/llamaindex/copilot-runtime).

The docs moved from the v1 GraphQL runtime to `@copilotkit/runtime/v2`. This repo followed. What changed:

| | Before | After |
| --- | --- | --- |
| Import | `@copilotkit/runtime` | `@copilotkit/runtime/v2` |
| Route file | `app/api/copilotkit/route.ts` | `app/api/copilotkit/[[...slug]]/route.ts` |
| Verbs | `POST` | `GET`, `POST`, `PATCH`, `DELETE` |
| Handler | `copilotRuntimeNextJSAppRouterEndpoint` → `{ handleRequest }` | `createCopilotRuntimeHandler` → a fetch handler |
| Service adapter | required (`ExperimentalEmptyAdapter`) | **gone** — no counterpart on the v2 surface |

The failure mode for the old shape is worth stating plainly: `GET /info` keeps returning 200 while every agent run 404s, so the app looks connected and simply never answers. That is why the connection panel probes `/info` and prints the reported `mode` instead of just checking reachability.

### `useSingleEndpoint` means different things on `<CopilotKit>` and `<CopilotKitProvider>`

[Copilot Runtime](https://docs.copilotkit.ai/llamaindex/copilot-runtime), [Runtime endpoints](https://docs.copilotkit.ai/llamaindex/backend/runtime-endpoints#provider-and-handler-pairs).

The Quickstart passes `useSingleEndpoint={false}` on `<CopilotKit>`. Older releases of that wrapper pinned the flag to `true`, which 404s against a multi-route handler, so the prop was load-bearing. In 1.75.1 `<CopilotKit>` forwards the prop to `<CopilotKitProvider>` untouched, and an omitted flag means auto-detect from `/info` on both. That is why the demo pages copied from the docs' Code tabs — which mount `<CopilotKit>` with no flag, against single-route runtimes — still connect. The Quickstart demo keeps the prop because the doc sets it.

### `/info` reports `threadEndpoints.list: true` in SSE mode

Not a doc error, but a trap when writing a health check. The in-memory runner backs thread list and inspect locally, so those two flags are `true` with no key at all — only `mutations` and `realtimeMetadata` flip with Intelligence. Verified both ways against this repo's runtime:

```
no key   → mode "sse"          threadEndpoints { list: true, inspect: true, mutations: false, realtimeMetadata: false }
with key → mode "intelligence" threadEndpoints { list: true, inspect: true, mutations: true,  realtimeMetadata: true  }
```

The panel therefore keys off `mode`, not off the flags.

### "Enterprise Intelligence Platform" was renamed to "CopilotKit Intelligence"

Renamed across the docs on 2026-08-26 (see `doc-snapshot/CHANGELOG.md`). The old `NEXT_PUBLIC_COPILOTKIT_LICENSE_KEY` / `publicLicenseKey` provider prop is not how the runtime is wired to the platform: the key is `INTELLIGENCE_API_KEY`, it is server-side only, and it reaches the runtime through a `CopilotKitIntelligence` client rather than through the provider. This repo dropped the public license key entirely.

### `OpenAI(model="gpt-5.4")` — every Python sample

Every LlamaIndex doc page opens with this line. `gpt-5.4` is not an id the OpenAI API serves, so a verbatim copy fails on the first request with a model-not-found error. `backend/llm.py` keeps the shape of the call, defaults to `gpt-4o-mini`, and reads `OPENAI_CHAT_MODEL_ID` as the override. Set that variable to `gpt-5.4` to reproduce the published behaviour.

### `useAgent` has no `initialState` and no `render`

[Reading agent state](https://docs.copilotkit.ai/llamaindex/shared-state/in-app-agent-read), [Writing agent state](https://docs.copilotkit.ai/llamaindex/shared-state/in-app-agent-write), [State Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/state-rendering), [Predictive State Updates](https://docs.copilotkit.ai/llamaindex/shared-state/predictive-state-updates).

`UseAgentProps` in `@copilotkit/react-core` 1.66.x accepts exactly `agentId`, `threadId`, `runtimeAgentId`, `updates`, and `throttleMs`. Passing `initialState` or `render` is a type error.

- `initialState` is redundant anyway — `initial_state` on `get_ag_ui_workflow_router`, which the same pages show, is the seed that works.
- `render` has no equivalent, so this repo draws agent state beside the chat instead of inside it. That is why State Rendering and Predictive State Updates are marked ⚠️ Partial. Both routes print the doc's non-compiling snippet next to the working one.

### The weather tool is named `getWeather`, not `get_weather`

[Tool Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/tool-rendering) defines `def getWeather(location)` and then says one line below that "your agent will be able to call the `get_weather` tool". [Programmatic Control](https://docs.copilotkit.ai/llamaindex/programmatic-control) also uses `get_weather` in its `defineToolCallRenderer` example. Only the Python function name reaches the model, so renderers must use `getWeather`.

### Tool render props: `args` vs `parameters`

[Tool Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/tool-rendering). The named `useRenderTool` sample destructures `{ status, args }`, but the shipped hook derives render props from `parameters` and exposes them as `props.parameters`. The wildcard `useDefaultRenderTool` sample also destructures `args`, which its render props do not provide either — `name`, `status`, and `result` are what it gives you.

### `useHumanInTheLoop` does not infer its arg type

[Interactive](https://docs.copilotkit.ai/llamaindex/generative-ui/your-components/interactive). Unlike `useRenderTool`, this hook does not derive its render-prop type from `parameters`; it defaults to `Record<string, unknown>`, which makes `args.command` unusable in JSX. The demo supplies the generic explicitly: `useHumanInTheLoop<{ command: string }>({ ... })`.

### The custom `messageView` slot needs a cast

[Slots](https://docs.copilotkit.ai/llamaindex/custom-look-and-feel/slots). The sample passes a bare function component. The slot's type is `typeof CopilotChatMessageView`, which also carries a static `Cursor` sub-component, so a plain function is not assignable. The sample's props are also unannotated, which is an implicit-any error under `strict`.

### `@copilotkit/react-ui` is listed but never used

[Quickstart](https://docs.copilotkit.ai/llamaindex/quickstart?agent=bring-your-own) installs `@copilotkit/react-ui`, but every sample below it imports from `@copilotkit/react-core/v2`. [Predictive State Updates](https://docs.copilotkit.ai/llamaindex/shared-state/predictive-state-updates) goes further and imports `CopilotSidebar` from `@copilotkit/react-ui` while importing hooks and the stylesheet from v2. `react-ui` is the v1 package; this repo does not depend on it and takes the sidebar from v2.

### `stepProgress` does not exist

[Predictive State Updates](https://docs.copilotkit.ai/llamaindex/shared-state/predictive-state-updates). The callout under the Python sample says state is emitted "each time the agent calls the `stepProgress` tool". There is no such tool on the page — it is `execute_task`.

### Shared State pages link to the LangGraph quickstart

[Reading](https://docs.copilotkit.ai/llamaindex/shared-state/in-app-agent-read), [Writing](https://docs.copilotkit.ai/llamaindex/shared-state/in-app-agent-write), [State Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/state-rendering), [Tool Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/tool-rendering). Every "Run and connect your agent" step points at `/langgraph/quickstart` and the LangGraph coagents-starter, not the LlamaIndex ones. Harmless, but it sends you to the wrong framework.

### Prebuilt Components has no readable source

<https://docs.copilotkit.ai/llamaindex/prebuilt-components> renders entirely from a `<PrebuiltComponents />` React component, so its markdown carries no code to diff against. This route was built from the component names and the props the Quickstart and Slots pages use.

### One router serves one state shape

Not a doc error, but the reason this repo departs structurally from every sample. `get_ag_ui_workflow_router` takes exactly one `initial_state` and one `backend_tools` list, and the doc pages define four different state shapes plus a stateless agent. Serving them all means five routers behind five FastAPI prefixes, and five ids in the runtime — where each doc page shows one called `my_agent`.

---

### The newer pages keep their real code in the demo Code tab, not the prose

[A2UI · Dynamic Schema](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/dynamic-schema), [A2UI · Fixed Schema](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/fixed-schema), [Open Generative UI](https://docs.copilotkit.ai/llamaindex/generative-ui/open-generative-ui), [HITL Overview](https://docs.copilotkit.ai/llamaindex/human-in-the-loop/index), [Sub-Agents](https://docs.copilotkit.ai/llamaindex/multi-agent/subagents).

The prose on these pages prints fragments: a catalog without its runtime, a delegation log without the page that wires it, a runtime flag without the agent. The complete llamaindex source is in the **Code** tab of each page's interactive demo, and that source is what this repo runs, copied byte-for-byte. The Code tab shows only some files as tabs. The rest (`_components/`, `suggestions.ts`, the subagent activity card and banner) ship in the same demo-source bundle on the docs site, and the notes pages label which is which. The page markdown (`<page>.md`) contains none of it — only an `<!-- interactive demo: … -->` marker — so the doc-drift check cannot see changes to this code.

### A2UI: the prose and the demo disagree on `injectA2UITool`

[Fixed Schema → Registering the runtime](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/fixed-schema#registering-the-runtime), [Dynamic Schema → Pass the catalog to the provider](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/dynamic-schema).

Fixed-schema prose says to set `injectA2UITool: false` because the agent owns its tool. Dynamic-schema prose says the catalog alone is enough and the runtime needs no `a2ui` block. Both demos' runtime routes set `injectA2UITool: true`, and dynamic also sets `defaultCatalogId`. Their comments explain why: the middleware only watches the `render_a2ui` tool-call name when injection is on, and the LlamaIndex agents mount surfaces by re-emitting a streamed `render_a2ui` call. With the prose's config the surface would never mount. This repo runs the demo config and shows the prose snippets beside it.

The dynamic page's "opted out of auto-inject" section is also LangGraph code (`ag_ui_langgraph.get_a2ui_tools`, `ChatOpenAI`) and has no LlamaIndex equivalent on the page.

### A2UI needs zod 3; the page's install line installs zod 4

[Fixed Schema → Install the renderer package](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/fixed-schema#install-the-renderer-package).

The page says `npm install @copilotkit/a2ui-renderer zod`, which today resolves zod 4. `@copilotkit/a2ui-renderer` 1.75.1 depends on zod ^3.25, types `CatalogDefinitions` against zod 3's `ZodObject`, and `@a2ui/web_core`'s binder detects bindable props by reading zod 3's `_def.typeName === "ZodUnion"`. On zod 4, every catalog definition fails to type-check. At runtime no `{ "path": … }` binding resolves: the fixed-schema flight card renders with blank airport codes, airline and price, because the renderers' `s()` helper turns the unresolved object into `""`. The doc samples also use zod 3's single-argument `z.record(...)`, and so does governed-actions. This repo pins `zod@^3.25.76`, the same as the renderer, and changes no doc code.

### A2UI's workflow override predates the adapter's dynamic-tool handling

`backend/demos/a2ui_fixed.py`. (The dynamic-schema agent originally shared this override; it has since been replaced with a plain router.)

It overrides `AGUIChatWorkflow.aggregate_tool_calls` and describes the override as matching the upstream body of llama-index-protocols-ag-ui **0.2.2**. The installed 0.5.0 also counts tools injected at request time (`dynamic_frontend_tool_names`) as frontend tools. The override classifies only `self.frontend_tools` and `self.backend_tools`, so if the model ever calls an injected tool directly (with `injectA2UITool: true`, the middleware injects one), that result falls into neither list and the workflow loops instead of stopping. Kept verbatim; watch for it if a run hangs.

### Open Generative UI imports an unpublished module

[Open Generative UI](https://docs.copilotkit.ai/llamaindex/generative-ui/open-generative-ui), demo Code tab → `src/agents/open_gen_ui_agent.py`, `open_gen_ui_advanced_agent.py`.

Both agents call `make_request_aware_router` from `agents/_request_tools.py`, which no page or demo bundle publishes. Their comments say it exists so requests match recorded test fixtures. It takes the same keyword arguments as `get_ag_ui_workflow_router`, and llama-index-protocols-ag-ui 0.5.0 already forwards request-time tools like `generateSandboxedUi` as pass-through tools. So this repo aliases the import to the stock router and leaves the call untouched. The swap is marked `DOC GAP` in both files.

### Open Generative UI prompts re-draw the UI on every follow-up

[Open Generative UI](https://docs.copilotkit.ai/llamaindex/generative-ui/open-generative-ui), demo Code tab → both agents' `SYSTEM_PROMPT`.

Observed: one "Calculator" prompt produced three separate calculators and the run kept going. The client registers `generateSandboxedUi` with `handler: async () => "UI generated"` and `followUp: true`, so every call is answered and the agent re-runs. Both published prompts say to call the tool "on every user turn … exactly once", and the model treats each follow-up as a new turn. In the advanced demo each iframe was also clipped at 200px. The renderer measures content only if its sandbox (loaded through an async `import()`) exists when `generating` flips to false. The LlamaIndex adapter emits the whole tool call as one chunk followed immediately by `TOOL_CALL_END`, so that flip arrives first, the measurement never retries, and the iframe stays at `initialHeight`, which defaults to 200 and which the advanced prompt never sets.

A second observation, in the advanced demo: the widget rendered but its Evaluate button did nothing. Two causes, both confirmed in package source. (1) The provider sends the sandbox functions' names, parameter schemas and return shapes (and the design skill) as `RunAgentInput.context`, and the published advanced prompt tells the model to read them "from your agent context". llama-index-protocols-ag-ui 0.5.0 never reads `input_data.context`, so the model guesses the call signature. (2) With the whole tool call arriving at once, `jsFunctions`/`jsExpressions` can be queued before the renderer rebuilds the sandbox for the finished HTML, and that rebuild empties the queue.

Remedy, kept separate from the doc code: each agent file keeps the published router verbatim, then a `# region follow-up-remedy` block rebinds the router with `SYSTEM_PROMPT + FOLLOW_UP_RULE`. The rule says to stop once the `"UI generated"` result arrives. In the advanced agent it also says to set `initialHeight`, lists the two sandbox-function contracts copied from `sandbox-functions.ts` (keep them in sync), and asks for all JavaScript in an inline `<script>` in the HTML, which runs because websandbox loads the HTML as the iframe's `srcdoc`. The underlying gap — the adapter drops `context` — also means the minimal demo's `designSkill` never reaches its model; its own prompt already carries similar guidance.

### The LlamaIndex adapter flattens frontend-tool schemas to strings

[Governed Action Approval UI](https://docs.copilotkit.ai/llamaindex/human-in-the-loop/governed-actions); package bug in `llama-index-protocols-ag-ui` 0.5.0, `agent.py` → `_ag_ui_tool_to_llama_index`.

Frontend tools reach a LlamaIndex agent as AG-UI tool definitions carrying a full JSON schema. The adapter rebuilds each one as a Pydantic model in which every property is `str` (or `Optional[str]`), keeping only names, descriptions and the required list. Enums, numbers, arrays and objects are all lost before the schema reaches the model.

Observed on `/human-in-the-loop/governed-actions`: "Before emailing carol@northwind.test about her $420 refund, get my approval with approve_governed_action" drew the card with no Approve/Reject buttons, and `arguments` rendered as one quoted string. The model saw `verdict: string` with no allowed values and did not write exactly `require_approval`. The card's status line treats any unknown verdict as "User approval required", but its buttons render only for that exact string. Naming the verdict in the prompt works around it.

Left unfixed by decision; the route is marked Broken. The same flattening applies to any frontend tool with non-string parameters, for example `render_a2ui`'s `components` array on the dynamic-schema route.

### HITL and governed actions publish no backend

[HITL Overview](https://docs.copilotkit.ai/llamaindex/human-in-the-loop/index), [Governed Action Approval UI](https://docs.copilotkit.ai/llamaindex/human-in-the-loop/governed-actions).

The HITL demo's `route.ts` sends `hitl-in-chat` to a dedicated `/hitl-in-chat` router that no file in the docs defines. Governed actions publishes no agent at all, and its resume handler calls an undefined `executeSideEffect`. Both only need a frontend tool forwarded, so both agent ids point at the Quickstart router. Governed actions' `useInterrupt` half cannot run here: llama-index-protocols-ag-ui never emits an AG-UI interrupt. It is shown as text, as in the google-adk harness.

### The demo code hardcodes `gpt-5-mini` and reads `AGENT_URL`

Everything under `backend/demos/` constructs `OpenAI(model="gpt-5-mini")` directly so `OPENAI_CHAT_MODEL_ID` does not reach these agents. The copied runtime routes read `AGENT_URL`, not this repo's `LLAMAINDEX_AGENT_URL`. Both default to `http://localhost:8000`.

### MCP Apps — skipped

[MCP Apps](https://docs.copilotkit.ai/llamaindex/generative-ui/mcp-apps). Not implemented, by request. For whoever picks it up: the page's sample is a `BuiltInAgent` (`openai/gpt-5.4`) plus an MCP server you run yourself on `localhost:3108`, with no LlamaIndex code. The docs bundle has a separate LlamaIndex MCP demo (Excalidraw), which this page does not link and which also imports the unpublished `_request_tools`.

## Troubleshooting

The LlamaIndex Troubleshooting doc pages were outside the requested scope, so this section records what actually goes wrong in this repo.

**`ModuleNotFoundError` or an unexpected model error at backend startup.**
`main.py` exits immediately with a message if `OPENAI_API_KEY` is missing. If it starts but every chat errors, `OPENAI_CHAT_MODEL_ID` probably names a model your key cannot reach — including the docs' own `gpt-5.4`.

**`PydanticUserError: 'addSearch' is not fully defined; you should define 'Context'`.**
Adding `from __future__ import annotations` to `backend/agents.py` breaks every tool that takes `ctx: Context`. With postponed annotations the parameter type stays a string that Pydantic cannot resolve when it builds the tool schema, and the failure surfaces on the first model call rather than at import. The doc samples have no such import, and neither does this repo — do not add one to that file.

**Chat sends but nothing streams, and `/info` returns 200.**
The classic mis-mounted-handler signature. Confirm the route file is at `frontend/src/app/api/copilotkit/[[...slug]]/route.ts` — not `route.ts` — and that it exports all four verbs. A single-segment route serves `/info` and 404s every run.

**Threads stay locked even though the key is set.**
Check three things in order: the key is in `frontend/.env.local` (the runtime runs in the Next process, not the Python one), it has no `NEXT_PUBLIC_` prefix, and the home page's Intelligence row reports `mode "intelligence"`. If the row says `mode "sse"`, the key was never read. If it says `mode "intelligence"` but no thread appears in your project dashboard, the key was read and rejected — it is empty or belongs to a different project.

**Chat sends but nothing streams; the agent process logs nothing.**
The runtime cannot reach the backend. Check `curl http://localhost:8000/health` first. If that works but the app still cannot, set `LLAMAINDEX_AGENT_URL=http://127.0.0.1:8000` in `frontend/.env.local` — `localhost` resolving to IPv6 while uvicorn binds IPv4 is the usual cause, and it is the first item in the docs' own troubleshooting accordion.

**Every chat is silent, but the home page says the runtime is up.**
Classic mis-mounted handler. `GET /api/copilotkit/info` returning 200 only proves the handler is reachable *somewhere*; runs live on sub-paths. Confirm the file is at `frontend/src/app/api/copilotkit/[[...slug]]/route.ts` — a catch-all — and that it exports GET, POST, PATCH, and DELETE. `curl -s -o /dev/null -w '%{http_code}' -XPOST localhost:3000/api/copilotkit` returning 404 is correct and expected; the bare URL is not the transport.

**"New conversation" in a custom thread UI does nothing.**
`useThreads().startNewThread()` only clears the list selection — it does not change the chat's thread. If your chat takes a `threadId` prop, the configuration setters no-op, and setting the prop to `undefined` reuses the id minted at mount. Force a remount (change the React `key`) so a fresh id is minted. See `/headless-threads` for the working two-step.

**The Threads Drawer shows "Threads are a CopilotKit Intelligence feature / Upgrade".**
That is the license axis, not the threads axis — and the two are independent. Check `curl -s localhost:3000/api/copilotkit/info | grep -o '"licenseStatus":"[a-z]*"'`. If it says `none`, set `COPILOTKIT_LICENSE_TOKEN`; the `cpk-` project key does not supply it. Confirm threads themselves are fine by opening `/headless-threads`, which reads the same data through `useThreads` and is not license-gated.

**Threads are empty, or the Inspector's Threads tab shows example rows.**
The runtime is in SSE mode. Check the home page's "CopilotKit Intelligence" row, or `curl -s localhost:3000/api/copilotkit/info | grep -o '"mode":"[a-z]*"'`. If it says `sse` with a key set, the key is in the wrong file (it belongs in `frontend/.env.local`, since the runtime route runs in the Next process) or was given a `NEXT_PUBLIC_` prefix, which the runtime does not read.

**`mode` says `intelligence` but no threads appear in the dashboard.**
The key was read but rejected. `mode` reflects which constructor branch ran, not whether the platform accepted the credential — the docs are explicit that a green round trip in the browser proves nothing. A rejected key looks identical from inside the app; the project dashboard is the only confirmation.

**Every visitor shares one thread history.**
`identifyUser` is returning the same id for everyone. This repo derives it from the `x-user-id` header the provider sends, defaulting to `harness-local`. That is fine for a local harness and wrong for anything deployed — swap it for a server-verified session before putting this anywhere real.

**A route errors with an agent-not-found style message.**
The `agentId` on that page is not in the runtime's `agents` map, or its router is not included in `main.py`. This repo registers no `default` agent on purpose, so a missing id fails loudly instead of quietly answering from somewhere else.

**The Inspector never appears.**
It is force-disabled in production builds — run `npm run dev`. Do not mount `<CopilotKitInspector />` by hand either: it forwards `core ?? null` and reports "CopilotKit core not attached". `showDevConsole="auto"` on the provider is what mounts it correctly.

**A search sits on ❌ forever.**
`runSearches` was never called. The system prompt insists on it after every `addSearch`; a weaker model sometimes skips it. Ask the agent to run the searches.

**`npx tsc --noEmit` fails with `Cannot find name 'LayoutProps'`.**
That type is generated into `.next/types` by Next.js. Run `npm run build` (or `npm run dev`) once first.

---

## Doc drift detection

`/doc-sync` keeps this repo honest about the docs it mirrors. Press **Sync docs now** (on the landing page or on `/doc-sync`) and it fetches the markdown source behind all 19 tracked doc pages, diffs each against the copy stored in `doc-snapshot/`, replaces that copy, and reports what moved — ranked by whether the change can actually break an implementation.

Doc pages are fetched by appending `.md` to their URL, which returns the authored MDX rather than 250 KB of rendered HTML. Every response is checked for `text/markdown` before it is allowed near the snapshot: a URL that misses the markdown handler still answers `200` with the HTML app shell, and writing that in would destroy the baseline and report the whole corpus as rewritten on the next run. A run commits all pages or none.

**Severity is decided by where the edit landed**, not how big it was:

| Level | Trigger |
|---|---|
| **High** | a changed line inside a fenced code block, a changed fence count, or a page that now 404s and is gone from the sitemap |
| **Medium** | a changed heading, changed frontmatter `title`/`description`, or prose in the same section as changed code |
| **Low** | other prose |

**Sections checked** lists every tracked page in nav order with a mark — `✓` unchanged, `!` changed, `+` stored, `✗` 404, `~` unstable, `·` not checked. Expanding a row shows the comparison: for a changed page the diff (`−` existing snapshot, `+` newly fetched), and for an unchanged one the two matching hashes, which is the evidence the check ran.

**`doc-snapshot/CHANGELOG.md`** is the record that survives a re-sync. Because syncing replaces the copy it just compared against, the run *after* a change reports nothing — so the changelog is written at the moment of discovery and never rewritten later. Only changed pages are recorded; a clean run does not touch the file. It keeps the three most recent dated entries, counted rather than aged, so a change from six weeks ago still shows if nothing has happened since.

**One sync date.** `syncedAt` in `doc-snapshot/manifest.json`, rewritten on every run and shown on `/`, `/status` and `/doc-sync`. There is no hand-maintained date to keep in step with it.

**To test it**, edit any `doc-snapshot/pages/*.md` file and press the button — a line inside a code fence for High, a `##` heading for Medium, a sentence for Low. The comparison reads the stored file itself, so nothing else needs changing. Both `/doc-sync` and the changelog label the result as a local snapshot edit rather than upstream drift.

Commit `doc-snapshot/` — `pages/`, `manifest.json` and `CHANGELOG.md` are the baseline every diff is taken against. `reports/` is gitignored derived data.

---

## Project structure

```
llamaindex/
├── README.md
├── CLAUDE.md                      build instructions this repo follows
├── .env.example                   every variable, annotated
├── backend/
│   ├── main.py                    FastAPI app; includes the ten routers, /health
│   ├── agents.py                  every tool, system prompt, and initial_state — all from docs
│   ├── demos/                     agents copied from the pages' demo Code tabs, verbatim
│   │   ├── a2ui_dynamic.py        /a2ui-dynamic — plain router, prompt only (replaces the demo's)
│   │   ├── a2ui_fixed.py          /a2ui-fixed — display_flight + a2ui_schemas/*.json
│   │   ├── open_gen_ui_agent.py   /open-gen-ui (and _advanced_agent.py → /open-gen-ui-advanced)
│   │   └── subagents_agent.py     /subagents — supervisor + three FunctionAgents
│   ├── llm.py                     the shared OpenAI client and the model-id override
│   └── pyproject.toml             llama-index, llama-index-protocols-ag-ui, fastapi, uvicorn
└── frontend/
    ├── package.json               @copilotkit/react-core (v2 surface), @ag-ui/llamaindex
    └── src/
        ├── app/
        │   ├── layout.tsx                 root layout; one provider for the whole app
        │   ├── page.tsx                   Introduction + health probe
        │   ├── status/page.tsx            the status table
        │   ├── api/copilotkit/[[...slug]]/route.ts
        │   │                              the Copilot Runtime — eight agent
        │   │                              bindings + optional Intelligence
        │   ├── api/copilotkit-declarative-gen-ui/route.ts   ┐ single-route runtimes
        │   ├── api/copilotkit-a2ui-fixed-schema/route.ts    │ copied from the demo
        │   ├── api/copilotkit-ogui/route.ts                 ┘ Code tabs
        │   └── <doc-path>/
        │       ├── page.tsx               notes, discrepancies, live source
        │       └── demo-chat/page.tsx     the chrome-free interactive demo
        ├── components/
        │   ├── providers.tsx              CopilotKitProvider config (stands down its
        │   │                              inspector on nested-provider routes)
        │   ├── nav-sidebar.tsx            nav, driven by nav-config
        │   ├── route-header.tsx           title, status badge, doc link
        │   ├── demo-frame.tsx             the thin bar on /demo-chat routes
        │   ├── source-code.tsx            renders files read off disk
        │   ├── code-figure.tsx            the one code block in the app
        │   ├── backend-health.tsx         the connection panel
        │   └── ui.tsx                     Panel, Callout, TryIt, KeyValue, CodeBlock
        └── lib/
            ├── nav-config.ts              single source of truth: routes, docs, statuses
            ├── inspector.ts               which routes mount their own <CopilotKit>
            ├── source.ts                  reads repo files for the source panels
            ├── health.ts                  the /health probe
            └── highlight.ts               server-side Shiki
```

`lib/nav-config.ts` is where a route's title, doc URL, summary, and status live. The nav, every route header, and the `/status` table all read from it, so the status table above and the app can only disagree if this README goes stale.

---

## References

Every doc page this repo tests against, grouped as the LlamaIndex sidebar groups them. Pages marked *(off-sidebar)* resolve but are absent from that nav as of the last sync — see `doc-snapshot/manifest.json` for the exact timestamp.

**Getting Started**
- [Introduction](https://docs.copilotkit.ai/llamaindex)
- [Quickstart — bring your own agent](https://docs.copilotkit.ai/llamaindex/quickstart?agent=bring-your-own)

**Basics**
- [Prebuilt Components](https://docs.copilotkit.ai/llamaindex/prebuilt-components)

**Rich Threads**
- [Threads Drawer](https://docs.copilotkit.ai/llamaindex/prebuilt-components/copilot-threads-drawer)
- [Headless Threads](https://docs.copilotkit.ai/llamaindex/headless-threads)
- [Thread & History Lifecycle](https://docs.copilotkit.ai/llamaindex/threads-lifecycle)
- [Synchronize Thread History](https://docs.copilotkit.ai/llamaindex/threads-import)

**Custom Look and Feel**
- [Programmatic Control](https://docs.copilotkit.ai/llamaindex/programmatic-control)
- [Inspector](https://docs.copilotkit.ai/llamaindex/inspector)
- [Slots](https://docs.copilotkit.ai/llamaindex/custom-look-and-feel/slots) *(off-sidebar)*
- [Headless UI](https://docs.copilotkit.ai/llamaindex/custom-look-and-feel/headless-ui) *(off-sidebar)*

**Generative UI**
- [Tool Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/tool-rendering)
- [State Rendering](https://docs.copilotkit.ai/llamaindex/generative-ui/state-rendering)
- [Your Components — Display-only](https://docs.copilotkit.ai/llamaindex/generative-ui/your-components/display-only) *(off-sidebar)*
- [Your Components — Interactive](https://docs.copilotkit.ai/llamaindex/generative-ui/your-components/interactive) *(off-sidebar)*

- [A2UI — Dynamic Schema](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/dynamic-schema) *(sidebar: Declarative)*
- [A2UI — Fixed Schema](https://docs.copilotkit.ai/llamaindex/generative-ui/a2ui/fixed-schema) *(sidebar: Declarative)*
- [Open Generative UI](https://docs.copilotkit.ai/llamaindex/generative-ui/open-generative-ui) *(sidebar: Open-ended)*
- [MCP Apps](https://docs.copilotkit.ai/llamaindex/generative-ui/mcp-apps) — not implemented

**Human-in-the-loop**
- [HITL Overview](https://docs.copilotkit.ai/llamaindex/human-in-the-loop/index)
- [Governed Action Approval UI](https://docs.copilotkit.ai/llamaindex/human-in-the-loop/governed-actions)

**App Control**
- [Frontend Tools](https://docs.copilotkit.ai/llamaindex/frontend-tools)

**Shared State** *(the whole group is off-sidebar)*
- [Reading agent state](https://docs.copilotkit.ai/llamaindex/shared-state/in-app-agent-read)
- [Writing agent state](https://docs.copilotkit.ai/llamaindex/shared-state/in-app-agent-write)
- [Workflow Execution](https://docs.copilotkit.ai/llamaindex/shared-state/workflow-execution)
- [Predictive State Updates](https://docs.copilotkit.ai/llamaindex/shared-state/predictive-state-updates)

**LlamaIndex**
- [Multi-Agent Flows](https://docs.copilotkit.ai/llamaindex/multi-agent-flows)
- [Sub-Agents](https://docs.copilotkit.ai/llamaindex/multi-agent/subagents)

**Backend**
- [Copilot Runtime](https://docs.copilotkit.ai/llamaindex/copilot-runtime)
- [AG-UI](https://docs.copilotkit.ai/llamaindex/ag-ui)

**CopilotKit Intelligence** — consulted for the runtime wiring, not implemented as routes
- [Connect your runtime to Intelligence](https://docs.copilotkit.ai/llamaindex/premium/connect-your-runtime) — the `CopilotKitIntelligence` constructor and how to confirm the key is in use
- [Runtime endpoints](https://docs.copilotkit.ai/llamaindex/backend/runtime-endpoints) — the provider/handler transport pairing table
