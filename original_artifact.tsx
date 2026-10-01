import React, { useEffect, useRef, useReducer, useState, useCallback } from "react";

/* ============================ constants ============================ */

const MW = 31, MH = 29;          // map size
const VW = 11, VH = 13;          // viewport in tiles
const WALL = 0, FLOOR = 1, STAIRS = 2;

const C = {
  void:    "#080A0E",
  memWall: "#161B23",
  memFloor:"#10141A",
  memGlyph:"#39434F",
  litWall: "#4A3524",
  litFloor:"#241B13",
  bone:    "#E6DCC9",
  ember:   "#E9A13B",
  blood:   "#C04A3B",
  verd:    "#5E9482",
  dim:     "#7C8794",
};

const MONSTERS = [
  { k:"rat",     g:"r", name:"cellar rat",  hp:7,  atk:3,  def:0, xp:3,  ech:2,  min:1,  max:5 },
  { k:"bat",     g:"v", name:"blind bat",   hp:6,  atk:4,  def:0, xp:4,  ech:3,  min:1,  max:7,  erratic:true },
  { k:"goblin",  g:"g", name:"goblin",      hp:11, atk:5,  def:0, xp:6,  ech:4,  min:2,  max:10 },
  { k:"skeleton",g:"s", name:"skeleton",    hp:19, atk:8,  def:3, xp:10, ech:7,  min:4,  max:14 },
  { k:"wraith",  g:"w", name:"wraith",      hp:15, atk:9,  def:0, xp:14, ech:10, min:6,  max:99, pierce:true },
  { k:"ogre",    g:"O", name:"ogre",        hp:36, atk:15, def:2, xp:22, ech:16, min:8,  max:99, slow:true },
];
const WARDEN = { k:"warden", g:"W", name:"warden of the deep", hp:40, atk:11, def:2, xp:45, ech:55, boss:true };

const WEAPONS = [
  { name:"rusted knife", atk:1 }, { name:"iron sword", atk:3 }, { name:"hooked spear", atk:5 },
  { name:"runed blade", atk:8 }, { name:"kingsbane", atk:12 }, { name:"the long quiet", atk:17 },
];
const ARMORS = [
  { name:"padded rags", def:1 }, { name:"boiled leather", def:2 }, { name:"chain shirt", def:4 },
  { name:"warden plate", def:6 }, { name:"grave-iron", def:9 },
];

const UPGRADES = [
  { k:"vigor",   name:"Vigor",   blurb:"+7 health",        max:5, costs:[20,35,55,80,110] },
  { k:"edge",    name:"Edge",    blurb:"+1 attack",        max:5, costs:[30,50,75,105,140] },
  { k:"hide",    name:"Hide",    blurb:"+1 armor",         max:3, costs:[45,85,140] },
  { k:"lantern", name:"Lantern", blurb:"+1 tile of sight", max:2, costs:[60,125] },
  { k:"satchel", name:"Satchel", blurb:"start with a tonic",max:3, costs:[25,45,70] },
  { k:"greed",   name:"Greed",   blurb:"+20% echoes",      max:3, costs:[40,70,110] },
];

const KEY_META = "lampblack:meta:v1";
const KEY_RUN  = "lampblack:run:v1";

/* ============================ helpers ============================ */

const rnd = n => Math.floor(Math.random() * n);
const rint = (a, b) => a + rnd(b - a + 1);
const pick = a => a[rnd(a.length)];
const idx = (x, y) => y * MW + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;

function ctr(r) { return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }

function hall(grid, from, to, fixed, horiz) {
  const [a, b] = from < to ? [from, to] : [to, from];
  for (let i = a; i <= b; i++) {
    const x = horiz ? i : fixed, y = horiz ? fixed : i;
    if (inB(x, y)) grid[idx(x, y)] = FLOOR;
  }
}

function genLevel(depth) {
  const grid = new Uint8Array(MW * MH);
  const rooms = [];
  for (let t = 0; t < 120 && rooms.length < 9; t++) {
    const w = rint(4, 8), h = rint(3, 6);
    const x = rint(1, MW - w - 2), y = rint(1, MH - h - 2);
    if (rooms.some(o => x <= o.x + o.w + 1 && o.x <= x + w + 1 && y <= o.y + o.h + 1 && o.y <= y + h + 1)) continue;
    rooms.push({ x, y, w, h });
  }
  rooms.forEach(r => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[idx(x, y)] = FLOOR;
  });
  for (let i = 1; i < rooms.length; i++) {
    const a = ctr(rooms[i - 1]), b = ctr(rooms[i]);
    if (Math.random() < 0.5) { hall(grid, a.x, b.x, a.y, true); hall(grid, a.y, b.y, b.x, false); }
    else { hall(grid, a.y, b.y, a.x, false); hall(grid, a.x, b.x, b.y, true); }
  }
  if (rooms.length < 2) return genLevel(depth);
  const last = rooms[rooms.length - 1];
  const st = ctr(last);
  grid[idx(st.x, st.y)] = STAIRS;
  return { grid, rooms };
}

function freeSpot(room, grid, taken) {
  for (let t = 0; t < 40; t++) {
    const x = rint(room.x, room.x + room.w - 1), y = rint(room.y, room.y + room.h - 1);
    if (grid[idx(x, y)] !== FLOOR) continue;
    if (taken.has(idx(x, y))) continue;
    taken.add(idx(x, y));
    return { x, y };
  }
  return null;
}

function scaleMon(base, depth) {
  const over = Math.max(0, depth - base.min);
  return {
    kind: base.k, glyph: base.g, name: base.name,
    hp: Math.round(base.hp * (1 + 0.13 * over)),
    maxHp: Math.round(base.hp * (1 + 0.13 * over)),
    atk: Math.round(base.atk * (1 + 0.09 * over)),
    def: base.def + Math.floor(over / 4),
    xp: base.xp + over, ech: base.ech + Math.round(over * 1.5),
    erratic: !!base.erratic, pierce: !!base.pierce, slow: !!base.slow, boss: !!base.boss,
    tick: 0,
  };
}

function tierFor(depth, list) {
  const t = Math.min(list.length - 1, Math.floor((depth - 1) / 2.5) + (Math.random() < 0.25 ? 1 : 0));
  return list[Math.max(0, Math.min(list.length - 1, t))];
}

function populate(level, depth) {
  const taken = new Set();
  const mons = [], items = [];
  const { grid, rooms } = level;
  const start = ctr(rooms[0]);
  taken.add(idx(start.x, start.y));

  rooms.forEach((r, i) => {
    if (i === 0) return;
    const n = depth === 1 ? 1 : rint(1, depth < 5 ? 2 : 3);
    for (let j = 0; j < n; j++) {
      const pool = MONSTERS.filter(m => depth >= m.min && depth <= m.max);
      const s = freeSpot(r, grid, taken);
      if (!s) continue;
      mons.push({ ...scaleMon(pick(pool), depth), x: s.x, y: s.y, id: Math.random().toString(36).slice(2) });
    }
  });

  if (depth % 5 === 0) {
    const r = rooms[rooms.length - 1];
    const s = freeSpot(r, grid, taken) || ctr(r);
    const b = scaleMon({ ...WARDEN, min: 5 }, depth);
    mons.push({ ...b, x: s.x, y: s.y, id: "boss" + depth });
  }

  const nItems = rint(3, 5);
  for (let i = 0; i < nItems; i++) {
    const r = rooms[rint(1, rooms.length - 1)];
    const s = freeSpot(r, grid, taken);
    if (!s) continue;
    const roll = Math.random();
    let it;
    if (roll < 0.34) it = { t: "tonic", name: "tonic" };
    else if (roll < 0.46) it = { t: "ember", name: "ember scroll" };
    else if (roll < 0.56) it = { t: "waystone", name: "waystone" };
    else if (roll < 0.72) { const w = tierFor(depth, WEAPONS); it = { t: "weapon", name: w.name, atk: w.atk }; }
    else if (roll < 0.86) { const a = tierFor(depth, ARMORS); it = { t: "armor", name: a.name, def: a.def }; }
    else it = { t: "echoes", name: "spill of echoes", amt: rint(4, 9) + depth * 2 };
    items.push({ ...it, x: s.x, y: s.y });
  }
  return { mons, items, start };
}

/* line of sight, Bresenham against walls */
function los(grid, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let g = 0; g < 60; g++) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (!inB(x, y)) return false;
    if (x === x1 && y === y1) return true;
    if (grid[idx(x, y)] === WALL) return false;
  }
  return false;
}

function computeFov(g) {
  const R = g.sight;
  const vis = new Set();
  for (let y = g.p.y - R; y <= g.p.y + R; y++) {
    for (let x = g.p.x - R; x <= g.p.x + R; x++) {
      if (!inB(x, y)) continue;
      const d = Math.hypot(x - g.p.x, y - g.p.y);
      if (d > R + 0.3) continue;
      if (los(g.grid, g.p.x, g.p.y, x, y)) { vis.add(idx(x, y)); g.seen[idx(x, y)] = 1; }
    }
  }
  return vis;
}

function bfsPath(g, tx, ty) {
  const start = idx(g.p.x, g.p.y), goal = idx(tx, ty);
  if (start === goal) return null;
  if (!g.seen[goal] || g.grid[goal] === WALL) return null;
  const prev = new Int32Array(MW * MH).fill(-1);
  const q = [start]; prev[start] = start;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) break;
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (prev[ni] !== -1) continue;
      if (!g.seen[ni] || g.grid[ni] === WALL) continue;
      prev[ni] = cur; q.push(ni);
    }
  }
  if (prev[goal] === -1) return null;
  const path = [];
  let cur = goal;
  while (cur !== start) { path.push({ x: cur % MW, y: (cur / MW) | 0 }); cur = prev[cur]; }
  return path.reverse();
}

/* ============================ meta ============================ */

const freshMeta = () => ({ echoes: 0, best: 0, runs: 0, kills: 0, up: {} });

function playerBase(meta) {
  const u = meta.up || {};
  return {
    maxHp: 32 + 7 * (u.vigor || 0),
    atk: 5 + (u.edge || 0),
    def: 0 + (u.hide || 0),
    sight: 6 + (u.lantern || 0),
    tonics: 1 + (u.satchel || 0),
    greed: 1 + 0.2 * (u.greed || 0),
  };
}

function newRun(meta) {
  const b = playerBase(meta);
  const depth = 1;
  const lvl = genLevel(depth);
  const pop = populate(lvl, depth);
  const g = {
    depth, grid: lvl.grid, rooms: lvl.rooms,
    mons: pop.mons, items: pop.items,
    seen: new Uint8Array(MW * MH),
    p: { x: pop.start.x, y: pop.start.y },
    hp: b.maxHp, maxHp: b.maxHp, atk: b.atk, def: b.def, sight: b.sight,
    weapon: null, armor: null,
    inv: { tonic: b.tonics, ember: 0, waystone: 0 },
    level: 1, xp: 0, next: 12,
    echoes: 0, greed: b.greed, kills: 0, turns: 0,
    log: ["You wake at the mouth of the depths. Something below is still burning."],
    dead: false, path: null,
  };
  g.vis = computeFov(g);
  return g;
}

function descend(g) {
  g.depth += 1;
  const lvl = genLevel(g.depth);
  const pop = populate(lvl, g.depth);
  g.grid = lvl.grid; g.rooms = lvl.rooms;
  g.mons = pop.mons; g.items = pop.items;
  g.seen = new Uint8Array(MW * MH);
  g.p = { x: pop.start.x, y: pop.start.y };
  g.path = null;
  const rest = Math.round(g.maxHp * 0.12);
  const before = g.hp;
  g.hp = Math.min(g.maxHp, g.hp + rest);
  g.vis = computeFov(g);
  say(g, `Depth ${g.depth}. The air gets colder.`);
  if (g.hp > before) say(g, `You catch your breath on the stair. +${g.hp - before}.`);
}

function say(g, s) { g.log.push(s); if (g.log.length > 24) g.log.shift(); }

function totalAtk(g) { return g.atk + (g.weapon ? g.weapon.atk : 0); }
function totalDef(g) { return g.def + (g.armor ? g.armor.def : 0); }

function dmgRoll(atk, def) {
  return Math.max(1, Math.round((atk - def) * (0.82 + Math.random() * 0.36)));
}

/* ============================ turn logic ============================ */

function grantXp(g, n) {
  g.xp += n;
  while (g.xp >= g.next) {
    g.xp -= g.next;
    g.level += 1;
    g.next = Math.round(g.next * 1.55);
    g.maxHp += 5; g.hp = Math.min(g.maxHp, g.hp + 8);
    if (g.level % 2 === 0) g.atk += 1;
    say(g, `You steady. Level ${g.level}.`);
  }
}

function killMon(g, m) {
  g.mons = g.mons.filter(o => o !== m);
  g.kills += 1;
  g.echoes += m.ech;
  grantXp(g, m.xp);
  say(g, `The ${m.name} falls.`);
}

function playerAttack(g, m, flash) {
  const d = dmgRoll(totalAtk(g), m.def);
  m.hp -= d;
  flash(idx(m.x, m.y), "hit");
  if (m.hp <= 0) killMon(g, m);
  else say(g, `You hit the ${m.name} for ${d}.`);
}

function monsterTurn(g, flash) {
  for (const m of [...g.mons]) {
    if (m.slow) { m.tick = (m.tick + 1) % 2; if (m.tick === 1) continue; }
    const dist = Math.max(Math.abs(m.x - g.p.x), Math.abs(m.y - g.p.y));
    if (dist === 1) {
      const d = dmgRoll(m.atk, m.pierce ? 0 : totalDef(g));
      g.hp -= d;
      say(g, `The ${m.name} hits you for ${d}.`);
      flash(idx(g.p.x, g.p.y), "hurt");
      if (g.hp <= 0) { g.hp = 0; g.dead = true; return; }
      continue;
    }
    const aware = dist <= g.sight + 2 && los(g.grid, m.x, m.y, g.p.x, g.p.y);
    let nx = m.x, ny = m.y;
    if (aware && !(m.erratic && Math.random() < 0.35)) {
      const dx = Math.sign(g.p.x - m.x), dy = Math.sign(g.p.y - m.y);
      const tries = Math.abs(g.p.x - m.x) > Math.abs(g.p.y - m.y)
        ? [[dx, 0], [0, dy], [dx, dy]] : [[0, dy], [dx, 0], [dx, dy]];
      for (const [ax, ay] of tries) {
        const tx = m.x + ax, ty = m.y + ay;
        if (!inB(tx, ty) || g.grid[idx(tx, ty)] === WALL) continue;
        if (tx === g.p.x && ty === g.p.y) continue;
        if (g.mons.some(o => o !== m && o.x === tx && o.y === ty)) continue;
        nx = tx; ny = ty; break;
      }
    } else if (Math.random() < 0.4) {
      const [ax, ay] = pick([[0,1],[0,-1],[1,0],[-1,0]]);
      const tx = m.x + ax, ty = m.y + ay;
      if (inB(tx, ty) && g.grid[idx(tx, ty)] !== WALL && !(tx === g.p.x && ty === g.p.y)
          && !g.mons.some(o => o !== m && o.x === tx && o.y === ty)) { nx = tx; ny = ty; }
    }
    m.x = nx; m.y = ny;
  }
}

function pickUp(g) {
  const it = g.items.find(i => i.x === g.p.x && i.y === g.p.y);
  if (!it) return;
  g.items = g.items.filter(i => i !== it);
  if (it.t === "tonic" || it.t === "ember" || it.t === "waystone") {
    g.inv[it.t] += 1; say(g, `You pocket a ${it.name}.`);
  } else if (it.t === "echoes") {
    g.echoes += it.amt; say(g, `${it.amt} echoes, still warm.`);
  } else if (it.t === "weapon") {
    if (!g.weapon || it.atk > g.weapon.atk) { g.weapon = it; say(g, `You take up the ${it.name}. +${it.atk} attack.`); }
    else { const v = 5 + it.atk * 3; g.echoes += v; say(g, `You leave the ${it.name}, keep the fittings. +${v} echoes.`); }
  } else if (it.t === "armor") {
    if (!g.armor || it.def > g.armor.def) { g.armor = it; say(g, `You strap on the ${it.name}. +${it.def} armor.`); }
    else { const v = 5 + it.def * 4; g.echoes += v; say(g, `The ${it.name} is worse than yours. +${v} echoes.`); }
  }
}

/* ============================ storage ============================ */

/* Storage has been rejecting writes, so this layer is defensive:
   it probes what actually works, keeps the payload tiny, and never
   pretends a failed save succeeded. */

function errMsg(e) { return (e && (e.message || String(e))) || "unknown error"; }

async function rawSet(key, value) {
  try { return await window.storage.set(key, value, false); }
  catch (e1) {
    try { return await window.storage.set(key, value); }   // some builds reject the shared arg
    catch (e2) { e2.firstTry = errMsg(e1); throw e2; }
  }
}
async function rawGet(key) {
  try { return await window.storage.get(key, false); }
  catch { try { return await window.storage.get(key); } catch { return null; } }
}

/* Figure out what this environment will actually accept. */
async function probeStorage() {
  if (typeof window === "undefined" || !window.storage) return { ok: false, why: "no storage API in this view" };
  try { await rawSet("lampblackprobe", "1"); }
  catch (e) { return { ok: false, draft: true, why: errMsg(e) }; }
  let readBack = null;
  try { const r = await rawGet("lampblackprobe"); readBack = r ? r.value : null; }
  catch (e) { return { ok: false, why: "read rejected: " + errMsg(e) }; }
  if (readBack == null) return { ok: false, why: "write accepted but nothing read back" };
  try { await rawSet("lampblackprobe", "x".repeat(6000)); }
  catch (e) { return { ok: true, small: true, why: "6KB write rejected: " + errMsg(e) }; }
  return { ok: true, small: false };
}

/* run-length encode the map arrays; they are mostly long runs of one value */
function rle(str) {
  let out = "", i = 0;
  while (i < str.length) { let j = i; while (j < str.length && str[j] === str[i]) j++; out += str[i] + (j - i) + "."; i = j; }
  return out;
}
function unrle(s) {
  let out = "";
  for (const part of s.split(".")) { if (!part) continue; out += part[0].repeat(Number(part.slice(1))); }
  return out;
}

function monFromKind(kind, depth) {
  const base = kind === "warden" ? { ...WARDEN, min: 5 } : MONSTERS.find(m => m.k === kind);
  return base ? scaleMon(base, depth) : null;
}

async function loadKey(key) {
  try {
    const r = await rawGet(key);
    if (!r || r.value == null) return null;
    return typeof r.value === "string" ? JSON.parse(r.value) : r.value;
  } catch { return null; }
}

async function saveKey(key, val) {
  try { await rawSet(key, JSON.stringify(val)); return true; }
  catch { return false; }
}

/* Compact save: stats are rebuilt from kind + depth rather than stored. */
function serializeRun(g) {
  return {
    d: g.depth,
    G: rle(Array.from(g.grid).join("")),
    S: rle(Array.from(g.seen).join("")),
    m: g.mons.map(m => [m.kind, m.x, m.y, m.hp, m.tick || 0]),
    i: g.items.map(i => [i.t, i.x, i.y, i.atk ?? i.def ?? i.amt ?? 0, i.name]),
    p: [g.p.x, g.p.y],
    h: [g.hp, g.maxHp, g.atk, g.def, g.sight],
    w: g.weapon ? [g.weapon.name, g.weapon.atk] : null,
    a: g.armor ? [g.armor.name, g.armor.def] : null,
    v: [g.inv.tonic, g.inv.ember, g.inv.waystone],
    x: [g.level, g.xp, g.next],
    e: [g.echoes, g.greed, g.kills, g.turns],
    l: g.log.slice(-3),
  };
}

function deserializeRun(o) {
  const depth = o.d;
  const g = {
    depth,
    grid: Uint8Array.from(unrle(o.G).split("").map(Number)),
    seen: Uint8Array.from(unrle(o.S).split("").map(Number)),
    rooms: [],
    mons: o.m.map(([k, x, y, hp, tick]) => {
      const b = monFromKind(k, depth);
      return b ? { ...b, x, y, hp, tick, id: Math.random().toString(36).slice(2) } : null;
    }).filter(Boolean),
    items: o.i.map(([t, x, y, n, name]) => {
      const it = { t, x, y, name };
      if (t === "weapon") it.atk = n; else if (t === "armor") it.def = n; else if (t === "echoes") it.amt = n;
      return it;
    }),
    p: { x: o.p[0], y: o.p[1] },
    hp: o.h[0], maxHp: o.h[1], atk: o.h[2], def: o.h[3], sight: o.h[4],
    weapon: o.w ? { t: "weapon", name: o.w[0], atk: o.w[1] } : null,
    armor: o.a ? { t: "armor", name: o.a[0], def: o.a[1] } : null,
    inv: { tonic: o.v[0], ember: o.v[1], waystone: o.v[2] },
    level: o.x[0], xp: o.x[1], next: o.x[2],
    echoes: o.e[0], greed: o.e[1], kills: o.e[2], turns: o.e[3],
    log: o.l || ["You come back to yourself in the dark."],
    dead: false, path: null,
  };
  g.vis = computeFov(g);
  return g;
}

/* ============================ sprites ============================ */
/* 8x8 pixel art. '.' is transparent; other chars index the sprite's palette. */

const SPRITES = {
  player: {
    pal: { c:"#38445A", d:"#4C5A73", f:"#D9B48A", k:"#12161E", e:"#E9A13B" },
    rows: [
      "..cccc..",
      ".cddddc.",
      ".cffffc.",
      ".cfkkfc.",
      "..dddd..",
      ".cddddc.",
      ".cc..cce",
      ".c....ce",
    ],
  },
  rat: {
    pal: { b:"#7A5138", d:"#5C3B28", k:"#0E1117", t:"#93705C" },
    rows: [
      "........",
      "..d..d..",
      ".dbbbbd.",
      ".bkbbkb.",
      ".bbbbbb.",
      "tbbbbbb.",
      ".b.bb.b.",
      "........",
    ],
  },
  bat: {
    pal: { w:"#5B4A6B", b:"#2E2438", k:"#C04A3B" },
    rows: [
      "........",
      "w......w",
      "ww.bb.ww",
      "wwwbbwww",
      ".wwkkww.",
      "..wbbw..",
      "...bb...",
      "........",
    ],
  },
  goblin: {
    pal: { g:"#5E7A46", d:"#43592F", k:"#0E1117", r:"#8C8478", y:"#D4C36A" },
    rows: [
      "..d..d..",
      ".dggggd.",
      ".gkggkg.",
      ".ggyygg.",
      "..gggg..",
      "rdggggd.",
      "r.g..g..",
      "..d..d..",
    ],
  },
  skeleton: {
    pal: { b:"#D8D2BE", d:"#9A9484", k:"#0E1117" },
    rows: [
      "..bbbb..",
      ".bkbbkb.",
      ".bbddbb.",
      "..dbbd..",
      ".bbbbbb.",
      "db.bb.bd",
      ".b....b.",
      ".d....d.",
    ],
  },
  wraith: {
    pal: { w:"#6E7E96", d:"#3C4759", p:"#BFE3E0" },
    rows: [
      "...dd...",
      "..dwwd..",
      ".dwppwd.",
      ".wwwwww.",
      "d.wwww.d",
      ".wwwwww.",
      "..dwwd..",
      "...dd...",
    ],
  },
  ogre: {
    pal: { o:"#6B6A4A", d:"#4E4D34", k:"#0E1117", m:"#D8D2BE" },
    rows: [
      ".oooooo.",
      "oodoodoo",
      "okoooko.",
      ".oooooo.",
      ".ommmmo.",
      "dooooood",
      ".oo..oo.",
      ".d....d.",
    ],
  },
  warden: {
    pal: { p:"#9A5AA8", d:"#61356E", k:"#F2D06B", m:"#2A1330" },
    rows: [
      "k.k..k.k",
      ".pppppp.",
      ".pkppkp.",
      ".pmmmmp.",
      "dppppppd",
      ".pppppp.",
      ".pp..pp.",
      ".d....d.",
    ],
  },
  tonic: {
    pal: { g:"#8FA3B0", r:"#C04A3B", c:"#6B7A85" },
    rows: [
      "..cccc..",
      "...cc...",
      "...cc...",
      "..gggg..",
      ".grrrrg.",
      ".grrrrg.",
      ".grrrrg.",
      "..gggg..",
    ],
  },
  ember: {
    pal: { p:"#D8CDAE", d:"#A2946F", f:"#E9A13B" },
    rows: [
      ".dddddd.",
      ".pppppp.",
      ".pdffdp.",
      ".pffffp.",
      ".pdffdp.",
      ".pppppp.",
      ".pppppp.",
      ".dddddd.",
    ],
  },
  waystone: {
    pal: { g:"#6FC4C8", d:"#3A7E86", l:"#CFF3F2" },
    rows: [
      "...dd...",
      "..dllg..",
      ".dlgggd.",
      "dlggggdd",
      "dgggggdd",
      ".dggggd.",
      "..dggd..",
      "...dd...",
    ],
  },
  weapon: {
    pal: { s:"#C9CFD6", d:"#7E858F", h:"#7A5138", g:"#D4C36A" },
    rows: [
      "......ss",
      ".....ssd",
      "....ssd.",
      "...ssd..",
      "..ssd...",
      ".gsg....",
      "hgh.....",
      "h.......",
    ],
  },
  armor: {
    pal: { m:"#8A94A3", d:"#5A6373", l:"#C2CAD6" },
    rows: [
      ".mmmmmm.",
      ".mlllmm.",
      ".mllmmm.",
      ".mmmmmm.",
      ".dmmmmd.",
      "..dmmd..",
      "...dd...",
      "........",
    ],
  },
  echoes: {
    pal: { g:"#5E9482", l:"#9FD4BE", d:"#3A5F53" },
    rows: [
      "........",
      "..ggg...",
      ".glllg..",
      ".gdddg..",
      "..ggg.g.",
      "...gglg.",
      "...gddg.",
      "....gg..",
    ],
  },
  stairs: {
    pal: { a:"#4A3524", b:"#2C2016", c:"#6B5540" },
    rows: [
      "cccccccc",
      "baaaaaaa",
      "bbcccccc",
      "bbbaaaaa",
      "bbbbcccc",
      "bbbbbaaa",
      "bbbbbbcc",
      "bbbbbbba",
    ],
  },
};

const spriteCache = new Map();

function spriteCanvas(name) {
  if (spriteCache.has(name)) return spriteCache.get(name);
  const def = SPRITES[name];
  if (!def) return null;
  const cv = document.createElement("canvas");
  cv.width = 8; cv.height = 8;
  const cx = cv.getContext("2d");
  for (let y = 0; y < 8; y++) {
    const row = def.rows[y] || "........";
    for (let x = 0; x < 8; x++) {
      const ch = row[x];
      if (!ch || ch === ".") continue;
      const col = def.pal[ch];
      if (!col) continue;
      cx.fillStyle = col;
      cx.fillRect(x, y, 1, 1);
    }
  }
  spriteCache.set(name, cv);
  return cv;
}

const hash32 = n => { let h = (n * 2654435761) % 4294967296; return (h ^ (h >>> 13)) >>> 0; };

function drawMap(ctx, g, ts, camX, camY, flashes) {
  ctx.imageSmoothingEnabled = false;
  const blit = (name, px, py, alpha) => {
    const cv = spriteCanvas(name);
    if (!cv) return;
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(cv, 0, 0, 8, 8, Math.round(px), Math.round(py), ts, ts);
    ctx.globalAlpha = 1;
  };

  for (let vy = 0; vy < VH; vy++) {
    for (let vx = 0; vx < VW; vx++) {
      const x = camX + vx, y = camY + vy;
      const px = vx * ts, py = vy * ts;
      const ok = inB(x, y);
      const i = ok ? idx(x, y) : -1;

      if (!ok || !g.seen[i]) { ctx.fillStyle = C.void; ctx.fillRect(px, py, ts, ts); continue; }

      const vis = g.vis.has(i);
      const wall = g.grid[i] === WALL;
      ctx.fillStyle = wall ? (vis ? C.litWall : C.memWall) : (vis ? C.litFloor : C.memFloor);
      ctx.fillRect(px, py, ts, ts);

      const h = hash32(i);
      if (wall) {
        ctx.fillStyle = vis ? "#63482F" : "#1D2430";
        ctx.fillRect(px, py, ts, Math.max(1, Math.round(ts * 0.11)));
        if (h % 3 === 0) {
          ctx.fillStyle = vis ? "#3B2A1B" : "#121821";
          ctx.fillRect(px + ts * 0.28, py + ts * 0.42, ts * 0.3, ts * 0.11);
        }
      } else if (h % 6 === 0) {
        ctx.fillStyle = vis ? "#33261A" : "#141922";
        ctx.fillRect(px + ts * 0.3, py + ts * 0.55, ts * 0.22, ts * 0.1);
      }

      if (g.grid[i] === STAIRS) blit("stairs", px, py, vis ? 1 : 0.4);

      const it = g.items.find(o => o.x === x && o.y === y);
      if (it) blit(it.t, px, py, vis ? 1 : 0.35);

      if (vis) {
        const m = g.mons.find(o => o.x === x && o.y === y);
        if (m) blit(m.kind, px, py, 1);
      }

      if (x === g.p.x && y === g.p.y) blit("player", px, py, 1);

      const fl = flashes[i];
      if (fl) {
        ctx.fillStyle = fl === "hurt" ? "rgba(160,30,20,0.55)" : "rgba(220,80,60,0.5)";
        ctx.fillRect(px, py, ts, ts);
      }
    }
  }
}

/* ============================ chrome ============================ */

const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+Condensed:wght@400;600&display=swap');
.lb { font-family:'IBM Plex Sans Condensed', ui-sans-serif, system-ui, sans-serif; }
.lb-mono { font-family:'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace; }
.lb-btn { -webkit-tap-highlight-color:transparent; transition: background 120ms, border-color 120ms; }
.lb-btn:active { transform: translateY(1px); }
.lb-btn:focus-visible { outline:2px solid ${C.ember}; outline-offset:2px; }
canvas.lb-map { touch-action: manipulation; -webkit-tap-highlight-color:transparent; image-rendering: pixelated; }
`;

function Shell({ children }) {
  return (
    <div className="lb" style={{
      height: "100dvh", width: "100%", background: C.void, color: C.bone,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </div>
  );
}

function ActBtn({ label, n, onClick, sprite }) {
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

function SpriteIcon({ name, size = 16 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    const cx = cv.getContext("2d");
    cx.imageSmoothingEnabled = false;
    const src = spriteCanvas(name);
    if (src) cx.drawImage(src, 0, 0, 8, 8, 0, 0, size * dpr, size * dpr);
  }, [name, size]);
  return <canvas ref={ref} className="lb-map" style={{ width: size, height: size, display: "block" }} />;
}

/* ============================ component ============================ */

export default function LampblackDepths() {
  const G = useRef(null);
  const [, force] = useReducer(x => x + 1, 0);
  const [screen, setScreen] = useState("loading");
  const [meta, setMeta] = useState(freshMeta());
  const [hasRun, setHasRun] = useState(false);
  const [flashes, setFlashes] = useState({});
  const [ts, setTs] = useState(30);
  const [summary, setSummary] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | failed
  const [saveErr, setSaveErr] = useState(null);
  const [store, setStore] = useState(null);
  const storeRef = useRef(null);
  const mapBox = useRef(null);
  const canvasRef = useRef(null);
  const walkTimer = useRef(null);
  const saveTimer = useRef(null);
  const flashTimer = useRef({});

  /* ---------------- storage ---------------- */

  const writeRunRef = useRef(null);
  const lastWrite = useRef(0);
  const writeRun = useCallback(async (retry = false) => {
    const g = G.current;
    if (!g || g.dead) return;
    const st = storeRef.current;
    if (st && !st.ok) { setSaveErr(st.why); setSaveState("failed"); return; }
    setSaveState("saving");
    lastWrite.current = Date.now();
    const payload = JSON.stringify(serializeRun(g));
    try {
      await window.storage.set(KEY_RUN, payload, false);
      const back = await window.storage.get(KEY_RUN, false);
      // the value may come back as a string or already-parsed; check the run matches, not the bytes
      if (!back) throw new Error("nothing read back");
      const v = typeof back.value === "string" ? JSON.parse(back.value) : back.value;
      if (!v || v.depth !== g.depth || v.turns !== g.turns) throw new Error("read back a different run");
      setSaveErr(null);
      setSaveState("saved");
    } catch (e) {
      const msg = (e && (e.message || String(e))) || "unknown error";
      console.error("save failed:", e);
      if (!retry) { setTimeout(() => writeRunRef.current(true), 2500); return; }
      setSaveErr(msg.slice(0, 90));
      setSaveState("failed");
    }
  }, []);
  writeRunRef.current = writeRun;

  const MIN_GAP = 10000; // storage requests are rate limited; don't write every turn
  const persistRun = useCallback((immediate = false) => {
    clearTimeout(saveTimer.current);
    if (immediate) { writeRun(); return; }
    const wait = Math.max(600, MIN_GAP - (Date.now() - lastWrite.current));
    saveTimer.current = setTimeout(() => writeRun(), wait);
  }, [writeRun]);

  /* flush on background / close — this is what survives an accidental swipe-away */
  useEffect(() => {
    const flush = () => { if (G.current && !G.current.dead) { clearTimeout(saveTimer.current); writeRun(); } };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, [writeRun]);

  /* boot: resume straight into the run if there is one */
  useEffect(() => {
    (async () => {
      const probe = await probeStorage();
      setStore(probe); storeRef.current = probe;
      if (!probe.ok) { setSaveState("failed"); setSaveErr(probe.why); }
      const m = await loadKey(KEY_META);
      if (m) setMeta({ ...freshMeta(), ...m });
      const r = await loadKey(KEY_RUN);
      if (r) {
        try {
          G.current = deserializeRun(r);
          setHasRun(true);
          setSaveState("saved");
          setScreen("game");
          return;
        } catch (e) { console.error("could not restore run:", e); }
      }
      setScreen("hub");
    })();
  }, []);

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
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const camX = Math.max(0, Math.min(MW - VW, g.p.x - (VW >> 1)));
    const camY = Math.max(0, Math.min(MH - VH, g.p.y - (VH >> 1)));
    drawMap(ctx, g, ts, camX, camY, flashes);
  });

  /* ---------------- turns ---------------- */

  const flash = useCallback((i, kind) => {
    setFlashes(f => ({ ...f, [i]: kind }));
    clearTimeout(flashTimer.current[i]);
    flashTimer.current[i] = setTimeout(() => {
      setFlashes(f => { const n = { ...f }; delete n[i]; return n; });
    }, 170);
  }, []);

  const finishRun = useCallback(async () => {
    const g = G.current;
    const earned = Math.round(g.echoes * g.greed);
    const nm = {
      ...meta, echoes: meta.echoes + earned, best: Math.max(meta.best, g.depth),
      runs: meta.runs + 1, kills: meta.kills + g.kills,
    };
    setMeta(nm);
    setSummary({ depth: g.depth, kills: g.kills, earned, level: g.level, record: g.depth > meta.best });
    setHasRun(false);
    clearTimeout(saveTimer.current);
    await saveKey(KEY_META, nm);
    try { await window.storage.delete(KEY_RUN); } catch { /* nothing to remove */ }
    setScreen("death");
  }, [meta]);

  const act = useCallback((fn) => {
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

  const tryStep = useCallback((tx, ty) => {
    const g = G.current;
    if (!inB(tx, ty) || g.grid[idx(tx, ty)] === WALL) return false;
    const m = g.mons.find(o => o.x === tx && o.y === ty);
    if (m) { act(gg => playerAttack(gg, m, flash)); return true; }
    act(gg => { gg.p = { x: tx, y: ty }; pickUp(gg); });
    return true;
  }, [act, flash]);

  const stopWalk = useCallback(() => {
    clearTimeout(walkTimer.current);
    if (G.current) G.current.path = null;
  }, []);

  const enemyInSight = g => g.mons.some(m => g.vis.has(idx(m.x, m.y)));

  const stepWalk = useCallback(() => {
    const g = G.current;
    if (!g || g.dead || !g.path || !g.path.length) { if (g) g.path = null; force(); return; }
    if (enemyInSight(g)) { g.path = null; force(); return; }
    const next = g.path.shift();
    const item = g.items.some(i => i.x === next.x && i.y === next.y);
    tryStep(next.x, next.y);
    if (!g.dead && g.path && g.path.length && !item && !enemyInSight(g)) {
      walkTimer.current = setTimeout(stepWalk, 85);
    } else { g.path = null; force(); }
  }, [tryStep]);

  const onCanvasTap = useCallback((e) => {
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

  const useTonic = () => act(g => {
    if (g.inv.tonic <= 0) return;
    g.inv.tonic -= 1;
    const heal = Math.round(g.maxHp * 0.45);
    g.hp = Math.min(g.maxHp, g.hp + heal);
    say(g, `The tonic burns going down. +${heal}.`);
  });

  const useEmber = () => act(g => {
    if (g.inv.ember <= 0) return;
    g.inv.ember -= 1;
    const targets = g.mons.filter(m => g.vis.has(idx(m.x, m.y)));
    if (!targets.length) { say(g, "The scroll flares at nothing."); return; }
    say(g, "Fire runs the room.");
    for (const m of targets) {
      const d = rint(9, 15) + g.depth;
      m.hp -= d;
      flash(idx(m.x, m.y), "hit");
      if (m.hp <= 0) killMon(g, m);
    }
  });

  const useWaystone = () => act(g => {
    if (g.inv.waystone <= 0) return;
    g.inv.waystone -= 1;
    const spots = [];
    for (let i = 0; i < MW * MH; i++) if (g.seen[i] && g.grid[i] !== WALL) spots.push(i);
    const far = spots.filter(i => {
      const x = i % MW, y = (i / MW) | 0;
      return Math.hypot(x - g.p.x, y - g.p.y) > 7 && !g.mons.some(m => m.x === x && m.y === y);
    });
    const t = pick(far.length ? far : spots);
    g.p = { x: t % MW, y: (t / MW) | 0 };
    say(g, "The waystone pulls, and the room changes.");
    pickUp(g);
  });

  const takeStairs = () => {
    const g = G.current;
    if (g.grid[idx(g.p.x, g.p.y)] !== STAIRS) return;
    descend(g);
    persistRun(true);
    force();
  };

  const startRun = () => {
    stopWalk();
    G.current = newRun(meta);
    setHasRun(true);
    persistRun(true);
    setScreen("game");
  };

  const buy = async (u) => {
    const lvl = meta.up[u.k] || 0;
    if (lvl >= u.max) return;
    const cost = u.costs[lvl];
    if (meta.echoes < cost) return;
    const nm = { ...meta, echoes: meta.echoes - cost, up: { ...meta.up, [u.k]: lvl + 1 } };
    setMeta(nm);
    await saveKey(KEY_META, nm);
  };

  const wipe = async () => {
    const nm = freshMeta();
    setMeta(nm); G.current = null; setHasRun(false);
    await saveKey(KEY_META, nm);
    try { await window.storage.delete(KEY_RUN); } catch { /* nothing to remove */ }
  };

  useEffect(() => () => { clearTimeout(walkTimer.current); clearTimeout(saveTimer.current); }, []);

  /* ---------------- screens ---------------- */

  if (screen === "loading") {
    return <Shell><div style={{ margin: "auto", color: C.dim }} className="lb-mono">lighting the lamp…</div></Shell>;
  }

  if (screen === "hub") {
    return (
      <Shell>
        <div style={{ flex: 1, overflowY: "auto", padding: "26px 20px 24px", maxWidth: 520, width: "100%", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SpriteIcon name="player" size={28} />
            <h1 style={{ margin: 0, fontSize: 29, fontWeight: 600, letterSpacing: "-0.01em" }}>The Lampblack Depths</h1>
          </div>
          <p style={{ color: C.dim, marginTop: 8, marginBottom: 20, fontSize: 15, lineHeight: 1.5, maxWidth: "46ch" }}>
            You go down, you die, you come back with what the dark gave you. Echoes are the only thing that survives a death.
          </p>

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
              const cost = maxed ? null : u.costs[lvl];
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
            <p style={{ margin: "0 0 8px", color: store && !store.ok ? C.blood : C.memGlyph }}>
              {store == null ? "Checking whether this device can store progress."
                : store.ok ? "Progress is saving. You can close this and come back to the run."
                : "Draft artifacts cannot save. Publish this from the share menu and progress will carry between sessions."}
            </p>
            <button onClick={wipe} style={{ background: "none", border: "none", color: C.memGlyph, textDecoration: "underline", padding: 0, font: "inherit", cursor: "pointer" }}>
              Erase all progress
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (screen === "death" && summary) {
    return (
      <Shell>
        <div style={{ margin: "auto", padding: 26, maxWidth: 420, width: "100%" }}>
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
        <button className="lb-btn" onClick={() => { stopWalk(); persistRun(true); setScreen("hub"); }}
          style={{ background: "none", border: "none", color: C.dim, font: "inherit", fontSize: 20, padding: "0 4px", cursor: "pointer" }}>‹</button>
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
        <button className="lb-btn" onClick={() => persistRun(true)} aria-label="save now"
          style={{ background: "none", border: "none", padding: 6, cursor: "pointer", lineHeight: 0 }}>
          <span style={{ display: "block", width: 8, height: 8, borderRadius: 4, background: saveColor }} />
        </button>
      </div>

      {saveState === "failed" && (
        <div style={{ background: "#2A100C", color: C.blood, fontSize: 12.5, padding: "6px 14px", lineHeight: 1.4 }}>
          {store && !store.ok
            ? <>Runs only save once this artifact is published. Publish it from the share menu, then reopen.</>
            : <>Not saving{saveErr ? <span className="lb-mono" style={{ color: "#8A5B54" }}> — {saveErr}</span> : null}. Tap the dot to retry.</>}
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
        <ActBtn label="Tonic" n={g.inv.tonic} onClick={useTonic} sprite="tonic" />
        <ActBtn label="Ember" n={g.inv.ember} onClick={useEmber} sprite="ember" />
        <ActBtn label="Waystone" n={g.inv.waystone} onClick={useWaystone} sprite="waystone" />
      </div>
    </Shell>
  );
}

/* ============================ small pieces ============================ */

function btn(color, primary) {
  return {
    font: "inherit", flex: 1, padding: "13px 14px", fontSize: 16, fontWeight: 600,
    borderRadius: 3, cursor: "pointer",
    background: primary ? color : "transparent",
    color: primary ? "#0A0C10" : color,
    border: `1px solid ${color}`,
  };
}

function act3(color) {
  return {
    font: "inherit", padding: "10px 6px", background: "transparent", border: "1px solid #1E252F",
    color, borderRadius: 3, fontSize: 14, fontWeight: 600, cursor: "pointer",
  };
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div className="lb-mono" style={{ fontSize: 20, color: color || "#E6DCC9" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#7C8794" }}>{label}</div>
    </div>
  );
}

function Row({ k, v, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #161B23", fontSize: 15 }}>
      <span style={{ color: "#7C8794" }}>{k}</span>
      <span className="lb-mono" style={{ color: color || "#E6DCC9" }}>{v}</span>
    </div>
  );
}
