"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Comment } from "@/db/schema";
import { addComment, setCommentResolved } from "@/lib/actions";
import { colourFor, type Person } from "@/lib/people";
import { useProjectRoom } from "@/lib/realtime";
import type { Version } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { UploadDropzone } from "@/components/upload-dropzone";

type Props = {
  project: { id: string; name: string; location: string };
  src: string | null;
  versions: Version[];
  currentVersion: string | null;
  comments: Comment[];
  me: Person;
  realtime: { url: string | null; key: string | null };
};

const widths = [
  { label: "Desktop", value: null },
  { label: "Tablet", value: 820 },
  { label: "Phone", value: 390 },
] as const;

type Selection = { element: string; label: string };

export function Workspace({ project, src, versions, currentVersion, comments, me, realtime }: Props) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  // Counts frame loads so state is re-sent whenever the frame starts afresh.
  const [ready, setReady] = useState(0);
  const [width, setWidth] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mode, setMode] = useState<"browse" | "comment">("browse");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const { peers, sendCursor } = useProjectRoom({
    projectId: project.id,
    me,
    supabaseUrl: realtime.url,
    supabaseKey: realtime.key,
    onEvent: () => router.refresh(),
  });

  const post = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  // Messages from the helper script inside the frame.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const m = e.data ?? {};
      if (m.type === "rehearsal:ready") setReady((n) => n + 1);
      else if (m.type === "rehearsal:hover") setHovered(m.element ?? null);
      else if (m.type === "rehearsal:cursor") sendCursor(m.x, m.y);
      else if (m.type === "rehearsal:select") setSelection({ element: m.element, label: m.label });
      else if (m.type === "rehearsal:pin") {
        setActiveId(m.id);
        document.getElementById(`comment-${m.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendCursor]);

  const visible = useMemo(
    () => comments.filter((c) => showResolved || !c.resolvedAt),
    [comments, showResolved],
  );

  useEffect(() => {
    if (ready) post({ type: "rehearsal:mode", mode });
  }, [ready, mode, post]);

  useEffect(() => {
    if (ready) post({ type: "rehearsal:peers", peers });
  }, [ready, peers, post]);

  useEffect(() => {
    if (!ready) return;
    post({
      type: "rehearsal:pins",
      pins: visible.map((c, i) => ({
        id: c.id,
        n: i + 1,
        element: c.element,
        colour: colourFor(c.authorId),
        resolved: Boolean(c.resolvedAt),
        active: c.id === activeId,
        author: c.authorName,
      })),
    });
  }, [ready, visible, activeId, post]);

  function focus(c: Comment) {
    setActiveId(c.id);
    post({ type: "rehearsal:focus", element: c.element });
  }

  function leaveCommentMode() {
    setMode("browse");
    setSelection(null);
    post({ type: "rehearsal:clear" });
  }

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-stage">
        {src ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between gap-6 px-5 text-xs text-muted">
              <span className="truncate font-mono">
                {mode === "comment" ? (selection ? `Commenting on ${selection.label}` : "Click an element to comment on it") : (hovered ?? "")}
              </span>
              <div className="flex shrink-0 items-center gap-5">
                <div data-people className="flex items-center -space-x-1.5" title={[me, ...peers].map((p) => p.name).join(", ")}>
                  {[me, ...peers].map((p) => (
                    <span
                      key={p.id}
                      className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-stage"
                      style={{ background: p.colour }}
                    >
                      {initials(p.name)}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => (mode === "comment" ? leaveCommentMode() : setMode("comment"))}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    mode === "comment" ? "bg-ink text-paper" : "hover:text-ink"
                  }`}
                >
                  {mode === "comment" ? "Done commenting" : "Comment"}
                </button>
                <div className="flex gap-4">
                  {widths.map((w) => (
                    <button
                      key={w.label}
                      type="button"
                      onClick={() => setWidth(w.value)}
                      className={`underline-offset-4 hover:underline ${width === w.value ? "text-ink underline" : ""}`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 justify-center overflow-auto px-5 pb-5">
              <iframe
                ref={frame}
                key={src}
                src={src}
                title="Prototype"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
                className="h-full bg-white shadow-[0_0_0_1px_var(--hairline)]"
                style={{ width: width ?? "100%", maxWidth: "100%" }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-12">
            <div className="max-w-[44ch]">
              <h2 className="text-3xl">Nothing on stage yet.</h2>
              <p className="mt-3 text-muted">
                Drop an HTML file or a whole folder here, or ask your agent to publish one to{" "}
                <span className="font-mono text-sm">{project.location}</span>.
              </p>
              <div className="mt-8">
                <UploadDropzone projectId={project.id} large />
              </div>
            </div>
          </div>
        )}
      </section>

      <aside className="flex w-[320px] shrink-0 flex-col border-l border-hairline">
        <div className="border-b border-hairline px-5 py-5">
          <Link href="/projects" className="text-xs text-muted underline-offset-4 hover:underline">
            All projects
          </Link>
          <h1 className="mt-2 text-2xl leading-tight">{project.name}</h1>
          <p className="mt-1 truncate font-mono text-xs text-muted">{project.location}</p>
        </div>

        {src && (
          <div className="border-b border-hairline px-5 py-4">
            <UploadDropzone projectId={project.id} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selection && currentVersion && (
            <div className="border-b border-hairline px-5 py-4">
              <Composer
                projectId={project.id}
                version={currentVersion}
                selection={selection}
                onDone={() => {
                  setSelection(null);
                  post({ type: "rehearsal:clear" });
                }}
              />
            </div>
          )}

          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-sans text-sm text-muted">Comments</h2>
              {comments.some((c) => c.resolvedAt) && (
                <button
                  type="button"
                  onClick={() => setShowResolved((s) => !s)}
                  className="text-xs text-muted underline-offset-4 hover:underline"
                >
                  {showResolved ? "Hide resolved" : "Show resolved"}
                </button>
              )}
            </div>
            {visible.length === 0 ? (
              <p className="mt-2 text-sm text-faint">
                {src ? "None yet. Press Comment, then click any part of the prototype." : "None yet."}
              </p>
            ) : (
              <ol className="mt-2 flex flex-col">
                {visible.map((c, i) => (
                  <li key={c.id} id={`comment-${c.id}`}>
                    <CommentRow
                      comment={c}
                      n={i + 1}
                      active={c.id === activeId}
                      stale={Boolean(currentVersion) && c.version !== currentVersion}
                      onFocus={() => focus(c)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="border-t border-hairline px-5 py-4">
            <h2 className="font-sans text-sm text-muted">Versions</h2>
            {versions.length === 0 ? (
              <p className="mt-2 text-sm text-faint">None yet.</p>
            ) : (
              <ol className="mt-2">
                {versions.map((ver, i) => {
                  const active = ver.id === currentVersion;
                  const [title, ...rest] = ver.message.split("\n");
                  const why = rest.join("\n").trim();
                  return (
                    <li key={ver.id}>
                      <Link
                        href={i === 0 ? `/projects/${project.id}` : `/projects/${project.id}?v=${ver.id}`}
                        className={`-mx-2 block rounded px-2 py-2 transition-colors hover:bg-stage ${active ? "bg-stage" : ""}`}
                      >
                        <span className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate">{title}</span>
                          {i === 0 && <span className="shrink-0 text-xs text-muted">Latest</span>}
                        </span>
                        <span className="block text-xs text-muted">
                          {ver.author}, {timeAgo(ver.date)}
                        </span>
                        {active && why && <span className="mt-1.5 block text-xs leading-relaxed text-muted">{why}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Composer({
  projectId,
  version,
  selection,
  onDone,
}: {
  projectId: string;
  version: string;
  selection: Selection;
  onDone: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const result = await addComment(projectId, { element: selection.element, elementLabel: selection.label, version, body });
      if (result.error) setError(result.error);
      else {
        setBody("");
        onDone();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="truncate font-mono text-xs text-muted">{selection.label}</span>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        rows={3}
        placeholder="What should change here?"
        className="resize-none rounded-md border border-hairline px-3 py-2 text-sm"
      />
      {error && <p className="text-xs">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="rounded-md bg-ink px-3 py-1.5 text-xs text-paper transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {pending ? "Posting…" : "Post"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-muted underline-offset-4 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  n,
  active,
  stale,
  onFocus,
}: {
  comment: Comment;
  n: number;
  active: boolean;
  stale: boolean;
  onFocus: () => void;
}) {
  const [pending, start] = useTransition();
  const resolved = Boolean(comment.resolvedAt);

  return (
    <div
      className={`-mx-2 rounded px-2 py-2.5 transition-colors ${active ? "bg-stage" : "hover:bg-stage"} ${resolved ? "opacity-60" : ""}`}
    >
      <button type="button" onClick={onFocus} className="flex w-full items-start gap-3 text-left">
        <span
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: resolved ? "#a8a8a4" : colourFor(comment.authorId) }}
        >
          {n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm">{comment.body}</span>
          <span className="mt-1 block truncate text-xs text-muted">
            {comment.authorName}, {timeAgo(comment.createdAt)}
            {stale ? ", on an earlier version" : ""}
          </span>
          <span className="block truncate font-mono text-[11px] text-faint">{comment.elementLabel}</span>
        </span>
      </button>
      <div className="mt-1.5 pl-8">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => setCommentResolved(comment.id, !resolved))}
          className="text-xs text-muted underline-offset-4 hover:underline disabled:opacity-40"
        >
          {resolved ? "Reopen" : "Resolve"}
        </button>
      </div>
    </div>
  );
}
