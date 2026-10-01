import { freshMeta, serializeRun, deserializeRun, type Game, type Meta, type SavedRun } from "./core";

/* Saves live in the device's localStorage. Writes are synchronous and cheap,
   so the run is saved after every turn. When the game is installed to the
   iPhone home screen, iOS keeps this storage instead of expiring it like a
   normal Safari tab, and we also ask the browser to mark it persistent. */

const KEY_META = "lampblack:meta:v1";
const KEY_RUN  = "lampblack:run:v1";
const BACKUP_TAG = "LAMPBLACK1:";

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

export function loadMeta(): Meta {
  return { ...freshMeta(), ...(read<Partial<Meta>>(KEY_META) ?? {}) };
}

export function saveMeta(m: Meta) { return write(KEY_META, m); }

export function loadRun(): Game | null {
  const r = read<SavedRun>(KEY_RUN);
  if (!r) return null;
  try { return deserializeRun(r); }
  catch (e) { console.error("could not restore run:", e); return null; }
}

export function saveRun(g: Game) { return write(KEY_RUN, serializeRun(g)); }

export function clearRun() {
  try { localStorage.removeItem(KEY_RUN); } catch { /* nothing to remove */ }
}

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
/* A backup is the meta + current run, as base64 text that can be pasted
   into Notes or Messages and restored on this or another device. */

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
  const payload = { meta: read(KEY_META) ?? freshMeta(), run: read(KEY_RUN) };
  return BACKUP_TAG + toB64(JSON.stringify(payload));
}

export function importCode(code: string): { ok: true } | { ok: false; why: string } {
  const trimmed = code.replace(/\s+/g, "");
  if (!trimmed.startsWith(BACKUP_TAG)) return { ok: false, why: "That doesn't look like a Lampblack save code." };
  let payload: { meta?: Meta; run?: SavedRun | null };
  try { payload = JSON.parse(fromB64(trimmed.slice(BACKUP_TAG.length))); }
  catch { return { ok: false, why: "The code is damaged or incomplete." }; }
  if (!payload.meta || typeof payload.meta.echoes !== "number") return { ok: false, why: "The code has no progress in it." };
  if (payload.run) {
    try { deserializeRun(payload.run); }
    catch { return { ok: false, why: "The run inside the code is damaged." }; }
  }
  if (!write(KEY_META, payload.meta)) return { ok: false, why: "This device refused to save." };
  if (payload.run) write(KEY_RUN, payload.run); else clearRun();
  return { ok: true };
}
