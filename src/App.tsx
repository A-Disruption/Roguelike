import { useEffect, useRef, useReducer, useState, useCallback, type MouseEvent } from "react";
import {
  C, MW, MH, VW, VH, STAIRS, STAIRS_RISK, UPGRADES, WEAPONS, POTION_COLORS, POTION_EFFECTS, RULES_VERSION,
  idx, inB, say, totalAtk, totalDef, newRun, freshMeta, applyAction, stepAction,
  canReach, reachOf, bfsPath, potionLabel, relicLabel, relicBlurb, scoreOf, mergeDex,
  SPELLS, SPELL_IDS, TRAINING, trainCost, canFirebolt, cheb, vendorAt, ARMORS, weaponTier, armorTier,
  type Game, type Meta, type Upgrade, type Flash, type RunMode, type SpellId, type Item,
} from "./game/core";
import { drawMap, drawFx, FX_MS, playerSprite, potionSprite, relicSprite, spriteCanvas, itemSprite, type GhostMark } from "./game/sprites";
import type { Fx } from "./game/core";
import { Modal, modalBtn } from "./ui/Modal";
import { zoneOf, zoneIndex } from "./game/zones";
import {
  loadMeta, saveMeta, loadRun, saveRun, clearRun, loadActive, requestPersist, isStandalone, isIOS,
  exportCode, importCode, loadProfile, saveProfile,
} from "./game/storage";
import {
  makeRecord, ghostAt, encodeRecord, todayUTC, prettyDay,
  type Ghost, type Profile, type RunRecord, type LeaderboardEntry,
} from "./game/replay";
import { LocalGameService, type GameService, type StartedRun } from "./game/service";
import { TIER_NAMES, type RelicId } from "./game/relics";
import { CLASSES, CLASS_IDS, isUnlocked, classOf, type ClassId } from "./game/classes";
import { ACHIEVEMENTS, combinedDex, newlyEarned } from "./game/bestiary";
import { Shell, SpriteIcon, ActBtn, linkBtn, btn, act3, textArea, sectionTitle, Stat, Row } from "./ui/bits";
import { DailyCard } from "./ui/Daily";
import { Collection } from "./ui/Collection";
import { PauseMenu } from "./ui/PauseMenu";

/* where dailies, leaderboards and ghosts come from: this phone for now, a server later */
const service: GameService = new LocalGameService();

const runFrom = (r: StartedRun) => newRun({
  id: r.runId, mode: r.mode, seed: r.seed, day: r.day, start: r.start, ranked: r.ranked, startedAt: r.startedAt,
});

/* ============================ items, spells, shop ============================ */

const SCROLLS: { key: "ember" | "frost" | "storm" | "waystone"; act: string; name: string; blurb: string }[] = [
  { key: "ember", act: "e", name: "ember scroll", blurb: "burns every monster in sight" },
  { key: "frost", act: "q", name: "frost scroll", blurb: "freezes everything within 2 tiles" },
  { key: "storm", act: "z", name: "storm scroll", blurb: "lightning strikes the 3 nearest monsters" },
  { key: "waystone", act: "y", name: "waystone", blurb: "teleports you somewhere you've been" },
];

/* what an item does, in a few words (for the merchant) */
function itemBlurb(g: Game, it: Omit<Item, "x" | "y">) {
  switch (it.t) {
    case "tonic": return "heals almost half your health";
    case "potion": return POTION_EFFECTS[g.potionMap[it.color ?? 0]].blurb;
    case "weapon": return `+${it.atk} attack${g.weapon ? ` (yours: +${g.weapon.atk})` : ""}`;
    case "armor": return `+${it.def} armor${g.armor ? ` (yours: +${g.armor.def})` : ""}`;
    case "relic": return it.relic && it.tier ? relicBlurb(it.relic, it.tier) : "";
    default: return SCROLLS.find(x => x.key === it.t)?.blurb ?? "";
  }
}

function itemTitle(g: Game, it: Omit<Item, "x" | "y">) {
  if (it.t === "potion") return POTION_EFFECTS[g.potionMap[it.color ?? 0]].name;   // merchants label their potions
  if (it.t === "relic" && it.relic && it.tier) return relicLabel(it.relic, it.tier);
  return it.name;
}

function TrayRow({ icon, title, sub, right, onClick, disabled }: {
  icon: React.ReactNode; title: string; sub: string; right: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button className="lb-btn" onClick={onClick} disabled={disabled}
      style={{ ...act3(C.bone), display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "7px 10px", opacity: disabled ? 0.45 : 1 }}>
      {icon}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5 }}>{title}</span>
        <span style={{ display: "block", fontSize: 12, color: C.dim, fontWeight: 400 }}>{sub}</span>
      </span>
      <span className="lb-mono" style={{ fontSize: 13, color: C.dim }}>{right}</span>
    </button>
  );
}

function ItemTray({ g, onUse, onClose }: { g: Game; onUse: (action: string) => void; onClose: () => void }) {
  const potions = POTION_COLORS.map((_, c) => c).filter(c => g.potions[c] > 0);
  const scrolls = SCROLLS.filter(sc => g.inv[sc.key] > 0);
  return (
    <div style={{ borderTop: `1px solid ${C.memWall}`, padding: "8px 12px 0", display: "flex", flexDirection: "column", gap: 5, maxHeight: "38vh", overflowY: "auto" }}>
      {!potions.length && !scrolls.length && <div style={{ fontSize: 13.5, color: C.dim }}>Nothing to use yet. Look for scrolls and colored bottles.</div>}
      {scrolls.map(sc => (
        <TrayRow key={sc.key} icon={<SpriteIcon name={sc.key} size={22} />} title={sc.name} sub={sc.blurb}
          right={`×${g.inv[sc.key]}`} onClick={() => onUse(sc.act)} />
      ))}
      {potions.map(c => {
        const eff = g.potionMap[c];
        return <TrayRow key={c} icon={<SpriteIcon src={potionSprite(c)} size={22} />} title={potionLabel(g, c)}
          sub={g.known[eff] ? POTION_EFFECTS[eff].blurb : "unknown. Drink it to find out!"} right={`×${g.potions[c]}`} onClick={() => onUse(`p${c}`)} />;
      })}
      <button onClick={onClose} style={{ ...linkBtn, alignSelf: "flex-start" }}>Close</button>
    </div>
  );
}

function SpellTray({ g, onCast, onAim, onClose }: { g: Game; onCast: (id: SpellId) => void; onAim: () => void; onClose: () => void }) {
  return (
    <div style={{ borderTop: `1px solid ${C.memWall}`, padding: "8px 12px 0", display: "flex", flexDirection: "column", gap: 5 }}>
      {SPELL_IDS.map(id => {
        const sp = SPELLS[id];
        return <TrayRow key={id} icon={<span style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, background: SPELL_COLOR[id] }} />}
          title={sp.name} sub={sp.blurb} right={`${sp.cost} mana`} disabled={g.mana < sp.cost}
          onClick={() => (id === "f" ? onAim() : onCast(id))} />;
      })}
      <button onClick={onClose} style={{ ...linkBtn, alignSelf: "flex-start" }}>Close</button>
    </div>
  );
}

const SPELL_COLOR: Record<SpellId, string> = { f: "#E9A13B", n: "#9FE0F0", b: "#B6C8F0", e: "#C04A3B" };

function Shop({ g, onBuy, onClose }: { g: Game; onBuy: (slot: number) => void; onClose: () => void }) {
  const v = g.vendor!;
  return (
    <Modal title="The merchant" icon={<SpriteIcon name="vendor" size={40} />} onClose={onClose}
      actions={<button className="lb-btn" onClick={onClose} style={modalBtn(C.ember, true)}>Done</button>}>
      <p style={{ margin: "0 0 10px", color: C.dim }}>"Echoes, friend. Everything has a price down here." You have <b className="lb-mono" style={{ color: C.verd }}>{g.echoes}</b>.</p>
      {v.stock.map((s, i) => {
        const icon = s.item.t === "potion" ? potionSprite(s.item.color ?? 0) : itemSprite({ ...s.item, x: 0, y: 0 });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.memWall}`, opacity: s.sold ? 0.45 : 1 }}>
            <SpriteIcon src={icon} size={28} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5 }}>{itemTitle(g, s.item)}</span>
              <span style={{ display: "block", fontSize: 12, color: C.dim }}>{itemBlurb(g, s.item)}</span>
            </span>
            {s.sold
              ? <span style={{ fontSize: 12.5, color: C.dim }}>sold</span>
              : <button className="lb-btn" disabled={g.echoes < s.price} onClick={() => onBuy(i)}
                  style={{ ...act3(g.echoes < s.price ? C.memGlyph : C.verd), padding: "7px 10px", minWidth: 64 }}>
                  <span className="lb-mono">{s.price}</span>
                </button>}
          </div>
        );
      })}
    </Modal>
  );
}

/* on the stairs: spend this run's echoes on training before going down */
function TrainBar({ g, onTrain }: { g: Game; onTrain: (k: number) => void }) {
  return (
    <div style={{ borderTop: `1px solid ${C.memWall}`, padding: "7px 10px 0" }}>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 5 }}>
        Train before you go down · <span className="lb-mono" style={{ color: C.verd }}>{g.echoes}</span> echoes
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {TRAINING.map((t, k) => {
          const cost = trainCost(k, g.train[k]);
          return (
            <button key={k} className="lb-btn" disabled={g.echoes < cost} onClick={() => onTrain(k)}
              style={{ ...act3(g.echoes < cost ? C.memGlyph : C.bone), flex: 1, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: 12.5 }}>{t.blurb}</span>
              <span className="lb-mono" style={{ fontSize: 11.5, color: g.echoes < cost ? C.memGlyph : C.verd }}>{cost}</span>
            </button>
          );
        })}
      </div>
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
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [ghostsByDay, setGhostsByDay] = useState<Record<string, Ghost[]>>({});
  const [flashes, setFlashes] = useState<Record<number, string>>({});
  const [ts, setTs] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [installed] = useState(isStandalone);
  const [tray, setTray] = useState<"none" | "items" | "spells">("none");
  const [aiming, setAiming] = useState(false);
  const [shop, setShop] = useState(false);
  const fxCanvas = useRef<HTMLCanvasElement>(null);
  const fxQueue = useRef<{ fx: Fx; start: number; dur: number; camX: number; camY: number }[]>([]);
  const fxRaf = useRef(0);
  const tsRef = useRef(30);
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

  const today = todayUTC(now);

  /* ---------------- ghosts ---------------- */

  const ghostsFor = useCallback((day: string | null) => (day ? ghostsByDay[day] ?? [] : []), [ghostsByDay]);

  /* fetch a day's scoreboard and ghosts from the service */
  const refreshDaily = useCallback(async (day: string) => {
    const [b, gh] = await Promise.all([service.getLeaderboard(day), service.getGhosts(day)]);
    if (day === todayUTC()) setBoard(b);
    setGhostsByDay(prev => ({ ...prev, [day]: gh }));
  }, []);

  useEffect(() => { refreshDaily(today); }, [today, refreshDaily]);

  /* a daily from an earlier day still needs that day's ghosts */
  const liveDay = G.current?.mode === "daily" ? G.current.day : null;
  useEffect(() => { if (liveDay && !ghostsByDay[liveDay]) refreshDaily(liveDay); }, [liveDay, ghostsByDay, refreshDaily]);

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
    refreshDaily(todayUTC());
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
    const targets = aiming ? new Set(g.mons.filter(m => !m.disguised && canFirebolt(g, m)).map(m => idx(m.x, m.y))) : targetsOf(g);
    drawMap(ctx, g, ts, camX, camY, flashes, ghostMarks(g), targets, Date.now());
  });

  /* ---------------- effects: projectiles and bursts fly over the map ---------------- */

  tsRef.current = ts;
  const fxTick = useCallback(() => {
    const cv = fxCanvas.current;
    if (!cv) { fxRaf.current = 0; return; }
    const ts2 = tsRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = VW * ts2, h = VH * ts2;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = performance.now();
    fxQueue.current = fxQueue.current.filter(q => t < q.start + q.dur);
    for (const q of fxQueue.current) {
      if (t < q.start) continue;
      drawFx(ctx, q.fx, (t - q.start) / q.dur, ts2, q.camX, q.camY);
    }
    fxRaf.current = fxQueue.current.length ? requestAnimationFrame(fxTick) : 0;
  }, []);

  const playFx = useCallback((g: Game) => {
    if (!g.fx.length) return;
    const camX = Math.max(0, Math.min(MW - VW, g.p.x - (VW >> 1)));
    const camY = Math.max(0, Math.min(MH - VH, g.p.y - (VH >> 1)));
    const t = performance.now();
    g.fx.forEach((fx, i) => fxQueue.current.push({ fx, start: t + i * 70, dur: FX_MS[fx.k] ?? 250, camX, camY }));
    if (!fxRaf.current) fxRaf.current = requestAnimationFrame(fxTick);
  }, [fxTick]);

  useEffect(() => () => cancelAnimationFrame(fxRaf.current), []);

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
    if (g.replayable) service.submitRun(makeRecord(g, loadProfile(), __APP_VERSION__, true)).then(() => refreshDaily(todayUTC()));
    setSummary({
      mode: g.mode, day: g.day, depth: g.depth, kills: g.kills, earned, level: g.level,
      score: scoreOf(g), record: g.depth > m.best, ranked: g.ranked, abandoned, unlocked, feats,
    });
    clearRun(g.mode);
    runs.current[g.mode] = null;
    if (G.current === g) G.current = null;
    setPaused(false);
    setScreen("death");
  }, [refreshDaily]);

  /* the single way the player changes the game: every legal action is logged for replays */
  const doAction = useCallback((a: string) => {
    const g = G.current;
    if (!g || g.dead) return false;
    if (!applyAction(g, a, flash)) return false;
    playFx(g);
    if (g.dead) { force(); setTimeout(() => finishRun(g), 650); return true; }
    persistRun();
    force();
    return true;
  }, [flash, finishRun, persistRun, playFx]);

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
    // aiming a firebolt: tap a monster in range, anywhere else cancels
    if (aiming) {
      setAiming(false);
      const m = g.mons.find(o => o.x === tx && o.y === ty && !o.disguised);
      if (m && canFirebolt(g, m)) doAction(`cf${dx}.${dy}`);
      else force();
      return;
    }
    // the merchant: next to them, open the shop; further away, walk over
    if (vendorAt(g, tx, ty) && d <= 1) { setShop(true); return; }
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
  }, [ts, doAction, stepWalk, stopWalk, aiming]);

  const useItem = (a: string) => { setTray("none"); doAction(a); };

  /* ---------------- zone title cards ---------------- */

  useEffect(() => {
    const g = G.current;
    if (screen !== "game" || !g) return;
    const key = `${g.id}:${zoneIndex(g.depth)}`;
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
    setTray("none");
    setAiming(false);
    setShop(false);
    setRelicsOpen(false);
    setPaused(false);
    persistRun();
    setScreen("game");
  };

  const startFree = async () => {
    if (runs.current.free && !confirm("Abandon this run? Echoes from it will be lost.")) return;
    enter(runFrom(await service.startRun({ mode: "free", meta: metaRef.current, cls: metaRef.current.cls })));
  };

  const playDaily = async () => {
    const live = runs.current.daily;
    if (live) { enter(live); return; }
    // the service decides the seed, today's hero (no upgrades) and whether this attempt is ranked
    const daily = await service.getDailyDungeon();
    enter(runFrom(await service.startRun({ mode: "daily", daily })));
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
    if (live && live.day === today && live.replayable) rec = makeRecord(live, named, __APP_VERSION__, false);
    else {
      const mine = await service.getMyRun(today);
      if (mine) rec = { ...mine, player: named };
    }
    return rec ? encodeRecord(rec) : null;
  };

  const addFriend = async (code: string): Promise<string> => {
    const r = await service.importRun(code, profile);
    if (r.ok) await refreshDaily(today);
    return r.message;
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
              board={board}
              myId={profile.id}
              name={profile.name}
              onName={setName}
              onPlay={playDaily}
              onGiveUp={giveUpDaily}
              onShare={shareDaily}
              onAdd={addFriend}
              onRemoveFriend={async id => { await service.removeRun(id); refreshDaily(today); }}
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
  const itemCount = g.potions.reduce((a, b) => a + b, 0) + g.inv.ember + g.inv.frost + g.inv.storm + g.inv.waystone;
  const caster = g.maxMana > 0;
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
          {caster && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <div style={{ flex: 1, height: 3, background: "#1A2236", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${(g.mana / g.maxMana) * 100}%`, height: "100%", background: "#6F9FE8", transition: "width 160ms" }} />
              </div>
              <span className="lb-mono" style={{ fontSize: 10.5, color: "#6F9FE8" }}>{g.mana}/{g.maxMana}</span>
            </div>
          )}
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
        <div style={{ position: "relative", width: VW * ts, height: VH * ts }}>
          <canvas ref={canvasRef} className="lb-map" onClick={onCanvasTap}
            style={{ width: VW * ts, height: VH * ts, display: "block" }} />
          <canvas ref={fxCanvas} aria-hidden="true"
            style={{ position: "absolute", inset: 0, width: VW * ts, height: VH * ts, pointerEvents: "none" }} />
        </div>
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

      {aiming && (
        <div style={{ padding: "6px 14px", background: "#2A1A0C", color: C.ember, fontSize: 13.5, display: "flex", justifyContent: "space-between" }}>
          <span>Tap a monster to cast Firebolt</span>
          <button onClick={() => setAiming(false)} style={{ ...linkBtn, color: C.dim, padding: 0 }}>Cancel</button>
        </div>
      )}

      {tray === "items" && <ItemTray g={g} onUse={useItem} onClose={() => setTray("none")} />}
      {tray === "spells" && <SpellTray g={g} onCast={id => useItem(`c${id}`)} onAim={() => { setTray("none"); setAiming(true); }} onClose={() => setTray("none")} />}
      {onStairs && tray === "none" && <TrainBar g={g} onTrain={k => doAction(`u${k}`)} />}

      <div style={{ display: "flex", gap: 6, padding: "8px 10px 14px", borderTop: tray !== "none" || onStairs ? "none" : `1px solid ${C.memWall}` }}>
        {onStairs
          ? <button className="lb-btn" onClick={() => doAction("d")}
              style={{ ...act3(tile === STAIRS_RISK ? "#FFF4E8" : C.void), flex: 1.4, background: tile === STAIRS_RISK ? C.blood : C.ember, border: `1px solid ${tile === STAIRS_RISK ? C.blood : C.ember}`,
                       display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
              Go down
              {tile === STAIRS_RISK && <span style={{ fontSize: 10.5, fontWeight: 600 }}>perilous</span>}
            </button>
          : <button className="lb-btn" onClick={() => doAction("w")} style={{ ...act3(C.dim), flex: 1.4 }}>Wait</button>}
        <ActBtn label="Tonic" n={g.inv.tonic} onClick={() => doAction("t")} sprite="tonic" />
        <ActBtn label="Items" n={itemCount} onClick={() => setTray(t => (t === "items" ? "none" : "items"))} sprite="potion" active={tray === "items"} />
        {caster && <ActBtn label="Spells" n={g.mana} onClick={() => setTray(t => (t === "spells" ? "none" : "spells"))} sprite="ember" active={tray === "spells"} />}
      </div>

      {paused && <PauseMenu g={g} onResume={() => setPaused(false)} onCamp={leaveToHub} />}
      {shop && g.vendor && <Shop g={g} onBuy={i => doAction(`b${i}`)} onClose={() => setShop(false)} />}
    </Shell>
  );
}
