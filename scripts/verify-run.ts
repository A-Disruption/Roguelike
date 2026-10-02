// Verify a shared run code the way a leaderboard server would, using the very
// same rules code as the game. Usage:
//   node scripts/verify-run.ts "LAMPRUN1Z:..."      (or pipe the code on stdin)
// A Cloudflare Worker would do exactly this inside POST /run/finish, except it
// would take the day's official seed from its own secret instead of the date.
import { decodeRecord, verifyRecord, splitRecord, dailyExpectation, replayChecked } from "../src/game/replay.ts";

const input = process.argv[2] ?? (await new Promise<string>(res => {
  let s = "";
  process.stdin.on("data", d => (s += d));
  process.stdin.on("end", () => res(s));
}));

try {
  const rec = await decodeRecord(input);
  const expect = rec.mode === "daily" && rec.day ? dailyExpectation(rec.day) : null;
  const replay = replayChecked(rec);
  const verdict = verifyRecord(rec, expect, replay);
  const { entry, ghost } = splitRecord(rec, verdict.ok);
  console.log(JSON.stringify({
    verified: verdict.ok,
    reason: verdict.ok ? undefined : verdict.reason,
    leaderboardRow: entry,
    ghostFileBytes: JSON.stringify(ghost).length,
    shareCodeBytes: input.trim().length,
  }, null, 2));
  process.exit(verdict.ok ? 0 : 1);
} catch (e) {
  console.error(`Could not read that code: ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}
