import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Ids sort by time when listed as file names, so history reads in order
// without a database.
let lastTime = 0;
let sequence = 0;
export function newId(): string {
  const time = Date.now();
  sequence = time === lastTime ? sequence + 1 : 0;
  lastTime = time;
  return `${time.toString(36)}${sequence.toString(36).padStart(2, "0")}-${crypto.randomBytes(3).toString("hex")}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

// Written to a temporary name first so a reader never sees half a file,
// which matters when the folder is synced by Drive.
export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

export function writeText(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

export function exists(file: string): boolean {
  return fs.existsSync(file);
}

export function listJson<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<T>(path.join(dir, f)))
    .filter((x): x is T => x !== null);
}

export function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}
