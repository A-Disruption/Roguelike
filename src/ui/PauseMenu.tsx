import type { ReactNode } from "react";
import {
  C, POTION_COLORS, POTION_EFFECTS, weaponTier, armorTier, totalAtk, totalDef, sightOf, reachOf, scoreOf,
  potionLabel, relicLabel, relicBlurb, type Game,
} from "../game/core";
import { playerSprite, itemSprite, potionSprite, relicSprite } from "../game/sprites";
import { classOf } from "../game/classes";
import { zoneOf } from "../game/zones";
import type { RelicId } from "../game/relics";
import { SpriteIcon, sectionTitle } from "./bits";
import { Modal, modalBtn } from "./Modal";

/* Tap the hero in the top bar: everything about your run on one card. */
export function PauseMenu({ g, onResume, onCamp }: { g: Game; onResume: () => void; onCamp: () => void }) {
  const cls = classOf(g.start.cls);
  const relics = (Object.keys(g.relics) as RelicId[]).filter(id => g.relics[id]);
  const held = POTION_COLORS.map((_, c) => c).filter(c => g.potions[c] > 0);
  const known = POTION_EFFECTS.map((e, i) => ({ e, i })).filter(({ i }) => g.known[i]);
  const packEmpty = !g.inv.tonic && !g.inv.ember && !g.inv.waystone && !g.inv.key && !held.length;

  const row = (icon: ReactNode, label: ReactNode, sub?: ReactNode, right?: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.memWall}` }}>
      {icon}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block" }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 12, color: C.dim }}>{sub}</span>}
      </span>
      {right && <span className="lb-mono" style={{ color: C.dim, fontSize: 13 }}>{right}</span>}
    </div>
  );
  const stat = (k: string, v: ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ color: C.dim }}>{k}</span><span className="lb-mono">{v}</span>
    </div>
  );

  return (
    <Modal onClose={onResume}
      title={<span>{cls.name} <span style={{ fontSize: 13, color: C.dim, fontWeight: 400 }}>· paused</span></span>}
      icon={<SpriteIcon src={playerSprite(g)} size={44} />}
      actions={<>
        <button className="lb-btn" onClick={onCamp} style={modalBtn(C.dim)}>Back to camp</button>
        <button className="lb-btn" onClick={onResume} style={modalBtn(C.ember, true)}>Resume</button>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 18, marginBottom: 12 }}>
        {stat("health", `${g.hp}/${g.maxHp}`)}
        {stat("level", `${g.level} (${g.xp}/${g.next})`)}
        {stat("attack", totalAtk(g))}
        {stat("armor", totalDef(g))}
        {stat("sight", sightOf(g))}
        {stat("reach", reachOf(g) > 1 ? `${reachOf(g)} tiles` : "melee")}
        {stat("floor", `${g.depth}${g.floorKey.endsWith("r") ? " ☠" : ""}`)}
        {stat("turns", g.turns)}
        {stat("kills", g.kills)}
        {stat(g.mode === "daily" ? "score" : "echoes", g.mode === "daily" ? scoreOf(g) : g.echoes)}
      </div>
      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 12 }}>{zoneOf(g.depth).name}{g.mode === "daily" ? ` · daily ${g.day}` : ""}</div>

      <div style={{ ...sectionTitle, margin: "0 0 4px" }}>Gear</div>
      {row(g.weapon ? <SpriteIcon src={itemSprite({ t: "weapon", name: g.weapon.name, x: 0, y: 0 })} size={26} /> : <Blank />,
           g.weapon ? g.weapon.name : "bare hands", g.weapon ? `+${g.weapon.atk} attack · tier ${weaponTier(g.weapon.name) + 1} of 6` : "pick up a weapon to hit harder")}
      {row(g.armor ? <SpriteIcon src={itemSprite({ t: "armor", name: g.armor.name, x: 0, y: 0 })} size={26} /> : <Blank />,
           g.armor ? g.armor.name : "no armor", g.armor ? `+${g.armor.def} armor · tier ${armorTier(g.armor.name) + 1} of 5` : "armor shrugs off part of every hit")}

      <div style={{ ...sectionTitle, margin: "14px 0 4px" }}>Pack</div>
      {packEmpty && <div style={{ color: C.dim, fontSize: 13 }}>Your pack is empty.</div>}
      {g.inv.tonic > 0 && row(<SpriteIcon name="tonic" size={24} />, "tonic", "heals almost half your health", `×${g.inv.tonic}`)}
      {g.inv.ember > 0 && row(<SpriteIcon name="ember" size={24} />, "ember scroll", "burns every monster in sight", `×${g.inv.ember}`)}
      {g.inv.waystone > 0 && row(<SpriteIcon name="waystone" size={24} />, "waystone", "teleports you somewhere you've been", `×${g.inv.waystone}`)}
      {g.inv.key > 0 && row(<SpriteIcon name="key" size={24} />, "key", "opens a locked chest on this floor", `×${g.inv.key}`)}
      {held.map(c => row(<SpriteIcon src={potionSprite(c)} size={24} />, potionLabel(g, c),
        g.known[g.potionMap[c]] ? POTION_EFFECTS[g.potionMap[c]].blurb : "unknown. Drink it to find out!", `×${g.potions[c]}`))}

      {relics.length > 0 && <>
        <div style={{ ...sectionTitle, margin: "14px 0 4px" }}>Relics</div>
        {relics.map(id => row(<SpriteIcon src={relicSprite(id, g.relics[id]!)} size={26} />, relicLabel(id, g.relics[id]!), relicBlurb(id, g.relics[id]!)))}
      </>}

      {known.length > 0 && <>
        <div style={{ ...sectionTitle, margin: "14px 0 4px" }}>Potions you know</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12.5, color: C.dim }}>
          {known.map(({ e, i }) => {
            const color = g.potionMap.indexOf(i);
            return <span key={e.k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <SpriteIcon src={potionSprite(color)} size={16} />{POTION_COLORS[color].name} = {e.name.replace("potion of ", "")}</span>;
          })}
        </div>
      </>}
    </Modal>
  );
}

const Blank = () => <span style={{ width: 26, height: 26, borderRadius: 3, border: `1px dashed ${C.memWall}`, flexShrink: 0 }} />;
