import { useState } from "react";
import { C, dailyClass, type Game } from "../game/core";
import { CLASSES } from "../game/classes";
import { resultOf, prettyDay, formatCountdown, msUntilNextDay, type Ghost, type RunRecord } from "../game/replay";
import { btn, act3, linkBtn, textArea, sectionTitle, SpriteIcon } from "./bits";

/* The daily dungeon card on the main screen: play button, countdown,
   today's scoreboard and the share / add-a-friend panel. */

type BoardRow = {
  key: string; name: string; score: number; depth: number; me: boolean;
  tag: "first try" | "practice" | "playing"; died: boolean; verified: boolean | null; friendId?: string;
};

export function DailyCard(props: {
  day: string; now: number;
  live: Game | null;                 // my daily run in progress, any day
  mine: RunRecord[];                 // my finished daily runs today
  ghosts: Ghost[];                   // friends' runs today, replayed
  name: string;
  onName: (name: string) => void;
  onPlay: () => void;
  onGiveUp: () => void;
  onShare: () => Promise<string | null>;
  onAdd: (code: string) => Promise<string>;
  onRemoveFriend: (id: string) => void;
}) {
  const { day, now, live, mine, ghosts, name } = props;
  const [panel, setPanel] = useState<"none" | "share" | "add">("none");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const liveToday = live && live.day === day ? live : null;
  const staleLive = live && live.day !== day ? live : null;
  const playedToday = mine.length > 0 || !!liveToday;

  const rows: BoardRow[] = [
    ...mine.map(r => ({
      key: r.id, name: name || "you", score: r.result.score, depth: r.result.depth, me: true,
      tag: (r.ranked ? "first try" : "practice") as BoardRow["tag"], died: r.result.died, verified: null,
    })),
    ...(liveToday ? [{
      key: "live", name: name || "you", score: resultOf(liveToday).score, depth: liveToday.depth, me: true,
      tag: "playing" as const, died: false, verified: null,
    }] : []),
    ...ghosts.map(gh => ({
      key: gh.rec.id, name: gh.rec.player.name || "friend", score: gh.rec.result.score, depth: gh.rec.result.depth,
      me: false, friendId: gh.rec.id,
      tag: (gh.rec.finishedAt ? (gh.rec.ranked ? "first try" : "practice") : "playing") as BoardRow["tag"],
      died: gh.rec.result.died, verified: gh.verified,
    })),
  ].sort((a, b) => b.score - a.score);

  const share = async () => {
    if (!name.trim()) { setMsg({ text: "Type your name above first, so friends know whose ghost it is.", bad: true }); return; }
    setBusy(true);
    const c = await props.onShare();
    setBusy(false);
    if (!c) { setMsg({ text: "Play today's dungeon first, then share it.", bad: true }); return; }
    setCode(c);
    setPanel("share");
    try { await navigator.clipboard.writeText(c); setMsg({ text: "Copied! Send it to a friend. They paste it under \"Add a friend's run\"." }); }
    catch { setMsg({ text: "Copy the code below and send it to a friend." }); }
  };

  const shareSheet = async () => {
    try { await navigator.share({ title: "Lampblack daily", text: code }); } catch { /* cancelled */ }
  };

  const add = async () => {
    if (!code.trim()) { setMsg({ text: "Paste a run code into the box first.", bad: true }); return; }
    setBusy(true);
    const result = await props.onAdd(code);
    setBusy(false);
    const bad = !result.startsWith("Added");
    setMsg({ text: result, bad });
    if (!bad) setCode("");
  };

  return (
    <div style={{ border: `1px solid ${C.litWall}`, background: "#140F0A", borderRadius: 4, padding: "14px 14px 12px", margin: "0 0 26px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Daily dungeon · {prettyDay(day)}</h2>
        <span className="lb-mono" style={{ fontSize: 11.5, color: C.dim }}>new in {formatCountdown(msUntilNextDay(now))}</span>
      </div>
      <p style={{ margin: "6px 0 10px", fontSize: 13.5, color: C.dim, lineHeight: 1.45 }}>
        Same map and same hero for everyone today, no upgrades. Your first try goes on the board.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
        <SpriteIcon name={CLASSES[dailyClass(day)].sprite} size={30} />
        <span style={{ fontSize: 14 }}>Today's hero: <b style={{ color: C.ember }}>{CLASSES[dailyClass(day)].name}</b>
          <span style={{ display: "block", fontSize: 12, color: C.dim }}>{CLASSES[dailyClass(day)].blurb}</span></span>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.dim, marginBottom: 12 }}>
        Your name
        <input value={name} maxLength={16} onChange={e => props.onName(e.target.value)} placeholder="for the scoreboard"
          style={{ flex: 1, minWidth: 0, background: C.memFloor, color: C.bone, border: `1px solid ${C.memWall}`, borderRadius: 3,
                   padding: "7px 8px", font: "inherit", fontSize: 15, userSelect: "text", WebkitUserSelect: "text" }} />
      </label>

      {staleLive ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="lb-btn" onClick={props.onPlay} style={btn(C.ember, true)}>Finish {prettyDay(staleLive.day ?? day)} run</button>
          <button className="lb-btn" onClick={props.onGiveUp} style={btn(C.dim, false)}>Give up</button>
        </div>
      ) : liveToday ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="lb-btn" onClick={props.onPlay} style={btn(C.ember, true)}>Continue · depth {liveToday.depth}</button>
          <button className="lb-btn" onClick={props.onGiveUp} style={{ ...btn(C.dim, false), flex: 0.6 }}>Give up</button>
        </div>
      ) : (
        <button className="lb-btn" onClick={props.onPlay} style={{ ...btn(C.ember, !playedToday), width: "100%" }}>
          {playedToday ? "Practice again (won't replace your first try)" : "Play today's dungeon"}
        </button>
      )}

      <h3 style={{ ...sectionTitle, margin: "16px 0 6px" }}>Today's scoreboard</h3>
      {rows.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: C.memGlyph }}>Nobody yet. Be first.</p>}
      {rows.slice(0, 12).map((r, i) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.memWall}`, fontSize: 14.5 }}>
          <span className="lb-mono" style={{ width: 18, color: C.dim, fontSize: 12.5 }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.me ? C.ember : C.bone }}>
            {r.name}
            <span style={{ color: C.dim, fontSize: 12, marginLeft: 6 }}>
              {r.tag} · depth {r.depth}{r.died ? "" : r.tag === "playing" ? "" : " · survived"}
            </span>
            {r.verified === false && <span title="replay didn't match" style={{ color: C.blood, fontSize: 12, marginLeft: 6 }}>unverified</span>}
          </span>
          <span className="lb-mono" style={{ color: C.verd }}>{r.score}</span>
          {r.friendId && (
            <button aria-label={`remove ${r.name}'s run`} onClick={() => { if (confirm(`Remove ${r.name}'s run from this device?`)) props.onRemoveFriend(r.friendId!); }}
              style={{ ...linkBtn, textDecoration: "none", padding: "0 2px", fontSize: 16 }}>×</button>
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="lb-btn" disabled={busy} onClick={share} style={{ ...act3(C.bone), flex: 1 }}>Share my run</button>
        <button className="lb-btn" onClick={() => { setPanel(panel === "add" ? "none" : "add"); setCode(""); setMsg(null); }}
          style={{ ...act3(C.bone), flex: 1 }}>Add a friend's run</button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: C.memGlyph, lineHeight: 1.45 }}>
        Friends' runs show up as ghosts in your daily dungeon, right where they were on the same turn.
      </p>

      {panel !== "none" && (
        <div style={{ marginTop: 10 }}>
          <textarea value={code} onChange={e => setCode(e.target.value)} rows={3} className="lb-mono" style={textArea}
            placeholder="Paste a friend's run code here" readOnly={panel === "share"} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            {panel === "add" && <button className="lb-btn" disabled={busy} onClick={add} style={{ ...act3(C.ember), flex: 1 }}>Add run</button>}
            {panel === "share" && "share" in navigator && <button className="lb-btn" onClick={shareSheet} style={{ ...act3(C.bone), flex: 1 }}>Send…</button>}
            <button onClick={() => { setPanel("none"); setMsg(null); setCode(""); }} style={linkBtn}>Close</button>
          </div>
        </div>
      )}
      {msg && <p style={{ margin: "8px 0 0", fontSize: 13, color: msg.bad ? C.blood : C.verd }}>{msg.text}</p>}
    </div>
  );
}
