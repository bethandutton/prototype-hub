import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../core/store";
import { blockMap, ensureBlockIds, getBlock, setBlock } from "../core/html";

function fresh() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "rehearsal-home-"));
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "rehearsal-ws-"));
  return { store: new Store(home), ws };
}

const page = `<!doctype html><html><head><title>Landing</title></head><body>
<header><h1>Ship faster</h1><p>Sub</p></header>
<main><section><h2 data-rh-id="keep-me">Kept</h2><button>Go</button></section></main>
</body></html>`;

test("block ids are added once and kept", () => {
  const first = ensureBlockIds(page);
  assert.equal(first.added, 6);
  assert.match(first.html, /data-rh-id="keep-me"/);
  const second = ensureBlockIds(first.html);
  assert.equal(second.added, 0);
  assert.equal(second.html, first.html);
});

test("a block can be read and replaced", () => {
  const { html } = ensureBlockIds(page);
  const h1 = blockMap(html).find((b) => b.tag === "h1")!;
  assert.equal(getBlock(html, h1.id), `<h1 data-rh-id="${h1.id}">Ship faster</h1>`);
  const next = setBlock(html, h1.id, "<h1>Ship sooner</h1>");
  assert.match(next, new RegExp(`<h1 data-rh-id="${h1.id}">Ship sooner</h1>`));
  assert.doesNotMatch(next, /Ship faster/);
});

test("workspace, folder, prototype and the five headlines", () => {
  const { store, ws } = fresh();
  store.setSettings({ name: "Bethan" });
  const space = store.addWorkspace({ name: "Marketing", path: ws });
  assert.ok(fs.existsSync(path.join(ws, "workspace.json")));
  store.createFolder(space.id, "", "Landing pages");
  const proto = store.createPrototype(space.id, { folder: "Landing pages", title: "Spring launch", html: page, author: "Bethan" });
  assert.equal(proto.dir, "Landing pages/spring-launch");
  assert.equal(store.tree(space.id).prototypes.length, 1);
  assert.equal(store.tree(space.id).folders[0].name, "Landing pages");

  const headline = store.blockMap(proto).find((b) => b.tag === "h1")!;
  const people = ["Ana", "Ben", "Cho", "Dee", "Eli"];
  for (const [i, who] of people.entries()) {
    store.proposeBlockVersion(proto.id, {
      blockId: headline.id,
      content: `<h1>Headline ${i + 1}</h1>`,
      rationale: `${who}'s reason`,
      author: who,
      source: "agent",
    });
  }
  const block = store.block(proto, headline.id)!;
  assert.equal(block.versions.length, 6, "five proposals plus the original");
  assert.equal(block.versions[0].author, "Original");
  assert.equal(block.selectedVersionId, block.versions[0].id, "nothing picked yet, so the original is live");

  const pick = block.versions[3];
  store.selectBlockVersion(proto.id, { blockId: headline.id, versionId: pick.id, by: "Bethan" });
  assert.match(store.readHtml(proto), /<h1 data-rh-id="[^"]+">Headline 3<\/h1>/);
  const decisions = store.decisions(proto);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].by, "Bethan");
  assert.equal(decisions[0].rationale, "Cho's reason");

  const c = store.addComment(proto.id, { body: "Too shouty", blockId: headline.id, author: "Dee" });
  const reply = store.addComment(proto.id, { body: "Agreed", parentId: c.id, author: "Ana" });
  assert.equal(store.comments(proto).length, 2);
  assert.equal(reply.parentId, c.id);
  store.resolveComment(proto.id, c.id);
  assert.ok(store.comments(proto)[0].resolvedAt);

  store.assignComment(proto.id, c.id, "Eli");
  assert.equal(store.comments(proto)[0].assignee, "Eli");
  store.assignBlockVersion(proto.id, { blockId: headline.id, versionId: pick.id, assignee: "Ben" });
  assert.equal(store.block(proto, headline.id)!.versions[3].assignee, "Ben");
  assert.deepEqual(store.people(space.id), ["Ana", "Ben", "Bethan", "Cho", "Dee", "Eli"]);

  // Every record is its own file, so a second machine syncing the folder never overwrites one.
  const files = fs.readdirSync(path.join(ws, proto.dir, "history", "blocks", headline.id, "versions"));
  assert.equal(files.length, 6);
});

test("page-level updates keep a snapshot and the block ids", () => {
  const { store, ws } = fresh();
  const space = store.addWorkspace({ name: "W", path: ws });
  const proto = store.createPrototype(space.id, { title: "P", html: page });
  const before = store.blockMap(proto).find((b) => b.tag === "h2")!;
  store.updateHtml(proto.id, { html: store.readHtml(proto).replace("Kept", "Still kept"), message: "Reworded", rationale: "Clearer" });
  const after = store.blockMap(proto).find((b) => b.tag === "h2")!;
  assert.equal(after.id, before.id);
  const versions = store.pageVersions(proto);
  assert.equal(versions.length, 2);
  assert.equal(versions[0].message, "Reworded");
  assert.match(store.pageVersionHtml(proto, versions[1].id)!, /Kept/);
});
