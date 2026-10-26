import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Mode } from "./api";

const ICONS: Record<string, ReactNode> = {
  "chevron-down": <path d="M4 6l4 4 4-4" />,
  "chevron-left": <path d="M10 3L5 8l5 5" />,
  "chevron-right": <path d="M6 3l5 5-5 5" />,
  plus: <path d="M8 3v10M3 8h10" />,
  folder: <path d="M2 4.5A1.5 1.5 0 013.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" />,
  comment: <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2v-7z" />,
  versions: <path d="M3 5.5l5-2.5 5 2.5-5 2.5-5-2.5zM3 8.5l5 2.5 5-2.5M3 11l5 2.5 5-2.5" />,
  insights: <path d="M2.5 12.5l3.5-4 3 2.5 4.5-6" />,
  info: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7v4M8 5.2v.3" />
    </>
  ),
  expand: <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" />,
  rotate: <path d="M3.5 8a4.5 4.5 0 017.9-2.9M12.5 8a4.5 4.5 0 01-7.9 2.9M11.5 2.5v3h-3M4.5 13.5v-3h3" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  check: <path d="M3 8.5l3 3 7-7" />,
  copy: <path d="M5 5V3.5A1.5 1.5 0 016.5 2h6A1.5 1.5 0 0114 3.5v6a1.5 1.5 0 01-1.5 1.5H11M3.5 5h6A1.5 1.5 0 0111 6.5v6A1.5 1.5 0 019.5 14h-6A1.5 1.5 0 012 12.5v-6A1.5 1.5 0 013.5 5z" />,
  external: <path d="M9 3h4v4M13 3L7 9M11 9.5v3a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-7a.5.5 0 01.5-.5h3" />,
  dots: (
    <>
      <circle cx="3.5" cy="8" r="1" />
      <circle cx="8" cy="8" r="1" />
      <circle cx="12.5" cy="8" r="1" />
    </>
  ),
  file: <path d="M4 2h5l3 3v9H4V2zM9 2v3h3" />,
};

export function Icon({ name, size = 16 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function ModeBadge({ mode }: { mode: Mode }) {
  return (
    <span className={`badge ${mode}`}>
      <span className="dot" />
      {mode === "production" ? "Production-ready" : "Wireframe"}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Menu({
  trigger,
  children,
  align = "left",
  up = false,
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && <div className={`menu ${align === "right" ? "right" : ""} ${up ? "up" : ""}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="icon-btn copy"
      title="Copy"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      <Icon name={done ? "check" : "copy"} />
    </button>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <div className="code">
      {children}
      <CopyButton text={children} />
    </div>
  );
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}
