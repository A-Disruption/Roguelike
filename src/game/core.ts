import { Rng, hashStr } from "./rng.ts";
import { RELICS, RELIC_IDS, TIER_NAMES, type RelicId } from "./relics.ts";
import { CLASS_IDS, classOf, type ClassId } from "./classes.ts";
import { zoneOf, zoneIndex, isBossFloor, bossFor } from "./zones.ts";
import { generateLevel, type Level } from "./mapgen.ts";
import {
  MW, MH, WALL, FLOOR, STAIRS, STAIRS_RISK, LAVA, isStairs, blocksMove, idx, inB, center,
  type Pt, type Room,
} from "./tiles.ts";
export {
  MW, MH, VW, VH, WALL, FLOOR, STAIRS, STAIRS_RISK, WATER, LAVA, CHASM, isStairs, blocksMove, idx, inB,
} from "./tiles.ts";
export type { Pt, Room } from "./tiles.ts";

/* ============================ constants ============================ */

/* Bump whenever a change would make old seeds/replays play out differently.
   Runs only compare (and ghosts only replay) between matching rules versions. */
export const RULES_VERSION = 4;


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

export type MonBase = {
  k: string; g: string; name: string; hp: number; atk: number; def: number; xp: number; ech: number;
  min: number; max?: number; erratic?: boolean; pierce?: boolean; slow?: boolean; boss?: boolean;
  ranged?: boolean;      // shoots arrows from a distance
  fast?: boolean;        // takes two steps when chasing
  explodes?: boolean;    // bursts into flame when it dies
  fireproof?: boolean;   // walks on lava
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
  /* zone monsters */
  { k:"spider",  g:"x", name:"cave spider", hp:10, atk:5,  def:0, xp:7,  ech:5,  min:6,  fast:true },
  { k:"drowned", g:"z", name:"drowned one", hp:30, atk:9,  def:1, xp:14, ech:11, min:11, slow:true },
  { k:"imp",     g:"i", name:"fire imp",    hp:14, atk:9,  def:1, xp:15, ech:12, min:16, erratic:true, explodes:true, fireproof:true },
  { k:"eye",     g:"e", name:"void eye",    hp:18, atk:12, def:0, xp:20, ech:16, min:21, ranged:true, pierce:true },
  /* bosses: one guards the last floor of each zone (see bossAct) */
  { k:"ratking",     g:"R", name:"Rat King",     hp:55,  atk:7,  def:1, xp:40,  ech:45,  min:5,  boss:true, noPool:true },
  { k:"broodmother", g:"B", name:"Broodmother",  hp:85,  atk:9,  def:1, xp:60,  ech:60,  min:10, boss:true, noPool:true },
  { k:"lich",        g:"L", name:"Bone Lich",    hp:100, atk:11, def:2, xp:80,  ech:75,  min:15, boss:true, noPool:true, ranged:true, pierce:true },
  { k:"golem",       g:"F", name:"Forge Golem",  hp:170, atk:15, def:4, xp:100, ech:90,  min:20, boss:true, noPool:true, slow:true, fireproof:true },
  { k:"maw",         g:"M", name:"Void Maw",     hp:200, atk:16, def:2, xp:130, ech:110, min:25, boss:true, noPool:true, slow:true },
];
const WARDEN: MonBase = { k:"warden", g:"W", name:"warden of the deep", hp:40, atk:11, def:2, xp:45, ech:55, min:5, boss:true };

/* Color variants: same monster, different skin/eyes and a little stronger. */
export type Variant = {
  prefix: string; pal: Record<string, string>;
  fullName?: string;     // replaces the whole name (zone wardens)
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
  /* one warden per zone, in zone order */
  warden: [
    { prefix:"", fullName:"Cellar Warden", pal:{}, hp:1, atk:1, ech:1 },
    { prefix:"", fullName:"Stone Warden",  pal:{ p:"#7A7F8C", d:"#4A4F5A", k:"#6FC4C8", m:"#22262E" }, hp:1, atk:1, ech:1 },
    { prefix:"", fullName:"Drowned Warden", pal:{ p:"#3F7F6E", d:"#24504A", k:"#BFF3F0", m:"#10302A" }, hp:1, atk:1, ech:1 },
    { prefix:"", fullName:"Forge Warden",  pal:{ p:"#B04A2A", d:"#6E2A18", k:"#F2D06B", m:"#2A0E08" }, hp:1, atk:1, ech:1 },
    { prefix:"", fullName:"Void Warden",   pal:{ p:"#3A2A5A", d:"#1E1430", k:"#E07A9A", m:"#0A0612" }, hp:1, atk:1, ech:1 },
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

/* each level costs a bit more than the last (rounded to 5s) */
const upCosts = (base: number, growth: number, n: number) =>
  Array.from({ length: n }, (_, i) => Math.round(base * growth ** i / 5) * 5);

/* Echo upgrades only apply to free runs; daily runs always start from scratch. */
export const UPGRADES = [
  { k:"vigor",   name:"Vigor",   blurb:"+7 health",          max:20, costs: upCosts(20, 1.17, 20) },
  { k:"edge",    name:"Edge",    blurb:"+1 attack",          max:15, costs: upCosts(30, 1.2, 15) },
  { k:"hide",    name:"Hide",    blurb:"+1 armor",           max:10, costs: upCosts(45, 1.25, 10) },
  { k:"lantern", name:"Lantern", blurb:"+1 tile of sight",   max:4,  costs: upCosts(60, 1.7, 4) },
  { k:"satchel", name:"Satchel", blurb:"start with a tonic", max:6,  costs: upCosts(25, 1.4, 6) },
  { k:"greed",   name:"Greed",   blurb:"+20% echoes",        max:10, costs: upCosts(40, 1.3, 10) },
];
export type Upgrade = typeof UPGRADES[number];

/* ============================ types ============================ */

export type FlashKind = "hit" | "hurt" | "arrow";
export type Flash = (i: number, kind: FlashKind) => void;

export type Mon = {
  kind: string; glyph: string; name: string;
  hp: number; maxHp: number; atk: number; def: number; xp: number; ech: number;
  erratic: boolean; pierce: boolean; slow: boolean; boss: boolean;
  fast: boolean; explodes: boolean; fireproof: boolean;
  ranged: boolean; phase: boolean; splits: boolean;
  variant: number;   // 0 = normal, n = VARIANTS[kind][n - 1]
  wpn: number;       // index into WEAPONS, -1 for none
  arm: number;       // index into ARMORS, -1 for none
  gen: number;       // how many times a slime has split
  alerted: boolean;  // knows where you are no matter what
  disguised: boolean;// a mimic still pretending to be a chest
  cd: number;        // bosses: turns since their last special attack
  charge: number;    // bosses: a telegraphed attack about to land (1 slam, 2 beam)
  tick: number; x: number; y: number;
};

/* what you've met and found, for the bestiary and achievements */
export type Dex = { seen: Record<string, number>; kills: Record<string, number>; relics: Record<string, number> };
export const freshDex = (): Dex => ({ seen: {}, kills: {}, relics: {} });

export type Pocket = "tonic" | "ember" | "waystone" | "key";
export type ItemType = Pocket | "weapon" | "armor" | "echoes" | "potion" | "chest" | "relic";
export type Item = {
  t: ItemType; name: string; x: number; y: number;
  atk?: number; def?: number; amt?: number; color?: number; locked?: boolean;
  seed?: number;                 // chests: what's inside is decided when the floor is made
  relic?: RelicId; tier?: number;
};

export type TrapType = keyof typeof TRAP_NAMES;
export type Trap = { t: TrapType; x: number; y: number; found: boolean };
export type Hazard = { x: number; y: number; dmg: number; turns: number }; // lava; only burns monsters

export type RunMode = "free" | "daily";

/* The hero's stats at the start of a run. Daily runs always use the base hero
   so everyone competes on equal footing; free runs include echo upgrades. */
export type StartStats = {
  cls: ClassId;
  maxHp: number; atk: number; def: number; sight: number; tonics: number; greed: number;
  embers: number; waystones: number; weapon: number;       // weapon: index into WEAPONS, -1 for none
  relics: Partial<Record<RelicId, number>>;               // relic powers the hero starts with
};

export type Game = {
  /* identity: with these and `actions`, the whole run can be replayed */
  id: string;          // unique run id (from the game service; a server would issue it)
  mode: RunMode; day: string | null; seed: number; start: StartStats;
  startedAt: number; ranked: boolean;
  actions: string[]; replayable: boolean;
  rng: Rng;            // the run's own random stream (combat, drops, potions…)
  floorKey: string;    // depth + which stair you took, e.g. "4r"; floors with the same key look the same for everyone

  depth: number; grid: Uint8Array;
  mons: Mon[]; items: Item[]; traps: Trap[]; hazards: Hazard[];
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
  relics: Partial<Record<RelicId, number>>; // relic -> tier
  killsSinceEmber: number;
  perils: number;        // perilous stairs taken
  wardens: number;       // bosses slain this run (for unlocks)
  chests: number;        // chests opened this run (for unlocks)
  webbed: number;        // turns left stuck in a web
  marks: [number, number][]; // tiles a boss is about to hit (shown in red)
  dex: Dex;
  level: number; xp: number; next: number;
  echoes: number; greed: number; kills: number; turns: number;
  log: string[];
  dead: boolean; path: Pt[] | null;
};

export type Meta = {
  echoes: number; best: number; runs: number; kills: number; up: Record<string, number>;
  wardens: number; chests: number;  // lifetime counters that unlock heroes (wardens = bosses slain)
  cls: ClassId;                     // hero picked for the next free run
  dex: Dex;                         // lifetime bestiary
  ach: string[];                    // achievements earned
  maxPerils: number; dailies: number; maxEarned: number;
};

/* ============================ helpers ============================ */

export const cheb = (a: Pt, b: Pt) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/* the 8 step directions; a move action stores the index into this list */
export const DIRS8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const;

export const relicVal = (g: Game, id: RelicId) => {
  const t = g.relics[id];
  return t ? RELICS[id].values[t - 1] : 0;
};
export const sightOf = (g: Pick<Game, "sight" | "relics" | "depth">) => {
  const t = g.relics.lantern;
  return Math.max(2, g.sight + (t ? RELICS.lantern.values[t - 1] : 0) + zoneOf(g.depth).sight);
};
export const reachOf = (g: Game) => 1 + relicVal(g, "reach");

export function scoreOf(g: Game) {
  return g.depth * 100 + g.kills * 10 + g.echoes + g.perils * 50;
}

const ctr = center;

function freeSpot(room: Room, grid: Uint8Array, taken: Set<number>, r: Rng): Pt | null {
  for (let t = 0; t < 40; t++) {
    const x = r.range(room.x, room.x + room.w - 1), y = r.range(room.y, room.y + room.h - 1);
    if (grid[idx(x, y)] !== FLOOR) continue;
    if (taken.has(idx(x, y))) continue;
    taken.add(idx(x, y));
    return { x, y };
  }
  return null;
}

function tierFor<T>(depth: number, list: T[], r: Rng): T {
  const t = Math.min(list.length - 1, Math.floor((depth - 1) / 2.5) + (r.chance(0.25) ? 1 : 0));
  return list[Math.max(0, Math.min(list.length - 1, t))];
}

/* ============================ monsters ============================ */

const baseFor = (kind: string) => kind === "warden" ? WARDEN : MONSTERS.find(m => m.k === kind);
export const monsterBase = baseFor;
/* every kind the bestiary lists (the old warden only exists in pre-1.5 saves) */
export const MONSTER_KINDS = MONSTERS.filter(m => !m.boss).map(m => m.k);
export const BOSS_KINDS = MONSTERS.filter(m => m.boss).map(m => m.k);

/* Builds a monster's stats from its kind, depth, color variant, gear and split
   generation. Saves only store those, so this must give the same answer every time. */
function makeMon(kind: string, depth: number, variant = 0, wpn = -1, arm = -1, gen = 0): Omit<Mon, "x" | "y"> | null {
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
  // every split halves what a slime is worth, so farming splits doesn't pay
  for (let i = 0; i < gen; i++) { xp = Math.ceil(xp / 2); ech = Math.ceil(ech / 2); }
  hp = Math.round(hp);
  return {
    kind: base.k, glyph: base.g, name: v ? v.fullName ?? `${v.prefix} ${base.name}` : base.name,
    hp, maxHp: hp, atk: Math.round(atk), def, xp, ech: Math.round(ech),
    erratic: v?.erratic ?? !!base.erratic, pierce: !!base.pierce, slow: !!base.slow, boss: !!base.boss,
    ranged: !!base.ranged, phase: !!base.phase, splits: !!base.splits,
    fast: !!base.fast, explodes: !!base.explodes, fireproof: !!base.fireproof,
    variant: v ? variant : 0, wpn, arm, gen, alerted: false, disguised: false,
    cd: 0, charge: 0, tick: 0,
  };
}

function rollMon(kind: string, depth: number, r: Rng) {
  const base = baseFor(kind)!;
  const vs = VARIANTS[kind] ?? [];
  const variant = vs.length && r.chance(Math.min(0.5, 0.12 + depth * 0.04)) ? 1 + r.int(vs.length) : 0;
  const wpn = base.gear === "both" && r.chance(Math.min(0.6, 0.15 + depth * 0.04))
    ? WEAPONS.indexOf(tierFor(depth, WEAPONS, r)) : -1;
  const arm = base.gear && r.chance(Math.min(0.5, 0.1 + depth * 0.04))
    ? ARMORS.indexOf(tierFor(depth, ARMORS, r)) : -1;
  return makeMon(kind, depth, variant, wpn, arm)!;
}

/* perilous floors scale their monsters as if they were two floors deeper */
const monDepth = (depth: number, floorKey: string) => depth + (floorKey.endsWith("r") ? 2 : 0);

/* ============================ items ============================ */

function rollRelic(r: Rng, depth: number, bonus = 0): Omit<Item, "x" | "y"> {
  const id = r.pick(RELIC_IDS);
  const p3 = Math.min(0.5, 0.02 + depth * 0.025 + bonus * 0.15);
  const p2 = Math.min(0.6, 0.15 + depth * 0.04 + bonus * 0.15);
  const x = r.next();
  const tier = x < p3 ? 3 : x < p3 + p2 ? 2 : 1;
  return { t: "relic", name: RELICS[id].name, relic: id, tier };
}

function rollItem(r: Rng, depth: number, bonus = 0): Omit<Item, "x" | "y"> {
  const roll = r.next();
  const d = depth + bonus * 2;
  if (roll < 0.03) return rollRelic(r, depth, bonus);
  if (roll < 0.25) return { t: "tonic", name: "tonic" };
  if (roll < 0.40) return { t: "potion", name: "potion", color: r.int(POTION_COLORS.length) };
  if (roll < 0.50) return { t: "ember", name: "ember scroll" };
  if (roll < 0.58) return { t: "waystone", name: "waystone" };
  if (roll < 0.73) { const w = tierFor(d, WEAPONS, r); return { t: "weapon", name: w.name, atk: w.atk }; }
  if (roll < 0.86) { const a = tierFor(d, ARMORS, r); return { t: "armor", name: a.name, def: a.def }; }
  return { t: "echoes", name: "spill of echoes", amt: r.range(4, 9) + depth * 2 + bonus * 6 };
}

export function potionLabel(g: Game, color: number) {
  const eff = g.potionMap[color];
  return g.known[eff] ? POTION_EFFECTS[eff].name : `${POTION_COLORS[color].name} potion`;
}

export const relicLabel = (id: RelicId, tier: number) => `${RELICS[id].name} ${TIER_NAMES[tier]}`;
export const relicBlurb = (id: RelicId, tier: number) => RELICS[id].blurb(RELICS[id].values[tier - 1], tier);

/* Put an item on (x, y), or the nearest free floor next to it. */
function dropNear(g: Game, x: number, y: number, it: Omit<Item, "x" | "y">, r: Rng, avoidPlayer = false): boolean {
  const spots = [[0, 0], ...r.shuffle(DIRS8.map(d => [d[0], d[1]]))];
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

function populate(level: Level, depth: number, floorKey: string, r: Rng) {
  const risky = floorKey.endsWith("r");
  const mDepth = monDepth(depth, floorKey);
  const taken = new Set<number>();
  const mons: Mon[] = [], items: Item[] = [], traps: Trap[] = [];
  const { grid, areas: rooms, start } = level;
  taken.add(idx(start.x, start.y));
  const anyRoom = () => rooms[r.range(1, rooms.length - 1)];

  rooms.forEach((rm, i) => {
    if (i === 0) return;
    const big = rm.w * rm.h >= 60 ? 1 : 0;
    const n = (depth === 1 ? 1 : r.range(1, depth < 5 ? 2 : 3)) + (risky ? 1 : 0) + big;
    for (let j = 0; j < n; j++) {
      const pool = zoneOf(depth).pool.filter(([, from]) => depth >= from).map(([k]) => k);
      const s = freeSpot(rm, grid, taken, r);
      if (!s) continue;
      mons.push({ ...rollMon(r.pick(pool), mDepth, r), x: s.x, y: s.y });
    }
  });

  if (isBossFloor(depth)) {
    // the boss waits in its arena, beside the stairs, and clears the room of lesser monsters
    const rm = rooms[level.stairsArea];
    for (let i = mons.length - 1; i >= 0; i--) {
      const m = mons[i];
      if (m.x >= rm.x && m.x < rm.x + rm.w && m.y >= rm.y && m.y < rm.y + rm.h) mons.splice(i, 1);
    }
    const s = freeSpot(rm, grid, taken, r) || ctr(rm);
    mons.push({ ...makeMon(bossFor(depth), mDepth)!, x: s.x, y: s.y });
  }

  const nItems = r.range(3, 5) + (risky ? 2 : 0);
  for (let i = 0; i < nItems; i++) {
    const s = freeSpot(anyRoom(), grid, taken, r);
    if (!s) continue;
    items.push({ ...rollItem(r, depth, risky ? 1 : 0), x: s.x, y: s.y });
  }

  // perilous floors usually hide a relic out in the open
  if (r.chance(risky ? 0.6 : 0.05)) {
    const s = freeSpot(anyRoom(), grid, taken, r);
    if (s) items.push({ ...rollRelic(r, depth, risky ? 1 : 0), x: s.x, y: s.y });
  }

  // a treasure chest on about half the floors; deeper down, some of them bite
  if (r.chance(risky ? 0.85 : 0.45)) {
    const s = freeSpot(anyRoom(), grid, taken, r);
    if (s) {
      if (depth >= 3 && r.chance(0.22)) {
        mons.push({ ...makeMon("mimic", mDepth)!, disguised: true, x: s.x, y: s.y });
      } else {
        let locked = depth >= 2 && r.chance(0.35);
        if (locked) {
          const k = freeSpot(anyRoom(), grid, taken, r);
          if (k) items.push({ t: "key", name: "key", x: k.x, y: k.y }); else locked = false;
        }
        items.push({ t: "chest", name: locked ? "locked chest" : "chest", locked, seed: r.u32(), x: s.x, y: s.y });
      }
    }
  }

  const nTraps = depth === 1 ? r.range(0, 1) : Math.min(5, r.range(1, 2 + Math.floor(depth / 3)) + (risky ? 1 : 0));
  for (let i = 0; i < nTraps; i++) {
    const s = freeSpot(anyRoom(), grid, taken, r);
    if (!s) continue;
    const roll = r.next();
    let t: TrapType = depth >= 2 && roll < 0.2 ? "pit" : depth >= 2 && roll < 0.4 ? "alarm" : "spikes";
    if (t === "pit" && isBossFloor(depth)) t = "spikes"; // no skipping the warden
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

/* Integer-only distance checks: Math.hypot can differ between browsers, which
   would break replays recorded on one device and checked on another. */
export function computeFov(g: Pick<Game, "sight" | "relics" | "depth" | "p" | "grid" | "seen">) {
  const R = sightOf(g);
  const lim = (R + 0.3) * (R + 0.3);
  const vis = new Set<number>();
  for (let y = g.p.y - R; y <= g.p.y + R; y++) {
    for (let x = g.p.x - R; x <= g.p.x + R; x++) {
      if (!inB(x, y)) continue;
      const dx = x - g.p.x, dy = y - g.p.y;
      if (dx * dx + dy * dy > lim) continue;
      if (los(g.grid, g.p.x, g.p.y, x, y)) { vis.add(idx(x, y)); g.seen[idx(x, y)] = 1; }
    }
  }
  return vis;
}

export function bfsPath(g: Game, tx: number, ty: number): Pt[] | null {
  const start = idx(g.p.x, g.p.y), goal = idx(tx, ty);
  if (start === goal) return null;
  if (!g.seen[goal] || blocksMove(g.grid[goal])) return null;
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
      if (!g.seen[ni] || blocksMove(g.grid[ni])) continue;
      if (g.grid[ni] === LAVA && ni !== goal) continue;
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

/* ============================ starting a run ============================ */

export const freshMeta = (): Meta => ({
  echoes: 0, best: 0, runs: 0, kills: 0, up: {}, wardens: 0, chests: 0, cls: "wanderer",
  dex: freshDex(), ach: [], maxPerils: 0, dailies: 0, maxEarned: 0,
});

/* fold a run's bestiary into another (lifetime) one */
export function mergeDex(into: Dex, from: Dex): Dex {
  const out: Dex = { seen: { ...into.seen, ...from.seen }, kills: { ...into.kills }, relics: { ...into.relics } };
  for (const [k, n] of Object.entries(from.kills)) out.kills[k] = (out.kills[k] ?? 0) + n;
  for (const [k, t] of Object.entries(from.relics)) out.relics[k] = Math.max(out.relics[k] ?? 0, t);
  return out;
}

/* the hero's opening stats: the class, plus echo upgrades (daily runs pass a fresh Meta, so no upgrades) */
export function startStats(meta: Meta, cls: ClassId): StartStats {
  const u = meta.up || {};
  const c = classOf(cls);
  return {
    cls,
    maxHp: c.hp + 7 * (u.vigor || 0),
    atk: c.atk + (u.edge || 0),
    def: c.def + (u.hide || 0),
    sight: c.sight + (u.lantern || 0),
    tonics: c.tonics + (u.satchel || 0),
    greed: 1 + 0.2 * (u.greed || 0),
    embers: c.embers, waystones: c.waystones, weapon: c.weapon,
    relics: { ...c.relics },
  };
}

/* older saves and records didn't store a class or kit */
export const normalizeStart = (st: Partial<StartStats> & Pick<StartStats, "maxHp" | "atk" | "def" | "sight" | "tonics" | "greed">): StartStats => ({
  // same key order as startStats(), so saved records stay byte-for-byte stable
  cls: st.cls ?? "wanderer",
  maxHp: st.maxHp, atk: st.atk, def: st.def, sight: st.sight, tonics: st.tonics, greed: st.greed,
  embers: st.embers ?? 0, waystones: st.waystones ?? 0, weapon: st.weapon ?? -1,
  relics: { ...(st.relics ?? {}) },
});

/* everyone gets the same hero in the daily, picked by the day's seed */
export const dailyClass = (day: string): ClassId => CLASS_IDS[hashStr(`hero:${day}`) % CLASS_IDS.length];

/* the daily seed: the same for everyone on the same UTC day and rules version */
export const dailySeed = (day: string) => hashStr(`daily:${day}:rules${RULES_VERSION}`);

const floorRng = (seed: number, floorKey: string) => new Rng(hashStr(`${seed}:floor:${floorKey}`));

export type RunSetup = {
  id?: string;
  mode: RunMode; seed: number; day: string | null; start: StartStats; ranked: boolean; startedAt: number;
};

/* runs from before ids were stored got one derived from their seed and start time */
export const legacyRunId = (mode: RunMode, seed: number, startedAt: number) => `${mode}-${seed.toString(36)}-${startedAt.toString(36)}`;

export function newRun(s: RunSetup): Game {
  const floorKey = "1s";
  const fr = floorRng(s.seed, floorKey);
  const lvl = generateLevel(fr, 1);
  const pop = populate(lvl, 1, floorKey, fr);
  const pr = new Rng(hashStr(`${s.seed}:potions`));
  const g: Game = {
    id: s.id ?? legacyRunId(s.mode, s.seed, s.startedAt),
    mode: s.mode, day: s.day, seed: s.seed, start: s.start, startedAt: s.startedAt, ranked: s.ranked,
    actions: [], replayable: true,
    rng: new Rng(hashStr(`${s.seed}:run`)),
    floorKey,
    depth: 1, grid: lvl.grid,
    mons: pop.mons, items: pop.items, traps: pop.traps, hazards: [],
    seen: new Uint8Array(MW * MH), vis: new Set(),
    p: { x: pop.start.x, y: pop.start.y },
    hp: s.start.maxHp, maxHp: s.start.maxHp, atk: s.start.atk, def: s.start.def, sight: s.start.sight,
    weapon: s.start.weapon >= 0 ? { ...WEAPONS[s.start.weapon] } : null, armor: null,
    inv: { tonic: s.start.tonics, ember: s.start.embers, waystone: s.start.waystones, key: 0 },
    potions: POTION_COLORS.map(() => 0),
    potionMap: pr.shuffle(POTION_EFFECTS.map((_, i) => i)),
    known: POTION_EFFECTS.map(() => false),
    hidden: 0, relics: { ...s.start.relics }, killsSinceEmber: 0, perils: 0, wardens: 0, chests: 0,
    webbed: 0, marks: [], dex: freshDex(),
    level: 1, xp: 0, next: 12,
    echoes: 0, greed: s.start.greed, kills: 0, turns: 0,
    log: [s.mode === "daily"
      ? `The daily dungeon for ${s.day}. Everyone walks these same halls today.`
      : "You wake at the mouth of the depths. Something below is still burning."],
    dead: false, path: null,
  };
  const knows = classOf(s.start.cls).knowsPotion;
  if (knows) g.known[POTION_EFFECTS.findIndex(e => e.k === knows)] = true;
  g.vis = computeFov(g);
  return g;
}

export function descend(g: Game, choice: "s" | "r") {
  g.depth += 1;
  g.floorKey = `${g.depth}${choice}`;
  const fr = floorRng(g.seed, g.floorKey);
  const lvl = generateLevel(fr, g.depth);
  const pop = populate(lvl, g.depth, g.floorKey, fr);
  g.grid = lvl.grid;
  g.mons = pop.mons; g.items = pop.items; g.traps = pop.traps; g.hazards = []; g.marks = []; g.webbed = 0;
  g.seen = new Uint8Array(MW * MH);
  g.p = { x: pop.start.x, y: pop.start.y };
  g.path = null;
  g.inv.key = 0; // keys only open chests on their own floor
  const rest = Math.round(g.maxHp * 0.12);
  const before = g.hp;
  g.hp = Math.min(g.maxHp, g.hp + rest);
  g.vis = computeFov(g);
  if (choice === "r") {
    g.perils += 1;
    say(g, `Depth ${g.depth}, the perilous way. More monsters, better treasure.`);
  } else {
    say(g, `Depth ${g.depth}. The air gets colder.`);
  }
  if (g.hp > before) say(g, `You catch your breath on the stair. +${g.hp - before}.`);
  // a new zone gets the last word, so it's the line you read
  if (zoneIndex(g.depth) !== zoneIndex(g.depth - 1)) {
    const z = zoneOf(g.depth);
    say(g, `${z.name}. ${z.intro}`);
  }
  if (isBossFloor(g.depth)) say(g, "Something enormous is waiting near the stairs.");
}

export function say(g: Game, s: string) { g.log.push(s); if (g.log.length > 24) g.log.shift(); }

export function totalAtk(g: Game) { return g.atk + (g.weapon ? g.weapon.atk : 0); }
export function totalDef(g: Game) { return g.def + (g.armor ? g.armor.def : 0); }

function dmgRoll(r: Rng, atk: number, def: number) {
  return Math.max(1, Math.round((atk - def) * (0.82 + r.next() * 0.36)));
}

function hurtPlayer(g: Game, d: number) {
  g.hp -= d;
  if (g.hp > 0) return;
  const phoenix = relicVal(g, "phoenix");
  if (phoenix) {
    g.hp = Math.max(1, Math.round(g.maxHp * phoenix / 100));
    delete g.relics.phoenix;
    say(g, "The Phoenix Feather bursts into flame. You rise again!");
    return;
  }
  g.hp = 0;
  g.dead = true;
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
  if (!g.mons.includes(m)) return;
  g.mons = g.mons.filter(o => o !== m);
  g.kills += 1;
  g.dex.kills[m.kind] = (g.dex.kills[m.kind] ?? 0) + 1;
  const coin = relicVal(g, "coin");
  g.echoes += m.ech + Math.round(m.ech * coin / 100);
  say(g, `The ${m.name} falls.`);
  grantXp(g, m.xp);

  const fang = relicVal(g, "fang");
  if (fang && g.hp < g.maxHp) {
    const heal = Math.min(fang, g.maxHp - g.hp);
    g.hp += heal;
    say(g, `The Fang drinks deep. +${heal}.`);
  }
  const kindling = relicVal(g, "kindling");
  if (kindling && ++g.killsSinceEmber >= kindling) {
    g.killsSinceEmber = 0;
    g.inv.ember += 1;
    say(g, "Your Kindling Pouch smolders. +1 ember scroll.");
  }

  if (m.wpn >= 0 && g.rng.chance(0.4)) {
    const w = WEAPONS[m.wpn];
    if (dropNear(g, m.x, m.y, { t: "weapon", name: w.name, atk: w.atk }, g.rng)) say(g, `Its ${w.name} clatters to the floor.`);
  }
  if (m.arm >= 0 && g.rng.chance(0.4)) {
    const a = ARMORS[m.arm];
    if (dropNear(g, m.x, m.y, { t: "armor", name: a.name, def: a.def }, g.rng)) say(g, `Its ${a.name} could still be worn.`);
  }
  if (m.kind === "mimic") {
    for (let i = 0; i < 2; i++) dropNear(g, m.x, m.y, rollItem(g.rng, g.depth, 1), g.rng);
    say(g, "It coughs up what it swallowed.");
  }
  if (m.explodes) {
    say(g, `The ${m.name} bursts in a gout of flame!`);
    if (cheb(m, g.p) <= 1) {
      const d = 4 + Math.floor(g.depth / 4);
      say(g, `The blast scorches you. -${d}.`);
      hurtPlayer(g, d);
    }
  }
  if (m.kind === "mimic") g.chests += 1;
  if (m.boss) {
    g.wardens += 1;
    dropNear(g, m.x, m.y, rollRelic(g.rng, g.depth, 2), g.rng);
    say(g, "Something precious glints where the warden fell.");
  }
}

function splitSlime(g: Game, m: Mon) {
  if (!m.splits || m.gen >= 2 || m.hp < 4) return;
  const spot = g.rng.shuffle(DIRS8.map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy }))).find(s =>
    inB(s.x, s.y) && !blocksMove(g.grid[idx(s.x, s.y)]) && g.grid[idx(s.x, s.y)] !== LAVA && !(s.x === g.p.x && s.y === g.p.y)
    && !g.mons.some(o => o.x === s.x && o.y === s.y));
  if (!spot) return;
  const half = Math.floor(m.hp / 2);
  const gen = m.gen + 1;
  const parent = makeMon(m.kind, monDepth(g.depth, g.floorKey), m.variant, -1, -1, gen)!;
  m.hp -= half; m.gen = gen; m.xp = parent.xp; m.ech = parent.ech;
  g.mons.push({ ...parent, hp: half, maxHp: half, alerted: true, x: spot.x, y: spot.y });
  say(g, `The ${m.name} splits in two!`);
}

function strike(g: Game, m: Mon, flash: Flash, verb: string) {
  const d = dmgRoll(g.rng, totalAtk(g), m.def);
  m.hp -= d;
  flash(idx(m.x, m.y), "hit");
  if (m.hp <= 0) { killMon(g, m); return false; }
  say(g, `${verb} the ${m.name} for ${d}.`);
  return true;
}

export function playerAttack(g: Game, m: Mon, flash: Flash, ranged = false) {
  m.alerted = true;
  const verb = !ranged ? "You hit" : g.start.cls === "ranger" ? "Your arrow hits" : "You strike";
  if (!strike(g, m, flash, verb)) return;
  const twin = relicVal(g, "twin");
  if (twin && g.rng.chance(twin / 100)) {
    say(g, "Quicksilver! You strike again.");
    if (!strike(g, m, flash, verb)) return;
  }
  splitSlime(g, m);
}

export function revealMimic(g: Game, m: Mon) {
  m.disguised = false;
  m.alerted = true;
  say(g, "The chest has teeth! It's a MIMIC!");
}

/* the player was hit by m: thorns bite back, magma erupts underneath it */
function onPlayerHit(g: Game, m: Mon, melee: boolean, flash: Flash) {
  const magma = g.relics.magma;
  if (magma) {
    const dmg = RELICS.magma.values[magma - 1];
    const turns = magma + 1;
    const h = g.hazards.find(o => o.x === m.x && o.y === m.y);
    if (h) { h.turns = Math.max(h.turns, turns); h.dmg = Math.max(h.dmg, dmg); }
    else g.hazards.push({ x: m.x, y: m.y, dmg, turns });
  }
  const thorns = relicVal(g, "thorns");
  if (thorns && melee) {
    m.hp -= thorns;
    flash(idx(m.x, m.y), "hit");
    if (m.hp <= 0) killMon(g, m);
  }
}

/* open tiles around a point, in random order (for summons) */
function freeAround(g: Game, c: Pt): Pt[] {
  const out: Pt[] = [];
  for (const [dx, dy] of DIRS8) {
    const x = c.x + dx, y = c.y + dy;
    if (!inB(x, y)) continue;
    const v = g.grid[idx(x, y)];
    if (blocksMove(v) || v === LAVA || (x === g.p.x && y === g.p.y) || g.mons.some(o => o.x === x && o.y === y)) continue;
    out.push({ x, y });
  }
  return g.rng.shuffle(out);
}

/* summoned helpers are worth half (gen 1), so bosses can't be farmed */
function summon(g: Game, boss: Mon, kind: string, n: number) {
  let made = 0;
  for (const s of freeAround(g, boss)) {
    if (made >= n || g.mons.length >= 14) break;
    g.mons.push({ ...makeMon(kind, monDepth(g.depth, g.floorKey), 0, -1, -1, 1)!, alerted: true, x: s.x, y: s.y });
    made++;
  }
  return made;
}

/* the line a beam travels: the player's row or column, out to the walls */
function beamLine(g: Game, from: Pt): [number, number][] {
  const horiz = Math.abs(g.p.x - from.x) >= Math.abs(g.p.y - from.y);
  const out: [number, number][] = [];
  for (const dir of [-1, 1]) {
    for (let k = dir === -1 ? 0 : 1; k < 31; k++) {
      const x = horiz ? g.p.x + dir * k : g.p.x, y = horiz ? g.p.y : g.p.y + dir * k;
      if (!inB(x, y) || g.grid[idx(x, y)] === WALL) break;
      out.push([x, y]);
    }
  }
  return out;
}

/* A boss's special moves. Returns true if it used its turn. Big hits are
   telegraphed: the tiles turn red one turn ahead so you can step out. */
function bossAct(g: Game, m: Mon, aware: boolean, dist: number, flash: Flash): boolean {
  if (m.charge) {
    const kind = m.charge;
    const marks = g.marks;
    m.charge = 0; m.cd = 0; g.marks = [];
    for (const [x, y] of marks) flash(idx(x, y), "hit");
    say(g, kind === 1 ? `The ${m.name} SLAMS the ground!` : `The ${m.name}'s beam sears the line!`);
    if (marks.some(([x, y]) => x === g.p.x && y === g.p.y)) {
      const d = Math.round(m.atk * (kind === 1 ? 1.7 : 1.5));
      say(g, `It catches you. -${d}.`);
      flash(idx(g.p.x, g.p.y), "hurt");
      hurtPlayer(g, d);
    } else {
      say(g, "You got clear just in time.");
    }
    return true;
  }
  if (!aware) return false;
  m.alerted = true;
  m.cd += 1;
  const sees = los(g.grid, m.x, m.y, g.p.x, g.p.y);
  switch (m.kind) {
    case "ratking":
      if (m.cd >= 3) {
        m.cd = 0;
        if (summon(g, m, "rat", 2)) { say(g, "The Rat King squeals! Rats pour out of the walls."); return true; }
      }
      return false;
    case "broodmother":
      if (m.cd >= 4) {
        m.cd = 0;
        if (g.webbed <= 0 && dist >= 2 && dist <= 5 && sees) {
          for (const pt of between(m.x, m.y, g.p.x, g.p.y)) flash(idx(pt.x, pt.y), "arrow");
          g.webbed = 3;
          say(g, "The Broodmother spits a web! You're stuck for a moment.");
          return true;
        }
        if (summon(g, m, "spider", 2)) { say(g, "Spiderlings burst from the Broodmother's sac!"); return true; }
      }
      return false;
    case "lich":
      if (dist === 1 && g.rng.chance(0.3)) {
        const spots: number[] = [];
        for (let i = 0; i < g.grid.length; i++) {
          const x = i % MW, y = (i / MW) | 0;
          const d = Math.max(Math.abs(x - g.p.x), Math.abs(y - g.p.y));
          if (d >= 5 && d <= 9 && g.grid[i] === FLOOR && !g.mons.some(o => o.x === x && o.y === y)) spots.push(i);
        }
        if (spots.length) {
          const t = g.rng.pick(spots);
          m.x = t % MW; m.y = (t / MW) | 0;
          say(g, "The Bone Lich blinks away in a swirl of ash!");
          return true;
        }
      }
      if (m.cd >= 4) {
        m.cd = 0;
        if (summon(g, m, "skeleton", 2)) { say(g, "The Bone Lich raises the dead!"); return true; }
      }
      return false;
    case "golem":
      if (m.cd >= 3 && dist <= 2) {
        g.marks = [];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const x = m.x + dx, y = m.y + dy;
          if ((dx || dy) && inB(x, y) && !blocksMove(g.grid[idx(x, y)])) g.marks.push([x, y]);
        }
        m.charge = 1;
        say(g, "The Forge Golem raises its fists high... get clear of the red!");
        return true;
      }
      return false;
    case "maw":
      if (m.cd >= 4 && sees) {
        g.marks = beamLine(g, m);
        m.charge = 2;
        say(g, "The Void Maw's eye locks onto you. Get off the red line!");
        return true;
      }
      if (m.cd === 2 && dist >= 3 && dist <= 7 && sees) {
        let pulled = 0;
        for (let k = 0; k < 2; k++) {
          const nx = g.p.x + Math.sign(m.x - g.p.x), ny = g.p.y + Math.sign(m.y - g.p.y);
          const v = g.grid[idx(nx, ny)];
          if (blocksMove(v) || v === LAVA || g.mons.some(o => o.x === nx && o.y === ny)) break;
          g.p = { x: nx, y: ny };
          pulled++;
        }
        if (pulled) {
          say(g, "The Void Maw drags you toward it!");
          enterTile(g, flash);
          return true;
        }
      }
      return false;
  }
  return false;
}

const shotName = (m: Mon) => m.kind === "lich" ? "bolt" : m.kind === "eye" ? "gaze" : "arrow";

export function monsterTurn(g: Game, flash: Flash) {
  for (const m of [...g.mons]) {
    if (!g.mons.includes(m) || m.disguised) continue;
    if (m.slow) { m.tick = (m.tick + 1) % 2; if (m.tick === 1) continue; }
    const dist = cheb(m, g.p);
    const canSee = m.phase || los(g.grid, m.x, m.y, g.p.x, g.p.y);
    const aware = m.alerted || (g.hidden <= 0 && dist <= g.sight + 2 && canSee);

    if (m.boss && bossAct(g, m, aware, dist, flash)) {
      if (g.dead) return;
      continue;
    }

    if (dist === 1 && (g.hidden <= 0 || m.alerted)) {
      const d = dmgRoll(g.rng, m.atk, m.pierce ? 0 : totalDef(g));
      say(g, `The ${m.name} hits you for ${d}.`);
      flash(idx(g.p.x, g.p.y), "hurt");
      hurtPlayer(g, d);
      if (g.dead) return;
      onPlayerHit(g, m, true, flash);
      continue;
    }

    if (m.ranged && aware && dist >= 2 && dist <= 5 && los(g.grid, m.x, m.y, g.p.x, g.p.y)) {
      for (const pt of between(m.x, m.y, g.p.x, g.p.y)) flash(idx(pt.x, pt.y), "arrow");
      if (g.rng.chance(0.25)) { say(g, `The ${m.name}'s ${shotName(m)} misses you.`); continue; }
      const d = dmgRoll(g.rng, m.atk, m.pierce ? 0 : totalDef(g));
      say(g, `The ${m.name}'s ${shotName(m)} hits you for ${d}.`);
      flash(idx(g.p.x, g.p.y), "hurt");
      hurtPlayer(g, d);
      if (g.dead) return;
      onPlayerHit(g, m, false, flash);
      continue;
    }

    const passable = (tx: number, ty: number) => m.phase
      ? tx > 0 && ty > 0 && tx < MW - 1 && ty < MH - 1
      : inB(tx, ty) && !blocksMove(g.grid[idx(tx, ty)]) && (g.grid[idx(tx, ty)] !== LAVA || m.fireproof);
    const free = (tx: number, ty: number) => passable(tx, ty) && !(tx === g.p.x && ty === g.p.y)
      && !g.mons.some(o => o !== m && o.x === tx && o.y === ty);

    const chase = () => {
      const dx = Math.sign(g.p.x - m.x), dy = Math.sign(g.p.y - m.y);
      const tries = Math.abs(g.p.x - m.x) > Math.abs(g.p.y - m.y)
        ? [[dx, 0], [0, dy], [dx, dy]] : [[0, dy], [dx, 0], [dx, dy]];
      for (const [ax, ay] of tries) {
        if (ax === 0 && ay === 0) continue;
        if (free(m.x + ax, m.y + ay)) { m.x += ax; m.y += ay; return; }
      }
    };
    if (aware && !(m.erratic && g.rng.chance(0.35))) {
      chase();
      if (m.fast && cheb(m, g.p) > 1) chase(); // spiders scuttle twice
    } else if (g.rng.chance(0.4)) {
      const [ax, ay] = g.rng.pick([[0,1],[0,-1],[1,0],[-1,0]]);
      if (free(m.x + ax, m.y + ay)) { m.x += ax; m.y += ay; }
    }
  }
}

function burnHazards(g: Game, flash: Flash) {
  for (const h of g.hazards) {
    const m = g.mons.find(o => o.x === h.x && o.y === h.y && !o.disguised);
    if (m) {
      m.hp -= h.dmg;
      flash(idx(m.x, m.y), "hit");
      if (m.hp <= 0) { say(g, `The ${m.name} burns in the lava.`); killMon(g, m); }
    }
    h.turns -= 1;
  }
  g.hazards = g.hazards.filter(h => h.turns > 0);
}

function spotTraps(g: Game) {
  const sharp = (g.relics.lantern ?? 0) >= 2;
  for (const t of g.traps) {
    if (t.found || !g.vis.has(idx(t.x, t.y))) continue;
    if (sharp || (cheb(t, g.p) <= 2 && g.rng.chance(0.25))) {
      t.found = true;
      say(g, `You spot a ${TRAP_NAMES[t.t]}.`);
    }
  }
}

/* Everything that happens after the player acts. */
export function endTurn(g: Game, flash: Flash) {
  monsterTurn(g, flash);
  if (!g.dead) burnHazards(g, flash);
  g.turns += 1;
  if (g.hidden > 0) { g.hidden -= 1; if (g.hidden === 0) say(g, "The shadow slips off you."); }
  if (g.webbed > 0) { g.webbed -= 1; if (g.webbed === 0) say(g, "You tear free of the web."); }
  g.vis = computeFov(g);
  noteSeen(g);
  if (!g.dead) spotTraps(g);
}

function noteSeen(g: Game) {
  for (const m of g.mons) {
    if (m.disguised || !g.vis.has(idx(m.x, m.y))) continue;
    g.dex.seen[m.kind] = 1;
    if (m.variant > 0) g.dex.seen[`${m.kind}:${m.variant}`] = 1;
  }
}

function triggerTrap(g: Game, flash?: Flash) {
  const t = g.traps.find(o => o.x === g.p.x && o.y === g.p.y);
  if (!t) return;
  const wasFound = t.found;
  t.found = true;
  g.path = null;
  const feather = relicVal(g, "feather");
  if (feather && g.rng.chance(feather / 100)) {
    say(g, `Your Feather Boots carry you lightly over the ${TRAP_NAMES[t.t]}.`);
    return;
  }
  if (t.t === "spikes") {
    const d = g.rng.range(3, 5) + g.depth;
    say(g, `Spikes jab up from the floor! -${d}.`);
    flash?.(idx(g.p.x, g.p.y), "hurt");
    hurtPlayer(g, d);
  } else if (t.t === "pit") {
    const d = g.rng.range(2, 4) + g.depth;
    hurtPlayer(g, d);
    if (g.dead) { say(g, "The floor gives way, and so do you."); return; }
    say(g, `The floor gives way! You fall. -${d}.`);
    descend(g, "s");
  } else {
    if (wasFound) return;
    for (const m of g.mons) if (!m.disguised) m.alerted = true;
    say(g, "CLANG! An alarm bell. Everything on this floor heard that.");
  }
}

function openChest(g: Game, chest: Item) {
  g.items = g.items.filter(i => i !== chest);
  g.chests += 1;
  const r = new Rng(chest.seed ?? g.rng.u32());
  const n = 2 + (r.chance(0.3) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const it = i === 0 && r.chance(0.35) ? rollRelic(r, g.depth, 1) : rollItem(r, g.depth, 1);
    dropNear(g, chest.x, chest.y, it, r, true);
  }
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
  if (!g.dead && g.grid[idx(g.p.x, g.p.y)] === LAVA) {
    const d = 3 + Math.floor(g.depth / 3);
    g.path = null;
    say(g, `Lava! It burns! -${d}.`);
    flash?.(idx(g.p.x, g.p.y), "hurt");
    hurtPlayer(g, d);
  }
  const tile = g.grid[idx(g.p.x, g.p.y)];
  if (tile === STAIRS_RISK) say(g, "These stairs reek of danger. Tougher monsters below, but richer loot.");
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
  } else if (it.t === "relic" && it.relic && it.tier) {
    const cur = g.relics[it.relic] ?? 0;
    g.dex.relics[it.relic] = Math.max(g.dex.relics[it.relic] ?? 0, it.tier);
    if (it.tier > cur) {
      g.relics[it.relic] = it.tier;
      say(g, cur
        ? `Your ${RELICS[it.relic].name} grows stronger! Now tier ${TIER_NAMES[it.tier]}.`
        : `Relic! ${relicLabel(it.relic, it.tier)}: ${relicBlurb(it.relic, it.tier)}.`);
      if (it.relic === "lantern") g.vis = computeFov(g);
    } else {
      const v = 15 * it.tier;
      g.echoes += v;
      say(g, `Your ${RELICS[it.relic].name} is already as strong. +${v} echoes.`);
    }
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
    const d = Math.round((g.rng.range(9, 15) + g.depth) * classOf(g.start.cls).emberMul);
    m.hp -= d;
    flash(idx(m.x, m.y), "hit");
    if (m.hp <= 0) killMon(g, m);
  }
}

export function castWaystone(g: Game, flash?: Flash) {
  if (g.inv.waystone <= 0) return;
  g.inv.waystone -= 1;
  const spots: number[] = [];
  for (let i = 0; i < MW * MH; i++) if (g.seen[i] && !blocksMove(g.grid[i]) && g.grid[i] !== LAVA) spots.push(i);
  const far = spots.filter(i => {
    const dx = i % MW - g.p.x, dy = ((i / MW) | 0) - g.p.y;
    return dx * dx + dy * dy > 49 && !g.mons.some(m => idx(m.x, m.y) === i);
  });
  const t = g.rng.pick(far.length ? far : spots);
  g.p = { x: t % MW, y: (t / MW) | 0 };
  say(g, "The waystone pulls, and the room changes.");
  enterTile(g, flash);
}

/* ============================ actions ============================ */
/* Every player decision is a short string, so a whole run is a list of them:
     m0..m7   step / bump-attack in DIRS8 direction
     a<dx>.<dy> reach attack at an offset (Reaching Gauntlet)
     w wait · t tonic · p<c> potion · e ember · y waystone · d take the stairs */

export const stepAction = (dx: number, dy: number) => `m${DIRS8.findIndex(d => d[0] === dx && d[1] === dy)}`;

export function canReach(g: Game, m: Mon) {
  const dist = cheb(m, g.p);
  return dist >= 2 && dist <= reachOf(g) && g.vis.has(idx(m.x, m.y)) && los(g.grid, g.p.x, g.p.y, m.x, m.y);
}

function doStep(g: Game, k: number, flash: Flash): boolean {
  const d = DIRS8[k];
  if (!d) return false;
  const tx = g.p.x + d[0], ty = g.p.y + d[1];
  if (!inB(tx, ty)) return false;
  // monsters before walls: ghosts can hang inside walls and still be hit
  const m = g.mons.find(o => o.x === tx && o.y === ty);
  if (m?.disguised) { revealMimic(g, m); return true; }
  if (m) { playerAttack(g, m, flash); return true; }
  if (blocksMove(g.grid[idx(tx, ty)])) return false;
  if (g.webbed > 0) { say(g, "You struggle against the web."); return true; }
  g.p = { x: tx, y: ty };
  enterTile(g, flash);
  return true;
}

function doReach(g: Game, dx: number, dy: number, flash: Flash): boolean {
  const m = g.mons.find(o => o.x === g.p.x + dx && o.y === g.p.y + dy);
  if (!m || !canReach(g, m)) return false;
  if (m.disguised) { revealMimic(g, m); return true; }
  playerAttack(g, m, flash, true);
  return true;
}

/* Applies one action; returns false (and changes nothing) if it isn't legal.
   Legal actions are appended to g.actions, which is the run's replay. */
export function applyAction(g: Game, a: string, flash: Flash): boolean {
  if (g.dead) return false;
  const arg = a.slice(1);
  let ok = true;
  switch (a[0]) {
    case "d": {
      const tile = g.grid[idx(g.p.x, g.p.y)];
      if (!isStairs(tile)) return false;
      descend(g, tile === STAIRS_RISK ? "r" : "s");
      g.actions.push(a);
      return true; // taking the stairs doesn't give monsters a turn
    }
    case "m": ok = doStep(g, Number(arg), flash); break;
    case "a": { const [dx, dy] = arg.split(".").map(Number); ok = doReach(g, dx, dy, flash); break; }
    case "w": say(g, "You wait."); break;
    case "t": ok = g.inv.tonic > 0; if (ok) drinkTonic(g); break;
    case "p": ok = (g.potions[Number(arg)] ?? 0) > 0; if (ok) drinkPotion(g, Number(arg)); break;
    case "e": ok = g.inv.ember > 0; if (ok) burnEmber(g, flash); break;
    case "y": ok = g.inv.waystone > 0; if (ok) castWaystone(g, flash); break;
    default: return false;
  }
  if (!ok) return false;
  g.actions.push(a);
  if (!g.dead) endTurn(g, flash);
  return true;
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

/* kind, x, y, hp, tick, then (v2+) variant, weapon, armor, split gen, flags, (v4+) boss cooldown, boss charge */
type SavedMon = [string, number, number, number, number, number?, number?, number?, number?, number?, number?, number?];
/* type, x, y, number (atk/def/amount/color/tier/locked), name (relic id for relics), chest seed */
type SavedItem = [ItemType, number, number, number, string, number?];

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
  // v3: identity + replay
  md?: RunMode; dy?: string | null; sd?: number; rs?: number; fk?: string;
  st?: StartStats; sa?: number; rk?: number; ac?: string; rp?: number;
  rl?: Partial<Record<RelicId, number>>; hz?: [number, number, number, number][]; ks?: number; pr?: number;
  cc?: [number, number];
  // v4: bosses and the bestiary
  wb?: number; mk?: [number, number][]; dx?: Dex;
  id?: string;
};

const itemNum = (i: Item) =>
  i.t === "potion" ? i.color ?? 0
  : i.t === "chest" ? (i.locked ? 1 : 0)
  : i.t === "relic" ? i.tier ?? 1
  : i.atk ?? i.def ?? i.amt ?? 0;

export function serializeRun(g: Game): SavedRun {
  return {
    ver: 4,
    d: g.depth,
    G: rle(Array.from(g.grid).join("")),
    S: rle(Array.from(g.seen).join("")),
    m: g.mons.map(m => [m.kind, m.x, m.y, m.hp, m.tick || 0, m.variant, m.wpn, m.arm, m.gen,
                        (m.alerted ? 1 : 0) | (m.disguised ? 2 : 0), m.cd, m.charge]),
    i: g.items.map(i => {
      const row: SavedItem = [i.t, i.x, i.y, itemNum(i), i.t === "relic" ? i.relic! : i.name];
      if (i.seed !== undefined) row.push(i.seed);
      return row;
    }),
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
    md: g.mode, dy: g.day, sd: g.seed, rs: g.rng.s, fk: g.floorKey,
    st: g.start, sa: g.startedAt, rk: g.ranked ? 1 : 0, ac: g.actions.join(","), rp: g.replayable ? 1 : 0,
    rl: { ...g.relics }, hz: g.hazards.map(h => [h.x, h.y, h.dmg, h.turns]), ks: g.killsSinceEmber, pr: g.perils,
    cc: [g.wardens, g.chests],
    wb: g.webbed, mk: g.marks.map(([x, y]) => [x, y]), dx: g.dex,
    id: g.id,
  };
}

export function deserializeRun(o: SavedRun): Game {
  const depth = o.d;
  const legacy = o.sd === undefined;           // saved before runs had seeds
  const floorKey = o.fk ?? `${depth}s`;
  const mDepth = monDepth(depth, floorKey);
  const seed = o.sd ?? hashStr(`legacy:${o.G}`);
  const pr = new Rng(hashStr(`${seed}:potions`));
  const g: Game = {
    id: o.id ?? legacyRunId(o.md ?? "free", seed, o.sa ?? 0),
    mode: o.md ?? "free", day: o.dy ?? null, seed,
    start: normalizeStart(o.st ?? { maxHp: o.h[1], atk: o.h[2], def: o.h[3], sight: o.h[4], tonics: 0, greed: o.e[1] }),
    startedAt: o.sa ?? Date.now(), ranked: o.rk === 1,
    actions: o.ac ? o.ac.split(",") : [], replayable: !legacy && o.rp !== 0,
    rng: new Rng(o.rs ?? hashStr(`${seed}:run:${o.e[3]}`)),
    floorKey,
    depth,
    grid: Uint8Array.from(unrle(o.G).split("").map(Number)),
    seen: Uint8Array.from(unrle(o.S).split("").map(Number)),
    vis: new Set(),
    mons: o.m.flatMap(([k, x, y, hp, tick, variant, wpn, arm, gen, flags, cd, charge]) => {
      const b = makeMon(k, mDepth, variant ?? 0, wpn ?? -1, arm ?? -1, gen ?? 0);
      if (!b) return [];
      return [{ ...b, x, y, hp, tick, cd: cd ?? 0, charge: charge ?? 0,
                alerted: !!((flags ?? 0) & 1), disguised: !!((flags ?? 0) & 2) }];
    }),
    items: o.i.map(([t, x, y, n, name, seed]) => {
      const it: Item = { t, x, y, name };
      if (t === "weapon") it.atk = n;
      else if (t === "armor") it.def = n;
      else if (t === "echoes") it.amt = n;
      else if (t === "potion") it.color = n;
      else if (t === "chest") { it.locked = n === 1; if (seed !== undefined) it.seed = seed; }
      else if (t === "relic") { it.relic = name as RelicId; it.tier = n; it.name = RELICS[name as RelicId]?.name ?? name; }
      return it;
    }),
    traps: (o.t ?? []).map(([t, x, y, f]) => ({ t, x, y, found: f === 1 })),
    hazards: (o.hz ?? []).map(([x, y, dmg, turns]) => ({ x, y, dmg, turns })),
    p: { x: o.p[0], y: o.p[1] },
    hp: o.h[0], maxHp: o.h[1], atk: o.h[2], def: o.h[3], sight: o.h[4],
    weapon: o.w ? { name: o.w[0], atk: o.w[1] } : null,
    armor: o.a ? { name: o.a[0], def: o.a[1] } : null,
    inv: { tonic: o.v[0], ember: o.v[1], waystone: o.v[2], key: o.v[3] ?? 0 },
    potions: o.pt ?? POTION_COLORS.map(() => 0),
    potionMap: o.pm ?? pr.shuffle(POTION_EFFECTS.map((_, i) => i)),
    known: o.kn ? o.kn.map(k => k === 1) : POTION_EFFECTS.map(() => false),
    hidden: o.hd ?? 0,
    relics: { ...(o.rl ?? {}) },
    killsSinceEmber: o.ks ?? 0,
    perils: o.pr ?? 0,
    wardens: o.cc?.[0] ?? 0, chests: o.cc?.[1] ?? 0,
    webbed: o.wb ?? 0, marks: (o.mk ?? []).map(([x, y]) => [x, y] as [number, number]),
    dex: o.dx ? { seen: { ...o.dx.seen }, kills: { ...o.dx.kills }, relics: { ...o.dx.relics } } : freshDex(),
    level: o.x[0], xp: o.x[1], next: o.x[2],
    echoes: o.e[0], greed: o.e[1], kills: o.e[2], turns: o.e[3],
    log: o.l?.length ? o.l : ["You come back to yourself in the dark."],
    dead: o.h[0] <= 0, path: null,     // a hero saved at 0 hp stays dead
  };
  if (g.grid.length !== MW * MH || g.seen.length !== MW * MH) throw new Error("save has the wrong map size");
  g.vis = computeFov(g);
  return g;
}
