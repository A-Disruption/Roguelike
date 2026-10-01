/* ============================ constants ============================ */

export const MW = 31, MH = 29;          // map size
export const VW = 11, VH = 13;          // viewport in tiles
export const WALL = 0, FLOOR = 1, STAIRS = 2;

export const C = {
  void:    "#080A0E",
  memWall: "#161B23",
  memFloor:"#10141A",
  memGlyph:"#39434F",
  litWall: "#4A3524",
  litFloor:"#241B13",
  bone:    "#E6DCC9",
  ember:   "#E9A13B",
  blood:   "#C04A3B",
  verd:    "#5E9482",
  dim:     "#7C8794",
};

type MonBase = {
  k: string; g: string; name: string; hp: number; atk: number; def: number; xp: number; ech: number;
  min: number; max?: number; erratic?: boolean; pierce?: boolean; slow?: boolean; boss?: boolean;
};

const MONSTERS: MonBase[] = [
  { k:"rat",     g:"r", name:"cellar rat",  hp:7,  atk:3,  def:0, xp:3,  ech:2,  min:1,  max:5 },
  { k:"bat",     g:"v", name:"blind bat",   hp:6,  atk:4,  def:0, xp:4,  ech:3,  min:1,  max:7,  erratic:true },
  { k:"goblin",  g:"g", name:"goblin",      hp:11, atk:5,  def:0, xp:6,  ech:4,  min:2,  max:10 },
  { k:"skeleton",g:"s", name:"skeleton",    hp:19, atk:8,  def:3, xp:10, ech:7,  min:4,  max:14 },
  { k:"wraith",  g:"w", name:"wraith",      hp:15, atk:9,  def:0, xp:14, ech:10, min:6,  max:99, pierce:true },
  { k:"ogre",    g:"O", name:"ogre",        hp:36, atk:15, def:2, xp:22, ech:16, min:8,  max:99, slow:true },
];
const WARDEN: MonBase = { k:"warden", g:"W", name:"warden of the deep", hp:40, atk:11, def:2, xp:45, ech:55, min:5, boss:true };

const WEAPONS = [
  { name:"rusted knife", atk:1 }, { name:"iron sword", atk:3 }, { name:"hooked spear", atk:5 },
  { name:"runed blade", atk:8 }, { name:"kingsbane", atk:12 }, { name:"the long quiet", atk:17 },
];
const ARMORS = [
  { name:"padded rags", def:1 }, { name:"boiled leather", def:2 }, { name:"chain shirt", def:4 },
  { name:"warden plate", def:6 }, { name:"grave-iron", def:9 },
];

export const UPGRADES = [
  { k:"vigor",   name:"Vigor",   blurb:"+7 health",        max:5, costs:[20,35,55,80,110] },
  { k:"edge",    name:"Edge",    blurb:"+1 attack",        max:5, costs:[30,50,75,105,140] },
  { k:"hide",    name:"Hide",    blurb:"+1 armor",         max:3, costs:[45,85,140] },
  { k:"lantern", name:"Lantern", blurb:"+1 tile of sight", max:2, costs:[60,125] },
  { k:"satchel", name:"Satchel", blurb:"start with a tonic",max:3, costs:[25,45,70] },
  { k:"greed",   name:"Greed",   blurb:"+20% echoes",      max:3, costs:[40,70,110] },
];
export type Upgrade = typeof UPGRADES[number];

/* ============================ types ============================ */

export type Flash = (i: number, kind: "hit" | "hurt") => void;
export type Pt = { x: number; y: number };
export type Room = { x: number; y: number; w: number; h: number };

export type Mon = {
  kind: string; glyph: string; name: string;
  hp: number; maxHp: number; atk: number; def: number; xp: number; ech: number;
  erratic: boolean; pierce: boolean; slow: boolean; boss: boolean;
  tick: number; x: number; y: number; id: string;
};

export type Pocket = "tonic" | "ember" | "waystone";
export type ItemType = Pocket | "weapon" | "armor" | "echoes";
export type Item = { t: ItemType; name: string; x: number; y: number; atk?: number; def?: number; amt?: number };

export type Game = {
  depth: number; grid: Uint8Array; rooms: Room[];
  mons: Mon[]; items: Item[];
  seen: Uint8Array; vis: Set<number>;
  p: Pt;
  hp: number; maxHp: number; atk: number; def: number; sight: number;
  weapon: { name: string; atk: number } | null;
  armor: { name: string; def: number } | null;
  inv: Record<Pocket, number>;
  level: number; xp: number; next: number;
  echoes: number; greed: number; kills: number; turns: number;
  log: string[];
  dead: boolean; path: Pt[] | null;
};

export type Meta = { echoes: number; best: number; runs: number; kills: number; up: Record<string, number> };

/* ============================ helpers ============================ */

export const rnd = (n: number) => Math.floor(Math.random() * n);
export const rint = (a: number, b: number) => a + rnd(b - a + 1);
export const pick = <T,>(a: T[]): T => a[rnd(a.length)];
export const idx = (x: number, y: number) => y * MW + x;
export const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < MW && y < MH;

function ctr(r: Room): Pt { return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }

function hall(grid: Uint8Array, from: number, to: number, fixed: number, horiz: boolean) {
  const [a, b] = from < to ? [from, to] : [to, from];
  for (let i = a; i <= b; i++) {
    const x = horiz ? i : fixed, y = horiz ? fixed : i;
    if (inB(x, y)) grid[idx(x, y)] = FLOOR;
  }
}

function genLevel(depth: number): { grid: Uint8Array; rooms: Room[] } {
  const grid = new Uint8Array(MW * MH);
  const rooms: Room[] = [];
  for (let t = 0; t < 120 && rooms.length < 9; t++) {
    const w = rint(4, 8), h = rint(3, 6);
    const x = rint(1, MW - w - 2), y = rint(1, MH - h - 2);
    if (rooms.some(o => x <= o.x + o.w + 1 && o.x <= x + w + 1 && y <= o.y + o.h + 1 && o.y <= y + h + 1)) continue;
    rooms.push({ x, y, w, h });
  }
  rooms.forEach(r => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[idx(x, y)] = FLOOR;
  });
  for (let i = 1; i < rooms.length; i++) {
    const a = ctr(rooms[i - 1]), b = ctr(rooms[i]);
    if (Math.random() < 0.5) { hall(grid, a.x, b.x, a.y, true); hall(grid, a.y, b.y, b.x, false); }
    else { hall(grid, a.y, b.y, a.x, false); hall(grid, a.x, b.x, b.y, true); }
  }
  if (rooms.length < 2) return genLevel(depth);
  const last = rooms[rooms.length - 1];
  const st = ctr(last);
  grid[idx(st.x, st.y)] = STAIRS;
  return { grid, rooms };
}

function freeSpot(room: Room, grid: Uint8Array, taken: Set<number>): Pt | null {
  for (let t = 0; t < 40; t++) {
    const x = rint(room.x, room.x + room.w - 1), y = rint(room.y, room.y + room.h - 1);
    if (grid[idx(x, y)] !== FLOOR) continue;
    if (taken.has(idx(x, y))) continue;
    taken.add(idx(x, y));
    return { x, y };
  }
  return null;
}

function scaleMon(base: MonBase, depth: number): Omit<Mon, "x" | "y" | "id"> {
  const over = Math.max(0, depth - base.min);
  return {
    kind: base.k, glyph: base.g, name: base.name,
    hp: Math.round(base.hp * (1 + 0.13 * over)),
    maxHp: Math.round(base.hp * (1 + 0.13 * over)),
    atk: Math.round(base.atk * (1 + 0.09 * over)),
    def: base.def + Math.floor(over / 4),
    xp: base.xp + over, ech: base.ech + Math.round(over * 1.5),
    erratic: !!base.erratic, pierce: !!base.pierce, slow: !!base.slow, boss: !!base.boss,
    tick: 0,
  };
}

function tierFor<T>(depth: number, list: T[]): T {
  const t = Math.min(list.length - 1, Math.floor((depth - 1) / 2.5) + (Math.random() < 0.25 ? 1 : 0));
  return list[Math.max(0, Math.min(list.length - 1, t))];
}

const newId = () => Math.random().toString(36).slice(2);

function populate(level: { grid: Uint8Array; rooms: Room[] }, depth: number) {
  const taken = new Set<number>();
  const mons: Mon[] = [], items: Item[] = [];
  const { grid, rooms } = level;
  const start = ctr(rooms[0]);
  taken.add(idx(start.x, start.y));

  rooms.forEach((r, i) => {
    if (i === 0) return;
    const n = depth === 1 ? 1 : rint(1, depth < 5 ? 2 : 3);
    for (let j = 0; j < n; j++) {
      const pool = MONSTERS.filter(m => depth >= m.min && depth <= (m.max ?? 99));
      const s = freeSpot(r, grid, taken);
      if (!s) continue;
      mons.push({ ...scaleMon(pick(pool), depth), x: s.x, y: s.y, id: newId() });
    }
  });

  if (depth % 5 === 0) {
    const r = rooms[rooms.length - 1];
    const s = freeSpot(r, grid, taken) || ctr(r);
    mons.push({ ...scaleMon(WARDEN, depth), x: s.x, y: s.y, id: "boss" + depth });
  }

  const nItems = rint(3, 5);
  for (let i = 0; i < nItems; i++) {
    const r = rooms[rint(1, rooms.length - 1)];
    const s = freeSpot(r, grid, taken);
    if (!s) continue;
    const roll = Math.random();
    let it: Omit<Item, "x" | "y">;
    if (roll < 0.34) it = { t: "tonic", name: "tonic" };
    else if (roll < 0.46) it = { t: "ember", name: "ember scroll" };
    else if (roll < 0.56) it = { t: "waystone", name: "waystone" };
    else if (roll < 0.72) { const w = tierFor(depth, WEAPONS); it = { t: "weapon", name: w.name, atk: w.atk }; }
    else if (roll < 0.86) { const a = tierFor(depth, ARMORS); it = { t: "armor", name: a.name, def: a.def }; }
    else it = { t: "echoes", name: "spill of echoes", amt: rint(4, 9) + depth * 2 };
    items.push({ ...it, x: s.x, y: s.y });
  }
  return { mons, items, start };
}

/* line of sight, Bresenham against walls */
export function los(grid: Uint8Array, x0: number, y0: number, x1: number, y1: number) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let g = 0; g < 60; g++) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (!inB(x, y)) return false;
    if (x === x1 && y === y1) return true;
    if (grid[idx(x, y)] === WALL) return false;
  }
  return false;
}

export function computeFov(g: Pick<Game, "sight" | "p" | "grid" | "seen">) {
  const R = g.sight;
  const vis = new Set<number>();
  for (let y = g.p.y - R; y <= g.p.y + R; y++) {
    for (let x = g.p.x - R; x <= g.p.x + R; x++) {
      if (!inB(x, y)) continue;
      const d = Math.hypot(x - g.p.x, y - g.p.y);
      if (d > R + 0.3) continue;
      if (los(g.grid, g.p.x, g.p.y, x, y)) { vis.add(idx(x, y)); g.seen[idx(x, y)] = 1; }
    }
  }
  return vis;
}

export function bfsPath(g: Game, tx: number, ty: number): Pt[] | null {
  const start = idx(g.p.x, g.p.y), goal = idx(tx, ty);
  if (start === goal) return null;
  if (!g.seen[goal] || g.grid[goal] === WALL) return null;
  const prev = new Int32Array(MW * MH).fill(-1);
  const q = [start]; prev[start] = start;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) break;
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (prev[ni] !== -1) continue;
      if (!g.seen[ni] || g.grid[ni] === WALL) continue;
      prev[ni] = cur; q.push(ni);
    }
  }
  if (prev[goal] === -1) return null;
  const path: Pt[] = [];
  let cur = goal;
  while (cur !== start) { path.push({ x: cur % MW, y: (cur / MW) | 0 }); cur = prev[cur]; }
  return path.reverse();
}

/* ============================ meta ============================ */

export const freshMeta = (): Meta => ({ echoes: 0, best: 0, runs: 0, kills: 0, up: {} });

function playerBase(meta: Meta) {
  const u = meta.up || {};
  return {
    maxHp: 32 + 7 * (u.vigor || 0),
    atk: 5 + (u.edge || 0),
    def: 0 + (u.hide || 0),
    sight: 6 + (u.lantern || 0),
    tonics: 1 + (u.satchel || 0),
    greed: 1 + 0.2 * (u.greed || 0),
  };
}

export function newRun(meta: Meta): Game {
  const b = playerBase(meta);
  const depth = 1;
  const lvl = genLevel(depth);
  const pop = populate(lvl, depth);
  const g: Game = {
    depth, grid: lvl.grid, rooms: lvl.rooms,
    mons: pop.mons, items: pop.items,
    seen: new Uint8Array(MW * MH), vis: new Set(),
    p: { x: pop.start.x, y: pop.start.y },
    hp: b.maxHp, maxHp: b.maxHp, atk: b.atk, def: b.def, sight: b.sight,
    weapon: null, armor: null,
    inv: { tonic: b.tonics, ember: 0, waystone: 0 },
    level: 1, xp: 0, next: 12,
    echoes: 0, greed: b.greed, kills: 0, turns: 0,
    log: ["You wake at the mouth of the depths. Something below is still burning."],
    dead: false, path: null,
  };
  g.vis = computeFov(g);
  return g;
}

export function descend(g: Game) {
  g.depth += 1;
  const lvl = genLevel(g.depth);
  const pop = populate(lvl, g.depth);
  g.grid = lvl.grid; g.rooms = lvl.rooms;
  g.mons = pop.mons; g.items = pop.items;
  g.seen = new Uint8Array(MW * MH);
  g.p = { x: pop.start.x, y: pop.start.y };
  g.path = null;
  const rest = Math.round(g.maxHp * 0.12);
  const before = g.hp;
  g.hp = Math.min(g.maxHp, g.hp + rest);
  g.vis = computeFov(g);
  say(g, `Depth ${g.depth}. The air gets colder.`);
  if (g.hp > before) say(g, `You catch your breath on the stair. +${g.hp - before}.`);
}

export function say(g: Game, s: string) { g.log.push(s); if (g.log.length > 24) g.log.shift(); }

export function totalAtk(g: Game) { return g.atk + (g.weapon ? g.weapon.atk : 0); }
export function totalDef(g: Game) { return g.def + (g.armor ? g.armor.def : 0); }

function dmgRoll(atk: number, def: number) {
  return Math.max(1, Math.round((atk - def) * (0.82 + Math.random() * 0.36)));
}

/* ============================ turn logic ============================ */

function grantXp(g: Game, n: number) {
  g.xp += n;
  while (g.xp >= g.next) {
    g.xp -= g.next;
    g.level += 1;
    g.next = Math.round(g.next * 1.55);
    g.maxHp += 5; g.hp = Math.min(g.maxHp, g.hp + 8);
    if (g.level % 2 === 0) g.atk += 1;
    say(g, `You steady. Level ${g.level}.`);
  }
}

function killMon(g: Game, m: Mon) {
  g.mons = g.mons.filter(o => o !== m);
  g.kills += 1;
  g.echoes += m.ech;
  grantXp(g, m.xp);
  say(g, `The ${m.name} falls.`);
}

export function playerAttack(g: Game, m: Mon, flash: Flash) {
  const d = dmgRoll(totalAtk(g), m.def);
  m.hp -= d;
  flash(idx(m.x, m.y), "hit");
  if (m.hp <= 0) killMon(g, m);
  else say(g, `You hit the ${m.name} for ${d}.`);
}

export function monsterTurn(g: Game, flash: Flash) {
  for (const m of [...g.mons]) {
    if (m.slow) { m.tick = (m.tick + 1) % 2; if (m.tick === 1) continue; }
    const dist = Math.max(Math.abs(m.x - g.p.x), Math.abs(m.y - g.p.y));
    if (dist === 1) {
      const d = dmgRoll(m.atk, m.pierce ? 0 : totalDef(g));
      g.hp -= d;
      say(g, `The ${m.name} hits you for ${d}.`);
      flash(idx(g.p.x, g.p.y), "hurt");
      if (g.hp <= 0) { g.hp = 0; g.dead = true; return; }
      continue;
    }
    const aware = dist <= g.sight + 2 && los(g.grid, m.x, m.y, g.p.x, g.p.y);
    let nx = m.x, ny = m.y;
    if (aware && !(m.erratic && Math.random() < 0.35)) {
      const dx = Math.sign(g.p.x - m.x), dy = Math.sign(g.p.y - m.y);
      const tries = Math.abs(g.p.x - m.x) > Math.abs(g.p.y - m.y)
        ? [[dx, 0], [0, dy], [dx, dy]] : [[0, dy], [dx, 0], [dx, dy]];
      for (const [ax, ay] of tries) {
        const tx = m.x + ax, ty = m.y + ay;
        if (!inB(tx, ty) || g.grid[idx(tx, ty)] === WALL) continue;
        if (tx === g.p.x && ty === g.p.y) continue;
        if (g.mons.some(o => o !== m && o.x === tx && o.y === ty)) continue;
        nx = tx; ny = ty; break;
      }
    } else if (Math.random() < 0.4) {
      const [ax, ay] = pick([[0,1],[0,-1],[1,0],[-1,0]]);
      const tx = m.x + ax, ty = m.y + ay;
      if (inB(tx, ty) && g.grid[idx(tx, ty)] !== WALL && !(tx === g.p.x && ty === g.p.y)
          && !g.mons.some(o => o !== m && o.x === tx && o.y === ty)) { nx = tx; ny = ty; }
    }
    m.x = nx; m.y = ny;
  }
}

export function pickUp(g: Game) {
  const it = g.items.find(i => i.x === g.p.x && i.y === g.p.y);
  if (!it) return;
  g.items = g.items.filter(i => i !== it);
  if (it.t === "tonic" || it.t === "ember" || it.t === "waystone") {
    g.inv[it.t] += 1; say(g, `You pocket a ${it.name}.`);
  } else if (it.t === "echoes") {
    const amt = it.amt ?? 0;
    g.echoes += amt; say(g, `${amt} echoes, still warm.`);
  } else if (it.t === "weapon") {
    const atk = it.atk ?? 0;
    if (!g.weapon || atk > g.weapon.atk) { g.weapon = { name: it.name, atk }; say(g, `You take up the ${it.name}. +${atk} attack.`); }
    else { const v = 5 + atk * 3; g.echoes += v; say(g, `You leave the ${it.name}, keep the fittings. +${v} echoes.`); }
  } else if (it.t === "armor") {
    const def = it.def ?? 0;
    if (!g.armor || def > g.armor.def) { g.armor = { name: it.name, def }; say(g, `You strap on the ${it.name}. +${def} armor.`); }
    else { const v = 5 + def * 4; g.echoes += v; say(g, `The ${it.name} is worse than yours. +${v} echoes.`); }
  }
}

/* ============================ items ============================ */

export function drinkTonic(g: Game) {
  if (g.inv.tonic <= 0) return;
  g.inv.tonic -= 1;
  const heal = Math.round(g.maxHp * 0.45);
  g.hp = Math.min(g.maxHp, g.hp + heal);
  say(g, `The tonic burns going down. +${heal}.`);
}

export function burnEmber(g: Game, flash: Flash) {
  if (g.inv.ember <= 0) return;
  g.inv.ember -= 1;
  const targets = g.mons.filter(m => g.vis.has(idx(m.x, m.y)));
  if (!targets.length) { say(g, "The scroll flares at nothing."); return; }
  say(g, "Fire runs the room.");
  for (const m of targets) {
    const d = rint(9, 15) + g.depth;
    m.hp -= d;
    flash(idx(m.x, m.y), "hit");
    if (m.hp <= 0) killMon(g, m);
  }
}

export function castWaystone(g: Game) {
  if (g.inv.waystone <= 0) return;
  g.inv.waystone -= 1;
  const spots: number[] = [];
  for (let i = 0; i < MW * MH; i++) if (g.seen[i] && g.grid[i] !== WALL) spots.push(i);
  const far = spots.filter(i => {
    const x = i % MW, y = (i / MW) | 0;
    return Math.hypot(x - g.p.x, y - g.p.y) > 7 && !g.mons.some(m => m.x === x && m.y === y);
  });
  const t = pick(far.length ? far : spots);
  g.p = { x: t % MW, y: (t / MW) | 0 };
  say(g, "The waystone pulls, and the room changes.");
  pickUp(g);
}

/* ============================ serialization ============================ */

/* run-length encode the map arrays; they are mostly long runs of one value */
function rle(str: string) {
  let out = "", i = 0;
  while (i < str.length) { let j = i; while (j < str.length && str[j] === str[i]) j++; out += str[i] + (j - i) + "."; i = j; }
  return out;
}
function unrle(s: string) {
  let out = "";
  for (const part of s.split(".")) { if (!part) continue; out += part[0].repeat(Number(part.slice(1))); }
  return out;
}

function monFromKind(kind: string, depth: number) {
  const base = kind === "warden" ? WARDEN : MONSTERS.find(m => m.k === kind);
  return base ? scaleMon(base, depth) : null;
}

export type SavedRun = ReturnType<typeof serializeRun>;

/* Compact save: monster stats are rebuilt from kind + depth rather than stored. */
export function serializeRun(g: Game) {
  return {
    d: g.depth,
    G: rle(Array.from(g.grid).join("")),
    S: rle(Array.from(g.seen).join("")),
    m: g.mons.map(m => [m.kind, m.x, m.y, m.hp, m.tick || 0] as [string, number, number, number, number]),
    i: g.items.map(i => [i.t, i.x, i.y, i.atk ?? i.def ?? i.amt ?? 0, i.name] as [ItemType, number, number, number, string]),
    p: [g.p.x, g.p.y],
    h: [g.hp, g.maxHp, g.atk, g.def, g.sight],
    w: g.weapon ? [g.weapon.name, g.weapon.atk] as [string, number] : null,
    a: g.armor ? [g.armor.name, g.armor.def] as [string, number] : null,
    v: [g.inv.tonic, g.inv.ember, g.inv.waystone],
    x: [g.level, g.xp, g.next],
    e: [g.echoes, g.greed, g.kills, g.turns],
    l: g.log.slice(-3),
  };
}

export function deserializeRun(o: SavedRun): Game {
  const depth = o.d;
  const g: Game = {
    depth,
    grid: Uint8Array.from(unrle(o.G).split("").map(Number)),
    seen: Uint8Array.from(unrle(o.S).split("").map(Number)),
    vis: new Set(),
    rooms: [],
    mons: o.m.flatMap(([k, x, y, hp, tick]) => {
      const b = monFromKind(k, depth);
      return b ? [{ ...b, x, y, hp, tick, id: newId() }] : [];
    }),
    items: o.i.map(([t, x, y, n, name]) => {
      const it: Item = { t, x, y, name };
      if (t === "weapon") it.atk = n; else if (t === "armor") it.def = n; else if (t === "echoes") it.amt = n;
      return it;
    }),
    p: { x: o.p[0], y: o.p[1] },
    hp: o.h[0], maxHp: o.h[1], atk: o.h[2], def: o.h[3], sight: o.h[4],
    weapon: o.w ? { name: o.w[0], atk: o.w[1] } : null,
    armor: o.a ? { name: o.a[0], def: o.a[1] } : null,
    inv: { tonic: o.v[0], ember: o.v[1], waystone: o.v[2] },
    level: o.x[0], xp: o.x[1], next: o.x[2],
    echoes: o.e[0], greed: o.e[1], kills: o.e[2], turns: o.e[3],
    log: o.l?.length ? o.l : ["You come back to yourself in the dark."],
    dead: false, path: null,
  };
  if (g.grid.length !== MW * MH || g.seen.length !== MW * MH) throw new Error("save has the wrong map size");
  g.vis = computeFov(g);
  return g;
}
