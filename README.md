# The Lampblack Depths

A roguelite you install to the iPhone home screen as a web app (PWA). Saves are kept
on the device after every move, and it works offline.

`original_artifact.tsx` is the Claude artifact the game started from, kept for reference.

## Layout

| Path | What's there |
|---|---|
| `src/game/core.ts` | Map generation, monsters, items, combat, save format |
| `src/game/sprites.ts` | 8×8 pixel-art sprites and map drawing |
| `src/game/storage.ts` | Saving to the device, backup codes |
| `src/App.tsx` | Screens and controls |
| `scripts/make-icons.mjs` | Builds the home-screen icons from the hero sprite (`npm run icons`) |
| `scripts/simulate.ts` | Plays hundreds of random runs to catch crashes and save bugs (`npm test`) |
| `tools/gallery.html` | Every sprite, gear combo and monster variant on one page (`npm run dev`, then open `/tools/gallery.html`) |
| `ROADMAP.md` | What's done and what's next |

## Working on it

```bash
npm install
npm run dev        # http://localhost:5173, also on your LAN for quick looks
npm run build      # type-check + production build into dist/
npm test           # headless random-play smoke test
```

## Putting it on the phone (one-time setup)

1. In GitHub Desktop: **File → Add local repository** → pick this folder → **Publish repository**.
   Uncheck "Keep this code private" (free GitHub Pages needs a public repo).
2. On github.com, open the repo → **Settings → Pages** → set **Source** to **GitHub Actions**.
3. Push (or re-run the workflow in the **Actions** tab). The site appears at
   `https://<your-username>.github.io/<repo-name>/`.
4. On the iPhone, open that address in **Safari** → **Share** → **Add to Home Screen**.
   Always launch the game from that icon. That copy keeps its saves long term.

After that, every push to `main` updates the game. The phone picks up the new
version the next time the app is opened (sometimes it takes a second launch).

## Saves

- Stored in the device's `localStorage` under `lampblack:meta:v1` and `lampblack:run:v1`.
- The home-screen app and Safari keep **separate** saves, so always use the icon.
- **Back up or restore a save** on the main screen makes a text code you can paste into
  Notes, or use to move progress to the iPad.
- If the save format changes, bump the `:v1` keys and add a migration in `storage.ts`
  so existing progress isn't lost.
