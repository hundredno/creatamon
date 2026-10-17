# Plan 2: answers ai/prompt_2.md

"Write a script to autoplay the game, play as a human player and make a few game recordings: a YouTube video over 5 min
showing the maximum level and score, preferably one continuous gameplay, without the cheat character; a YouTube Short;
a video for X. Use this opportunity to improve gameplay and fix any bug."

## Where we start

- **No score in the game.** The progress numbers are:
  - **Badges:** 14.
  - **Creatamon level:** capped by badges, 11 at the start and 76 with all 14 (`LEVEL_CAPS`, `src/core.js:339`).
  - **Champion rank (alpha wins):** Warlord I (48 wins) is needed for the Champion. Mythic III comes at 105, and
    Champion I at 110 once Vex is beaten. After that, every 5 wins adds a numeral, with no end.
  - **Trainer Card stats:** wins, trainers beaten, steps, time played, trophies.
- **The cheat character** is the easter egg: a Creatamon named "Modulo Yuji" (Shadow, Beast) gets the bound Cursed cards,
  the infinity and Sukuna's Max form. **Dev mode** (`iam100` in the menu) is the other cheat.
- **The game keeps its state inside a closure.** Nothing is exposed on `window`. A bot can still know everything a player
  sees, in three ways:
  - The save in `localStorage`, written after every step and every event.
  - The DOM: dialog text, battle buttons with `data-*` attributes, HP bars, the level line with the foe's element, the HUD.
  - The rules and maps: `src/world.js` imports cleanly into Node, as `test/core.test.js` already does.
  The save does not hold puzzle progress or alpha positions.
- **The test already has the search the bot needs.** It solves all 14 gym puzzles (`solve()`, `test/core.test.js:202`) and walks
  the story's 33 stages in order (`stages`, `:294`).
- **Known bugs still open** (from `summary_0.md`, checked again today):
  - `button { color: inherit; }` (`src/style.css:228`) makes the title buttons and the menu's Close button white on white.
  - The HUD coin count misses trophy prizes until the next update: `checkTrophies()` runs after the coins text is set.
  - `draw.js:658` requests `img/modulo-yuji.png` and `img/sukuna.png` on every load, and there is no favicon: three 404s.
  - From `summary_0.md`, not re-checked: the battle move list covers the player's XP bar, and trees can hide the player in 3D.
- **Tools:** ffmpeg 8 (x264, NVENC, Opus, AAC, `ass`, `drawtext`, `loudnorm`), Google Chrome 155, Node 24. Playwright is only in
  the npx cache, not in the project.

**Tests I ran for this plan** (scratch scripts, nothing in the repo):

| Test | Result |
| --- | --- |
| Can headless Chrome use the GPU? | Yes. `--use-angle=gl` uses the CPU's **Intel UHD integrated GPU** (i7-13620H). `summary_0.md` said this machine has none; that was wrong. |
| Frame rate walking the 3D overworld, 1280×720 at 1.5× (1920×1080 pixels) | **60 fps** on the Intel GPU; 18 fps with software WebGL |
| CDP screencast at that size | ~59 fps of frames |
| Tab capture (`getDisplayMedia`) in headless Chrome | Gave a stream, but the recorder wrote nothing. Ruled out. |
| Tapping the game's own Web Audio output into a `MediaRecorder` | Works: Opus, 48 kHz stereo. It is quiet (−34 dB mean, −18.5 dB peak), so the videos will need loudness normalisation. |

So the game can be recorded in real time, at 60 fps, with its sound, on the kind of GPU the spec targets.

## How I read the prompt

1. **"Play as a human player"** means a bot that has only a player's hands and eyes:
   - **Hands:** key presses and holds, and mouse clicks where a player would click (Forge, Wardrobe, shops). It pauses like
     a person would before reacting, and is never frame-perfect.
   - **Eyes:** the screen (DOM text), the save (the exact form of what the HUD and menus show), and a walkthrough-level
     knowledge of the map and rules from `src/world.js`.
   - **Never:** write to the save or to game state, open dev mode, seed or reroll randomness, or forge Modulo Yuji. The
     game needs no hooks for any of this.
2. **"Maximum level and score":**
   - **Level** is Creatamon level. The run's goal is the whole party at 76.
   - **Score** is Champion rank (alpha wins), shown with the badges and Trainer Card numbers.
   - The goal is the whole story, Champion Vex beaten, a Lv 76 party, then Champion rank as high as the time limit allows.
     A live scoreboard in the video shows all of it.
3. **"A continuous recording of a single gameplay":**
   - **One run** from New Game, recorded end to end in real time, with no cuts, into one master file.
   - **The YouTube upload is that same run, sped up in the slow stretches.** Speed changes, but nothing is skipped. An
     on-screen play clock and a "×8" marker make that visible.
   - If a run fails partway, it is thrown away and a new one starts from New Game. Separate runs are never joined
     together.
4. **The Short and the X video** are highlight edits from the same run. Cuts are fine in these.
5. **"Improve gameplay and fix any bug":**
   - Fix the known bugs that would show on camera before recording.
   - Treat the bot's practice runs as long playtests. Every error, stuck spot and difficulty wall gets logged with numbers.
     Bugs and small problems get fixed. Bigger balance changes are proposed, not made (see Open questions).

## Part 1: the autoplay bot (`tools/autoplay/`)

Node scripts that drive Chrome through Playwright. They import `src/world.js` for maps and rules.

| Module | Job |
| --- | --- |
| `play.mjs` | Entry point. Builds the game, serves it with `vite preview`, launches Chrome, runs the bot, and optionally records. Flags: `--record`, `--turbo`, `--from <save>`, `--until <chapter>`, `--headed` |
| `eyes.mjs` | Works out what is on screen: title, Wardrobe, world, dialog, choice buttons, battle, menu page, shop, `alert()`. Reads the save, and in battle reads names, HP bars, level line and move buttons |
| `hands.mjs` | Human-paced input: holding keys for a set number of tiles, tapping, clicking by `data-*` selector, typing names. Every input goes into `inputs.jsonl` |
| `nav.mjs` | Pathfinding across all 17 maps using `CM.step`, so ice slides, conveyors, vents and warp pads come out right. Also handles warps and their conditions, exits, people in the way, the bike (Q) and riding onto water. Long grass costs more unless the bot is training, the way a player keeps to the paths |
| `story.mjs` | The next goal, from the save's flags. It follows `quest()` in `game.js` and the test's `stages`: walk next to the target, face it, press Enter |
| `puzzles.mjs` | Gym puzzles. The search from the test, changed to return the moves instead of a count. The test then imports it, so `npm test` proves the bot's solver finds every answer. The bot keeps its own copy of the puzzle state, checks its position after every move, and presses R to start over if they ever disagree. Quiz gym: reads the question and picks the answer from `CM.STRONG` |
| `battle.mjs` | Picks moves by expected damage: power × hits × accuracy × type × same-element bonus × stat stages. Prefers a move that finishes the foe. Uses status moves on bosses when that is safe, a potion when in danger, a switch on a bad matchup, and Max Mode on a Leader's last Creatamon. Runs from wild battles it doesn't need |
| `team.mjs` | When to forge or rebuild, and what with: element coverage for the coming gyms, the strongest 6 moves, every health card on the main team, held items. It also evolves at 16 and 36, and shops (Creataballs first, then potions, then Legendary cards from 12 badges). It drives the Forge and the menu with clicks, like a player |
| `train.mjs` | Training to the level cap before each Leader, healing at heal pads, and hunting alphas. Alphas aren't in the save, so the bot walks the open ground next to long grass and lets them charge it |
| `log.mjs` | Writes `telemetry.jsonl` (time, play time, area, objective, badges, levels, rank, battles and their results). Catches console errors and page errors. Spots when the bot is stuck (no progress for N seconds) and saves a screenshot and the save when it is |
| `record.mjs` | Recording (Part 2) |
| `edit.mjs` | Video editing with ffmpeg (Part 3) |

**Speed of play:**
- A story line the bot hasn't seen before stays up long enough to read: about 15 characters a second, at least 1 s and at
  most 4 s.
- Repeated battle lines go quickly: 0.3–0.6 s, or the game's own auto-advance.
- Reaction delays are random, between 150 and 450 ms.
- Walking holds the arrow key and lets go during the last step, as a player does. If it overshoots, it plans again.

**Turbo mode, for practice runs only.** Playwright's clock takes over the game's time and runs it as fast as the GPU draws.
- The same bot code works on either clock.
- Frames still step 16 ms at a time, so the game behaves the same as at 60 fps. (Its frame step is capped at 50 ms anyway.)
- Practice runs can start from checkpoint saves made by earlier bot runs, one per chapter, so a late chapter can be tested
  without replaying the early game.
- **The final recording is one real-time run from New Game, with no turbo and no checkpoint.**

**The bot's trainer:** it creates a character in the Wardrobe and names its Creatamon. A blocklist makes sure no
Creatamon is ever named "Modulo Yuji", whatever its element.

## Part 2: recording (`record.mjs`)

**Browser:**
- Headless Chrome with `--enable-gpu --use-angle=gl`, so the game runs on the Intel GPU.
- Viewport 1280×720 at 1.5×. The game box comes out at about 1418×1038 pixels, roughly its canvases' own 1440×1056.

**Video:**
- CDP `Page.startScreencast`, each frame with its timestamp, piped live into ffmpeg.
- Encoded with NVENC H.264 at high quality (or x264 if that is better), into 10-minute MKV segments.
- The game runs on the Intel GPU and encoding runs on the NVIDIA one, so recording doesn't slow the game.
- At the start I'll compare JPEG and PNG frames and keep the better one that holds 60 fps.

**Audio:**
- A script added to the page sends whatever the game connects to its `AudioContext` output to a `MediaRecorder` as well
  (Opus, 1 s chunks streamed to Node). This is the method tested above.
- The game's sound still plays exactly as before. This is recording equipment, not a game change.

**Sync:** audio and video use the same clock. A 2-minute test clip checks the offset: the battle sound against the first
frame of the battle screen must be within 40 ms.

**Master:**
- The segments and audio are joined into `master.mkv` at a constant 60 fps.
- It is saved with `telemetry.jsonl` and `inputs.jsonl` under `recordings/<date>/` (git-ignored).
- That is about 5 GB an hour, and there is 219 GB free.

**Run length:** I don't know it yet. My guess is 3–5 hours to beat the Champion, mostly battles, then about an hour more to
Champion I. The full turbo practice run measures it before the real recording.

## Part 3: the three videos (`edit.mjs`)

Everything is scripted from the master and the telemetry, so the cuts can be remade after a review. Every video gets:
- H.264 High, yuv420p, AAC at 48 kHz, `+faststart`;
- loudness normalised to −14 LUFS;
- captions burned in, because X and Shorts start muted;
- a scoreboard drawn from telemetry as ASS subtitles: badges, top level, rank, alpha wins, play time.

| | YouTube | YouTube Short | X |
| --- | --- | --- | --- |
| Size | 1920×1080, 60 fps | 1080×1920, 60 fps | 1080×1080, 60 fps |
| Length | 10–14 min, so an unverified account can upload it (the limit is 15) | ≤ 59 s | 45–75 s (limit 2:20, 512 MB) |
| Content | The whole run in order with nothing skipped. Story beats, gym puzzles, Leader battles, rank-ups and the Champion at 1×. Walking, training and repeat alphas at 4–16× with a speed marker. During fast parts, a clean loop of the game's own music replaces the sped-up sound | Opens on a hook (an alpha charging, Max Mode), then forging a Creatamon, then a quick run of badges 1 → 14, then Champion Vex, then a final level and rank card | The same story as the Short at landscape size, with a little more time for one gym puzzle and one Leader battle |
| Layout | Game at full height, scoreboard down the right side | Title on top, game at full width, captions and scoreboard below | Game at full width, caption bars above and below |

I'll check these limits against the current platform rules when I build the videos.

Also produced:
- YouTube thumbnail (1280×720);
- `upload-notes.md`: titles, descriptions, chapters timed from telemetry, and tags for each platform.

I won't upload anything.

## Part 4: bug fixes and gameplay improvements

**Before any recording**, because these would show on camera:

| Bug | Fix |
| --- | --- |
| Title buttons and the menu Close button are white on white | Give those buttons their own text colour. Drop the blanket `color: inherit` where it causes this |
| HUD coins miss trophy prizes | Check trophies before the HUD text is written, or write it again after a prize |
| Battle move list covers the player's panel and XP bar | Re-check it, then move or shorten the list so the panel stays visible |
| Trees in front of the player hide them in 3D | Fade or cut away tree tops between the camera and the player (`gl.js`) |
| Three 404s on every load | Load the egg's images only when the egg is actually drawn; add an inline SVG favicon (a data URI, so no extra request) |

**Found by practice runs:**
- Every console error, stuck state and softlock gets a fix, plus a test in `test/core.test.js` when it is a rule.
- Spots where a player would be lost or stuck get small fixes: guidance text, the arrow, a blocked path. The bot getting
  lost often points to one.
- Difficulty walls get measured, for example minutes of training needed before each Leader, battles lost, and minutes per
  alpha. Small tuning only where the numbers show an obvious wall. Each change is listed with before and after numbers.
- All fixes go in before the final recording, so the video shows the finished game.

## Steps

1. **Setup:**
   - Add `playwright-core` as a dev dependency; it uses the installed Chrome, so no browser download.
   - Add `npm run autoplay` and `npm run video`.
   - Git-ignore `recordings/`.
   - Move the puzzle search into the shared module and have the test import it.
2. **The bugs that would show on camera**, with tests, and `npm test` passing.
3. **Recorder:** the 2-minute test clip, the sync check, and the chosen frame format.
4. **The bot, chapter by chapter.** Each chapter is done when a turbo practice run gets through it with no stuck events and no
   console errors. Each one ends with a checkpoint save for the next.
   1. Title, character, intro, first Forge, Finn, the Grove, the endorsement.
   2. Gyms 1–5 (including Rock Smash).
   3. Gyms 6–14 (including Surf and the floats, and the quiz gym).
   4. Alphas up to Warlord I, the Champion Cup, Sterling and Eternox, Champion Vex.
   5. After the Champion: the Lv 76 party, and Champion rank.
5. **A full turbo practice run from New Game.** Fix what it finds and run again until a run is clean. This also measures how
   long the real recording will take.
6. **Hand-off:** you commit the fixes, so the version label in the video reads `v.xxxx` without `+`.
7. **The recording:** one real-time run from New Game, in the background. If it fails, it is thrown away and started again.
8. **Editing:** the three videos, the thumbnail and `upload-notes.md`. You review them, and I recut if needed.
9. **Docs:** a README section on autoplay and recording, and `ai/next_2.md`.

## Checks

- **`npm test` passes**, including the new rule tests and the shared puzzle solver.
- **Checks that the run was played fairly**, run on the final save and logs:
  - `S.dev` is still `null`: dev mode was never opened;
  - no Creatamon in the party or Storage passes `CM.isEgg`, and no Secret-tier card is owned;
  - `inputs.jsonl` holds only key presses and clicks;
  - the save's `stats.time` matches the master's length;
  - the master has no frame gap longer than 0.5 s.
- **Sync:** the audio offset is within 40 ms, at the start and the end of the master.
- **Platform rules:** `ffprobe` checks each video's size, frame rate, codecs, length and file size against the table.
- **Watch-through:** a contact sheet with one frame every 30 s of each video, to catch anything broken. You give the final
  approval.
- **Load-time spec:** none of the bot code goes into the game build. The bug fixes change the bundle by a few bytes; I'll
  re-measure the build size.

## Files

- **New:**
  - `tools/autoplay/*.mjs` (the table in Part 1), and the shared puzzle-search module;
  - `ai/next_2.md`.
- **Edited:**
  - `package.json`: dev dependency and scripts;
  - `.gitignore`: `recordings/`;
  - `README.md`: autoplay and recording;
  - `test/core.test.js`: imports the shared search, plus new tests;
  - for the bug fixes: `src/style.css`, `src/game.js`, `src/draw.js`, `src/gl.js` and `index.html` (favicon).
- **Output, not in git:** `recordings/<date>/`:
  - `master.mkv`, `telemetry.jsonl`, `inputs.jsonl`;
  - `youtube.mp4`, `short.mp4`, `x.mp4`, the thumbnail and `upload-notes.md`.

## Out of scope

- Uploading or posting anything, and deploying the site. Both are yours.
- Voice-over, or any music beyond the game's own.
- Hooks in the game for the bot, or a score system added to the game.
- The larger items from `next_1.md`: foes using the new moves, sorting the Bag and Forge, the health-card drop share. I'll
  bring them back with numbers from the runs.

## Open questions (defaults in brackets)

1. **Score:** Champion rank plus the badges, levels and Trainer Card, shown in a scoreboard in the video. No new score in
   the game. [Yes]
2. **When does the run stop?** [After Champion Vex with the party at Lv 76, keep earning Champion rank until Champion I (110
   alpha wins), or for 1 hour, whichever comes first]
3. **YouTube video:** the sped-up version of the one run (10–14 min), or the full real-time run (hours long; needs a
   verified YouTube account)? [Sped-up; the full master is kept either way]
4. **Shapes:** Short 1080×1920 up to 59 s, and X as a 1080×1080 square of about 60 s? [Yes]
5. **A link in the videos:** the game isn't deployed yet. [No link in the videos; a placeholder in `upload-notes.md`]
6. **Gameplay changes beyond bug fixes:** [Small fixes for stuck spots and unclear guidance only; balance changes proposed with
   numbers, not made]
7. **Version label:** record after you commit the fixes, so it reads `v.xxxx` with no `+`? [Yes, I'll wait for your commit]
8. **Keep the bot in the repo** (`tools/autoplay/`, `playwright-core` as a dev dependency)? [Yes: the prompt asks for the script]
