import { useState, type ReactNode } from "react";
import {
  C, VARIANTS, MONSTER_KINDS, BOSS_KINDS, monsterBase, type Meta, type Dex, type Mon,
} from "../game/core";
import { spriteCanvas, silhouette, monSprite, relicSprite, playerSprite } from "../game/sprites";
import { RELICS, RELIC_IDS, TIER_NAMES, type RelicId } from "../game/relics";
import { CLASSES, CLASS_IDS, isUnlocked } from "../game/classes";
import { ZONES, ZONE_LEN, zoneStart } from "../game/zones";
import { MONSTER_NOTES, ZONE_NOTES, ACHIEVEMENTS, zonesOf } from "../game/bestiary";
import { SpriteIcon, sectionTitle } from "./bits";
import { Modal } from "./Modal";

/* The Collection tab: bestiary, relics, zones, heroes and achievements.
   Everything is a grid of uniform tiles; tap one for the details. */

type Section = "monsters" | "relics" | "zones" | "heroes" | "feats";
type Popup = { title: ReactNode; icon: ReactNode; body: ReactNode } | null;

const variantIcon = (kind: string, v: number) => monSprite({ kind, variant: v, wpn: -1, arm: -1, disguised: false } as Mon);

function Tile({ icon, label, sub, dim, onClick }: { icon: ReactNode; label: string; sub?: string; dim?: boolean; onClick: () => void }) {
  return (
    <button className="lb-btn" onClick={onClick}
      style={{ font: "inherit", color: dim ? C.memGlyph : C.bone, background: "#10141A", border: `1px solid ${C.memWall}`,
               borderRadius: 4, padding: "9px 4px 7px", display: "flex", flexDirection: "column", alignItems: "center",
               gap: 5, cursor: "pointer", minWidth: 0 }}>
      {icon}
      <span style={{ fontSize: 11.5, lineHeight: 1.2, textAlign: "center", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {sub && <span className="lb-mono" style={{ fontSize: 10, color: C.dim }}>{sub}</span>}
    </button>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 8 } as const;

function Stat({ k, v }: { k: string; v: ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.memWall}` }}>
    <span style={{ color: C.dim }}>{k}</span><span className="lb-mono">{v}</span></div>;
}

export function Collection({ meta, dex }: { meta: Meta; dex: Dex }) {
  const [section, setSection] = useState<Section>("monsters");
  const [popup, setPopup] = useState<Popup>(null);

  const monsterPopup = (kind: string) => {
    const seen = !!dex.seen[kind];
    const base = monsterBase(kind);
    const variants = VARIANTS[kind] ?? [];
    setPopup({
      title: seen ? cap(base?.name ?? kind) : "???",
      icon: <SpriteIcon src={seen ? spriteCanvas(kind) : silhouette(kind)} size={44} />,
      body: seen ? (<>
        <p style={{ margin: "0 0 10px" }}>{MONSTER_NOTES[kind] ?? ""}</p>
        <Stat k="found in" v={zonesOf(kind).join(", ") || "anywhere"} />
        <Stat k="health" v={base?.hp} />
        <Stat k="attack" v={base?.atk} />
        <Stat k="armor" v={base?.def} />
        <Stat k="defeated" v={dex.kills[kind] ?? 0} />
        {variants.length > 0 && <>
          <div style={{ ...sectionTitle, margin: "12px 0 6px" }}>Variants</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {variants.map((v, i) => {
              const got = !!dex.seen[`${kind}:${i + 1}`];
              return <div key={v.prefix} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 11.5, color: got ? C.bone : C.memGlyph }}>
                <SpriteIcon src={got ? variantIcon(kind, i + 1) : silhouette(kind)} size={32} />{got ? v.prefix : "???"}</div>;
            })}
          </div>
        </>}
        <p style={{ margin: "10px 0 0", fontSize: 12, color: C.dim }}>Stats shown are for its first floor; everything gets tougher deeper down.</p>
      </>) : <p style={{ margin: 0, color: C.dim }}>You haven't met this one yet. {zonesOf(kind).length ? `Look in ${zonesOf(kind).join(" or ")}.` : ""}</p>,
    });
  };

  const relicPopup = (id: RelicId) => {
    const best = dex.relics[id] ?? 0;
    const r = RELICS[id];
    setPopup({
      title: best ? r.name : "???",
      icon: <SpriteIcon src={best ? relicSprite(id, best) : silhouette(id)} size={44} />,
      body: best ? (<>
        {[1, 2, 3].map(t => (
          <div key={t} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.memWall}`, opacity: t <= best ? 1 : 0.55 }}>
            <SpriteIcon src={relicSprite(id, t)} size={24} />
            <span><b style={{ fontWeight: 600 }}>Tier {TIER_NAMES[t]}</b><span style={{ color: C.dim }}> · {r.blurb(r.values[t - 1], t)}</span></span>
          </div>
        ))}
        <p style={{ margin: "10px 0 0", fontSize: 12, color: C.dim }}>Best found: tier {TIER_NAMES[best]}. Relics turn up in chests, on perilous floors and on bosses.</p>
      </>) : <p style={{ margin: 0, color: C.dim }}>Not found yet. Relics turn up in chests, on perilous floors and on bosses.</p>,
    });
  };

  const zonePopup = (i: number) => {
    const z = ZONES[i];
    const found = i === 0 || meta.best >= zoneStart(i);
    const kinds = [...new Set(z.pool.map(([k]) => k))];
    setPopup({
      title: found ? z.name : "???",
      icon: <div style={{ width: 40, height: 40, borderRadius: 4, background: found ? z.colors.litWall : C.memWall, border: `3px solid ${found ? z.colors.wallTop : C.memWall}` }} />,
      body: found ? (<>
        <p style={{ margin: "0 0 6px", color: C.dim }}>Floors {zoneStart(i)}–{i === ZONES.length - 1 ? "…" : zoneStart(i) + ZONE_LEN - 1}</p>
        <p style={{ margin: "0 0 6px" }}>{z.intro}</p>
        <p style={{ margin: "0 0 10px", color: C.dim }}>{ZONE_NOTES[i]}</p>
        <div style={{ ...sectionTitle, margin: "0 0 6px" }}>Lives here</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {kinds.map(k => <SpriteIcon key={k} src={dex.seen[k] ? spriteCanvas(k) : silhouette(k)} size={28} />)}
          <span style={{ color: C.memGlyph }}>·</span>
          <SpriteIcon src={dex.seen[z.boss] ? spriteCanvas(z.boss) : silhouette(z.boss)} size={32} />
        </div>
      </>) : <p style={{ margin: 0, color: C.dim }}>Reach floor {zoneStart(i)} to discover this place.</p>,
    });
  };

  const tabs: [Section, string][] = [["monsters", "Bestiary"], ["relics", "Relics"], ["zones", "Zones"], ["heroes", "Heroes"], ["feats", "Feats"]];
  const seenCount = [...MONSTER_KINDS, ...BOSS_KINDS].filter(k => dex.seen[k]).length;
  const earned = ACHIEVEMENTS.filter(a => meta.ach.includes(a.id)).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {tabs.map(([k, label]) => (
          <button key={k} className="lb-btn" onClick={() => setSection(k)} aria-pressed={section === k}
            style={{ font: "inherit", fontSize: 13.5, padding: "6px 12px", borderRadius: 14, cursor: "pointer",
                     background: section === k ? C.ember : "transparent", color: section === k ? "#0A0C10" : C.dim,
                     border: `1px solid ${section === k ? C.ember : C.memWall}` }}>{label}</button>
        ))}
      </div>

      {section === "monsters" && (<>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: C.dim }}>Met {seenCount} of {MONSTER_KINDS.length + BOSS_KINDS.length}. Tap one for details.</p>
        {ZONES.map((z, i) => {
          const kinds = [...new Set(z.pool.map(([k]) => k))].filter(k => !ZONES.slice(0, i).some(o => o.pool.some(([p]) => p === k)));
          return (
            <div key={z.name} style={{ marginBottom: 14 }}>
              <div style={{ ...sectionTitle, margin: "0 0 6px" }}>{meta.best >= zoneStart(i) || i === 0 ? z.name : "???"}</div>
              <div style={grid}>
                {[...kinds, ...(i === 0 ? ["mimic"] : []), z.boss].map(k => (
                  <Tile key={k} onClick={() => monsterPopup(k)} dim={!dex.seen[k]}
                    icon={<SpriteIcon src={dex.seen[k] ? spriteCanvas(k) : silhouette(k)} size={32} />}
                    label={dex.seen[k] ? cap(monsterBase(k)?.name ?? k) : "???"}
                    sub={dex.kills[k] ? `×${dex.kills[k]}` : BOSS_KINDS.includes(k) ? "boss" : undefined} />
                ))}
              </div>
            </div>
          );
        })}
      </>)}

      {section === "relics" && (<>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: C.dim }}>Found {Object.keys(dex.relics).length} of {RELIC_IDS.length}. Each comes in three tiers.</p>
        <div style={grid}>
          {RELIC_IDS.map(id => {
            const t = dex.relics[id] ?? 0;
            return <Tile key={id} onClick={() => relicPopup(id)} dim={!t}
              icon={<SpriteIcon src={t ? relicSprite(id, t) : silhouette(id)} size={32} />}
              label={t ? RELICS[id].name : "???"} sub={t ? `best ${TIER_NAMES[t]}` : undefined} />;
          })}
        </div>
      </>)}

      {section === "zones" && (
        <div style={grid}>
          {ZONES.map((z, i) => {
            const found = i === 0 || meta.best >= zoneStart(i);
            return <Tile key={z.name} onClick={() => zonePopup(i)} dim={!found}
              icon={<div style={{ width: 32, height: 32, borderRadius: 3, background: found ? z.colors.litWall : C.memWall, border: `2px solid ${found ? z.colors.wallTop : C.memWall}` }} />}
              label={found ? z.name.replace("The ", "") : "???"} sub={`floor ${zoneStart(i)}+`} />;
          })}
        </div>
      )}

      {section === "heroes" && (
        <div style={grid}>
          {CLASS_IDS.map(id => {
            const c = CLASSES[id];
            const open = isUnlocked(id, meta);
            return <Tile key={id} dim={!open}
              onClick={() => setPopup({
                title: c.name, icon: <SpriteIcon src={playerSprite({ weapon: null, armor: null, start: { cls: id } })} size={44} />,
                body: <>
                  <p style={{ margin: "0 0 10px" }}>{c.blurb}</p>
                  <Stat k="health" v={c.hp} /><Stat k="attack" v={c.atk} /><Stat k="armor" v={c.def} /><Stat k="sight" v={c.sight} />
                  {!open && c.unlock && <p style={{ margin: "10px 0 0", color: C.ember }}>Unlock: {c.unlock.text} ({c.unlock.progress(meta)})</p>}
                </>,
              })}
              icon={<SpriteIcon src={playerSprite({ weapon: null, armor: null, start: { cls: id } })} size={32} />}
              label={c.name} sub={open ? undefined : "locked"} />;
          })}
        </div>
      )}

      {section === "feats" && (<>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: C.dim }}>Earned {earned} of {ACHIEVEMENTS.length}.</p>
        {ACHIEVEMENTS.map(a => {
          const done = meta.ach.includes(a.id);
          const [have, need] = a.progress(meta);
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.memWall}` }}>
              <span style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                             background: done ? C.ember : "transparent", border: `1px solid ${done ? C.ember : C.memWall}`, color: "#0A0C10", fontSize: 14 }}>{done ? "★" : ""}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: done ? C.bone : C.dim }}>{a.name}</span>
                <span style={{ display: "block", fontSize: 12.5, color: C.dim }}>{a.text}</span>
              </span>
              {!done && need > 1 && <span className="lb-mono" style={{ fontSize: 11.5, color: C.memGlyph }}>{have}/{need}</span>}
            </div>
          );
        })}
      </>)}

      {popup && <Modal title={popup.title} icon={popup.icon} onClose={() => setPopup(null)}>{popup.body}</Modal>}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
