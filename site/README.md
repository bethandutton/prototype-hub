# Rehearsal marketing site

One long scrolling page for Rehearsal, the Mac app for designers who keep, review and evolve AI-built HTML prototypes.

Plain HTML, CSS and a little JavaScript. There is no build step: open `index.html` in a browser, or serve the folder as static files. The Geist font loads from Google Fonts and falls back to the system sans-serif.

- `index.html`: the page. A floating pill navigation, a centred hero, then one two-column row per message (copy left, product card right), pricing, the download call to action and a tall illustrated footer.
- `styles.css`: the styles. White page, near-black text, mid grey for secondary copy, one warm orange dot used sparingly, product cards with hairline borders and a soft shadow on pastel gradient bands.
- `script.js`: the viewport toggle on the open prototype and the headline version picker. Nothing moves unless you scroll or click.

The product imagery is drawn in CSS, not screenshots, so it can be changed by editing the markup. The footer scene is an inline SVG. Links with no destination yet (Download, Read more, Get in touch, Email, LinkedIn, Terms, Privacy) point at anchors on the page until there is somewhere to send them.
