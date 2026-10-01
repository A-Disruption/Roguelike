import { C, VW, VH, WALL, STAIRS, idx, inB, type Game } from "./core";

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
};

const spriteCache = new Map<string, HTMLCanvasElement>();

export function spriteCanvas(name: string): HTMLCanvasElement | null {
  const hit = spriteCache.get(name);
  if (hit) return hit;
  const def = SPRITES[name];
  if (!def) return null;
  const cv = document.createElement("canvas");
  cv.width = 8; cv.height = 8;
  const cx = cv.getContext("2d")!;
  for (let y = 0; y < 8; y++) {
    const row = def.rows[y] || "........";
    for (let x = 0; x < 8; x++) {
      const ch = row[x];
      if (!ch || ch === ".") continue;
      const col = def.pal[ch];
      if (!col) continue;
      cx.fillStyle = col;
      cx.fillRect(x, y, 1, 1);
    }
  }
  spriteCache.set(name, cv);
  return cv;
}

const hash32 = (n: number) => { let h = (n * 2654435761) % 4294967296; return (h ^ (h >>> 13)) >>> 0; };

export function drawMap(
  ctx: CanvasRenderingContext2D, g: Game, ts: number, camX: number, camY: number,
  flashes: Record<number, string>,
) {
  ctx.imageSmoothingEnabled = false;
  const blit = (name: string, px: number, py: number, alpha?: number) => {
    const cv = spriteCanvas(name);
    if (!cv) return;
    if (alpha != null) ctx.globalAlpha = alpha;
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
      ctx.fillStyle = wall ? (vis ? C.litWall : C.memWall) : (vis ? C.litFloor : C.memFloor);
      ctx.fillRect(px, py, ts, ts);

      const h = hash32(i);
      if (wall) {
        ctx.fillStyle = vis ? "#63482F" : "#1D2430";
        ctx.fillRect(px, py, ts, Math.max(1, Math.round(ts * 0.11)));
        if (h % 3 === 0) {
          ctx.fillStyle = vis ? "#3B2A1B" : "#121821";
          ctx.fillRect(px + ts * 0.28, py + ts * 0.42, ts * 0.3, ts * 0.11);
        }
      } else if (h % 6 === 0) {
        ctx.fillStyle = vis ? "#33261A" : "#141922";
        ctx.fillRect(px + ts * 0.3, py + ts * 0.55, ts * 0.22, ts * 0.1);
      }

      if (g.grid[i] === STAIRS) blit("stairs", px, py, vis ? 1 : 0.4);

      const it = g.items.find(o => o.x === x && o.y === y);
      if (it) blit(it.t, px, py, vis ? 1 : 0.35);

      if (vis) {
        const m = g.mons.find(o => o.x === x && o.y === y);
        if (m) blit(m.kind, px, py, 1);
      }

      if (x === g.p.x && y === g.p.y) blit("player", px, py, 1);

      const fl = flashes[i];
      if (fl) {
        ctx.fillStyle = fl === "hurt" ? "rgba(160,30,20,0.55)" : "rgba(220,80,60,0.5)";
        ctx.fillRect(px, py, ts, ts);
      }
    }
  }
}
