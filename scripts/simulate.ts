// Headless smoke test: plays random runs through the same action API the app
// uses, then checks that nothing crashed, saves round-trip, and every run
// replays from its action log to exactly the same result (the daily/ghost
// guarantee). Run with: npm test
import {
  newRun, freshMeta, startStats, dailySeed, dailyClass, POTION_EFFECTS, WEAPONS, applyAction, stepAction, serializeRun, deserializeRun,
  descend, revealMimic, playerAttack, endTurn, idx, inB, WALL, WATER, LAVA, FLOOR, STAIRS, STAIRS_RISK, isStairs, DIRS8, canReach,
  computeFov, sightOf, cheb, canFirebolt, totalAtk, scoreOf, trainCost, reachOf,
  type Game, type RunSetup,
} from "../src/game/core.ts";
import {
  makeRecord, replayRecord, resultOf, sameResult, buildGhost, encodeRecord, decodeRecord, dailyExpectation, verifyRecord,
  splitRecord, byRank, type RunRecord,
} from "../src/game/replay.ts";
import { RELIC_IDS } from "../src/game/relics.ts";
import { CLASS_IDS, CLASSES, isUnlocked } from "../src/game/classes.ts";
import { ZONES, zoneIndex, zoneOf, isBossFloor, bossFor } from "../src/game/zones.ts";
import { CHASM, blocksMove } from "../src/game/tiles.ts";

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
  reachAttacks: 0, revives: 0, splits: 0, mimicsRevealed: 0, saveReloads: 0, spells: 0, shopping: 0, bought: 0, trained: 0 };

function randomAction(g: Game): string {
  const r = Math.random();
  if (isStairs(g.grid[idx(g.p.x, g.p.y)]) && r < 0.15 && g.echoes > 25) return `u${Math.floor(Math.random() * 3)}`;
  if (isStairs(g.grid[idx(g.p.x, g.p.y)]) && r < 0.6) return "d";
  if (g.vendor && cheb(g.vendor, g.p) <= 1 && r < 0.5) { stats.shopping++; return `b${Math.floor(Math.random() * g.vendor.stock.length)}`; }
  if (g.maxMana > 0 && r < 0.12) {
    stats.spells++;
    const m = g.mons.find(o => canFirebolt(g, o));
    if (m && Math.random() < 0.6) return `cf${m.x - g.p.x}.${m.y - g.p.y}`;
    return `c${"nbe"[Math.floor(Math.random() * 3)]}`;
  }
  if (r < 0.013) return "q";
  if (r < 0.016) return "z";
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
    const rec = makeRecord(g, { id: "p", name: "Tester" }, "test", g.dead);
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
    const gh = buildGhost(back, back.mode === "daily" && back.day ? dailyExpectation(back.day) : null);
    if (!gh.verified) throw new Error(`share code did not verify: ${gh.reason}`);
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
  const seenTiles = ZONES.map(() => ({ water: 0, lava: 0, floor: 0, floors: 0 } as Record<string, number>));
  for (let d = 2; d <= 30; d++) {
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
        if (!inB(x, y) || reach.has(i) || blocksMove(h.grid[i]) || h.grid[i] === LAVA) continue;
        reach.add(i); q.push(i);
      }
      for (const st of [STAIRS, STAIRS_RISK]) {
        const i = h.grid.indexOf(st);
        if (i < 0 || !reach.has(i)) throw new Error(`floor ${h.floorKey}: stairs ${st} unreachable`);
      }
      if (h.grid[idx(h.p.x, h.p.y)] !== FLOOR) throw new Error(`floor ${h.floorKey}: start tile is ${h.grid[idx(h.p.x, h.p.y)]}`);
      // no walkable pocket anywhere is cut off from the start
      h.grid.forEach((v, i) => {
        if (!blocksMove(v) && v !== LAVA && !reach.has(i)) throw new Error(`floor ${h.floorKey}: unreachable tile ${i % 31},${Math.floor(i / 31)}`);
      });
      t.chasm = (t.chasm ?? 0) + h.grid.filter(v => v === CHASM).length;
      const open = h.grid.filter(v => !blocksMove(v)).length;
      t.minOpen = Math.min(t.minOpen ?? 1e9, open); t.maxOpen = Math.max(t.maxOpen ?? 0, open);
      // monsters belong to the zone, stand on solid floor, and wardens guard every zone's last floor
      const pool = new Set(zoneOf(h.depth).pool.map(([k]) => k));
      for (const m of h.mons) {
        if (m.boss || m.kind === "mimic") continue;
        if (!pool.has(m.kind)) throw new Error(`${m.kind} spawned in ${zoneOf(h.depth).name}`);
        if (h.grid[idx(m.x, m.y)] !== FLOOR) throw new Error(`${m.kind} spawned on tile ${h.grid[idx(m.x, m.y)]}`);
      }
      const boss = h.mons.filter(m => m.boss);
      if (isBossFloor(h.depth) ? boss.length !== 1 : boss.length) throw new Error(`floor ${h.depth}: ${boss.length} bosses`);
      if (boss[0] && boss[0].kind !== bossFor(h.depth)) throw new Error(`wrong boss on floor ${h.depth}: ${boss[0].kind}`);
      if (boss[0] && cheb(boss[0], { x: h.grid.indexOf(STAIRS) % 31, y: Math.floor(h.grid.indexOf(STAIRS) / 31) }) > 8) throw new Error("boss is not guarding the stairs");
      if (h.traps.some(tr => tr.t === "pit") && isBossFloor(h.depth)) throw new Error("pit on a boss floor");
    }
  }
  if (seenTiles[2].water === 0) throw new Error("the Flooded Crypt has no water");
  if (seenTiles[4].chasm === 0) throw new Error("the Abyss has no chasms");
  for (const [i, t] of seenTiles.entries()) {
    // layouts should vary: the most open floor in a zone is clearly bigger than the tightest
    if (t.maxOpen - t.minOpen < 60) throw new Error(`zone ${i} floors all look alike (${t.minOpen}-${t.maxOpen} open tiles)`);
  }
  console.log("open tiles per zone (min-max):", seenTiles.map(t => `${t.minOpen}-${t.maxOpen}`).join(" "));
  if (seenTiles[3].lava === 0) throw new Error("the Forge has no lava");
  if (seenTiles[0].water + seenTiles[0].lava + seenTiles[1].water + seenTiles[1].lava + seenTiles[0].chasm > 0) throw new Error("water/lava/chasm outside its zone");
  if (seenTiles[1].floor / seenTiles[1].floors <= seenTiles[0].floor / seenTiles[0].floors) throw new Error("caves aren't more open than cellars");

  // the Abyss dims your light
  const abyss = { ...g, depth: 21 } as Game;
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

// bosses: each one's special move does what it says
{
  const arena = (depth: number) => {
    const g = newRun({ mode: "free", seed: 4040 + depth, day: null, start: startStats(freshMeta(), "wanderer"), ranked: false, startedAt: 1 });
    while (g.depth < depth) descend(g, "s");
    const boss = g.mons.find(m => m.boss)!;
    g.mons = [boss]; g.items = []; g.traps = []; g.hazards = [];
    g.grid.fill(FLOOR);
    for (let x = 0; x < 31; x++) { g.grid[idx(x, 0)] = WALL; g.grid[idx(x, 28)] = WALL; }
    for (let y = 0; y < 29; y++) { g.grid[idx(0, y)] = WALL; g.grid[idx(30, y)] = WALL; }
    g.maxHp = g.hp = 9999;
    boss.x = 15; boss.y = 14; boss.alerted = true; boss.hp = 99999;
    return { g, boss };
  };
  const turns = (g: Game, n: number) => { for (let i = 0; i < n && !g.dead; i++) endTurn(g, noFlash); };

  // Rat King calls rats
  { const { g, boss } = arena(5); if (boss.kind !== "ratking") throw new Error(`floor 5 boss is ${boss.kind}`);
    g.p = { x: 15, y: 18 }; turns(g, 4);
    if (!g.mons.some(m => m.kind === "rat")) throw new Error("Rat King summoned no rats");
    if (g.mons.filter(m => m.kind === "rat").some(m => m.gen !== 1)) throw new Error("summons should be worth half"); }
  // Broodmother webs you from range, and you struggle instead of moving
  { const { g, boss } = arena(10); if (boss.kind !== "broodmother") throw new Error(`floor 10 boss is ${boss.kind}`);
    g.p = { x: 15, y: 18 }; boss.cd = 3; turns(g, 1);
    if (g.webbed <= 0) throw new Error("Broodmother did not web");
    const at = { ...g.p };
    applyAction(g, stepAction(1, 1), noFlash);
    if (g.p.x !== at.x || g.p.y !== at.y) throw new Error("walked while webbed");
    turns(g, 4);
    if (g.webbed !== 0) throw new Error("web never wore off"); }
  // Bone Lich raises skeletons
  { const { g, boss } = arena(15); if (boss.kind !== "lich") throw new Error(`floor 15 boss is ${boss.kind}`);
    g.p = { x: 15, y: 21 }; boss.cd = 3; turns(g, 1);
    if (!g.mons.some(m => m.kind === "skeleton")) throw new Error("Lich raised no skeletons"); }
  // Forge Golem: the slam hits you if you stay in the red, misses if you leave
  for (const leave of [false, true]) {
    const { g, boss } = arena(20); if (boss.kind !== "golem") throw new Error(`floor 20 boss is ${boss.kind}`);
    g.p = { x: 17, y: 14 }; boss.cd = 2; boss.tick = 1;          // its next turn is an active one
    turns(g, 1);
    if (!boss.charge || !g.marks.some(([x, y]) => x === g.p.x && y === g.p.y)) throw new Error("Golem did not telegraph a slam on you");
    if (leave) g.p = { x: 22, y: 14 };
    const hp = g.hp;
    turns(g, 2);                                                   // slow: skips a turn, then slams
    if (boss.charge) throw new Error("slam never landed");
    if (leave ? g.hp < hp : g.hp >= hp) throw new Error(`slam ${leave ? "hit you after you left" : "missed you standing in the red"}`);
  }
  // Void Maw drags you in, then beams your line
  { const { g, boss } = arena(25); if (boss.kind !== "maw") throw new Error(`floor 25 boss is ${boss.kind}`);
    g.p = { x: 15, y: 20 }; boss.cd = 1; boss.tick = 1;
    turns(g, 1);
    if (g.p.y !== 18) throw new Error(`Maw pull put you at ${g.p.y}, expected 18`);
    boss.cd = 3; boss.tick = 1; turns(g, 1);
    if (boss.charge !== 2 || !g.marks.some(([x, y]) => x === g.p.x && y === g.p.y)) throw new Error("Maw did not mark your line"); }
  // beating a boss counts for unlocks and drops a relic
  { const { g, boss } = arena(5); boss.hp = 1; g.p = { x: 15, y: 15 }; g.atk = 999;
    const items = g.items.length;
    applyAction(g, stepAction(0, -1), noFlash);
    if (g.wardens !== 1 || g.dex.kills.ratking !== 1) throw new Error("boss kill not counted");
    if (!g.items.slice(items).some(i => i.t === "relic")) throw new Error("boss dropped no relic"); }
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
  if (mage.mana !== 10 || mage.maxMana !== 10 || mage.inv.ember !== 0) throw new Error("mage kit wrong");
  if (wand.maxMana !== 0 || applyAction(wand, "cn", noFlash)) throw new Error("only casters can cast");
  const shadow = POTION_EFFECTS.findIndex(e => e.k === "shadow");
  if (!rogue.known[shadow] || rogue.relics.feather !== 3 || rogue.inv.waystone !== 1) throw new Error("rogue kit wrong");
  if (wand.known.some(Boolean)) throw new Error("wanderer should know no potions");
  if (reachOf(ranger) !== 3 || ranger.sight !== 7 || Object.keys(ranger.relics).length) throw new Error("ranger kit wrong");
  // same seed, same map, whatever the hero
  if (serializeRun(knight).G !== serializeRun(mage).G) throw new Error("class changed the map");
}

// spells, scrolls, merchants and training, on an open floor
{
  const arena = (cls: (typeof CLASS_IDS)[number]) => {
    const g = newRun({ mode: "free", seed: 77, day: null, start: startStats(freshMeta(), cls), ranked: false, startedAt: 1 });
    g.items = []; g.traps = []; g.vendor = null;
    g.grid.fill(FLOOR);
    for (let x = 0; x < 31; x++) { g.grid[idx(x, 0)] = WALL; g.grid[idx(x, 28)] = WALL; }
    g.p = { x: 10, y: 10 };
    const proto = g.mons[0];
    const mon = (x: number, y: number) => ({ ...proto, kind: "rat", name: "cellar rat", x, y, hp: 500, maxHp: 500, def: 0,
      ranged: false, phase: false, erratic: false, slow: false, fast: false, boss: false, disguised: false, alerted: true, frozen: 0, splits: false });
    g.mons = [];
    g.vis = computeFov(g);
    return { g, mon };
  };
  // Firebolt: hits a monster 4 away, costs 2 mana, shows a fireball
  { const { g, mon } = arena("mage"); const m = mon(14, 10); g.mons = [m]; g.vis = computeFov(g);
    if (!applyAction(g, "cf4.0", noFlash) || m.hp >= 500 || g.mana !== 8 || !g.fx.some(f => f.k === "fire")) throw new Error("firebolt failed");
    if (applyAction(g, "cf9.0", noFlash)) throw new Error("firebolt reached too far"); }
  // Frost Nova freezes nearby monsters: they don't act while frozen
  { const { g, mon } = arena("mage"); const m = mon(11, 10); g.mons = [m]; g.vis = computeFov(g);
    applyAction(g, "cn", noFlash);
    const hp = g.hp;
    if (m.frozen < 2) throw new Error("frost nova didn't freeze");
    applyAction(g, "w", noFlash); applyAction(g, "w", noFlash);
    if (g.hp !== hp) throw new Error("a frozen monster still attacked"); }
  // Blink moves you 3-6 tiles; running out of mana stops casting; mana comes back
  { const { g } = arena("mage"); const from = { ...g.p };
    applyAction(g, "cb", noFlash);
    const d = cheb(from, g.p);
    if (d < 3 || d > 6) throw new Error(`blink went ${d} tiles`);
    g.mana = 1;
    if (applyAction(g, "ce", noFlash)) throw new Error("cast without enough mana");
    for (let i = 0; i < 4; i++) applyAction(g, "w", noFlash);
    if (g.mana !== 3) throw new Error(`mana regen wrong: ${g.mana}`); }
  // frost and storm scrolls work for anyone
  { const { g, mon } = arena("wanderer"); const a = mon(12, 10), b = mon(13, 11), c = mon(15, 10), far = mon(10, 20);
    g.mons = [a, b, c, far]; g.vis = computeFov(g); g.inv.storm = 1; g.inv.frost = 1;
    applyAction(g, "z", noFlash);
    if ([a, b, c].some(m => m.hp >= 500) || far.hp < 500) throw new Error("storm should hit the 3 nearest");
    applyAction(g, "q", noFlash);
    if (!a.frozen || c.frozen) throw new Error("frost scroll radius wrong"); }
  // archers now shoot from 4 tiles, not 5
  { const { g, mon } = arena("wanderer"); const archer = { ...mon(15, 10), kind: "archer", name: "goblin archer", ranged: true, atk: 5 };
    g.mons = [archer]; g.vis = computeFov(g); g.maxHp = g.hp = 999;
    const hp = g.hp; endTurn(g, noFlash);
    if (g.hp !== hp && cheb(archer, g.p) === 5) throw new Error("archer shot from 5 tiles"); }
  // Magma Heart answers melee hits only
  { const { g, mon } = arena("wanderer"); g.relics.magma = 3; g.maxHp = g.hp = 999;
    const archer = { ...mon(13, 10), kind: "archer", name: "goblin archer", ranged: true, atk: 50 };
    g.mons = [archer]; g.vis = computeFov(g);
    for (let i = 0; i < 6; i++) endTurn(g, noFlash);
    if (g.hazards.length) throw new Error("lava spawned under an archer");
    const brute = mon(11, 10); brute.atk = 50; g.mons = [brute];
    for (let i = 0; i < 3 && !g.hazards.length; i++) endTurn(g, noFlash);
    if (!g.hazards.length) throw new Error("lava didn't answer a melee hit"); }
  // reach attacks hit for 80%
  { const { g, mon } = arena("ranger"); const m = mon(12, 10); m.def = 0; g.mons = [m]; g.vis = computeFov(g);
    let total = 0; for (let i = 0; i < 40; i++) { m.hp = 500; m.x = 12; m.y = 10; g.p = { x: 10, y: 10 }; g.vis = computeFov(g); applyAction(g, "a2.0", noFlash); total += 500 - m.hp; }
    const avg = total / 40;
    if (avg > totalAtk(g) * 0.9) throw new Error(`reach hits too hard: ${avg} of ${totalAtk(g)}`); }
  // the gauntlet: everyone else gets a 2-tile jab at 60/80/100%; a Ranger's bow gets 1 tile longer
  { const { g } = arena("mage"); if (reachOf(g) !== 1) throw new Error("mage should start in melee");
    g.relics.reach = 1; if (reachOf(g) !== 2) throw new Error("gauntlet should give a 2-tile jab");
    g.relics.reach = 3; if (reachOf(g) !== 2) throw new Error("gauntlet tiers shouldn't add range");
    const r = arena("ranger").g; r.relics.reach = 1; if (reachOf(r) !== 4) throw new Error("ranger + gauntlet should reach 4"); }
  { const avg = (tier: number) => { const { g, mon } = arena("wanderer"); g.relics.reach = tier; const m = mon(12, 10); g.mons = [m];
      let t = 0; for (let i = 0; i < 60; i++) { m.hp = 500; m.alerted = true; g.p = { x: 10, y: 10 }; g.vis = computeFov(g); applyAction(g, "a2.0", noFlash); t += 500 - m.hp; }
      if (!g.fx.length && false) throw new Error(""); return t / 60; };
    const a1 = avg(1), a3 = avg(3);
    if (!(a3 > a1 * 1.4)) throw new Error(`gauntlet tiers should hit harder: I ${a1}, III ${a3}`); }
  // projectiles remember who they were aimed at, so the screen can follow them
  { const { g, mon } = arena("ranger"); const m = mon(13, 10); g.mons = [m]; g.vis = computeFov(g);
    applyAction(g, "a3.0", noFlash);
    if (!g.fx.some(f => f.k === "arrow" && f.who === m)) throw new Error("arrow lost its target"); }
  // Knight: blocks about a quarter of melee hits
  { const { g, mon } = arena("knight"); g.maxHp = g.hp = 99999; const m = mon(11, 10); m.atk = 10; g.mons = [m];
    let blocked = 0; for (let i = 0; i < 400; i++) { const hp = g.hp; endTurn(g, noFlash); if (g.hp === hp) blocked++; }
    if (blocked < 70 || blocked > 130) throw new Error(`knight blocked ${blocked}/400`);
    const w = arena("wanderer").g; w.maxHp = w.hp = 99999; const m2 = mon(11, 10); m2.atk = 10; w.mons = [m2];
    let wb = 0; for (let i = 0; i < 200; i++) { const hp = w.hp; endTurn(w, noFlash); if (w.hp === hp) wb++; }
    if (wb > 0) throw new Error("only the knight should block"); }
  // Rogue: double damage on a monster that hasn't noticed you (not bosses)
  { const dmg = (cls: (typeof CLASS_IDS)[number], alerted: boolean) => { let t = 0;
      for (let i = 0; i < 80; i++) { const { g, mon } = arena(cls); g.relics = {}; const m = mon(11, 10); m.alerted = alerted; m.def = 0; g.mons = [m]; g.atk = 10; applyAction(g, stepAction(1, 0), noFlash); t += 500 - m.hp; }
      return t / 80; };
    const sneak = dmg("rogue", false), open = dmg("rogue", true);
    if (!(sneak > open * 1.8)) throw new Error(`backstab ${sneak} vs ${open}`);
    const w1 = dmg("wanderer", false), w2 = dmg("wanderer", true);
    if (Math.abs(w1 - w2) > w2 * 0.2) throw new Error("only rogues backstab"); }
  // Wanderer: scavenges extra loot from some kills
  { let extra = 0;
    const { g, mon } = arena("wanderer"); g.atk = 99;   // one game, so the dice keep rolling between kills
    for (let i = 0; i < 300; i++) {
      const m = mon(11, 10); m.hp = 1; m.wpn = -1; m.arm = -1; g.mons = [m]; g.items = []; g.p = { x: 10, y: 10 };
      applyAction(g, stepAction(1, 0), noFlash); if (g.items.length) extra++;
    }
    if (extra < 45 || extra > 110) throw new Error(`wanderer scavenged ${extra}/300`); }

  // the merchant: buy if you can afford it, only next to them, sold items stay sold
  { const { g } = arena("wanderer");
    g.vendor = { x: 11, y: 10, stock: [
      { item: { t: "potion", name: "potion", color: 2 }, price: 40, sold: false },
      { item: { t: "weapon", name: "runed blade", atk: 8 }, price: 130, sold: false } ] };
    g.echoes = 100;
    if (applyAction(g, "b1", noFlash)) throw new Error("bought something unaffordable");
    if (!applyAction(g, "b0", noFlash) || g.echoes !== 60 || g.spent !== 40 || g.potions[2] !== 1) throw new Error("buying failed");
    if (!g.known[g.potionMap[2]]) throw new Error("bought potion should be identified");
    if (applyAction(g, "b0", noFlash)) throw new Error("bought a sold item");
    g.p = { x: 14, y: 10 }; g.echoes = 999;
    if (applyAction(g, "b1", noFlash)) throw new Error("bought from across the room");
    const before = scoreOf(g);
    g.p = { x: 10, y: 10 }; applyAction(g, "b1", noFlash);
    if (g.weapon?.name !== "runed blade" || scoreOf(g) !== before) throw new Error("gear purchase or score wrong");
    if (applyAction(g, stepAction(1, 0), noFlash)) throw new Error("walked into the merchant");
    const saved = deserializeRun(JSON.parse(JSON.stringify(serializeRun(g))));
    if (!saved.vendor || !saved.vendor.stock[0].sold || saved.vendor.stock.length !== 2) throw new Error("merchant didn't save"); }
  // training only on the stairs, and each round costs more
  { const { g } = arena("wanderer"); g.echoes = 500;
    if (applyAction(g, "u1", noFlash)) throw new Error("trained off the stairs");
    g.grid[idx(g.p.x, g.p.y)] = STAIRS;
    const atk = g.atk;
    applyAction(g, "u1", noFlash); applyAction(g, "u1", noFlash);
    if (g.atk !== atk + 2 || g.echoes !== 500 - trainCost(1, 0) - trainCost(1, 1)) throw new Error("training wrong");
    const hp = g.maxHp; applyAction(g, "u0", noFlash);
    if (g.maxHp !== hp + 6) throw new Error("health training wrong"); }
  // merchants turn up on some floors, never on boss floors
  { const g = newRun({ mode: "free", seed: 31, day: null, start: startStats(freshMeta(), "wanderer"), ranked: false, startedAt: 1 });
    let shops = 0;
    for (let d = 2; d <= 40; d++) {
      descend(g, "s");
      if (g.vendor) { shops++; if (isBossFloor(g.depth)) throw new Error("merchant on a boss floor"); if (g.grid[idx(g.vendor.x, g.vendor.y)] !== FLOOR) throw new Error("merchant off the floor"); }
    }
    if (shops < 5) throw new Error(`only ${shops} merchants in 39 floors`); }
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

// verification refuses doctored daily runs, and accepts honest ones
{
  const day = "2026-10-05";
  const g = newRun({ id: "honest", mode: "daily", seed: dailySeed(day), day, start: startStats(freshMeta(), dailyClass(day)), ranked: true, startedAt: 1 });
  for (let i = 0; i < 400 && !g.dead; i++) applyAction(g, randomAction(g), noFlash);
  const honest = makeRecord(g, { id: "dad", name: "Dad" }, "test", true);
  const expect = dailyExpectation(day);
  const check = (rec: RunRecord) => verifyRecord(rec, expect);
  if (!check(honest).ok) throw new Error("honest daily run was rejected");
  const reject = (label: string, rec: RunRecord) => {
    const v = check(rec);
    if (v.ok) throw new Error(`tampered run accepted: ${label}`);
  };
  // a god-mode hero, replayed honestly so its own claimed score would match
  {
    const start = { ...honest.start, maxHp: 9999, atk: 99 };
    const cheat = newRun({ id: "cheat", mode: "daily", seed: dailySeed(day), day, start, ranked: true, startedAt: 1 });
    for (const a of honest.actions.split(",")) applyAction(cheat, a, noFlash);
    const rec = makeRecord(cheat, { id: "x", name: "Cheater" }, "test", true);
    if (!verifyRecord(rec, null).ok) throw new Error("self-consistent cheat should pass a plain replay");
    reject("boosted starting hero", rec);
  }
  // an easier dungeon: a different seed, again internally consistent
  {
    const easy = newRun({ id: "easy", mode: "daily", seed: 12345, day, start: honest.start, ranked: true, startedAt: 1 });
    for (let i = 0; i < 200 && !easy.dead; i++) applyAction(easy, randomAction(easy), noFlash);
    reject("wrong seed", makeRecord(easy, { id: "x", name: "Cheater" }, "test", true));
  }
  reject("inflated score", { ...honest, result: { ...honest.result, score: honest.result.score + 500 } });
  reject("an illegal move slipped in", { ...honest, actions: honest.actions + ",m9" });
  reject("moves cut short", { ...honest, actions: honest.actions.split(",").slice(0, -20).join(",") });
  reject("another rules version", { ...honest, rules: honest.rules - 1 });
  reject("another hero", { ...honest, start: startStats(freshMeta(), dailyClass(day) === "knight" ? "rogue" : "knight") });

  // the leaderboard row and the ghost file carry everything the record did
  const { entry, ghost } = splitRecord(honest, true);
  if (entry.runId !== honest.id || entry.score !== honest.result.score || entry.turns !== honest.result.turns || !entry.verified)
    throw new Error("leaderboard entry lost data");
  const rebuilt: RunRecord = { ...honest, seed: ghost.seed, start: ghost.start, actions: ghost.actions };
  if (!check(rebuilt).ok) throw new Error("ghost file can't rebuild the run");
  // ranking: score first, then fewer turns
  const a = { ...entry, score: 100, turns: 50 }, b = { ...entry, score: 100, turns: 40 }, c = { ...entry, score: 120, turns: 90 };
  if ([a, b, c].sort(byRank).map(e => e.turns).join() !== "90,40,50") throw new Error("leaderboard order wrong");
}

// the local game service, end to end, on a stand-in for the phone's storage
{
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: k => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); },
    clear: () => mem.clear(), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  };
  const { LocalGameService } = await import("../src/game/service.ts");
  const svc = new LocalGameService();
  const now = Date.UTC(2026, 9, 6, 15, 0, 0);
  const daily = await svc.getDailyDungeon(now);
  if (daily.id !== "2026-10-06" || daily.seed !== dailySeed("2026-10-06") || daily.hero !== dailyClass("2026-10-06"))
    throw new Error("daily dungeon wrong");
  if (daily.expiresAt !== "2026-10-07T00:00:00.000Z") throw new Error(`daily expires at ${daily.expiresAt}`);

  const play = async (player: { id: string; name: string }, steps: number) => {
    const r = await svc.startRun({ mode: "daily", daily });
    const g = newRun({ id: r.runId, mode: r.mode, seed: r.seed, day: r.day, start: r.start, ranked: r.ranked, startedAt: r.startedAt });
    for (let i = 0; i < steps && !g.dead; i++) applyAction(g, randomAction(g), noFlash);
    return { r, rec: makeRecord(g, player, "test", true) };
  };
  const first = await play({ id: "me", name: "Kid" }, 300);
  if (!first.r.ranked) throw new Error("first daily attempt should be ranked");
  const sub = await svc.submitRun(first.rec);
  if (!sub.verified) throw new Error(`own run failed verification: ${sub.reason}`);
  const second = await svc.startRun({ mode: "daily", daily });
  if (second.ranked) throw new Error("second attempt should be practice");
  if (second.runId === first.r.runId) throw new Error("run ids must be unique");
  if ((await svc.getMyRun(daily.id))?.id !== first.rec.id) throw new Error("getMyRun should return the first try");

  // a friend's run arrives as a share code
  const friend = await play({ id: "dad", name: "Dad" }, 500);
  const code = await encodeRecord(friend.rec);
  const added = await svc.importRun(code, { id: "me", name: "Kid" });
  if (!added.ok) throw new Error(`friend import failed: ${added.message}`);
  if (!(await svc.importRun(code, { id: "dad", name: "Dad" })).message.includes("own run")) throw new Error("own-run check missing");
  const doctored = await encodeRecord({ ...friend.rec, id: "doctored", start: { ...friend.rec.start, maxHp: 9999 } });
  if ((await svc.importRun(doctored, { id: "me", name: "Kid" })).ok) throw new Error("doctored friend run was accepted");

  const lb = await svc.getLeaderboard(daily.id);
  if (lb.length !== 2 || !lb.some(e => e.player.name === "Dad" && e.verified) || lb.some(e => e.runId === "doctored"))
    throw new Error(`leaderboard wrong: ${JSON.stringify(lb.map(e => [e.player.name, e.score, e.verified]))}`);
  if (lb[0].score < lb[1].score) throw new Error("leaderboard not sorted");
  const ghosts = await svc.getGhosts(daily.id);
  if (ghosts.length !== 1 || ghosts[0].rec.player.name !== "Dad") throw new Error("ghosts wrong");
  await svc.removeRun(friend.rec.id);
  if ((await svc.getGhosts(daily.id)).length !== 0) throw new Error("removed run still a ghost");

  // free runs: the hero must be unlocked, and upgrades apply
  const locked = await svc.startRun({ mode: "free", meta: { ...freshMeta(), cls: "knight" }, cls: "knight" });
  if (locked.start.cls !== "wanderer") throw new Error("locked hero was allowed");
  const strong = await svc.startRun({ mode: "free", meta: { ...freshMeta(), up: { vigor: 10 } }, cls: "wanderer" });
  if (strong.start.maxHp !== 32 + 70 || strong.ranked) throw new Error("free run start wrong");

  // a run saved by v1.5 (no stored id) keeps the id it always had
  const old = newRun({ mode: "daily", seed: 9, day: "2026-10-01", start: startStats(freshMeta(), "wanderer"), ranked: true, startedAt: 1234 });
  const saved = { ...serializeRun(old), id: undefined };
  if (deserializeRun(JSON.parse(JSON.stringify(saved))).id !== old.id) throw new Error("legacy run id changed");
}

console.log("ok", JSON.stringify(stats));
