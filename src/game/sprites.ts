import {
  C, VW, VH, WALL, STAIRS, STAIRS_RISK, WATER, LAVA, VARIANTS, POTION_COLORS, idx, inB, weaponTier, armorTier,
  type Game, type Mon, type Item,
} from "./core.ts";
import { TIER_COLORS, type RelicId } from "./relics.ts";
import { classOf } from "./classes.ts";
import { zoneOf } from "./zones.ts";

/* ============================ sprites ============================ */
/* 8x8 pixel art. '.' is transparent; other chars index the sprite's palette. */

type SpriteDef = { pal: Record<string, string>; rows: string[] };

export const SPRITES: Record<string, SpriteDef> = {
  player: {
    pal: { c:"#38445A", d:"#4C5A73", f:"#D9B48A", k:"#12161E", e:"#E9A13B" },
    rows: [
      "..cccc..",
      ".cddddc.",
      ".cffffc.",
      ".cfkkfc.",
      "..dddd..",
      ".cddddc.",
      ".cc..cce",
      ".c....ce",
    ],
  },
  rat: {
    pal: { b:"#7A5138", d:"#5C3B28", k:"#0E1117", t:"#93705C" },
    rows: [
      "........",
      "..d..d..",
      ".dbbbbd.",
      ".bkbbkb.",
      ".bbbbbb.",
      "tbbbbbb.",
      ".b.bb.b.",
      "........",
    ],
  },
  bat: {
    pal: { w:"#5B4A6B", b:"#2E2438", k:"#C04A3B" },
    rows: [
      "........",
      "w......w",
      "ww.bb.ww",
      "wwwbbwww",
      ".wwkkww.",
      "..wbbw..",
      "...bb...",
      "........",
    ],
  },
  goblin: {
    pal: { g:"#5E7A46", d:"#43592F", k:"#0E1117", r:"#8C8478", y:"#D4C36A" },
    rows: [
      "..d..d..",
      ".dggggd.",
      ".gkggkg.",
      ".ggyygg.",
      "..gggg..",
      "rdggggd.",
      "r.g..g..",
      "..d..d..",
    ],
  },
  skeleton: {
    pal: { b:"#D8D2BE", d:"#9A9484", k:"#0E1117" },
    rows: [
      "..bbbb..",
      ".bkbbkb.",
      ".bbddbb.",
      "..dbbd..",
      ".bbbbbb.",
      "db.bb.bd",
      ".b....b.",
      ".d....d.",
    ],
  },
  wraith: {
    pal: { w:"#6E7E96", d:"#3C4759", p:"#BFE3E0" },
    rows: [
      "...dd...",
      "..dwwd..",
      ".dwppwd.",
      ".wwwwww.",
      "d.wwww.d",
      ".wwwwww.",
      "..dwwd..",
      "...dd...",
    ],
  },
  ogre: {
    pal: { o:"#6B6A4A", d:"#4E4D34", k:"#0E1117", m:"#D8D2BE" },
    rows: [
      ".oooooo.",
      "oodoodoo",
      "okoooko.",
      ".oooooo.",
      ".ommmmo.",
      "dooooood",
      ".oo..oo.",
      ".d....d.",
    ],
  },
  warden: {
    pal: { p:"#9A5AA8", d:"#61356E", k:"#F2D06B", m:"#2A1330" },
    rows: [
      "k.k..k.k",
      ".pppppp.",
      ".pkppkp.",
      ".pmmmmp.",
      "dppppppd",
      ".pppppp.",
      ".pp..pp.",
      ".d....d.",
    ],
  },
  tonic: {
    pal: { g:"#8FA3B0", r:"#C04A3B", c:"#6B7A85" },
    rows: [
      "..cccc..",
      "...cc...",
      "...cc...",
      "..gggg..",
      ".grrrrg.",
      ".grrrrg.",
      ".grrrrg.",
      "..gggg..",
    ],
  },
  ember: {
    pal: { p:"#D8CDAE", d:"#A2946F", f:"#E9A13B" },
    rows: [
      ".dddddd.",
      ".pppppp.",
      ".pdffdp.",
      ".pffffp.",
      ".pdffdp.",
      ".pppppp.",
      ".pppppp.",
      ".dddddd.",
    ],
  },
  waystone: {
    pal: { g:"#6FC4C8", d:"#3A7E86", l:"#CFF3F2" },
    rows: [
      "...dd...",
      "..dllg..",
      ".dlgggd.",
      "dlggggdd",
      "dgggggdd",
      ".dggggd.",
      "..dggd..",
      "...dd...",
    ],
  },
  weapon: {
    pal: { s:"#C9CFD6", d:"#7E858F", h:"#7A5138", g:"#D4C36A" },
    rows: [
      "......ss",
      ".....ssd",
      "....ssd.",
      "...ssd..",
      "..ssd...",
      ".gsg....",
      "hgh.....",
      "h.......",
    ],
  },
  armor: {
    pal: { m:"#8A94A3", d:"#5A6373", l:"#C2CAD6" },
    rows: [
      ".mmmmmm.",
      ".mlllmm.",
      ".mllmmm.",
      ".mmmmmm.",
      ".dmmmmd.",
      "..dmmd..",
      "...dd...",
      "........",
    ],
  },
  echoes: {
    pal: { g:"#5E9482", l:"#9FD4BE", d:"#3A5F53" },
    rows: [
      "........",
      "..ggg...",
      ".glllg..",
      ".gdddg..",
      "..ggg.g.",
      "...gglg.",
      "...gddg.",
      "....gg..",
    ],
  },
  stairs: {
    pal: { a:"#4A3524", b:"#2C2016", c:"#6B5540" },
    rows: [
      "cccccccc",
      "baaaaaaa",
      "bbcccccc",
      "bbbaaaaa",
      "bbbbcccc",
      "bbbbbaaa",
      "bbbbbbcc",
      "bbbbbbba",
    ],
  },
  slime: {
    pal: { g:"#6FAF5A", l:"#A6DB8C", d:"#3F6E35", k:"#0E1117" },
    rows: [
      "........",
      "........",
      "...gg...",
      "..glgg..",
      ".gkggkg.",
      ".gggggg.",
      "dggggggd",
      ".dddddd.",
    ],
  },
  archer: {
    pal: { g:"#5E7A46", d:"#43592F", k:"#0E1117", h:"#4A3524", w:"#A87440", s:"#D8D2BE" },
    rows: [
      "..hhh.w.",
      ".hhhhhsw",
      ".gkggksw",
      ".gggggsw",
      "..ddddsw",
      ".dddddsw",
      ".g..g.w.",
      ".d..d...",
    ],
  },
  ghost: {
    pal: { w:"#DCE4EE", d:"#9AA8BA", k:"#12161E" },
    rows: [
      "..wwww..",
      ".wwwwww.",
      ".wkwwkw.",
      ".wwwwww.",
      ".wwkkww.",
      ".wwwwww.",
      ".dwwwwd.",
      ".w.ww.w.",
    ],
  },
  mimic: {
    pal: { b:"#7A5138", d:"#4A3524", g:"#D4C36A", t:"#E6DCC9", r:"#C04A3B", k:"#0E1117" },
    rows: [
      ".dddddd.",
      "dbkbbkbd",
      "dttttttd",
      "dkkrrkkd",
      "dkrrrrkd",
      "dttttttd",
      "dbbgbbbd",
      ".dddddd.",
    ],
  },
  chest: {
    pal: { b:"#7A5138", d:"#4A3524", g:"#D4C36A", k:"#2C2016" },
    rows: [
      "........",
      ".dddddd.",
      "dbbbbbbd",
      "dbbbbbbd",
      "ddddgddd",
      "dbbbgbbd",
      "dbbbbbbd",
      ".dddddd.",
    ],
  },
  key: {
    pal: { g:"#F2D06B", d:"#B08A2E" },
    rows: [
      "........",
      ".gg.....",
      "g..g....",
      "g..ggggd",
      ".gg..g.g",
      ".....d..",
      "........",
      "........",
    ],
  },
  potion: {
    pal: { c:"#8C7A5A", g:"#8FA3B0", r:"#9A5AA8", l:"#E6DCC9" },
    rows: [
      "...cc...",
      "...gg...",
      "...gg...",
      "..grrg..",
      ".grlrrg.",
      ".grrrrg.",
      "..grrg..",
      "...gg...",
    ],
  },
  spikes: {
    pal: { s:"#C9CFD6", d:"#6B7A85" },
    rows: [
      "........",
      "..s...s.",
      ".sds.sds",
      "........",
      "s...s...",
      "ds.sds..",
      "........",
      "........",
    ],
  },
  pit: {
    pal: { k:"#05070A", d:"#2C2016" },
    rows: [
      "........",
      "..dddd..",
      ".dkkkkd.",
      "dkkkkkkd",
      "dkkkkkkd",
      ".dkkkkd.",
      "..dddd..",
      "........",
    ],
  },
  /* ---- zone monsters ---- */
  spider: {
    pal: { b:"#2A2430", d:"#5A4A62", k:"#C04A3B" },
    rows: ["........","d.d..d.d",".d.bb.d.","..bbbb..","dbkbbkbd","..bbbb..",".d.bb.d.","d......d"],
  },
  drowned: {
    pal: { g:"#5E8A7A", d:"#3A5A50", k:"#BFF3F0", c:"#2A3A44", w:"#3F7F96" },
    rows: ["..dddd..",".dggggd.",".gkggkg.",".gggggg.","..cccc..","gccccccg",".cc..cc.","wwwwwwww"],
  },
  imp: {
    pal: { r:"#C04A3B", o:"#E9A13B", y:"#F2D06B", k:"#12161E" },
    rows: ["r......r","rr.oo.rr",".roooor.",".okooko.",".oyyyyo.","..rrrr..",".r.rr.r.","........"],
  },
  eye: {
    pal: { p:"#6A3A8A", w:"#E6DCC9", k:"#12161E", r:"#C04A3B", d:"#3A1E4A" },
    rows: ["..dddd..",".dppppd.","dpwwrwpd","dpwkkwpd","dpwkkwpd","dprwwwpd",".dppppd.","..dddd.."],
  },
  /* ---- heroes (same palette letters as the wanderer so armor and weapons layer the same way) ---- */
  ranger: {
    pal: { c:"#2F4A2C", d:"#4E7A46", f:"#D9B48A", k:"#12161E", w:"#A87440", s:"#D8D2BE" },
    rows: ["..cccc.w",".cddddsw",".cffffsw",".cfkkfsw","..ddddsw",".cddddsw",".cc..ccw",".c....c."],
  },
  mage: {
    pal: { c:"#3A2450", d:"#6A4A9A", f:"#D9B48A", k:"#12161E", h:"#4E3A6E", e:"#E9A13B", y:"#B08A2E" },
    rows: ["...hh...","..hhhh..",".hhhhhh.",".cffffce",".cfkkfcy",".cddddcy",".ddddddy",".dd..ddy"],
  },
  knight: {
    pal: { c:"#5A6370", d:"#8A94A3", f:"#6A737D", k:"#E6DCC9", e:"#C04A3B", g:"#D4C36A" },
    rows: ["..cccc..",".cddddc.",".cffffc.",".cfkkfc.","..dddd..",".cddddee",".cc..ceg",".c....ee"],
  },
  rogue: {
    pal: { c:"#1E2026", d:"#2E323C", f:"#D9B48A", k:"#12161E", r:"#C04A3B", e:"#C9CFD6" },
    rows: ["..cccc..",".cccccc.",".cffffc.",".cfkkfc.","..rrrr..",".cddddc.",".cc..cce",".c....ce"],
  },
  /* ---- relics (tier shown by colored corners) ---- */
  fang: {
    pal: { w:"#E6DCC9", r:"#C04A3B", d:"#9A9484" },
    rows: ["........","..wwww..","..wwwd..","...wwd..","...ww...","...wr...","....r...","........"],
  },
  reach: {
    pal: { g:"#A3ACB6", d:"#6A737D", y:"#D4C36A" },
    rows: ["..g.g.g.","..g.g.g.","..ggggg.",".dggggg.",".dgggg..","..yyy...","..ddd...","........"],
  },
  magma: {
    pal: { r:"#C04A3B", o:"#E9A13B", y:"#F2D06B" },
    rows: ["........",".rr..rr.","roorroor","rooyyoor",".rooyor.","..roor..","...rr...","........"],
  },
  thorns: {
    pal: { s:"#C9CFD6", b:"#7A5138", d:"#4A3524" },
    rows: ["..s..s..",".s.ss.s.","bbbbbbbb","bdbbdbbd","bbbbbbbb",".s.ss.s.","..s..s..","........"],
  },
  coin: {
    pal: { y:"#F2D06B", d:"#B08A2E", l:"#FFF4C2" },
    rows: ["..yyyy..",".yllyyy.","ylyyyydy","yyydyydy","yyydyydy","yyyyyddy",".yddddy.","..yyyy.."],
  },
  feather: {
    pal: { w:"#E6DCC9", d:"#9A9484", b:"#6FC4C8" },
    rows: ["......w.",".....ww.","....wbw.","...wbww.","..wbww..",".wwww...",".d......","d......."],
  },
  kindling: {
    pal: { b:"#8B5A2B", d:"#5E3B1C", f:"#E9A13B", y:"#F2D06B" },
    rows: ["...f....","..fyf...","..dbbd..",".bbbbbb.","bbbbbbbb","bdbbbbdb",".bbbbbb.","........"],
  },
  phoenix: {
    pal: { o:"#E9A13B", r:"#C04A3B", y:"#F2D06B", d:"#8C4A1A" },
    rows: ["......o.",".....oy.","....ory.","...oryo.","..orro..",".orro...",".d......","d......."],
  },
  lantern: {
    pal: { d:"#4A3524", y:"#E9A13B", l:"#FFF4C2" },
    rows: ["...dd...","..d..d..",".dddddd.",".dyyyyd.",".dylyyd.",".dyyyyd.",".dddddd.","........"],
  },
  twin: {
    pal: { s:"#C9CFD6", l:"#E8ECF0", h:"#7A5138" },
    rows: ["l......l",".s....s.","..s..s..","...ss...","...ss...","..h..h..",".h....h.","........"],
  },
  grave: {
    pal: { s:"#7C8794", d:"#4A5260", k:"#2A3038" },
    rows: ["........","..ssss..",".ssksss.",".skkkss.",".ssksss.",".ssssss.","dddddddd","........"],
  },
  alarm: {
    pal: { g:"#D4C36A", d:"#8C7A3A", k:"#3B2A1B" },
    rows: [
      "...dd...",
      "..gggg..",
      "..gggg..",
      ".gggggg.",
      ".gggggg.",
      "dddddddd",
      "...kk...",
      "........",
    ],
  },
};

/* ============================ layered looks ============================ */
/* A look is a base sprite plus palette swaps (armor colors, monster skins) and
   extra pixels painted on top (a weapon in hand, armor on the torso). */

type Px = [number, number, string];
const cache = new Map<string, HTMLCanvasElement>();

function compose(key: string, base: string, pal: Record<string, string> = {}, px: Px[] = []): HTMLCanvasElement | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const def = SPRITES[base];
  if (!def) return null;
  const cv = document.createElement("canvas");
  cv.width = 8; cv.height = 8;
  const cx = cv.getContext("2d")!;
  for (let y = 0; y < 8; y++) {
    const row = def.rows[y] || "........";
    for (let x = 0; x < 8; x++) {
      const ch = row[x];
      if (!ch || ch === ".") continue;
      const c = pal[ch] ?? def.pal[ch];
      if (!c) continue;
      cx.fillStyle = c;
      cx.fillRect(x, y, 1, 1);
    }
  }
  for (const [x, y, c] of px) { cx.fillStyle = c; cx.fillRect(x, y, 1, 1); }
  cache.set(key, cv);
  return cv;
}

export function spriteCanvas(name: string) { return compose(name, name); }

/* Weapons held in the left hand (column 0), one look per tier in WEAPONS. */
const column = (x: number, y0: number, y1: number, c: string): Px[] =>
  Array.from({ length: y1 - y0 + 1 }, (_, i) => [x, y0 + i, c] as Px);
const WEAPON_PX: Px[][] = [
  // rusted knife
  [...column(0, 4, 5, "#9C8068"), [0, 6, "#5C3B28"]],
  // iron sword
  [[0, 1, "#E8ECF0"], ...column(0, 2, 4, "#C9CFD6"), [0, 5, "#8C8478"], [1, 5, "#8C8478"], [0, 6, "#5C3B28"]],
  // hooked spear
  [[0, 0, "#E8ECF0"], [1, 1, "#C9CFD6"], ...column(0, 1, 7, "#8B5A2B")],
  // runed blade
  [[0, 0, "#CFF8F6"], [0, 1, "#6FC4C8"], [0, 2, "#A6EAE6"], [0, 3, "#6FC4C8"], [0, 4, "#A6EAE6"],
   [0, 5, "#D4C36A"], [1, 5, "#D4C36A"], [0, 6, "#3A2A20"]],
  // kingsbane
  [[0, 0, "#FFF4C2"], ...column(0, 1, 4, "#F2D06B"), [0, 5, "#C04A3B"], [1, 5, "#C04A3B"], [0, 6, "#5C3B28"]],
  // the long quiet
  [[0, 0, "#FFFFFF"], ...column(0, 1, 4, "#CFC8F0"), [1, 1, "#9A5AA8"], [1, 3, "#9A5AA8"],
   [0, 5, "#9A5AA8"], [1, 5, "#9A5AA8"], [0, 6, "#12161E"]],
];
/* the same weapons lying on the floor */
const WEAPON_ITEM_PAL: Record<string, string>[] = [
  { s:"#9C8068", d:"#6E5A48", g:"#8C8478" },
  { s:"#C9CFD6", d:"#7E858F", g:"#D4C36A" },
  { s:"#AEB5BE", d:"#8B5A2B", g:"#8B5A2B" },
  { s:"#A6EAE6", d:"#3A7E86", g:"#D4C36A" },
  { s:"#F2D06B", d:"#B08A2E", g:"#C04A3B" },
  { s:"#CFC8F0", d:"#6E5A9A", g:"#9A5AA8" },
];

/* main / dark / light colors per tier in ARMORS */
const ARMOR_COLORS = [
  { main:"#6E5E4A", dark:"#4A3F33", light:"#8A7860" }, // padded rags
  { main:"#8B5A2B", dark:"#5E3B1C", light:"#A87440" }, // boiled leather
  { main:"#A3ACB6", dark:"#6A737D", light:"#D6DCE2" }, // chain shirt
  { main:"#7E62A6", dark:"#4E3A6E", light:"#F2D06B" }, // warden plate
  { main:"#56616E", dark:"#2E363F", light:"#6FC4C8" }, // grave-iron
];

/* the torso pixels armor covers on monsters that can wear it */
const TORSO: Record<string, [number, number][]> = {
  goblin:   [[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5],[5,5]],
  archer:   [[2,4],[3,4],[4,4],[5,4],[1,5],[2,5],[3,5],[4,5],[5,5]],
  skeleton: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[3,5],[4,5]],
  ogre:     [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5]],
};

export function playerSprite(g: Pick<Game, "weapon" | "armor"> & { start?: { cls?: string } }) {
  const base = classOf(g.start?.cls).sprite;
  const wt = g.weapon ? weaponTier(g.weapon.name) : -1;
  const at = g.armor ? armorTier(g.armor.name) : -1;
  let pal: Record<string, string> = {};
  if (at >= 0) {
    const a = ARMOR_COLORS[at];
    pal = { d: a.main, c: a.dark };
    // the heavy armors come with a full helm and glowing eye slits
    if (at >= 3) { pal.f = a.main; pal.k = a.light; }
  }
  return compose(`${base}|${wt}|${at}`, base, pal, wt >= 0 ? WEAPON_PX[wt] : []);
}

/* friends' ghosts: the hero in spectral teal, still showing their gear */
export function ghostSprite(cls: string, wt: number, at: number) {
  const base = classOf(cls).sprite;
  return compose(`ghost|${base}|${wt}|${at}`, base,
    { c:"#3F7F86", d:"#6FC4C8", f:"#CFF3F2", k:"#12161E", e:"#BFF3F0", h:"#3F7F86", r:"#6FC4C8", w:"#BFF3F0", s:"#BFF3F0", y:"#BFF3F0", g:"#BFF3F0" },
    wt >= 0 ? WEAPON_PX[wt].map(([x, y]) => [x, y, "#BFF3F0"] as Px) : []);
}

export function relicSprite(id: RelicId, tier: number) {
  const c = TIER_COLORS[tier] ?? TIER_COLORS[1];
  return compose(`relic|${id}|${tier}`, id, {}, [[0, 0, c], [7, 0, c], [0, 7, c], [7, 7, c]]);
}

export function monSprite(m: Mon, seeThrough = false) {
  if (m.disguised && !seeThrough) return spriteCanvas("chest");
  const pal = m.variant > 0 ? VARIANTS[m.kind]?.[m.variant - 1]?.pal ?? {} : {};
  const px: Px[] = [];
  if (m.arm >= 0) for (const [x, y] of TORSO[m.kind] ?? []) px.push([x, y, ARMOR_COLORS[m.arm].main]);
  if (m.wpn >= 0) px.push(...WEAPON_PX[m.wpn]);
  return compose(`${m.kind}|${m.variant}|${m.wpn}|${m.arm}`, m.kind, pal, px);
}

export function potionSprite(color: number) {
  return compose(`potion|${color}`, "potion", { r: POTION_COLORS[color]?.hex ?? "#9A5AA8" });
}

export function itemSprite(it: Item) {
  if (it.t === "weapon") {
    const t = weaponTier(it.name);
    return compose(`weapon|${t}`, "weapon", WEAPON_ITEM_PAL[t] ?? {});
  }
  if (it.t === "armor") {
    const a = ARMOR_COLORS[armorTier(it.name)];
    return compose(`armor|${it.name}`, "armor", a ? { m: a.main, l: a.light, d: a.dark } : {});
  }
  if (it.t === "potion") return potionSprite(it.color ?? 0);
  if (it.t === "chest" && it.locked) return compose("chest|locked", "chest", { g: "#C9CFD6", d: "#3A3F48" });
  if (it.t === "relic" && it.relic) return relicSprite(it.relic, it.tier ?? 1);
  return spriteCanvas(it.t);
}

/* ============================ map ============================ */

const hash32 = (n: number) => { let h = (n * 2654435761) % 4294967296; return (h ^ (h >>> 13)) >>> 0; };

const FLASH_COLORS: Record<string, string> = {
  hurt: "rgba(160,30,20,0.55)",
  hit: "rgba(220,80,60,0.5)",
  arrow: "rgba(233,161,59,0.35)",
};

export type GhostMark = { x: number; y: number; cls: string; wt: number; at: number; dead: boolean };

export function drawMap(
  ctx: CanvasRenderingContext2D, g: Game, ts: number, camX: number, camY: number,
  flashes: Record<number, string>, ghosts: GhostMark[] = [],
) {
  const seeMimics = (g.relics.lantern ?? 0) >= 3;
  const zc = zoneOf(g.depth).colors;
  ctx.imageSmoothingEnabled = false;
  const blit = (cv: HTMLCanvasElement | null, px: number, py: number, alpha = 1) => {
    if (!cv) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(cv, 0, 0, 8, 8, Math.round(px), Math.round(py), ts, ts);
    ctx.globalAlpha = 1;
  };

  for (let vy = 0; vy < VH; vy++) {
    for (let vx = 0; vx < VW; vx++) {
      const x = camX + vx, y = camY + vy;
      const px = vx * ts, py = vy * ts;
      const ok = inB(x, y);
      const i = ok ? idx(x, y) : -1;

      if (!ok || !g.seen[i]) { ctx.fillStyle = C.void; ctx.fillRect(px, py, ts, ts); continue; }

      const vis = g.vis.has(i);
      const wall = g.grid[i] === WALL;
      ctx.fillStyle = wall ? (vis ? zc.litWall : zc.memWall) : (vis ? zc.litFloor : zc.memFloor);
      ctx.fillRect(px, py, ts, ts);

      const h = hash32(i);
      if (wall) {
        ctx.fillStyle = vis ? zc.wallTop : zc.memTop;
        ctx.fillRect(px, py, ts, Math.max(1, Math.round(ts * 0.11)));
        if (h % 3 === 0) {
          ctx.fillStyle = vis ? zc.crack : zc.memCrack;
          ctx.fillRect(px + ts * 0.28, py + ts * 0.42, ts * 0.3, ts * 0.11);
        }
      } else if (g.grid[i] === WATER) {
        ctx.fillStyle = vis ? "#1E4A5A" : "#102229";
        ctx.fillRect(px, py, ts, ts);
        if (vis) {
          ctx.fillStyle = "#3F8AA0";
          const t = (h + (g.turns >> 1)) % 4;
          ctx.fillRect(px + ts * (0.15 + t * 0.15), py + ts * 0.35, ts * 0.25, ts * 0.07);
          ctx.fillRect(px + ts * (0.55 - t * 0.1), py + ts * 0.7, ts * 0.2, ts * 0.07);
        }
      } else if (g.grid[i] === LAVA) {
        ctx.fillStyle = vis ? "#C8461E" : "#4A1A10";
        ctx.fillRect(px, py, ts, ts);
        if (vis) {
          ctx.fillStyle = "#F2C46B";
          const t = (h + g.turns * 3) % 5;
          ctx.fillRect(px + ts * (0.15 + t * 0.12), py + ts * 0.25, ts * 0.16, ts * 0.12);
          ctx.fillStyle = "#8C2A12";
          ctx.fillRect(px + ts * (0.6 - t * 0.08), py + ts * 0.65, ts * 0.22, ts * 0.12);
        }
      } else if (h % 6 === 0) {
        ctx.fillStyle = vis ? zc.speck : zc.memSpeck;
        ctx.fillRect(px + ts * 0.3, py + ts * 0.55, ts * 0.22, ts * 0.1);
      }

      if (g.grid[i] === STAIRS) blit(spriteCanvas("stairs"), px, py, vis ? 1 : 0.4);
      if (g.grid[i] === STAIRS_RISK) blit(compose("stairs|risk", "stairs", { a: "#7A2A22", b: "#3A1410", c: "#C04A3B" }), px, py, vis ? 1 : 0.4);

      const lava = g.hazards.find(o => o.x === x && o.y === y);
      if (lava && vis) {
        ctx.fillStyle = "rgba(200,70,30,0.7)";
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = "#F2C46B";
        const t = (h + g.turns * 7) % 5;
        ctx.fillRect(px + ts * (0.15 + t * 0.12), py + ts * 0.3, ts * 0.14, ts * 0.14);
        ctx.fillRect(px + ts * (0.6 - t * 0.08), py + ts * 0.65, ts * 0.12, ts * 0.12);
      }

      const tr = g.traps.find(o => o.found && o.x === x && o.y === y);
      if (tr) blit(spriteCanvas(tr.t), px, py, vis ? 1 : 0.4);

      const it = g.items.find(o => o.x === x && o.y === y);
      if (it) blit(itemSprite(it), px, py, vis ? 1 : 0.35);

      const m = g.mons.find(o => o.x === x && o.y === y);
      if (m && m.disguised) blit(monSprite(m, seeMimics && vis), px, py, vis ? 1 : 0.35); // remembered like a chest
      else if (m && vis) blit(monSprite(m), px, py);

      for (const gh of ghosts) {
        if (gh.x !== x || gh.y !== y) continue;
        if (gh.dead) blit(spriteCanvas("grave"), px, py, vis ? 0.9 : 0.4);
        else blit(ghostSprite(gh.cls, gh.wt, gh.at), px, py, 0.45);
      }

      if (x === g.p.x && y === g.p.y) blit(playerSprite(g), px, py, g.hidden > 0 ? 0.45 : 1);

      const fl = flashes[i];
      if (fl) {
        ctx.fillStyle = FLASH_COLORS[fl] ?? FLASH_COLORS.hit;
        ctx.fillRect(px, py, ts, ts);
      }
    }
  }
}
