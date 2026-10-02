/* Map basics shared by the rules (core.ts) and the level generator (mapgen.ts). */

export const MW = 31, MH = 29;          // map size in tiles
export const VW = 11, VH = 13;          // viewport in tiles

export const WALL = 0, FLOOR = 1, STAIRS = 2, STAIRS_RISK = 3, WATER = 4, LAVA = 5, CHASM = 6;

/* walls and chasms stop walking; only walls stop sight */
export const blocksMove = (v: number) => v === WALL || v === CHASM;
export const isStairs = (v: number) => v === STAIRS || v === STAIRS_RISK;

export type Pt = { x: number; y: number };
export type Room = { x: number; y: number; w: number; h: number };

export const idx = (x: number, y: number) => y * MW + x;
export const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < MW && y < MH;
export const center = (r: Room): Pt => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });
