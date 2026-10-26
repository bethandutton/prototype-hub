import * as cheerio from "cheerio";
import crypto from "node:crypto";

// Every meaningful element carries a stable block id in `data-rh-id`, so a
// block keeps its history even when an agent rewrites the page around it.
export const BLOCK_ATTR = "data-rh-id";

const BLOCK_TAGS = [
  "header",
  "nav",
  "main",
  "section",
  "article",
  "aside",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "blockquote",
  "figure",
  "img",
  "video",
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "ul",
  "ol",
  "li",
  "table",
  "svg",
];

function shortId(): string {
  return crypto.randomBytes(4).toString("hex");
}

export function ensureBlockIds(html: string): { html: string; added: number } {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  let added = 0;
  $(BLOCK_TAGS.join(",")).each((_, el) => {
    const $el = $(el);
    let id = $el.attr(BLOCK_ATTR);
    if (!id || seen.has(id)) {
      id = `b-${shortId()}`;
      $el.attr(BLOCK_ATTR, id);
      added++;
    }
    seen.add(id);
  });
  return { html: $.html(), added };
}

export function labelFor(tag: string, text: string, alt?: string): string {
  const clean = (alt || text || "").replace(/\s+/g, " ").trim();
  const snippet = clean.length > 48 ? clean.slice(0, 47).trimEnd() + "…" : clean;
  return snippet ? `${tag} · ${snippet}` : tag;
}

export function blockMap(html: string): { id: string; tag: string; label: string }[] {
  const $ = cheerio.load(html);
  const out: { id: string; tag: string; label: string }[] = [];
  $(`[${BLOCK_ATTR}]`).each((_, el) => {
    const $el = $(el);
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "div";
    out.push({ id: $el.attr(BLOCK_ATTR)!, tag, label: labelFor(tag, $el.text(), $el.attr("alt") ?? $el.attr("aria-label")) });
  });
  return out;
}

export function getBlock(html: string, id: string): string | null {
  const $ = cheerio.load(html);
  const el = $(`[${BLOCK_ATTR}="${id}"]`).first();
  return el.length ? $.html(el) : null;
}

export function blockInfo(html: string, id: string): { id: string; tag: string; label: string } | null {
  const $ = cheerio.load(html);
  const el = $(`[${BLOCK_ATTR}="${id}"]`).first();
  if (!el.length) return null;
  const tag = (el.get(0) as { tagName?: string }).tagName?.toLowerCase() ?? "div";
  return { id, tag, label: labelFor(tag, el.text(), el.attr("alt") ?? el.attr("aria-label")) };
}

// Replaces one block with new markup, keeping the block id on the new root
// even if the author forgot it.
export function setBlock(html: string, id: string, content: string): string {
  const $ = cheerio.load(html);
  const el = $(`[${BLOCK_ATTR}="${id}"]`).first();
  if (!el.length) throw new Error(`No block with id ${id}`);
  const fragment = cheerio.load(content, null, false);
  const root = fragment.root().children().first();
  if (root.length && !root.attr(BLOCK_ATTR)) root.attr(BLOCK_ATTR, id);
  el.replaceWith(fragment.html());
  return $.html();
}

// Normalises proposed block markup: a single root element carrying the id.
export function normaliseBlock(content: string, id: string): string {
  const fragment = cheerio.load(content.trim(), null, false);
  const roots = fragment.root().children();
  if (roots.length !== 1) throw new Error("A block version must be exactly one element.");
  roots.first().attr(BLOCK_ATTR, id);
  return fragment.html();
}

export function injectHelper(html: string, scriptUrl: string): string {
  const tag = `<script src="${scriptUrl}"></script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`);
  return html + tag;
}

export function textOf(html: string): string {
  return cheerio.load(html, null, false).root().text().replace(/\s+/g, " ").trim();
}
