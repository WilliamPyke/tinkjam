import * as Schema from "effect/Schema";

import { useLocalStorage } from "./hooks/useLocalStorage";

export interface WhatsNewEntry {
  /** Day it shipped, `YYYY-MM-DD`. */
  readonly date: string;
  readonly title: string;
  readonly items: ReadonlyArray<string>;
}

/** Newest first. Shortcuts are written for Windows and Linux with the Mac key in brackets. */
export const WHATS_NEW: ReadonlyArray<WhatsNewEntry> = [
  {
    date: "2026-11-27",
    title: "Search finds your boards, and clearer access messages",
    items: [
      "An agent box says what its agent is doing in plain words, such as Adding to the board, instead of a tool's code name.",
      "When an agent asks a question, its box shows the question with a button to answer it.",
      "A note waiting for someone to press Send says so and names who, instead of Waiting for approval.",
      "An agent box's Stop button says Stop.",
      "Drag either end of a selected line onto another card to move it there. Lines stay still when a card grows, and a line's toolbar no longer covers its end.",
      "The start page leads with what Tinkjam is, and copying an invite link tells you what to do with it. Getting started ticks the invite step only once the link is really copied.",
      "Press Ctrl+K (Cmd+K) and type a board's name to open it.",
      "If someone removes you from a workspace or a board, the board says you no longer have access, instead of saying it ended.",
      "Your boards and workspaces update without a reload when a teammate adds a board or deletes a workspace.",
      "A box where an agent works is now called an agent box, and the pull request tool is GitHub pull request.",
      "On a phone or tablet: bigger buttons that stay that size when you zoom out, a board that opens fitted to its cards, Share and who is here in the header, and a zoom bar that stays on screen. On a tablet the sidebar folds while a board is open.",
      "Agent boxes use the same text size as notes, and a long reply scrolls inside its box. Menus, the selection bar and toolbar icons are easier to read.",
      "Drag on empty space to select cards. Hold Space or use the hand tool to move around the board.",
      "Grouping cards in a section lets you name it straight away. Undo takes back a card you just moved with the arrow keys.",
      "In Plan and List, Enter opens a task and Clear filters brings every task back.",
      "An artifact you write by hand has Save and Cancel buttons.",
      "The sign-in page shows the password rule before you type, explains the wait while it checks your connection, and offers Try again if it cannot load.",
      "A board opens with less to download.",
      "Typing in a note and dragging a card stay smooth on a board full of cards.",
      "With a screen reader, cards, sections, tasks and their buttons say what they are and what they act on.",
      "Shift-clicking empty space on the board keeps your selection.",
      "When something cannot be done, Tinkjam says what happened and what to do next, in plain words.",
      "Tab to an artifact or embedded page and press Enter to use it.",
      "A change you make just before closing or reloading the page is still saved, even on a slow connection. Tinkjam asks first if one has not reached the board yet.",
      "Undo and redo straight after typing in a new note keep the note.",
      "A board made from a template is named after it and opens with every card in view.",
      "Template boards open clear of Getting started, and on a phone they open on their first section. The start page has a More templates link.",
      "Tasks added in Plan no longer land on top of others, and comment pins sit beside a note's text.",
      "Tab moves the board to the card you reach, and a note shows when it has keyboard focus.",
    ],
  },
  {
    date: "2026-11-26",
    title: "Faster boards, and phones that work properly",
    items: [
      "Tinkjam and its boards open faster, most of all on a phone. Zooming and pinching a board is smoother.",
      "Boards open reliably on iPhone and iPad.",
      "If a change cannot be saved, Tinkjam keeps trying and says so, and asks before you close the tab. When the connection drops, the board says it is reconnecting.",
      "On a phone: bigger buttons and links, fields stay above the keyboard, long menus scroll, and an embedded video or Figma file loads when you tap it.",
      "Draw lines and add comments with the keyboard: pick the Line or Comment tool, then press Enter on a card.",
      "A link that leads nowhere says This page does not exist, with a way back to your boards.",
    ],
  },
  {
    date: "2026-11-20",
    title: "A new look, sign-in and Download page",
    items: [
      "Tinkjam has a new look in light and dark: cobalt blue, new headings, and new Settings, Share and Bring my agent screens. Pick a theme in Settings under Appearance, or make your own.",
      "Signing in has its own page, and Connect a computer walks you through getting Tinkjam Sync and approving the computer.",
      "tinkjam.com/download has Tinkjam Sync for Mac, Windows and Linux in one place.",
    ],
  },
  {
    date: "2026-11-19",
    title: "Agents that tidy up, and notes that say when they are done",
    items: [
      "Ask your agent to arrange the board: put notes in a grid inside a section, place one card beside another, tidy or rename a section. What it moves carries its name, and one Undo takes it all back.",
      "A note connected to an agent says where it stands: To send, With the agent, then Done by agent once the agent's reply is in. Not fixed, send again puts it back in the next prompt.",
      "An agent's prompt counts its notes, and Remove done notes clears the finished ones.",
    ],
  },
  {
    date: "2026-11-19",
    title: "Artifacts you can compare, mark up and browse",
    items: [
      "Connect an artifact to an empty artifact card and the second card shows the same page live, at its own size: one wide, one phone-narrow. Keep this version turns it into its own copy, so you can keep an old version beside the new one.",
      "Mark up, on an artifact showing a page: click a part of the page, say what should change, and it becomes a numbered note your agent reads with the exact spot, the next time you send it a prompt.",
      "Click an artifact before it scrolls, so the wheel pans the board until you mean to use the page. Press Esc to give the board back.",
      "Pages have a Refresh button, and a box with several artifacts says which one its next reply goes into.",
      "Right-click a link in an artifact's page to open it beside the artifact: another site as a card showing its page, a spot further down as a second view scrolled there, and a page that is not made yet as an empty artifact for your agent to write.",
    ],
  },
  {
    date: "2026-11-19",
    title: "Lines, sections and sizes",
    items: [
      "Lines between cards take one clean turn, and each line can be switched to Elbow: straight segments that go around other cards. Select a line to choose.",
      "Sections move by their title or their edges and take their cards along. Deleting one asks whether to keep the cards on it. They have a larger heading and a Background colour.",
      "Resize any card from any edge, not only the corners. Sections and other cards can be made far larger than before.",
    ],
  },
  {
    date: "2026-11-19",
    title: "Links, the sidebar and text size",
    items: [
      "Show page here, on a link card, shows any site's page in the card. Some sites do not allow this, and the card says so. Each person chooses to load it.",
      "Hover a board in the sidebar and open its arrow to see its artifacts, agents and sections. Click one to go straight to it.",
      "Text size, in Settings under Appearance: Small, Medium or Large.",
      "With more than one computer connected, an agent's prompt says which computer it runs on, and you can pick another for a new agent.",
    ],
  },
  {
    date: "2026-11-19",
    title: "A simpler start",
    items: [
      "Starting a board is one screen and one click, with no account. Tinkjam asks your name once.",
      "Signing in happens over the page you are on, and a new board has a short Getting started guide.",
      "An invite names the board and who made it before you join. Board addresses are short, and a board fits a phone.",
    ],
  },
  {
    date: "2026-11-17",
    title: "Simple and Advanced",
    items: [
      "Tinkjam starts Simple: boards, your tasks, sharing and settings, in plain words.",
      "Advanced adds tools for developers beside your boards: chats, projects and code changes. Switch to it from the menu with your name or from Settings, and switch back the same way.",
    ],
  },
  {
    date: "2026-11-17",
    title: "Mentions, an inbox, and My tasks",
    items: [
      "Type @ in a note, a task or a comment to name someone. They hear about it in their inbox, behind the bell at the top of your boards.",
      "The inbox also tells you when someone gives you a task, or replies to a comment you started. Open an item to go straight to that card.",
      "My tasks lists every task given to you, across all your boards and workspaces.",
      "Looking at a board you can only view? Ask for edit access from the top of the board. Whoever made it answers from their inbox, and the board opens for you to edit.",
    ],
  },
  {
    date: "2026-11-17",
    title: "View-only links, a command menu, and export",
    items: [
      "Every board has two links in Share: Can edit and Can view. People with the view link see the board live but cannot change it, and the board's maker can move anyone between the two.",
      "Press Ctrl+K (Cmd+K) for the command menu: add notes, tasks and sections, zoom, rename, share and more without hunting for a button. Keyboard shortcuts lists the rest.",
      "Copy a board, or its Plan, as Markdown, or download the board as a picture (PNG).",
      "Your agent can now plan on the board: ask it to sort the Plan, add tasks or move them along. What it changes carries its name, and one Undo takes it all back.",
      "The welcome screen opens a sample board you can look around before you make your own.",
    ],
  },
  {
    date: "2026-11-17",
    title: "Bring documents in with your agent",
    items: [
      "Paste or drop a link on a board and it becomes a card: Figma, Google Docs, Sheets and Slides, YouTube, Loom and Vimeo show live, and other links show their title and icon.",
      "Bring in with my agent, on a link card, asks your own agent to read it and leave a copy on the board that everyone can read. Draw a line from it to an agent box and that agent reads it too.",
      "Nothing is fetched until you press Send, and only your own agent does the reading.",
    ],
  },
  {
    date: "2026-11-17",
    title: "Workspaces and Tinkjam Sync",
    items: [
      "Make a workspace for your team, invite people with a link, and every board in it is shared with every member.",
      "Tinkjam Sync connects your computer, so the agents on it, such as Claude Code or Codex, can work on your boards. Choose Connect a computer in the sidebar or in Settings.",
      "Bring my agent lists your computers and adds your agent's box to the board.",
    ],
  },
  {
    date: "2026-11-17",
    title: "The Plan",
    items: [
      "Every board has a Plan: its tasks as columns for To do, In progress and Done, or as a list. Ticking a task on the board and moving it in the Plan are the same thing.",
      "Give tasks a priority and a due date, filter and sort them, and select several to move at once.",
    ],
  },
  {
    date: "2026-11-17",
    title: "Accounts",
    items: [
      "Sign in and your boards follow you to every device, under one name. Your account is in the menu with your name.",
      "A board can be named, deleted or left from the home page, and sharing is one Share button.",
    ],
  },
  {
    date: "2026-11-16",
    title: "Boards in the cloud",
    items: [
      "Boards live in the cloud, so they open and can be shared while every computer is off.",
      "Everyone on a board can add notes, tasks, sections, lines, votes and comments, and rename it.",
      "The person who made a board can remove someone or delete the board for everyone. Leave board takes it off your list.",
    ],
  },
];

const SEEN_KEY = "t-code:whats-new-seen";
const SeenSchema = Schema.NullOr(Schema.String);
// The count makes a second entry on the same day show as unread too.
const LATEST = `${WHATS_NEW[0]?.date ?? ""}#${String(WHATS_NEW.length).padStart(4, "0")}`;

/** Whether this browser has entries it has not seen yet, and a way to mark them seen. */
export function useWhatsNewSeen() {
  const [seen, setSeen] = useLocalStorage(SEEN_KEY, null, SeenSchema);
  return {
    unseen: seen === null || seen < LATEST,
    markSeen: () => {
      if (seen !== LATEST) setSeen(LATEST);
    },
  };
}
