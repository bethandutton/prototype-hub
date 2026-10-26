import { useCallback, useEffect, useRef, useState } from "react";
import { api, timeAgo, type ChangeEvent, type PrototypeData } from "./api";
import { FILL, VIEWPORTS, type Viewport } from "./viewports";
import { Icon, Menu, ModeBadge } from "./ui";
import { BlockPanel, CommentsPanel, DetailsPanel, InsightsPanel, VersionsPanel, type PanelProps } from "./Panels";
import { AgentPanel } from "./AgentPanel";

export type SelectedBlock = { id: string; tag: string; label: string; html: string };

// Open comment threads per block, with what the pin's hover card needs.
function pinsFor(data: PrototypeData) {
  const byBlock = new Map<string, PrototypeData["comments"]>();
  for (const c of data.comments) {
    if (!c.blockId || c.parentId || c.resolvedAt) continue;
    byBlock.set(c.blockId, [...(byBlock.get(c.blockId) ?? []), c]);
  }
  return [...byBlock].map(([blockId, roots]) => ({
    blockId,
    count: roots.length,
    label: data.blockMap.find((b) => b.id === blockId)?.label ?? "",
    threads: roots.map((r) => ({
      author: r.author,
      body: r.body,
      when: timeAgo(r.createdAt),
      replies: data.comments.filter((c) => c.parentId === r.id).map((c) => ({ author: c.author, body: c.body, when: timeAgo(c.createdAt), replies: [] })),
    })),
  }));
}
type Panel = "block" | "comments" | "versions" | "insights" | "details" | "agent" | null;

export function Viewer({
  id,
  tick,
  lastEvent,
  me,
  onFullPreview,
  onWorkspace,
}: {
  id: string;
  tick: number;
  lastEvent: ChangeEvent | null;
  me: string;
  onFullPreview: (full: boolean) => void;
  onWorkspace: (id: string) => void;
}) {
  const [data, setData] = useState<PrototypeData | null>(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<SelectedBlock | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>(FILL);
  const [rotated, setRotated] = useState(false);
  const [custom, setCustom] = useState({ width: 1024, height: 768 });
  const [full, setFull] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const previewRef = useRef<{ blockId: string; content: string } | null>(null);
  const [ready, setReady] = useState(0);

  const reload = useCallback(async () => {
    try {
      const d = await api.prototype(id);
      setData(d);
      setError("");
      onWorkspace(d.prototype.workspaceId);
      api.people(d.prototype.workspaceId).then(setPeople).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id, onWorkspace]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Changes made by agents or by the other person sharing the folder.
  useEffect(() => {
    if (!lastEvent || tick === 0) return;
    if (lastEvent.prototypeId && lastEvent.prototypeId !== id) return;
    void reload();
    if (["versions", "blocks", "disk"].includes(lastEvent.type)) setFrameKey((k) => k + 1);
  }, [tick, lastEvent, id, reload]);

  useEffect(() => {
    setPanel(null);
    setSelected(null);
    setPreviewVersionId(null);
    setFrameKey((k) => k + 1);
  }, [id]);

  const post = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ rehearsal: true, ...msg }, "*");
  }, []);

  // Messages from the helper inside the prototype.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || !msg.rehearsal || e.source !== frame.current?.contentWindow) return;
      if (msg.type === "ready") setReady((r) => r + 1);
      if (msg.type === "hover") setHover(msg.block?.label ?? null);
      if (msg.type === "select") {
        if (msg.block) {
          setSelected(msg.block);
          setPanel((p) => (p === "agent" ? p : "block"));
        } else {
          setSelected(null);
          setPanel((p) => (p === "block" ? null : p));
        }
      }
      if (msg.type === "pin") {
        const b = data?.blockMap.find((x) => x.id === msg.blockId);
        if (b) {
          setSelected({ id: b.id, tag: b.tag, label: b.label, html: "" });
          setFocusBlockId(b.id);
          setPanel("comments");
          post({ type: "select", blockId: b.id });
        }
      }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [data, post]);

  // Whenever the frame starts afresh, tell it the mode, the pins, the
  // selection and any alternative being previewed.
  useEffect(() => {
    if (!ready) return;
    post({ type: "mode", mode: full ? "live" : "select" });
    if (data) post({ type: "pins", pins: full ? [] : pinsFor(data) });
    if (selected && !full) post({ type: "select", blockId: selected.id });
    if (previewRef.current) post({ type: "preview", ...previewRef.current });
  }, [ready, data, full, selected, post]);

  useEffect(() => {
    onFullPreview(full);
    post({ type: "mode", mode: full ? "live" : "select" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (full) setFull(false);
        else if (selected) selectBlock(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, selected]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const update = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, data !== null]);

  const selectBlock = useCallback(
    (blockId: string | null, scroll = true) => {
      if (!blockId) {
        setSelected(null);
        setPanel((p) => (p === "block" ? null : p));
        post({ type: "select", blockId: null });
        return;
      }
      const b = data?.blockMap.find((x) => x.id === blockId);
      if (!b) return;
      setSelected({ id: b.id, tag: b.tag, label: b.label, html: "" });
      setPanel("block");
      post({ type: "select", blockId, scroll });
    },
    [data, post],
  );

  const preview = useCallback(
    (blockId: string, content: string | null) => {
      if (content === null) {
        previewRef.current = null;
        post({ type: "restore", blockId });
      } else {
        previewRef.current = { blockId, content };
        post({ type: "preview", blockId, content });
      }
    },
    [post],
  );

  const togglePanel = (p: Panel) => {
    setFocusBlockId(null);
    if (panel === p) {
      setPanel(null);
      if (p === "block") selectBlock(null);
    } else setPanel(p);
  };

  if (error) {
    return (
      <div className="page">
        <div className="empty">
          <h2>Can't open this prototype</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { prototype } = data;
  const isFill = viewport.width === null && viewport.name !== "Custom";
  const w = viewport.name === "Custom" ? custom.width : viewport.width ?? 0;
  const h = viewport.name === "Custom" ? custom.height : viewport.height ?? 0;
  const frameW = rotated ? h : w;
  const frameH = rotated ? w : h;
  const pad = full ? 0 : 48;
  const scale = isFill ? 1 : Math.max(0.2, Math.min(1, (stageSize.width - pad) / frameW, (stageSize.height - pad) / frameH));
  const src = `/p/${prototype.id}/${previewVersionId ? `?v=${previewVersionId}` : ""}`;
  const openComments = data.comments.filter((c) => !c.resolvedAt && !c.parentId).length;

  const panelProps: PanelProps = {
    data,
    me,
    people,
    reload,
    selected,
    selectBlock,
    preview,
    highlight: (blockId) => post({ type: "highlight", blockId }),
    focusBlockId,
    previewVersionId,
    previewVersion: (v) => {
      setPreviewVersionId(v);
      setFrameKey((k) => k + 1);
    },
    onClose: () => togglePanel(panel),
  };

  return (
    <div className="viewer">
      {!full && (
        <div className="toolbar">
          <span className="title truncate">{prototype.title}</span>
          <ModeBadge mode={prototype.mode} />
          <span className="grow" />
          <Menu
            trigger={() => (
              <button className="btn small">
                {viewport.name === "Custom" ? `${custom.width} × ${custom.height}` : viewport.width ? `${viewport.name} · ${frameW} × ${frameH}` : viewport.name}
                <Icon name="chevron-down" size={12} />
              </button>
            )}
            align="right"
          >
            {(close) => (
              <>
                {VIEWPORTS.map((g) => (
                  <div key={g.label}>
                    <div className="menu-label">{g.label}</div>
                    {g.items.map((v) => (
                      <button
                        key={v.name}
                        className={`menu-item ${viewport.name === v.name ? "on" : ""}`}
                        onClick={() => {
                          setViewport(v);
                          close();
                        }}
                      >
                        <span>{v.name}</span>
                        <span className="muted">{v.width ? `${v.width} × ${v.height}` : ""}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="menu-label">Custom</div>
                <div className="row" style={{ padding: "4px 10px 8px" }}>
                  <input
                    className="input"
                    type="number"
                    min={200}
                    value={custom.width}
                    onChange={(e) => {
                      setCustom({ ...custom, width: Number(e.target.value) });
                      setViewport({ name: "Custom", width: null, height: null });
                    }}
                  />
                  <span className="muted">×</span>
                  <input
                    className="input"
                    type="number"
                    min={200}
                    value={custom.height}
                    onChange={(e) => {
                      setCustom({ ...custom, height: Number(e.target.value) });
                      setViewport({ name: "Custom", width: null, height: null });
                    }}
                  />
                </div>
              </>
            )}
          </Menu>
          <button className="icon-btn" title="Rotate" disabled={isFill} onClick={() => setRotated((r) => !r)}>
            <Icon name="rotate" />
          </button>
          <button className="icon-btn" title="Full preview (Esc to leave)" onClick={() => setFull(true)}>
            <Icon name="expand" />
          </button>
          <span className="sep" />
          <button className={`btn small quiet ${panel === "comments" ? "on" : ""}`} onClick={() => togglePanel("comments")}>
            <Icon name="comment" size={14} />
            Comments{openComments ? ` ${openComments}` : ""}
          </button>
          <button className={`btn small quiet ${panel === "versions" ? "on" : ""}`} onClick={() => togglePanel("versions")}>
            <Icon name="versions" size={14} />
            Versions
          </button>
          <button className={`btn small quiet ${panel === "insights" ? "on" : ""}`} onClick={() => togglePanel("insights")}>
            <Icon name="insights" size={14} />
            Insights
          </button>
          <button className={`icon-btn ${panel === "details" ? "on" : ""}`} title="Details" onClick={() => togglePanel("details")}>
            <Icon name="info" />
          </button>
          <span className="sep" />
          <button className={`btn small ${panel === "agent" ? "primary" : ""}`} onClick={() => togglePanel("agent")}>
            <Icon name="spark" size={14} />
            Claude
          </button>
        </div>
      )}

      <div className="viewer-body">
        <div className={`stage ${isFill ? "fill" : ""}`} ref={stage}>
          <div className="frame-wrap" style={isFill ? undefined : { width: frameW * scale, height: frameH * scale }}>
            <iframe
              key={frameKey}
              ref={frame}
              src={src}
              title={prototype.title}
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
              style={isFill ? { width: "100%", height: "100%" } : { width: frameW, height: frameH, transform: `scale(${scale})` }}
            />
          </div>
          {!full && !isFill && (
            <span className="stage-label">
              {frameW} × {frameH}
              {scale < 1 ? ` at ${Math.round(scale * 100)}%` : ""}
            </span>
          )}
          {!full && hover && !selected && <span className="hover-label truncate">{hover}</span>}
          {!full && previewVersionId && (
            <span className="hover-label">
              Viewing an older version ·{" "}
              <button className="link" style={{ color: "#fff" }} onClick={() => panelProps.previewVersion(null)}>
                back to current
              </button>
            </span>
          )}
        </div>

        {!full && panel === "block" && selected && <BlockPanel key={selected.id} {...panelProps} />}
        {!full && panel === "comments" && <CommentsPanel {...panelProps} />}
        {!full && panel === "versions" && <VersionsPanel {...panelProps} />}
        {!full && panel === "insights" && <InsightsPanel {...panelProps} />}
        {!full && panel === "details" && <DetailsPanel {...panelProps} />}
        {!full && panel === "agent" && <AgentPanel data={data} me={me} selected={selected} onClose={() => togglePanel("agent")} />}
      </div>

      {full && (
        <button className="btn exit-preview" onClick={() => setFull(false)}>
          Exit preview <kbd>esc</kbd>
        </button>
      )}
    </div>
  );
}
