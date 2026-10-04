# Creatamon

A creature-battling RPG where you don't catch your team, you **create** it.
Find **Power Cards**, slot them into a Creatamon at the Forge, earn eight gym badges and take the Champion Cup.

## Play

Open `index.html` in a browser. No build step, no dependencies. Progress saves automatically in the browser.

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Enter / Space | Interact, advance text, use a field move on the thing you face |
| M / Esc | Menu: next objective, badges, party, Forge, Wardrobe, Creatadex |
| R | Start a gym challenge over |
| 1-9 | Pick a battle option |

## The journey

You and your rival Finn are endorsed by the Champion for the Gym Challenge of the Galdra region.
The menu always shows what to do next.

There is one gym per element, and each has a challenge to solve before its Leader will battle you:

| # | Gym | Town | Challenge |
| --- | --- | --- | --- |
| 1 | Grass | Furrowfield | Herd the Fluffin into their pens |
| 2 | Water | Brinemouth | Coloured valves that switch waterfalls on and off |
| 3 | Fire | Kilnford | Light every brazier; each one flips its neighbours |
| 4 | Rock | Cairnside | Push boulders into pits to bridge the way |
| 5 | Electric | Lumenlea | Charge every floor panel exactly once |
| 6 | Ice | Frosthollow | Slide across sheer ice |
| 7 | Shadow | Thornmuth | Find three seals in the dark |
| 8 | Normal | Anvilgate | Answer the gatekeepers' type-chart questions |

All eight badges open the road to Summit City and the Champion Cup.

**Max Mode**: in a gym or a Champion Cup match you can, once per battle, make your Creatamon grow enormous. It gains half
again its health and its attacks become never-miss Max moves until it faints, is switched out or the battle ends.
Leaders and Cup opponents do the same with their last Creatamon. (One secret Creatamon can use it in any battle.)

**Field moves** work outside battle. Face the obstacle and press Enter, and a Creatamon that knows the move is summoned:
*Rock Smash* breaks cracked rocks, *Surf* carries you across rivers, lakes and the sea.

## Your character

A new game starts by choosing a gender, name, skin, hair and outfit. Open the **Wardrobe** from the menu to change
clothes any time. Extra hats and tops are hidden in blue chests and won from trainers.

## Power Cards

Every Creatamon is built from cards: as many move and health cards as you like, plus a free choice of element and body.
You can keep the generated look, pick **Draw my own** in the Forge and paint a 32x32 sprite, or pick **Upload image**
to use any picture from your device (it is shrunk to 128px and kept in your save).

| Tier | Examples |
| --- | --- |
| ★ Common | Tackle, Ember, Vitality Shard (+30 HP) |
| ★★ Rare | Aqua Jet, Mend, Rock Smash, Surf, Vitality Core (+100 HP) |
| ★★★ Epic | Tsunami Blast, Hyper Burst, Titan Heart (+250 HP) |

Cards come from chests, trainers, Gym Leaders, and drops from wild Creatamon (later routes drop better tiers).
Rebuilding a Creatamon at the Forge is free, and dismantling one returns its cards.

## Wild Creatamon

Which species you meet depends on the ground: meadow grass, forest, cave rubble, flowers, snow, or open water while
surfing. Their levels rise with each route. Rare ones (marked ✦) always drop a card.
The menu's Creatadex tracks every species you have met.

## Development

- `js/core.js` holds cards, species and battle rules, with no DOM
- `js/world.js` holds the map, gym interiors, puzzle rules, people and teams, with no DOM
- `js/draw.js` draws tiles, people, creatures and attack animations
- `js/gl.js` renders the overworld in 3D with WebGL: the tile art laid flat, walls and buildings raised as blocks,
  and trees and people standing upright. Without WebGL the game falls back to the flat view
- `js/game.js` holds the overworld, story, battles, menu, wardrobe and Forge
- `node test/core.test.js` checks the rules, solves every gym puzzle by search, and walks the story from start
  to Champion to prove every step is reachable in order
