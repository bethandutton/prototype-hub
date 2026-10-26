import path from "node:path";
import { Store } from "../core/store";

// Seeds the five-headline demo: a landing page in a Marketing workspace,
// with five people's headline proposals, each with a one-line reason.
// Safe to run again; it only adds what is missing.

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ledger · Spring launch</title>
  <style>
    :root { --ink: #171717; --muted: #767676; --hair: #e6e6e2; --accent: #f54900; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.5 -apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif; color: var(--ink); background: #fff; letter-spacing: -0.01em; }
    header { display: flex; align-items: center; justify-content: space-between; max-width: 1040px; margin: 0 auto; padding: 24px; }
    .wordmark { font-weight: 600; }
    nav a { color: var(--muted); text-decoration: none; margin-left: 24px; font-size: 14px; }
    .hero { max-width: 760px; margin: 96px auto 64px; padding: 0 24px; text-align: center; }
    h1 { font-size: 52px; line-height: 1.08; letter-spacing: -0.03em; font-weight: 600; margin: 0 0 20px; }
    .lead { font-size: 19px; color: var(--muted); margin: 0 auto 32px; max-width: 560px; }
    .cta { display: inline-block; padding: 12px 22px; border-radius: 999px; background: var(--ink); color: #fff; text-decoration: none; font-weight: 500; }
    .secondary { margin-left: 16px; color: var(--muted); text-decoration: none; }
    .stage { max-width: 1040px; margin: 0 auto; padding: 0 24px 96px; }
    .window { border: 1px solid var(--hair); border-radius: 12px; overflow: hidden; background: linear-gradient(135deg, #e9f1ff, #fff1e6); padding: 40px; }
    .card { background: #fff; border: 1px solid var(--hair); border-radius: 8px; padding: 20px; max-width: 520px; margin: 0 auto; box-shadow: 0 10px 40px rgba(0,0,0,.06); }
    .card h3 { margin: 0 0 12px; font-size: 14px; color: var(--muted); font-weight: 500; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid var(--hair); }
    .row:first-of-type { border-top: 0; }
    .pill { font-size: 12px; color: var(--accent); }
    .features { max-width: 1040px; margin: 0 auto; padding: 0 24px 120px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
    .features h2 { font-size: 20px; margin: 0 0 8px; letter-spacing: -0.02em; }
    .features p { color: var(--muted); margin: 0; }
    footer { border-top: 1px solid var(--hair); color: var(--muted); font-size: 13px; padding: 32px 24px; text-align: center; }
  </style>
</head>
<body>
  <header>
    <div class="wordmark">Ledger</div>
    <nav><a href="#">Product</a><a href="#">Pricing</a><a href="#">Changelog</a></nav>
  </header>
  <section class="hero">
    <h1>Keep every invoice in one quiet place</h1>
    <p class="lead">Ledger collects what you are owed, chases it politely and tells you what is actually in the bank. No spreadsheets, no surprises.</p>
    <a class="cta" href="#">Start free</a>
    <a class="secondary" href="#">See how it works</a>
  </section>
  <section class="stage">
    <div class="window">
      <div class="card">
        <h3>This week</h3>
        <div class="row"><span>Acme Studio</span><span>£2,400 · <span class="pill">due Friday</span></span></div>
        <div class="row"><span>Northwind</span><span>£860 · paid</span></div>
        <div class="row"><span>Halcyon Press</span><span>£3,150 · chased</span></div>
      </div>
    </div>
  </section>
  <section class="features">
    <div><h2>Chases for you</h2><p>A polite nudge on the day, a firmer one a week later. You never write either.</p></div>
    <div><h2>Knows your bank</h2><p>Payments match themselves to invoices, so the number on screen is the real one.</p></div>
    <div><h2>Made for one person</h2><p>No seats, no roles, no admin area. Just your money and where it is.</p></div>
  </section>
  <footer>Ledger · Built in Amsterdam</footer>
</body>
</html>
`;

const headlines = [
  { author: "Ana Ruiz", content: "<h1>Get paid without the awkward emails</h1>", rationale: "Our interviews kept coming back to the chasing. Lead with the pain, not the tidiness." },
  { author: "Ben Okafor", content: "<h1>Invoices, chased. Money, in.</h1>", rationale: "Short enough to read from the back of a conference room. Two beats, like a tagline." },
  { author: "Chloe Martin", content: "<h1>Know what you're owed. Today.</h1>", rationale: "The number is the product. Freelancers open the app to see one figure." },
  { author: "Dev Patel", content: "<h1>The calm way to run a one-person business</h1>", rationale: "Positions against the big tools without naming them. Calm tested well in the brand survey." },
  { author: "Esme Walsh", content: "<h1>Stop doing your own accounts receivable</h1>", rationale: "A jobs-to-be-done framing. It says what you can stop doing, which is the real promise." },
];

const store = new Store();
const demoDir = path.resolve(__dirname, "..", "demo");
const ws = store.addWorkspace({ name: "Marketing", path: demoDir });
if (!store.settings().name) store.setSettings({ name: "Bethan" });

let proto = store.tree(ws.id).prototypes.find((p) => p.title === "Spring launch landing page");
if (!proto) {
  store.createFolder(ws.id, "", "Landing pages");
  proto = store.createPrototype(ws.id, {
    folder: "Landing pages",
    title: "Spring launch landing page",
    description: "The page for the spring launch. The headline is still open.",
    mode: "production",
    html,
    resourceLinks: [
      { label: "Launch brief", url: "https://docs.google.com/document/d/launch-brief" },
      { label: "LLE-1024 Landing page copy", url: "https://linear.app/ledger/issue/LLE-1024" },
      { label: "Interview notes", url: "https://notion.so/ledger/interviews" },
    ],
  });
  console.log(`Created prototype ${proto.id} in ${demoDir}`);
}

const headline = store.blockMap(proto).find((b) => b.tag === "h1");
if (!headline) throw new Error("No h1 in the demo page.");
const existing = store.block(proto, headline.id);
if (!existing || existing.versions.length < 2) {
  for (const h of headlines) store.proposeBlockVersion(proto.id, { blockId: headline.id, ...h, source: "agent" });
  console.log(`Proposed ${headlines.length} headlines on block ${headline.id}`);
}

if (store.comments(proto).length === 0) {
  const lead = store.blockMap(proto).find((b) => b.tag === "p");
  store.addComment(proto.id, { body: "Can we get the five headline options in before Thursday's review?", author: "Bethan" });
  if (lead) {
    const c = store.addComment(proto.id, { body: "\"Politely\" is doing a lot of work here. Do we chase hard at all?", blockId: lead.id, author: "Ben Okafor" });
    store.addComment(proto.id, { body: "Firmer on day 7, see the product doc. I'll make the lead say so.", parentId: c.id, blockId: lead.id, author: "Ana Ruiz" });
  }
  console.log("Added comments");
}

console.log(`Workspace ${ws.name} (${ws.id}) is ready. Open the app and pick the headline.`);
