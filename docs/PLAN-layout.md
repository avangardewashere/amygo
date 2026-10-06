# Gym 3D: layout and look plan (L1 and L2)

Right now the gym is a 20 × 12 m room with 11 pieces spread along the walls, one of each kind, and a bare painted room
around them. It reads as a big empty box, not a gym. This plan fixes that in two versions:

- **L1: A full gym floor.** About 28 pieces instead of 11, grouped into zones the way real gyms are, with a floor that
  marks each zone.
- **L2: Walls with character.** Wall finishes, a mirror, painted zone names and a gym name, and the small things that
  make a gym feel used (plate trees, kettlebells, TVs, a clock).

They're called **L1 / L2** (not v8 / v9) because when they get built is a decision below (D1), and the numbers v6 and v7
are already taken by the app shell and the workout log.

## How this plan works

Same rules as before:

- **3 features per version, one feature per block.**
- **Each block has a test phase** (Vitest, each test checked to fail when the thing it guards is broken) that must pass
  before the next block starts. The Android check stays **optional** and is never marked passed unless done on the phone.
- **Each block ends with a 1–3 sentence summary.**
- **We stop after every block** and wait for your yes. A yes to this plan is not a yes to start building.
- Each version gets its own branch (`l1-gym-floor`, `l2-walls`), merged when you say so.

## The starting point (2026-10-06)

| What | Today |
| --- | --- |
| Room | 20 × 12 × 4.5 m, light grey walls, one orange stripe at 1.2 m, dark floor |
| Furniture | 11 pieces, one of each kind (the dumbbell rack is the only one of its kind that matters twice) |
| Floor used | About 21 m² of 240 m², so 9 % of the floor has anything on it |
| Layout | Pieces along the walls, the middle is empty, nothing is grouped by what it's for |

Good news from reading the code: **more than one of a kind already works.** Every piece has its own `id`, and the
machine state, menus, and exercises all look pieces up by `id`, never by kind. So a second treadmill is just a second
line in `DEFAULT_ITEMS`. The real work is choosing where things go, keeping it fast, and dressing the room.

## The new floor plan

Seen from above, front wall at the bottom (the side the camera looks in from). Each cell is about 1 m.

```
 back wall  (mirror behind the dumbbells, gym name above the squat racks)
+--------------------------------------------------------------------------+
| PU  PU      DR  DR         [ SR ]     [ SR ]          CB  CB              |
|             ab  ab  ab     platform   platform                     TV TV  |
| LP                                                              TM <-|    |
| LP          fb  fb  fb                                          TM <-|    |
|                                                                 TM <-|    |
| LP          ~~~~~~~~~~~~~~ turf lane ~~~~~~~~~~~~~~             TM <-|    |
| LP          ~~ mats ~~ kettlebells ~~ sled ~~~~~~~~             BK        |
| CF                                                              BK        |
| CF       RW RW RW                 (open: walkway in)            BK        |
+--------------------------------------------------------------------------+
 front wall (hidden in the dollhouse view)

PU pull-up   DR dumbbell rack   ab adjustable bench   fb flat bench   SR squat rack
CB cable     TM treadmill       BK bike   LP leg press   CF chest fly   RW rower
```

| Zone | Where | Pieces | Count |
| --- | --- | --- | --- |
| **Free weights** | Back wall, left of centre | 2 dumbbell racks against a mirror, 3 adjustable benches in a row in front, 3 flat benches behind those | 8 |
| **Strength** | Back wall, centre | 2 squat racks, each on its own wooden lifting platform | 2 |
| **Cable corner** | Back wall, right | 2 cable machines side by side | 2 |
| **Pull-up corner** | Back-left corner | 2 pull-up stations | 2 |
| **Cardio** | Right wall, facing it | 4 treadmills, then 3 bikes, TVs on the wall above | 7 |
| **Machines** | Left wall | 2 leg presses, 2 chest fly machines | 4 |
| **Rowing** | Front-left | 3 rowers side by side | 3 |
| **Turf lane** | Centre | No machines: a green strip with mats and props (L2) | 0 |
| | | **Total** | **28** |

Why this shape:

- **Zones by what they're for**, like a real gym: cardio together, free weights near a mirror, heavy lifting on
  platforms. It also makes the gym readable at a glance from the dollhouse view.
- **Cardio on the right wall, facing it,** so the TVs above them are on a wall the camera can actually see. (Facing the
  front wall would be more "real", but the front wall hides itself in the dollhouse view, so the TVs would never show.)
- **The front strip stays open.** It's what the camera looks across, and it's the way in, so filling it would hide
  everything else.
- **Aisles at least 0.8 m** between groups so the person can walk to every machine. A test checks this (L1-B1-T3).

---

## L1: A full gym floor

### Block 1: Zoned layout with more of each

**What you'll see:** the gym opens with 28 pieces in the zones above instead of 11 spread along the walls. Every piece
works: walk up to any of the 4 treadmills and run on it, any of the 3 rowers and row.

**How:**
- `DEFAULT_ITEMS` in `src/build/buildStore.ts` gets the new list. Ids follow today's pattern (`treadmill-1` …
  `treadmill-4`). Exact spots are the table above snapped to the 25 cm grid; small nudges are fine as long as the tests
  pass.
- **Old saved layouts (per D2):** a layout saved by v5 Block 1 would drag today's 11 pieces back to their old spots,
  right on top of new ones. So the saved layout version goes from 1 to 2, and a version-1 save is ignored once. Your
  browser starts with the new layout; anything you move after that is remembered as before.
- Nothing else should need to change. If something turns out to assume "one of each" (for example a menu that finds
  "the treadmill"), that's a bug and gets fixed here.

**Tests:**

| ID | Checks |
| --- | --- |
| L1B1-T1 | Every default piece sits fully inside the walls and overlaps no other piece |
| L1B1-T2 | Every id is unique, and every kind has the count in the table |
| L1B1-T3 | Every piece can be reached on foot: from the open front strip, a walk on the 25 cm grid around all footprints gets within reach of each piece |
| L1B1-T4 | Two pieces of the same kind keep separate state: start an exercise on `treadmill-2`, and only `treadmill-2` is the active machine |
| L1B1-T5 | A version-1 saved layout is ignored, and a version-2 one is applied |

**Visual check:** open the gym, see the zones. Use one treadmill, one rower, one bench that weren't there before.

**Status: done** (2026-10-07, on branch `l1-gym-floor`, from `master` at 84f0b58). 65 tests passing (5 new:
L1B1-T1..T5), each checked to fail when the thing it guards is broken: a rower shoved into its neighbour (T1), a treadmill
removed (T2), a cable machine parked in front of the treadmills (T3 names `treadmill-2` and `treadmill-3` as unusable),
machine state picked by kind instead of id (T4), the save version left at 1 (T5). The walk check lives in
`src/build/walkable.ts`: it floods the floor on the 25 cm grid from where the person starts and asks the game's own
"closest machine in reach" question at every spot, so a machine hidden behind its neighbours counts as unusable. One old
test (V5B1-T1) assumed the bench starts unturned; it now compares against the bench's own start. The other V5B1 tests
now write version-2 saves. No code outside the layout needed changing: everything was already keyed by id. Checked in the
browser: all 28 pieces in their zones, no console errors; ran on `treadmill-3` (popup counting), rowed on `rower-2`,
benched on `bench-3`, each the only active machine. **Cost, for Block 3:** `?perf` shows **1,245 draws** and 32.9k
triangles per frame at High, up from 576 draws with 11 pieces. Seen from the default camera on a wide screen, the right
wall (where the TVs will go in L2) is the hidden one, so L2 Block 3 has to check the TVs from the angles people actually see.

**Summary:** The gym opens with 28 pieces in seven zones (pull-ups, free weights, strength, cables, cardio, machines, rowing)
instead of 11 along the walls, and every new piece works. Old saved layouts are ignored once so nothing lands on top of
anything.

### Block 2: A floor that marks the zones

**What you'll see:** the floor stops being one dark grey sheet. Squat racks stand on wooden lifting platforms with a
rubber centre, the middle has a green turf lane with white lines, the cardio row sits on lighter rubber tiles, and thin
yellow lines mark the walkway in.

**How:**
- A new `src/scene/Floor.tsx` replaces the floor plane in `Room.tsx`. Zones are flat shapes a few mm above the floor
  (same trick as the wall stripe: lifted so they don't flicker).
- Platforms, turf and tile areas are **data** (a list of rectangles in `src/scene/floorZones.ts`), so tests can check
  them and moving a zone is a one-line change.
- The base floor gets a subtle **tile pattern** (1 × 1 m rubber tiles) from a small texture drawn in code at load, so
  there's no image to download.
- Platforms follow the squat racks by id: if you move a squat rack in build mode, its platform goes with it (per D3).
  Turf and tile zones stay put.
- Floor zones are **not** obstacles: you walk on them.

**Tests:**

| ID | Checks |
| --- | --- |
| L1B2-T1 | Every floor zone lies inside the room |
| L1B2-T2 | Each squat rack's platform sticks out past it on every side (trimmed only where a wall stops it), including after it's moved or turned |
| L1B2-T3 | Fixed zones (turf, cardio tiles) don't overlap each other |
| L1B2-T4 | Floor zones don't block walking (the reach test from L1B1-T3 still passes with them in) |
| L1B2-T5 | Every treadmill and bike stands fully on the cardio tiles, and nothing else touches the tiles or the turf (added while building: it's what makes the zones mean something) |

**Visual check:** platforms, turf, tiles, and walkway lines visible from the default view; move a squat rack and its
platform follows.

**Status: done** (2026-10-07, on branch `l1-gym-floor`). 70 tests passing (5 new: L1B2-T1..T5), each checked to fail when
the thing it guards is broken: platforms not trimmed at the wall (T1), margins not swapped when a rack is turned a quarter
(T2), the turf grown into the platforms (T3), a floor zone turned into an obstacle (T4), the cardio tiles cut short of
`bike-3` (T5). **One change from the plan:** the plan said platforms are "centred under" their rack, but the racks stand
5 cm from the back wall, so a centred platform would go through it. Instead a platform sticks out past its rack on every
side (30 cm at the ends of the bar, 60 cm front and back) and is trimmed where a wall stops it. Zones are data in
`src/scene/floorZones.ts`; `src/scene/Floor.tsx` draws them and replaces the plain floor in `Room.tsx`. The rubber tiles
are painted in code at load (1 × 1 m, speckles and seams, no image to download). Layers sit 2 and 4 mm up *and* are pulled
toward the camera when drawn (polygonOffset), so they don't flicker from far away. Turf lines and walkway lines are each
merged into one shape. A trap avoided: picking the squat racks inside the store selector would build a new list on every
read and re-render forever (the store warns about this), so the component selects the item list and filters after.
Checked in the browser: every zone shows, no flicker, no console errors; a squat rack dragged to the front and turned took
its platform with it, and Reset layout put it back. **Cost:** 1,253 draws (+8 for the whole floor) and 33.0k triangles.

**Summary:** The floor now says what each part of the gym is for: wooden lifting platforms that follow their squat racks, a
green turf lane, lighter tiles under the cardio row, yellow walkway lines, and rubber tiles everywhere else, for 8 extra
draws.

### Block 3: Keep it fast with 28 pieces

**What you'll see:** nothing new, and that's the point. The gym with 28 pieces should feel as smooth as it did with 11.

**How:**
- **Measure first.** A `?perf` readout (it may already exist by then from v5 Block 3; if so, reuse it) shows frames per
  second and **draw calls** (how many separate things the graphics card is asked to draw each frame). Note the numbers
  for 11 pieces (on `master`) and for 28.
- Likely fixes, applied only if the numbers say so:
  - **Share geometry and materials.** Today each machine builds its own boxes and colours when it appears. Four
    treadmills means four copies of identical shapes. Moving those to one shared copy per kind costs nothing visually.
  - **Shadows only where they show.** Small parts (bolts, handles, cables) don't need to cast shadows; frames and
    seats do.
  - **Freeze idle machines.** A machine that isn't in use doesn't need to update its moving parts every frame.
- A **draw-call budget** test: count the meshes the default layout creates and fail if it goes over the budget agreed in
  D4. This stops L2 (and anything later) from quietly making the gym slow.

**Tests:**

| ID | Checks |
| --- | --- |
| L1B3-T1 | The default layout stays under the draw-call budget (D4) |
| L1B3-T2 | ~~Two machines of the same kind share one geometry and one material per part~~ → Merging keeps every still part (same triangle count before and after, fewer draws, and undo puts it back), for every kind of machine |
| L1B3-T3 | ~~An idle machine's moving parts don't change between frames~~ → No merged part ever moves: every exercise is run for 4 s on its machine, and any merged part that moved fails the test |

**Visual check:** `?perf` shows the numbers before and after, written into this block's status. Optional Android check:
open the gym on the phone and note the frames per second.

**Status: done** (2026-10-07, on branch `l1-gym-floor`). 73 tests passing (3 new: L1B3-T1..T3), each checked to fail when
the thing it guards is broken: merging switched off (T1: 1,295 > 684), one part left out of each merge (T2: the dumbbell
rack lost 112 triangles), the leg press sled and then the treadmill slats left unmarked (T3 names the merged parts that
moved). **What changed from the plan, and why:** sharing one geometry and material between copies saves memory, but in
three.js every mesh is still its own draw, so it would not have moved the number that matters. Instead
`src/build/mergeStatic.ts` merges each machine's still parts into one shape per material after it appears; the parts that
move are marked `userData={{ moving: true }}` (16 places, every part a model animates through a ref) and left alone. The
originals stay in the scene, hidden, so build-mode clicks still reach them; the merged copies ignore clicks. Plan T2 and T3
were replaced by tests for the two ways merging could go wrong (losing a part; freezing a part that should move). "Freeze
idle machines" was dropped: it saves a little work per frame but no draws. To count draws in tests, `src/test/renderScene.ts`
builds the scene in Node with R3F's own `createRoot` and a stand-in renderer (no new package). Per machine, unmerged →
merged: dumbbell rack 124 → 8, cable 77 → 34, chest fly 64 → 31, leg press 48 → 22, squat rack 46 → 20, rower 36 → 22, bike
35 → 22, pull-up 34 → 10, adjustable bench 32 → 16, treadmill 32 → 18, bench 24 → 8. What's left is mostly moving parts.
**D4 budget: 684** furniture draws (526 measured + 30 %). **In the browser (`?perf`): 1,253 → 533 draws** for the whole
scene, fewer than the 11-piece gym had (576); the gym looks the same, no console errors; in build mode a treadmill was
dragged out of the cardio row with the real mouse and came out whole. The optional Android check has not been done (it
belongs to v5 Block 3, which now measures this gym).

**Summary:** The 28-piece gym now costs 533 draws per frame, less than the old 11-piece one, because each machine's still
parts are merged into a few shapes. A test fails if anything merged ever moves, and a budget test stops the gym from
quietly getting heavier.

---

## L2: Walls with character

### Block 1: Wall finishes and a mirror

**What you'll see:** the walls get a real gym finish. A dark charcoal lower band (0 to 1.2 m, where people knock into
walls) with the orange stripe moved to its top edge, light walls above. The back wall behind the squat racks becomes an
**accent wall** (dark, with vertical wood slats). Behind the dumbbell racks, a wide **mirror** from 0.3 m to 2.4 m.

**How:**
- `Room.tsx` grows from "plane + stripe" to a list of **wall pieces** (band, stripe, slat panel, mirror) placed by data in
  `src/scene/wallDesign.ts`: which wall, from where to where, at what height. Same lifted-off-the-wall trick as the
  stripe today.
- **The mirror (per D5):** a true reflection re-draws the whole gym a second time every frame, which is the single most
  expensive thing we could add. The recommended version is a **fake mirror**: a glossy, slightly blue-grey panel with a
  soft gradient, which reads as a mirror from the dollhouse view at a tiny cost. A real reflection can be turned on for
  desktop only later.
- Slats are ~~thin boxes~~ flat strips (see the status) **merged into one mesh** (one draw call for the whole slat wall, not one per slat).

**Tests:**

| ID | Checks |
| --- | --- |
| L2B1-T1 | Every wall piece lies within its wall's length and the room's height |
| L2B1-T2 | The mirror lines up behind the dumbbell racks (covers both racks' width) |
| L2B1-T3 | Wall pieces on the same wall don't overlap unless they're meant to stack (stripe on top of band) |
| L2B1-T4 | ~~The draw-call budget from L1B3-T1 still passes~~ → The walls have their own draw budget (22), and the whole slat wall is one draw (walls aren't furniture, so the L1 budget could never catch them) |

**Visual check:** the four walls from the default view and one orbit round; the mirror reads as glass.

**Status: done** (2026-10-07, on branch `l2-walls`, from `master` at 02890dd). 77 tests passing (4 new: L2B1-T1..T4), each
checked to fail when the thing it guards is broken: slats run past the ceiling (T1), the mirror too narrow for `rack-2`
(T2), the mirror on the same layer as its frame (T3), the slats left unmerged and, separately, every flat piece casting a
shadow (T4: 27 draws over 22). Wall pieces are data in `src/scene/wallDesign.ts` (which wall, from/to along it,
bottom/top, layer); `src/scene/Walls.tsx` draws them and `Room.tsx` now only holds the floor, ceiling and `<Walls />`.
**Changes from the plan:** (1) slats are flat strips facing into the room, not thin boxes. The dollhouse view works because
each wall shows only its front; a box has faces pointing every way, so the slats would float in mid-air when their wall
hides. Flat strips hide with the wall. (2) T4 got its own wall budget (see the table). (3) The first mirror (light grey
fading to mid grey) read as a whiteboard; a gym mirror seen from across the room mostly reflects the dark floor, so the
glass now fades from cool light grey at the top to near-black at the bottom, with two faint diagonal sheen streaks. Its
colour fade is stored on the shape's corners (no texture), so it also builds in the Node tests. Checked in the browser: band
and stripe on all four walls, wood slats behind the squat racks, the mirror reads as glass, no console errors; orbiting
behind the back wall hides the mirror and slats with it. **Cost:** 542 draws (+9), 17 of them the walls. One flaky moment: with the laptop busy, two scene-building tests (about 1 s each normally) hit Vitest's 5 s limit and failed; those tests now allow 20 s, the rest keep the default.

**Summary:** The walls now look like a gym's: a dark lower band under the orange stripe, a wood-slat accent wall behind the
squat racks, and a mirror behind the dumbbells, all flat so they still disappear with their wall in the dollhouse view.

### Block 2: Painted zone names and a gym name

**What you'll see:** big painted letters on the walls, like real gyms have: **FREE WEIGHTS** above the mirror,
**CARDIO** above the treadmills, **STRENGTH** on the accent wall, and the gym's name, **Amygo** (D6), large on the back wall,
plus one short painted line (for example "ONE MORE REP") on the left wall.

**How:**
- Text is drawn into a texture **in code at load** using a system font, so there's no font file to download (a 3D text
  library would add a font file and some code for a few words).
- Each piece of wall art is data in `wallDesign.ts` (text, wall, position, height, colour), so changing a word is a
  one-line change.
- Zone names sit **above** the equipment (2.6 to 3.4 m), so machines never cover them.

**Tests:**

| ID | Checks |
| --- | --- |
| L2B2-T1 | Every painted text fits within its wall and doesn't overlap the mirror, slats or other text |
| L2B2-T2 | Each zone name sits over its zone (CARDIO's x/z range overlaps the cardio pieces' range on that wall) |
| L2B2-T3 | The texture size for each text is worked out from its length, so long words aren't squashed (aspect ratio test) |

**Visual check:** every word readable from the default view on desktop and in portrait.

**Summary:** _(written when the block is done)_

### Block 3: Props that make it feel used

**What you'll see:** the small things every gym has, placed where they'd really be:

| Prop | Where | Moves? |
| --- | --- | --- |
| Plate tree with plates | Beside each squat rack | Follows its rack |
| Kettlebell shelf (6 bells) | Turf lane, back edge | Fixed |
| Exercise mats, foam rollers, a sled | On the turf | Fixed |
| 2 wall TVs (screens glow, show a simple looping picture) | Right wall, above the treadmills | Fixed |
| Wall clock showing the real time | Left wall | Fixed |
| Water fountain, 2 plants, speakers | Corners and near the way in | Fixed |

**How:**
- Props are built the same way as the machines (simple shapes, shared materials), in `src/props/`. They are **not**
  in the build catalog: you can't drag them, and they have no menu (per D7). Floor props are solid, so the person walks
  round them.
- Plate trees follow their squat rack the same way platforms do in L1 Block 2.
- The clock's hands come from a pure function of the time, so it's testable.

**Tests:**

| ID | Checks |
| --- | --- |
| L2B3-T1 | No floor prop overlaps a piece of furniture or another prop, and all are inside the room |
| L2B3-T2 | Every machine is still reachable on foot with the props in (the L1B1-T3 walk test, props as obstacles) |
| L2B3-T3 | Clock hands: 3:00 puts the hour hand at a quarter turn and the minute hand at 12; 6:30 puts the hour hand halfway between 6 and 7 |
| L2B3-T4 | A plate tree stays beside its squat rack after the rack is moved or turned |
| L2B3-T5 | The draw-call budget still passes |

**Visual check:** the whole gym from the default view, then walk the person through each zone. Optional Android check.

**Summary:** _(written when the block is done)_

---

## Decisions (decided 2026-10-07, all as recommended)

| # | Question | Decision |
| --- | --- | --- |
| D1 | When: **now, before v5 Block 3** (the phone check), or **after v7**? | **Now, before v5 Block 3.** Going from 11 to 28 pieces plus wall dressing is the biggest performance change the gym will get, so the phone check should measure *this* gym, not today's empty one. v5 Block 2 (the human model) can go before or after; it doesn't touch the layout. |
| D2 | Old saved layouts: **ignore them once** (everyone starts on the new layout) or **keep old positions** for the 11 original pieces? | **Ignore once.** Old positions would land on top of the new pieces. Only this browser's own arrangement is lost. |
| D3 | Lifting platforms and plate trees **follow their squat rack** when it's moved, or stay fixed? | **Follow.** A platform left behind on empty floor looks broken. |
| D4 | Draw-call budget: set it at **the L1 Block 3 measurement + 30 %** as headroom for L2? | **Yes.** A fixed number now would be a guess; measuring first gives a real one. |
| D5 | Mirror: **fake** (glossy panel, nearly free) or **real reflection** (draws the gym twice, desktop only)? | **Fake now.** A real one can be a later toggle. |
| D6 | Gym name painted on the back wall: what should it say? | **Amygo** (your pick, 2026-10-07) |
| D7 | Props: **fixed decoration** or **movable in build mode**? | **Fixed** for now. Making them movable means build mode, saving and the catalog all learn a second kind of item; that's its own block if you want it later. |

## Not in this plan

- A bigger room or a second room (the room size is still one line in `dimensions.ts` if you want that later).
- Adding or deleting pieces in build mode (a "Duplicate" button). The default gym gets more pieces, but build mode still
  only moves and turns them.
- Other people in the gym.
- New exercises: every new piece is another copy of a machine that already works.
