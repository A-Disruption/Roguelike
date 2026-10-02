import {
  newRun, applyAction, scoreOf, weaponTier, armorTier, normalizeStart, startStats, freshMeta, dailySeed, dailyClass,
  RULES_VERSION,
  type Game, type RunMode, type StartStats,
} from "./core.ts";

/* ============================ records ============================ */
/* A RunRecord is everything needed to reproduce a run: the seed, the starting
   hero and the list of actions. Results are included so a scoreboard can sort
   without replaying, but they are only trusted after `verifyRecord` replays the
   actions and gets the same numbers. This is the payload a client uploads; a
   server splits it (see splitRecord) into a leaderboard row and a ghost file. */

export type Profile = { id: string; name: string };

export type RunResult = {
  score: number; depth: number; kills: number;
  turns: number;            // the speed measure: verifiable by replay, unlike wall-clock time
  level: number; echoes: number;
  died: boolean; floorKey: string;
};

export type RunRecord = {
  v: 1;
  id: string;               // unique per run (game.id; a server would issue it at startRun)
  rules: number;            // RULES_VERSION it was played under
  app: string;              // app version, for debugging mismatches
  mode: RunMode;
  day: string | null;       // UTC "YYYY-MM-DD" for daily runs
  seed: number;
  start: StartStats;
  ranked: boolean;          // the player's first attempt at this daily
  player: Profile;
  startedAt: number;        // wall clock: for display only, a device can fake it
  finishedAt: number | null; // null = shared while still in progress
  result: RunResult;
  actions: string;          // comma-joined action log (see core.ts "actions")
};

export function resultOf(g: Game): RunResult {
  return {
    score: scoreOf(g), depth: g.depth, kills: g.kills, turns: g.turns, level: g.level, echoes: g.echoes,
    died: g.dead, floorKey: g.floorKey,
  };
}

export function makeRecord(g: Game, player: Profile, app: string, finished: boolean): RunRecord {
  return {
    v: 1, id: g.id, rules: RULES_VERSION, app,
    mode: g.mode, day: g.day, seed: g.seed, start: g.start, ranked: g.ranked,
    player, startedAt: g.startedAt, finishedAt: finished ? Date.now() : null,
    result: resultOf(g),
    actions: g.actions.join(","),
  };
}

/* Replays a record from scratch. onStep sees the game after the start and after
   every action. `legal` is false if some action couldn't be applied, which
   means the record was tampered with or doesn't belong to these rules. */
export function replayChecked(rec: RunRecord, onStep?: (g: Game) => void): { g: Game; legal: boolean } {
  const g = newRun({ id: rec.id, mode: rec.mode, seed: rec.seed, day: rec.day, start: normalizeStart(rec.start), ranked: rec.ranked, startedAt: rec.startedAt });
  const noop = () => {};
  onStep?.(g);
  for (const a of rec.actions ? rec.actions.split(",") : []) {
    if (!applyAction(g, a, noop)) return { g, legal: false };
    onStep?.(g);
  }
  return { g, legal: true };
}

export const replayRecord = (rec: RunRecord, onStep?: (g: Game) => void) => replayChecked(rec, onStep).g;

export function sameResult(a: RunResult, b: RunResult) {
  return a.score === b.score && a.depth === b.depth && a.kills === b.kills && a.turns === b.turns
    && a.died === b.died && a.floorKey === b.floorKey;
}

/* ============================ verification ============================ */
/* Replaying proves the moves produce the claimed score, but the record also
   claims its own seed and starting hero. For a daily those must be the official
   ones, or a doctored code could start with 9,999 health on an easy map. The
   caller supplies what's official: locally that's dailyExpectation(); a server
   would use its secret seed for the day. */

export type Expectation = { seed: number; start: StartStats } | null;
export type Verdict = { ok: true } | { ok: false; reason: string };

/* the official daily under these rules: seed from the date, today's hero, no upgrades */
export const dailyExpectation = (day: string): Expectation =>
  ({ seed: dailySeed(day), start: startStats(freshMeta(), dailyClass(day)) });

function sameStart(a: StartStats, b: StartStats) {
  const x = normalizeStart(a), y = normalizeStart(b);
  const relics = (r: StartStats["relics"]) => JSON.stringify(Object.entries(r).filter(([, t]) => t).sort());
  return x.cls === y.cls && x.maxHp === y.maxHp && x.atk === y.atk && x.def === y.def && x.sight === y.sight
    && x.tonics === y.tonics && x.greed === y.greed && x.embers === y.embers && x.waystones === y.waystones
    && x.weapon === y.weapon && relics(x.relics) === relics(y.relics);
}

export function verifyRecord(rec: RunRecord, expect: Expectation, replay = replayChecked(rec)): Verdict {
  if (rec.rules !== RULES_VERSION) return { ok: false, reason: "it was played on a different version of the game" };
  if (expect) {
    if (rec.seed !== expect.seed) return { ok: false, reason: "it wasn't played on that day's official dungeon" };
    if (!sameStart(rec.start, expect.start)) return { ok: false, reason: "its starting hero was changed" };
  }
  if (!replay.legal) return { ok: false, reason: "its moves don't add up" };
  if (!sameResult(resultOf(replay.g), rec.result)) return { ok: false, reason: "its score doesn't match its moves" };
  return { ok: true };
}

/* ============================ leaderboard rows & ghost files ============================ */
/* What a server keeps apart: every verified run gets a small leaderboard row
   (database), but only some runs keep their replay (a ghost file in storage). */

export type LeaderboardEntry = {
  runId: string; player: Profile; mode: RunMode; day: string | null; rules: number;
  score: number; depth: number; kills: number; turns: number; level: number; died: boolean;
  ranked: boolean; finished: boolean;
  verified: boolean | null;   // null = not checked (e.g. your own runs on this device)
  durationMs: number | null;  // wall clock, display only
};

export type GhostFile = { runId: string; rules: number; seed: number; start: StartStats; actions: string };

export function splitRecord(rec: RunRecord, verified: boolean | null = null): { entry: LeaderboardEntry; ghost: GhostFile } {
  return {
    entry: {
      runId: rec.id, player: rec.player, mode: rec.mode, day: rec.day, rules: rec.rules,
      score: rec.result.score, depth: rec.result.depth, kills: rec.result.kills, turns: rec.result.turns,
      level: rec.result.level, died: rec.result.died, ranked: rec.ranked, finished: rec.finishedAt !== null,
      verified, durationMs: rec.finishedAt !== null ? rec.finishedAt - rec.startedAt : null,
    },
    ghost: { runId: rec.id, rules: rec.rules, seed: rec.seed, start: rec.start, actions: rec.actions },
  };
}

/* higher score first; on a tie, fewer turns wins */
export const byRank = (a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score || a.turns - b.turns;

/* ============================ ghosts ============================ */
/* A ghost is a replayed record turned into "where were they on turn N".
   Floors with the same floorKey are identical for everyone on the same seed,
   so if you and the ghost are on the same floor at the same turn, its position
   is meaningful on your map. */

export type GhostFrame = { fk: string; x: number; y: number; cls: string; wt: number; at: number; hp: number; maxHp: number };
export type Ghost = { rec: RunRecord; frames: GhostFrame[]; verified: boolean; reason?: string };

export function buildGhost(rec: RunRecord, expect: Expectation): Ghost {
  const frames: GhostFrame[] = [];
  const replay = replayChecked(rec, gg => {
    frames[gg.turns] = {
      fk: gg.floorKey, x: gg.p.x, y: gg.p.y, hp: gg.hp, maxHp: gg.maxHp, cls: gg.start.cls,
      wt: gg.weapon ? weaponTier(gg.weapon.name) : -1,
      at: gg.armor ? armorTier(gg.armor.name) : -1,
    };
  });
  // fill any gaps so every turn index has a frame
  for (let i = 1; i < frames.length; i++) if (!frames[i]) frames[i] = frames[i - 1];
  const v = verifyRecord(rec, expect, replay);
  return { rec, frames, verified: v.ok, reason: v.ok ? undefined : v.reason };
}

/* where a ghost is when you're on `turn`; done = it has no more moves */
export function ghostAt(gh: Ghost, turn: number) {
  const last = gh.frames.length - 1;
  const f = gh.frames[Math.min(turn, last)];
  return { frame: f, done: turn >= last, died: gh.rec.result.died };
}

/* ============================ share codes ============================ */

const RUN_TAG_Z = "LAMPRUN1Z:";  // deflate-compressed
const RUN_TAG = "LAMPRUN1:";     // plain, for browsers without CompressionStream

function bytesToB64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const b64ToBytes = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeRecord(rec: RunRecord): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(rec));
  try {
    return RUN_TAG_Z + bytesToB64(await pipe(json, new CompressionStream("deflate-raw")));
  } catch {
    return RUN_TAG + bytesToB64(json);
  }
}

export async function decodeRecord(code: string): Promise<RunRecord> {
  // tolerate a message pasted around the code
  const at = code.indexOf("LAMPRUN1");
  const s = (at >= 0 ? code.slice(at) : code).replace(/\s+/g, "");
  let json: string;
  if (s.startsWith(RUN_TAG_Z)) json = new TextDecoder().decode(await pipe(b64ToBytes(s.slice(RUN_TAG_Z.length)), new DecompressionStream("deflate-raw")));
  else if (s.startsWith(RUN_TAG)) json = new TextDecoder().decode(b64ToBytes(s.slice(RUN_TAG.length)));
  else throw new Error("That isn't a Lampblack run code.");
  const rec = JSON.parse(json) as RunRecord;
  if (rec?.v !== 1 || typeof rec.seed !== "number" || typeof rec.actions !== "string"
      || typeof rec.player?.name !== "string" || typeof rec.result?.score !== "number") {
    throw new Error("The run code is damaged.");
  }
  return rec;
}

/* ============================ daily calendar ============================ */

/* Daily dungeons roll over at midnight UTC so everyone shares the same day. */
export const todayUTC = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export function msUntilNextDay(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

export function prettyDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
