# Lampblack Roadmap

Tick things off as they ship. Ideas can move between sections or be crossed out (`~~like this~~`) if we decide against them.

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

## Next up — online play (needs a small backend)

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
- [ ] **Bestiary & achievements** — a collection page that fills in as you meet monsters and find relics
- [ ] **Relic choice** — wardens offer "pick one of three" instead of a random relic
- [ ] **Hot-seat co-op** — two heroes on one device, taking turns

## Big features (each its own pass)

- [ ] **Themed zones** — cellars → caves → flooded crypt → lava forge, each with their own monsters and colors
- [ ] **Character classes** — unlockable heroes with different starts (archer, ember mage…)
- [ ] **Unique boss fights** every 5 floors, each with special attacks

## Rules changes checklist

Anything that changes how a seed plays out (new monsters, item odds, combat math) must bump `RULES_VERSION` in `src/game/core.ts`, otherwise old shared runs and ghosts stop lining up. `npm test` replays hundreds of runs to catch accidental non-determinism.

## Kid-designed content

Monsters, items or relics he invents go here, with who designed them.

-
