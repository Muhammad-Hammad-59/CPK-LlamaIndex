"use client";

import {
  CopilotChat,
  CopilotChatConfigurationProvider,
  CopilotSidebar,
  CopilotThreadsDrawer,
  useCopilotChatConfiguration,
} from "@copilotkit/react-core/v2";
import { useState } from "react";

import { DemoFrame } from "@/components/demo-frame";

/** The runtime id this demo binds to. Also shown in the demo header. */
const AGENT_ID = "my_agent";

/**
 * One tab per sample on the doc page, each mounting its own
 * `CopilotChatConfigurationProvider` (keyed, so switching tabs starts that
 * sample from a clean configuration rather than inheriting the last one's
 * active thread).
 *
 * Departures that apply to every tab, all presentational or harness-imposed:
 *
 *   - `CopilotKitProvider` is not repeated; the app already mounts one at the
 *     root. The doc nests them because each sample is a whole page.
 *   - `agentId={AGENT_ID}` is set on the configuration provider. The doc's
 *     samples set none, which resolves to `"default"` — an id this runtime does
 *     not register, because the root provider names no agent.
 *   - `height: "100%"` instead of `"100dvh"`, because the demo bar above takes
 *     part of the viewport.
 */
type Sample = "chat" | "sidebar" | "button";

const SAMPLES: { id: Sample; label: string; blurb: string }[] = [
  {
    id: "chat",
    label: "1 · Drawer + CopilotChat",
    blurb: "Set up the Threads Drawer",
  },
  {
    id: "sidebar",
    label: "2 · Drawer + CopilotSidebar",
    blurb: "Use the Drawer with a sidebar chat",
  },
  {
    id: "button",
    label: '3 · Your own "New conversation" button',
    blurb: 'Add your own "New conversation" button',
  },
];

// #region drawer-with-chat
/**
 * "Set up the Threads Drawer". One extra departure from the doc: in a flex row
 * `CopilotChat` has no flex basis of its own, so it collapses to min-content
 * (one word per line beside a full-width drawer). `flex: 1` plus `minWidth: 0`
 * gives it the remaining space; `minWidth` matters because a flex item's
 * default `min-width: auto` refuses to shrink below its content.
 */
function DrawerWithChat() {
  return (
    <CopilotChatConfigurationProvider agentId={AGENT_ID}>
      <div style={{ display: "flex", height: "100%" }}>
        <CopilotThreadsDrawer />
        <div style={{ flex: 1, minWidth: 0 }}>
          <CopilotChat />
        </div>
      </div>
    </CopilotChatConfigurationProvider>
  );
}
// #endregion

// #region drawer-with-sidebar
/**
 * "Use the Drawer with a sidebar chat", as published apart from the shared
 * departures above. The layout is left exactly as the doc writes it, so how
 * the sidebar sits beside the drawer is what the sample really produces.
 *
 * DOC GAP: the sample renders `<YourMainContent />` and never defines it. The
 * placeholder below stands in for it and is labelled as such.
 */
function YourMainContent() {
  return (
    <div className="p-6 text-sm text-slate-500">
      &lt;YourMainContent /&gt; — not defined by the doc; placeholder.
    </div>
  );
}

function DrawerWithSidebar() {
  return (
    <CopilotChatConfigurationProvider agentId={AGENT_ID}>
      <div style={{ display: "flex", height: "100%" }}>
        <CopilotThreadsDrawer />
        <main style={{ flex: 1 }}>
          <YourMainContent />
          <CopilotSidebar defaultOpen={true} />
        </main>
      </div>
    </CopilotChatConfigurationProvider>
  );
}
// #endregion

// #region new-conversation-button
function NewConversationButton() {
  const configuration = useCopilotChatConfiguration();

  return (
    <button
      type="button"
      onClick={() => configuration?.startNewThread()}
    >
      New conversation
    </button>
  );
}

function DrawerWithOwnButton() {
  return (
    <CopilotChatConfigurationProvider agentId={AGENT_ID}>
      <div style={{ display: "flex", height: "100%" }}>
        <CopilotThreadsDrawer />
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <header>
            <NewConversationButton />
          </header>
          <CopilotChat />
        </main>
      </div>
    </CopilotChatConfigurationProvider>
  );
}
// #endregion

// #region controlled-chat
/**
 * The controlled variant from the same section. Rendered as published apart
 * from the shared departures — including its lack of any layout wrapper, so
 * the drawer, button and chat stack in plain document flow.
 */
function ControlledChat() {
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const startNew = () => setThreadId(crypto.randomUUID());

  return (
    <CopilotChatConfigurationProvider agentId={AGENT_ID} threadId={threadId}>
      <CopilotThreadsDrawer
        onThreadSelect={(id) => setThreadId(id)}
        onNewThread={startNew}
      />
      <button type="button" onClick={startNew}>
        New conversation
      </button>
      <CopilotChat />
    </CopilotChatConfigurationProvider>
  );
}
// #endregion

// #region hide-drawer-new-thread
const HIDE_DRAWER_NEW_THREAD_CSS = `
copilotkit-threads-drawer::part(new-thread-button),
copilotkit-threads-drawer::part(launcher-new-thread) {
  display: none;
}
`;
// #endregion

/**
 * Tab 3 carries the section's three samples: the uncontrolled button, the
 * controlled `threadId` variant, and the CSS that hides the drawer's own
 * new-conversation controls. The CSS is only injected while its box is ticked,
 * so the drawer's own row stays visible for comparison otherwise.
 */
function OwnButtonSample() {
  const [mode, setMode] = useState<"uncontrolled" | "controlled">("uncontrolled");
  const [hideDrawerControls, setHideDrawerControls] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
        {(["uncontrolled", "controlled"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md border px-2.5 py-1 font-medium transition-colors ${
              mode === m
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
            }`}
          >
            {m === "uncontrolled" ? "startNewThread()" : "Controlled threadId"}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={hideDrawerControls}
            onChange={(e) => setHideDrawerControls(e.target.checked)}
          />
          Hide the Drawer&apos;s own new-conversation controls (CSS parts)
        </label>
      </div>

      {hideDrawerControls && <style>{HIDE_DRAWER_NEW_THREAD_CSS}</style>}

      <div className="min-h-0 flex-1 overflow-auto">
        {mode === "uncontrolled" ? (
          <DrawerWithOwnButton key="uncontrolled" />
        ) : (
          <ControlledChat key="controlled" />
        )}
      </div>
    </div>
  );
}

export default function Page() {
  const [sample, setSample] = useState<Sample>("chat");
  const active = SAMPLES.find((s) => s.id === sample)!;

  return (
    <DemoFrame
      parentPath="/prebuilt-components/copilot-threads-drawer"
      subtitle={`agent: ${AGENT_ID} · ${active.blurb}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSample(s.id)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                sample === s.id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative min-h-0 flex-1">
          {sample === "chat" && <DrawerWithChat key="chat" />}
          {sample === "sidebar" && <DrawerWithSidebar key="sidebar" />}
          {sample === "button" && <OwnButtonSample key="button" />}
        </div>
      </div>
    </DemoFrame>
  );
}
