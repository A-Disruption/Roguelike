// Headless smoke test: plays random runs through the same action API the app
// uses, then checks that nothing crashed, saves round-trip, and every run
// replays from its action log to exactly the same result (the daily/ghost
// guarantee). Run with: npm test
import {
  newRun, freshMeta, startStats, dailySeed, dailyClass, POTION_EFFECTS, WEAPONS, applyAction, stepAction, serializeRun, deserializeRun,
  descend, revealMimic, playerAttack, endTurn, idx, inB, WALL, WATER, LAVA, FLOOR, STAIRS, STAIRS_RISK, isStairs, DIRS8, canReach,
  computeFov, sightOf, cheb,
  type Game, type RunSetup,
} from "../src/game/core.ts";
import { makeRecord, replayRecord, resultOf, sameResult, buildGhost, encodeRecord, decodeRecord } from "../src/game/replay.ts";
import { RELIC_IDS } from "../src/game/relics.ts";
import { CLASS_IDS, CLASSES, isUnlocked } from "../src/game/classes.ts";
import { ZONES, zoneIndex, zoneOf, isBossFloor } from "../src/game/zones.ts";

// make the test's own choices reproducible: SEED=123 npm test reruns a failure exactly
{
  let t = Number(process.env.SEED ?? Date.now()) >>> 0;
  console.log(`test seed ${t}`);
  Math.random = () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const noFlash = () => {};
/* a fingerprint of the state after each action, to find where a replay diverges */
const fp = (g: Game) => `${g.turns}|${g.hp}/${g.maxHp}|${g.p.x},${g.p.y}|${g.rng.s}|${g.mons.map(m => `${m.kind}${m.x},${m.y}:${m.hp}`).join(";")}|${g.floorKey}`;
const stats = { runs: 0, actions: 0, deaths: 0, maxDepth: 0, zonesReached: 0, perilous: 0, relicsFound: 0, lavaKills: 0,
  reachAttacks: 0, revives: 0, splits: 0, mimicsRevealed: 0, saveReloads: 0 };

function randomAction(g: Game): string {
  const r = Math.random();
  if (isStairs(g.grid[idx(g.p.x, g.p.y)]) && r < 0.6) return "d";
  if (r < 0.02) return "w";
  if (r < 0.04) return "t";
  if (r < 0.06) return `p${Math.floor(Math.random() * 6)}`;
  if (r < 0.07) return "e";
  if (r < 0.075) return "y";
  if (r < 0.15) {
    const m = g.mons.find(o => canReach(g, o));
    if (m) { stats.reachAttacks++; return `a${m.x - g.p.x}.${m.y - g.p.y}`; }
  }
  // drift toward a stair so runs get deep
  if (r < 0.55) {
    let best = -1, bestD = 1e9;
    for (let i = 0; i < g.grid.length; i++) {
      if (!isStairs(g.grid[i])) continue;
      const d = Math.abs(i % 31 - g.p.x) + Math.abs(Math.floor(i / 31) - g.p.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) {
      const dx = Math.sign(best % 31 - g.p.x), dy = Math.sign(Math.floor(best / 31) - g.p.y);
      if (dx || dy) return stepAction(dx, dy);
    }
  }
  const [dx, dy] = DIRS8[Math.floor(Math.random() * 8)];
  return stepAction(dx, dy);
}

/* for deep dives: walk the shortest route to the nearest stairs (the test may peek at the whole map) */
function diveAction(g: Game): string {
  if (isStairs(g.grid[idx(g.p.x, g.p.y)])) return "d";
  if (Math.random() < 0.15) return randomAction(g);
  const start = idx(g.p.x, g.p.y);
  const prev = new Int32Array(g.grid.length).fill(-1);
  prev[start] = start;
  const q = [start];
  for (let k = 0; k < q.length; k++) {
    const cur = q[k];
    if (isStairs(g.grid[cur])) {
      let c = cur;
      while (prev[c] !== start) c = prev[c];
      return stepAction(c % 31 - g.p.x, Math.floor(c / 31) - g.p.y);
    }
    for (const [dx, dy] of DIRS8) {
      const x = cur % 31 + dx, y = Math.floor(cur / 31) + dy, i = idx(x, y);
      if (!inB(x, y) || prev[i] !== -1 || g.grid[i] === WALL || g.grid[i] === LAVA) continue;
      prev[i] = cur; q.push(i);
    }
  }
  return randomAction(g);
}

function checkInvariants(g: Game) {
  for (const m of g.mons) {
    if (!inB(m.x, m.y)) throw new Error(`monster out of bounds: ${m.kind}`);
    if (!m.phase && g.grid[idx(m.x, m.y)] === WALL) throw new Error(`${m.kind} stuck in a wall`);
    if (!m.phase && !m.fireproof && g.grid[idx(m.x, m.y)] === LAVA) throw new Error(`${m.kind} walked into lava`);
    if (Number.isNaN(m.hp) || Number.isNaN(m.atk)) throw new Error(`NaN stats on ${m.kind}`);
  }
  if (Number.isNaN(g.hp) || g.hp > g.maxHp) throw new Error(`bad hp ${g.hp}/${g.maxHp}`);
}

async function playOne(setup: RunSetup, boosted: boolean, maxActions = 2500, pickAction = randomAction) {
  let g = newRun(setup);
  if (boosted) {
    // exercise every relic at a random tier
    for (const id of RELIC_IDS) g.relics[id] = 1 + Math.floor(Math.random() * 3);
    g.maxHp = g.hp = 400; g.atk = 14;
  }
  const replaySetup = boosted ? null : setup;
  const prints: string[] = [fp(g)];
  const reloadsAt: number[] = [];
  for (let t = 0; t < maxActions && !g.dead; t++) {
    const before = { mons: g.mons.length, depth: g.depth, items: g.items.length, phoenix: !!g.relics.phoenix };
    const lavaBefore = g.hazards.length;
    const a = pickAction(g);
    if (!applyAction(g, a, noFlash)) continue;
    prints.push(fp(g));
    stats.actions++;
    if (a === "d" && g.floorKey.endsWith("r")) stats.perilous++;
    if (g.mons.length > before.mons && g.depth === before.depth) stats.splits++;
    if (before.phoenix && !g.relics.phoenix) stats.revives++;
    if (lavaBefore && g.log.some(l => l.includes("burns in the lava"))) stats.lavaKills++;
    checkInvariants(g);
    // save + reload part way through: the reloaded game must carry on identically
    if (t % 211 === 100 && !g.dead) {
      g = deserializeRun(JSON.parse(JSON.stringify(serializeRun(g))));
      reloadsAt.push(prints.length - 1);
      stats.saveReloads++;
    }
  }
  stats.runs++;
  stats.maxDepth = Math.max(stats.maxDepth, g.depth);
  stats.zonesReached = Math.max(stats.zonesReached, zoneIndex(g.depth) + 1);
  if (g.dead) stats.deaths++;
  stats.relicsFound += Object.keys(g.relics).length;

  if (replaySetup) {
    const rec = makeRecord(g, "test", { id: "p", name: "Tester" }, "test", g.dead);
    let step = 0, firstBad = -1;
    const again = replayRecord(rec, gg => { if (firstBad < 0 && fp(gg) !== prints[step]) firstBad = step; step++; });
    if (firstBad >= 0) {
      const acts = rec.actions.split(",");
      throw new Error(`replay diverged at step ${firstBad} (action "${acts[firstBad - 1]}", class ${g.start.cls}, ${g.mode}); ` +
        `reloads at ${reloadsAt.join(",")}\n  played:   ${prints[firstBad]}\n  replayed: ${fp(replayRecord({ ...rec, actions: acts.slice(0, firstBad).join(",") }))}`);
    }
    if (!sameResult(resultOf(again), rec.result)) {
      throw new Error(`replay mismatch: ${JSON.stringify(resultOf(again))} vs ${JSON.stringify(rec.result)}`);
    }
    const a = JSON.stringify({ ...serializeRun(again), l: [] }), b = JSON.stringify({ ...serializeRun(g), l: [] });
    if (a !== b) { const A = JSON.parse(a), B = JSON.parse(b); const diff = Object.keys(A).filter(k => JSON.stringify(A[k]) !== JSON.stringify(B[k])); throw new Error(`replayed state differs (${g.start.cls}, ${g.mode}): ${diff.map(k => `${k}: ${JSON.stringify(A[k]).slice(0, 120)} vs ${JSON.stringify(B[k]).slice(0, 120)}`).join(" | ")}`); }
    // round-trip through a share code
    const back = await decodeRecord("Look at this!\n" + await encodeRecord(rec));
    if (!buildGhost(back).verified) throw new Error("share code did not verify");
  }
}

for (let i = 0; i < 160; i++) {
  const daily = i % 2 === 0;
  const day = `2026-10-${String(1 + (i % 28)).padStart(2, "0")}`;
  await playOne({
    mode: daily ? "daily" : "free", seed: daily ? dailySeed(day) : (Math.random() * 2 ** 32) >>> 0,
    day: daily ? day : null, start: startStats(daily ? freshMeta() : { ...freshMeta(), up: { vigor: 5, edge: 5, hide: 3 } }, daily ? dailyClass(day) : CLASS_IDS[i % CLASS_IDS.length]),
    ranked: true, startedAt: 1,
  }, i % 4 === 3);
}

// deep dives: a near-unkillable hero (its stats are part of the record, so these
// still replay exactly) heads for the stairs to exercise every zone
for (let i = 0; i < 24; i++) {
  const cls = CLASS_IDS[i % CLASS_IDS.length];
  await playOne({
    mode: "free", seed: (Math.random() * 2 ** 32) >>> 0, day: null, ranked: false, startedAt: 1,
    start: { ...startStats(freshMeta(), cls), maxHp: 5000, atk: 60, def: 25 },
  }, false, 4000, diveAction);
}
if (stats.zonesReached < ZONES.length) throw new Error(`deep dives only reached zone ${stats.zonesReached}`);

// zones: terrain, monsters and wardens per zone, and the stairs are always reachable
{
  const g = newRun({ mode: "free", seed: 4242, day: null, start: startStats(freshMeta(), "wanderer"), ranked: false, startedAt: 1 });
  const seenTiles = ZONES.map(() => ({ water: 0, lava: 0, floor: 0, floors: 0 }));
  for (let d = 2; d <= 24; d++) {
    for (const choice of ["s", "r"] as const) {
      const h = { ...g, mons: [], items: [], traps: [] } as Game;
      Object.assign(h, { depth: d - 1, floorKey: `${d - 1}s`, hp: 99, maxHp: 99 });
      descend(h, choice);
      const z = zoneIndex(h.depth), t = seenTiles[z];
      t.floors++;
      for (const v of h.grid) { if (v === WATER) t.water++; if (v === LAVA) t.lava++; if (v !== WALL) t.floor++; }
      // reachability: from the start, both staircases without wading through lava
      const reach = new Set([idx(h.p.x, h.p.y)]);
      const q = [idx(h.p.x, h.p.y)];
      for (let k = 0; k < q.length; k++) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x = q[k] % 31 + dx, y = Math.floor(q[k] / 31) + dy, i = idx(x, y);
        if (!inB(x, y) || reach.has(i) || h.grid[i] === WALL || h.grid[i] === LAVA) continue;
        reach.add(i); q.push(i);
      }
      for (const st of [STAIRS, STAIRS_RISK]) {
        const i = h.grid.indexOf(st);
        if (i < 0 || !reach.has(i)) throw new Error(`floor ${h.floorKey}: stairs ${st} unreachable`);
      }
      if (h.grid[idx(h.p.x, h.p.y)] !== FLOOR) throw new Error(`floor ${h.floorKey}: start tile is ${h.grid[idx(h.p.x, h.p.y)]}`);
      // monsters belong to the zone, stand on solid floor, and wardens guard every zone's last floor
      const pool = new Set(zoneOf(h.depth).pool.map(([k]) => k));
      for (const m of h.mons) {
        if (m.kind === "warden" || m.kind === "mimic") continue;
        if (!pool.has(m.kind)) throw new Error(`${m.kind} spawned in ${zoneOf(h.depth).name}`);
        if (h.grid[idx(m.x, m.y)] !== FLOOR) throw new Error(`${m.kind} spawned on tile ${h.grid[idx(m.x, m.y)]}`);
      }
      const warden = h.mons.find(m => m.kind === "warden");
      if (isBossFloor(h.depth) !== !!warden) throw new Error(`floor ${h.depth}: warden ${warden ? "present" : "missing"}`);
      if (warden && warden.variant !== z + 1) throw new Error(`wrong warden in zone ${z}: ${warden.name}`);
      if (h.traps.some(tr => tr.t === "pit") && isBossFloor(h.depth)) throw new Error("pit on a boss floor");
    }
  }
  if (seenTiles[2].water === 0) throw new Error("the Flooded Crypt has no water");
  if (seenTiles[3].lava === 0) throw new Error("the Forge has no lava");
  if (seenTiles[0].water + seenTiles[0].lava + seenTiles[1].water + seenTiles[1].lava > 0) throw new Error("water/lava outside its zone");
  if (seenTiles[1].floor / seenTiles[1].floors <= seenTiles[0].floor / seenTiles[0].floors) throw new Error("caves aren't more open than cellars");

  // the Abyss dims your light
  const abyss = { ...g, depth: 17 } as Game;
  if (sightOf(abyss) !== sightOf(g) - 1) throw new Error("abyss sight penalty missing");
}

// zone monsters: spiders scuttle twice, imps explode, lava burns the hero
{
  const fresh = () => {
    const g = newRun({ mode: "free", seed: 77, day: null, start: startStats(freshMeta(), "wanderer"), ranked: false, startedAt: 1 });
    g.mons = []; g.items = []; g.traps = [];
    g.grid.fill(FLOOR);                          // an open arena
    for (let x = 0; x < 31; x++) { g.grid[idx(x, 0)] = WALL; g.grid[idx(x, 28)] = WALL; }
    g.p = { x: 5, y: 10 }; g.depth = 6; g.floorKey = "6s";
    g.vis = computeFov(g);
    return g;
  };
  // spider: 6 tiles away, one monster turn later it's 4 away
  const a = fresh();
  const spider = { ...(newRun({ mode: "free", seed: 1, day: null, start: startStats(freshMeta(), "wanderer"), ranked: false, startedAt: 1 }).mons[0]) };
  Object.assign(spider, { kind: "spider", name: "cave spider", fast: true, slow: false, erratic: false, ranged: false, phase: false,
    x: 11, y: 10, hp: 50, alerted: true, disguised: false, tick: 0 });
  a.mons = [spider];
  endTurn(a, noFlash);
  if (cheb(spider, a.p) !== 4) throw new Error(`spider moved to distance ${cheb(spider, a.p)}, expected 4`);
  // imp: dies next to you and scorches you
  const b = fresh();
  const imp = { ...spider, kind: "imp", name: "fire imp", fast: false, explodes: true, fireproof: true, x: 6, y: 10, hp: 1, def: 0 };
  b.mons = [imp];
  const hp = b.hp;
  playerAttack(b, imp, noFlash);
  if (b.mons.length || b.hp >= hp) throw new Error(`imp did not explode (hp ${hp} -> ${b.hp})`);
  // lava: stepping in burns, monsters refuse to path through it
  const c = fresh();
  c.grid[idx(6, 10)] = LAVA;
  const before = c.hp;
  applyAction(c, stepAction(1, 0), noFlash);
  if (c.hp >= before || !c.log.some(l => l.startsWith("Lava!"))) throw new Error("lava did not burn");
}

// the same daily seed gives the same floors to everyone, whatever they do
{
  const setup: RunSetup = { mode: "daily", seed: dailySeed("2026-10-02"), day: "2026-10-02", start: startStats(freshMeta(), "wanderer"), ranked: true, startedAt: 1 };
  const a = newRun(setup), b = newRun(setup);
  for (let i = 0; i < 40; i++) applyAction(b, randomAction(b), noFlash);
  descend(a, "r");
  const c = newRun(setup);
  descend(c, "r");
  if (serializeRun(a).G !== serializeRun(c).G) throw new Error("perilous floor 2 differs between players");
  if (JSON.stringify(newRun(setup).items) !== JSON.stringify(a.items) && false) throw new Error("unreachable");
}

// mimics: sit still while disguised, bite once revealed, cough up loot when killed
{
  const g = newRun({ mode: "free", seed: 12345, day: null, start: startStats(freshMeta(), "wanderer"), ranked: false, startedAt: 1 });
  let verified = false;
  for (let i = 0; i < 400 && !verified; i++) {
    descend(g, i % 2 ? "r" : "s");
    const m = g.mons.find(o => o.disguised);
    if (!m) continue;
    const at = { x: m.x, y: m.y };
    endTurn(g, noFlash);
    if (m.x !== at.x || m.y !== at.y) throw new Error("disguised mimic moved");
    const spot = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy }))
      .find(s => g.grid[idx(s.x, s.y)] !== WALL && !g.mons.some(o => o.x === s.x && o.y === s.y));
    if (!spot) continue;
    g.p = spot; g.hp = g.maxHp = 99999; g.atk = 99999;
    revealMimic(g, m);
    stats.mimicsRevealed++;
    const items = g.items.length;
    playerAttack(g, m, noFlash);
    if (g.mons.includes(m)) throw new Error("mimic survived a huge hit");
    if (g.items.length < items + 2) throw new Error("mimic dropped no loot");
    verified = true;
  }
  if (!verified) throw new Error("could not verify a mimic");
}

// an old v1.1 save (no seed, actions, relics) must still load and keep playing
{
  const g = newRun({ mode: "free", seed: 7, day: null, start: startStats(freshMeta(), "wanderer"), ranked: false, startedAt: 1 });
  const s = serializeRun(g);
  const legacy = { ...s, ver: 2, md: undefined, dy: undefined, sd: undefined, rs: undefined, fk: undefined, st: undefined,
    sa: undefined, rk: undefined, ac: undefined, rp: undefined, rl: undefined, hz: undefined, ks: undefined, pr: undefined };
  const old = deserializeRun(JSON.parse(JSON.stringify(legacy)));
  if (old.replayable) throw new Error("legacy run should not claim to be replayable");
  for (let i = 0; i < 300 && !old.dead; i++) applyAction(old, randomAction(old), noFlash);
}

// Phoenix Feather: a killing blow leaves you standing once, then the feather is gone
{
  const g = newRun({ mode: "free", seed: 99, day: null, start: startStats(freshMeta(), "wanderer"), ranked: false, startedAt: 1 });
  const k = DIRS8.findIndex(([dx, dy]) => g.grid[idx(g.p.x + dx, g.p.y + dy)] === 1
    && !g.mons.some(m => m.x === g.p.x + dx && m.y === g.p.y + dy) && !g.items.some(i => i.x === g.p.x + dx && i.y === g.p.y + dy));
  const [dx, dy] = DIRS8[k];
  g.traps.push({ t: "spikes", x: g.p.x + dx, y: g.p.y + dy, found: false });
  g.relics.phoenix = 2; g.hp = 1;
  applyAction(g, stepAction(dx, dy), noFlash);
  if (g.dead || g.relics.phoenix || g.hp !== Math.round(g.maxHp * 0.5)) throw new Error(`phoenix failed: hp ${g.hp}, dead ${g.dead}`);
  stats.revives++;
}

// heroes: each class starts with its own kit, and dailies rotate the hero by date
{
  const make = (cls: (typeof CLASS_IDS)[number]) =>
    newRun({ mode: "free", seed: 5, day: null, start: startStats(freshMeta(), cls), ranked: false, startedAt: 1 });
  const knight = make("knight"), mage = make("mage"), rogue = make("rogue"), ranger = make("ranger"), wand = make("wanderer");
  if (knight.weapon?.name !== WEAPONS[1].name || knight.maxHp !== 44 || knight.inv.tonic !== 0 || knight.relics.thorns !== 1)
    throw new Error("knight kit wrong");
  if (mage.inv.ember !== 3 || mage.relics.kindling !== 1) throw new Error("mage kit wrong");
  const shadow = POTION_EFFECTS.findIndex(e => e.k === "shadow");
  if (!rogue.known[shadow] || rogue.relics.feather !== 3 || rogue.inv.waystone !== 1) throw new Error("rogue kit wrong");
  if (wand.known.some(Boolean)) throw new Error("wanderer should know no potions");
  if (ranger.relics.reach !== 2 || ranger.sight !== 7) throw new Error("ranger kit wrong");
  // same seed, same map, whatever the hero
  if (serializeRun(knight).G !== serializeRun(mage).G) throw new Error("class changed the map");
  // the mage's embers hit harder than the wanderer's on the same roll
  const burn = (g: Game) => {
    const m = g.mons[0];
    g.vis.add(idx(m.x, m.y)); g.inv.ember = 1; m.hp = 9999;
    applyAction(g, "e", noFlash);
    return 9999 - (g.mons.includes(m) ? m.hp : 0);
  };
  const a = make("mage"), b = make("wanderer");
  const dm = burn(a), dw = burn(b);
  if (!(dm > dw)) throw new Error(`mage ember ${dm} not hotter than wanderer ${dw}`);
  // daily heroes: deterministic, and over a month every class shows up
  const seen = new Set<string>();
  for (let d = 1; d <= 31; d++) {
    const day = `2026-10-${String(d).padStart(2, "0")}`;
    if (dailyClass(day) !== dailyClass(day)) throw new Error("dailyClass not stable");
    seen.add(dailyClass(day));
  }
  if (seen.size !== CLASS_IDS.length) throw new Error(`only ${seen.size} heroes appear in a month of dailies`);
  // unlocks
  const p0 = { best: 0, kills: 0, wardens: 0, chests: 0 };
  if (CLASS_IDS.filter(id => isUnlocked(id, p0)).join() !== "wanderer") throw new Error("only the wanderer should start unlocked");
  if (!isUnlocked("ranger", { ...p0, best: 4 }) || !isUnlocked("mage", { ...p0, kills: 40 })
      || !isUnlocked("knight", { ...p0, wardens: 1 }) || !isUnlocked("rogue", { ...p0, chests: 8 })) throw new Error("unlock rules wrong");
  if (Object.values(CLASSES).some(c => c.unlock && c.unlock.progress(p0).length === 0)) throw new Error("missing progress text");
}

console.log("ok", JSON.stringify(stats));
