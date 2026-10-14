// The chrome is monochrome; colour belongs to people. Each person gets one
// of these, chosen from their id so it is the same on every screen.
const palette = ["#2E6BFF", "#E5484D", "#12A594", "#8E4EC6", "#F76B15", "#0091FF", "#D6409F", "#46A758"];

export function colourFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export type Person = { id: string; name: string; colour: string };
