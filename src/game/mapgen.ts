import { Rng } from "./rng.ts";
import {
  MW, MH, WALL, FLOOR, STAIRS, STAIRS_RISK, WATER, LAVA, CHASM, idx, inB, center, blocksMove,
  type Pt, type Room,
} from "./tiles.ts";
import { zoneOf, isBossFloor, type Layout } from "./zones.ts";

/* Level generation. Each zone picks from three layout families and decorates
   them its own way:

     rooms    rooms of mixed shapes (rectangles, ovals, crosses), joined by
              narrow or wide corridors, with a few extra loops
     halls    fewer, much bigger rooms full of pillars, rubble, pools or a
              lava river, joined by wide corridors
     caverns  organic caves grown with a cellular automaton, plus open chambers

   Boss floors are always `rooms` with a big arena at the far end.
   Whatever gets carved, `connect` then guarantees every open tile can be
   reached from the start without crossing lava or chasms. */

export type Level = {
  grid: Uint8Array;
  areas: Room[];      // places to put monsters and loot; areas[0] holds the start
  start: Pt;
  stairsArea: number; // index into areas of the room with the normal stairs (the arena on boss floors)
};

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/* ---------------- carving ---------------- */

const interior = (x: number, y: number) => x > 0 && y > 0 && x < MW - 1 && y < MH - 1;
function put(grid: Uint8Array, x: number, y: number, v: number) { if (interior(x, y)) grid[idx(x, y)] = v; }

function carveRect(grid: Uint8Array, rm: Room) {
  for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) put(grid, x, y, FLOOR);
}

function carveOval(grid: Uint8Array, rm: Room) {
  const cx = rm.x + (rm.w - 1) / 2, cy = rm.y + (rm.h - 1) / 2;
  const rx = rm.w / 2, ry = rm.h / 2;
  for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1.05) put(grid, x, y, FLOOR);
  }
}

function carveCross(grid: Uint8Array, rm: Room) {
  const c = center(rm);
  const bw = Math.max(1, Math.floor(rm.w / 3)), bh = Math.max(1, Math.floor(rm.h / 3));
  for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) {
    if (Math.abs(x - c.x) <= bw || Math.abs(y - c.y) <= bh) put(grid, x, y, FLOOR);
  }
}

/* an L-shaped corridor, 1 or 2 tiles wide */
function corridor(grid: Uint8Array, a: Pt, b: Pt, width: number, r: Rng) {
  const horizFirst = r.chance(0.5);
  const lineH = (x0: number, x1: number, y: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let k = 0; k < width; k++) put(grid, x, y + k, FLOOR);
  };
  const lineV = (y0: number, y1: number, x: number) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let k = 0; k < width; k++) put(grid, x + k, y, FLOOR);
  };
  if (horizFirst) { lineH(a.x, b.x, a.y); lineV(a.y, b.y, b.x); }
  else { lineV(a.y, b.y, a.x); lineH(a.x, b.x, b.y); }
}

/* a wandering tunnel that drifts toward its target: cave-like connections */
function tunnel(grid: Uint8Array, a: Pt, b: Pt, r: Rng) {
  let x = a.x, y = a.y;
  for (let steps = 0; steps < 400 && (x !== b.x || y !== b.y); steps++) {
    put(grid, x, y, FLOOR);
    if (r.chance(0.35)) put(grid, x + (r.chance(0.5) ? 1 : -1), y, FLOOR); // occasionally wider
    if (r.chance(0.7)) {
      if (x !== b.x && (y === b.y || r.chance(0.5))) x += Math.sign(b.x - x); else y += Math.sign(b.y - y);
    } else {
      const [dx, dy] = r.pick(DIRS4);
      if (interior(x + dx, y + dy)) { x += dx; y += dy; }
    }
  }
  put(grid, b.x, b.y, FLOOR);
}

/* ---------------- decorations ---------------- */

type Deco = "pillars" | "rubble" | "water" | "lava" | "river" | "chasm" | "none";

/* the middle of a room (where starts and stairs go) stays clear */
const nearCenter = (rm: Room, x: number, y: number) => {
  const c = center(rm);
  return Math.abs(x - c.x) <= 1 && Math.abs(y - c.y) <= 1;
};

function decorate(grid: Uint8Array, rm: Room, deco: Deco, r: Rng) {
  const inside = (x: number, y: number) => x > rm.x && y > rm.y && x < rm.x + rm.w - 1 && y < rm.y + rm.h - 1;
  const set = (x: number, y: number, v: number) => {
    if (!inside(x, y) || nearCenter(rm, x, y) || grid[idx(x, y)] !== FLOOR) return;
    grid[idx(x, y)] = v;
  };
  if (deco === "pillars") {
    // a regular colonnade, spaced so you can always walk between the pillars
    const step = r.chance(0.5) ? 3 : 4;
    const ox = rm.x + 2 + r.int(2), oy = rm.y + 2 + r.int(2);
    for (let y = oy; y < rm.y + rm.h - 2; y += step) for (let x = ox; x < rm.x + rm.w - 2; x += step) set(x, y, WALL);
  } else if (deco === "rubble") {
    const n = Math.floor(rm.w * rm.h * 0.08);
    for (let i = 0; i < n; i++) set(r.range(rm.x + 1, rm.x + rm.w - 2), r.range(rm.y + 1, rm.y + rm.h - 2), WALL);
  } else if (deco === "water" || deco === "lava" || deco === "chasm") {
    const tile = deco === "water" ? WATER : deco === "lava" ? LAVA : CHASM;
    const blobs = rm.w * rm.h > 60 ? 2 : 1;
    for (let b = 0; b < blobs; b++) {
      const cx = r.range(rm.x + 1, rm.x + rm.w - 2), cy = r.range(rm.y + 1, rm.y + rm.h - 2);
      const rx = r.range(1, Math.max(1, Math.floor(rm.w / 4))), ry = r.range(1, Math.max(1, Math.floor(rm.h / 4)));
      for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
        const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) set(x, y, tile);
      }
    }
  } else if (deco === "river") {
    // a lava river winds across the room; a couple of tiles are left as stone bridges
    const vertical = rm.h > rm.w;
    const len = vertical ? rm.h : rm.w;
    let off = vertical ? r.range(rm.x + 2, rm.x + rm.w - 3) : r.range(rm.y + 2, rm.y + rm.h - 3);
    const bridges = new Set([r.int(len), r.int(len)]);
    for (let i = 0; i < len; i++) {
      if (r.chance(0.3)) off += r.chance(0.5) ? 1 : -1;
      if (bridges.has(i)) continue;
      if (vertical) set(off, rm.y + i, LAVA); else set(rm.x + i, off, LAVA);
    }
  }
}

/* what each zone puts in its rooms */
function zoneDeco(depth: number, big: boolean, r: Rng): Deco {
  const f = zoneOf(depth).feature;
  const roll = r.next();
  switch (f) {
    case "none":    return big ? (roll < 0.5 ? "pillars" : "rubble") : roll < 0.15 ? "rubble" : "none";
    case "caverns": return roll < (big ? 0.7 : 0.3) ? "rubble" : "none";
    case "water":   return big ? (roll < 0.5 ? "pillars" : "water") : roll < 0.5 ? "water" : roll < 0.65 ? "pillars" : "none";
    case "lava":    return big ? (roll < 0.6 ? "river" : "lava") : roll < 0.45 ? "lava" : "none";
    case "void":    return big ? (roll < 0.6 ? "chasm" : "pillars") : roll < 0.35 ? "chasm" : "none";
  }
}

/* ---------------- layouts ---------------- */

const overlaps = (a: Room, rooms: Room[], gap: number) =>
  rooms.some(o => a.x <= o.x + o.w + gap && o.x <= a.x + a.w + gap && a.y <= o.y + o.h + gap && o.y <= a.y + a.h + gap);

function place(rooms: Room[], w: number, h: number, r: Rng, gap = 1, tries = 60): Room | null {
  for (let t = 0; t < tries; t++) {
    const rm = { x: r.range(1, MW - w - 1), y: r.range(1, MH - h - 1), w, h };
    if (!overlaps(rm, rooms, gap)) return rm;
  }
  return null;
}

/* joins every room into one network: each new room to its nearest already-joined
   neighbour, then a couple of extra links so there are loops to run around */
function link(grid: Uint8Array, rooms: Room[], r: Rng, style: { wide: number; tunnels: boolean }) {
  const joined = [0];
  const join = (a: Room, b: Room) => {
    if (style.tunnels) tunnel(grid, center(a), center(b), r);
    else corridor(grid, center(a), center(b), r.chance(style.wide) ? 2 : 1, r);
  };
  for (let i = 1; i < rooms.length; i++) {
    const c = center(rooms[i]);
    let best = joined[0], bd = Infinity;
    for (const j of joined) {
      const o = center(rooms[j]);
      const d = Math.abs(o.x - c.x) + Math.abs(o.y - c.y);
      if (d < bd) { bd = d; best = j; }
    }
    join(rooms[best], rooms[i]);
    joined.push(i);
  }
  const extra = r.range(1, 2);
  for (let k = 0; k < extra && rooms.length > 3; k++) join(rooms[r.int(rooms.length)], rooms[r.int(rooms.length)]);
}

function carveShape(grid: Uint8Array, rm: Room, r: Rng) {
  const roll = r.next();
  if (roll < 0.2 && rm.w >= 5 && rm.h >= 5) carveOval(grid, rm);
  else if (roll < 0.3 && rm.w >= 5 && rm.h >= 5) carveCross(grid, rm);
  else carveRect(grid, rm);
}

function layoutRooms(grid: Uint8Array, depth: number, r: Rng, arena: boolean): Room[] {
  const rooms: Room[] = [];
  let arenaRoom: Room | null = null;
  if (arena) {
    arenaRoom = place(rooms, r.range(11, 13), r.range(8, 9), r);
    if (arenaRoom) rooms.push(arenaRoom);
  }
  const target = r.range(7, 10);
  for (let t = 0; t < 150 && rooms.length < target; t++) {
    const big = r.chance(0.15);
    const w = big ? r.range(9, 12) : r.range(4, 8), h = big ? r.range(6, 8) : r.range(3, 6);
    const rm = place(rooms, w, h, r, 1, 1);
    if (rm) rooms.push(rm);
  }
  for (const rm of rooms) {
    if (rm === arenaRoom) continue;
    carveShape(grid, rm, r);
  }
  if (arenaRoom) {
    carveOval(grid, arenaRoom);
    // four pillars to duck behind
    const c = center(arenaRoom);
    for (const [dx, dy] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) put(grid, c.x + dx, c.y + dy, WALL);
  }
  const f = zoneOf(depth).feature;
  link(grid, rooms, r, { wide: 0.25, tunnels: f === "caverns" });
  for (const rm of rooms) {
    if (rm === arenaRoom) continue;
    decorate(grid, rm, zoneDeco(depth, rm.w * rm.h >= 50, r), r);
  }
  // the arena goes last: it holds the stairs and the boss
  if (arenaRoom) { rooms.splice(rooms.indexOf(arenaRoom), 1); rooms.push(arenaRoom); }
  return rooms;
}

function layoutHalls(grid: Uint8Array, depth: number, r: Rng): Room[] {
  const rooms: Room[] = [];
  const halls = r.range(2, 3);
  for (let t = 0; t < 80 && rooms.length < halls; t++) {
    const rm = place(rooms, r.range(10, 14), r.range(7, 10), r, 2, 1);
    if (rm) rooms.push(rm);
  }
  const smalls = r.range(3, 5);
  for (let t = 0; t < 120 && rooms.length < halls + smalls; t++) {
    const rm = place(rooms, r.range(4, 7), r.range(3, 5), r, 1, 1);
    if (rm) rooms.push(rm);
  }
  rooms.forEach((rm, i) => (i < halls ? carveRect(grid, rm) : carveShape(grid, rm, r)));
  link(grid, rooms, r, { wide: 0.7, tunnels: false });
  rooms.forEach((rm, i) => decorate(grid, rm, zoneDeco(depth, i < halls, r), r));
  r.shuffle(rooms);
  return rooms;
}

function layoutCaverns(grid: Uint8Array, depth: number, r: Rng): Room[] {
  // grow caves: random noise smoothed by "become rock if most neighbours are rock"
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) grid[idx(x, y)] = r.chance(0.44) ? WALL : FLOOR;
  for (let pass = 0; pass < 5; pass++) {
    const next = grid.slice();
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      let walls = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[idx(x + dx, y + dy)] === WALL) walls++;
      next[idx(x, y)] = walls >= 5 ? WALL : FLOOR;
    }
    grid.set(next);
  }
  for (let x = 0; x < MW; x++) { grid[idx(x, 0)] = WALL; grid[idx(x, MH - 1)] = WALL; }
  for (let y = 0; y < MH; y++) { grid[idx(0, y)] = WALL; grid[idx(MW - 1, y)] = WALL; }
  // a couple of big open chambers
  for (let i = 0; i < 2; i++) carveOval(grid, { x: r.range(2, MW - 11), y: r.range(2, MH - 9), w: r.range(7, 9), h: r.range(5, 7) });

  // pick spread-out spots to act as "rooms" for monsters, loot and stairs
  const floors: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === FLOOR && interior(i % MW, (i / MW) | 0)) floors.push(i);
  r.shuffle(floors);
  const spots: Pt[] = [];
  for (const i of floors) {
    const p = { x: i % MW, y: (i / MW) | 0 };
    if (p.x < 3 || p.y < 3 || p.x > MW - 4 || p.y > MH - 4) continue;
    if (spots.every(s => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) >= 7)) spots.push(p);
    if (spots.length >= 10) break;
  }
  const rooms = spots.map(p => ({ x: p.x - 2, y: p.y - 2, w: 5, h: 5 }));
  for (const rm of rooms) carveRect(grid, { x: rm.x + 1, y: rm.y + 1, w: 3, h: 3 }); // a little clearing at each
  if (rooms.length >= 2) link(grid, rooms, r, { wide: 0, tunnels: true });
  const f = zoneOf(depth).feature;
  const pools: Deco = f === "lava" ? "lava" : f === "water" ? "water" : f === "void" ? "chasm" : "none";
  if (pools !== "none") {
    for (let i = 0; i < 4; i++) {
      const p = { x: r.range(3, MW - 6), y: r.range(3, MH - 6) };
      decorate(grid, { x: p.x - 3, y: p.y - 3, w: 7, h: 7 }, pools, r);
    }
  }
  return rooms;
}

/* ---------------- connectivity ---------------- */

const safe = (v: number) => !blocksMove(v) && v !== LAVA;

function flood(grid: Uint8Array, from: Pt) {
  const seen = new Uint8Array(MW * MH);
  const q = [idx(from.x, from.y)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const cx = q[h] % MW, cy = (q[h] / MW) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (seen[ni] || !safe(grid[ni])) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  return seen;
}

/* every walkable tile must be reachable from the start without crossing lava
   or chasms: dig a straight passage from each cut-off pocket to the nearest
   reachable tile (paving over whatever is in the way) */
function connect(grid: Uint8Array, start: Pt) {
  for (let pass = 0; pass < 60; pass++) {
    const seen = flood(grid, start);
    let lost = -1;
    for (let i = 0; i < grid.length; i++) if (!seen[i] && safe(grid[i]) && interior(i % MW, (i / MW) | 0)) { lost = i; break; }
    if (lost < 0) return;
    const lx = lost % MW, ly = (lost / MW) | 0;
    let best = -1, bd = Infinity;
    for (let i = 0; i < grid.length; i++) {
      if (!seen[i]) continue;
      const d = Math.abs(i % MW - lx) + Math.abs(((i / MW) | 0) - ly);
      if (d < bd) { bd = d; best = i; }
    }
    let x = lx, y = ly;
    const tx = best % MW, ty = (best / MW) | 0;
    while (x !== tx) { x += Math.sign(tx - x); if (!safe(grid[idx(x, y)])) grid[idx(x, y)] = FLOOR; }
    while (y !== ty) { y += Math.sign(ty - y); if (!safe(grid[idx(x, y)])) grid[idx(x, y)] = FLOOR; }
  }
  // anything still cut off becomes rock
  const seen = flood(grid, start);
  for (let i = 0; i < grid.length; i++) if (!seen[i] && safe(grid[i])) grid[i] = WALL;
}

/* how many steps from the start to every tile (walking safely) */
function distances(grid: Uint8Array, from: Pt) {
  const dist = new Int32Array(MW * MH).fill(-1);
  const q = [idx(from.x, from.y)];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const cx = q[h] % MW, cy = (q[h] / MW) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (dist[ni] >= 0 || !safe(grid[ni])) continue;
      dist[ni] = dist[q[h]] + 1; q.push(ni);
    }
  }
  return dist;
}

/* ---------------- entry point ---------------- */

export function generateLevel(r: Rng, depth: number): Level {
  for (let attempt = 0; attempt < 20; attempt++) {
    const grid = new Uint8Array(MW * MH);
    const boss = isBossFloor(depth);
    const layout: Layout = boss ? "rooms" : weighted(zoneOf(depth).layouts, r);
    const rooms = layout === "caverns" ? layoutCaverns(grid, depth, r)
      : layout === "halls" ? layoutHalls(grid, depth, r)
      : layoutRooms(grid, depth, r, boss);
    if (rooms.length < 4) continue;

    // room centers are always open floor
    for (const rm of rooms) { const c = center(rm); grid[idx(c.x, c.y)] = FLOOR; }

    // start in the room farthest from where the stairs will go (on boss floors, the arena)
    const anchor = boss ? rooms.length - 1 : 0;
    const roughFar = (a: Room, b: Room) => Math.abs(center(a).x - center(b).x) + Math.abs(center(a).y - center(b).y);
    let startIdx = 0;
    if (boss) startIdx = rooms.reduce((bi, rm, i) => (i !== anchor && roughFar(rm, rooms[anchor]) > roughFar(rooms[bi], rooms[anchor]) ? i : bi), 0);
    const start = center(rooms[startIdx]);
    connect(grid, start);

    // stairs: normal ones in the farthest room (or the arena), perilous in the next farthest well away from them
    const dist = distances(grid, start);
    const reach = (rm: Room) => dist[idx(center(rm).x, center(rm).y)];
    const order = rooms.map((_, i) => i).filter(i => i !== startIdx && reach(rooms[i]) > 0)
      .sort((a, b) => reach(rooms[b]) - reach(rooms[a]));
    if (order.length < 2) continue;
    const stairsIdx = boss ? anchor : order[0];
    if (reach(rooms[stairsIdx]) <= 0) continue;
    const st = center(rooms[stairsIdx]);
    const riskIdx = order.find(i => i !== stairsIdx && Math.abs(center(rooms[i]).x - st.x) + Math.abs(center(rooms[i]).y - st.y) >= 6)
      ?? order.find(i => i !== stairsIdx)!;
    grid[idx(st.x, st.y)] = STAIRS;
    const rk = center(rooms[riskIdx]);
    grid[idx(rk.x, rk.y)] = STAIRS_RISK;

    // areas[0] is the start room; the stairs room keeps its index for the boss
    const areas = [rooms[startIdx], ...rooms.filter((_, i) => i !== startIdx)];
    return { grid, areas, start, stairsArea: areas.indexOf(rooms[stairsIdx]) };
  }
  throw new Error(`could not generate floor ${depth}`);
}

function weighted<T>(opts: [T, number][], r: Rng): T {
  const total = opts.reduce((s, [, w]) => s + w, 0);
  let x = r.next() * total;
  for (const [v, w] of opts) { if ((x -= w) < 0) return v; }
  return opts[opts.length - 1][0];
}
