/**
 * The nav, the route headers, and the README status table all read from here,
 * so a doc page and its implementation status are described exactly once.
 *
 * Route paths mirror the doc URLs under docs.copilotkit.ai/llamaindex.
 * `offNav: true` marks pages that resolve fine but are absent from that
 * sidebar as of DOC_SYNC_DATE — the LlamaIndex sidebar has no Shared State
 * group at all, and no sub-pages under Custom Look and Feel or Generative UI /
 * Your Components, even though every one of those pages is live.
 */

/**
 * There is exactly one doc-sync date in this repo, and it is not here: it is
 * `syncedAt` in `doc-snapshot/manifest.json`, written every time the sync
 * button runs. A hand-maintained date alongside it only ever drifted out of
 * agreement with the machine one, so it was removed — `/doc-sync` is the
 * single place that answers "how current are these docs".
 */
export const DOCS_ROOT = "https://docs.copilotkit.ai/llamaindex";

/**
 * Working  — implemented and exercisable against the local stack.
 * Partial  — implemented, but something outside this repo limits it.
 * Reference — intentionally not a live feature; doc/notes surface.
 * Broken   — implemented but currently failing.
 */
export type RouteStatus = "working" | "partial" | "reference" | "broken" | "not-started";

export interface RouteMeta {
  /** App route path. */
  path: string;
  /** Nav label. */
  title: string;
  /** Doc page this route tests, relative to docs.copilotkit.ai. */
  docPath: string;
  /** One-line description in our own words. */
  summary: string;
  status: RouteStatus;
  /** Shown in the route header when status is not plain "working". */
  statusNote?: string;
  /** Page exists in the docs but is absent from the current sidebar. */
  offNav?: boolean;
  /**
   * This route owns a live interactive surface, which lives at
   * `<path>/demo-chat` rather than on the page itself. The doc page keeps the
   * explanation and the source; the demo route is chrome-free so it can be
   * screen-recorded on its own.
   */
  hasDemo?: boolean;
}

/** Where a route's interactive demo lives, if it has one. */
export function demoPath(route: RouteMeta): string | undefined {
  if (!route.hasDemo) return undefined;
  return route.path === "/" ? "/demo-chat" : `${route.path}/demo-chat`;
}

export interface NavGroup {
  title: string;
  routes: RouteMeta[];
}

export const NAV: NavGroup[] = [
  {
    title: "Getting Started",
    routes: [
      {
        path: "/",
        title: "Introduction",
        docPath: "/llamaindex",
        summary:
          "What this harness covers and how the three processes fit together.",
        status: "reference",
        statusNote: "Landing page — orientation and live connection check.",
      },
      {
        path: "/quickstart",
        hasDemo: true,
        title: "Quickstart",
        docPath: "/llamaindex/quickstart?agent=bring-your-own",
        summary:
          "The bring-your-own-agent path: an AG-UI workflow router, a runtime route, and a chat.",
        status: "working",
      },
    ],
  },
  {
    title: "Basics",
    routes: [
      {
        path: "/prebuilt-components",
        hasDemo: true,
        title: "Prebuilt Components",
        docPath: "/llamaindex/prebuilt-components",
        summary:
          "CopilotChat, CopilotPopup, and CopilotSidebar side by side, each driving the same agent.",
        status: "working",
      },
    ],
  },
  {
    title: "Rich Threads",
    routes: [
      {
        path: "/prebuilt-components/copilot-threads-drawer",
        hasDemo: true,
        title: "Threads Drawer",
        docPath: "/llamaindex/prebuilt-components/copilot-threads-drawer",
        summary:
          "The drop-in conversation sidebar, wired with no active-thread state of its own.",
        status: "working",
        statusNote:
          "Needs the runtime in Intelligence mode. Without a key the drawer renders a locked view instead of the list. Tabs 2 (sidebar host) and 3 (own New-conversation button) are new and not yet run against an Intelligence runtime.",
      },
      {
        path: "/headless-threads",
        hasDemo: true,
        title: "Headless Threads",
        docPath: "/llamaindex/headless-threads",
        summary:
          "The same thread data through useThreads, with a hand-built list — including rename, which the drawer omits.",
        status: "working",
        statusNote:
          "Needs Intelligence mode. In SSE mode /info reports mutations: false, so rename/archive/delete have no endpoint.",
      },
      {
        path: "/threads-lifecycle",
        hasDemo: true,
        title: "Thread & History Lifecycle",
        docPath: "/llamaindex/threads-lifecycle",
        summary:
          "Where a threadId comes from, how history replays, and how switching differs from starting fresh.",
        status: "working",
        statusNote:
          "Switch/start are live regardless; history replay needs a server-side store to replay from.",
      },
      {
        path: "/threads-import",
        title: "Synchronize Thread History",
        docPath: "/llamaindex/threads-import",
        summary:
          "The CLI import path for existing conversations — and why no LlamaIndex importer exists.",
        status: "reference",
        statusNote:
          "Not implementable here: the importer supports Google ADK and LangGraph only.",
      },
    ],
  },
  {
    title: "Custom Look and Feel",
    routes: [
      {
        path: "/custom-look-and-feel/slots",
        hasDemo: true,
        title: "Slots",
        docPath: "/llamaindex/custom-look-and-feel/slots",
        summary:
          "Replacing chat sub-components at three levels: class strings, prop overrides, and whole components.",
        status: "working",
        offNav: true,
      },
      {
        path: "/custom-look-and-feel/headless-ui",
        hasDemo: true,
        title: "Headless UI",
        docPath: "/llamaindex/custom-look-and-feel/headless-ui",
        summary:
          "A chat interface built from scratch on the headless hooks, with no CopilotKit chrome.",
        status: "working",
        offNav: true,
      },
      {
        path: "/programmatic-control",
        hasDemo: true,
        title: "Programmatic Control",
        docPath: "/llamaindex/programmatic-control",
        summary:
          "Driving the agent with no chat UI: read state and messages, run it, and stop it mid-run.",
        status: "working",
      },
      {
        path: "/inspector",
        hasDemo: true,
        title: "Inspector",
        docPath: "/llamaindex/inspector",
        summary:
          "The built-in debugging overlay showing AG-UI events, agents, state, and registered tools.",
        status: "working",
      },
    ],
  },
  {
    title: "Generative UI",
    routes: [
      {
        path: "/generative-ui/your-components/display-only",
        hasDemo: true,
        title: "Your Components · Display-only",
        docPath: "/llamaindex/generative-ui/your-components/display-only",
        summary:
          "Registering a React component as a tool the agent can render in the chat, with no handler.",
        status: "working",
        offNav: true,
      },
      {
        path: "/generative-ui/your-components/interactive",
        hasDemo: true,
        title: "Your Components · Interactive",
        docPath: "/llamaindex/generative-ui/your-components/interactive",
        summary:
          "An approval gate built with useHumanInTheLoop — the run suspends until the user responds.",
        status: "working",
        offNav: true,
      },
      {
        path: "/generative-ui/tool-rendering",
        hasDemo: true,
        title: "Tool Rendering",
        docPath: "/llamaindex/generative-ui/tool-rendering",
        summary:
          "The agent's getWeather backend tool rendered as a custom component, plus a catch-all renderer.",
        status: "working",
      },
      {
        path: "/generative-ui/state-rendering",
        hasDemo: true,
        title: "State Rendering",
        docPath: "/llamaindex/generative-ui/state-rendering",
        summary:
          "Streaming agent state to the UI: a searches list kept in sync by StateSnapshotWorkflowEvent.",
        status: "partial",
        statusNote:
          "The state itself streams. The doc's in-chat variant does not — useAgent has no `render` prop in the shipped v2 API.",
      },
      {
        path: "/generative-ui/a2ui/dynamic-schema",
        hasDemo: true,
        title: "A2UI · Dynamic Schema",
        docPath: "/llamaindex/generative-ui/a2ui/dynamic-schema",
        summary:
          "A secondary LLM designs a dashboard surface per request from a bring-your-own catalog.",
        status: "partial",
        statusNote:
          "Frontend and runtime from the page's demo Code tab, verbatim; the agent is a simplified plain router (prompt only). Not yet checked in a browser. The demo's runtime sets injectA2UITool: true, which the page's prose says is unnecessary.",
      },
      {
        path: "/generative-ui/a2ui/fixed-schema",
        hasDemo: true,
        title: "A2UI · Fixed Schema",
        docPath: "/llamaindex/generative-ui/a2ui/fixed-schema",
        summary:
          "A flight card whose component tree is pre-authored JSON; the tool supplies only the data.",
        status: "partial",
        statusNote:
          "Built from the page's demo Code tab, verbatim. Not yet checked in a browser. The demo's runtime sets injectA2UITool: true where the page's prose says false. The Book button is inert by design.",
      },
      {
        path: "/generative-ui/open-generative-ui",
        hasDemo: true,
        title: "Open Generative UI",
        docPath: "/llamaindex/generative-ui/open-generative-ui",
        summary:
          "The agent writes sandboxed HTML/CSS/JS that streams into an iframe, optionally calling back into host functions.",
        status: "partial",
        statusNote:
          "Built from the page's demo Code tab. Both agents import an unpublished make_request_aware_router, swapped here for the stock router. The published prompts re-draw the UI on every follow-up; a harness remedy region adds a stop rule.",
      },
    ],
  },
  {
    title: "Human-in-the-loop",
    routes: [
      {
        path: "/human-in-the-loop/index",
        hasDemo: true,
        title: "HITL Overview",
        docPath: "/llamaindex/human-in-the-loop/index",
        summary:
          "useHumanInTheLoop suspending the run behind a time picker until the user answers.",
        status: "partial",
        statusNote:
          "Not yet checked in a browser. The docs route hitl-in-chat to an unpublished /hitl-in-chat router; this repo uses the Quickstart router, which forwards book_call like any frontend tool.",
      },
      {
        path: "/human-in-the-loop/governed-actions",
        hasDemo: true,
        title: "Governed Action Approval UI",
        docPath: "/llamaindex/human-in-the-loop/governed-actions",
        summary:
          "Gating a side-effecting action behind an approve/reject card, driven by the action's verdict.",
        status: "broken",
        statusNote:
          "Observed: the card renders without its Approve/Reject buttons. llama-index-protocols-ag-ui 0.5.0 flattens every frontend-tool parameter to a plain string, so the model never sees the verdict enum and rarely writes exactly require_approval. Naming the verdict in the prompt works around it. The useInterrupt half cannot run (no AG-UI interrupts), and no policy engine, agent or executeSideEffect is published.",
      },
    ],
  },
  {
    title: "App Control",
    routes: [
      {
        path: "/frontend-tools",
        hasDemo: true,
        title: "Frontend Tools",
        docPath: "/llamaindex/frontend-tools",
        summary:
          "A tool the agent calls that executes in the browser, forwarded automatically over AG-UI.",
        status: "working",
      },
    ],
  },
  {
    title: "Shared State",
    routes: [
      {
        path: "/shared-state/in-app-agent-read",
        hasDemo: true,
        title: "Reading agent state",
        docPath: "/llamaindex/shared-state/in-app-agent-read",
        summary:
          "Reading the agent's live state in your own UI through agent.state.",
        status: "working",
        offNav: true,
      },
      {
        path: "/shared-state/in-app-agent-write",
        hasDemo: true,
        title: "Writing agent state",
        docPath: "/llamaindex/shared-state/in-app-agent-write",
        summary:
          "Writing back into agent state with agent.setState, and re-running with a hint message.",
        status: "working",
        offNav: true,
      },
      {
        path: "/shared-state/workflow-execution",
        hasDemo: true,
        title: "Workflow Execution",
        docPath: "/llamaindex/shared-state/workflow-execution",
        summary:
          "Splitting state by purpose: question in, answer out, resources kept server-side.",
        status: "working",
        offNav: true,
      },
      {
        path: "/shared-state/predictive-state-updates",
        hasDemo: true,
        title: "Predictive State Updates",
        docPath: "/llamaindex/shared-state/predictive-state-updates",
        summary:
          "A long-running tool emitting state snapshots per step, so progress shows before the run ends.",
        status: "partial",
        statusNote:
          "Progress streams outside the chat. The doc's in-chat renderer relies on a `render` prop useAgent does not have.",
      },
    ],
  },
  {
    title: "LlamaIndex",
    routes: [
      {
        path: "/multi-agent-flows",
        hasDemo: true,
        title: "Multi-Agent Flows",
        docPath: "/llamaindex/multi-agent-flows",
        summary:
          "Agent Lock vs Router Mode — five locked agents you can switch between, and why routing is not wired up here.",
        status: "partial",
        statusNote:
          "Agent Lock is fully exercisable. Router Mode needs an LLM service adapter this repo deliberately does not configure.",
      },
      {
        path: "/multi-agent/subagents",
        hasDemo: true,
        title: "Sub-Agents",
        docPath: "/llamaindex/multi-agent/subagents",
        summary:
          "A supervisor delegating to research, writing and critique sub-agents, with a live delegation log.",
        status: "partial",
        statusNote:
          "Built from the page's demo Code tab, verbatim. Not yet checked in a browser.",
      },
    ],
  },
  {
    title: "Backend",
    routes: [
      {
        path: "/copilot-runtime",
        hasDemo: true,
        title: "Copilot Runtime",
        docPath: "/llamaindex/copilot-runtime",
        summary:
          "This repo's live runtime config, agent routing across five ids, and the direct-connection tradeoff.",
        status: "working",
      },
      {
        path: "/ag-ui",
        hasDemo: true,
        title: "AG-UI",
        docPath: "/llamaindex/ag-ui",
        summary:
          "A live capture of the raw AG-UI event stream flowing between the runtime and this page.",
        status: "working",
      },
    ],
  },
  {
    title: "Doc Sync",
    routes: [
      {
        path: "/doc-sync",
        title: "Doc drift",
        docPath: "/llamaindex",
        summary:
          "Re-fetches the markdown behind every tracked doc page and diffs it against the stored snapshot, flagging changes inside code blocks.",
        status: "reference",
      },
    ],
  },
];

export const ALL_ROUTES: RouteMeta[] = NAV.flatMap((g) => g.routes);

export function findRoute(path: string): RouteMeta | undefined {
  return ALL_ROUTES.find((r) => r.path === path);
}

export function docUrl(route: RouteMeta): string {
  return `https://docs.copilotkit.ai${route.docPath}`;
}

export const STATUS_LABEL: Record<RouteStatus, string> = {
  working: "Working",
  partial: "Partial",
  reference: "Reference",
  broken: "Broken",
  "not-started": "Not started",
};
