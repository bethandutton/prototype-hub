# Rehearsal marketing site

One long scrolling page for Rehearsal, the Mac app for designers who keep, review and evolve AI-built HTML prototypes.

Plain HTML, CSS and a little JavaScript. There is no build step: open `index.html` in a browser, or serve the folder as static files.

- `index.html`: the page, nine sections from the hero to the download call to action.
- `styles.css`: the styles. White page, black text, three greys, system sans-serif, stage grey behind product imagery.
- `script.js`: the viewport toggle on the open prototype and the headline version picker. Nothing moves unless you scroll or click.

The product imagery is drawn in CSS, not screenshots, so it can be changed by editing the markup. The Download link points at `#download` until there is a build to link to.
