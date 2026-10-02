import { freshMeta, serializeRun, deserializeRun, type Game, type Meta, type RunMode, type SavedRun } from "./core.ts";
import type { Profile, RunRecord } from "./replay.ts";

/* Saves live in the device's localStorage. Writes are synchronous and cheap,
   so the run is saved after every turn. When the game is installed to the
   iPhone home screen, iOS keeps this storage instead of expiring it like a
   normal Safari tab, and we also ask the browser to mark it persistent. */

const PREFIX = "lampblack:";
const KEY_META = "lampblack:meta:v1";
const KEY_RUN: Record<RunMode, string> = { free: "lampblack:run:v1", daily: "lampblack:daily-run:v1" };
const KEY_ACTIVE = "lampblack:active:v1";
const KEY_PROFILE = "lampblack:profile:v1";
const KEY_RECORDS = "lampblack:records:v1";
const KEY_FRIENDS = "lampblack:friends:v1";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

function write(key: string, val: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { console.error("save failed:", e); return false; }
}

function remove(key: string) {
  try { localStorage.removeItem(key); } catch { /* nothing to remove */ }
}

/* ---------------- meta & runs ---------------- */

export function loadMeta(): Meta {
  return { ...freshMeta(), ...(read<Partial<Meta>>(KEY_META) ?? {}) };
}
export function saveMeta(m: Meta) { return write(KEY_META, m); }

export function loadRun(mode: RunMode): Game | null {
  const r = read<SavedRun>(KEY_RUN[mode]);
  if (!r) return null;
  try { return deserializeRun(r); }
  catch (e) { console.error("could not restore run:", e); return null; }
}
export function saveRun(g: Game) {
  write(KEY_ACTIVE, g.mode);
  return write(KEY_RUN[g.mode], serializeRun(g));
}
export function clearRun(mode: RunMode) { remove(KEY_RUN[mode]); }
export const loadActive = (): RunMode => read<RunMode>(KEY_ACTIVE) ?? "free";

/* ---------------- profile ---------------- */

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export { newId };

/* a stable id per device; later a backend can link it to an account */
export function loadProfile(): Profile {
  const p = read<Profile>(KEY_PROFILE);
  if (p?.id) return p;
  const fresh = { id: newId(), name: "" };
  write(KEY_PROFILE, fresh);
  return fresh;
}
export function saveProfile(p: Profile) { return write(KEY_PROFILE, p); }

/* ---------------- run history ---------------- */

const DAY_MS = 86400000;
const keepRecent = (recs: RunRecord[], days: number) =>
  recs.filter(r => (r.finishedAt ?? r.startedAt) > Date.now() - days * DAY_MS);

export const loadRecords = () => read<RunRecord[]>(KEY_RECORDS) ?? [];
export function addRecord(rec: RunRecord) {
  const all = [...loadRecords().filter(r => r.id !== rec.id), rec];
  // keep every daily from the last 60 days plus the last 30 free runs
  const daily = keepRecent(all.filter(r => r.mode === "daily"), 60);
  const free = all.filter(r => r.mode === "free").slice(-30);
  write(KEY_RECORDS, [...daily, ...free]);
  return loadRecords();
}

export const loadFriends = () => read<RunRecord[]>(KEY_FRIENDS) ?? [];
export function addFriendRun(rec: RunRecord) {
  // a newer share of the same run (e.g. finished after an in-progress share) replaces the old one
  const all = keepRecent([...loadFriends().filter(r => r.id !== rec.id), rec], 30);
  write(KEY_FRIENDS, all);
  return all;
}
export function removeFriendRun(id: string) {
  const all = loadFriends().filter(r => r.id !== id);
  write(KEY_FRIENDS, all);
  return all;
}

/* ---------------- device ---------------- */

/* Ask the browser not to evict our storage under pressure. */
export async function requestPersist(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* ---------------- backup codes ---------------- */
/* A backup is every lampblack:* key, as base64 text that can be pasted into
   Notes or Messages and restored on this or another device. */

const BACKUP_TAG_V1 = "LAMPBLACK1:";
const BACKUP_TAG = "LAMPBLACK2:";

function toB64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string) {
  const bin = atob(s);
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

export function exportCode(): string {
  const keys: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys[k] = localStorage.getItem(k) ?? "";
    }
  } catch { /* storage unavailable */ }
  return BACKUP_TAG + toB64(JSON.stringify({ keys }));
}

export function importCode(code: string): { ok: true } | { ok: false; why: string } {
  const trimmed = code.replace(/\s+/g, "");
  if (trimmed.startsWith(BACKUP_TAG_V1)) return importV1(trimmed.slice(BACKUP_TAG_V1.length));
  if (!trimmed.startsWith(BACKUP_TAG)) return { ok: false, why: "That doesn't look like a Lampblack save code." };
  let payload: { keys?: Record<string, string> };
  try { payload = JSON.parse(fromB64(trimmed.slice(BACKUP_TAG.length))); }
  catch { return { ok: false, why: "The code is damaged or incomplete." }; }
  const keys = payload.keys ?? {};
  if (!keys[KEY_META]) return { ok: false, why: "The code has no progress in it." };
  for (const mode of ["free", "daily"] as RunMode[]) {
    const raw = keys[KEY_RUN[mode]];
    if (!raw) continue;
    try { deserializeRun(JSON.parse(raw)); }
    catch { return { ok: false, why: "A run inside the code is damaged." }; }
  }
  try {
    const existing: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) existing.push(k); }
    for (const k of existing) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(keys)) if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
  } catch { return { ok: false, why: "This device refused to save." }; }
  return { ok: true };
}

/* the v1.0 backup format: just meta + the free run */
function importV1(b64: string): { ok: true } | { ok: false; why: string } {
  let payload: { meta?: Meta; run?: SavedRun | null };
  try { payload = JSON.parse(fromB64(b64)); }
  catch { return { ok: false, why: "The code is damaged or incomplete." }; }
  if (!payload.meta || typeof payload.meta.echoes !== "number") return { ok: false, why: "The code has no progress in it." };
  if (payload.run) {
    try { deserializeRun(payload.run); }
    catch { return { ok: false, why: "The run inside the code is damaged." }; }
  }
  if (!write(KEY_META, payload.meta)) return { ok: false, why: "This device refused to save." };
  if (payload.run) write(KEY_RUN.free, payload.run); else clearRun("free");
  return { ok: true };
}
