import type { StorageKind } from "@/db/schema";

// A small mark for where a project's files live. Drawn in the current text
// colour so it sits quietly in a list.
export function SourceIcon({ kind, className = "size-4" }: { kind: StorageKind; className?: string }) {
  if (kind === "github") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-label="GitHub">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    );
  }
  if (kind === "google-drive") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-label="Google Drive">
        <path d="M5.5 1.5h5l4.5 8-2.5 4.5H3.5L1 9.5l4.5-8Zm.6 1.2L2.7 8.7h3.9L10 2.7H6.1Zm5 .4-2.9 5.1h5.6L11.1 3.1ZM3 10l1.7 2.8h7.5l1.5-2.8H3Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.25" aria-label="Rehearsal Cloud">
      <path d="M4.5 12.5a3 3 0 0 1-.4-5.97A4 4 0 0 1 11.9 7a2.75 2.75 0 0 1-.4 5.5h-7Z" strokeLinejoin="round" />
    </svg>
  );
}
