# Next 0: what prompt 0 changed, and what to do next

## Done

**Played and summarised** the game in `ai/summary_0.md`.

**Repackaged as npm + Vite**, with the game itself unchanged:
- `js/*.js` → `src/*.js`, `css/style.css` → `src/style.css`. The only code edits are `import` / `export` lines (and the
  removed `module.exports` shims), so every function body is exactly as before.
- `game.js` imports in the order the old `<script>` tags ran (sfx → core → world → draw → gl → game). That keeps
  start-up and window event-listener order the same.
- `index.html` loads one module, `/src/game.js`. The stylesheet path changed and the version element was added; nothing
  else.
- `vite.config.js`:
  - builds for `esnext`, so the code's own syntax ships untranspiled and runs on exactly the browsers it ran on before;
  - leaves out the module-preload polyfill, since there is only one bundle;
  - works out the version label.
- `npm test` imports `src/world.js`. Its output is byte-for-byte what it was.

**Version label** in the top right corner: `v.` and the first 4 characters of the commit, with `+` for uncommitted
changes (untracked files count). Right now it reads `v.c1c2+`, since this work sits uncommitted on top of `c1c21e9`.
On touch screens the minimap takes that corner, so the label sits just under it. It is static HTML filled in at build
time, so no game code reads it, and it has its own compositing layer so it can't affect how anything else is drawn
(see below).

**Cloudflare deploy:**
- `wrangler.jsonc` is a Worker with static assets only, with `preview_urls: false` and `workers_dev: true`.
- `public/_headers` caches the hashed `dist/assets/*` files forever, while `index.html` revalidates.
- `npm run deploy` = `vite build && wrangler deploy`. Not deployed yet: it needs your one-time `npx wrangler login`.

**README:** setup, play, deploy and development sections are updated.

## How "exactly the same" was checked

**Static checks:**
- `npm test` passes, and its output is identical to before.
- The source diff is import/export lines only, plus the label's CSS rules.
- ESLint (`no-undef`, `no-implicit-globals`) found no implicit globals and no `this`, so strict mode (which modules
  always run in) changes nothing.

**Side-by-side play.** A Playwright harness (kept in the scratchpad, not the repo) ran an untouched copy of the original
(`git archive` of `c1c21e9`) and the Vite build, both served by the same static server, under identical conditions:
- `Math.random` seeded the same way;
- a fake clock, with frames on fixed 16 ms boundaries and audio time tied to it;
- the same viewport, the same saves, and the same scripted key presses, clicks and taps.

At each checkpoint it compared four things:
- **the screenshot**, pixel for pixel, with only the version label hidden;
- **`#game`'s DOM**, without the label;
- **`localStorage`** (save and options);
- **the audio**: every oscillator start and parameter change, with values and times.

It also compared the whole console log.

| Scenario | Covers | Result |
| --- | --- | --- |
| New game (desktop) | title, character creator, intro, Forge, walk to Finn, the first battle with attack effects, every menu page, How to play, Wardrobe, Forge, dev mode, teleports to 3 towns, walking in 3D, spray | 35/35 checkpoints identical |
| Galeholt save (desktop) | Continue from a save made on the original, daily gift, walking out to Route 12, Town Map, dev-spawned alpha chasing and catching the player, alpha battle, blackout and wake-up, bike, Trainer Card | 12/12 identical |
| Gym Leader save (desktop) | gym interior, gym trainer battle, Leader battle with Max Mode, losing and waking at the heal pad | 9/9 identical |
| New game (touch, 844 × 390) | the same start using taps and the on-screen D-pad and A button, the touch layout, the menu from the pad (the scripted walk stops one tile short of Finn, so no touch battle) | 13/13 identical |

What the results mean:
- **Same game.** Saves, DOM, audio and the game's console output are identical at every checkpoint.
- **The only console difference** was once, in one run: the two optional-image 404s logged in the opposite order. They
  are two parallel requests racing on the network, and the original logs both too.
- **Screenshots:** pixel-identical, except for a handful of anti-aliased HUD-edge pixels off by 1–6 colour steps on a
  few desktop checkpoints. Running the original against itself showed the same noise in the same places, from
  compositing semi-transparent HUD over the WebGL canvas.
- **One fix came out of it.** The first touch runs found 25 D-pad shadow pixels off by up to 24 colour steps. A build
  with the label removed was pixel-identical, so the cause was the label being drawn into the touch controls' layer,
  not the packaging. Giving the label its own layer (`will-change: transform`) made the touch run pixel-identical too.

## Numbers

| | Before (8 files) | After (3 files) |
| --- | --- | --- |
| Download, Brotli | 101 KB | 76 KB (JS 222 KB raw → 71 KB) |
| Requests per load | 10–11 | 5–6 |
| Title ready on Slow 4G with a 4× slower CPU (local, cold cache) | 867 ms | 759 ms |
| Title ready on 10 Mbps / 40 ms | 187 ms | 172 ms |

- **Load time is well inside the 1 s / 2–3 s target.** A real first visit adds DNS and TLS: an estimated 1.2 s on Slow 4G.
- **Frame rate:** the same before and after (about 17.5 fps walking in 3D), but only in software WebGL. This machine
  has a dedicated GPU and no integrated one, so it can't measure the spec's devices. Details are in `summary_0.md`.

## Notes

- **Compatibility date:** `wrangler.jsonc` uses `2026-10-01` because the `workerd` that ships with Wrangler 4.147 won't run a
  later date locally. Bump it when Wrangler updates.
- **Skipped install scripts:** npm 11 reports that `esbuild` and `workerd` install scripts aren't covered by
  `allowScripts`, so they were skipped. Build, `wrangler dev` and `wrangler deploy --dry-run` all work without them; run
  `npm approve-scripts` if a later version needs them.
- **No more `file://`:** opening `index.html` straight from disk no longer works (modules don't load from `file://`).
  Use `npm run dev`.
- **Saves are per address:** progress made on another address (e.g. the old `file://` copy) doesn't carry over to the
  deployed site, though the save format and key are unchanged.

## Recommended next

1. **Deploy:** `npx wrangler login`, then `npm run deploy`. Optionally add a custom domain via `routes` in `wrangler.jsonc`.
2. **Fix the readability bugs from the summary**, now that the packaging is settled. These change the game, so they need
   their own prompt.
   - Title buttons and the menu's Close button inherit white text (`button { color: inherit; }`, `src/style.css:224`).
   - The move list covers the player's panel in battle.
   - Text is small on phones, since the whole 720 × 528 game is scaled down to about 0.7×.
3. **Silence the failed requests:** either add the optional `img/modulo-yuji.png` / `img/sukuna.png` (in `public/img/`)
   or stop requesting them until the secret Creatamon is actually used. Add a favicon too.
4. **Keep the comparison harness?** If you want refactors checked automatically against the original, it can become a
   repo test. It's a Playwright script with a seeded random, a fake clock and scripted inputs.
5. **Low-end devices:** profile the 3D renderer on a real integrated GPU and an entry-level phone. Headless numbers use
   software WebGL; see Numbers above.
