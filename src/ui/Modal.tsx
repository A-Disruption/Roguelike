import { useEffect, type ReactNode } from "react";
import { C } from "../game/core";
import { act3 } from "./bits";

/* A pop-up card over the screen. Tap outside it or the button to close. */
export function Modal({ title, icon, onClose, children, actions }: {
  title: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(4,5,8,0.72)", display: "flex",
               alignItems: "center", justifyContent: "center", padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#11151C", border: `1px solid ${C.litWall}`, borderRadius: 6, width: "100%", maxWidth: 420,
                 maxHeight: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 10px", borderBottom: `1px solid ${C.memWall}` }}>
          {icon}
          <div style={{ flex: 1, minWidth: 0, fontSize: 19, fontWeight: 600 }}>{title}</div>
          <button className="lb-btn" onClick={onClose} aria-label="close"
            style={{ background: "none", border: "none", color: C.dim, fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "0 2px" }}>×</button>
        </div>
        <div style={{ padding: "12px 16px 14px", overflowY: "auto", fontSize: 14, lineHeight: 1.5 }}>{children}</div>
        {actions && <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>{actions}</div>}
      </div>
    </div>
  );
}

/* the standard button for a modal's action row */
export const modalBtn = (color: string, primary = false) => ({
  ...act3(color), flex: 1, padding: "11px 8px",
  ...(primary ? { background: color, color: "#0A0C10", border: `1px solid ${color}` } : {}),
});
