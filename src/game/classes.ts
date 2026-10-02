import type { RelicId } from "./relics.ts";

/* Heroes. Each class changes the starting stats and kit, and some get relic
   powers built in (an innate relic stacks with found ones: a higher tier found
   in the dungeon upgrades it). New heroes unlock from lifetime progress. */

export type ClassId = "wanderer" | "ranger" | "mage" | "knight" | "rogue";

/* the lifetime counters unlocks look at (a subset of Meta) */
export type Progress = { best: number; kills: number; wardens: number; chests: number };

export type ClassDef = {
  name: string;
  blurb: string;
  sprite: string;                 // base sprite in sprites.ts
  hp: number; atk: number; def: number; sight: number;
  tonics: number; embers: number; waystones: number;
  weapon: number;                 // index into WEAPONS, -1 for none
  relics: Partial<Record<RelicId, number>>;
  emberMul: number;               // ember scroll damage multiplier
  mana: number;                   // spellcasters start with this much mana (and it's their maximum)
  bow: number;                    // how far this hero shoots (0 = no bow)
  block: number;                  // % chance to block a melee hit with a shield
  backstab: boolean;              // double damage on monsters that haven't noticed you
  scavenge: number;               // % chance a slain monster drops something extra
  knowsPotion?: string;           // a potion effect this hero recognizes from the start
  unlock: { text: string; done: (p: Progress) => boolean; progress: (p: Progress) => string } | null;
};

export const CLASSES: Record<ClassId, ClassDef> = {
  wanderer: {
    name: "Wanderer", blurb: "Steady and lucky: monsters sometimes drop extra loot (Scavenger).", sprite: "player",
    hp: 32, atk: 5, def: 0, sight: 6, tonics: 1, embers: 0, waystones: 0, weapon: -1,
    relics: {}, emberMul: 1, mana: 0, bow: 0, block: 0, backstab: false, scavenge: 25, unlock: null,
  },
  ranger: {
    name: "Ranger", blurb: "Shoots arrows up to 3 tiles away (arrows hit a little softer). Sharp eyes, light on armor.", sprite: "ranger",
    hp: 26, atk: 4, def: 0, sight: 7, tonics: 1, embers: 0, waystones: 0, weapon: -1,
    relics: {}, emberMul: 1, mana: 0, bow: 3, block: 0, backstab: false, scavenge: 0,
    unlock: { text: "Reach depth 4", done: p => p.best >= 4, progress: p => `deepest so far: ${p.best}` },
  },
  mage: {
    name: "Ember Mage", blurb: "Casts spells with mana: Firebolt, Frost Nova, Blink and Ember Burst. Mana refills slowly. Fragile.", sprite: "mage",
    hp: 24, atk: 3, def: 0, sight: 6, tonics: 1, embers: 0, waystones: 0, weapon: -1,
    relics: {}, emberMul: 1, mana: 10, bow: 0, block: 0, backstab: false, scavenge: 0,
    unlock: { text: "Defeat 40 monsters", done: p => p.kills >= 40, progress: p => `${Math.min(p.kills, 40)} / 40` },
  },
  knight: {
    name: "Knight", blurb: "Tough, armored, sword and shield: blocks 1 in 4 melee hits. Sees less, brings no tonic.", sprite: "knight",
    hp: 44, atk: 5, def: 2, sight: 5, tonics: 0, embers: 0, waystones: 0, weapon: 1,
    relics: { thorns: 1 }, emberMul: 1, mana: 0, bow: 0, block: 25, backstab: false, scavenge: 0,
    unlock: { text: "Defeat a boss", done: p => p.wardens >= 1, progress: p => `${Math.min(p.wardens, 1)} / 1` },
  },
  rogue: {
    name: "Rogue", blurb: "Backstabs for double damage on monsters that haven't seen you. Floats over traps.", sprite: "rogue",
    hp: 26, atk: 5, def: 0, sight: 6, tonics: 1, embers: 0, waystones: 1, weapon: -1,
    relics: { feather: 3, twin: 1 }, emberMul: 1, mana: 0, bow: 0, block: 0, backstab: true, scavenge: 0, knowsPotion: "shadow",
    unlock: { text: "Open 8 treasure chests", done: p => p.chests >= 8, progress: p => `${Math.min(p.chests, 8)} / 8` },
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export const isUnlocked = (id: ClassId, p: Progress) => {
  const u = CLASSES[id].unlock;
  return !u || u.done(p);
};

export const classOf = (id: string | undefined): ClassDef => CLASSES[(id ?? "wanderer") as ClassId] ?? CLASSES.wanderer;
