# Creatamon

A creature-battling RPG where you don't catch your team, you **create** it.
Find **Power Cards**, slot them into a Creatamon at the Forge, earn eleven gym badges and take the Champion Cup.

## Play

Open `index.html` in a browser. No build step, no dependencies. Progress saves automatically in the browser.

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Enter / Space | Interact, advance text, use a field move on the thing you face |
| M / Esc | Menu: next objective, badges, party, Forge, Wardrobe, Creatadex |
| R | Start a gym challenge over |
| G | Spray your chosen design on the ground ahead |
| 1-9 | Pick a battle option |

## The journey

You and your rival Finn are endorsed by the Champion for the Gym Challenge of the Galdra region.
The menu always shows what to do next.

There is one gym per element, and each has a challenge to solve before its Leader will battle you:

| # | Gym | Town | Challenge |
| --- | --- | --- | --- |
| 1 | Grass | Furrowfield | Herd the Fluffin into their pens |
| 2 | Water | Brinemouth | Coloured valves that open some waterfalls and shut others |
| 3 | Fire | Kilnford | Light seven braziers; each one flips its neighbours |
| 4 | Wind | Galeholt | Ride floor vents that blow you along |
| 5 | Rock | Cairnside | Push boulders into three pits |
| 6 | Electric | Lumenlea | Charge every floor panel exactly once |
| 7 | Metal | Steelspire | Push steel crates onto pressure plates |
| 8 | Ice | Frosthollow | Slide across sheer ice |
| 9 | Shadow | Thornmuth | Find five seals in the dark |
| 10 | Mind | Reverie | Warp pads between doorless rooms |
| 11 | Normal | Anvilgate | Five gatekeepers' type-chart questions |

Some roads are held by trainers who must be beaten to pass. All eleven badges open the road to Summit City and the Champion Cup.

**Max Mode**: in a gym or a Champion Cup match you can, once per battle, make your Creatamon grow enormous. It gains half
again its health and its attacks become never-miss Max moves until it faints, is switched out or the battle ends.
Leaders and Cup opponents do the same with their last Creatamon. (One secret Creatamon can use it in any battle.)

**Field moves** work outside battle. Face the obstacle and press Enter, and a Creatamon that knows the move is summoned:
*Rock Smash* breaks cracked rocks, *Surf* carries you across rivers, lakes and the sea.

## Creataballs, evolution and items

- Forging a **new** Creatamon uses up a **Creataball** (rebuilding one is free). Balls come from sparkles, badges and
  sometimes wild Creatamon.
- At levels 16 and 36 a Creatamon can **evolve** from the menu. Each stage builds in free health and makes all its
  attacks hit harder.
- Each Creatamon can **hold one item**: Punching Gloves (more damage), Guard Shield (30% chance to nullify a hit),
  Lucky Charm, Swift Boots or Mending Leaf.
- **Potions** and Revives are used from the Bag, in battle too.
- **Sparkles** on the ground are pick-ups: walk over them. **Spray designs** found this way can be painted on the
  ground with G.

## Your character

A new game starts with a short tutorial and by choosing a gender, name, skin, hair and outfit, in any colours you like. Open the **Wardrobe** from the menu to change
clothes any time. Extra clothes are hidden among the sparkles and won from trainers. The menu has a How to play page.

## Power Cards

Every Creatamon is built from cards: as many move and health cards as you like, plus a free choice of element and body.
You can keep the generated look, pick **Draw my own** in the Forge and paint a 32x32 sprite (with brush sizes, mirror, undo, a colour picker
and a button to start from the generated look), or pick **Upload image**
to use any picture from your device (it is shrunk to 128px and kept in your save).

| Tier | Examples |
| --- | --- |
| ★ Common | Tackle, Ember, Vitality Shard (+30 HP) |
| ★★ Rare | Aqua Jet, Mend, Rock Smash, Surf, Vitality Core (+100 HP) |
| ★★★ Epic | Tsunami Blast, Hyper Burst, Titan Heart (+250 HP) |

Cards come from sparkles, trainers, Gym Leaders, and drops from wild Creatamon (later routes drop better tiers).
Rebuilding a Creatamon at the Forge is free, and dismantling one returns its cards.

## Wild Creatamon

Which species you meet depends on the ground: meadow grass, forest, cave rubble, flowers, snow, or open water while
surfing. Their levels rise with each route. Rare ones (marked ✦) always drop a card.
Trainers nickname their Creatamon and draw their own looks for them.
The menu's Creatadex tracks every species you have met.

## Development

- `js/core.js` holds cards, species and battle rules, with no DOM
- `js/world.js` holds the map, gym interiors, puzzle rules, people and teams, with no DOM
- `js/draw.js` draws tiles, people, creatures and attack animations
- `js/gl.js` renders the overworld in 3D with WebGL: the tile art laid flat, walls and buildings raised as blocks,
  with pitched roofs, block-built trees and people standing upright. Without WebGL the game falls back to the flat view
- `js/game.js` holds the overworld, story, battles, menu, wardrobe and Forge
- `node test/core.test.js` checks the rules, solves every gym puzzle by search, and walks the story from start
  to Champion to prove every step is reachable in order
