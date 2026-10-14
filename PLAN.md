# Plan

Name: **Rehearsal** — a prototype is a rehearsal for the real thing.

## What it is

Figma-style collaborative review for working HTML prototypes, where the editing is done by each person's own AI agent.

- A prototype is a plain HTML/CSS/JS file or folder (the same format as a Claude artifact). It is uploaded by dragging it into the web app or by an agent over MCP.
- Rehearsal does not keep the files. When a team sets up a project they choose where the files live: **their own cloud** (a GitHub repository today; a Google Drive shared folder next) or **Rehearsal Cloud** (coming soon, paid). Because a repo or shared folder syncs to each person's machine, their agent edits the files right there. Rehearsal only keeps the lightweight collaboration data: comments, presence, variants, chat.
- The web app is for **viewing, commenting, comparing and chatting**. Nobody edits code in the browser.
- Every person connects **their own agent** (Claude Code, Cursor, Codex, …) on their own subscription. From the browser they select elements and send instructions; the agent makes the change and publishes a new version.
- Live presence like Figma: other people's cursors, who is here, and a "being edited" outline on any section an agent is currently working on.
- Comments are pinned to specific elements, not to screen coordinates.
- Variants: highlight a section and ask for options A/B/C. Reviewers switch between them in place, vote and pick a winner. (Whole-page alternatives are just separate versions.)
- A chat panel per prototype, shared by people and agents.
- Multi-organisation product from day one: organisations, members, roles.

## Design brief

Rehearsal should not look vibe-coded. It should feel sleek, quiet and a bit different, with a lot of white space. The prototype on stage is the point; the app around it stays out of the way.

- **Colour.** Pure white page, true black ink. Three greys only: muted `#6f6f6c` for secondary text, faint `#a8a8a4` for hints, hairline `#e6e6e2` for rules. The stage behind a prototype is `#f4f4f2`. There is no accent colour in the chrome. Colour is reserved for people: each person gets one from the palette in `src/lib/people.ts` and it follows them everywhere (avatar, cursor, comment pins).
- **Type.** Instrument Serif for titles (h1, h2, and anything marked `.serif`), Instrument Sans for everything else. One size scale, sentence case throughout. No all-caps labels, no single italic or coloured word in a headline, no middle-dot meta strings.
- **Layout.** Rows and hairlines, not cards. Generous margins, content left-aligned on a single column of about 1040px. Lists are tables of rows with a hairline between them. Nothing is boxed unless it needs to be clicked.
- **Chrome.** A narrow left navigation: wordmark, team switcher, then the project tree. Each project row carries the mark of where its files live (GitHub, Google Drive, Rehearsal Cloud) and the coloured dots of whoever is on it right now; a plus adds a project. Agent status sits in a chip at the bottom above the person's own menu, which is where Admin and settings live. Nothing else goes in the chrome.
- **Motion.** Only in response to something the person did, or to show something changed (a new comment arriving, a version landing). No entrance animations.
- **Words.** Plain verbs, short sentences, no filler. Buttons say what happens: "Copy for your agent", "Put it on stage", "Resolve". Empty states tell you what to do next. Nothing apologises.
- **The prototype itself** is never styled by us. It sits on the stage at the chosen width, in its own frame, with our overlays (hover outline, pins, cursors, "being edited") drawn lightly on top.

## The core loop

1. Someone highlights a section in the browser and leaves an instruction.
2. Their agent receives it over MCP: the exact element, its code and the comments.
3. While the agent works, the section shows as "being edited" and is locked so a second agent cannot clash with it.
4. The agent publishes a new version or variant; everyone's view updates live.

## Phases

| Phase | What you get |
|---|---|
| 1. Foundations (done) | Sign in, teams, projects, storage picker, upload an HTML file or folder, view it live, hover readout, version history |
| 2. Agent connection (MCP) (done) | A person creates a token on "Connect your agent"; their agent lists projects, reads files, sees versions, publishes new ones credited to them, creates projects |
| 3. Live together (done) | Who's here, live cursors inside the prototype, comments pinned to elements with resolve, live refresh when agents publish; agents read and resolve comments over MCP |
| 4. Select and delegate | Select a section in the browser and send it to your connected agent; "being edited" overlays; section locks |
| 5. Variants | Section options A/B/C, switch in place, vote, pick a winner |
| 6. Chat | Chat panel per prototype that agents can also read and post to |

Each phase is usable on its own.

Also shipped on 14 Oct 2026: a step-by-step set-up page (storage, agent, first prototype), a one-paste agent connection, an admin area (teams, people, plans free/pro/enterprise, revoke access; admins are listed in `ADMIN_EMAILS`), and Google Drive as a second storage option. Drive needs a Google OAuth client (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) before it appears as available.

## Technical shape

- **Web app:** Next.js (App Router) on Vercel.
- **Sign in and organisations:** Clerk. The same identity is used by agents over MCP.
- **Data:** Postgres (Neon) for projects, storage connections, comments, variants, chat. No file storage of our own until Rehearsal Cloud.
- **Live presence:** Supabase Realtime (Marketplace, env prefix `SUPA_`) for presence, cursor broadcast and "something changed" nudges. Comments live in Neon.
- **Prototype rendering:** a sandboxed iframe, served through short-lived signed links (`/view/<grant>/<commit>/<file>`) because the sandbox has no cookies. A small helper script inside the frame gives every element a stable id, reports hovers and selections to the app, and draws overlays (comments, cursors, "being edited"). Uploaded code never touches the app itself.
- **Agent connection:** an MCP server at `/api/mcp` (Streamable HTTP). Agents authenticate with a personal token made in the app (hashed at rest); a "Sign in with Rehearsal" OAuth flow can replace this later. Tools today: list_projects, get_project, list_versions, read_file, publish_version, create_project. Later: comments and selections, variants, chat, section locks, and the browser pushing a task to a connected agent.
