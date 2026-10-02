import { RULES_VERSION, dailySeed, dailyClass, startStats, freshMeta, type Meta, type RunMode, type StartStats } from "./core.ts";
import type { ClassId } from "./classes.ts";
import { isUnlocked } from "./classes.ts";
import { randomSeed } from "./rng.ts";
import {
  buildGhost, decodeRecord, splitRecord, verifyRecord, dailyExpectation, byRank, todayUTC, msUntilNextDay, prettyDay,
  type Ghost, type LeaderboardEntry, type Profile, type RunRecord,
} from "./replay.ts";
import { loadRecords, addRecord, loadFriends, addFriendRun, removeFriendRun, newId } from "./storage.ts";

/* ============================ the game service ============================ */
/* Everything the screens need that isn't the game itself (today's dungeon,
   starting runs, submitting results, leaderboards, ghosts) goes through this
   one interface. Today LocalGameService answers from the phone's storage; a
   CloudGameService can answer from a server (a Cloudflare Worker with D1 for
   leaderboard rows and R2 for ghost files) without the UI changing. */

export type DailyDungeon = {
  id: string;            // the UTC day, "2026-10-02"
  seed: number;          // a server would derive this from a secret so it can't be predicted
  rulesVersion: number;
  hero: ClassId;         // today's hero, the same for everyone
  expiresAt: string;     // ISO time the next daily appears
};

export type StartRequest =
  | { mode: "daily"; daily: DailyDungeon }
  | { mode: "free"; meta: Meta; cls: ClassId };

/* what a run needs before its first move; a server would also hand back a run token */
export type StartedRun = {
  runId: string; mode: RunMode; seed: number; day: string | null;
  start: StartStats; ranked: boolean; startedAt: number;
};

export type SubmitResult = { verified: boolean; reason?: string; entry: LeaderboardEntry };

export type ImportResult = { ok: boolean; message: string };

export interface GameService {
  getDailyDungeon(now?: number): Promise<DailyDungeon>;
  startRun(req: StartRequest): Promise<StartedRun>;
  submitRun(rec: RunRecord): Promise<SubmitResult>;
  getLeaderboard(day: string): Promise<LeaderboardEntry[]>;
  getGhosts(day: string): Promise<Ghost[]>;
  /* your own run for a day, to share: the first try if there is one, else the latest */
  getMyRun(day: string): Promise<RunRecord | null>;
  /* until there's a server, friends trade runs by share code */
  importRun(code: string, me: Profile): Promise<ImportResult>;
  removeRun(runId: string): Promise<void>;
}

/* ============================ local (on this phone) ============================ */

export class LocalGameService implements GameService {
  private ghostCache = new Map<string, Ghost>();

  private ghostOf(rec: RunRecord) {
    const key = `${rec.id}|${rec.actions.length}|${rec.result.score}`;
    let gh = this.ghostCache.get(key);
    if (!gh) {
      gh = buildGhost(rec, rec.mode === "daily" && rec.day ? dailyExpectation(rec.day) : null);
      this.ghostCache.set(key, gh);
    }
    return gh;
  }

  async getDailyDungeon(now = Date.now()): Promise<DailyDungeon> {
    const day = todayUTC(now);
    return {
      id: day, seed: dailySeed(day), rulesVersion: RULES_VERSION, hero: dailyClass(day),
      expiresAt: new Date(now + msUntilNextDay(now)).toISOString(),
    };
  }

  async startRun(req: StartRequest): Promise<StartedRun> {
    const startedAt = Date.now();
    if (req.mode === "daily") {
      const d = req.daily;
      // only your first attempt at a day goes on the board
      const ranked = !loadRecords().some(r => r.mode === "daily" && r.day === d.id);
      return { runId: newId(), mode: "daily", seed: d.seed, day: d.id, ranked, startedAt,
               start: startStats(freshMeta(), d.hero) };  // dailies: no upgrades, today's hero
    }
    const cls = isUnlocked(req.cls, req.meta) ? req.cls : "wanderer";
    return { runId: newId(), mode: "free", seed: randomSeed(), day: null, ranked: false, startedAt,
             start: startStats(req.meta, cls) };
  }

  async submitRun(rec: RunRecord): Promise<SubmitResult> {
    const v = verifyRecord(rec, rec.mode === "daily" && rec.day ? dailyExpectation(rec.day) : null);
    addRecord(rec);
    return { verified: v.ok, reason: v.ok ? undefined : v.reason, entry: splitRecord(rec, v.ok).entry };
  }

  async getLeaderboard(day: string): Promise<LeaderboardEntry[]> {
    const mine = loadRecords().filter(r => r.mode === "daily" && r.day === day).map(r => splitRecord(r, null).entry);
    const friends = loadFriends().filter(r => r.mode === "daily" && r.day === day)
      .map(r => splitRecord(r, this.ghostOf(r).verified).entry);
    return [...mine, ...friends].sort(byRank);
  }

  async getGhosts(day: string): Promise<Ghost[]> {
    return loadFriends().filter(r => r.mode === "daily" && r.day === day).map(r => this.ghostOf(r)).filter(g => g.verified);
  }

  async getMyRun(day: string): Promise<RunRecord | null> {
    const mine = loadRecords().filter(r => r.mode === "daily" && r.day === day);
    return mine.find(r => r.ranked) ?? mine[mine.length - 1] ?? null;
  }

  async importRun(code: string, me: Profile): Promise<ImportResult> {
    let rec: RunRecord;
    try { rec = await decodeRecord(code); }
    catch (e) { return { ok: false, message: e instanceof Error ? e.message : "That code didn't work." }; }
    if (rec.player.id === me.id) return { ok: false, message: "That's your own run!" };
    if (rec.mode !== "daily" || !rec.day) return { ok: false, message: "Only daily dungeon runs can be shared." };
    if (rec.rules !== RULES_VERSION) {
      return { ok: false, message: "That run is from a different version of the game. Both of you should update (reopen the app), then share again." };
    }
    const gh = this.ghostOf(rec);
    if (!gh.verified) return { ok: false, message: `That run can't go on the board: ${gh.reason}.` };
    addFriendRun(rec);
    const when = rec.day === todayUTC() ? "today" : prettyDay(rec.day);
    return { ok: true, message: `Added ${rec.player.name || "your friend"}'s run from ${when}: ${rec.result.score} points. Verified ✓` };
  }

  async removeRun(runId: string) { removeFriendRun(runId); }
}
