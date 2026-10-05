# Creatamon

A creature-battling RPG where you don't catch your team, you **create** it.
Find **Power Cards**, slot them into a Creatamon at the Forge, earn fourteen gym badges and take the Champion Cup.

## Play

Open `index.html` in a browser. No build step, no dependencies. Progress saves automatically in the browser.

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Enter / Space | Interact, advance text, use a field move on the thing you face |
| E | Inventory: your items and unused Power Cards |
| Q | Hop on or off your bike (outdoors, once you have it) |
| M / Esc | Menu: a grid of tiles for next objective, badges, party, Forge, Wardrobe, Creatadex |
| R | Start a gym challenge over |
| G | Spray your chosen design on the ground ahead |
| 1-9 | Pick a battle option |

On a phone or tablet a direction pad and A / menu / bag / bike buttons appear on screen; everything else is tapped directly.

Sound effects and music are generated in the browser (no audio files). The menu's **Options** tile turns either off, and
also controls whether battle messages move on by themselves.

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
| 11 | Robot | Cogsworth | Conveyor belts that carry you along |
| 12 | Light | Solhaven | Light every floor lamp exactly once |
| 13 | Toxic | Mirefen | Push boulders into three sludge pits |
| 14 | Normal | Anvilgate | Five gatekeepers' type-chart questions |

Trainers on the routes watch the road: step right beside one, or up to three tiles in front of them, and they challenge
you. Some roads are held by trainers who must be beaten to pass, and the road on from each gym town stays shut until its badge
is won. All fourteen badges open the road to Summit City and the Champion Cup.

**Finding the gyms**: every gym hall has a roof in its element's colour with a white roundel over the door, and a pair of
banners outside whose beacons pulse until you hold that badge. Once the challenge begins, the bar at the top of the screen
points to the next gym and counts the steps to its door.

**Level limit**: a Creatamon cannot grow past a level limit that rises with each badge (11 at the start, 76 with all
fourteen), so no Leader can simply be out-levelled. The routes wind back and forth between hedges and ridges; expect a walk.

**Max Mode**: in a gym or a Champion Cup match you can, once per battle, make your Creatamon grow enormous. It gains half
again its health and its attacks become never-miss Max moves until it faints, is switched out or the battle ends.
Leaders and Cup opponents do the same with their last Creatamon. (One secret Creatamon can use it in any battle.)

**The bike**: Champion Vex gives you a bike with his endorsement. Press Q outdoors to ride at twice walking speed.
After the Ice gym Wren fits it with floats, and from then on it rides straight onto rivers, lakes and the sea.

**Field moves** work outside battle. Face the obstacle and press Enter, and a Creatamon that knows the move is summoned:
*Rock Smash* breaks cracked rocks, *Surf* carries you across rivers, lakes and the sea. Holding the card is enough: it does not have to be slotted.

## Finding your way

- The bar at the top left shows where you are, your badges and coins, and **your next objective**.
- A **red arrow** points the way to it. When the goal is on screen the arrow hangs over it; otherwise it sits at the edge
  of the screen with the number of steps left.
- Face anyone and their **name** appears over their head. Walking into a new place announces its name.
- The **minimap** in the bottom right corner fills in as you explore; the Town Map in the menu shows everything you have seen.

## Coins, Creatastops and Storage

- Beating a trainer pays **coins** (◎); Gym Leaders pay triple.
- Most towns have a **Creatastop**, a small red-roofed shop with a striped awning. Walk in at its door to buy potions, Creataballs,
  Power Cards of that town's element, and clothes. More goods appear as you win badges.
- There are 126 pieces of clothing. The Wardrobe only lists the ones you own; the rest come from Creatastops (each town
  stocks different ones), sparkles and trainers.
- Your party holds **six** Creatamon. Forge a seventh and it goes to **Storage**, where it can be swapped in from the menu.
- Potions and Revives can be used straight from the Bag (press E), as well as in battle.

## Alphas and Champion rank

- Once the Gym Challenge is under way, **alpha Creatamon** prowl the open ground beside long grass: big, glowing red,
  six levels above the local wildlife, with three extra health cards and punching gloves. They are uncommon: at most
  two are about at once, and a new one only sometimes turns up.
- They wander until you come within six tiles, then charge. If one touches you, you battle it. You can Run (it loses
  interest for a few seconds), and they will not follow you into a town.
- Beating one earns coins, a sure Power Card and **Champion rank**. There are seven tiers of three steps each: Alpha,
  King, Emperor, Conqueror, Warlord, Legend and Mythic (I, II, III). Each tier costs more wins per step than the last:
  Alpha I takes 2 alpha wins, King I 9, Emperor I 19, Conqueror I 32, Warlord I 48, Legend I 67, Mythic III 105.
- The Champion only accepts challengers ranked **King I** or higher (9 alpha wins). Beating him makes you **Champion I**,
  and every five alphas after that adds a numeral: Champion II, III, IV, V... without end.
- Stand still for three seconds and your title appears above your head. It is also on your Trainer Card.
- In the 3D view long grass stands up out of the ground, and you wade through it.

## Harder as you go

- From the third gym on, the Leader's **gym trainers** must be beaten first, back to back with no healing in between:
  one at gyms 3 to 5, two at gyms 6 to 9, three from gym 10. Trainers you have beaten stay beaten if you lose later.
- Leaders pick their best move more and more often, their Creatamon carry extra health cards, from gym 5 they hold
  items, and from gym 8 they bring a fifth Creatamon (a sixth from gym 12).

## Extras

- **Fast travel**: once you have stood on a town's heal pad, the Town Map can take you straight back there.
- **Trophies**: 22 milestones, each paying coins, announced with a pop-up.
- **Shiny Creatamon**: one wild Creatamon in forty (one alpha in twenty) is shiny, and leaves a purse of coins.
- **Daily gift**: coins and a Potion the first time you play each day, growing for up to seven days in a row.
- **Trainer Card**: your title, badges, time played, battles won and other records.

## Developer mode

Open the menu (M) and type **iam100** to open the testing tools. There is no button for it; type the word again whenever
you want them back. They offer switches for no wild battles, walking through walls and one-hit wins; complete the current objective or skip to the
Champion match; spawn an alpha or add an alpha win; give coins, Creataballs, potions, cards, clothes and levels; reveal the
map; teleport to any town.

## Creataballs, evolution and items

- Forging a **new** Creatamon uses up a **Creataball**, and so does rebuilding one. Balls come from sparkles, badges and
  sometimes wild Creatamon.
- Every Creatamon of yours that attacks a foe earns **XP** when it faints, not just the one that lands the last hit.
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

Every Creatamon is built from cards: up to six move cards and as many health cards as you like, plus a free choice of element and body.
You can keep the generated look, pick **Draw my own** in the Forge and paint a 32x32 sprite (with brush sizes, mirror, undo, a colour picker
and a button to start from the generated look), or pick **Upload image**
to use any picture from your device (it is shrunk to 128px and kept in your save).

| Tier | Examples |
| --- | --- |
| ★ Common | Tackle, Ember, Vitality Shard (+30 HP) |
| ★★ Rare | Aqua Jet, Mend, Rock Smash, Surf, Vitality Core (+100 HP) |
| ★★★ Epic | Tsunami Blast, Hyper Burst, Titan Heart (+250 HP) |

Cards come from sparkles, trainers, Gym Leaders, and drops from wild Creatamon (later routes drop better tiers).
Rebuilding a Creatamon at the Forge costs a Creataball, and dismantling one returns its cards.

## Wild Creatamon

Which species you meet depends on the ground: meadow grass, forest, cave rubble, flowers, snow, or open water while
surfing. Their levels rise with each route. Rare ones (marked ✦) always drop a card.
Trainers nickname their Creatamon and draw their own looks for them.
The menu's Creatadex tracks every species you have met.

## Development

- `js/core.js` holds cards, species and battle rules, with no DOM
- `js/world.js` holds the map, gym interiors, puzzle rules, people and teams, with no DOM
- `js/draw.js` draws tiles, people, creatures and attack animations
- `js/gl.js` renders the overworld in 3D with WebGL: the tile art laid flat and filtered smooth, walls and buildings raised
  as blocks with pitched roofs, low-poly rounded trees, people standing upright with depth, warm and cool sunlight,
  soft cast shadows and distance haze. Without WebGL the game falls back to the flat view
- `js/game.js` holds the overworld, story, battles, menu, wardrobe and Forge
- `node test/core.test.js` checks the rules, solves every gym puzzle by search, and walks the story from start
  to Champion to prove every step is reachable in order
