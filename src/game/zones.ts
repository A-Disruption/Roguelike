/* Themed zones. Every ZONE_LEN floors the dungeon changes: new colors, new
   monsters, a terrain twist, and a warden of its own guarding the last floor. */

export const ZONE_LEN = 4;

export type ZoneFeature = "none" | "caverns" | "water" | "lava" | "void";

export type ZoneColors = {
  litWall: string; litFloor: string; wallTop: string; crack: string; speck: string;
  memWall: string; memFloor: string; memTop: string; memCrack: string; memSpeck: string;
};

export type ZoneDef = {
  name: string;
  intro: string;
  feature: ZoneFeature;
  sight: number;                       // added to the hero's sight here
  pool: [kind: string, fromDepth: number][];  // which monsters roam here, and from which depth
  colors: ZoneColors;
};

export const ZONES: ZoneDef[] = [
  {
    name: "The Cellars", intro: "Damp stone, old barrels and the smell of rats.", feature: "none", sight: 0,
    pool: [["rat", 1], ["bat", 1], ["goblin", 2], ["slime", 2], ["archer", 3]],
    colors: {
      litWall: "#4A3524", litFloor: "#241B13", wallTop: "#63482F", crack: "#3B2A1B", speck: "#33261A",
      memWall: "#161B23", memFloor: "#10141A", memTop: "#1D2430", memCrack: "#121821", memSpeck: "#141922",
    },
  },
  {
    name: "The Caves", intro: "The walls turn to raw rock. Something with too many legs skitters ahead.", feature: "caverns", sight: 0,
    pool: [["bat", 5], ["goblin", 5], ["spider", 5], ["archer", 5], ["skeleton", 6], ["slime", 5]],
    colors: {
      litWall: "#3E4652", litFloor: "#1C2128", wallTop: "#59636F", crack: "#2C333C", speck: "#2F4A2C",
      memWall: "#151A20", memFloor: "#0E1216", memTop: "#1E252E", memCrack: "#11161C", memSpeck: "#131C18",
    },
  },
  {
    name: "The Flooded Crypt", intro: "Cold water stands between the tombs. The dead here do not rest.", feature: "water", sight: 0,
    pool: [["skeleton", 9], ["drowned", 9], ["ghost", 9], ["slime", 9], ["wraith", 10]],
    colors: {
      litWall: "#2E4440", litFloor: "#14201E", wallTop: "#46625C", crack: "#1E302C", speck: "#22332F",
      memWall: "#121C1C", memFloor: "#0B1212", memTop: "#1A2828", memCrack: "#0F1818", memSpeck: "#111A19",
    },
  },
  {
    name: "The Forge", intro: "Heat rolls up the stairs. Rivers of lava light the halls. Don't step in them.", feature: "lava", sight: 0,
    pool: [["imp", 13], ["skeleton", 13], ["archer", 13], ["ogre", 13], ["wraith", 14]],
    colors: {
      litWall: "#4A2018", litFloor: "#24120E", wallTop: "#6E3020", crack: "#2E120C", speck: "#3A1A12",
      memWall: "#1C1110", memFloor: "#120B0A", memTop: "#2A1612", memCrack: "#170D0B", memSpeck: "#1A0F0D",
    },
  },
  {
    name: "The Abyss", intro: "The dark here swallows your lantern light. Eyes open in the black.", feature: "void", sight: -1,
    pool: [["eye", 17], ["wraith", 17], ["ghost", 17], ["imp", 17], ["spider", 17], ["ogre", 18]],
    colors: {
      litWall: "#2A1E3A", litFloor: "#120C1A", wallTop: "#3E2E58", crack: "#1A1226", speck: "#24183A",
      memWall: "#130E1C", memFloor: "#0A070F", memTop: "#1C1428", memCrack: "#100B16", memSpeck: "#120D1A",
    },
  },
];

export const zoneIndex = (depth: number) => Math.min(ZONES.length - 1, Math.floor((depth - 1) / ZONE_LEN));
export const zoneOf = (depth: number) => ZONES[zoneIndex(depth)];
export const zoneStart = (i: number) => i * ZONE_LEN + 1;
export const isBossFloor = (depth: number) => depth % ZONE_LEN === 0;
