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
  ranged?: boolean;      // shoots arrows from a distance
  phase?: boolean;       // drifts through walls
  splits?: boolean;      // splits in two when hit
  gear?: "both" | "armor"; // can spawn carrying a weapon and/or armor
  noPool?: boolean;      // never rolled as a regular spawn
};

const MONSTERS: MonBase[] = [
  { k:"rat",     g:"r", name:"cellar rat",  hp:7,  atk:3,  def:0, xp:3,  ech:2,  min:1,  max:5 },
  { k:"bat",     g:"v", name:"blind bat",   hp:6,  atk:4,  def:0, xp:4,  ech:3,  min:1,  max:7,  erratic:true },
  { k:"goblin",  g:"g", name:"goblin",      hp:11, atk:5,  def:0, xp:6,  ech:4,  min:2,  max:10, gear:"both" },
  { k:"slime",   g:"j", name:"slime",       hp:14, atk:4,  def:0, xp:5,  ech:3,  min:2,  max:9,  slow:true, splits:true },
  { k:"archer",  g:"a", name:"goblin archer",hp:9, atk:5,  def:0, xp:8,  ech:6,  min:3,  max:12, ranged:true, gear:"armor" },
  { k:"skeleton",g:"s", name:"skeleton",    hp:19, atk:8,  def:3, xp:10, ech:7,  min:4,  max:14, gear:"both" },
  { k:"ghost",   g:"G", name:"ghost",       hp:12, atk:7,  def:0, xp:12, ech:9,  min:5,  max:99, phase:true },
  { k:"wraith",  g:"w", name:"wraith",      hp:15, atk:9,  def:0, xp:14, ech:10, min:6,  max:99, pierce:true },
  { k:"ogre",    g:"O", name:"ogre",        hp:36, atk:15, def:2, xp:22, ech:16, min:8,  max:99, slow:true, gear:"both" },
  { k:"mimic",   g:"m", name:"mimic",       hp:22, atk:8,  def:1, xp:15, ech:20, min:3,  noPool:true },
];
const WARDEN: MonBase = { k:"warden", g:"W", name:"warden of the deep", hp:40, atk:11, def:2, xp:45, ech:55, min:5, boss:true };

/* Color variants: same monster, different skin/eyes and a little stronger. */
export type Variant = {
  prefix: string; pal: Record<string, string>;
  hp: number; atk: number; def?: number; ech: number; erratic?: boolean;
};
export const VARIANTS: Record<string, Variant[]> = {
  rat: [
    { prefix:"plague", pal:{ b:"#6E7A4A", d:"#4F5A33", t:"#8A9460", k:"#C04A3B" }, hp:1.3, atk:1.2, ech:1.5 },
    { prefix:"white",  pal:{ b:"#CFC8BC", d:"#9A9484", t:"#E6DCC9", k:"#C04A3B" }, hp:0.9, atk:1.1, ech:1.5, erratic:true },
  ],
  bat: [
    { prefix:"vampire", pal:{ w:"#7A2E3A", b:"#3A1820", k:"#F2D06B" }, hp:1.2, atk:1.3, ech:1.5 },
  ],
  goblin: [
    { prefix:"cave",     pal:{ g:"#4E7A78", d:"#355654", y:"#E9A13B" }, hp:1.2, atk:1.1, ech:1.3 },
    { prefix:"red-eyed", pal:{ g:"#7A6A46", d:"#59492E", k:"#C04A3B" }, hp:1.0, atk:1.3, ech:1.4 },
  ],
  slime: [
    { prefix:"ember", pal:{ g:"#D9822B", l:"#F2C46B", d:"#8C4A1A" }, hp:1.2, atk:1.3, ech:1.5 },
    { prefix:"ink",   pal:{ g:"#3A3F6E", l:"#6A72B0", d:"#22264A", k:"#E6DCC9" }, hp:1.4, atk:1.0, ech:1.4 },
  ],
  archer: [
    { prefix:"cave", pal:{ g:"#4E7A78", d:"#355654" }, hp:1.2, atk:1.1, ech:1.3 },
  ],
  skeleton: [
    { prefix:"burnt", pal:{ b:"#7A706A", d:"#4E4640", k:"#E9A13B" }, hp:1.2, atk:1.1, def:1, ech:1.4 },
  ],
  ghost: [
    { prefix:"sorrowful", pal:{ w:"#B6C8F0", d:"#7C8FBE", k:"#3A4A7A" }, hp:1.3, atk:1.1, ech:1.4 },
  ],
  wraith: [
    { prefix:"pale", pal:{ w:"#C8D0DC", d:"#7E8899", p:"#E9A13B" }, hp:1.3, atk:1.1, ech:1.4 },
  ],
  ogre: [
    { prefix:"moss", pal:{ o:"#4F6B3E", d:"#384D2C" }, hp:1.25, atk:1.0, def:1, ech:1.3 },
  ],
};

export const WEAPONS = [
  { name:"rusted knife", atk:1 }, { name:"iron sword", atk:3 }, { name:"hooked spear", atk:5 },
  { name:"runed blade", atk:8 }, { name:"kingsbane", atk:12 }, { name:"the long quiet", atk:17 },
];
export const ARMORS = [
  { name:"padded rags", def:1 }, { name:"boiled leather", def:2 }, { name:"chain shirt", def:4 },
  { name:"warden plate", def:6 }, { name:"grave-iron", def:9 },
];
export const weaponTier = (name: string) => WEAPONS.findIndex(w => w.name === name);
export const armorTier = (name: string) => ARMORS.findIndex(a => a.name === name);

/* Potions: the colors are shuffled onto effects at the start of every run. */
export const POTION_COLORS = [
  { name:"amber",  hex:"#E9A13B" },
  { name:"violet", hex:"#9A5AA8" },
  { name:"teal",   hex:"#3FB8B0" },
  { name:"rose",   hex:"#E07A9A" },
  { name:"murky",  hex:"#6B7A3A" },
  { name:"silver", hex:"#C9CFD6" },
];
export const POTION_EFFECTS = [
  { k:"mending", name:"potion of mending",     blurb:"heals you completely" },
  { k:"might",   name:"potion of might",       blurb:"+2 attack for this run" },
  { k:"vigor",   name:"potion of vigor",       blurb:"+8 max health for this run" },
  { k:"sight",   name:"potion of clear sight", blurb:"reveals the floor and its traps" },
  { k:"shadow",  name:"potion of shadow",      blurb:"monsters lose track of you for a while" },
  { k:"foul",    name:"foul potion",           blurb:"tastes awful and hurts" },
];

export const TRAP_NAMES = { spikes: "spike trap", pit: "hidden pit", alarm: "alarm plate" } as const;

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

export type FlashKind = "hit" | "hurt" | "arrow";
export type Flash = (i: number, kind: FlashKind) => void;
export type Pt = { x: number; y: number };
export type Room = { x: number; y: number; w: number; h: number };

export type Mon = {
  kind: string; glyph: string; name: string;
  hp: number; maxHp: number; atk: number; def: number; xp: number; ech: number;
  erratic: boolean; pierce: boolean; slow: boolean; boss: boolean;
  ranged: boolean; phase: boolean; splits: boolean;
  variant: number;   // 0 = normal, n = VARIANTS[kind][n - 1]
  wpn: number;       // index into WEAPONS, -1 for none
  arm: number;       // index into ARMORS, -1 for none
  gen: number;       // how many times a slime has split
  alerted: boolean;  // knows where you are no matter what
  disguised: boolean;// a mimic still pretending to be a chest
  tick: number; x: number; y: number; id: string;
};

export type Pocket = "tonic" | "ember" | "waystone" | "key";
export type ItemType = Pocket | "weapon" | "armor" | "echoes" | "potion" | "chest";
export type Item = {
  t: ItemType; name: string; x: number; y: number;
  atk?: number; def?: number; amt?: number; color?: number; locked?: boolean;
};

export type TrapType = keyof typeof TRAP_NAMES;
export type Trap = { t: TrapType; x: number; y: number; found: boolean };

export type Game = {
  depth: number; grid: Uint8Array; rooms: Room[];
  mons: Mon[]; items: Item[]; traps: Trap[];
  seen: Uint8Array; vis: Set<number>;
  p: Pt;
  hp: number; maxHp: number; atk: number; def: number; sight: number;
  weapon: { name: string; atk: number } | null;
  armor: { name: string; def: number } | null;
  inv: Record<Pocket, number>;
  potions: number[];     // count held, per color
  potionMap: number[];   // color -> effect
  known: boolean[];      // effect -> identified
  hidden: number;        // turns of shadow left
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
const cheb = (a: Pt, b: Pt) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const DIRS8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

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

function tierFor<T>(depth: number, list: T[]): T {
  const t = Math.min(list.length - 1, Math.floor((depth - 1) / 2.5) + (Math.random() < 0.25 ? 1 : 0));
  return list[Math.max(0, Math.min(list.length - 1, t))];
}

const newId = () => Math.random().toString(36).slice(2);

/* ============================ monsters ============================ */

const baseFor = (kind: string) => kind === "warden" ? WARDEN : MONSTERS.find(m => m.k === kind);

type MonStats = Omit<Mon, "x" | "y" | "id">;

/* Builds a monster's stats from its kind, depth, color variant and gear. Saves only
   store those four things, so this has to give the same answer every time. */
function makeMon(kind: string, depth: number, variant = 0, wpn = -1, arm = -1): MonStats | null {
  const base = baseFor(kind);
  if (!base) return null;
  const over = Math.max(0, depth - base.min);
  const v = variant > 0 ? VARIANTS[kind]?.[variant - 1] : undefined;
  let hp = base.hp * (1 + 0.13 * over);
  let atk = base.atk * (1 + 0.09 * over);
  let def = base.def + Math.floor(over / 4);
  let ech = base.ech + over * 1.5;
  let xp = base.xp + over;
  if (v) { hp *= v.hp; atk *= v.atk; def += v.def ?? 0; ech *= v.ech; xp += 2; }
  if (wpn >= 0) { atk += Math.ceil(WEAPONS[wpn].atk * 0.6); xp += 2; ech += 2; }
  if (arm >= 0) { def += Math.ceil(ARMORS[arm].def * 0.5); xp += 2; ech += 2; }
  hp = Math.round(hp);
  return {
    kind: base.k, glyph: base.g, name: v ? `${v.prefix} ${base.name}` : base.name,
    hp, maxHp: hp, atk: Math.round(atk), def, xp, ech: Math.round(ech),
    erratic: v?.erratic ?? !!base.erratic, pierce: !!base.pierce, slow: !!base.slow, boss: !!base.boss,
    ranged: !!base.ranged, phase: !!base.phase, splits: !!base.splits,
    variant: v ? variant : 0, wpn, arm, gen: 0, alerted: false, disguised: false,
    tick: 0,
  };
}

function rollMon(kind: string, depth: number): MonStats {
  const base = baseFor(kind)!;
  const vs = VARIANTS[kind] ?? [];
  const variant = vs.length && Math.random() < Math.min(0.5, 0.12 + depth * 0.04) ? 1 + rnd(vs.length) : 0;
  const wpn = base.gear === "both" && Math.random() < Math.min(0.6, 0.15 + depth * 0.04)
    ? WEAPONS.indexOf(tierFor(depth, WEAPONS)) : -1;
  const arm = base.gear && Math.random() < Math.min(0.5, 0.1 + depth * 0.04)
    ? ARMORS.indexOf(tierFor(depth, ARMORS)) : -1;
  return makeMon(kind, depth, variant, wpn, arm)!;
}

/* ============================ items ============================ */

function rollItem(depth: number, bonus = 0): Omit<Item, "x" | "y"> {
  const roll = Math.random();
  const d = depth + bonus * 2;
  if (roll < 0.24) return { t: "tonic", name: "tonic" };
  if (roll < 0.40) return { t: "potion", name: "potion", color: rnd(POTION_COLORS.length) };
  if (roll < 0.50) return { t: "ember", name: "ember scroll" };
  if (roll < 0.58) return { t: "waystone", name: "waystone" };
  if (roll < 0.73) { const w = tierFor(d, WEAPONS); return { t: "weapon", name: w.name, atk: w.atk }; }
  if (roll < 0.86) { const a = tierFor(d, ARMORS); return { t: "armor", name: a.name, def: a.def }; }
  return { t: "echoes", name: "spill of echoes", amt: rint(4, 9) + depth * 2 + bonus * 6 };
}

export function potionLabel(g: Game, color: number) {
  const eff = g.potionMap[color];
  return g.known[eff] ? POTION_EFFECTS[eff].name : `${POTION_COLORS[color].name} potion`;
}

/* Put an item on (x, y), or the nearest free floor next to it. */
function dropNear(g: Game, x: number, y: number, it: Omit<Item, "x" | "y">, avoidPlayer = false): boolean {
  const spots = [[0, 0], ...shuffle(DIRS8.slice())];
  for (const [dx, dy] of spots) {
    const tx = x + dx, ty = y + dy;
    if (!inB(tx, ty) || g.grid[idx(tx, ty)] !== FLOOR) continue;
    if (avoidPlayer && tx === g.p.x && ty === g.p.y) continue;
    if (g.items.some(i => i.x === tx && i.y === ty)) continue;
    if (g.traps.some(t => t.x === tx && t.y === ty)) continue;
    g.items.push({ ...it, x: tx, y: ty });
    return true;
  }
  return false;
}

/* ============================ level population ============================ */

function populate(level: { grid: Uint8Array; rooms: Room[] }, depth: number) {
  const taken = new Set<number>();
  const mons: Mon[] = [], items: Item[] = [], traps: Trap[] = [];
  const { grid, rooms } = level;
  const start = ctr(rooms[0]);
  taken.add(idx(start.x, start.y));
  const anyRoom = () => rooms[rint(1, rooms.length - 1)];

  rooms.forEach((r, i) => {
    if (i === 0) return;
    const n = depth === 1 ? 1 : rint(1, depth < 5 ? 2 : 3);
    for (let j = 0; j < n; j++) {
      const pool = MONSTERS.filter(m => !m.noPool && depth >= m.min && depth <= (m.max ?? 99));
      const s = freeSpot(r, grid, taken);
      if (!s) continue;
      mons.push({ ...rollMon(pick(pool).k, depth), x: s.x, y: s.y, id: newId() });
    }
  });

  if (depth % 5 === 0) {
    const r = rooms[rooms.length - 1];
    const s = freeSpot(r, grid, taken) || ctr(r);
    mons.push({ ...makeMon("warden", depth)!, x: s.x, y: s.y, id: "boss" + depth });
  }

  const nItems = rint(3, 5);
  for (let i = 0; i < nItems; i++) {
    const s = freeSpot(anyRoom(), grid, taken);
    if (!s) continue;
    items.push({ ...rollItem(depth), x: s.x, y: s.y });
  }

  // a treasure chest on about half the floors; deeper down, some of them bite
  if (Math.random() < 0.45) {
    const s = freeSpot(anyRoom(), grid, taken);
    if (s) {
      if (depth >= 3 && Math.random() < 0.22) {
        mons.push({ ...makeMon("mimic", depth)!, disguised: true, x: s.x, y: s.y, id: newId() });
      } else {
        let locked = depth >= 2 && Math.random() < 0.35;
        if (locked) {
          const k = freeSpot(anyRoom(), grid, taken);
          if (k) items.push({ t: "key", name: "key", x: k.x, y: k.y }); else locked = false;
        }
        items.push({ t: "chest", name: locked ? "locked chest" : "chest", locked, x: s.x, y: s.y });
      }
    }
  }

  const nTraps = depth === 1 ? rint(0, 1) : Math.min(5, rint(1, 2 + Math.floor(depth / 3)));
  for (let i = 0; i < nTraps; i++) {
    const s = freeSpot(anyRoom(), grid, taken);
    if (!s) continue;
    const roll = Math.random();
    let t: TrapType = depth >= 2 && roll < 0.2 ? "pit" : depth >= 2 && roll < 0.4 ? "alarm" : "spikes";
    if (t === "pit" && depth % 5 === 0) t = "spikes"; // no skipping the warden
    traps.push({ t, x: s.x, y: s.y, found: false });
  }

  return { mons, items, traps, start };
}

/* ============================ sight & paths ============================ */

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

/* tiles strictly between two points, for drawing arrows */
function between(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const pts: Pt[] = [];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let g = 0; g < 60; g++) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) break;
    pts.push({ x, y });
  }
  return pts;
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
  const knownTrap = new Set(g.traps.filter(t => t.found).map(t => idx(t.x, t.y)));
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
      if (knownTrap.has(ni) && ni !== goal) continue;
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

const freshPotions = () => ({
  potions: POTION_COLORS.map(() => 0),
  potionMap: shuffle(POTION_EFFECTS.map((_, i) => i)),
  known: POTION_EFFECTS.map(() => false),
});

export function newRun(meta: Meta): Game {
  const b = playerBase(meta);
  const depth = 1;
  const lvl = genLevel(depth);
  const pop = populate(lvl, depth);
  const g: Game = {
    depth, grid: lvl.grid, rooms: lvl.rooms,
    mons: pop.mons, items: pop.items, traps: pop.traps,
    seen: new Uint8Array(MW * MH), vis: new Set(),
    p: { x: pop.start.x, y: pop.start.y },
    hp: b.maxHp, maxHp: b.maxHp, atk: b.atk, def: b.def, sight: b.sight,
    weapon: null, armor: null,
    inv: { tonic: b.tonics, ember: 0, waystone: 0, key: 0 },
    ...freshPotions(), hidden: 0,
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
  g.mons = pop.mons; g.items = pop.items; g.traps = pop.traps;
  g.seen = new Uint8Array(MW * MH);
  g.p = { x: pop.start.x, y: pop.start.y };
  g.path = null;
  g.inv.key = 0; // keys only open chests on their own floor
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

function hurtPlayer(g: Game, d: number) {
  g.hp -= d;
  if (g.hp <= 0) { g.hp = 0; g.dead = true; }
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
  say(g, `The ${m.name} falls.`);
  grantXp(g, m.xp);
  if (m.wpn >= 0 && Math.random() < 0.4) {
    const w = WEAPONS[m.wpn];
    if (dropNear(g, m.x, m.y, { t: "weapon", name: w.name, atk: w.atk })) say(g, `Its ${w.name} clatters to the floor.`);
  }
  if (m.arm >= 0 && Math.random() < 0.4) {
    const a = ARMORS[m.arm];
    if (dropNear(g, m.x, m.y, { t: "armor", name: a.name, def: a.def })) say(g, `Its ${a.name} could still be worn.`);
  }
  if (m.kind === "mimic") {
    for (let i = 0; i < 2; i++) dropNear(g, m.x, m.y, rollItem(g.depth, 1));
    say(g, "It coughs up what it swallowed.");
  }
}

function splitSlime(g: Game, m: Mon) {
  if (!m.splits || m.gen >= 2 || m.hp < 4) return;
  const spot = shuffle(DIRS8.slice()).map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy })).find(s =>
    inB(s.x, s.y) && g.grid[idx(s.x, s.y)] !== WALL && !(s.x === g.p.x && s.y === g.p.y)
    && !g.mons.some(o => o.x === s.x && o.y === s.y));
  if (!spot) return;
  const half = Math.floor(m.hp / 2);
  m.hp -= half;
  m.gen += 1;
  const child = makeMon(m.kind, g.depth, m.variant)!;
  child.hp = half; child.maxHp = half; child.gen = m.gen; child.alerted = true;
  child.xp = Math.ceil(child.xp / 2); child.ech = Math.ceil(child.ech / 2);
  g.mons.push({ ...child, x: spot.x, y: spot.y, id: newId() });
  say(g, `The ${m.name} splits in two!`);
}

export function playerAttack(g: Game, m: Mon, flash: Flash) {
  m.alerted = true;
  const d = dmgRoll(totalAtk(g), m.def);
  m.hp -= d;
  flash(idx(m.x, m.y), "hit");
  if (m.hp <= 0) killMon(g, m);
  else { say(g, `You hit the ${m.name} for ${d}.`); splitSlime(g, m); }
}

export function revealMimic(g: Game, m: Mon) {
  m.disguised = false;
  m.alerted = true;
  say(g, "The chest has teeth! It's a MIMIC!");
}

export function monsterTurn(g: Game, flash: Flash) {
  for (const m of [...g.mons]) {
    if (m.disguised) continue;
    if (m.slow) { m.tick = (m.tick + 1) % 2; if (m.tick === 1) continue; }
    const dist = cheb(m, g.p);
    const canSee = m.phase || los(g.grid, m.x, m.y, g.p.x, g.p.y);
    const aware = m.alerted || (g.hidden <= 0 && dist <= g.sight + 2 && canSee);

    if (dist === 1 && (g.hidden <= 0 || m.alerted)) {
      const d = dmgRoll(m.atk, m.pierce ? 0 : totalDef(g));
      say(g, `The ${m.name} hits you for ${d}.`);
      flash(idx(g.p.x, g.p.y), "hurt");
      hurtPlayer(g, d);
      if (g.dead) return;
      continue;
    }

    if (m.ranged && aware && dist >= 2 && dist <= 5 && los(g.grid, m.x, m.y, g.p.x, g.p.y)) {
      for (const pt of between(m.x, m.y, g.p.x, g.p.y)) flash(idx(pt.x, pt.y), "arrow");
      if (Math.random() < 0.25) { say(g, "An arrow whistles past your ear."); continue; }
      const d = dmgRoll(m.atk, totalDef(g));
      say(g, `The ${m.name}'s arrow hits you for ${d}.`);
      flash(idx(g.p.x, g.p.y), "hurt");
      hurtPlayer(g, d);
      if (g.dead) return;
      continue;
    }

    const passable = (tx: number, ty: number) => m.phase
      ? tx > 0 && ty > 0 && tx < MW - 1 && ty < MH - 1
      : inB(tx, ty) && g.grid[idx(tx, ty)] !== WALL;
    const free = (tx: number, ty: number) => passable(tx, ty) && !(tx === g.p.x && ty === g.p.y)
      && !g.mons.some(o => o !== m && o.x === tx && o.y === ty);

    let nx = m.x, ny = m.y;
    if (aware && !(m.erratic && Math.random() < 0.35)) {
      const dx = Math.sign(g.p.x - m.x), dy = Math.sign(g.p.y - m.y);
      const tries = Math.abs(g.p.x - m.x) > Math.abs(g.p.y - m.y)
        ? [[dx, 0], [0, dy], [dx, dy]] : [[0, dy], [dx, 0], [dx, dy]];
      for (const [ax, ay] of tries) {
        if (ax === 0 && ay === 0) continue;
        if (free(m.x + ax, m.y + ay)) { nx = m.x + ax; ny = m.y + ay; break; }
      }
    } else if (Math.random() < 0.4) {
      const [ax, ay] = pick([[0,1],[0,-1],[1,0],[-1,0]]);
      if (free(m.x + ax, m.y + ay)) { nx = m.x + ax; ny = m.y + ay; }
    }
    m.x = nx; m.y = ny;
  }
}

function spotTraps(g: Game) {
  for (const t of g.traps) {
    if (t.found || !g.vis.has(idx(t.x, t.y)) || cheb(t, g.p) > 2) continue;
    if (Math.random() < 0.25) { t.found = true; say(g, `You spot a ${TRAP_NAMES[t.t]}.`); }
  }
}

/* Everything that happens after the player acts. */
export function endTurn(g: Game, flash: Flash) {
  monsterTurn(g, flash);
  g.turns += 1;
  if (g.hidden > 0) { g.hidden -= 1; if (g.hidden === 0) say(g, "The shadow slips off you."); }
  g.vis = computeFov(g);
  if (!g.dead) spotTraps(g);
}

function triggerTrap(g: Game, flash?: Flash) {
  const t = g.traps.find(o => o.x === g.p.x && o.y === g.p.y);
  if (!t) return;
  t.found = true;
  g.path = null;
  if (t.t === "spikes") {
    const d = rint(3, 5) + g.depth;
    say(g, `Spikes jab up from the floor! -${d}.`);
    flash?.(idx(g.p.x, g.p.y), "hurt");
    hurtPlayer(g, d);
  } else if (t.t === "pit") {
    const d = rint(2, 4) + g.depth;
    hurtPlayer(g, d);
    if (g.dead) { say(g, "The floor gives way, and so do you."); return; }
    say(g, `The floor gives way! You fall. -${d}.`);
    descend(g);
  } else {
    for (const m of g.mons) if (!m.disguised) m.alerted = true;
    say(g, "CLANG! An alarm bell. Everything on this floor heard that.");
  }
}

function openChest(g: Game, chest: Item) {
  g.items = g.items.filter(i => i !== chest);
  const n = 2 + (Math.random() < 0.3 ? 1 : 0);
  for (let i = 0; i < n; i++) dropNear(g, chest.x, chest.y, rollItem(g.depth, 1), true);
  say(g, "The chest creaks open. Treasure spills out!");
}

/* Called whenever the player arrives on a tile. */
export function enterTile(g: Game, flash?: Flash) {
  const chest = g.items.find(i => i.t === "chest" && i.x === g.p.x && i.y === g.p.y);
  if (chest) {
    if (chest.locked) {
      if (g.inv.key <= 0) { say(g, "Locked. There must be a key somewhere on this floor."); return; }
      g.inv.key -= 1;
      say(g, "The key turns with a click.");
    }
    openChest(g, chest);
    return;
  }
  pickUp(g);
  triggerTrap(g, flash);
}

export function pickUp(g: Game) {
  const it = g.items.find(i => i.t !== "chest" && i.x === g.p.x && i.y === g.p.y);
  if (!it) return;
  g.items = g.items.filter(i => i !== it);
  if (it.t === "tonic" || it.t === "ember" || it.t === "waystone" || it.t === "key") {
    g.inv[it.t] += 1; say(g, `You pocket a ${it.name}.`);
  } else if (it.t === "potion") {
    const c = it.color ?? 0;
    g.potions[c] += 1; say(g, `You pocket a ${potionLabel(g, c)}.`);
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

/* ============================ using things ============================ */

export function drinkTonic(g: Game) {
  if (g.inv.tonic <= 0) return;
  g.inv.tonic -= 1;
  const heal = Math.round(g.maxHp * 0.45);
  g.hp = Math.min(g.maxHp, g.hp + heal);
  say(g, `The tonic burns going down. +${heal}.`);
}

export function drinkPotion(g: Game, color: number) {
  if (!g.potions[color]) return;
  g.potions[color] -= 1;
  const eff = g.potionMap[color];
  const wasKnown = g.known[eff];
  g.known[eff] = true;
  switch (POTION_EFFECTS[eff].k) {
    case "mending": {
      const heal = g.maxHp - g.hp;
      g.hp = g.maxHp;
      say(g, `Warmth floods back into you. +${heal}.`);
      break;
    }
    case "might":
      g.atk += 2;
      say(g, "Your arms feel like iron. +2 attack.");
      break;
    case "vigor":
      g.maxHp += 8; g.hp += 8;
      say(g, "Your heart beats stronger. +8 max health.");
      break;
    case "sight":
      for (let i = 0; i < MW * MH; i++) {
        if (g.grid[i] !== WALL) { g.seen[i] = 1; continue; }
        const x = i % MW, y = (i / MW) | 0;
        if (DIRS8.some(([dx, dy]) => inB(x + dx, y + dy) && g.grid[idx(x + dx, y + dy)] !== WALL)) g.seen[i] = 1;
      }
      for (const t of g.traps) t.found = true;
      say(g, "The whole floor unfolds in your mind, traps and all.");
      break;
    case "shadow":
      g.hidden = 12;
      for (const m of g.mons) m.alerted = false;
      say(g, "You fade into the dark. Nothing can see you.");
      break;
    case "foul": {
      const d = Math.min(g.hp - 1, Math.max(1, Math.round(g.maxHp * 0.2)));
      g.hp -= d;
      say(g, `Ugh! That was foul. -${d}.`);
      break;
    }
  }
  if (!wasKnown) say(g, `It was a ${POTION_EFFECTS[eff].name}.`);
}

export function burnEmber(g: Game, flash: Flash) {
  if (g.inv.ember <= 0) return;
  g.inv.ember -= 1;
  const targets = g.mons.filter(m => g.vis.has(idx(m.x, m.y)));
  if (!targets.length) { say(g, "The scroll flares at nothing."); return; }
  say(g, "Fire runs the room.");
  for (const m of targets) {
    if (m.disguised) revealMimic(g, m);
    m.alerted = true;
    const d = rint(9, 15) + g.depth;
    m.hp -= d;
    flash(idx(m.x, m.y), "hit");
    if (m.hp <= 0) killMon(g, m);
  }
}

export function castWaystone(g: Game, flash?: Flash) {
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
  enterTile(g, flash);
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

/* kind, x, y, hp, tick, then (v2+) variant, weapon, armor, split gen, flags */
type SavedMon = [string, number, number, number, number, number?, number?, number?, number?, number?];
type SavedItem = [ItemType, number, number, number, string];

/* Fields added after v1 are optional so older saves still load. */
export type SavedRun = {
  ver?: number;
  d: number; G: string; S: string;
  m: SavedMon[]; i: SavedItem[];
  p: [number, number];
  h: number[];
  w: [string, number] | null; a: [string, number] | null;
  v: number[]; x: number[]; e: number[];
  l?: string[];
  t?: [TrapType, number, number, number][];
  pt?: number[]; pm?: number[]; kn?: number[]; hd?: number;
};

const itemNum = (i: Item) =>
  i.t === "potion" ? i.color ?? 0 : i.t === "chest" ? (i.locked ? 1 : 0) : i.atk ?? i.def ?? i.amt ?? 0;

export function serializeRun(g: Game): SavedRun {
  return {
    ver: 2,
    d: g.depth,
    G: rle(Array.from(g.grid).join("")),
    S: rle(Array.from(g.seen).join("")),
    m: g.mons.map(m => [m.kind, m.x, m.y, m.hp, m.tick || 0, m.variant, m.wpn, m.arm, m.gen,
                        (m.alerted ? 1 : 0) | (m.disguised ? 2 : 0)]),
    i: g.items.map(i => [i.t, i.x, i.y, itemNum(i), i.name]),
    p: [g.p.x, g.p.y],
    h: [g.hp, g.maxHp, g.atk, g.def, g.sight],
    w: g.weapon ? [g.weapon.name, g.weapon.atk] : null,
    a: g.armor ? [g.armor.name, g.armor.def] : null,
    v: [g.inv.tonic, g.inv.ember, g.inv.waystone, g.inv.key],
    x: [g.level, g.xp, g.next],
    e: [g.echoes, g.greed, g.kills, g.turns],
    l: g.log.slice(-3),
    t: g.traps.map(t => [t.t, t.x, t.y, t.found ? 1 : 0]),
    pt: g.potions.slice(), pm: g.potionMap.slice(), kn: g.known.map(k => (k ? 1 : 0)), hd: g.hidden,
  };
}

export function deserializeRun(o: SavedRun): Game {
  const depth = o.d;
  const fresh = freshPotions();
  const g: Game = {
    depth,
    grid: Uint8Array.from(unrle(o.G).split("").map(Number)),
    seen: Uint8Array.from(unrle(o.S).split("").map(Number)),
    vis: new Set(),
    rooms: [],
    mons: o.m.flatMap(([k, x, y, hp, tick, variant, wpn, arm, gen, flags]) => {
      const b = makeMon(k, depth, variant ?? 0, wpn ?? -1, arm ?? -1);
      if (!b) return [];
      return [{ ...b, x, y, hp, tick, gen: gen ?? 0,
                alerted: !!((flags ?? 0) & 1), disguised: !!((flags ?? 0) & 2), id: newId() }];
    }),
    items: o.i.map(([t, x, y, n, name]) => {
      const it: Item = { t, x, y, name };
      if (t === "weapon") it.atk = n;
      else if (t === "armor") it.def = n;
      else if (t === "echoes") it.amt = n;
      else if (t === "potion") it.color = n;
      else if (t === "chest") it.locked = n === 1;
      return it;
    }),
    traps: (o.t ?? []).map(([t, x, y, f]) => ({ t, x, y, found: f === 1 })),
    p: { x: o.p[0], y: o.p[1] },
    hp: o.h[0], maxHp: o.h[1], atk: o.h[2], def: o.h[3], sight: o.h[4],
    weapon: o.w ? { name: o.w[0], atk: o.w[1] } : null,
    armor: o.a ? { name: o.a[0], def: o.a[1] } : null,
    inv: { tonic: o.v[0], ember: o.v[1], waystone: o.v[2], key: o.v[3] ?? 0 },
    potions: o.pt ?? fresh.potions,
    potionMap: o.pm ?? fresh.potionMap,
    known: o.kn ? o.kn.map(k => k === 1) : fresh.known,
    hidden: o.hd ?? 0,
    level: o.x[0], xp: o.x[1], next: o.x[2],
    echoes: o.e[0], greed: o.e[1], kills: o.e[2], turns: o.e[3],
    log: o.l?.length ? o.l : ["You come back to yourself in the dark."],
    dead: false, path: null,
  };
  if (g.grid.length !== MW * MH || g.seen.length !== MW * MH) throw new Error("save has the wrong map size");
  g.vis = computeFov(g);
  return g;
}
