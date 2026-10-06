# Gym 3D: app shell plan (v6)

The gym becomes the **Home** tab of a small app. A header on top, a footer tab bar at the bottom, and an **Exercises** tab
that lists everything the gym can do. Start an exercise from the list and the person in the gym does it; switch back to
Home and they're still at it, counting reps. No new machines, no backend, one repo.

Why one repo and not a separate app that embeds the gym: the list and the 3D person must share one piece of state (which
exercise, on which machine, since when). That state already lives in `src/interaction/gymStore.ts`, and the exercise
catalog is already a table there. A second project would need its own copy of both, or an iframe with two copies of
three.js. The restructure is small: a **shell** (header, footer, tabs), the **gym** (what exists today, already one
component), and **shared data** (the catalog and the store).

## How this plan works

Same rules as before:

- **3 features per version, one feature per block.**
- **Each block has a test phase** (Vitest, each test checked to fail when the thing it guards is broken) that must pass
  before the next block starts. The Android check stays **optional** and is never marked passed unless done on the phone.
- **Each block ends with a 1–3 sentence summary.**
- **We stop after every block** and wait for your yes. A yes to this plan is not a yes to start building.
- v6 gets its own branch off `master` (`v6-app-shell`), merged when you say so.

## Where it sits

After v5 (per D1 below). The v5 phone check is meant to measure the finished app, and the shell is part of that app, so
the phone numbers in v5 Block 3 should be re-checked once v6 Block 3 is done (optional, like every Android check).

## The starting point (measured 2026-10-06)

| Asset | Raw | Gzipped |
| --- | --- | --- |
| JS bundle (`dist/assets/index-*.js`) | 1.49 MB | 443 KB |
| Character model (`fitness-character.glb`) | 233 KB | 59 KB |

Nearly all of the JS is three.js. A header, footer and list add a few KB. So the size work in this version is about
**load order** (shell first, 3D after) and a **budget** that stops the shell from growing, not about shrinking three.js.

## The order, and why

| Block | Feature | What it gives you |
| --- | --- | --- |
| 1 | App shell | Header, footer tabs, and a gym that keeps running while another tab is in front |
| 2 | Exercises tab | The list, Start from the list, live counters, Finish |
| 3 | Load order and size budget | Shell paints first, 3D loads after, and a test that fails if the shell gets heavy |

- **The shell first** because Block 2 needs somewhere to put the list, and the "keep the gym mounted" rule is the one
  decision that decides performance. It has to be right before anything is built on it.
- **The list second** because it's the feature you asked for, and it only needs the store that already exists.
- **Size last** because the budget should measure the finished shell, not a half-built one.

## Decisions (decided 2026-10-06, all as recommended)

| # | Question | Decision |
| --- | --- | --- |
| D1 | Build v6 **after v5** (phone check measures the real app) or **before v5 Block 3**? | After v5 |
| D2 | Tabs in the footer: just **Home** and **Exercises** now, or a third tab too (for example **Today**, a log of sets)? | Two tabs now; a log is its own version |
| D3 | Starting from the list: the person **walks** to the machine (reuses the walk animation, takes a moment) or **appears** there? | Walks; if the way is blocked for over a second, they appear there instead |
| D4 | Header contents: the app name plus **what you're doing right now** ("Doing bicep curls · 12 reps") when an exercise is on. OK? | Yes, keep it that small |
| D5 | Size budget for the shell's own code, without three.js: **60 KB gzipped**. OK? | Yes (it's about ten times what the shell needs, so it only catches a real mistake) |

---

## v6: An app around the gym

### Block 1: App shell

**What you'll see:** a header across the top with the app name (and, per D4, what the person is doing). A footer with two
tabs, **Home** and **Exercises** (Exercises is an empty page until Block 2). The 3D gym fills the space between. Switch to
Exercises mid-curl, come back, and the person is still curling with the count carried on. On Home, nothing about how you
play changes: joystick, menus, build mode, all as today.

**How:**
- **A tab store** (the same tiny store pattern as the gym and build stores) holds which tab is open. No router library: a
  tab is one value, and the app only has a handful of pages.
- **The canvas stays mounted** when you leave Home. Unmounting it would throw away the WebGL context, the compiled shaders
  and the scene, and every return to Home would rebuild them (a visible stall on a phone). Instead, the gym's render loop is
  set to **never** while another tab is in front, so the GPU does nothing, and back to **always** on Home. The counters are
  worked out from the start time, so they're right when you return even though no frame was drawn in between.
- **Input is off while hidden:** keyboard walking, E, and the joystick are ignored when Home isn't the open tab, so a key
  pressed while reading the list doesn't walk the person into a wall. Leaving Home also leaves build mode.
- **The hint text** that sits in the top-left corner today moves into the header, so there's one bar instead of two.
- The hidden gym is kept at its size (not collapsed to zero), because resizing a canvas to nothing and back is a known
  source of blank screens.

**Tests:**

| ID | Checks |
| --- | --- |
| V6B1-T1 | Switching tabs and back leaves a running activity untouched (same kind, machine, start time) |
| V6B1-T2 | The render loop setting is `always` on Home and `never` on every other tab |
| V6B1-T3 | Walking keys and E do nothing while Home isn't open; they work again on return |
| V6B1-T4 | Thirty seconds hidden mid-walk adds thirty seconds and the matching distance to the counters |
| V6B1-T5 | Leaving Home while in build mode ends build mode (no drag left half-finished) |

**Visual check:** start curls, go to Exercises, wait, come back: the person is still curling and the count went up. On the
phone (optional) the tab switch is instant both ways.

**Status: done** (2026-10-07, on branch `v6-app-shell`, built in a separate folder `gym3d-v6` (a git worktree) because
another session had unsaved work in `gym3d`). 66 tests passing (6 new: V6B1-T1..T6), each checked to fail when the
behaviour it guards is broken. The tab state is `src/shell/tabStore.ts` (no imports, so the gym's input code can check it);
switching is `openTab()` in `src/shell/tabs.ts`. **Two bugs found in the browser and fixed:** the header showed "-10 reps
done" (its clock reading was older than the exercise's start; counts now never go below the start, V6B1-T6 added), and the
gym's floating popup showed through the Exercises page (pages now stack above the gym's popups). Measured in the browser: on
Exercises the gym's render loop is `never`, its clock didn't move in 10 s, the canvas kept its size (900 × 516); the
header's count went 5 → 9 reps meanwhile, and back on Home it was the same exercise with header and popup agreeing (17
reps). Checked at phone size too. The optional Android check has not been done.

**Summary:** The gym now sits inside an app with a header and footer tabs, and keeps running while you're on another tab.

### Block 2: Exercises tab

**What you'll see:** a list of every exercise, grouped by machine (Treadmill: Walk, Run; Dumbbell rack: Bicep curls,
Lateral raises; and so on, all 17). Machines not in your current layout are shown greyed with "Not in your gym". Each
exercise has a **Start** button. Tap Start on Bicep curls: the tab shows "Doing bicep curls · 3 reps" counting up, and if
you switch to Home the person is at the dumbbell rack doing them. **Finish** stops it. On the treadmill and bike, the list
also offers the other pace (Run, Sprint), the same as the in-gym menu.

**How:**
- **The catalog moves into its own file** (`src/exercises/catalog.ts`): names, which machine, the "doing" headline, and
  the pace settings. It has **no 3D imports**, so the list can load before three.js does (Block 3 relies on this). The gym
  store reads from it, so the in-gym menus and the list can never disagree.
- **Start from the list:** finds the nearest machine of the right type in the layout, sends the person there (per D3), and
  when they arrive calls the same start function the in-gym menu uses. So "start from the list" and "start at the machine"
  end in the same state, and every existing test about poses and machines still covers it.
- **Live counters** reuse the headline and progress text from `activityText.ts`, the same words as the popup in the gym.
- **Finish** calls the same stop as the in-gym menu, so the person steps off exactly as today.
- The list is plain HTML, not a 3D overlay: it scrolls, it's readable on a phone, and it costs nothing to draw.

**Tests:**

| ID | Checks |
| --- | --- |
| V6B2-T1 | The list has every exercise in the catalog, each under its own machine, none missing or doubled |
| V6B2-T2 | A machine that isn't in the layout is marked unavailable, and its Start does nothing |
| V6B2-T3 | Starting from the list ends in the same activity as starting at the machine: same kind, machine id, standing spot |
| V6B2-T4 | With two of the same machine, Start picks the one nearest the person |
| V6B2-T5 | Finish from the list leaves the same state as Stop from the in-gym menu |
| V6B2-T6 | The catalog file imports nothing from three.js or the 3D code |

**Visual check:** start three different exercises from the list (one dumbbell, one machine you sit on, one you stand at),
switch to Home each time: the person is on the right machine, and the list's count matches the popup's.

**Summary:** The Exercises tab lists everything the gym can do, and starting from it puts the person on the right machine
doing it, with the count shown on both tabs.

### Block 3: Load order and size budget

**What you'll see:** on a slow connection, the header, footer and the Exercises tab appear at once, with "Loading the gym…"
in the Home area, and the 3D fills in when it's ready. Nothing else changes.

**How:**
- **Two chunks:** three.js (with fiber and drei) gets its own file, and the gym scene is loaded **lazily**: the browser asks
  for it after the shell has painted. The shell's own chunk holds the header, footer, tab store, catalog and list.
- **A size budget** (per D5): a script reads the built files and fails the build if the shell chunk is over budget. It runs
  as part of `npm run build`, so a heavy import can't sneak in unnoticed.
- The character model keeps loading the way it does now (fetched when the gym chunk starts). Shrinking it with Draco
  compression is noted for later, since 59 KB gzipped isn't the problem today.
- Measured numbers go into this plan, before and after.

**Tests:**

| ID | Checks |
| --- | --- |
| V6B3-T1 | The build produces a separate three.js chunk, and the entry (shell) chunk doesn't contain three.js |
| V6B3-T2 | The shell chunk is under the budget; the check fails when the budget is set below its size (proving it works) |
| V6B3-T3 | The Home area shows the loading state until the gym chunk arrives, and the Exercises tab is usable meanwhile |
| V6B3-T4 | All earlier tests still pass |

**Visual check:** with the browser's network throttled to "Slow 3G", the header, footer and Exercises tab show first, the
gym follows. The total download is no bigger than before the version started.

**Summary:** The app paints its shell first and loads the 3D after, with a build-time budget that keeps the shell small.
That finishes v6.

---

## Not in this plan

- A log or history of sets (a **Today** tab; see D2). That is **v7**, planned separately in `PLAN-v7.md` and built right
  after v6. It needs the saving work from v5 Block 1 and the Exercises tab from v6 Block 2.
- Accounts, sharing, or anything sent to a server.
- New machines or exercises.
- Shrinking three.js itself, or the character model. Measured first in v5 Block 3; only worth doing if the phone numbers
  say so.
