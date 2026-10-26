import { useEffect, useRef, useState } from "react";
import { api, timeAgo, type Comment, type Mode, type PrototypeData, type ResourceLink } from "./api";
import { Field, Icon, initials } from "./ui";
import type { SelectedBlock } from "./Viewer";

export interface PanelProps {
  data: PrototypeData;
  me: string;
  reload: () => Promise<void>;
  selected: SelectedBlock | null;
  selectBlock: (id: string | null, scroll?: boolean) => void;
  preview: (blockId: string, content: string | null) => void;
  highlight: (blockId: string | null) => void;
  // A block the comments panel should scroll to and flash, after a pin was clicked.
  focusBlockId?: string | null;
  previewVersionId: string | null;
  previewVersion: (versionId: string | null) => void;
  onClose: () => void;
}

function PanelHead({ title, onClose, children }: { title: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="panel-head">
      <h3 className="truncate">{title}</h3>
      <div className="row">
        {children}
        <button className="icon-btn" onClick={onClose} title="Close">
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}

// The block panel: flick through a block's alternatives with their reasons,
// pick a favourite, and read or leave comments on that block.
export function BlockPanel({ data, selected, preview, highlight, reload, onClose }: PanelProps) {
  const block = data.blocks.find((b) => b.id === selected!.id);
  const label = data.blockMap.find((b) => b.id === selected!.id)?.label ?? block?.label ?? selected!.label;
  const versions = block?.versions ?? [];
  const liveIndex = Math.max(
    0,
    versions.findIndex((v) => v.id === block?.selectedVersionId),
  );
  const [index, setIndex] = useState(liveIndex);
  const [reason, setReason] = useState("");
  const [markup, setMarkup] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const blockId = selected!.id;

  useEffect(() => {
    if (versions.length > index) return;
    setIndex(liveIndex);
  }, [versions.length, index, liveIndex]);

  // Show the alternative in place while it is being looked at.
  useEffect(() => {
    const v = versions[index];
    if (!v || index === liveIndex) preview(blockId, null);
    else preview(blockId, v.content);
  }, [index, liveIndex, versions, blockId, preview]);

  useEffect(() => () => preview(blockId, null), [blockId, preview]);

  const current = versions[index];

  const use = async () => {
    if (!current) return;
    setBusy(true);
    await api.selectVersion(data.prototype.id, blockId, current.id);
    preview(blockId, null);
    await reload();
    setBusy(false);
  };

  const propose = async () => {
    setBusy(true);
    try {
      await api.proposeVersion(data.prototype.id, blockId, markup, reason);
      setAdding(false);
      setMarkup("");
      setReason("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="panel">
      <PanelHead title={label} onClose={onClose} />
      <div className="panel-body">
        {versions.length === 0 ? (
          <div className="panel-section" style={{ borderTop: 0 }}>
            <p className="muted">No alternatives yet. Ask your agent for one, or write one here.</p>
          </div>
        ) : (
          <div className="panel-section" style={{ borderTop: 0 }}>
            <div className="alt-nav">
              <button className="icon-btn" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} title="Previous">
                <Icon name="chevron-left" />
              </button>
              <span className="small muted">
                Alternative {index + 1} of {versions.length}
              </span>
              <button className="icon-btn" disabled={index === versions.length - 1} onClick={() => setIndex((i) => i + 1)} title="Next">
                <Icon name="chevron-right" />
              </button>
            </div>
            {current && (
              <div key={current.id} className={`alt-card alt-in ${index === liveIndex ? "live" : ""}`}>
                <div className="alt-meta">
                  <span className="row">
                    <span className="avatar light">{initials(current.author)}</span>
                    <span style={{ color: "var(--ink)" }}>{current.author}</span>
                  </span>
                  <span>{timeAgo(current.createdAt)}</span>
                </div>
                <p className={`alt-why ${current.rationale ? "" : "none"}`}>{current.rationale || (current.author === "Original" ? "What was there before anyone proposed a change." : "No reason given.")}</p>
                <div className="alt-preview">{current.content}</div>
                <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
                  <span className="small muted">{index === liveIndex ? "This is the live version." : ""}</span>
                  <button className="btn small primary" disabled={index === liveIndex || busy} onClick={use}>
                    {index === liveIndex ? "Live" : "Use this"}
                  </button>
                </div>
              </div>
            )}
            <div className="alt-dots">
              {versions.map((v, i) => (
                <span key={v.id} className={i === index ? "on" : i === liveIndex ? "live" : ""} />
              ))}
            </div>
          </div>
        )}

        <div className="panel-section">
          {adding ? (
            <>
              <h4>New alternative</h4>
              <Field label="Markup of this element">
                <textarea className="textarea code" value={markup} onChange={(e) => setMarkup(e.target.value)} />
              </Field>
              <Field label="Why">
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="One line, or leave empty" />
              </Field>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn small" onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button className="btn small primary" disabled={!markup.trim() || busy} onClick={propose}>
                  Add
                </button>
              </div>
            </>
          ) : (
            <button
              className="link"
              onClick={() => {
                setMarkup(current?.content ?? selected!.html ?? "");
                setAdding(true);
              }}
            >
              Write an alternative by hand
            </button>
          )}
        </div>

        <div className="panel-section">
          <h4>Comments on this block</h4>
          <Threads data={data} blockId={blockId} reload={reload} highlight={highlight} />
        </div>
      </div>
    </aside>
  );
}

function Threads({
  data,
  blockId,
  reload,
  showResolved = false,
  highlight,
}: {
  data: PrototypeData;
  blockId: string | null;
  reload: () => Promise<void>;
  showResolved?: boolean;
  highlight?: (blockId: string | null) => void;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [open, setOpen] = useState(showResolved);
  const all = data.comments.filter((c) => !c.parentId && (c.blockId ?? null) === blockId);
  const roots = all.filter((c) => !c.resolvedAt);
  const resolved = all.filter((c) => c.resolvedAt);
  const replies = (id: string) => data.comments.filter((c) => c.parentId === id);
  const toggle = (c: Comment) => api.resolveComment(data.prototype.id, c.id, !c.resolvedAt).then(reload);
  const thread = (c: Comment) => (
        <div
          key={c.id}
          className={`comment ${c.resolvedAt ? "resolved" : ""}`}
          onMouseEnter={() => blockId && highlight?.(blockId)}
          onMouseLeave={() => blockId && highlight?.(null)}
        >
          <CommentRow c={c} />
          <div className="comment-actions">
            <button className="link small" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
              Reply
            </button>
            <button className="link small" onClick={() => toggle(c)}>
              {c.resolvedAt ? "Reopen" : "Resolve"}
            </button>
          </div>
          {replies(c.id).map((r) => (
            <div key={r.id} className="comment reply">
              <CommentRow c={r} />
            </div>
          ))}
          {replyTo === c.id && (
            <Compose
              placeholder="Reply"
              onSend={(body) =>
                api.addComment(data.prototype.id, { body, blockId, parentId: c.id }).then(() => {
                  setReplyTo(null);
                  return reload();
                })
              }
            />
          )}
        </div>
      );
  return (
    <div>
      {roots.map(thread)}
      {resolved.length > 0 && (
        <button className="resolved-toggle" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "chevron-down" : "chevron-right"} size={12} />
          {resolved.length} resolved
        </button>
      )}
      {open && resolved.map(thread)}
      <Compose placeholder={blockId ? "Comment on this block" : "Comment on the whole page"} onSend={(body) => api.addComment(data.prototype.id, { body, blockId }).then(reload)} />
    </div>
  );
}

function CommentRow({ c }: { c: Comment }) {
  return (
    <>
      <div className="comment-meta">
        <strong>{c.author}</strong>
        <span>{timeAgo(c.createdAt)}</span>
        {c.resolvedAt && (
          <span className="resolved-mark">
            <Icon name="check" size={11} /> resolved
          </span>
        )}
      </div>
      <div className="comment-body">{c.body}</div>
    </>
  );
}

function Compose({ placeholder, onSend }: { placeholder: string; onSend: (body: string) => Promise<unknown> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="compose"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        onSend(body).finally(() => {
          setBody("");
          setBusy(false);
        });
      }}
    >
      <textarea
        className="textarea"
        style={{ minHeight: 56 }}
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn small primary" disabled={!body.trim() || busy}>
          Post
        </button>
      </div>
    </form>
  );
}

export function CommentsPanel({ data, reload, selectBlock, highlight, focusBlockId, onClose }: PanelProps) {
  const showResolved = false;
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusBlockId || !focusRef.current) return;
    focusRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    focusRef.current.classList.remove("flash");
    void focusRef.current.offsetWidth;
    focusRef.current.classList.add("flash");
  }, [focusBlockId]);
  const blockIds = [...new Set(data.comments.filter((c) => c.blockId && !c.parentId && (showResolved || !c.resolvedAt)).map((c) => c.blockId!))];
  const labelOf = (id: string) => data.blockMap.find((b) => b.id === id)?.label ?? data.blocks.find((b) => b.id === id)?.label ?? id;
  return (
    <aside className="panel">
      <PanelHead title="Comments" onClose={onClose} />
      <div className="panel-body">
        <div className="panel-section" style={{ borderTop: 0 }}>
          <h4>Whole page</h4>
          <Threads data={data} blockId={null} reload={reload} showResolved={showResolved} />
        </div>
        {blockIds.map((id) => (
          <div key={id} className="panel-section" ref={id === focusBlockId ? focusRef : undefined}>
            <button className="comment-target" onClick={() => selectBlock(id)} onMouseEnter={() => highlight(id)} onMouseLeave={() => highlight(null)}>
              <Icon name="chevron-right" size={12} />
              {labelOf(id)}
            </button>
            <Threads data={data} blockId={id} reload={reload} showResolved={showResolved} highlight={highlight} />
          </div>
        ))}
      </div>
    </aside>
  );
}

export function VersionsPanel({ data, selectBlock, highlight, previewVersionId, previewVersion, onClose }: PanelProps) {
  return (
    <aside className="panel">
      <PanelHead title="Versions" onClose={onClose} />
      <div className="panel-body">
        <div className="panel-section" style={{ borderTop: 0 }}>
          <h4>Page versions</h4>
          <div className="timeline">
            {data.versions.map((v, i) => (
              <div key={v.id} className="tl-item">
                <span className="mark" />
                <div>
                  <button onClick={() => previewVersion(i === 0 ? null : v.id)} style={{ fontWeight: (previewVersionId ?? data.versions[0]?.id) === v.id ? 500 : 400 }}>
                    {v.message}
                  </button>
                  {i === 0 && <span className="small muted"> · current</span>}
                  <div className="when">
                    {v.author} · {timeAgo(v.createdAt)}
                  </div>
                  {v.rationale && <p className="small muted">{v.rationale}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-section">
          <h4>Blocks with alternatives</h4>
          {data.blocks.length === 0 && <p className="muted small">None yet. Click any element to see or add alternatives.</p>}
          {data.blocks.map((b) => (
            <button key={b.id} className="list-row" onClick={() => selectBlock(b.id)} onMouseEnter={() => highlight(b.id)} onMouseLeave={() => highlight(null)}>
              <span className="truncate">{b.label}</span>
              <span className="muted small">{b.versions.length}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function InsightsPanel({ data, selectBlock, highlight, onClose }: PanelProps) {
  return (
    <aside className="panel">
      <PanelHead title="Insights" onClose={onClose} />
      <div className="panel-body">
        <div className="panel-section" style={{ borderTop: 0 }}>
          <h4>Decisions</h4>
          {data.decisions.length === 0 && <p className="muted small">No decisions yet. When you pick a favourite alternative, it is recorded here with its reason.</p>}
          {data.decisions.map((d) => (
            <button
              key={`${d.blockId}-${d.at}`}
              className="decision"
              onClick={() => selectBlock(d.blockId)}
              onMouseEnter={() => highlight(d.blockId)}
              onMouseLeave={() => highlight(null)}
            >
              <span className="decision-title truncate">{d.blockLabel}</span>
              <span className="decision-meta">
                {d.by} picked {d.versionAuthor === "Original" ? "the original" : `${d.versionAuthor}'s version`} · {timeAgo(d.at)}
              </span>
              {d.rationale && <span className="decision-why">{d.rationale}</span>}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function DetailsPanel({ data, reload, onClose }: PanelProps) {
  const p = data.prototype;
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description);
  const [links, setLinks] = useState<ResourceLink[]>(p.resourceLinks);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const save = (patch: Partial<{ title: string; description: string; mode: Mode; resourceLinks: ResourceLink[] }>) => api.updatePrototype(p.id, patch).then(reload);

  return (
    <aside className="panel">
      <PanelHead title="Details" onClose={onClose} />
      <div className="panel-body">
        <div className="panel-section" style={{ borderTop: 0 }}>
          <Field label="Title">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== p.title && save({ title })} />
          </Field>
          <Field label="Description">
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => description !== p.description && save({ description })} />
          </Field>
          <Field label="Mode">
            <div className="row">
              <button className={`btn small ${p.mode === "wireframe" ? "on" : ""}`} onClick={() => save({ mode: "wireframe" })}>
                Wireframe
              </button>
              <button className={`btn small ${p.mode === "production" ? "on" : ""}`} onClick={() => save({ mode: "production" })}>
                Production-ready
              </button>
            </div>
          </Field>
        </div>
        <div className="panel-section">
          <h4>Resources</h4>
          <p className="hint" style={{ marginBottom: 8 }}>
            Docs, tickets, research and Figma files. Agents get these as context.
          </p>
          <div className="links-list">
            {links.map((l, i) => (
              <div key={i} className="row">
                <a className="grow truncate" href={l.url} target="_blank" rel="noreferrer">
                  {l.label || l.url}
                </a>
                <button
                  className="icon-btn"
                  title="Remove"
                  onClick={() => {
                    const next = links.filter((_, j) => j !== i);
                    setLinks(next);
                    void save({ resourceLinks: next });
                  }}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="compose"
            onSubmit={(e) => {
              e.preventDefault();
              const next = [...links, { label: label.trim(), url: url.trim() }];
              setLinks(next);
              setLabel("");
              setUrl("");
              void save({ resourceLinks: next });
            }}
          >
            <input className="input" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className="input" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn small" disabled={!url.trim()}>
                Add link
              </button>
            </div>
          </form>
        </div>
        <div className="panel-section">
          <h4>On disk</h4>
          <dl className="kv">
            <dt>Folder</dt>
            <dd className="mono">{p.dir}</dd>
            <dt>Files</dt>
            <dd className="mono">{data.files.join(", ")}</dd>
            <dt>Blocks</dt>
            <dd>{data.blockMap.length}</dd>
          </dl>
        </div>
      </div>
    </aside>
  );
}
