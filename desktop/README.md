# Rehearsal for Mac

A local-first Mac app where designers keep AI-built HTML prototypes, review them, and evolve them through their own AI agent. Every prototype is plain files on disk; every change carries the reason behind it.

## How it fits together

- `core/` is the data model on disk and the only code that reads or writes a workspace. A workspace is a folder with `workspace.json`; a prototype is a folder with `prototype.json`, `index.html` and a `history/` folder. Every version, selection and comment is its own small JSON file, so two people sharing the folder through Google Drive never overwrite each other.
- `server/` is one local HTTP server on port 4848 (or the next free port): the app's API, the prototype files for the sandboxed frame, a stream of changes on disk, and the MCP endpoint at `/mcp`. `server/stdio.ts` serves the same MCP tools over stdio for agents that start the server themselves.
- `electron/` is the Mac shell: it starts the server and opens a window on it. Folder picking and "show in Finder" come from here.
- `src/` is the React app: the file browser, the prototype viewer with viewports and full preview, and the Comments, Versions, Insights and Details panels.
- `public/frame-helper.js` runs inside every prototype on the stage. It reports hovers and clicks, previews alternatives in place and draws comment pins. The prototype's own code is never changed.
- `skill/SKILL.md` is the skill agents are given: load the design library first, keep block ids, ask why before every change, save the answer with the version.
- `demo/` is a seeded workspace with the five-headline scenario.

## Blocks and the why

Every meaningful element in a prototype carries a stable `data-rh-id`. When an agent proposes a change to one element it calls `propose_block_version` with the designer's one-line reason; the alternative is kept alongside the original and the designer flicks through them in the app and picks a favourite. Picking rewrites `index.html` and records the decision, so the Insights panel can show which version was chosen, by whom and why.

## Working on it

```bash
pnpm install        # from the repository root
cd desktop
pnpm build          # bundles the server, shell and stdio entry, then the UI
pnpm start          # opens the Mac app
pnpm test           # data model tests
```

`pnpm serve` runs the same server without Electron for use in an ordinary browser. `node --import tsx scripts/seed-demo.ts` registers the demo workspace and seeds the five headlines. `scripts/snap.cjs` drives the app offscreen and saves screenshots, which is how the viewer is checked without a person at the screen.

## Not built yet

Supabase sync and live collaboration for Teams, Stripe billing and the pricing page, PostHog metrics in the Insights panel, and a signed, packaged build of the app.
