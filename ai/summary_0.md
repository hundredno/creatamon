# Summary 0: what Creatamon is

Written after playing the game (as it was at commit `c1c21e9`) in headless Chrome on desktop and phone-sized touch
layouts, reading the code, and running its tests.

## The game

Creatamon is a creature-battling RPG in the browser. The twist on the genre: you don't catch your team, you **build**
it. Every Creatamon is assembled at the Forge from **Power Cards**: up to six move cards (its attacks) and any number
of health cards, plus a free choice of element and body shape. You can keep the generated look, paint a 32×32 sprite, or
upload a picture.

You and your rival Finn are endorsed by Champion Vex of the Galdra region. You beat the Leader of all 14 gyms, one per
element, each behind its own puzzle. Then you win the Champion Cup in Summit City.

**Core loop:** explore → pick up cards (sparkles, trainers, wild drops, shops) → forge or rebuild Creatamon → battle →
badges raise the level limit → next gym.

## Content, by the numbers

| Thing | Count |
| --- | --- |
| Overworld | 124 × 96 tiles, 37 named areas, 16 Creatastops (shops) |
| Maps | 17: the overworld, 14 gym interiors, the Drowsing Grove, and the Anvilgate Energy Plant (Chairman Sterling and the boss Eternox) |
| People | 120, of whom 31 are trainers |
| Pick-ups (sparkles) | 89 |
| Species | 77 (all in the Creatadex), 6 body shapes |
| Elements | 14 selectable, plus a hidden "Cursed" one for the secret cards |
| Power Cards | 57: 54 move, 3 health; tiers ★ 16, ★★ 18, ★★★ 17, plus 6 secret |
| Clothes | 126 |
| Items | 10 (Creataball, 3 potions, Revive, 5 held items) |
| Trophies | 22 |
| Champion ranks | 21 alpha ranks (Alpha I to Mythic III), then Champion I, II, III, … |

## Progression

What I played or skipped through with dev mode:
1. **Hearthwick:** a tutorial with Finn and Champion Vex. You get 6 starter cards, 2 Creataballs and 3 Potions, the Forge
   opens with numbered steps, then comes the first battle against Finn.
2. A Fluffin breaks into the **Drowsing Grove**.
3. Route 1 east to **Wedgemoor**, where you battle Finn in front of the Champion and win the endorsement and a bike.
4. North through the Wildlands to **Kilnford** for the opening ceremony.
5. The gyms in a fixed order. Grass (Furrowfield) → Water (Brinemouth) → Fire (Kilnford) → Wind (Galeholt) → …
   → Normal (Anvilgate), then Route 10 to **Summit City**, the Champion Cup and Champion Vex.

How the difficulty ramps:
- **Level limit:** 11 at the start, raised by each badge (16, … 59, 76 with all 14), so Leaders can't simply be out-levelled.
- **Gym trainers:** from gym 3, the Leader's trainers must be beaten first, back to back (1 → 2 → 3 of them).
- **Leaders:** they pick better moves, carry extra health cards and items, and bring 4 to 6 Creatamon.
- **Gym puzzles:** one kind per gym. Herding, valves, braziers, gusts, boulders, panels, crates, ice, darkness, warp pads,
  conveyors, lamps, sludge pits and a type-chart quiz.

## Systems

- **Battles:** turn-based (Fight / Creatamon / Bag / Run), with a rock-paper-scissors element chart and same-element
  bonus. Messages advance by themselves (optional). Every Creatamon that attacked shares the XP, and under level 10 the
  whole party does. Creatamon evolve at levels 16 and 36 (Basic → Evolved → Final form).
- **Max Mode:** once per gym or Cup battle, your Creatamon grows huge, gets +50% HP and never misses. Leaders do the same
  with their last Creatamon.
- **Alphas:** big, red, glowing wild Creatamon that prowl route ground beside long grass and charge you on sight.
  Beating them builds Champion rank, and the Champion only accepts King I and above.
- **Economy:** coins from trainers (Leaders pay triple), shiny purses, a daily gift and trophies. Creatastops sell
  potions, balls, cards of the town's element and clothes.
- **Field moves:** Rock Smash and Surf work as long as you hold the card. The bike doubles speed, and with floats it
  rides on water.
- **Extras:** Wardrobe and character creator, spray designs (G), Town Map with fast travel to visited heal pads, Trainer
  Card, shiny Creatamon, Storage beyond a party of 6.
- **Dev mode:** type `iam100` in the menu. It has no wild battles, noclip, one-hit wins, story skips, teleports and give-everything
  buttons. It made this playtest possible.

## Tech

- **Plain JavaScript, no dependencies, about 6,000 lines.** Since this prompt it is a set of ES modules in `src/`, bundled by Vite.
  | File | Lines | What it does |
  | --- | --- | --- |
  | `core.js` | 520 | cards, species and battle rules (no DOM) |
  | `world.js` | 911 | maps, gyms, puzzle rules, people, teams; the overworld is built in code at load (no DOM) |
  | `draw.js` | 957 | Canvas 2D: tiles, people, creatures, battle effects, drawn procedurally at 3× detail |
  | `gl.js` | 347 | a hand-written WebGL renderer for the 3D overworld (falls back to the flat view without WebGL) |
  | `sfx.js` | 220 | sound effects and two music tracks synthesised with Web Audio (no audio files) |
  | `game.js` | 2380 | the UI: overworld, story, battles, menus, Forge, Wardrobe, touch controls, dev mode |
- **No image, audio or font files.** The JS and CSS are the whole download.
- **Saves:** `localStorage` (`creatamon-save-v1`, `creatamon-options-v1`), with migrations from older save formats.
- **Tests:** `npm test`. It checks the data, solves all 14 gym puzzles by search, and walks the whole story to the
  Champion to prove every step can be reached in order.
- **Layout:** the game is a fixed 720 × 528 box scaled to fit the window (up to 1.75×). On a touch device a D-pad and
  A / menu / bag / bike buttons appear.

## What I noticed while playing

These are existing issues, recorded only. Fixing them would change the game, which prompt 0 ruled out.

1. **Title buttons are almost unreadable:** "New Game" and "Continue" are white text on a cream button.
   `button { color: inherit; }` (`src/style.css:224`) passes `#title`'s white down to them.
2. **The menu's Close button is blank:** on the home page it is white-on-white until the pointer is over it. Same rule,
   inheriting the header's white. On a touch screen there is no hover, so it always looks like an empty pill.
3. **Move list covers the player's panel:** when picking a move in battle, the list covers the bottom of the panel,
   including the XP bar.
4. **HUD coins lag behind:** after the "First Friend" trophy (+◎200) the HUD still read ◎0 until the next step.
5. **Hidden player in 3D:** a row of trees south of the player can hide them completely (seen in Galeholt, south of the
   heal pad). Only the hat showed.
6. **Two failed image requests on every load:** `img/modulo-yuji.png` and `img/sukuna.png` (optional art for the secret
   Creatamon) are not in the repo, so each load logs two 404 errors, plus one for the missing favicon.
7. **Small text on phones:** at 844 × 390 the whole game is drawn at about 0.7×, so the 9.5–12.5 px menu and HUD text ends
   up at roughly 7–9 px.
8. **Fine:** the first 15 minutes are well guided. The tutorial lines are clear, the red arrow and "Next" bar always say
   where to go, and the Forge's numbered steps work.

## Performance against the CLAUDE.md spec

**How it was measured:** both versions were served locally with Brotli compression (as Cloudflare does), with a cold cache
and Chrome DevTools network and CPU emulation. Each figure is the median of 3 loads. "Ready" means the game script has
finished starting, i.e. the title buttons respond.

| | Original (8 files) | Vite build (3 files) |
| --- | --- | --- |
| Download (HTML + CSS + JS) | 364 KB raw / 101 KB Brotli | 239 KB raw / 76 KB Brotli |
| Requests per load (incl. the 2 missing images and favicon) | 10–11 | 5–6 |
| Ready, no throttling | 53 ms | 46 ms |
| Ready, 10 Mbps / 40 ms, normal CPU | 187 ms | 172 ms |
| Ready, 10 Mbps / 40 ms, 4× slower CPU | 221 ms | 225 ms |
| Ready, Slow 4G (1.6 Mbps / 150 ms), 4× slower CPU | 867 ms | 759 ms |

- **Load time is well within the spec** (1 s great, 2–3 s target, 4 s maximum). These local numbers leave out the DNS
  lookup and TLS handshake of a first visit, about 3 more round trips. That puts a first visit on Slow 4G at roughly
  1.2 s, and on an average connection well under half a second.
- **Load stays cheap after start-up.** No images, fonts or audio files to fetch, and starting a game builds the world
  in memory.
- **Frame rate is the same before and after**, as it should be for identical code, but these numbers don't stand for
  real hardware. Walking the 3D overworld ran at about 17.5 fps, and 6 fps with a 4× slower CPU, because headless Chrome
  renders WebGL in software (SwiftShader). This machine has a dedicated GPU and a CPU with no integrated graphics, so it
  can't stand in for the spec's "average PC without a dedicated GPU" either. Treat the software numbers as a floor.
  Measuring on a real integrated-GPU laptop and an entry-level phone is the open item (see `next_0.md`).
