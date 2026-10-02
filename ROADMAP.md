# Lampblack Roadmap

Tick things off as they ship. Ideas can move between sections or be crossed out (`~~like this~~`) if we decide against them.

## Done — v1.5 "Bosses, collection & new maps"

- [x] **New map generator** — three layout families (mixed-shape rooms, big obstacle halls, organic caverns) with zone decorations: pillars, rubble, water pools, lava rivers with bridges, Abyss chasms you can see across but not cross. Every walkable tile is guaranteed reachable without crossing lava
- [x] **Unique bosses every 5 floors** — Rat King (summons rats), Broodmother (webs + spiderlings), Bone Lich (armor-piercing bolts, raises skeletons, blinks away), Forge Golem (telegraphed slam), Void Maw (pulls you in, telegraphed beam). Boss arenas, health bar, red danger tiles
- [x] **Bestiary & achievements** — Collection tab with bestiary (variants, kills), relics, zones, heroes and 24 feats; tap any tile for details
- [x] **Pause / inventory** — tap the hero portrait for stats, gear, pack, relics and known potions
- [x] **Tabbed main screen** — Play, Upgrades, Collection, More
- [x] **Upgrades go much further** — Vigor 20, Edge 15, Hide 10, Lantern 4, Satchel 6, Greed 10 levels (dailies still start without them)
- [x] **Ranger fixes** — 4-tile bow, amber brackets on targets in reach, clear "too far" message, one careful step when tapping a far tile while watched

## Done — v1.4 "Themed zones"

- [x] **Five zones, four floors each** — The Cellars → The Caves → The Flooded Crypt → The Forge → The Abyss, each with its own colors and title card
- [x] **Zone terrain** — ragged cave walls, pools of water in the crypt, lava in the forge (burns you, monsters avoid it, never blocks the stairs), the Abyss shrinks your sight
- [x] **Zone monsters** — cave spiders (move twice), drowned ones (slow, tough), fire imps (explode when killed), void eyes (shots ignore armor)
- [x] **A warden for every zone** — Cellar, Stone, Drowned, Forge and Void Wardens guard each zone's last floor
- [x] **Zone guide** on the main screen; zones you haven't reached stay "???"

## Done — v1.3 "Character classes"

- [x] **Five heroes** — Wanderer, Ranger, Ember Mage, Knight, Rogue, each with their own stats, kit and built-in relic powers
- [x] **Unlocks** — reach depth 4 (Ranger), defeat 40 monsters (Ember Mage), slay a warden (Knight), open 8 chests (Rogue)
- [x] **Hero of the day** — the daily dungeon picks one hero from the date, the same for everyone

## Done — v1.2 "Relics & the daily"

- [x] **Relics in three tiers** — 10 relics (Bloodthirst Fang, Reaching Gauntlet, Magma Heart, Thorn Bracer, Lucky Coin, Feather Boots, Kindling Pouch, Phoenix Feather, Watcher's Lantern, Quicksilver Ring). Found in chests, on perilous floors and on wardens; higher tiers upgrade ones you have
- [x] **Choose-your-path stairs** — every floor has a normal stair and a red perilous one (tougher monsters, more loot and relics, +50 points)
- [x] **Daily dungeon** — same seed for everyone each UTC day, base hero only, first try counts, countdown to the next one
- [x] **Deterministic runs** — all randomness is seeded; every run is a list of actions that replays to the identical result
- [x] **Run records & share codes** — the record format a leaderboard server would accept (seed, rules version, start stats, action log, claimed result)
- [x] **Ghosts** — friends' shared runs appear as see-through heroes on your map, where they were on the same turn; a gravestone where they fell
- [x] **Local scoreboard** — today's runs from you and shared friends, with replay verification (✓ / unverified)

## Done — v1.1 "Quick wins"

- [x] **Visible gear** — the hero's sprite changes with the weapon in hand and the armor worn; floor loot shows its tier by color
- [x] **Monster variety from what we have** — color variants (e.g. plague rat, cave goblin, burnt skeleton) and monsters that carry visible weapons/armor, which they can drop
- [x] **Unidentified potions** — colored bottles whose effects are shuffled every run; drinking one identifies it
- [x] **Treasure chests** — some locked (find the key on that floor), some are secretly mimics
- [x] **New monster tricks** — goblin archers shoot from range, slimes split when hit, ghosts drift through walls
- [x] **Traps** — hidden spikes, pits that drop you a floor, alarm plates that wake the whole floor; you can spot them when close

## Done — v1.5.1 "Backend-ready data"

- [x] **Tamper-proof verification** — dailies must use the official seed and today's hero; illegal or truncated moves, inflated scores and other rules versions are rejected
- [x] **GameService interface** — the UI no longer touches storage for dailies, runs, leaderboards or ghosts; `LocalGameService` today, a cloud one later
- [x] **Daily dungeon comes from the service** (`{ id, seed, rulesVersion, hero, expiresAt }`), ready for a server-held secret seed
- [x] **Real run ids** issued at run start (what a server's run token will be)
- [x] **Leaderboard rows vs ghost files** — `splitRecord()`; speed ranked by verifiable turns, not wall-clock time
- [x] **`npm run verify`** — checks a share code exactly as a server would

## Next up — online play (needs a small backend)

Plan from the ChatGPT discussion: GitHub Pages (game) + Cloudflare Worker (API) + D1 (users, daily_dungeons, runs, leaderboard) + R2 (best ghost per player per day). Expected cost: $0 at family scale, ~$5/month at thousands of daily players.


The client side is already shaped for this: `RunRecord` in `src/game/replay.ts` is what gets uploaded, and the server re-runs `replayRecord` to compute the score itself instead of trusting the phone.

- [ ] **Backend** — small API + database (e.g. Rust/Axum + SQLite/Postgres, or Supabase/Cloudflare). Tables: users, external_identities, daily_dungeons, runs
- [ ] **Server-issued daily seed** — `HMAC(secret, day + rules version)` so the seed can't be predicted in advance; server clock decides the day
- [ ] **Run tokens** — server issues one ranked token per player per day (enforces "first try counts"); practice runs unlimited
- [ ] **Server replay verification** — run the same TypeScript `replayRecord` on the server (Node/Deno/Bun), or port the rules to Rust once stable
- [ ] **Global & friends leaderboards** — daily / weekly / all-time; extra boards for depth, speed (fewest turns), streaks
- [ ] **Live ghosts** — fetch today's top runs automatically instead of pasting codes
- [ ] **Accounts & linking** — the device `profile.id` becomes a user; later link Apple / Steam identities
- [ ] **Steam build** — wrap the same Vite build in Tauri, add Steamworks via the Rust side; trusted leaderboard writes from the backend

## Medium

- [ ] **Shops** — a merchant on some floors who takes echoes mid-run
- [ ] **Relic choice** — wardens offer "pick one of three" instead of a random relic
- [ ] **Hot-seat co-op** — two heroes on one device, taking turns

## Big features (each its own pass)

- [ ] **More heroes** — e.g. a Beastmaster with a pet, a Cleric who heals

## Rules changes checklist

Anything that changes how a seed plays out (new monsters, item odds, combat math) must bump `RULES_VERSION` in `src/game/core.ts`, otherwise old shared runs and ghosts stop lining up. `npm test` replays hundreds of runs to catch accidental non-determinism.

## Kid-designed content

Monsters, items or relics he invents go here, with who designed them.

-
