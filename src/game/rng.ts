/* Seeded randomness. Everything that affects gameplay draws from an Rng, never
   Math.random, so the same seed + the same player actions always produce the
   same run. That is what makes daily dungeons, ghosts and replay checks work. */

export class Rng {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0; }

  /* mulberry32: tiny, fast, and its whole state is one 32-bit number we can save */
  next(): number {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number) { return Math.floor(this.next() * n); }
  range(a: number, b: number) { return a + this.int(b - a + 1); }
  pick<T>(a: readonly T[]): T { return a[this.int(a.length)]; }
  chance(p: number) { return this.next() < p; }
  u32() { return Math.floor(this.next() * 4294967296) >>> 0; }
  shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
}

/* string -> 32-bit seed (cyrb53, low half) */
export function hashStr(s: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/* the only place a non-deterministic seed is allowed: starting a fresh free run */
export const randomSeed = () => Math.floor(Math.random() * 4294967296) >>> 0;
