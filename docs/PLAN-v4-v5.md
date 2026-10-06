# Gym 3D: polish plan (v4 and v5)

The six backlog items from the equipment plan ([PLAN.md](PLAN.md)), turned into two versions. No new machines: v4 fixes how
the existing ones feel to use, v5 gets the gym ready to be opened on a phone and shown to people.

## How this plan works

Same rules as before:

- **3 features per version, one feature per block.**
- **Each block has a test phase** (Vitest, each test checked to fail when the thing it guards is broken) that must pass
  before the next block starts. The Android check stays **optional** and is never marked passed unless done on the phone.
  The one exception is v5 Block 3, which *is* the phone check.
- **Each block ends with a 1–3 sentence summary.**
- **We stop after every block** and wait for your yes. A yes to this plan is not a yes to start building.
- Each version gets its own branch off `master` (`v4-smoother-play`, then `v5-phone-ready`), merged when you say so.

## The order, and why

| Version | Block | Feature | Backlog item |
| --- | --- | --- | --- |
| v4 | 1 | Change pace without stopping | Switching Walk ↔ Run (and Easy ↔ Sprint) without stopping first |
| v4 | 2 | Step on, then start | Handles getting a head start while the person steps onto a machine |
| v4 | 3 | Legs straddle the flat bench | The small leg overlap on the flat bench |
| v5 | 1 | Remember the layout | Remembering furniture positions after a reload |
| v5 | 2 | A more human-looking person | A more human-looking person |
| v5 | 3 | Runs well on a phone | A phone performance check with all 12 machines |

- **v4 first:** three small, contained fixes to things you already use. They touch only code we wrote and know well, so
  they're quick wins and low risk.
- **The human-looking person comes before the phone check,** because a rigged model is the heaviest thing we'll add.
  Measuring phone speed before it would measure the wrong gym.
- **The phone check is last** so it measures the finished app, and its fixes (if any are needed) apply to everything.

## Decisions (please answer before v4 Block 1)

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | When you switch pace, do the time and distance **carry on** or **start again**? | **Decided 2026-10-06: carry on** (your yes to the plan) |
| D2 | Saved layout lives in **this browser only** (no accounts, nothing sent anywhere). OK? | Yes, this browser only |
| D3 | For the phone check, open the app via your **Wi-Fi** (dev server on your laptop, phone on the same network) or put it **online** (GitHub repo + free host)? | Wi-Fi first; going online can be its own step later |
| D4 | The human-looking person needs a **download**: a free CC0 rigged model (the earlier research pointed to Quaternius's models). I'll name the exact file, source and size and ask before downloading. OK to plan on that? | Yes, ask at the start of v5 Block 2 |

---

## v4: Smoother play

### Block 1: Change pace without stopping

**What you'll see:** while walking on the treadmill, the menu offers **Run** next to **Stop** (and running offers **Walk**). On
the bike, Easy ride offers **Sprint** and back. Picking it changes pace on the spot: the belt or pedals speed up, the person's
stride or cadence follows smoothly, and the popup keeps counting (per D1).

**How:**
- During an activity, the machine's menu lists **Stop** plus the machine's *other* exercises that are paces of the same
  movement (walk/run, ride/sprint). Strength exercises keep just **Stop**, since switching from curls to raises mid-set
  isn't a thing.
- Switching keeps the person where they are (no stepping off and on) and updates the machine's speed.
- **Carrying the totals on:** the activity remembers the distance already covered at the old pace, and the new pace adds to it.
- The moving parts (belt, pedals) ease to the new speed instead of jumping.

**Tests:**

| ID | Checks |
| --- | --- |
| V4B1-T1 | Mid-walk the menu offers Run and Stop; mid-ride it offers Sprint and Stop; mid-curl it offers only Stop |
| V4B1-T2 | Switching keeps the person on the machine (same spot, no step-off) and sets the new speed |
| V4B1-T3 | Time and distance carry on across a switch (e.g. 60 s walking + 60 s running = 2:00 and the sum of both distances) |
| V4B1-T4 | The pedals never jump: their angle is continuous across a switch from Easy to Sprint |

**Visual check:** the belt and the stride speed up smoothly when switching to Run, and the popup's numbers don't reset.

**Status: done** (2026-10-06, on branch `v4-smoother-play`). 42 tests passing (4 new: V4B1-T1..T4), each checked to fail
when the behaviour it guards is broken. The switch buttons live in the exercise popup (**Run 1** next to **Stop Esc**), and
number keys pick them, because mid-exercise E means "stop". Two things needed fixing on the way: the pedal angle used to be
worked out from the start time, so it now carries on from where the pedals were; and the player treated any change to the
activity as "finished" and stepped off, so a step-off now only happens when the session really ends. Visual check in the
browser: Walk → Run kept the person on the same spot and the distance carried on (20.56 m → 20.84 m, not reset); Easy ride →
Sprint with the 1 key kept the feet on the pedals (ankle to pedal 5.1–5.9 cm before and after, which is the shoe sole plus
the pedal). The optional Android check has not been done.

**Summary:** You can change pace on the treadmill and the bike without getting off, and the time and distance keep counting.

### Block 2: Step on, then start

**What you'll see:** picking an exercise, the person steps onto the machine first, and only then do the handles, sled or bar
start moving with them. No more handles waiting in mid-air for half a second while the person is still walking over.

**How:**
- An exercise starts in a short **stepping on** phase. The machine stays in its resting position, and the person eases onto
  the spot.
- When the person arrives (within 2 cm of the spot), the exercise properly begins: the rep clock starts from that moment, so
  the first rep starts from the resting position.
- The machines already read the rep clock, so they all get this fix at once without changing each machine.

**Tests:**

| ID | Checks |
| --- | --- |
| V4B2-T1 | While stepping on, the rep clock hasn't started: reps = 0 and every machine reads "at rest" |
| V4B2-T2 | The exercise begins once the person is within 2 cm of the spot, and not before |
| V4B2-T3 | From the first frame after arriving, hands/feet are on their handles/pedals for every machine (reuses each machine's existing gap check) |
| V4B2-T4 | Stopping while still stepping on cancels cleanly: back to the start spot, machine at rest |

**Visual check:** on each machine, the person arrives first and the moving parts begin with them. The measured hand gap during
the step-on phase is gone (it was about 20 cm on the cable machine).

**Status: done** (2026-10-06, on branch `v4-smoother-play`). 46 tests passing (4 new: V4B2-T1..T4), each checked to fail
when the behaviour it guards is broken (the first try at T3 didn't catch a clock that wasn't restarted; it now checks the
arrival time itself). `Player` calls `stepOnto()` every frame; within 2 cm of the spot the exercise begins and the machine
wakes. Sessions now have an id, since the clock restarting on arrival can no longer tell one go from the next. Five earlier
tests started an exercise and checked the machine straight away; they now step onto the spot first, with their checks
unchanged. The plan's "machines need no change" was almost true: the cable machine's rope and V-handle rest somewhere other
than the hands' starting spot, so they now glide into the hands over the first 0.4 s (and back to rest after). Measured in
the browser on the cable machine: while stepping on, the rope stays at rest; on arrival it reaches the hands (36.9 cm → 2.8 cm
→ 0.1 cm over three frames) and stays within 0.2 cm. The optional Android check has not been done.

**Summary:** Exercises now start when the person arrives, so handles never wait in mid-air while they walk over.

### Block 3: Legs straddle the flat bench

**Why it overlaps (measured):** lying on the flat bench, the knees end up at the very end of the pad, about 1 cm above its top
and inside its width (10 cm out from the middle; the pad is 15 cm each side). So the thighs sink into the pad.

**What you'll see:** for the bench press, the person straddles the bench like a real lifter: thighs angled out to the sides,
feet planted wide on the floor either side of the bench. Nothing passes through the pad.

**How:**
- **New joint movement:** the hips can swing the legs out to the sides (so far they only swung forward and back). Like the
  arms' `shoulderZ`.
- The leg maths places each foot wide of the bench. The hips swing out first, then the knees bend to reach the floor.
- While I'm here, I'll check the other lying and seated poses (adjustable bench, shoulder press) for the same problem.

**Tests:**

| ID | Checks |
| --- | --- |
| V4B3-T1 | Bench press: the thighs and shins stay outside the pad, allowing for their thickness, through the whole rep |
| V4B3-T2 | The feet are flat on the floor, wider apart than the bench, and stay put through the rep |
| V4B3-T3 | Standing and walking legs are unchanged (no sideways swing when not on the bench) |

**Visual check:** from the side and from above, no leg passes through the bench pad.

**Summary:** Lying on the flat bench, the person now straddles it with their feet wide, so no leg passes through the pad.
That finishes v4.

---

## v5: Ready for phones and people

### Block 1: Remember the layout

**What you'll see:** move furniture around in build mode, reload the page, and everything is where you left it. A new
**Reset layout** button in build mode puts the gym back to its starting arrangement (it asks first).

**How:**
- After every move, rotate or reset, the layout is saved in this browser (per D2). On load it's read back.
- **Safe loading:** the saved data is checked before use. If it's damaged, from an older version, or names a machine that
  no longer exists, that part is ignored and the starting position is used. A bad save never breaks the gym.
- **New machines still appear:** if a future version adds a machine, it shows up at its starting spot even with an old save.
- Saving can fail (private browsing, storage full). The gym then just works without remembering, as it does today.

**Tests:**

| ID | Checks |
| --- | --- |
| V5B1-T1 | Save then load gives back the same layout (positions and rotations) |
| V5B1-T2 | Damaged or unreadable saved data falls back to the starting layout without an error |
| V5B1-T3 | A save missing a machine (one added later) still shows that machine at its starting spot |
| V5B1-T4 | Reset layout restores the starting arrangement and saves it |
| V5B1-T5 | When storage isn't available, moving furniture still works (nothing thrown) |

**Visual check:** move three machines, reload, they're still moved. Reset puts them back.

**Summary:** The gym now remembers where you put the furniture, even after a reload, and Reset layout puts it back.

### Block 2: A more human-looking person

**What you'll see:** a person with a real human shape (head, neck, shoulders, hands, proportions) in place of the capsules.
They move exactly like today's person on every machine, because they're driven by the same joint angles.

**How:**
- **Download (needs your OK, D4):** a free CC0 rigged human model. I'll find the file, then tell you its name, source and
  size and wait for your yes before downloading.
- **Driving the model with our maths:** each of our joints (hips, knees, ankles, shoulders, elbows, the lean) is mapped to
  the model's matching bone. The model's arm and leg lengths are measured, and our body measurements are matched to them so
  hands and feet still land on handles and pedals. That's why every earlier test stays meaningful.
- **The classic person stays** behind the existing look switch, as before with the Fitness Character. If the new model
  looks wrong somewhere, you can switch back in one line.
- The model is checked for size, since phones pay for every triangle (feeds into Block 3).

**Tests:**

| ID | Checks |
| --- | --- |
| V5B2-T1 | Every joint our poses use is mapped to a bone in the model (none missing) |
| V5B2-T2 | For every exercise, the model's hands and feet land within 3 cm of where the classic person's do |
| V5B2-T3 | The model's limb lengths match our body measurements within 2 cm |
| V5B2-T4 | All 38 earlier tests still pass |

**Visual check:** every machine, one by one: hands on handles, feet on pedals and plates, nothing bending the wrong way.

**Summary:** The person now looks human, moved by the same joint maths as before, so every machine still works.

### Block 3: Runs well on a phone

**What you'll see:** the gym running smoothly on your Android phone with all 12 machines. A small speed readout (frames per
second) can be turned on by adding `?perf` to the address.

**How:**
- **Measure first** on your phone (per D3), with the readout on: standing still, walking around, and using a machine.
  **Target:** at least 30 frames per second on your phone.
- **Fix only what the measurement shows.** Likely suspects, from what's in the scene today:
  - 39 objects cast shadows, with a 2048 × 2048 shadow map;
  - 6 area lights, which are costly on phone graphics chips;
  - the screen's pixel density, currently allowed up to 2×.
- **Automatic quality step-down:** if the speed stays under 30 fps for a few seconds, the app lowers quality on its own
  (shadow detail first, then pixel density) and tells you in the readout.

**Tests:**

| ID | Checks |
| --- | --- |
| V5B3-T1 | Quality steps down only after a sustained slowdown (not one slow frame), and never below the lowest level |
| V5B3-T2 | Each step-down lowers the settings in the planned order (shadows, then pixel density) |
| V5B3-T3 | Without `?perf` the readout doesn't appear |
| V5B3-T4 | **On your Android phone** (required here, unlike other blocks): ≥ 30 fps walking around and using a machine, with the numbers written into this plan |

**Visual check:** on the phone, walk around and use at least three machines. Movement is smooth, and touch controls and menus
work.

**Summary:** The gym is measured and tuned on a real phone, with a speed readout and automatic quality step-down, so it stays
smooth with all 12 machines. That finishes v5 and the backlog.

---

## Not in this plan

- New machines or exercises.
- Putting the gym online for good (a public link). That fits naturally after v5, once it's phone-ready (see D3).
- Saving layouts to an account or sharing them between devices.
