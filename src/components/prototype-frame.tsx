"use client";

import { useEffect, useState } from "react";

const widths = [
  { label: "Desktop", value: null },
  { label: "Tablet", value: 820 },
  { label: "Phone", value: 390 },
] as const;

export function PrototypeFrame({ src }: { src: string }) {
  const [width, setWidth] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "rehearsal:hover") setHovered(e.data.element ?? null);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between px-5 text-xs text-muted">
        <span className="truncate font-mono">{hovered ?? ""}</span>
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
      <div className="flex min-h-0 flex-1 justify-center overflow-auto px-5 pb-5">
        <iframe
          key={src}
          src={src}
          title="Prototype"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          className="h-full bg-white shadow-[0_0_0_1px_var(--hairline)]"
          style={{ width: width ?? "100%", maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
