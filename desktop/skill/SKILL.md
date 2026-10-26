---
name: rehearsal
description: Work on a designer's HTML prototypes in Rehearsal over MCP. Use whenever the designer asks to build, change, review or comment on a prototype, a landing page, a screen or a mock-up, or mentions Rehearsal, a workspace, a block, a version or a rationale. Loads the design library first, keeps block ids, asks why before every change and saves the answer with the version.
---

# Rehearsal

Rehearsal is where the designer keeps the HTML prototypes you build, with the reasons behind every change. You reach it through the `rehearsal` MCP server. Every tool call acts for the designer on their own machine.

## Before you build anything

1. Call `list_workspaces`, then `get_design_library` for the workspace you are working in. Use its tokens, components and rules so the UI you generate matches the real design system. If no library is linked, say so once and build with plain, neutral styles.
2. Call `get_prototype` before editing an existing prototype. It returns the HTML and the block map: every element id you must keep.

## Block ids

Every meaningful element carries `data-rh-id="..."`. Rehearsal attaches history, comments and decisions to those ids.

- Keep every existing `data-rh-id` exactly as it is when you edit, even when you rewrite the element's markup around it.
- Do not invent ids for new elements; leave them without one and Rehearsal adds ids when it saves.
- Never move an id from one element to another.

## Ask why, once, quickly

When the designer asks for a change, ask why before you build it. One short line, and make skipping easy:

> Why this change? (one line, or say skip)

Wait for the answer. Pass it as the `rationale`. If they skip, pass an empty rationale. Ask once per change, never twice for the same thing, and never for trivial fixes the designer did not ask about. The point is to keep the reasoning, not to slow the designer down.

## Making changes

- One element changed: `propose_block_version` with the element's `data-rh-id` and the full markup of that one element. It is saved as an alternative the designer can flick through in the app. Pass `select: true` only when they asked for it to go live now.
- Several elements or the page structure: `update_prototype` with the whole `index.html`, a one-line `message` and the `rationale`.
- A new prototype: `create_prototype` with a title, a one-line description, the mode (`wireframe` for rough exploration, `production` for designs headed to build) and the full HTML. Add `resourceLinks` for any docs, tickets, research or Figma files the designer mentions.

Keep prototypes self-contained: one `index.html` with inline CSS and JS, or relative links to files you send alongside it. No build step, no external scripts the designer did not ask for.

## Comments

Call `list_comments` to see what reviewers asked for. Each comment names the block it is pinned to. After you have dealt with one, call `resolve_comment`.

## Acting for someone else

If you are proposing on behalf of a named person (for example five people each proposing a headline), pass their name as `author` so the version carries it.
