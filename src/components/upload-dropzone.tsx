"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadVersion } from "@/lib/actions";

type Picked = { file: File; path: string };

// Walks dropped folders so a whole prototype can be dragged in at once.
async function collect(items: DataTransferItemList): Promise<Picked[]> {
  const out: Picked[] = [];
  const entries = Array.from(items)
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => Boolean(e));

  async function walk(entry: FileSystemEntry, prefix: string) {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      if (!file.name.startsWith(".")) out.push({ file, path: prefix + file.name });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const children = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      for (const child of children) await walk(child, prefix + entry.name + "/");
    }
  }

  for (const entry of entries) await walk(entry, "");
  return out;
}

export function UploadDropzone({ projectId, large = false }: { projectId: string; large?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send(picked: Picked[]) {
    setError(null);
    const form = new FormData();
    for (const p of picked) {
      form.append("file", p.file);
      form.append("path", p.path);
    }
    start(async () => {
      const result = await uploadVersion(projectId, form);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          send(await collect(e.dataTransfer.items));
        }}
        className={`flex cursor-pointer items-center justify-center rounded-md border border-dashed text-sm transition-colors ${
          over ? "border-ink bg-white" : "border-faint hover:border-ink"
        } ${large ? "h-32 text-base" : "h-16"}`}
      >
        {pending ? "Saving to GitHub…" : "Drop an HTML file or folder, or click to choose"}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          send(files.map((file) => ({ file, path: file.webkitRelativePath || file.name })));
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm">{error}</p>}
    </div>
  );
}
