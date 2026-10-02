import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { C } from "../game/core";
import { spriteCanvas } from "../game/sprites";

/* Small shared UI pieces and styles. */

export const css = `
.lb { font-family:'IBM Plex Sans Condensed', ui-sans-serif, system-ui, sans-serif; }
.lb-mono { font-family:'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace; }
.lb-btn { -webkit-tap-highlight-color:transparent; transition: background 120ms, border-color 120ms; }
.lb-btn:active { transform: translateY(1px); }
.lb-btn:focus-visible { outline:2px solid ${C.ember}; outline-offset:2px; }
canvas.lb-map { touch-action: manipulation; -webkit-tap-highlight-color:transparent; image-rendering: pixelated; }
`;

export function Shell({ children }: { children: ReactNode }) {
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

export function SpriteIcon({ name, src: given, size = 16 }: { name?: string; src?: HTMLCanvasElement | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    const cx = cv.getContext("2d")!;
    cx.imageSmoothingEnabled = false;
    cx.clearRect(0, 0, cv.width, cv.height);
    const src = given ?? (name ? spriteCanvas(name) : null);
    if (src) cx.drawImage(src, 0, 0, 8, 8, 0, 0, size * dpr, size * dpr);
  }, [name, given, size]);
  return <canvas ref={ref} className="lb-map" style={{ width: size, height: size, display: "block", flexShrink: 0 }} />;
}

export function ActBtn({ label, n, onClick, sprite, active }: { label: string; n: number; onClick: () => void; sprite: string; active?: boolean }) {
  const off = n <= 0;
  return (
    <button className="lb-btn" disabled={off} onClick={onClick}
      style={{ ...act3(off ? C.memGlyph : C.bone), flex: 1, opacity: off ? 0.35 : 1, minWidth: 0,
               ...(active ? { border: `1px solid ${C.ember}` } : {}),
               display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <SpriteIcon name={sprite} size={16} />
        <span className="lb-mono" style={{ fontSize: 13 }}>{n}</span>
      </span>
      <span style={{ fontSize: 10.5, color: C.dim }}>{label}</span>
    </button>
  );
}

export const linkBtn: CSSProperties = {
  background: "none", border: "none", color: C.memGlyph, textDecoration: "underline",
  padding: "4px 0", font: "inherit", cursor: "pointer",
};

export function btn(color: string, primary: boolean): CSSProperties {
  return {
    font: "inherit", flex: 1, padding: "13px 14px", fontSize: 16, fontWeight: 600,
    borderRadius: 3, cursor: "pointer",
    background: primary ? color : "transparent",
    color: primary ? "#0A0C10" : color,
    border: `1px solid ${color}`,
  };
}

export function act3(color: string): CSSProperties {
  return {
    font: "inherit", padding: "10px 6px", background: "transparent", border: "1px solid #1E252F",
    color, borderRadius: 3, fontSize: 14, fontWeight: 600, cursor: "pointer",
  };
}

export const textArea: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: C.memFloor, color: C.bone, border: `1px solid ${C.memWall}`,
  borderRadius: 3, padding: 8, fontSize: 12, resize: "vertical", userSelect: "text", WebkitUserSelect: "text",
};

export const sectionTitle: CSSProperties = {
  fontSize: 13, fontWeight: 600, color: C.dim, margin: "0 0 4px", letterSpacing: "0.04em",
};

export function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div>
      <div className="lb-mono" style={{ fontSize: 20, color: color || C.bone }}>{value}</div>
      <div style={{ fontSize: 12, color: C.dim }}>{label}</div>
    </div>
  );
}

export function Row({ k, v, color }: { k: string; v: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.memWall}`, fontSize: 15 }}>
      <span style={{ color: C.dim }}>{k}</span>
      <span className="lb-mono" style={{ color: color || C.bone }}>{v}</span>
    </div>
  );
}
