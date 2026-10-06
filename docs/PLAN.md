# Gym 3D: equipment plan (v2 and v3)

Seven new pieces of equipment, built the same way as the leg press and chest fly: drawn from simple shapes in code, with
the person really performing each exercise. Every machine is regular furniture, so it can be dragged and rotated in build
mode and is solid to walk into.

## How this plan works

- **3 features per version, one feature per block.** Each block adds one machine with its exercises.
- **Each block has a test phase** that must pass before the next block starts.
- **Each block ends with a 1–3 sentence summary.**
- **We stop after every block** and wait for your yes before starting the next one. A yes to this plan is not a yes to
  start building.
- Setup work isn't a feature, so it lives in **Block 0**, outside the count.

## What exists today (v1)

Room, lighting, walkable person with elbows and knees, build mode, and 5 machines with 8 exercises:

| Machine | Exercises |
| --- | --- |
| Dumbbell rack | Bicep curls, Lateral raises |
| Treadmill | Walk, Run |
| Leg press | Leg press |
| Flat bench | Dumbbell bench press, Seated shoulder press |
| Chest fly machine | Chest fly |

## The order, and why

| Version | Block | Machine | Exercises | New skill the person learns |
| --- | --- | --- | --- | --- |
| — | 0 | *(groundwork)* | — | — |
| v2 | 1 | Stationary bike | Easy ride, Sprint | Feet that follow moving pedals in circles |
| v2 | 2 | Rowing machine | Row | **Arms that reach a moving handle** (arm IK), body sliding on a seat |
| v2 | 3 | Adjustable bench | Incline dumbbell press, Seated curls | Machine part that changes shape per exercise (backrest angle) |
| v3 | 1 | Squat rack + barbell | Back squat | **Whole body lowering** (hips drop, torso tips forward) |
| v3 | 2 | Cable machine | Tricep pushdowns, Cable rows | Cables that stretch between pulley and hands |
| v3 | 3 | Pull-up bar | Pull-ups | **Whole body lifting itself**, hanging from the hands |

v2 comes first because each block teaches the person a skill the v3 blocks need. Arm IK, the arms' version of the leg maths
the leg press uses, arrives with the rower and is then reused by the squat bar, the cable handles and the pull-up bar.

## Testing approach

**Vitest** (instead of Jest). It reads the project's existing Vite setup and understands the modern JavaScript
modules three.js ships as, with no extra configuration; Jest would need workarounds for both. The test style is the same as
Jest's (`describe`, `it`, `expect`).

What gets tested automatically is **the maths**: where hands and feet land, whether they meet the handles, pedals and bars,
the numbers in the popups, and the build-mode rules. Each test row has an ID (like `B0-T1`) so a failure can be named, and
each test must go red if the thing it checks is broken.

What can't be automated is **how it looks**. Each block also has a short **visual check** in the browser (screenshots), and an
**optional** Android check that is listed separately and never marked passed unless done on the phone.

---

## Block 0: Groundwork

**Goal:** make the next six blocks testable, and save the work so far.

**Work:**
1. Add Vitest and an `npm test` command.
2. Move the pose maths out of `src/player/Person.tsx` into `src/player/poseMath.ts`: exercise poses, leg IK. `Person.tsx`
   keeps only the drawing, so the maths can be tested without a screen.
3. Add `src/player/bodyKinematics.ts`, a "where is each hand and foot right now" calculator. Give it the pose angles and it
   follows the same joint chain as `Person.tsx` (hip → knee → foot, shoulder → elbow → hand), using the shared numbers in
   `proportions.ts`. Machines are then tested against it.
4. Baseline tests for what already works, so later blocks can't quietly break it.
5. First git commit of v1 (after your OK).

**Tests:**

| ID | Checks | Goes red if… |
| --- | --- | --- |
| B0-T1 | Leg press: both feet stay within 6 cm of the footplate at 24 points across a rep | the sled or leg maths drift apart |
| B0-T2 | Chest fly: both hands stay within 4 cm of the handles at 24 points across a rep | the machine's arms and the person's arms stop matching |
| B0-T3 | Rep timing: 0 → 1 → 0 over 2.4 s; rep count goes up once per rep | rep timing changes |
| B0-T4 | Build mode: a piece snaps to the 25 cm grid, can't leave the room, overlaps snap back | the build rules break |
| B0-T5 | "Closest machine wins" when two are in reach | the nearest-machine fix regresses |
| B0-T6 | Each machine's menu lists exactly its own exercises | an exercise lands on the wrong machine |

**Visual check:** the app looks and behaves exactly as before (nothing should change on screen).

**Status: done** (2026-10-05, commit `08c995f`). 13 tests across B0-T1..T6, all passing; each one was checked to fail
when the behaviour it guards is deliberately broken. Visual check: app unchanged, no console errors.

**Summary:** Block 0 adds automatic tests and a hand-and-foot position calculator, then saves v1 in git. Nothing visible
changes, but every later machine can now be checked by maths instead of by eye.

---

## v2: Seated cardio and an adjustable bench

### Block 1: Stationary bike

**What you'll see:** an upright exercise bike with a saddle, handlebars, a console and a front flywheel. The person sits on the
saddle leaning slightly forward with hands on the handlebars, and pedals: the crank arms turn and the flywheel spins. The
popup shows speed, distance and time, the same way the treadmill does: "Cycling · 20 km/h · 0.15 km · 0:27".

**Exercises:** Easy ride (20 km/h, 72 pedal turns a minute) and Sprint (32 km/h, 102 a minute, leaning further forward).
(The plan first said Sprint would stand a little off the saddle. That would push the legs past straight at the bottom of
the pedal circle, so Sprint leans further forward instead.)

**How:**
- `bikeGeometry.ts`: saddle, crank centre, crank length. Shared by the bike and the person, like the leg press.
- Each pedal moves on a circle. The two pedals are half a turn apart. The leg IK we already have bends each hip and knee to
  keep a foot on its pedal.
- The crank angle comes from the same clock as reps, so pedals and feet always agree.
- Starting spot: beside the treadmill, facing the back wall.

**Tests:**

| ID | Checks |
| --- | --- |
| V2B1-T1 | Each foot stays within 3 cm of its pedal at 24 points around a full crank turn |
| V2B1-T2 | The pedals are always half a turn apart |
| V2B1-T3 | The leg never has to stretch past straight anywhere on the circle (the saddle height fits) |
| V2B1-T4 | Popup text: speed in km/h, and distance = speed × time |
| V2B1-T5 | Both hands rest on the handlebars at both paces (added: the arms got the same two-bone maths as the legs) |

**Visual check:** feet on the pedals, crank turning, Sprint visibly faster. Getting off returns the person to where they stood.

**Status: done** (2026-10-05). 18 tests passing (5 new: V2B1-T1..T5), each checked to fail when the behaviour it guards is
broken. Visual check in the browser: rider on the saddle, hands on the bars, cranks and flywheel turning. Measured in the live
scene: shoe to pedal about 1.5 cm once settled. That needed a fix first: joints used to ease toward their targets and trailed
the pedals by about 8 cm. Poses that follow moving machine parts (bike, leg press, chest fly) now track closely. Getting off
returns the person to where they stood; the treadmill still walks. The optional Android check has not been done.

**Summary:** The bike adds pedalling: feet follow two moving pedals in circles, with speed, distance and time in the popup.
It reuses the treadmill's popup and the leg press's leg maths.

### Block 2: Rowing machine

**What you'll see:** a long, low rower: a rail with a sliding seat, angled footplates, a flywheel housing at the front and a
handle on a chain. Each stroke goes legs → back → arms on the way out, then arms → back → legs on the way in. The seat slides,
the chain pays out, and the flywheel spins. The popup shows strokes and distance.

**Exercise:** Row.

**How:**
- **New: arm IK.** The same triangle maths as the legs (law of cosines), for shoulder → elbow → hand, so hands reach any handle
  position. The squat bar, cable handles and pull-up bar reuse it.
- **New: the body can slide during an exercise.** A pose can shift the whole person along the seat rail, not just bend joints.
- `rowerGeometry.ts`: rail, seat travel, footplate, handle path. Shared by the machine and the person.

**Tests:**

| ID | Checks |
| --- | --- |
| V2B2-T1 | Arm IK: at 24 points in a stroke, the hands reach the handle within 3 cm |
| V2B2-T2 | Feet stay on the footplates while the seat slides |
| V2B2-T3 | Arm IK never bends an elbow backward (the forearm can't fold the wrong way) |
| V2B2-T4 | Stroke count goes up once per stroke; distance matches |
| V2B2-T5 | The stroke goes legs → back → arms on the pull, and the reverse on the slide back (added) |

**Visual check:** the stroke reads as legs → back → arms. The chain stretches from the flywheel to the hands.

**Status: done** (2026-10-05). 23 tests passing (5 new: V2B2-T1..T5), each checked to fail when the behaviour it guards is
broken. The tests caught one real bug: the pace showed "1:59" instead of "2:00" (rounding). Visual check in the browser: the
stroke reads legs → back → arms, the seat slides 36 cm, the chain stretches to the handle and the fan spins. Measured in the
live scene: hands within 0.7 cm of the handle, feet within 0.7 cm of the footplates. That needed a fix first: the torso's lean
still eased slowly and trailed the stroke, so the hands missed the handle by up to 4.4 cm; poses that follow machine parts
now make the lean keep up too. The optional Android check has not been done.

**Summary:** The rower teaches the person arm IK, so hands follow a moving handle, plus a body that slides on a seat. Strokes
and distance show in the popup.

### Block 3: Adjustable bench

**What you'll see:** a bench with a backrest that tilts. Choosing an exercise sets the backrest: 45° for incline presses,
upright for seated curls. The person sits or reclines to match.

**Exercises:** Incline dumbbell press and Seated dumbbell curls.

**How:**
- The machine reads which exercise is running (a small addition to the shared machine state) and tilts its backrest to that
  exercise's angle.
- The person's lean comes from the same backrest angle, so back and backrest always line up.

**Tests:**

| ID | Checks |
| --- | --- |
| V2B3-T1 | The person's back lies against the backrest at both angles (within 3 cm along the spine) |
| V2B3-T2 | Incline press: dumbbells go up along the incline, not straight up toward the ceiling |
| V2B3-T3 | The backrest returns to flat after you get off |

**Visual check:** the backrest visibly tilts when you pick each exercise.

**Status: done** (2026-10-05). 26 tests passing (3 new: V2B3-T1..T3), each checked to fail when the behaviour it guards is
broken. Visual check in the browser: the backrest rises to 45° for the incline press and to 85° for seated curls, and folds
back flat when you stop. Measured in the live scene: the person's back is exactly one torso-thickness (20 cm) off the pad at
both the hips and the shoulders, at both angles. The backrest pivots at the back of the seat, and a strut underneath
stretches to hold it up. The optional Android check has not been done.

**Summary:** The adjustable bench adds a machine that changes shape per exercise: a 45° incline press and upright seated curls.
The person's back follows the backrest angle.

---

## v3: Full-body lifts

### Block 1: Squat rack with a barbell

**What you'll see:** a squat rack (two tall uprights, J-hooks holding a barbell with plates, safety bars). The person steps
under the bar, lifts it onto their upper back and squats: hips drop and go back, the torso tips forward, knees bend, and the
feet stay flat. They re-rack the bar when they stop.

**Exercise:** Back squat.

**How:**
- **New: the whole body can lower.** A pose can drop the hips and tip the torso *forward* (so far it only leaned back).
- The feet stay planted with the leg IK. The hands hold the bar with the arm IK from v2 Block 2.
- The barbell rides on the shoulders during the set, then goes back on the hooks.

**Tests:**

| ID | Checks |
| --- | --- |
| V3B1-T1 | Feet don't slide: within 2 cm of their starting spot through the whole rep |
| V3B1-T2 | The bar stays on the upper back, and both hands stay on the bar |
| V3B1-T3 | The squat reaches thighs-about-level at the bottom, and the knees never bend backward |
| V3B1-T4 | The bar returns to the hooks on stop |

**Visual check:** looks like a squat from the side (hips back, chest up), not just a straight drop.

**Status: done** (2026-10-06, on branch `v3-full-body`). 30 tests passing (4 new: V3B1-T1..T4), each checked to fail when
the behaviour it guards is broken. New for the body: `rise` (the whole body lowers), `flatFeet` (an ankle keeps the shoes
level while the shins tip) and `armTo3D` (arm reach in 3D, for hands behind and outside the shoulders). Visual check in the
browser: hips go back, chest tips forward, knees bend, feet stay flat; the bar comes off the hooks, rides on the back, and goes
back on the hooks on stop. Measured in the live scene: hands within 0.01 cm of the bar, shoes slide at most 0.7 cm and stay
level within 0.2°, the bar travels from 1.27 m down to 1.01 m. The optional Android check has not been done.

**Summary:** The squat rack teaches the person to lower their whole body with feet planted, carrying a barbell on their back.
It's the first exercise that moves the person's whole height.

### Block 2: Cable machine

**What you'll see:** a tall cable tower with a weight stack, a high pulley with a rope handle and a low pulley with a row
handle, plus a seat and footplate for rows. Real cables stretch from the pulley to the hands, and the stack lifts with every pull.

**Exercises:** Tricep pushdowns (standing, high pulley) and Cable rows (seated, low pulley).

This is **one machine with two exercises**, like the dumbbell rack, so it counts as one feature.

**How:**
- Cables are drawn as lines from the pulley to the hand, updated every frame.
- The stack lifts by how far the cable has been pulled.
- Pushdowns: elbows stay pinned at the sides and only the forearms move.
- Rows: seated, feet on the footplate, arm IK pulls the handle to the stomach.

**Tests:**

| ID | Checks |
| --- | --- |
| V3B2-T1 | The cable's end stays in the hands at every point of both exercises |
| V3B2-T2 | Pushdowns: elbows move less than 5 cm (only the forearms work) |
| V3B2-T3 | The stack lift matches how far the cable was pulled |
| V3B2-T4 | The menu lists both exercises; each uses the right pulley |

**Visual check:** the cable looks taut and follows the hands, and the stack rises and falls in time.

**Status: done** (2026-10-06, on branch `v3-full-body`). 34 tests passing (4 new: V3B2-T1..T4), each checked to fail when
the behaviour it guards is broken. The rows use the 3D arm reach from the squat (hands close together on a V-handle, elbows
drawing back). Visual check in the browser: pushdowns keep the upper arms at the sides while the forearms push the rope down;
rows reach forward and pull the handle to the stomach with the feet on the footplate; both cables stay taut and the stack
rises with each pull. Measured in the live scene: rope ends within 0.5 cm of the hands, V-handle within 0.2 cm. Known: while
the person is still stepping onto a machine (about half a second), handles already sit where the hands will be (true of every
machine). The optional Android check has not been done.

**Summary:** The cable machine adds stretching cables and a weight stack that follows the pull, with two exercises: standing
tricep pushdowns and seated cable rows.

### Block 3: Pull-up bar

**What you'll see:** a freestanding pull-up station. The person reaches up, grabs the bar and hangs, then pulls their chin over
the bar and lowers back down. Legs hang with a slight knee bend.

**Exercise:** Pull-ups.

**How:**
- **New: the whole body can rise above the floor.** A pose can lift the person; the hands stay fixed on the bar with the arm IK
  and the body moves under them.
- When they stop, the person drops back to the floor where they started.

**Tests:**

| ID | Checks |
| --- | --- |
| V3B3-T1 | Both hands stay on the bar (within 2 cm) through the whole rep |
| V3B3-T2 | At the top, the chin is level with or above the bar |
| V3B3-T3 | Feet never touch the floor during the set |
| V3B3-T4 | After stopping, the person stands on the floor at their start spot |

**Visual check:** looks like hanging from the hands (body under the bar, arms doing the lifting).

**Status: done** (2026-10-06, on branch `v3-full-body`). 38 tests passing (4 new: V3B3-T1..T4), each checked to fail when
the behaviour it guards is broken. The body rises with the same `rise` the squat used to lower it; the hands use the 3D arm
reach with the elbows flaring out. The step-off after a machine moved out of `Player` into `stepOffSpot()` so T4 can test
it. Visual check in the browser: the person hangs off the floor and pulls up until the head is over the bar. Measured in the
live scene: hands within 0.01 cm of the bar, chin 2.9 cm above the bar at the top, shoes 36–86 cm off the floor during the
set, and after stopping the person is back at their start spot with both shoes on the floor. The optional Android check has
not been done. **This completes v3, and the whole plan.**

**Summary:** The pull-up bar teaches the person to lift their whole body off the floor, hanging from their hands. It completes
the set of full-body movements.

---

## Where everything goes

The room is getting fuller. Starting spots (all movable in build mode):

| Machine | Spot | Facing |
| --- | --- | --- |
| Stationary bike | Beside the treadmill, back wall | the back wall |
| Rowing machine | Left wall, middle | into the room |
| Adjustable bench | Front, left of the flat bench | into the room |
| Squat rack | Back wall, between the dumbbell rack and the treadmill | into the room |
| Cable machine | Right wall, back corner | into the room |
| Pull-up bar | Left back corner | into the room |

## Backlog (not in any block)

- A more human-looking person: a rigged CC0 model driven by our joint angles (see the earlier research).
- Remember furniture positions after a reload.
- Real-phone performance check with all 12 machines.
- Legs slightly overlapping the flat bench's pad when lying down.
- Switching Walk ↔ Run (and Easy ↔ Sprint) without stopping first.
- Handles wait in place for the first half second while the person steps onto a machine.

## Decisions (2026-10-05)

1. **Tests:** Vitest.
2. **Adjustable bench:** added *next to* the flat bench (12 machines in total).
3. **Order:** v2 first, then v3.
4. **Block 0:** approved, including the first git commit (local only).
