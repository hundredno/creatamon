# Plan 0: answers ai/prompt_0.md

Revised after review:
- No "fork me on GitHub" link.
- The version label reads `v.6785+` when there are uncommitted changes.
- The game must stay exactly as it is now.

## Where we start

- A static game with no build step: `index.html`, `css/style.css`, and six classic scripts in `js/` (about 345 KB of JS, unminified)
  that share globals: `SFX` (sfx.js), `CM` (core.js, which world.js adds to), `GFX` (draw.js), `GL3D` (gl.js). `game.js` is an IIFE
  that uses all of them.
- No images, audio files or web fonts. Art is drawn on canvas and sound is made with Web Audio, so the JS and CSS are the whole download.
- `test/core.test.js` runs under node with `require('../js/world.js')`. core.js and world.js end in `module.exports` shims for this.
- Saves live in `localStorage` under `creatamon-save-v1` and `creatamon-options-v1`.
- The README already promises `npm install`, `npm run dev` and `npm run deploy` (added in the "prompt 0" commit).
- Toolchain on this machine: Node 24.18, npm 11.16. The latest are Vite 8.3.2 (needs Node ≥ 20.19) and Wrangler 4.147.

Checks already done, which make an exact-behaviour conversion to ES modules realistic:
- All six scripts parse as ES modules (`node --input-type=module --check`).
- ESLint (`no-undef`, `no-implicit-globals`) on a scratch copy finds no implicit globals. Its only hits were the browser globals
  `dispatchEvent` and `KeyboardEvent`, which were missing from my scratch config. No code uses `this`. So strict mode, which modules
  always use, changes nothing.
- No circular dependencies: core ← world, draw ← gl, and game uses all of them. No inline `on…=` handlers reference the globals.
- `sfx.js` adds its `pointerdown`/`keydown` listeners on `window` before `game.js` adds its own, so module evaluation order must stay
  sfx → core → world → draw → gl → game.
- No CSS or JS depends on the order or count of `#game`'s children (no `:last-child`, `.children`, …), so adding one element there
  is safe.

## How I read the prompt

1. **"Exactly the same"**: gameplay, visuals, layout, audio, controls, saves, timing and browser support all stay as they are. The one
   visible addition is the version label prompt_0 asks for. Behind the scenes, only the packaging changes: modules, minified files,
   and the deploy config.
2. **Version** is `v.` plus the first 4 characters of the `HEAD` commit SHA, e.g. `v.6785` for `678556d…`. If the build runs with
   uncommitted changes, `+` is appended: `v.6785+`. Uncommitted means anything `git status --porcelain` reports, so new untracked files
   count too, e.g. fresh notes in `ai/`. Ignored files don't count (`node_modules/`, `dist/`, `.wrangler/`).
3. **Static site on Cloudflare with Wrangler** means a Worker with static assets only: no `main` script, just
   `assets.directory = ./dist`. This is Cloudflare's current path for static sites. `preview_urls: false` is a top-level Wrangler key
   for Workers. Pages has no equivalent: it always makes branch previews.

## Steps

### 1. Snapshot the original, play, and record a baseline

- Extract the current commit into the scratchpad with `git archive HEAD | tar -x -C <scratchpad>/original`. This gives an untouched copy
  of today's game that never changes and can be served at any time with `python3 -m http.server`. It does not touch the repo, and is
  not a worktree.
- Play that copy through Playwright (MCP browser):
  - New game → character creator → tutorial → first Forge → first battle with Finn → every menu tile → first route and wild battles →
    bike, minimap, 3D view.
  - Touch layout: emulate a phone with touch and check the D-pad, action buttons and minimap.
  - Dev mode (`iam100` in the menu): teleport to a few gym towns, try one or two gym puzzles, an alpha, Max Mode in a gym battle, the
    Champion match.
- Baseline numbers to record:
  - Bytes transferred.
  - Time until the title buttons respond, on a fast connection and on Slow 4G (~1.6 Mbps, 150 ms RTT) with 4× CPU slowdown, using
    Chrome DevTools Protocol emulation.
  - Rough FPS in the 3D overworld with and without 4× CPU throttle.
- Run `node test/core.test.js` and keep its output for comparison.

### 2. Build the "same game" comparison harness (scratchpad, not committed)

This is the check behind the "exactly the same" requirement. A node script in the scratchpad uses Playwright to run the original copy
and the new build side by side under identical conditions:

**Controlled conditions**
- **Randomness:** an `addInitScript` replaces `Math.random` with the same seeded generator (mulberry32) in both runs.
- **Time:** `page.clock.install()` puts `Date`, `performance.now`, `requestAnimationFrame` and the timers under control. Time only moves
  through `clock.runFor(ms)`, so every frame lines up between the two runs.
- **Browser:** same viewport, same device scale factor, same headless Chromium (SwiftShader WebGL).
- **Saves:** start from either an empty `localStorage` or the same injected save.

**Scenarios**, each a fixed sequence of key presses and taps:
1. Title screen.
2. New game through the character creator, intro, first Forge and the Finn battle.
3. A mid-game save made with dev mode: walk the 3D overworld, open every menu page, run one gym puzzle, an alpha battle with Max Mode.
4. Scenario 2 again with touch emulation, using the on-screen pad.

**What must match**
- **Screenshots:** pixel for pixel at each checkpoint. Only the version label's box is masked.
- **Final save:** `localStorage` save and options JSON byte for byte, including stats and play time.
- **Audio:** the sequence of sound events (oscillator type and frequency, recorded by wrapping `AudioContext` node creation).
- **Console:** the same output (expected: none).

The harness runs once against the original alone to confirm it is deterministic (two runs, identical results), then original vs new
build after each step below.

### 3. Write `ai/summary_0.md`

Sections:
- What the game is (one paragraph) and the core loop (explore → find cards → forge → battle → badges).
- Progression: story beats, the 14 gyms and their puzzles, level limits, Champion Cup.
- Systems: Power Cards and the Forge (including Draw my own and Upload image), battle rules, Max Mode, alphas and Champion rank,
  Creatastops and coins, wardrobe and sprays, trophies, daily gift, field moves, bike.
- Tech: what each file does, how state is saved, the 2D canvas path and the WebGL 3D path with its fallback, procedural audio,
  the test suite (puzzle solver and story walk), dev mode.
- What I saw while playing: first-15-minute experience, bugs, UX friction, and differences between touch and desktop. These are
  recorded only, not fixed (see "Out of scope").
- Baseline performance numbers from step 1, measured against the CLAUDE.md spec.

### 4. Repackage as an npm + Vite project

Hand-write the scaffold instead of running `npm create vite@latest .`. In a non-empty folder the scaffolder prompts to delete or
ignore existing files, and its demo files would only get deleted again. I'll leave the README's "Initial setup" section as it is,
because it records how the project was started.

**Layout.** Move files with plain `mv`, not `git mv`, so the git index is left alone for you. The edits are small enough that git
will still detect the renames.

```
index.html          (stays at the root, as Vite expects)
src/style.css       ← css/style.css   (no changes, except the #ver rule in step 5)
src/sfx.js core.js world.js draw.js gl.js game.js   ← js/*
public/_headers     long caching for hashed assets
test/core.test.js
package.json  vite.config.js  wrangler.jsonc
```

**Classic scripts → ES modules, only import and export lines.** Every IIFE body stays byte for byte the same, so no game logic
changes and `git blame` stays useful.

| File | Change |
| --- | --- |
| core.js | `export { CM };` and remove the `module.exports` line |
| world.js | `import { CM } from './core.js';`, pass `CM` into the IIFE, `export { CM };`, remove both `require` / `module.exports` lines |
| draw.js | `import { CM } from './world.js';` (world adds its data to CM before draw uses it), `export { GFX };` |
| gl.js | `import { GFX } from './draw.js';` (plus CM if it uses it), `export { GL3D };` |
| sfx.js | `export { SFX };` |
| game.js | in this order: `import { SFX } from './sfx.js'; import { CM } from './world.js'; import { GFX } from './draw.js'; import { GL3D } from './gl.js';`. This gives the same evaluation order as today's `<script>` tags: sfx → core → world → draw → gl → game |

**`index.html`.** The only changes:
- The `<link>` href becomes `/src/style.css`. The link stays in `<head>` where it is.
- The six `<script>` tags become one `<script type="module" src="/src/game.js">` in the same place at the end of `<body>`. Module
  scripts run after the document is parsed, the same point at which the end-of-body scripts run today.
- The version label element (step 5).

No `main.js`, no extra meta tags, no other markup changes.

**Test.** `package.json` gets `"type": "module"`. The test switches to `import assert from 'node:assert'` and
`import { CM } from '../src/world.js'`, with no other edits. Add `"test": "node test/core.test.js"`. Its output must match the
step 1 run.

**`package.json`**
```jsonc
{
  "name": "creatamon", "private": true, "version": "0.0.0", "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node test/core.test.js",
    "deploy": "vite build && wrangler deploy"
  },
  "devDependencies": { "vite": "^8", "wrangler": "^4" }
}
```

**`vite.config.js`**
- Version, computed once when the config loads:
  - SHA: `WORKERS_CI_COMMIT_SHA` if set (Cloudflare git builds), otherwise `git rev-parse HEAD`.
  - Dirty flag: `git status --porcelain` is non-empty → append `+`.
  - Label: `v.${sha.slice(0, 4)}` plus the flag. If git is unavailable, `v.dev`.
- A small `transformIndexHtml` plugin with `order: 'pre'` replaces `%APP_VERSION%` in index.html. The label is static HTML, so no game
  JS changes, and it shows on the title screen before any JS runs.
- `build.target: 'esnext'` (and with it `cssTarget`). The code ships with its own syntax, nothing transpiled, so it runs on exactly the
  browsers it runs on today. Minification still happens and doesn't change behaviour.
- `build.modulePreload: false`. With a single bundle there is nothing to preload, so Vite's polyfill would be dead code.
- The dev server reads the version when it starts, so it won't switch to `+` mid-session.

**Load-time spec.** Vite minifies everything into one hashed JS file and one CSS file, and Cloudflare compresses them with
Brotli/gzip. My expectation is well under 100 KB transferred, but I'll measure it. No code splitting in this pass: lazy-loading part of
the game would change when things become available. If the numbers miss the spec, the cause and options go into `next_0.md` instead.

### 5. Version label

A static `<div id="ver">%APP_VERSION%</div>` as the last child of `#game`: 10 px, about 55% opacity, `pointer-events: none` (never
takes a click or tap), with a z-index above the title, menu and battle screens so it is always visible. It is absolutely positioned,
so it doesn't move anything else.

The corners are already taken differently depending on the layout:

| Corner | Desktop | Touch |
| --- | --- | --- |
| Top left | HUD | HUD |
| Top right | **free** (toasts sit 66 px down) | minimap |
| Bottom left | key hints | D-pad |
| Bottom right | minimap | action buttons |

- Desktop: `top: 4px; right: 8px`.
- Touch: `#game.touch #ver` moves to just under the minimap (`top: ~110px`). It uses the `touch` class game.js already sets, with no
  JS change.

These are the only CSS additions. Every existing rule stays as it is.

### 6. Cloudflare deploy with Wrangler

**`wrangler.jsonc`**
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "creatamon",
  "compatibility_date": "<implementation date>",
  "assets": { "directory": "./dist" },
  "workers_dev": true,
  "preview_urls": false
}
```
- The site is served at `creatamon.<account>.workers.dev`. A custom domain can be added later through `routes`.
- `public/_headers`, which Vite copies to `dist/`:
  `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`. Hashed files are cached forever, and `index.html` keeps the
  default revalidation, so a new deploy shows up on the next load.
- `.gitignore`: add `.wrangler/`. `dist` is already ignored. Because these are ignored, building and deploying never makes the label
  show `+` by itself.
- `npm run deploy` builds and runs `wrangler deploy`. `npx wrangler login` is a one-time step you run yourself. I won't log in or
  deploy.

### 7. Verify

- `npm test` passes, with output identical to the step 1 run.
- `npm run build` gives one JS file and one CSS file in `dist/assets`. Record their raw and compressed sizes.
- Comparison harness (step 2): original vs `npm run preview`, all four scenarios. Screenshots, saves, sound events and console must
  all match. Any difference is a bug in the repackage, and I fix it before going on.
- Version label: `v.<sha>` on a clean tree and `v.<sha>+` with a modified or untracked file. Check it is in the right corner in title,
  world, menu and battle on both layouts.
- An existing save made on the original still loads. The save key is unchanged, but saves are per origin, so only same-origin saves
  carry over.
- `npx wrangler dev` (serves `dist` locally the way Cloudflare's workerd runtime would): the game runs and `/assets/*` gets the
  `_headers` caching.
- Re-measure load time and FPS under the step 1 throttling and compare with the baseline.

### 8. Docs and hand-off

- README:
  - "Play": `npm run dev`, or the deployed URL. Opening `index.html` straight from disk no longer works because browsers don't load
    modules from `file://`, so the "no build step" line goes.
  - "Development": `src/` paths, `npm test`.
  - "Deploy": one-time `wrangler login`, what `preview_urls: false` means, how the version label and `+` are worked out.
- Write `ai/next_0.md`: what was done, measured numbers, comparison results, issues found while playing, and the recommended next work.

## Files touched

New: `package.json`, `package-lock.json`, `vite.config.js`, `wrangler.jsonc`, `public/_headers`, `ai/summary_0.md`, `ai/next_0.md`.
Moved, with import/export lines only: `js/*.js` → `src/`. Moved, plus the `#ver` rules: `css/style.css` → `src/style.css`.
Edited: `index.html` (link href, script tag, version element), `test/core.test.js` (require → import), `.gitignore`, `README.md`.

## Out of scope for this prompt

- Any gameplay, rendering, UI, audio or balance change, including fixes for bugs found while playing (recorded in `summary_0.md` and
  `next_0.md` instead).
- Code splitting, TypeScript, PWA, custom domain, CI deploys.
- Rewriting the IIFEs into idiomatic modules.
- Committing the comparison harness. It stays in the scratchpad unless you want it in the repo.

## Open questions (defaults in brackets)

1. Should untracked files trigger `+`, or only changes to tracked files (`git diff HEAD`)? [Untracked files count, since they are
   uncommitted]
2. Worker name `creatamon`, giving the address `creatamon.<account>.workers.dev`? [Yes]
3. Should the comparison harness go into the repo (e.g. `test/same-game.mjs` plus a Playwright dev dependency)? [No, scratchpad only]
