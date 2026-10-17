import { courseScenery, type Scenery } from "./course-info";

/**
 * Illustrated golf landscapes, served as cacheable SVG images from /art/.
 * Pictures loaded with <img> can't see the page's CSS, so their palette is
 * kept here (light and dark), like the colours in any other image file.
 */
const PALETTE = `
:root{--sky-top:#9fd3f2;--sky-bottom:#e8f5fb;--sun:#fff1b8;--hill-far:#9cc7a4;--hill-mid:#5fa46d;--fairway:#3f8f52;--fairway-light:#57a967;--green:#7cc489;--tree:#2b6b3c;--trunk:#6b4f3a;--water:#4fa3c7;--sand:#ead9a8;--earth:#c8693f;--flag:#f2c14e;--pole:#fff}
.dawn{--sky-top:#f6b98c;--sky-bottom:#fde8cf;--sun:#fff4d6}
.noon{--sky-top:#6fb9e8;--sky-bottom:#d9f0fa}
.dusk{--sky-top:#7f8fc8;--sky-bottom:#f7c6a3;--sun:#ffe0a8}
@media (prefers-color-scheme:dark){:root,.dawn,.noon,.dusk{--sky-top:#1d3b55;--sky-bottom:#3d5f6e;--sun:#f3dc9a;--hill-far:#36574a;--hill-mid:#2d5a3c;--fairway:#234b31;--fairway-light:#2c5c3c;--green:#3c7a4c;--tree:#173823;--trunk:#4a3729;--water:#2f6a86;--sand:#9c8d66;--earth:#8d4a2c}}
`.trim();

/** Bump to make browsers fetch redrawn pictures. */
export const ART_VERSION = 1;

export function courseArtUrl(slug: string, wide = false): string {
  return `/art/${slug}${wide ? "-wide" : ""}.svg?v=${ART_VERSION}`;
}

/** A small seeded random generator, so each course always gets the same picture. */
function seeded(text: string) {
  let a = 2166136261;
  for (let i = 0; i < text.length; i++) a = Math.imul(a ^ text.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const H = 225;
const n = (x: number) => Math.round(x * 10) / 10;

/** A rolling ridge from left to right, filled to the bottom. */
function ridge(random: () => number, W: number, baseY: number, wobble: number, points: number) {
  const step = W / (points - 1);
  let d = `M0 ${n(baseY + (random() - 0.5) * wobble)}`;
  for (let i = 1; i < points; i++) {
    const x = i * step;
    const y = baseY + (random() - 0.5) * wobble;
    d += ` S${n(x - step / 2)} ${n(y + (random() - 0.5) * wobble)} ${n(x)} ${n(y)}`;
  }
  return `${d} L${W} ${H} L0 ${H} Z`;
}

function tree(x: number, y: number, size: number, kind: "pine" | "gum"): string {
  if (kind === "pine") {
    return (
      `<rect x="${n(x - size * 0.06)}" y="${n(y - size * 0.25)}" width="${n(size * 0.12)}" height="${n(size * 0.3)}" fill="var(--trunk)"/>` +
      `<path d="M${n(x)} ${n(y - size * 1.25)} L${n(x + size * 0.4)} ${n(y - size * 0.2)} L${n(x - size * 0.4)} ${n(y - size * 0.2)} Z" fill="var(--tree)"/>`
    );
  }
  return (
    `<rect x="${n(x - size * 0.05)}" y="${n(y - size * 0.55)}" width="${n(size * 0.1)}" height="${n(size * 0.6)}" fill="var(--trunk)"/>` +
    `<ellipse cx="${n(x - size * 0.18)}" cy="${n(y - size * 0.75)}" rx="${n(size * 0.32)}" ry="${n(size * 0.24)}" fill="var(--tree)"/>` +
    `<ellipse cx="${n(x + size * 0.18)}" cy="${n(y - size * 0.82)}" rx="${n(size * 0.3)}" ry="${n(size * 0.26)}" fill="var(--tree)"/>` +
    `<ellipse cx="${n(x)}" cy="${n(y - size)}" rx="${n(size * 0.28)}" ry="${n(size * 0.22)}" fill="var(--tree)"/>`
  );
}

/**
 * An illustrated landscape in the feel of the course's area (coast, river,
 * bush, red earth). Clearly a drawing, never passed off as a photo. Clubs
 * can supply real photos through onboarding.
 */
export function courseArtSvg(
  slug: string,
  options: { wide?: boolean; scenery?: Scenery } = {},
): string {
  const scenery = options.scenery ?? courseScenery(slug);
  const W = options.wide ? 1200 : 400;
  const wide = Boolean(options.wide);
  const random = seeded(slug);
  const time = ["dawn", "noon", "", "dusk"][Math.floor(random() * 4)];
  const sunX = 60 + random() * (W - 120);
  const sunY = 35 + random() * 30;
  const coast = scenery === "coast" || scenery === "red-coast";
  const red = scenery === "red-earth" || scenery === "red-coast";
  const horizon = 112 + random() * 14;
  const treeKind = scenery === "bush" || red ? "gum" : random() > 0.5 ? "pine" : "gum";
  const treeCount = (scenery === "coast" ? 3 : 4 + Math.floor(random() * 5)) * (wide ? 3 : 1);
  const trees = Array.from({ length: treeCount }, () => ({
    x: random() * W,
    size: 26 + random() * 22,
  }));
  const greenX = W * 0.3 + random() * W * 0.4;
  const greenY = 178 + random() * 12;
  const bunkerX = greenX + (random() > 0.5 ? 70 : -80);

  const parts = [
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-bottom)"/></linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>`,
    `<circle cx="${n(sunX)}" cy="${n(sunY)}" r="18" fill="var(--sun)"/>`,
    coast ? `<rect y="${n(horizon - 6)}" width="${W}" height="40" fill="var(--water)"/>` : "",
    coast
      ? ""
      : `<path d="${ridge(random, W, horizon - 8, 26, wide ? 9 : 5)}" fill="var(${red ? "--earth" : "--hill-far"})"/>`,
    `<path d="${ridge(random, W, horizon + 18, 22, wide ? 9 : 5)}" fill="var(${red ? "--earth" : "--hill-mid"})"${red ? ' opacity=".85"' : ""}/>`,
    ...trees.map((t) => tree(t.x, horizon + 26, t.size, treeKind)),
  ];
  if (scenery === "river" || scenery === "lakes") {
    const river = scenery === "river";
    parts.push(
      `<ellipse cx="${n(river ? W / 2 : 60 + random() * (W - 120))}" cy="${n(horizon + 40)}" rx="${n(river ? W * 0.75 : 70 + random() * 40)}" ry="${river ? 12 : 14}" fill="var(--water)"/>`,
    );
  }
  parts.push(
    `<path d="${ridge(random, W, 160, 18, wide ? 8 : 4)}" fill="var(--fairway)"/>`,
    `<path d="${ridge(random, W, 182, 14, wide ? 8 : 4)}" fill="var(--fairway-light)" opacity=".7"/>`,
    `<ellipse cx="${n(bunkerX)}" cy="${n(greenY + 10)}" rx="26" ry="7" fill="var(--sand)"/>`,
    `<ellipse cx="${n(greenX)}" cy="${n(greenY)}" rx="48" ry="11" fill="var(--green)"/>`,
    `<path d="M${n(greenX + 6)} ${n(greenY)} V${n(greenY - 52)}" stroke="var(--pole)" stroke-width="2.5" stroke-linecap="round"/>`,
    `<path d="M${n(greenX + 7)} ${n(greenY - 52)} L${n(greenX + 30)} ${n(greenY - 45)} L${n(greenX + 7)} ${n(greenY - 38)} Z" fill="var(--flag)"/>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"${time ? ` class="${time}"` : ""}><style>${PALETTE}</style>${parts.join("")}</svg>`;
}
