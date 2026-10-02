/* Relics last for the whole run and bend the rules. Each comes in three tiers;
   finding a higher tier of one you own upgrades it. */

export type RelicId =
  | "fang" | "reach" | "magma" | "thorns" | "coin"
  | "feather" | "kindling" | "phoenix" | "lantern" | "twin";

type RelicDef = {
  name: string;
  values: [number, number, number];        // the number each tier gives
  blurb: (v: number, tier: number) => string;
};

export const RELICS: Record<RelicId, RelicDef> = {
  fang:     { name: "Bloodthirst Fang", values: [1, 5, 15],    blurb: v => `heal ${v} every time you kill` },
  reach:    { name: "Reaching Gauntlet", values: [1, 2, 3],    blurb: v => `attack monsters up to ${v + 1} tiles away` },
  magma:    { name: "Magma Heart",      values: [3, 6, 10],    blurb: (v, t) => `lava bursts under anything that hits you (${v} dmg for ${t + 1} turns)` },
  thorns:   { name: "Thorn Bracer",     values: [1, 3, 6],     blurb: v => `monsters that hit you take ${v} back` },
  coin:     { name: "Lucky Coin",       values: [10, 25, 50],  blurb: v => `+${v}% echoes from kills` },
  feather:  { name: "Feather Boots",    values: [40, 70, 100], blurb: v => v >= 100 ? "traps never trigger" : `${v}% chance to float over traps` },
  kindling: { name: "Kindling Pouch",   values: [10, 7, 4],    blurb: v => `a free ember scroll every ${v} kills` },
  phoenix:  { name: "Phoenix Feather",  values: [25, 50, 100], blurb: v => `once, survive a killing blow with ${v}% health` },
  lantern:  { name: "Watcher's Lantern", values: [1, 2, 3],    blurb: (v, t) => `+${v} sight` + (t >= 2 ? ", spots traps" : "") + (t >= 3 ? ", sees through mimics" : "") },
  twin:     { name: "Quicksilver Ring", values: [15, 30, 50],  blurb: v => `${v}% chance to strike twice` },
};

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];
export const TIER_NAMES = ["", "I", "II", "III"] as const;
export const TIER_COLORS = ["", "#B07A45", "#C9CFD6", "#F2D06B"] as const; // bronze, silver, gold
