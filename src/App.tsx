import { useEffect, useRef, useReducer, useState, useCallback, useMemo, type MouseEvent } from "react";
import {
  C, MW, MH, VW, VH, STAIRS, STAIRS_RISK, UPGRADES, WEAPONS, POTION_COLORS, POTION_EFFECTS, RULES_VERSION,
  idx, inB, say, totalAtk, totalDef, newRun, startStats, freshMeta, dailySeed, dailyClass, applyAction, stepAction,
  canReach, reachOf, bfsPath, potionLabel, relicLabel, relicBlurb, scoreOf, mergeDex,
  type Game, type Meta, type Upgrade, type Flash, type RunMode,
} from "./game/core";
import { drawMap, playerSprite, potionSprite, relicSprite, spriteCanvas, type GhostMark } from "./game/sprites";
import { zoneOf, zoneIndex } from "./game/zones";
import {
  loadMeta, saveMeta, loadRun, saveRun, clearRun, loadActive, requestPersist, isStandalone, isIOS,
  exportCode, importCode, loadProfile, saveProfile, loadRecords, addRecord, loadFriends, addFriendRun, removeFriendRun,
} from "./game/storage";
import {
  makeRecord, buildGhost, ghostAt, encodeRecord, decodeRecord, todayUTC, prettyDay,
  type Ghost, type Profile, type RunRecord,
} from "./game/replay";
import { randomSeed } from "./game/rng";
import { TIER_NAMES, type RelicId } from "./game/relics";
import { CLASSES, CLASS_IDS, isUnlocked, classOf, type ClassId } from "./game/classes";
import { ACHIEVEMENTS, combinedDex, newlyEarned } from "./game/bestiary";
import { Shell, SpriteIcon, ActBtn, linkBtn, btn, act3, textArea, sectionTitle, Stat, Row } from "./ui/bits";
import { DailyCard } from "./ui/Daily";
import { Collection } from "./ui/Collection";
import { PauseMenu } from "./ui/PauseMenu";

/* a run's id is derived from its seed and start time, so an in-progress share
   and the finished run share an id and the newer one replaces the older */
const runId = (g: Game) => `${g.mode}-${g.seed.toString(36)}-${g.startedAt.toString(36)}`;

/* ============================ potion tray ============================ */

function PotionTray({ g, onDrink, onClose }: { g: Game; onDrink: (color: number) => void; onClose: () => void }) {
  const held = POTION_COLORS.map((_, c) => c).filter(c => g.potions[c] > 0);
  return (
    <div style={{ borderTop: `1px solid ${C.memWall}`, padding: "8px 12px 0", display: "flex", flexDirection: "column", gap: 6 }}>
      {held.length === 0 && <div style={{ fontSize: 13.5, color: C.dim }}>No potions yet. Look for colored bottles.</div>}
      {held.map(c => {
        const eff = g.potionMap[c];
        const known = g.known[eff];
        return (
          <button key={c} className="lb-btn" onClick={() => onDrink(c)}
            style={{ ...act3(C.bone), display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "8px 10px" }}>
            <SpriteIcon src={potionSprite(c)} size={22} />
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14.5 }}>{potionLabel(g, c)}</span>
              <span style={{ display: "block", fontSize: 12, color: C.dim, fontWeight: 400 }}>
                {known ? POTION_EFFECTS[eff].blurb : "unknown. Drink it to find out!"}
              </span>
            </span>
            <span className="lb-mono" style={{ fontSize: 13, color: C.dim }}>×{g.potions[c]}</span>
          </button>
        );
      })}
      <button onClick={onClose} style={{ ...linkBtn, alignSelf: "flex-start" }}>Close</button>
    </div>
  );
}

/* ============================ relics ============================ */

function RelicStrip({ g, open, onToggle }: { g: Game; open: boolean; onToggle: () => void }) {
  const owned = (Object.keys(g.relics) as RelicId[]).filter(id => g.relics[id]);
  if (!owned.length) return null;
  return (
    <div style={{ borderBottom: `1px solid ${C.memWall}` }}>
      <button className="lb-btn" onClick={onToggle} aria-label="relics"
        style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", padding: "5px 14px", background: "none", border: "none", cursor: "pointer", flexWrap: "wrap" }}>
        {owned.map(id => (
          <span key={id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <SpriteIcon src={relicSprite(id, g.relics[id]!)} size={18} />
            <span className="lb-mono" style={{ fontSize: 11, color: C.dim }}>{TIER_NAMES[g.relics[id]!]}</span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.memGlyph }}>{open ? "hide" : "relics"}</span>
      </button>
      {open && (
        <div style={{ padding: "2px 14px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
          {owned.map(id => (
            <div key={id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
              <SpriteIcon src={relicSprite(id, g.relics[id]!)} size={20} />
              <span><b style={{ fontWeight: 600 }}>{relicLabel(id, g.relics[id]!)}</b>
                <span style={{ color: C.dim }}> · {relicBlurb(id, g.relics[id]!)}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ hero picker ============================ */

function HeroPicker({ meta, onPick }: { meta: Meta; onPick: (id: ClassId) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "0 0 14px" }}>
      {CLASS_IDS.map(id => {
        const c = CLASSES[id];
        const open = isUnlocked(id, meta);
        const picked = meta.cls === id;
        return (
          <button key={id} className="lb-btn" disabled={!open} onClick={() => onPick(id)} aria-pressed={picked}
            style={{
              font: "inherit", textAlign: "left", cursor: open ? "pointer" : "default", borderRadius: 4,
              padding: "9px 10px", background: picked ? "#2A1E12" : "transparent", color: C.bone,
              border: `1px solid ${picked ? C.ember : C.memWall}`, opacity: open ? 1 : 0.55,
              gridColumn: id === "wanderer" ? "1 / -1" : undefined,
            }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SpriteIcon src={playerSprite({ weapon: c.weapon >= 0 ? WEAPONS[c.weapon] : null, armor: null, start: { cls: id } })} size={26} />
              <span style={{ fontSize: 15.5, fontWeight: 600 }}>{c.name}</span>
            </span>
            <span style={{ display: "block", fontSize: 12, color: C.dim, marginTop: 4, lineHeight: 1.35 }}>
              {open ? c.blurb : `Locked: ${c.unlock!.text} (${c.unlock!.progress(meta)})`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================ backup panel ============================ */

function Backup({ onRestored }: { onRestored: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const make = async () => {
    const c = exportCode();
    setCode(c);
    try { await navigator.clipboard.writeText(c); setMsg({ text: "Copied. Paste it into Notes or a message to keep it safe." }); }
    catch { setMsg({ text: "Select the code below and copy it somewhere safe." }); }
  };

  const share = async () => {
    try { await navigator.share({ title: "Lampblack save", text: code || exportCode() }); }
    catch { /* cancelled */ }
  };

  const restore = () => {
    if (!code.trim()) { setMsg({ text: "Paste a save code into the box first.", bad: true }); return; }
    if (!confirm("Replace the progress on this device with the pasted save?")) return;
    const r = importCode(code);
    if (!r.ok) { setMsg({ text: r.why, bad: true }); return; }
    setMsg({ text: "Restored." });
    setCode("");
    onRestored();
  };

  if (!open) return <button onClick={() => setOpen(true)} style={linkBtn}>Back up or restore a save</button>;

  return (
    <div style={{ border: `1px solid ${C.memWall}`, borderRadius: 3, padding: 12, margin: "4px 0 12px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button className="lb-btn" onClick={make} style={{ ...act3(C.bone), flex: 1 }}>Make backup code</button>
        {"share" in navigator && (
          <button className="lb-btn" onClick={share} style={{ ...act3(C.bone), flex: 1 }}>Share…</button>
        )}
      </div>
      <textarea value={code} onChange={e => setCode(e.target.value)} placeholder="…or paste a save code here to restore it"
        rows={3} className="lb-mono" style={textArea} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <button className="lb-btn" onClick={restore} style={{ ...act3(C.ember), flex: 1 }}>Restore from code</button>
        <button onClick={() => { setOpen(false); setMsg(null); setCode(""); }} style={linkBtn}>Close</button>
      </div>
      {msg && <p style={{ margin: "8px 0 0", fontSize: 13, color: msg.bad ? C.blood : C.verd }}>{msg.text}</p>}
    </div>
  );
}

/* ============================ upgrades ============================ */

function Upgrades({ meta, onBuy }: { meta: Meta; onBuy: (u: Upgrade) => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span className="lb-mono" style={{ fontSize: 28, color: C.verd }}>{meta.echoes}</span>
        <span style={{ color: C.dim }}>echoes to spend</span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.dim, lineHeight: 1.45 }}>
        Upgrades make every hero stronger in your own descents. Daily dungeons always start without them, so the scoreboard stays fair.
      </p>
      {UPGRADES.map(u => {
        const lvl = meta.up[u.k] || 0;
        const maxed = lvl >= u.max;
        const cost = maxed ? 0 : u.costs[lvl];
        const afford = !maxed && meta.echoes >= cost;
        return (
          <button key={u.k} className="lb-btn" disabled={maxed || !afford} onClick={() => onBuy(u)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 2px",
              background: "none", border: "none", borderBottom: `1px solid ${C.memWall}`,
              color: "inherit", textAlign: "left", cursor: maxed || !afford ? "default" : "pointer",
              opacity: maxed ? 0.5 : afford ? 1 : 0.65, font: "inherit",
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16.5, fontWeight: 600 }}>{u.name} <span className="lb-mono" style={{ fontSize: 12, color: C.dim, fontWeight: 400 }}>lvl {lvl}/{u.max}</span></div>
              <div style={{ fontSize: 13, color: C.dim }}>{u.blurb} per level</div>
              <div style={{ height: 3, background: C.memWall, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ width: `${(lvl / u.max) * 100}%`, height: "100%", background: C.ember }} />
              </div>
            </div>
            <div className="lb-mono" style={{ width: 56, textAlign: "right", fontSize: 14, color: maxed ? C.dim : afford ? C.verd : C.memGlyph }}>
              {maxed ? "max" : cost}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================ component ============================ */

type SaveState = "idle" | "saved" | "failed";
type Tab = "play" | "upgrades" | "collection" | "more";
type Summary = {
  mode: RunMode; day: string | null; depth: number; kills: number; earned: number; level: number;
  score: number; record: boolean; ranked: boolean; abandoned: boolean; unlocked: ClassId[]; feats: string[];
};

export default function LampblackDepths() {
  const runs = useRef<Record<RunMode, Game | null>>({ free: null, daily: null });
  const G = useRef<Game | null>(null);  // the run on screen
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [screen, setScreen] = useState<"loading" | "hub" | "game" | "death">("loading");
  const [tab, setTab] = useState<Tab>("play");
  const [meta, setMetaState] = useState<Meta>(loadMeta);
  const metaRef = useRef(meta);
  const setMeta = (m: Meta) => { metaRef.current = m; setMetaState(m); saveMeta(m); };
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const [records, setRecords] = useState<RunRecord[]>(loadRecords);
  const [friends, setFriends] = useState<RunRecord[]>(loadFriends);
  const [flashes, setFlashes] = useState<Record<number, string>>({});
  const [ts, setTs] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [installed] = useState(isStandalone);
  const [tray, setTray] = useState(false);
  const [relicsOpen, setRelicsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [zoneCard, setZoneCard] = useState<{ name: string; intro: string; depth: number } | null>(null);
  const lastZone = useRef("");
  const zoneTimer = useRef<number | undefined>(undefined);
  const mapBox = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const walkTimer = useRef<number | undefined>(undefined);
  const flashTimer = useRef<Record<number, number>>({});
  const ghostCache = useRef(new Map<string, Ghost>());

  const today = todayUTC(now);

  /* ---------------- ghosts ---------------- */

  const ghostsFor = useCallback((day: string | null) => {
    if (!day) return [];
    return friends.filter(r => r.mode === "daily" && r.day === day).map(r => {
      const key = `${r.id}|${r.actions.length}`;
      let gh = ghostCache.current.get(key);
      if (!gh) { gh = buildGhost(r); ghostCache.current.set(key, gh); }
      return gh;
    });
  }, [friends]);

  const todaysGhosts = useMemo(() => ghostsFor(today), [ghostsFor, today]);

  /* ---------------- storage ---------------- */

  const persistRun = useCallback(() => {
    const g = G.current;
    if (!g || g.dead) return;
    setSaveState(saveRun(g) ? "saved" : "failed");
  }, []);

  /* belt and braces: also save when the app is backgrounded or closed */
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "hidden") persistRun(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", persistRun);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", persistRun);
    };
  }, [persistRun]);

  const stopWalk = useCallback(() => {
    clearTimeout(walkTimer.current);
    if (G.current) G.current.path = null;
  }, []);

  /* boot: resume straight into whichever run was last on screen */
  const loadAll = useCallback((resume: boolean) => {
    stopWalk();
    const m = loadMeta();
    // players from before achievements existed get credit for what they've already done
    const earned = newlyEarned(m);
    setMeta(earned.length ? { ...m, ach: [...m.ach, ...earned] } : m);
    setProfileState(loadProfile());
    setRecords(loadRecords());
    setFriends(loadFriends());
    runs.current = { free: loadRun("free"), daily: loadRun("daily") };
    const active = loadActive();
    G.current = runs.current[active] ?? runs.current.free ?? runs.current.daily;
    if (G.current) setSaveState("saved");
    setScreen(resume && G.current ? "game" : "hub");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopWalk]);

  useEffect(() => {
    loadAll(true);
    requestPersist();
  }, [loadAll]);

  /* tick the daily countdown while on the main screen */
  useEffect(() => {
    if (screen !== "hub") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [screen]);

  const setName = (name: string) => {
    const p = { ...profile, name };
    setProfileState(p);
    saveProfile(p);
  };

  /* ---------------- canvas ---------------- */

  useEffect(() => {
    const fit = () => {
      const el = mapBox.current;
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      setTs(Math.max(16, Math.floor(Math.min(w / VW, h / VH))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (mapBox.current) ro.observe(mapBox.current);
    window.addEventListener("resize", fit);
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
  }, [screen]);

  const ghostMarks = (g: Game): GhostMark[] => {
    if (g.mode !== "daily") return [];
    return ghostsFor(g.day).flatMap(gh => {
      const { frame, done, died } = ghostAt(gh, g.turns);
      if (!frame || frame.fk !== g.floorKey) return [];
      return [{ x: frame.x, y: frame.y, cls: frame.cls ?? "wanderer", wt: frame.wt, at: frame.at, dead: done && died }];
    });
  };

  /* monsters a reach attack can hit right now get amber brackets */
  const targetsOf = (g: Game) =>
    reachOf(g) > 1 ? new Set(g.mons.filter(m => !m.disguised && canReach(g, m)).map(m => idx(m.x, m.y))) : new Set<number>();

  useEffect(() => {
    const cv = canvasRef.current, g = G.current;
    if (!cv || !g || screen !== "game") return;
    const dpr = window.devicePixelRatio || 1;
    const w = VW * ts, h = VH * ts;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const camX = Math.max(0, Math.min(MW - VW, g.p.x - (VW >> 1)));
    const camY = Math.max(0, Math.min(MH - VH, g.p.y - (VH >> 1)));
    drawMap(ctx, g, ts, camX, camY, flashes, ghostMarks(g), targetsOf(g), Date.now());
  });

  /* red danger tiles pulse while a boss attack is coming */
  const hasMarks = screen === "game" && !!G.current?.marks.length;
  useEffect(() => {
    if (!hasMarks) return;
    const t = window.setInterval(force, 120);
    return () => clearInterval(t);
  }, [hasMarks]);

  /* ---------------- turns ---------------- */

  const flash: Flash = useCallback((i, kind) => {
    setFlashes(f => ({ ...f, [i]: kind }));
    clearTimeout(flashTimer.current[i]);
    flashTimer.current[i] = window.setTimeout(() => {
      setFlashes(f => { const n = { ...f }; delete n[i]; return n; });
    }, 170);
  }, []);

  const finishRun = useCallback((g: Game, abandoned = false) => {
    const m = metaRef.current;
    const earned = Math.round(g.echoes * g.greed);
    let nm: Meta = {
      ...m, echoes: m.echoes + earned, best: Math.max(m.best, g.depth),
      runs: m.runs + 1, kills: m.kills + g.kills, wardens: m.wardens + g.wardens, chests: m.chests + g.chests,
      dex: mergeDex(m.dex, g.dex), maxPerils: Math.max(m.maxPerils, g.perils),
      dailies: m.dailies + (g.mode === "daily" ? 1 : 0), maxEarned: Math.max(m.maxEarned, earned),
    };
    const unlocked = CLASS_IDS.filter(id => !isUnlocked(id, m) && isUnlocked(id, nm));
    const feats = newlyEarned(nm);
    nm = { ...nm, ach: [...nm.ach, ...feats] };
    setMeta(nm);
    if (g.replayable) setRecords(addRecord(makeRecord(g, runId(g), loadProfile(), __APP_VERSION__, true)));
    setSummary({
      mode: g.mode, day: g.day, depth: g.depth, kills: g.kills, earned, level: g.level,
      score: scoreOf(g), record: g.depth > m.best, ranked: g.ranked, abandoned, unlocked, feats,
    });
    clearRun(g.mode);
    runs.current[g.mode] = null;
    if (G.current === g) G.current = null;
    setPaused(false);
    setScreen("death");
  }, []);

  /* the single way the player changes the game: every legal action is logged for replays */
  const doAction = useCallback((a: string) => {
    const g = G.current;
    if (!g || g.dead) return false;
    if (!applyAction(g, a, flash)) return false;
    if (g.dead) { force(); setTimeout(() => finishRun(g), 550); return true; }
    persistRun();
    force();
    return true;
  }, [flash, finishRun, persistRun]);

  const enemyInSight = (g: Game) => g.mons.some(m => !m.disguised && g.vis.has(idx(m.x, m.y)));

  const stepWalk = useCallback(() => {
    const g = G.current;
    if (!g || g.dead || !g.path || !g.path.length) { if (g) g.path = null; force(); return; }
    if (enemyInSight(g)) { g.path = null; force(); return; }
    const next = g.path.shift()!;
    const item = g.items.some(i => i.x === next.x && i.y === next.y);
    const ok = doAction(stepAction(next.x - g.p.x, next.y - g.p.y));
    if (ok && !g.dead && g.path && g.path.length && !item && !enemyInSight(g)) {
      walkTimer.current = window.setTimeout(stepWalk, 85);
    } else { g.path = null; force(); }
  }, [doAction]);

  const onCanvasTap = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const g = G.current;
    if (!g || g.dead) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const camX = Math.max(0, Math.min(MW - VW, g.p.x - (VW >> 1)));
    const camY = Math.max(0, Math.min(MH - VH, g.p.y - (VH >> 1)));
    const tx = camX + Math.floor((e.clientX - rect.left) / ts);
    const ty = camY + Math.floor((e.clientY - rect.top) / ts);
    if (!inB(tx, ty)) return;
    if (g.path) { stopWalk(); force(); return; }
    const dx = tx - g.p.x, dy = ty - g.p.y;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d === 0) { doAction("w"); return; }
    if (d === 1) { doAction(stepAction(dx, dy)); return; }
    // a monster a few tiles away: shoot it if it's in reach
    const m = g.mons.find(o => o.x === tx && o.y === ty && !o.disguised && g.vis.has(idx(tx, ty)));
    if (m && canReach(g, m)) { doAction(`a${dx}.${dy}`); return; }
    if (m && reachOf(g) > 1) {
      say(g, d > reachOf(g) ? `Too far: you can reach ${reachOf(g)} tiles. Step closer.` : "No clear shot from here.");
      force();
      return;
    }
    const path = bfsPath(g, tx, ty);
    if (!path) return;
    // with something watching you, take one careful step instead of walking the whole way
    if (enemyInSight(g)) { doAction(stepAction(path[0].x - g.p.x, path[0].y - g.p.y)); return; }
    g.path = path;
    stepWalk();
  }, [ts, doAction, stepWalk, stopWalk]);

  const onPotion = (c: number) => { setTray(false); doAction(`p${c}`); };

  /* ---------------- zone title cards ---------------- */

  useEffect(() => {
    const g = G.current;
    if (screen !== "game" || !g) return;
    const key = `${runId(g)}:${zoneIndex(g.depth)}`;
    if (lastZone.current === key) return;
    lastZone.current = key;
    const z = zoneOf(g.depth);
    setZoneCard({ name: z.name, intro: z.intro, depth: g.depth });
    clearTimeout(zoneTimer.current);
    zoneTimer.current = window.setTimeout(() => setZoneCard(null), 2600);
  });

  useEffect(() => () => { clearTimeout(walkTimer.current); clearTimeout(zoneTimer.current); }, []);

  /* ---------------- starting & leaving runs ---------------- */

  const enter = (g: Game) => {
    stopWalk();
    G.current = g;
    runs.current[g.mode] = g;
    setTray(false);
    setRelicsOpen(false);
    setPaused(false);
    persistRun();
    setScreen("game");
  };

  const startFree = () => {
    if (runs.current.free && !confirm("Abandon this run? Echoes from it will be lost.")) return;
    enter(newRun({
      mode: "free", seed: randomSeed(), day: null, ranked: false, startedAt: Date.now(),
      start: startStats(metaRef.current, isUnlocked(metaRef.current.cls, metaRef.current) ? metaRef.current.cls : "wanderer"),
    }));
  };

  const playDaily = () => {
    const live = runs.current.daily;
    if (live) { enter(live); return; }
    const day = todayUTC();
    const ranked = !records.some(r => r.mode === "daily" && r.day === day);
    enter(newRun({
      // dailies always use a fresh profile: no echo upgrades, today's hero
      mode: "daily", seed: dailySeed(day), day, start: startStats(freshMeta(), dailyClass(day)), ranked, startedAt: Date.now(),
    }));
  };

  const giveUpDaily = () => {
    const g = runs.current.daily;
    if (!g) return;
    if (!confirm("End this daily run now? Your score so far goes on the board.")) return;
    finishRun(g, true);
  };

  const leaveToHub = () => {
    stopWalk();
    persistRun();
    setPaused(false);
    setScreen("hub");
  };

  /* ---------------- sharing ---------------- */

  const shareDaily = async (): Promise<string | null> => {
    const live = runs.current.daily;
    const named = { ...profile, name: profile.name.trim() };
    let rec: RunRecord | null = null;
    if (live && live.day === today && live.replayable) rec = makeRecord(live, runId(live), named, __APP_VERSION__, false);
    else {
      const mine = records.filter(r => r.mode === "daily" && r.day === today);
      const pickRec = mine.find(r => r.ranked) ?? mine[mine.length - 1];
      if (pickRec) rec = { ...pickRec, player: named };
    }
    return rec ? encodeRecord(rec) : null;
  };

  const addFriend = async (code: string): Promise<string> => {
    let rec: RunRecord;
    try { rec = await decodeRecord(code); }
    catch (e) { return e instanceof Error ? e.message : "That code didn't work."; }
    if (rec.player.id === profile.id) return "That's your own run!";
    if (rec.mode !== "daily") return "Only daily dungeon runs can be shared.";
    if (rec.rules !== RULES_VERSION) return "That run is from a different version of the game. Both of you should update (reopen the app), then share again.";
    const gh = buildGhost(rec);
    ghostCache.current.set(`${rec.id}|${rec.actions.length}`, gh);
    setFriends(addFriendRun(rec));
    const when = rec.day === today ? "today" : prettyDay(rec.day ?? today);
    return gh.verified
      ? `Added ${rec.player.name || "your friend"}'s run from ${when}: ${rec.result.score} points. Verified ✓`
      : `Added ${rec.player.name || "your friend"}'s run, but its replay didn't match its score, so treat it with suspicion.`;
  };

  /* ---------------- upgrades ---------------- */

  const buy = (u: Upgrade) => {
    const m = metaRef.current;
    const lvl = m.up[u.k] || 0;
    if (lvl >= u.max) return;
    const cost = u.costs[lvl];
    if (m.echoes < cost) return;
    setMeta({ ...m, echoes: m.echoes - cost, up: { ...m.up, [u.k]: lvl + 1 } });
  };

  const wipe = () => {
    if (!confirm("Erase ALL progress? Echoes, upgrades, the bestiary and the current run will be gone for good.")) return;
    setMeta(freshMeta());
    G.current = null;
    runs.current.free = null;
    clearRun("free");
  };

  /* ---------------- screens ---------------- */

  if (screen === "loading") {
    return <Shell><div style={{ margin: "auto", color: C.dim }} className="lb-mono">lighting the lamp…</div></Shell>;
  }

  if (screen === "hub") {
    const free = runs.current.free;
    const dex = combinedDex(meta, runs.current.free?.dex, runs.current.daily?.dex);
    const tabs: [Tab, string][] = [["play", "Play"], ["upgrades", "Upgrades"], ["collection", "Collection"], ["more", "More"]];
    return (
      <Shell>
        <div style={{ padding: "14px 20px 0", maxWidth: 560, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SpriteIcon name={classOf(meta.cls).sprite} size={26} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", flex: 1 }}>The Lampblack Depths</h1>
            <span className="lb-mono" style={{ color: C.verd, fontSize: 14 }}>{meta.echoes}</span>
          </div>
          <nav style={{ display: "flex", marginTop: 12, borderBottom: `1px solid ${C.memWall}` }}>
            {tabs.map(([k, label]) => (
              <button key={k} className="lb-btn" onClick={() => setTab(k)} aria-pressed={tab === k}
                style={{ flex: 1, font: "inherit", fontSize: 14.5, fontWeight: 600, padding: "9px 4px", background: "none", cursor: "pointer",
                         border: "none", borderBottom: `2px solid ${tab === k ? C.ember : "transparent"}`, color: tab === k ? C.bone : C.dim }}>
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 24px", maxWidth: 560, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {tab === "play" && (<>
            {!installed && isIOS() && (
              <div style={{ background: "#1F1810", border: `1px solid ${C.litWall}`, borderRadius: 3, padding: "10px 12px", marginBottom: 18, fontSize: 14, lineHeight: 1.45 }}>
                <b style={{ color: C.ember }}>Install it first.</b> Tap the Share button, then <b>Add to Home Screen</b>.
                Open the game from that icon and your saves are kept for good.
              </div>
            )}

            <DailyCard
              day={today} now={now}
              live={runs.current.daily}
              mine={records.filter(r => r.mode === "daily" && r.day === today)}
              ghosts={todaysGhosts}
              name={profile.name}
              onName={setName}
              onPlay={playDaily}
              onGiveUp={giveUpDaily}
              onShare={shareDaily}
              onAdd={addFriend}
              onRemoveFriend={id => setFriends(removeFriendRun(id))}
            />

            <h2 style={{ ...sectionTitle, margin: "0 0 8px" }}>Your own descent</h2>
            <div style={{ display: "flex", gap: 22, padding: "10px 0 12px", borderBottom: `1px solid ${C.memWall}`, marginBottom: 14 }}>
              <Stat label="deepest" value={meta.best || "—"} color={C.ember} />
              <Stat label="descents" value={meta.runs} />
              <Stat label="kills" value={meta.kills} />
              <Stat label="feats" value={`${meta.ach.length}/${ACHIEVEMENTS.length}`} />
            </div>

            <h3 style={{ ...sectionTitle, margin: "0 0 8px" }}>Hero</h3>
            <HeroPicker meta={meta} onPick={cls => setMeta({ ...metaRef.current, cls })} />

            <div style={{ display: "flex", gap: 10, margin: "4px 0 10px" }}>
              {free && (
                <button className="lb-btn" onClick={() => enter(free)} style={btn(C.ember, true)}>
                  Return to floor {free.depth}
                </button>
              )}
              <button className="lb-btn" onClick={startFree} style={btn(free ? C.dim : C.ember, !free)}>
                {free ? "Abandon and start over" : "Descend"}
              </button>
            </div>
          </>)}

          {tab === "upgrades" && <Upgrades meta={meta} onBuy={buy} />}

          {tab === "collection" && <Collection meta={meta} dex={dex} />}

          {tab === "more" && (
            <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.6 }}>
              <h2 style={{ ...sectionTitle, margin: "0 0 8px" }}>How to play</h2>
              <ul style={{ margin: "0 0 16px", paddingLeft: 18 }}>
                <li>Tap a tile next to you to move or attack. Tap your hero to wait a turn.</li>
                <li>Tap a far tile to walk there. If something is watching, you take one careful step at a time.</li>
                <li>Heroes with reach (the Ranger, or the Reaching Gauntlet) can tap a monster with amber corners to hit it from afar.</li>
                <li>Tap your hero's picture in the top bar to pause and see your gear, pack and relics.</li>
                <li>Every floor has two ways down. The red stair is perilous: tougher monsters, more treasure and bonus points.</li>
                <li>Every 5th floor a boss guards the stairs. When the floor glows red, get off those tiles!</li>
                <li>Progress saves after every move. You can close the app and come back.</li>
              </ul>
              <h2 style={{ ...sectionTitle, margin: "0 0 8px" }}>Your save</h2>
              <Backup onRestored={() => loadAll(false)} />
              <div><button onClick={wipe} style={linkBtn}>Erase all progress</button></div>
              <p className="lb-mono" style={{ margin: "14px 0 0", fontSize: 11, color: C.memGlyph }}>v{__APP_VERSION__} · rules {RULES_VERSION}</p>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  if (screen === "death" && summary) {
    const daily = summary.mode === "daily";
    return (
      <Shell>
        <div style={{ margin: "auto", padding: 26, maxWidth: 420, width: "100%", boxSizing: "border-box", overflowY: "auto" }}>
          <div className="lb-mono" style={{ color: summary.abandoned ? C.dim : C.blood, fontSize: 40, lineHeight: 1 }}>{summary.abandoned ? "·" : "†"}</div>
          <h2 style={{ fontSize: 27, fontWeight: 600, margin: "12px 0 2px" }}>{summary.abandoned ? "You climb back out" : "The lamp goes out"}</h2>
          <p style={{ color: C.dim, margin: "0 0 22px", fontSize: 15 }}>
            {daily
              ? `${prettyDay(summary.day ?? today)} daily · ${summary.ranked ? "your first try, it's on the board" : "practice run"}`
              : summary.record ? "Deeper than you have ever been." : "The dark keeps what it takes."}
          </p>
          <Row k="score" v={summary.score} color={C.ember} />
          <Row k="reached" v={`floor ${summary.depth}`} />
          <Row k="killed" v={summary.kills} />
          <Row k="level" v={summary.level} />
          <Row k="echoes carried out" v={summary.earned} color={C.verd} />
          {summary.unlocked.map(id => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 12px",
                                   border: `1px solid ${C.ember}`, borderRadius: 4, background: "#2A1E12" }}>
              <SpriteIcon name={CLASSES[id].sprite} size={32} />
              <span><b style={{ color: C.ember }}>New hero unlocked: {CLASSES[id].name}!</b>
                <span style={{ display: "block", fontSize: 13, color: C.dim }}>{CLASSES[id].blurb}</span></span>
            </div>
          ))}
          {summary.feats.map(id => {
            const a = ACHIEVEMENTS.find(x => x.id === id)!;
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "8px 12px",
                                     border: `1px solid ${C.litWall}`, borderRadius: 4 }}>
                <span style={{ width: 26, height: 26, borderRadius: 13, background: C.ember, color: "#0A0C10", display: "flex", alignItems: "center", justifyContent: "center" }}>★</span>
                <span><b>{a.name}</b><span style={{ display: "block", fontSize: 12.5, color: C.dim }}>{a.text}</span></span>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {daily
              ? <button className="lb-btn" onClick={() => { setTab("play"); setScreen("hub"); }} style={btn(C.ember, true)}>See the scoreboard</button>
              : <button className="lb-btn" onClick={startFree} style={btn(C.ember, true)}>Descend again</button>}
            <button className="lb-btn" onClick={() => { setTab(daily ? "play" : "upgrades"); setScreen("hub"); }} style={btn(C.dim, false)}>{daily ? "Main screen" : "Spend echoes"}</button>
          </div>
        </div>
      </Shell>
    );
  }

  const g = G.current;
  if (!g) {
    return (
      <Shell>
        <div style={{ margin: "auto", textAlign: "center", padding: 24 }}>
          <p style={{ color: C.dim, marginBottom: 14 }}>No run in progress.</p>
          <button className="lb-btn" onClick={() => setScreen("hub")} style={btn(C.ember, true)}>Back</button>
        </div>
      </Shell>
    );
  }

  const tile = g.grid[idx(g.p.x, g.p.y)];
  const onStairs = tile === STAIRS || tile === STAIRS_RISK;
  const hpPct = Math.max(0, g.hp / g.maxHp);
  const saveColor = saveState === "failed" ? C.blood : saveState === "saved" ? C.verd : C.memGlyph;
  const potionCount = g.potions.reduce((a, b) => a + b, 0);
  const boss = g.mons.find(m => m.boss && !m.disguised && g.vis.has(idx(m.x, m.y)));
  const ghostInfo = g.mode === "daily" ? ghostsFor(g.day).map(gh => {
    const { frame, done, died } = ghostAt(gh, g.turns);
    return { name: gh.rec.player.name || "friend", depth: parseInt(frame?.fk ?? "1", 10), here: frame?.fk === g.floorKey, fell: done && died };
  }) : [];

  return (
    <Shell>
      <div style={{ padding: "8px 12px 7px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${C.memWall}` }}>
        <button className="lb-btn" onClick={() => { stopWalk(); setPaused(true); }} aria-label="pause and inventory"
          style={{ background: "#151A22", border: `1px solid ${C.memWall}`, borderRadius: 4, padding: 3, cursor: "pointer", lineHeight: 0 }}>
          <SpriteIcon src={playerSprite(g)} size={30} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.dim, marginBottom: 3, gap: 6 }}>
            <span className="lb-mono" style={{ color: hpPct < 0.3 ? C.blood : C.bone }}>{g.hp}/{g.maxHp}</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {g.mode === "daily" && <b style={{ color: C.ember, fontWeight: 600 }}>DAILY · </b>}
              floor {g.depth}{g.floorKey.endsWith("r") ? "☠" : ""} · {totalAtk(g)}atk {totalDef(g)}def
            </span>
          </div>
          <div style={{ height: 4, background: C.memWall, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${hpPct * 100}%`, height: "100%", background: hpPct < 0.3 ? C.blood : C.ember, transition: "width 160ms" }} />
          </div>
        </div>
        {g.inv.key > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <SpriteIcon name="key" size={16} />
            <span className="lb-mono" style={{ fontSize: 13 }}>{g.inv.key}</span>
          </span>
        )}
        <span className="lb-mono" style={{ color: C.verd, fontSize: 13 }}>{g.mode === "daily" ? scoreOf(g) : g.echoes}</span>
        <span aria-label={saveState === "failed" ? "not saving" : "saved"}
          style={{ display: "block", width: 8, height: 8, borderRadius: 4, background: saveColor, flexShrink: 0 }} />
      </div>

      {boss && (
        <div style={{ padding: "5px 14px 6px", borderBottom: `1px solid ${C.memWall}`, background: "#1A0E0C", display: "flex", alignItems: "center", gap: 10 }}>
          <SpriteIcon src={spriteCanvas(boss.kind)} size={20} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <b style={{ color: C.blood, fontWeight: 600 }}>{boss.name}</b>
              {boss.charge > 0 && <span style={{ color: "#FF7A5A", fontWeight: 600 }}>get out of the red!</span>}
            </div>
            <div style={{ height: 5, background: "#3A1A16", borderRadius: 2, overflow: "hidden", marginTop: 3 }}>
              <div style={{ width: `${Math.max(0, boss.hp / boss.maxHp) * 100}%`, height: "100%", background: C.blood, transition: "width 160ms" }} />
            </div>
          </div>
        </div>
      )}

      <RelicStrip g={g} open={relicsOpen} onToggle={() => setRelicsOpen(o => !o)} />

      {ghostInfo.length > 0 && (
        <div style={{ padding: "4px 14px", fontSize: 12.5, color: "#6FC4C8", borderBottom: `1px solid ${C.memWall}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ghostInfo.map(i => `${i.name} ${i.fell ? "fell on" : i.here ? "is here ·" : "is on"} floor ${i.depth}`).join("  ·  ")}
        </div>
      )}

      {saveState === "failed" && (
        <div style={{ background: "#2A100C", color: C.blood, fontSize: 12.5, padding: "6px 14px", lineHeight: 1.4 }}>
          This device refused to save. If you're in a private browsing tab, open the game from the home screen instead.
        </div>
      )}

      <div ref={mapBox} style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 4, position: "relative" }}>
        <canvas ref={canvasRef} className="lb-map" onClick={onCanvasTap}
          style={{ width: VW * ts, height: VH * ts, display: "block" }} />
        {zoneCard && (
          <div key={zoneCard.name + zoneCard.depth} className="lb-zone" aria-live="polite"
            style={{ position: "absolute", left: 16, right: 16, top: "30%", textAlign: "center", pointerEvents: "none",
                     background: "rgba(8,10,14,0.82)", border: `1px solid ${zoneOf(zoneCard.depth).colors.wallTop}`, borderRadius: 4, padding: "14px 12px" }}>
            <div className="lb-mono" style={{ fontSize: 11, color: C.dim, letterSpacing: "0.12em" }}>FLOOR {zoneCard.depth}</div>
            <div style={{ fontSize: 26, fontWeight: 600, margin: "2px 0 4px" }}>{zoneCard.name}</div>
            <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.4 }}>{zoneCard.intro}</div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 14px", height: 40, display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
        {g.log.slice(-2).map((l, i, a) => (
          <div key={g.log.length - a.length + i} style={{ fontSize: 13.5, color: i === a.length - 1 ? C.bone : C.memGlyph, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>
        ))}
      </div>

      {tray && <PotionTray g={g} onDrink={onPotion} onClose={() => setTray(false)} />}

      <div style={{ display: "flex", gap: 6, padding: "8px 10px 14px", borderTop: tray ? "none" : `1px solid ${C.memWall}` }}>
        {onStairs
          ? <button className="lb-btn" onClick={() => doAction("d")}
              style={{ ...act3(tile === STAIRS_RISK ? "#FFF4E8" : C.void), flex: 1.4, background: tile === STAIRS_RISK ? C.blood : C.ember, border: `1px solid ${tile === STAIRS_RISK ? C.blood : C.ember}`,
                       display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
              Go down
              {tile === STAIRS_RISK && <span style={{ fontSize: 10.5, fontWeight: 600 }}>perilous</span>}
            </button>
          : <button className="lb-btn" onClick={() => doAction("w")} style={{ ...act3(C.dim), flex: 1.4 }}>Wait</button>}
        <ActBtn label="Tonic" n={g.inv.tonic} onClick={() => doAction("t")} sprite="tonic" />
        <ActBtn label="Potions" n={potionCount} onClick={() => setTray(t => !t)} sprite="potion" active={tray} />
        <ActBtn label="Ember" n={g.inv.ember} onClick={() => doAction("e")} sprite="ember" />
        <ActBtn label="Waystone" n={g.inv.waystone} onClick={() => doAction("y")} sprite="waystone" />
      </div>

      {paused && <PauseMenu g={g} onResume={() => setPaused(false)} onCamp={leaveToHub} />}
    </Shell>
  );
}
