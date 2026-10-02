import { MONSTER_KINDS, BOSS_KINDS, type Meta, type Dex } from "./core.ts";
import { RELIC_IDS } from "./relics.ts";
import { CLASS_IDS, isUnlocked } from "./classes.ts";
import { ZONES } from "./zones.ts";

/* Words for the collection screens: what each monster does and what each
   zone is like, plus the list of achievements. */

export const MONSTER_NOTES: Record<string, string> = {
  rat: "Cellar rats. Weak alone, annoying in packs.",
  bat: "Flits about at random, so it's hard to pin down.",
  goblin: "Sneaky and greedy. Some carry weapons or armor, and drop them when they fall.",
  slime: "Slow and squishy. Hit it and it splits in two (up to twice).",
  archer: "Keeps its distance and shoots arrows from up to 5 tiles away.",
  skeleton: "Tough old bones, often wearing armor and carrying a weapon.",
  ghost: "Drifts straight through walls.",
  wraith: "Its cold touch ignores your armor.",
  ogre: "Huge and slow, but hits incredibly hard.",
  mimic: "Looks just like a treasure chest... until it bites.",
  spider: "Scuttles two steps for every one of yours.",
  drowned: "Slow, soaked and very hard to put down.",
  imp: "Darts about and explodes in flames when it dies. Don't kill it right next to you!",
  eye: "Its gaze reaches 5 tiles and ignores your armor.",
  ratking: "Lord of the Cellars. Squeals for more rats every few turns, so kill it fast.",
  broodmother: "Queen of the Caves. Spits webs that hold you in place and hatches spiderlings.",
  lich: "Master of the Crypt. Its bolts ignore armor, it raises skeletons, and it blinks away when you get close.",
  golem: "Heart of the Forge. Slow, but it raises its fists to slam everything nearby. When the floor turns red, get out!",
  maw: "The Abyss itself. Drags you closer, then fires a beam down your row or column. Step off the red line!",
};

export const ZONE_NOTES = [
  "Rooms and narrow corridors, the odd big hall full of barrels and rubble.",
  "Twisting natural caves and wide open caverns. Watch for webs.",
  "Pillared tomb halls and pools of cold water.",
  "Great halls split by rivers of lava. Lava burns: find the bridges.",
  "Caves and halls broken by bottomless chasms. You can see across them, but not walk.",
];

/* the lifetime bestiary, plus anything from runs still in progress */
export const combinedDex = (meta: Meta, ...runs: (Dex | undefined)[]): Dex => {
  const out: Dex = { seen: { ...meta.dex.seen }, kills: { ...meta.dex.kills }, relics: { ...meta.dex.relics } };
  for (const d of runs) {
    if (!d) continue;
    Object.assign(out.seen, d.seen);
    for (const [k, n] of Object.entries(d.kills)) out.kills[k] = (out.kills[k] ?? 0) + n;
    for (const [k, t] of Object.entries(d.relics)) out.relics[k] = Math.max(out.relics[k] ?? 0, t);
  }
  return out;
};

export const zonesOf = (kind: string) => ZONES.filter(z => z.pool.some(([k]) => k === kind) || z.boss === kind).map(z => z.name);

/* ---------------- achievements ---------------- */

export type Achievement = {
  id: string; name: string; text: string;
  progress: (m: Meta) => [have: number, need: number];
};

const kills = (k: string) => (m: Meta) => [Math.min(m.dex.kills[k] ?? 0, 1), 1] as [number, number];
const count = (n: number, f: (m: Meta) => number) => (m: Meta) => [Math.min(f(m), n), n] as [number, number];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-blood", name: "First Blood",          text: "Defeat a monster",                    progress: count(1, m => m.kills) },
  { id: "hunter",      name: "Monster Hunter",       text: "Defeat 100 monsters",                 progress: count(100, m => m.kills) },
  { id: "legend",      name: "Legend of the Depths", text: "Defeat 500 monsters",                 progress: count(500, m => m.kills) },
  { id: "caves",       name: "Into the Caves",       text: "Reach floor 6",                       progress: count(6, m => m.best) },
  { id: "crypt",       name: "Crypt Crawler",        text: "Reach floor 11",                      progress: count(11, m => m.best) },
  { id: "forge",       name: "Forgeborn",            text: "Reach floor 16",                      progress: count(16, m => m.best) },
  { id: "abyss",       name: "Abyss Gazer",          text: "Reach floor 21",                      progress: count(21, m => m.best) },
  { id: "deeper",      name: "Deeper Still",         text: "Reach floor 30",                      progress: count(30, m => m.best) },
  { id: "ratking",     name: "Rat Catcher",          text: "Defeat the Rat King",                 progress: kills("ratking") },
  { id: "broodmother", name: "Web Breaker",          text: "Defeat the Broodmother",              progress: kills("broodmother") },
  { id: "lich",        name: "Rest in Peace",        text: "Defeat the Bone Lich",                progress: kills("lich") },
  { id: "golem",       name: "Golem Smasher",        text: "Defeat the Forge Golem",              progress: kills("golem") },
  { id: "maw",         name: "Void Walker",          text: "Defeat the Void Maw",                 progress: kills("maw") },
  { id: "chests",      name: "Treasure Hunter",      text: "Open 20 treasure chests",             progress: count(20, m => m.chests) },
  { id: "mimic",       name: "Not a Chest!",         text: "Defeat a mimic",                      progress: kills("mimic") },
  { id: "collector",   name: "Collector",            text: "Find 5 different relics",             progress: count(5, m => Object.keys(m.dex.relics).length) },
  { id: "hoarder",     name: "Hoarder",              text: "Find every relic",                    progress: count(RELIC_IDS.length, m => Object.keys(m.dex.relics).length) },
  { id: "blazing",     name: "Blazing",              text: "Find a tier III relic",               progress: count(1, m => Object.values(m.dex.relics).some(t => t >= 3) ? 1 : 0) },
  { id: "daredevil",   name: "Daredevil",            text: "Take 3 perilous stairs in one run",   progress: count(3, m => m.maxPerils) },
  { id: "daily",       name: "Daily Delver",         text: "Finish a daily dungeon",              progress: count(1, m => m.dailies) },
  { id: "regular",     name: "Regular",              text: "Finish 7 daily dungeons",             progress: count(7, m => m.dailies) },
  { id: "rich",        name: "Echo Baron",           text: "Carry 500 echoes out of a single run", progress: count(500, m => m.maxEarned) },
  { id: "party",       name: "Full Party",           text: "Unlock every hero",                   progress: count(CLASS_IDS.length, m => CLASS_IDS.filter(id => isUnlocked(id, m)).length) },
  { id: "naturalist",  name: "Naturalist",           text: "Meet every kind of monster",          progress: count(MONSTER_KINDS.length + BOSS_KINDS.length, m => [...MONSTER_KINDS, ...BOSS_KINDS].filter(k => m.dex.seen[k]).length) },
];

export const isDone = (a: Achievement, m: Meta) => { const [h, n] = a.progress(m); return h >= n; };
export const newlyEarned = (m: Meta) => ACHIEVEMENTS.filter(a => !m.ach.includes(a.id) && isDone(a, m)).map(a => a.id);
