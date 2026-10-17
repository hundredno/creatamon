# Next 2: what prompt 2 changed, and what to do next

Status: **done; the videos wait for your review. Nothing has been uploaded.** The final recording ran from New Game to
Champion I in one go, from your commit `272873b` (label `v.2728`), in `recordings/2026-10-15-final2/`. The videos are
cut from it, in the same folder: `youtube.mp4`, `short.mp4`, `x.mp4`, `thumbnail.jpg` and `upload-notes.md`.

The game is played at **https://cmon.maize.live**: the videos and `upload-notes.md` point there. That site still runs
`v.c912` (from before prompt 1), so redeploy (`npm run deploy`) before posting the videos, or viewers will find a game
without the Legendary and Mythic cards and this round's fixes.

## Done

### Bug fixes and small improvements (in the game)

| What | Fix |
| --- | --- |
| Title buttons and the menu's Close button were white on white | They keep dark text (`src/style.css`) |
| The battle move list covered the player's panel, XP bar included (and HP with six moves) | Moves sit in two columns, low enough that the panel stays in view |
| Trees (and roofs) in front of the player hid them completely in 3D | The player shows through as a faded figure. Only things well in front count, so long grass still hides their feet (`src/gl.js`: a second, depth-tested pass of the player's figure) |
| HUD coins missed trophy prizes and the daily gift until the next step | Trophies are checked before the HUD is written; the daily gift updates the HUD |
| Three failed requests on every load (the easter egg's two images, favicon) | The egg's images load only when the egg is on screen; an inline SVG favicon (a data URI: no request) |
| Fast travel landed on a heal pad without healing | It heals, with the pad's usual message. Found by the bot, which kept stepping off and back on |
| Evolving, a full party and flying from indoors used browser `alert()` boxes | In-game toasts. Alerts froze the game and never show up in a recording |

The JS bundle is 232 KB (88.7 KB gzip), as before: the load-time spec is unaffected. None of the bot code is in it.

### The autoplay bot (`tools/autoplay/`)

`npm run autoplay` (see the README's "Autoplay and recordings"). About 2,200 lines of plain JS modules; the only new
dependency is `playwright-core` (a dev dependency; it drives the installed Chrome, no browser download).

| Module | What it does |
| --- | --- |
| `play.mjs` | Builds and serves the game, launches Chrome, runs the bot, saves a checkpoint at every badge and story step, runs the fair-play checks at the end |
| `game.mjs` | Eyes and hands: one look at the page per moment (screen, dialog, buttons, battle panels, the save) and human-paced keys and clicks. Also reads alphas off the minimap, as a player would |
| `brain.mjs` | The player: dialog reading pace, battle and quiz choices, team upkeep, healing, shopping, pick-ups, training, gyms, alpha hunting, the story |
| `battle.mjs` | Move choice by expected damage (calibrated by how far its hits move the foe's bar), Max Mode, potions, switching, running |
| `team.mjs` | Team planning (element and six moves per Creatamon against the coming opponents, health cards, a little variety) and driving the Forge |
| `nav.mjs` | Shortest routes over every map with the game's own `CM.step`, warps, exits, cracked rocks, the bike (and on water) and fast travel |
| `puzzles.mjs` | The gym puzzle search; `test/core.test.js` now uses it too |
| `story.mjs` | The next goal, mirroring the game's objective list, and how strong the opponents there are |
| `log.mjs` | `telemetry.jsonl` and `inputs.jsonl` |

How it plays:
- **Only keys and clicks**, at a human pace. A new line of text is read at about 15 characters a second (1.1 to 4.2 s);
  battle chatter and kinds of line it has seen many times are skimmed. It never writes to the save or game state, never
  opens dev mode, never forges the easter egg; `audit.json` checks all three on the final save.
- **Team:** it forges up to three Creatamon, rebuilds them before each big battle for the coming opponents (badges pay a
  Creataball each), spreads the health cards, gives out held items and evolves them.
- **Training:** before a Leader, the team trains to the level limit in the strongest reachable grass it can handle. The
  one furthest behind leads, since only Creatamon that attack earn XP.
- **Gyms:** the puzzle search plans the whole way to the Leader once, then the bot walks it move by move, keeping its
  own copy of the puzzle in step with the game's (and pressing R to start over if they ever disagree).
- **Alphas:** after the story it hunts where alphas turn up most often (open ground beside long grass; the Wildlands
  have four times the spawning spots of Route 10). It spots them on the minimap and walks onto them.
- **Turbo practice runs** put the page on Playwright's clock with 50 ms frames (the most the game's frame step allows)
  and the flat 2D view, about 3 to 6 times faster than real time. The same bot code runs on either clock.

### Recording and the videos

- **Recording** (`--record`, `record.mjs`): real time, 3D, on the Intel GPU (`--use-angle=gl`); the NVIDIA card only
  encodes (NVENC). A 1920x1080 page, so the game box is 1260x924 (its largest scale). Chrome's screencast frames are
  filled out to a steady 60 fps; the game's own Web Audio output is tapped into a MediaRecorder. A clapperboard (a
  white square outside the game box, and a 3 kHz beep only the recording hears) every ten minutes is found again
  after muxing, and the sound is shifted by the average of the claps that agree with their median (`claps.mjs`). The
  claps agree within about 50 ms, with no drift (the final recording's numbers are below). The very first second of sound is unreliable (a damaged first Opus packet); that
  is the title screen.
- **The videos** (`npm run video`, `video.mjs`):
  - `youtube.mp4`, 1920x1080, ~13 min: the whole run in order, nothing skipped. The badges, story set pieces, the
    Champion battle and the headline rank-ups at real speed, puzzles at 4x, the rest sped up (marked ×N) over a clean
    loop of the game's own music (`music.mjs` records the two tunes on their own). Left panel: title and chapter.
    Right panel: play time, badges, top level, Champion rank, alphas, battles won and the team, from the save.
  - `short.mp4`, 1080x1920, under a minute: a hook (the final blow against the Champion), the Forge, the first battle,
    all 14 badges, Eternox, the ranks, with the battle theme and live counters.
  - `x.mp4`, 1080x1080, about a minute: the same story, square.
  - `thumbnail.jpg`, and `upload-notes.md` with titles, descriptions and YouTube chapters (from the run's events).
  - Sound is normalised to −14 LUFS (the recording is around −27). Pictures are BT.709 at limited range, tagged as
    such: the master is full range BT.601 (Chrome's screencast frames are JPEGs).

## The final recording

`recordings/2026-10-15-final2/`, real time, 3D, with sound, from New Game. One continuous run: started at 23:47 and
ended by itself at Champion I.

| | Final recording (real time) |
| --- | --- |
| Badges | Grass 0:14, Water 0:22, Fire 0:28, Wind 0:37, Rock 0:42, Electric 0:50, Metal 1:02, Ice 1:09, Shadow 1:16, Mind 1:23, Robot 1:32, Light 1:38, Toxic 1:43, Normal 1:51 |
| Story | The Cup final interrupted by the Blackest Night at 2:07; Eternox beaten (Dawn) at 2:10; Champion Vex beaten at 2:46 (Warlord I at 2:44), with a Mythic card (Void Requiem) |
| End | Champion I (110 alpha wins) at 3:21:30, the whole party at Lv 76. The recording is 3:21:34 |
| Battles | 567 won: 52 trainer and Leader battles, 110 alphas, the rest wild, plus Eternox and the Grove phantom. **No losses** (it ran from 3 wild battles) |
| Problems | No stuck spots, no crashes, no console or page errors |
| Inputs | 26,800 key presses and clicks |
| Fair play | `audit.json`: `fair: true` (dev mode never opened, no easter egg, no secret cards) |
| Sound sync | 22 claps. After a −35 ms correction, the 21 after the first are within −80 to +42 ms, 18 of them within 50 ms, with no drift. The three outliers come after 2:40 and don't add up: moments when Chrome sent a frame late. The first clap is in the unreliable first second of sound |
| Picture | 637,511 screencast frames, filled out to 725,569 at 60 fps (88% are new frames). `master.mkv` is 14.1 GB |

It kept pace with the turbo practice run below up to the Champion (2:46 against 2:48), then hunted alphas faster:
Champion I at 3:21 against 3:31.

The first attempt (`recordings/2026-10-15-final`) was stopped at 51 minutes, at your request, and isn't used.

**Fixed in `video.mjs` after the recording**, found by checking the first cut:
- The chapters (and the panel's "NOW") had Champion Vex before Dawn. "Champion Vex" was keyed to Vex walking out at the
  Cup final, which the Blackest Night interrupts, so his real battle three days later sat inside "Dawn". The chapters
  now follow the story: The Champion Cup, The Blackest Night, Dawn, Champion Vex, Champion.
- The Cup final scene (Vex walks out, the Chairman wakes Eternox, the sky turns black) went by at ×41. It plays at
  real speed now, as does the Champion battle from "Three days later". The fast stretches went from ×41 to ×48.
- The scoreboard and upload notes ended on Mythic III, 109 alphas: the title Champion I came 2 s after the last sample.
  `video.mjs` now ends on the final save, and `play.mjs` takes a last sample when a run ends.
- The Short's hook and the thumbnail never found the Champion's last line: the bot logs a speaker's name run into the
  line ("Champion Vex...My unbeaten run"), and the pattern expected "Champion Vex: ". They fell back to the last badge. The hook is
  now the final blow, timed from the Champion's last Creatamon fainting; the thumbnail is Max Mode Mittens on its last
  sliver of HP against Nova, taken from the top of the game box so the dialog box stays out from under the title.
- TOP LEVEL read "-Infinity" before the first Creatamon was forged. It shows a dash.
- Cut stretches were cached by position, so changing the cut silently reused stale ones. They're cached by content.
- `youtube.mp4` kept the master's full range BT.601 tags; players that ignore them shift the colours. All three
  videos are now BT.709 at limited range, tagged.

## Practice runs

Turbo practice runs (`recordings/`, not checked in), chapter by chapter while building the bot, then one full run from
New Game with the final code (`recordings/full1`):

| | Full run (game time) |
| --- | --- |
| Badges | Grass 0:13, Water 0:22, Fire 0:28, Wind 0:38, Rock 0:45, Electric 0:52, Metal 1:00, Ice 1:07, Shadow 1:14, Mind 1:22, Robot 1:31, Light 1:37, Toxic 1:42, Normal 1:48 |
| Story | Eternox beaten (Dawn) at 2:08; Champion Vex beaten at 2:48 (Warlord I at 2:46) |
| End | Champion I (110 alpha wins) at 3:31, the whole party at Lv 76 |
| Battles | 51 trainers and Leaders, 394 wild, 117 alphas, Eternox and the Grove phantom. **No losses** |
| Problems | No stuck spots, no console errors, no page errors |
| Inputs | 27,245 key presses and clicks |
| Fair play | `audit.json`: dev mode never opened, no easter egg, no secret cards |

The turbo run took 65 real minutes.

What the practice runs found and fixed in the bot, for the record: a weak lead got no XP (only attackers earn it), the
Water gym's valves needed the puzzle search to get back out, the panel puzzle's depth-first search sent the bot left and
right forever when re-planned every step, an alpha behind a hedge froze the bot (and turbo's clock with it), and a
Creatamon that never led stayed short of the level limit.

## Recommended next

1. **Review and post the videos**: watch `youtube.mp4`, `short.mp4` and `x.mp4` and look at `thumbnail.jpg` (in
   `recordings/2026-10-15-final2/`). Redeploy the site first (`npm run deploy`), then upload with `upload-notes.md`.
   The cuts can be remade after a review in about 20 minutes with `npm run video -- recordings/2026-10-15-final2`
   (`--minutes 14` for a longer YouTube cut with slower fast stretches).
2. **Alpha rank is cheap to farm on easy routes.** Every alpha counts the same, so the bot (like a player chasing
   rank) hunts level-16 alphas in the Wildlands with a level-76 team: 62 wins from Warlord I to Champion I took 45
   minutes. If rank should mean something, count only alphas near the level limit, or weight wins by level. A balance
   change, so not made here.
3. **The game is forgiving for a careful player.** At the level limit the bot never lost a Leader, a Cup round or the
   Champion (it does rebuild its team for each gym's element, which most players won't). Worth a human playtest before
   any difficulty change.
4. **The last badge raises the level limit from 59 to 76**, a big jump to train before the Cup (the bot spent most of
   the post-badge stretch training). A gentler last step, or more experience in the late routes, would smooth it.
5. Still open from earlier notes: deploy, foes using the new Legendary/Mythic moves, sorting in the Bag and Forge,
   small text on phones.
