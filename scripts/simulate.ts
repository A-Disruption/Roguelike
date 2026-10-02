// Headless smoke test: plays random runs and checks nothing crashes and saves round-trip.
// Run with: node scripts/simulate.ts
import {
  newRun, freshMeta, endTurn, enterTile, playerAttack, revealMimic, drinkPotion, drinkTonic, burnEmber,
  castWaystone, descend, serializeRun, deserializeRun, idx, inB, WALL, STAIRS,
  type Game,
} from "../src/game/core.ts";

const noFlash = () => {};
const seen = { mimics: 0, chests: 0, locked: 0, keys: 0, traps: { spikes: 0, pit: 0, alarm: 0 }, splits: 0,
  variants: 0, armedMons: 0, potionsDrunk: 0, arrows: 0, ghostsInWalls: 0, deaths: 0, maxDepth: 0, gearDrops: 0 };

function step(g: Game) {
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
  // prefer stairs sometimes so we get deep
  if (g.grid[idx(g.p.x, g.p.y)] === STAIRS && Math.random() < 0.7) { descend(g); return; }
  const roll = Math.random();
  if (roll < 0.03 && g.potions.some(n => n > 0)) { drinkPotion(g, g.potions.findIndex(n => n > 0)); seen.potionsDrunk++; return; }
  if (roll < 0.05 && g.hp < g.maxHp / 2) { drinkTonic(g); return; }
  if (roll < 0.06) { burnEmber(g, noFlash); return; }
  if (roll < 0.07) { castWaystone(g, noFlash); return; }
  const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
  const tx = g.p.x + dx, ty = g.p.y + dy;
  if (!inB(tx, ty)) return;
  const m = g.mons.find(o => o.x === tx && o.y === ty);
  if (m?.disguised) { revealMimic(g, m); seen.mimics++; return; }
  if (m) {
    const before = g.mons.length, items = g.items.length;
    playerAttack(g, m, noFlash);
    if (g.mons.length > before) seen.splits++;
    if (g.items.length > items) seen.gearDrops++;
    return;
  }
  if (g.grid[idx(tx, ty)] === WALL) return;
  g.p = { x: tx, y: ty };
  const chest = g.items.find(i => i.t === "chest" && i.x === tx && i.y === ty);
  if (chest) { seen.chests++; if (chest.locked) seen.locked++; }
  const trap = g.traps.find(t => t.x === tx && t.y === ty);
  if (trap) seen.traps[trap.t]++;
  if (g.items.some(i => i.t === "key" && i.x === tx && i.y === ty)) seen.keys++;
  enterTile(g, noFlash);
}

function sameRun(a: Game, b: Game) {
  const sa = JSON.stringify(serializeRun(a)), sb = JSON.stringify(serializeRun(b));
  if (sa !== sb) throw new Error("save round-trip mismatch");
}

const RUNS = 300;
for (let r = 0; r < RUNS; r++) {
  const g = newRun({ ...freshMeta(), up: { vigor: 5, edge: 5, hide: 3 } });
  for (let t = 0; t < 3000 && !g.dead; t++) {
    if (t % 120 === 119) descend(g); else step(g);
    if (!g.dead) {
      const hpBefore = g.hp;
      const log = g.log.length;
      endTurn(g, noFlash);
      if (g.log.slice(log - 1).some(l => /arrow/.test(l)) && g.hp <= hpBefore) seen.arrows++;
    }
    for (const m of g.mons) {
      if (m.variant > 0) seen.variants++;
      if (m.wpn >= 0 || m.arm >= 0) seen.armedMons++;
      if (m.phase && g.grid[idx(m.x, m.y)] === WALL) seen.ghostsInWalls++;
      if (!inB(m.x, m.y)) throw new Error(`monster out of bounds: ${m.kind}`);
      if (!m.phase && g.grid[idx(m.x, m.y)] === WALL) throw new Error(`${m.kind} stuck in a wall`);
      if (Number.isNaN(m.hp) || Number.isNaN(m.atk)) throw new Error(`NaN stats on ${m.kind}`);
    }
    if (Number.isNaN(g.hp) || g.hp > g.maxHp) throw new Error(`bad hp ${g.hp}/${g.maxHp}`);
    if (t % 97 === 0) sameRun(g, deserializeRun(JSON.parse(JSON.stringify(serializeRun(g)))));
    seen.maxDepth = Math.max(seen.maxDepth, g.depth);
  }
  if (g.dead) seen.deaths++;
}

// an old v1 save (no traps, potions, keys, variants) must still load
const old = serializeRun(newRun(freshMeta()));
const v1 = { ...old, ver: undefined, t: undefined, pt: undefined, pm: undefined, kn: undefined, hd: undefined,
  v: old.v.slice(0, 3), m: old.m.map(m => m.slice(0, 5)) };
const restored = deserializeRun(JSON.parse(JSON.stringify(v1)));
if (restored.potions.length !== 6 || restored.inv.key !== 0 || !Array.isArray(restored.traps)) throw new Error("v1 save did not upgrade");

// mimics: sit still while disguised, bite once revealed, cough up loot when killed
{
  const g = newRun(freshMeta());
  let found = 0, verified = false;
  for (let i = 0; i < 400 && !verified; i++) {
    descend(g);
    const m = g.mons.find(o => o.disguised);
    if (!m) continue;
    found++;
    const at = { x: m.x, y: m.y };
    g.hidden = 0;
    endTurn(g, noFlash);
    if (m.x !== at.x || m.y !== at.y) throw new Error("disguised mimic moved");
    // stand next to it, reveal, then fight it to the death
    const spot = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy }))
      .find(s => g.grid[idx(s.x, s.y)] !== WALL && !g.mons.some(o => o.x === s.x && o.y === s.y));
    if (!spot) continue;
    g.p = spot; g.hp = g.maxHp = 9999; g.atk = 99999;
    revealMimic(g, m);
    const hp = g.hp;
    endTurn(g, noFlash);
    if (g.hp >= hp) continue; // missed its bite this turn by moving; try another floor
    const items = g.items.length;
    playerAttack(g, m, noFlash);
    if (g.mons.includes(m)) throw new Error("mimic survived a huge hit");
    if (g.items.length < items + 2) throw new Error("mimic dropped no loot");
    verified = true;
  }
  if (!verified) throw new Error(`could not verify a mimic (found ${found})`);
  console.log(`mimic check ok (found ${found} on the way)`);
}

console.log(`ok: ${RUNS} runs`, JSON.stringify(seen, null, 1));
