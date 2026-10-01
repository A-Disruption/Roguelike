import { useEffect, useRef, useReducer, useState, useCallback, type ReactNode, type CSSProperties, type MouseEvent } from "react";
import {
  C, MW, MH, VW, VH, STAIRS, WALL, UPGRADES, idx, inB, say, totalAtk, totalDef, newRun, descend,
  playerAttack, monsterTurn, pickUp, bfsPath, computeFov, drinkTonic, burnEmber, castWaystone,
  type Game, type Meta, type Upgrade, type Flash,
} from "./game/core";
import { drawMap, spriteCanvas } from "./game/sprites";
import {
  loadMeta, saveMeta, loadRun, saveRun, clearRun, requestPersist, isStandalone, isIOS,
  exportCode, importCode,
} from "./game/storage";

/* ============================ chrome ============================ */

const css = `
.lb { font-family:'IBM Plex Sans Condensed', ui-sans-serif, system-ui, sans-serif; }
.lb-mono { font-family:'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace; }
.lb-btn { -webkit-tap-highlight-color:transparent; transition: background 120ms, border-color 120ms; }
.lb-btn:active { transform: translateY(1px); }
.lb-btn:focus-visible { outline:2px solid ${C.ember}; outline-offset:2px; }
canvas.lb-map { touch-action: manipulation; -webkit-tap-highlight-color:transparent; image-rendering: pixelated; }
`;

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="lb" style={{
      height: "100dvh", width: "100%", background: C.void, color: C.bone,
      display: "flex", flexDirection: "column", overflow: "hidden",
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
      paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)",
      boxSizing: "border-box",
    }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </div>
  );
}

function ActBtn({ label, n, onClick, sprite }: { label: string; n: number; onClick: () => void; sprite: string }) {
  const off = n <= 0;
  return (
    <button className="lb-btn" disabled={off} onClick={onClick}
      style={{ ...act3(off ? C.memGlyph : C.bone), flex: 1, opacity: off ? 0.35 : 1,
               display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <SpriteIcon name={sprite} size={16} />
        <span className="lb-mono" style={{ fontSize: 13 }}>{n}</span>
      </span>
      <span style={{ fontSize: 10.5, color: C.dim }}>{label}</span>
    </button>
  );
}

function SpriteIcon({ name, size = 16 }: { name: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    const cx = cv.getContext("2d")!;
    cx.imageSmoothingEnabled = false;
    const src = spriteCanvas(name);
    if (src) cx.drawImage(src, 0, 0, 8, 8, 0, 0, size * dpr, size * dpr);
  }, [name, size]);
  return <canvas ref={ref} className="lb-map" style={{ width: size, height: size, display: "block" }} />;
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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={linkBtn}>Back up or restore a save</button>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.memWall}`, borderRadius: 3, padding: 12, margin: "4px 0 12px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button className="lb-btn" onClick={make} style={{ ...act3(C.bone), flex: 1 }}>Make backup code</button>
        {"share" in navigator && (
          <button className="lb-btn" onClick={share} style={{ ...act3(C.bone), flex: 1 }}>Share…</button>
        )}
      </div>
      <textarea value={code} onChange={e => setCode(e.target.value)} placeholder="…or paste a save code here to restore it"
        rows={3} className="lb-mono"
        style={{ width: "100%", boxSizing: "border-box", background: C.memFloor, color: C.bone, border: `1px solid ${C.memWall}`,
                 borderRadius: 3, padding: 8, fontSize: 12, resize: "vertical", userSelect: "text", WebkitUserSelect: "text" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <button className="lb-btn" onClick={restore} style={{ ...act3(C.ember), flex: 1 }}>Restore from code</button>
        <button onClick={() => { setOpen(false); setMsg(null); setCode(""); }} style={linkBtn}>Close</button>
      </div>
      {msg && <p style={{ margin: "8px 0 0", fontSize: 13, color: msg.bad ? C.blood : C.verd }}>{msg.text}</p>}
    </div>
  );
}

/* ============================ component ============================ */

type SaveState = "idle" | "saved" | "failed";

export default function LampblackDepths() {
  const G = useRef<Game | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [screen, setScreen] = useState<"loading" | "hub" | "game" | "death">("loading");
  const [meta, setMeta] = useState<Meta>(loadMeta);
  const [hasRun, setHasRun] = useState(false);
  const [flashes, setFlashes] = useState<Record<number, string>>({});
  const [ts, setTs] = useState(30);
  const [summary, setSummary] = useState<{ depth: number; kills: number; earned: number; level: number; record: boolean } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [installed] = useState(isStandalone);
  const mapBox = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const walkTimer = useRef<number | undefined>(undefined);
  const flashTimer = useRef<Record<number, number>>({});

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

  /* boot: resume straight into the run if there is one */
  const loadAll = useCallback((resume: boolean) => {
    stopWalkRaw();
    setMeta(loadMeta());
    G.current = loadRun();
    setHasRun(!!G.current);
    if (G.current) setSaveState("saved");
    setScreen(resume && G.current ? "game" : "hub");
  }, []);

  useEffect(() => {
    loadAll(true);
    requestPersist();
  }, [loadAll]);

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
    drawMap(ctx, g, ts, camX, camY, flashes);
  });

  /* ---------------- turns ---------------- */

  const flash: Flash = useCallback((i, kind) => {
    setFlashes(f => ({ ...f, [i]: kind }));
    clearTimeout(flashTimer.current[i]);
    flashTimer.current[i] = window.setTimeout(() => {
      setFlashes(f => { const n = { ...f }; delete n[i]; return n; });
    }, 170);
  }, []);

  const finishRun = useCallback(() => {
    const g = G.current!;
    const earned = Math.round(g.echoes * g.greed);
    const nm: Meta = {
      ...meta, echoes: meta.echoes + earned, best: Math.max(meta.best, g.depth),
      runs: meta.runs + 1, kills: meta.kills + g.kills,
    };
    setMeta(nm);
    setSummary({ depth: g.depth, kills: g.kills, earned, level: g.level, record: g.depth > meta.best });
    setHasRun(false);
    saveMeta(nm);
    clearRun();
    setScreen("death");
  }, [meta]);

  const act = useCallback((fn: (g: Game) => void) => {
    const g = G.current;
    if (!g || g.dead) return;
    fn(g);
    if (g.dead) { force(); setTimeout(finishRun, 550); return; }
    monsterTurn(g, flash);
    g.turns += 1;
    g.vis = computeFov(g);
    if (g.dead) { force(); setTimeout(finishRun, 550); return; }
    persistRun();
    force();
  }, [flash, finishRun, persistRun]);

  const tryStep = useCallback((tx: number, ty: number) => {
    const g = G.current!;
    if (!inB(tx, ty) || g.grid[idx(tx, ty)] === WALL) return false;
    const m = g.mons.find(o => o.x === tx && o.y === ty);
    if (m) { act(gg => playerAttack(gg, m, flash)); return true; }
    act(gg => { gg.p = { x: tx, y: ty }; pickUp(gg); });
    return true;
  }, [act, flash]);

  function stopWalkRaw() {
    clearTimeout(walkTimer.current);
    if (G.current) G.current.path = null;
  }
  const stopWalk = useCallback(stopWalkRaw, []);

  const enemyInSight = (g: Game) => g.mons.some(m => g.vis.has(idx(m.x, m.y)));

  const stepWalk = useCallback(() => {
    const g = G.current;
    if (!g || g.dead || !g.path || !g.path.length) { if (g) g.path = null; force(); return; }
    if (enemyInSight(g)) { g.path = null; force(); return; }
    const next = g.path.shift()!;
    const item = g.items.some(i => i.x === next.x && i.y === next.y);
    tryStep(next.x, next.y);
    if (!g.dead && g.path && g.path.length && !item && !enemyInSight(g)) {
      walkTimer.current = window.setTimeout(stepWalk, 85);
    } else { g.path = null; force(); }
  }, [tryStep]);

  const onCanvasTap = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const g = G.current;
    if (!g || g.dead) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const camX = Math.max(0, Math.min(MW - VW, g.p.x - (VW >> 1)));
    const camY = Math.max(0, Math.min(MH - VH, g.p.y - (VH >> 1)));
    const tx = camX + Math.floor((e.clientX - rect.left) / ts);
    const ty = camY + Math.floor((e.clientY - rect.top) / ts);
    if (g.path) { stopWalk(); force(); return; }
    const d = Math.max(Math.abs(tx - g.p.x), Math.abs(ty - g.p.y));
    if (d === 0) { act(gg => say(gg, "You hold still and listen.")); return; }
    if (d === 1) { tryStep(tx, ty); return; }
    if (enemyInSight(g)) { act(gg => say(gg, "Not with something watching you.")); return; }
    const path = bfsPath(g, tx, ty);
    if (!path) return;
    g.path = path;
    stepWalk();
  }, [ts, act, tryStep, stepWalk, stopWalk]);

  const onTonic = () => act(drinkTonic);
  const onEmber = () => act(g => burnEmber(g, flash));
  const onWaystone = () => act(castWaystone);

  const takeStairs = () => {
    const g = G.current!;
    if (g.grid[idx(g.p.x, g.p.y)] !== STAIRS) return;
    descend(g);
    persistRun();
    force();
  };

  const startRun = () => {
    if (hasRun && !confirm("Abandon this run? Echoes from it will be lost.")) return;
    stopWalk();
    G.current = newRun(meta);
    setHasRun(true);
    persistRun();
    setScreen("game");
  };

  const buy = (u: Upgrade) => {
    const lvl = meta.up[u.k] || 0;
    if (lvl >= u.max) return;
    const cost = u.costs[lvl];
    if (meta.echoes < cost) return;
    const nm = { ...meta, echoes: meta.echoes - cost, up: { ...meta.up, [u.k]: lvl + 1 } };
    setMeta(nm);
    saveMeta(nm);
  };

  const wipe = () => {
    if (!confirm("Erase ALL progress? Echoes, upgrades and the current run will be gone for good.")) return;
    const nm = { echoes: 0, best: 0, runs: 0, kills: 0, up: {} };
    setMeta(nm); G.current = null; setHasRun(false);
    saveMeta(nm);
    clearRun();
  };

  useEffect(() => () => { clearTimeout(walkTimer.current); }, []);

  /* ---------------- screens ---------------- */

  if (screen === "loading") {
    return <Shell><div style={{ margin: "auto", color: C.dim }} className="lb-mono">lighting the lamp…</div></Shell>;
  }

  if (screen === "hub") {
    return (
      <Shell>
        <div style={{ flex: 1, overflowY: "auto", padding: "26px 20px 24px", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SpriteIcon name="player" size={28} />
            <h1 style={{ margin: 0, fontSize: 29, fontWeight: 600, letterSpacing: "-0.01em" }}>The Lampblack Depths</h1>
          </div>
          <p style={{ color: C.dim, marginTop: 8, marginBottom: 20, fontSize: 15, lineHeight: 1.5, maxWidth: "46ch" }}>
            You go down, you die, you come back with what the dark gave you. Echoes are the only thing that survives a death.
          </p>

          {!installed && isIOS() && (
            <div style={{ background: "#1F1810", border: `1px solid ${C.litWall}`, borderRadius: 3, padding: "10px 12px", marginBottom: 18, fontSize: 14, lineHeight: 1.45 }}>
              <b style={{ color: C.ember }}>Install it first.</b> Tap the Share button, then <b>Add to Home Screen</b>.
              Open the game from that icon and your saves are kept for good.
            </div>
          )}

          <div style={{ display: "flex", gap: 22, padding: "14px 0", borderTop: `1px solid ${C.memWall}`, borderBottom: `1px solid ${C.memWall}` }}>
            <Stat label="echoes" value={meta.echoes} color={C.verd} />
            <Stat label="deepest" value={meta.best || "—"} color={C.ember} />
            <Stat label="descents" value={meta.runs} />
            <Stat label="kills" value={meta.kills} />
          </div>

          <div style={{ display: "flex", gap: 10, margin: "18px 0 26px" }}>
            {hasRun && G.current && (
              <button className="lb-btn" onClick={() => setScreen("game")} style={btn(C.ember, true)}>
                Return to depth {G.current.depth}
              </button>
            )}
            <button className="lb-btn" onClick={startRun} style={btn(hasRun ? C.dim : C.ember, !hasRun)}>
              {hasRun ? "Abandon and start over" : "Descend"}
            </button>
          </div>

          <h2 style={{ fontSize: 13, fontWeight: 600, color: C.dim, margin: "0 0 4px", letterSpacing: "0.04em" }}>Spend echoes</h2>
          <div>
            {UPGRADES.map(u => {
              const lvl = meta.up[u.k] || 0;
              const maxed = lvl >= u.max;
              const cost = maxed ? 0 : u.costs[lvl];
              const afford = !maxed && meta.echoes >= cost;
              return (
                <button key={u.k} className="lb-btn" disabled={maxed || !afford} onClick={() => buy(u)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 2px",
                    background: "none", border: "none", borderBottom: `1px solid ${C.memWall}`,
                    color: "inherit", textAlign: "left", cursor: maxed || !afford ? "default" : "pointer",
                    opacity: maxed ? 0.45 : afford ? 1 : 0.6, font: "inherit",
                  }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 13.5, color: C.dim }}>{u.blurb}</div>
                  </div>
                  <div className="lb-mono" style={{ color: C.ember, fontSize: 13, letterSpacing: 2 }}>
                    {"◆".repeat(lvl)}<span style={{ color: C.memGlyph }}>{"◇".repeat(u.max - lvl)}</span>
                  </div>
                  <div className="lb-mono" style={{ width: 52, textAlign: "right", fontSize: 14, color: maxed ? C.dim : afford ? C.verd : C.memGlyph }}>
                    {maxed ? "full" : cost}
                  </div>
                </button>
              );
            })}
          </div>

          <h2 style={{ fontSize: 13, fontWeight: 600, color: C.dim, margin: "22px 0 8px", letterSpacing: "0.04em" }}>What you will meet</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", marginBottom: 20 }}>
            {[["rat","cellar rat"],["bat","blind bat"],["goblin","goblin"],["skeleton","skeleton"],
              ["wraith","wraith"],["ogre","ogre"],["warden","warden"]].map(([k, n]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.dim }}>
                <SpriteIcon name={k} size={20} /> {n}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: C.memGlyph, lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 8px" }}>
              Tap a tile next to you to move or strike. Tap a far tile to walk there — you stop the moment
              something comes into the light.
            </p>
            <p style={{ margin: "0 0 10px" }}>Progress saves after every move. You can close this and come back to the run.</p>
            <Backup onRestored={() => loadAll(false)} />
            <div>
              <button onClick={wipe} style={linkBtn}>Erase all progress</button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (screen === "death" && summary) {
    return (
      <Shell>
        <div style={{ margin: "auto", padding: 26, maxWidth: 420, width: "100%", boxSizing: "border-box" }}>
          <div className="lb-mono" style={{ color: C.blood, fontSize: 40, lineHeight: 1 }}>†</div>
          <h2 style={{ fontSize: 27, fontWeight: 600, margin: "12px 0 2px" }}>The lamp goes out</h2>
          <p style={{ color: C.dim, margin: "0 0 22px", fontSize: 15 }}>
            {summary.record ? "Deeper than you have ever been." : "The dark keeps what it takes."}
          </p>
          <Row k="reached" v={`depth ${summary.depth}`} />
          <Row k="killed" v={summary.kills} />
          <Row k="level" v={summary.level} />
          <Row k="echoes carried out" v={summary.earned} color={C.verd} />
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button className="lb-btn" onClick={startRun} style={btn(C.ember, true)}>Descend again</button>
            <button className="lb-btn" onClick={() => setScreen("hub")} style={btn(C.dim, false)}>Spend echoes</button>
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
          <button className="lb-btn" onClick={startRun} style={btn(C.ember, true)}>Descend</button>
        </div>
      </Shell>
    );
  }

  const onStairs = g.grid[idx(g.p.x, g.p.y)] === STAIRS;
  const hpPct = Math.max(0, g.hp / g.maxHp);
  const saveColor = saveState === "failed" ? C.blood : saveState === "saved" ? C.verd : C.memGlyph;

  return (
    <Shell>
      <div style={{ padding: "10px 14px 8px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.memWall}` }}>
        <button className="lb-btn" onClick={() => { stopWalk(); persistRun(); setScreen("hub"); }} aria-label="back to camp"
          style={{ background: "none", border: "none", color: C.dim, font: "inherit", fontSize: 24, padding: "0 8px 0 2px", cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.dim, marginBottom: 3 }}>
            <span className="lb-mono" style={{ color: hpPct < 0.3 ? C.blood : C.bone }}>{g.hp}/{g.maxHp}</span>
            <span>depth {g.depth} · lvl {g.level} · {totalAtk(g)}atk {totalDef(g)}def</span>
          </div>
          <div style={{ height: 4, background: C.memWall, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${hpPct * 100}%`, height: "100%", background: hpPct < 0.3 ? C.blood : C.ember, transition: "width 160ms" }} />
          </div>
        </div>
        <span className="lb-mono" style={{ color: C.verd, fontSize: 13 }}>{g.echoes}</span>
        <span aria-label={saveState === "failed" ? "not saving" : "saved"}
          style={{ display: "block", width: 8, height: 8, borderRadius: 4, background: saveColor }} />
      </div>

      {saveState === "failed" && (
        <div style={{ background: "#2A100C", color: C.blood, fontSize: 12.5, padding: "6px 14px", lineHeight: 1.4 }}>
          This device refused to save. If you're in a private browsing tab, open the game from the home screen instead.
        </div>
      )}

      <div ref={mapBox} style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}>
        <canvas ref={canvasRef} className="lb-map" onClick={onCanvasTap}
          style={{ width: VW * ts, height: VH * ts, display: "block" }} />
      </div>

      <div style={{ padding: "0 14px", height: 40, display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
        {g.log.slice(-2).map((l, i, a) => (
          <div key={g.log.length - a.length + i} style={{ fontSize: 13.5, color: i === a.length - 1 ? C.bone : C.memGlyph, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "8px 12px 14px", borderTop: `1px solid ${C.memWall}` }}>
        {onStairs
          ? <button className="lb-btn" onClick={takeStairs} style={{ ...act3(C.ember), flex: 2, color: C.void, background: C.ember, borderColor: C.ember }}>Go down</button>
          : <button className="lb-btn" onClick={() => act(gg => say(gg, "You wait."))} style={{ ...act3(C.dim), flex: 2 }}>Wait</button>}
        <ActBtn label="Tonic" n={g.inv.tonic} onClick={onTonic} sprite="tonic" />
        <ActBtn label="Ember" n={g.inv.ember} onClick={onEmber} sprite="ember" />
        <ActBtn label="Waystone" n={g.inv.waystone} onClick={onWaystone} sprite="waystone" />
      </div>
    </Shell>
  );
}

/* ============================ small pieces ============================ */

const linkBtn: CSSProperties = {
  background: "none", border: "none", color: C.memGlyph, textDecoration: "underline",
  padding: "4px 0", font: "inherit", cursor: "pointer",
};

function btn(color: string, primary: boolean): CSSProperties {
  return {
    font: "inherit", flex: 1, padding: "13px 14px", fontSize: 16, fontWeight: 600,
    borderRadius: 3, cursor: "pointer",
    background: primary ? color : "transparent",
    color: primary ? "#0A0C10" : color,
    border: `1px solid ${color}`,
  };
}

function act3(color: string): CSSProperties {
  return {
    font: "inherit", padding: "10px 6px", background: "transparent", border: "1px solid #1E252F",
    color, borderRadius: 3, fontSize: 14, fontWeight: 600, cursor: "pointer",
  };
}

function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div>
      <div className="lb-mono" style={{ fontSize: 20, color: color || "#E6DCC9" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#7C8794" }}>{label}</div>
    </div>
  );
}

function Row({ k, v, color }: { k: string; v: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #161B23", fontSize: 15 }}>
      <span style={{ color: "#7C8794" }}>{k}</span>
      <span className="lb-mono" style={{ color: color || "#E6DCC9" }}>{v}</span>
    </div>
  );
}
