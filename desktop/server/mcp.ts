import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { Store } from "../core/store";
import { readDesignLibrary } from "../core/library";
import type { Mode, ResourceLink } from "../core/types";

// The MCP server any agent can talk to. The same tools are served over
// stdio (for Claude Code and friends launching it directly) and over local
// HTTP from inside the app.

export const INSTRUCTIONS = `Rehearsal is where a designer keeps the HTML prototypes you build for them, with the reasons behind every change. You act for one designer on their own machine.

How to work:
1. Before generating any UI, call get_design_library for the workspace. Use its tokens, components and rules so what you build matches the real design system.
2. Every meaningful element in a prototype carries a stable data-rh-id attribute. Keep those ids exactly as they are when you edit; only add new ones for new elements. History is attached to them.
3. When the designer asks for a change, ask them why before you build it, in one short line, for example "Why this change? (one line, or say skip)". Pass their answer as the rationale. If they skip, pass an empty rationale. Ask once per change, never nag.
4. For a change to one element, use propose_block_version with the element's data-rh-id and the full new markup of that element. It is saved as an alternative the designer can flick through and pick; pass select: true only when they asked for it to go live straight away.
5. For a change across the page, use update_prototype with the whole file, a one-line message and the rationale.
6. Read list_comments to see what reviewers asked for, and resolve_comment when you have dealt with one.

Keep prototypes self-contained: one index.html with inline CSS and JS or relative links to files you also send, no build step.`;

export type Notify = (event: { type: string; prototypeId?: string; workspaceId?: string }) => void;

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

const mode = z.enum(["wireframe", "production"]);
const link = z.object({ label: z.string(), url: z.string() });
const file = z.object({ path: z.string(), content: z.string() });
const author = z.string().optional().describe("Who you are acting for. Defaults to the designer signed in to Rehearsal on this machine.");

export function createMcpServer(store: Store, notify: Notify = () => {}): McpServer {
  const server = new McpServer({ name: "rehearsal", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  const guard = <T>(fn: () => T) => {
    try {
      return text(fn());
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  };

  server.registerTool("whoami", { title: "Who am I", description: "The designer you are acting for, and where Rehearsal keeps its data.", inputSchema: z.object({}) }, () =>
    guard(() => ({ name: store.me(), home: store.home })),
  );

  server.registerTool("list_workspaces", { title: "List workspaces", description: "Every workspace Rehearsal knows about on this machine.", inputSchema: z.object({}) }, () =>
    guard(() => store.listWorkspaces().map((w) => ({ id: w.id, name: w.name, path: w.path, designLibraryRepo: w.designLibraryRepo ?? null, plan: w.plan }))),
  );

  server.registerTool(
    "list_prototypes",
    { title: "List prototypes", description: "Prototypes in a workspace, or in all of them.", inputSchema: z.object({ workspaceId: z.string().optional() }) },
    ({ workspaceId }) =>
      guard(() =>
        store.listPrototypes(workspaceId).map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          mode: p.mode,
          folder: p.folder,
          workspaceId: p.workspaceId,
          updatedAt: p.updatedAt,
        })),
      ),
  );

  server.registerTool(
    "get_prototype",
    {
      title: "Get prototype",
      description: "A prototype's HTML, metadata, resource links, mode, files and block map (every element id you must keep), plus which blocks already have alternatives.",
      inputSchema: z.object({ prototypeId: z.string() }),
    },
    ({ prototypeId }) =>
      guard(() => {
        const proto = store.findPrototype(prototypeId);
        if (!proto) throw new Error("No prototype with that id.");
        const blocks = store.blocks(proto);
        const comments = store.comments(proto);
        return {
          ...proto,
          html: store.readHtml(proto),
          files: store.listFiles(proto),
          blockMap: store.blockMap(proto),
          blocksWithHistory: blocks.map((b) => ({ id: b.id, label: b.label, versions: b.versions.length, selectedVersionId: b.selectedVersionId })),
          openComments: comments.filter((c) => !c.resolvedAt).length,
        };
      }),
  );

  server.registerTool(
    "read_file",
    { title: "Read file", description: "One file from a prototype's folder, for example styles.css.", inputSchema: z.object({ prototypeId: z.string(), path: z.string() }) },
    ({ prototypeId, path }) =>
      guard(() => {
        const proto = store.findPrototype(prototypeId);
        if (!proto) throw new Error("No prototype with that id.");
        const data = store.readFile(proto, path);
        if (!data) throw new Error(`No file at ${path}.`);
        return data.toString("utf8");
      }),
  );

  server.registerTool(
    "get_design_library",
    {
      title: "Get design library",
      description: "The design system linked to a workspace: its rules, tokens and components. Load this before generating any UI.",
      inputSchema: z.object({ workspaceId: z.string() }),
    },
    ({ workspaceId }) =>
      guard(() => {
        const ws = store.getWorkspace(workspaceId);
        if (!ws) throw new Error("No workspace with that id.");
        if (!ws.designLibraryRepo) return { note: "This workspace has no design library linked yet. Ask the designer to set one in workspace settings, or build with plain, neutral styles." };
        return readDesignLibrary(ws.designLibraryRepo);
      }),
  );

  server.registerTool(
    "create_prototype",
    {
      title: "Create prototype",
      description: "Save a new HTML prototype into a workspace folder with a title and description. Block ids are added to any element that lacks one.",
      inputSchema: z.object({
        workspaceId: z.string(),
        folder: z.string().optional().describe("Folder inside the workspace, e.g. 'Landing pages'. Created if missing. Omit for the root."),
        title: z.string().min(1),
        description: z.string().optional(),
        mode: mode.optional().describe("wireframe for rough exploration, production for designs headed to build"),
        html: z.string().min(1).describe("The full index.html"),
        files: z.array(file).optional().describe("Other files to save beside it, such as styles.css"),
        resourceLinks: z.array(link).optional(),
        author,
      }),
    },
    (input) =>
      guard(() => {
        const proto = store.createPrototype(input.workspaceId, { ...input, mode: input.mode as Mode | undefined, resourceLinks: input.resourceLinks as ResourceLink[] | undefined });
        notify({ type: "prototypes", workspaceId: input.workspaceId });
        return { id: proto.id, title: proto.title, folder: proto.folder, blockMap: store.blockMap(proto) };
      }),
  );

  server.registerTool(
    "propose_block_version",
    {
      title: "Propose block version",
      description:
        "Add an alternative for one element, identified by its data-rh-id, with the designer's one-line reason. Send the whole element's markup. The designer flicks through alternatives in the app and picks one; it only goes live now if select is true.",
      inputSchema: z.object({
        prototypeId: z.string(),
        blockId: z.string().describe("The element's data-rh-id"),
        content: z.string().min(1).describe("The full new markup of that one element"),
        rationale: z.string().optional().describe("The designer's one-line reason. Empty if they skipped."),
        select: z.boolean().optional().describe("Make it the live version straight away"),
        author,
      }),
    },
    ({ prototypeId, blockId, content, rationale, select, author: who }) =>
      guard(() => {
        const result = store.proposeBlockVersion(prototypeId, { blockId, content, rationale, author: who, source: "agent", select });
        notify({ type: "blocks", prototypeId });
        return { versionId: result.version.id, author: result.version.author, alternatives: result.block.versions.length, live: result.block.selectedVersionId === result.version.id };
      }),
  );

  server.registerTool(
    "update_prototype",
    {
      title: "Update prototype",
      description: "A page-level change: replace the HTML (and any other files) and record a one-line message and the designer's reason. Metadata can be changed in the same call.",
      inputSchema: z.object({
        prototypeId: z.string(),
        html: z.string().optional().describe("The full new index.html, keeping every existing data-rh-id"),
        files: z.array(file).optional(),
        message: z.string().min(1).describe("What changed, in one line"),
        rationale: z.string().optional().describe("Why, in the designer's words. Empty if they skipped."),
        title: z.string().optional(),
        description: z.string().optional(),
        mode: mode.optional(),
        resourceLinks: z.array(link).optional(),
        author,
      }),
    },
    ({ prototypeId, html, files, message, rationale, title, description, mode: m, resourceLinks, author: who }) =>
      guard(() => {
        const meta: Record<string, unknown> = {};
        if (title !== undefined) meta.title = title;
        if (description !== undefined) meta.description = description;
        if (m !== undefined) meta.mode = m;
        if (resourceLinks !== undefined) meta.resourceLinks = resourceLinks;
        if (Object.keys(meta).length) store.updatePrototype(prototypeId, meta);
        let versionId: string | null = null;
        if (html) versionId = store.updateHtml(prototypeId, { html, files, message, rationale, author: who, source: "agent" }).id;
        notify({ type: "versions", prototypeId });
        return { updated: true, versionId };
      }),
  );

  server.registerTool(
    "add_comment",
    {
      title: "Add comment",
      description: "Leave a comment on the whole page or on one block, or reply in a thread.",
      inputSchema: z.object({
        prototypeId: z.string(),
        body: z.string().min(1),
        blockId: z.string().optional().describe("data-rh-id of the element, or omit for the whole page"),
        parentId: z.string().optional().describe("Comment id to reply to"),
        author,
      }),
    },
    ({ prototypeId, body, blockId, parentId, author: who }) =>
      guard(() => {
        const c = store.addComment(prototypeId, { body, blockId, parentId, author: who });
        notify({ type: "comments", prototypeId });
        return c;
      }),
  );

  server.registerTool(
    "list_comments",
    { title: "List comments", description: "Comments on a prototype, open ones first unless includeResolved is set.", inputSchema: z.object({ prototypeId: z.string(), includeResolved: z.boolean().optional() }) },
    ({ prototypeId, includeResolved }) =>
      guard(() => {
        const proto = store.findPrototype(prototypeId);
        if (!proto) throw new Error("No prototype with that id.");
        const map = new Map(store.blockMap(proto).map((b) => [b.id, b.label]));
        return store
          .comments(proto)
          .filter((c) => includeResolved || !c.resolvedAt)
          .map((c) => ({ ...c, blockLabel: c.blockId ? (map.get(c.blockId) ?? null) : null }));
      }),
  );

  server.registerTool(
    "resolve_comment",
    { title: "Resolve comment", description: "Mark a comment as dealt with.", inputSchema: z.object({ prototypeId: z.string(), commentId: z.string() }) },
    ({ prototypeId, commentId }) =>
      guard(() => {
        const c = store.resolveComment(prototypeId, commentId);
        notify({ type: "comments", prototypeId });
        return { resolved: Boolean(c.resolvedAt) };
      }),
  );

  server.registerTool(
    "get_insights",
    {
      title: "Get insights",
      description: "The decision timeline for a prototype or one of its blocks (which version was picked, by whom and why), its page versions and any linked analytics.",
      inputSchema: z.object({ prototypeId: z.string(), blockId: z.string().optional() }),
    },
    ({ prototypeId, blockId }) =>
      guard(() => {
        const proto = store.findPrototype(prototypeId);
        if (!proto) throw new Error("No prototype with that id.");
        const decisions = store.decisions(proto).filter((d) => !blockId || d.blockId === blockId);
        const blocks = store.blocks(proto).filter((b) => !blockId || b.id === blockId);
        return {
          decisions,
          alternatives: blocks.map((b) => ({ blockId: b.id, label: b.label, selectedVersionId: b.selectedVersionId, versions: b.versions.map(({ content: _c, ...v }) => v) })),
          pageVersions: blockId ? [] : store.pageVersions(proto),
          analytics: store.insightLinks(proto).filter((l) => !blockId || l.blockId === blockId),
        };
      }),
  );

  return server;
}
