# Amygo: train with your partner (v10)

v10 is **P1 from the app roadmap** ([PLAN-app.md](PLAN-app.md)), written out as a version. It gives a set a **target**,
puts **rest** between sets, and moves the controls into a **workout card** under your thumb on the Gym tab. After v10
the person in the gym is a training partner: tap Start once, and they do your 12 reps at your tempo, rest with you,
and step back on for set 2 by themselves.

Why this is the version after v9: v9 gives sets a weight, so "3 × 12 at 10 kg" means something. Routines (N2) come
after v10, because a routine without targets and rest would only be a list.

What it builds on:

- **The rep clock** (`src/interaction/reps.ts`): every rep the person and the machines make is worked out from the
  set's start time and one number, `REP_SECONDS` (2.4). A target of 12 reps is therefore a moment in time, and the tempo
  setting is that one number.
- **`stepOnto()`** (`gymStore.ts`): the set truly begins when the person reaches the machine, and `startedAt` is reset
  to that moment. The end of a targeted set is counted from there, so stepping on never eats into the reps.
- **Every way a set ends goes through `stopExercise()`**, and v7's watcher saves the set from there. A set that ends
  by itself ends the same way, so nothing about saving changes.
- **v9's weight** (`kg` on the activity and the set) and its − / + stepper on the Exercises row, reused for targets.
- **The paused gym**: the render loop is off on every tab but Gym (`frameloopFor`), so anything timed in v10 runs on
  timers, never on frames.

## How this plan works

Same rules as before:

- **3 features per version, one feature per block.**
- **Each block has a test phase** (Vitest, each test checked to fail when the thing it guards is broken) that must pass
  before the next block starts. The Android check stays **optional** and is never marked passed unless done on the
  phone. Block 2's buzz can only be felt on the phone, so its phone check is worth doing.
- **Each block ends with a 1–3 sentence summary.**
- **We stop after every block** and wait for your yes. A yes to this plan is not a yes to start building.
- v10 gets its own branch off `master` (`v10-train-with-partner`). Each finished block is fast-forwarded into `master`
  and pushed with your OK at that moment (the v8 D8 order), so the link updates block by block.

## Where it sits

After **v9** is on the link (its branch `v9-log-you-keep` is being built now in `gym3d-v6`). v10 Block 1 changes the
Exercises row that v9 Block 2 changes, and Block 3 changes the Today page that v9 Block 3 changes, so building them at
the same time would mean resolving the same files twice.

**N1** (the icon footer, Progress, Settings) is on its own branch and may land before or after v10. v10 doesn't wait
for it: see V10-D1 for where the settings live until N1's Settings tab exists.

## The starting point (measured 2026-10-08, `master` at `9d5f01a`)

| Measure | Now |
| --- | --- |
| Tests | 142 passing, in 33 files (see the note below the table) |
| Shell code (compressed), budget 60 KB | 14.7 KB |
| A set | Runs until Stop; "12 reps" means twelve rep clocks went by; no set count, no rest |
| Tempo | One constant, `REP_SECONDS = 2.4`, read by the person and four machine models |
| Where the controls are | A popup over the person's head on Gym (`ActivityBubble.tsx`), a "Doing…" line in the header, a card at the top of Exercises (`NowDoing.tsx`); Finish on all three |
| Timers that survive a tab switch | None: the only per-frame hook (`stepOnto`) stops when the gym isn't drawn |
| Sound and vibration | None in the app |
| Live link | amygo.vercel.app, serving `master` (v8 complete) |

Note on the tests: with three sessions building in this repo at once, a full run on the laptop took over seven minutes,
and the first run showed 13 failures and 10 skipped tests from timeouts; the second run, with less going on, passed all
142. Timing tests (the 50 ms grouping test, the build in the load-order test) are the ones that give way under load, so
a block's test phase counts only a run that passes on a quiet laptop.

**Facts from the code that shape this plan:**
- **A set's end is a time, not a count.** Reps = ⌊(now − startedAt) ÷ tempo⌋, so "ends at 12" means a timer set for
  startedAt + 12 × tempo. A `setTimeout` from the moment the set begins (`stepOnto`, or at once when started from the
  list) ends it exactly, on any tab, with the render loop off.
- **The tempo must be fixed per set.** If the setting changed mid-set, the rep count would jump. So the activity carries
  its own `repSeconds`, copied from the setting when the set begins; the machines read it from `machineState`, as they
  read `startedAt` today.
- **The joystick sits 24 px from the bottom of the gym** (`.joystick` in `index.css`), where the workout card goes. One
  CSS variable for the card's height moves it up.
- **Sound needs a tap first.** Browsers only let a page make sound after the person has tapped something. Start is a
  tap, so the first beep's `AudioContext` is created there.
- **Vibration is Android-only on the web** (`navigator.vibrate`); on a desktop or an iPhone it's missing, so the code
  checks for it and does nothing.

## The order, and why

| Block | Feature | What it gives you |
| --- | --- | --- |
| 1 | Sets with a target | "3 × 12 · 10 kg · Start"; the partner does 12 and the set saves itself |
| 2 | Rest, then the next set | A countdown, a beep and a buzz, the partner resting, set 2 starting by itself |
| 3 | The workout card | Everything under your thumb on the Gym tab, and a strip on the other tabs |

- **Targets first** because rest only makes sense between sets that end.
- **Rest second** because the card has to show it.
- **The card last** so it's built once, from the finished state, instead of being reworked twice.

## Decisions (V10-D1 to D4 decided 2026-10-08, all as recommended)

P-D1 to P-D6 in [PLAN-app.md](PLAN-app.md) were decided on 2026-10-07 (the partner paces; one tempo setting Slow 3.5 ·
Normal 2.4 · Fast 1.8; targets 1–50 reps or 1–60 min, sets 1–10, default 3 × 12; rest 90 s strength / 60 s cardio with
a beep and a buzz; a resting pose; the card on phones, the popup kept on desktop). Four more are specific to building it:

| # | Question | Decision |
| --- | --- | --- |
| V10-D1 | **Where the settings live** (tempo, rest lengths, beep, buzz) until N1's Settings tab is on `master`: a **Workout settings** section at the bottom of the Exercises page, saved under `gym3d.settings` (the key N1 planned). When N1 lands, the section moves to the Settings tab unchanged. | **Yes.** The store and its tests are the same either way; only the page it's shown on moves. If N1 Block 3 is on `master` before v10 Block 1 starts, the section goes straight onto the Settings tab. |
| V10-D2 | **After the last set:** the card shows "3 sets done" with **Again** (one more set, same target) and **Finish**. No rest countdown after the last set. | **Yes.** The exercise is done; rest before the *next exercise* is the person's own call (Routines, N2, will add rest between exercises). |
| V10-D3 | **Desktop keys:** **Space** = Done during a set and Skip during rest; **Esc** keeps meaning Stop. Numbers 1–9 keep picking paces. | **Yes.** One key for "move on" is what a keyboard needs; Esc already means "stop everything". |
| V10-D4 | **A set ended early by walking away** (moving the person off the machine mid-set) counts as Done: it's saved with the reps done, and the rest countdown still starts, as if Done was tapped. | **Yes.** Today walking away already saves the set (v7). Treating it as Done keeps one rule: a set that ends for any reason leads to rest, unless it was the last. |

---

## v10: Train with your partner

### Block 1: Sets with a target

**What you'll see:** on the Exercises list each strength row reads **3 × 12 · 10 kg · Start**; each cardio row **1 ×
10 min · Start**. The sets and reps (or minutes) are − / + steppers like the weight, and are remembered per exercise.
Tap Start: the partner steps on and does **exactly 12 reps**; the popup and the header count "7 of 12"; at 12 the set
ends by itself and is saved. **Done** ends it early and saves the reps so far. Cardio ends at the target minutes. A
**Workout settings** section (V10-D1) offers the tempo: Slow · Normal · Fast. Rest and set counting come in Block 2:
after a set in Block 1, the card just says "Set 1 of 3 done" with **Next set** and **Finish**.

**How:**
- **Targets** (`src/exercises/targets.ts`): `targetFor(kind)` → `{ sets, reps }` or `{ sets, minutes }`, with ranges
  per exercise type (`load` in the catalog says strength or cardio); saved under `gym3d.targets` through `storage()`.
  The row's steppers share the v9 weight stepper component.
- **Settings** (`src/settings/settings.ts`): `{ tempo: 'slow' | 'normal' | 'fast', rest: { strength, cardio }, beep,
  buzz }` under `gym3d.settings`, with the same safe read (bad values fall back to the defaults). Block 1 uses `tempo`.
- **The activity carries its target and tempo:** `target`, `set` (1-based) and `repSeconds` on `Activity`, set in
  `startExercise`. `repsDone`, `repProgress` and `machineState` read `repSeconds` from the activity instead of the
  constant; `reps.ts` keeps `REP_SECONDS` as the default.
- **Ending by itself** (`src/workout/ending.ts`): when a set begins (`stepOnto`, or `placed` starts), a timer is set
  for `startedAt + reps × repSeconds` (or `minutes × 60`); it calls `stopExercise()`. Stop, Done, a pace change or a
  new exercise clears it. Done is `stopExercise()` under a new name on the buttons.
- **The counter text:** `progressText` says "7 of 12 reps" when there's a target, "7 reps done" when there isn't.

**Tests (`src/exercises/targets.test.ts`, `src/workout/ending.test.ts`, `src/settings/settings.test.ts`):**

| ID | Checks |
| --- | --- |
| V10B1-T1 | Targets are remembered per exercise, clamped to their ranges, and default to 3 × 12 (strength) or 1 × 10 min (cardio); a saved value that isn't valid falls back |
| V10B1-T2 | A set with target 12 ends by itself at exactly 12 reps (with fake timers) and is saved with 12; with no target it runs until Stop |
| V10B1-T3 | Done at 7 of 12 saves 7; a cardio target ends at the minutes with the matching distance; the end timer is cleared by Stop and by starting another exercise (no late stop) |
| V10B1-T4 | The end timer fires with the render loop off (no frame callbacks are needed) |
| V10B1-T5 | Tempo: each setting gives its seconds per rep; the activity keeps the tempo it started with when the setting changes mid-set; the machines' rep timing follows the activity's tempo |
| V10B1-T6 | Row text "3 × 12 · 10 kg" and "1 × 10 min"; counter "7 of 12 reps" with a target and "7 reps done" without |

**Visual check:** set Bicep curls to 1 × 8, Start, switch to the Today tab and wait: the set appears there by itself with
8 reps. Back on Gym the partner has stepped off. Set Fast tempo: the next set is visibly quicker.

**Summary:** A set now has a target, the partner does exactly that many reps at your tempo, and the set ends and saves
itself, even while you're on another tab.

**Status: done** (built 2026-10-14 on branch `v10-train-with-partner`; committed 2026-10-15). 172 tests passing (7 new:
V10B1-T1..T7; four older ones updated, see below). **Built:** `src/exercises/targets.ts` (the targets, saved under
`gym3d.targets`), `src/settings/settings.ts` (the tempo, saved under `gym3d.settings`), `src/workout/ending.ts` (the
timer that ends a set), `TargetPicker.tsx` with `targetOpen.ts` and `said.ts`, and `WorkoutSettings.tsx` in the shell;
`target`, `set` and `repSeconds` on the activity, `endsAt()`, the pause between sets, `finishExercise()`, `tapDone()`
and `tapNextSet()` in `gymStore.ts`. Shell: 19.6 → 22.0 KB (budget 60).

**Changed from this plan, or added to it:**
- **Every Start has a target,** from the list and from a machine's own menu in the gym. "No target" is still handled
  (the counter says "7 reps done" and nothing ends the set), but nothing in the app starts one now.
- **Cardio is what moves at a speed** (treadmill, bike, rower), not "has no weight": pull-ups have no weight and are
  counted in reps (3 × 12).
- **Minutes go by one up to 10, then by five** (15, 20 … 60), so a long run is a few taps.
- **The settings hold only the tempo for now.** Rest lengths, the beep and the buzz come with Block 2, which uses them.
  Saving keeps anything else stored under `gym3d.settings`, for the Settings tab's own choices (N1).
- **A set never goes past its target.** If its timer is held up (a phone asleep), it's saved as it would have ended:
  12 reps, 28.8 s, at the time of day of its twelfth rep.
- **A change of pace keeps the session's end:** walk 4 minutes, run the rest, and the treadmill stops at the 10 minutes
  set, with the walk and the run saved as two sets as before. The next set of the round carries on at the pace it
  ended on.
- **"Set 1 of 3 done" waits in the gym store** (not `rounds.ts`, which Block 2 adds for rest). It shows on the card,
  in the header and over the person in the gym. Next set keeps the round's target and re-reads the weight, so the
  weight can change between sets but the target can't: while a round goes on its target button shows the round's
  target and says why its − and + are off ("Kept for this round. Change it after Finish.").
- **Done and Finish:** Done ends the set (and, with sets to come, the round waits); Finish ends the round. Esc, E
  mid-set, a machine's menu's Stop and going into build mode mean Finish; walking away means Done (V10-D4). A set with
  no rep yet (or under 10 s of cardio) isn't one of the round's sets. On the last set Done is all there is, so it shows
  Esc. Picking up the floor dumbbell between sets ends the round.
- **On a phone every Exercises row is laid out the same way:** the name and History, then the target, the weight and
  Start. On the narrowest phones (under 360 px) the target takes a line of its own on rows with a weight. Open, the
  target's steppers take a line under the row.
- **Four older tests follow the new behaviour:** V7B1-T1 expects 28.8 s (twelve is the target), V6B1-T4 and V6B1-T6
  the new counter text ("of 10:00", "0 of 12 reps"), and V9B2-T7 the shared stepper and the new phone layout.

**A review** (3 angles, one skeptic per finding; 20 findings): 16 held, several the same thing seen twice, all fixed:
- **A tap could do two things.** Done and Next set take each other's place, so a double tap on Next set ended set 2 at
  once, and a Done just as the set ended by itself started the next one. A tap within 0.6 s of the swap is ignored, as
  Remove and Undo do.
- **A cardio round ended** when the pace changed in the last 10 s of a set: the part before the change counts now.
- **A late set got the late time of day** (it could land on the next day): it gets the time it ended, as above.
- **Between sets the floor dumbbell could be picked up,** two popups overlapped and Next set did nothing: picking it up
  ends the round.
- **Focus:** when the card changed under the cursor (a set ending by itself), the cursor was left on a button that had
  become Finish. Buttons keep their identity now, and the cursor goes on to the new card's next step, or to the page's
  title when the card goes.
- **On a phone the popup was wider than the screen** with Finish added: its buttons go under its words there. The header
  line stays one line (it wrapped and made the gym jump).
- **Smaller:** the target button's spoken name starts with what it shows ("3 × 12: target for Bicep curls, 3 sets of 12
  reps"), so it can be tapped by voice; a locked target says why; the gym's popups can't be reached with Tab from
  another tab.

Four were turned down as choices, not faults: Next set carrying on at the last pace, no key for Next set (Space comes
in Block 3), Finish being the highlighted button, and a set with no rep not counting.

**Red-checks:** 117 deliberate breaks, one at a time; every one made a test fail. (The first run caught 115: two tests
were added for the two it missed, a saved number of sets above 10, and a set that ends late.)

**Visual check:** done on the laptop at 320 px, 360 px and 1100 px. The rows and the editor fit with nothing overlapping;
1 × 2 Bicep curls at Fast ended by itself on the Today tab and was saved with 2 reps in 3.6 s; a 2-set round showed
"Set 1 of 2 done", Next set ran set 2, and the card went after it; the cursor moved on after Done, after Next set and
when a set ended by itself. In the gym: 2 × 6 curls at Fast counted "Set 1 of 2 · 2 of 6 reps" over the person, ended by
itself, the person stepped back off the rack with "Set 1 of 2 done · Next set · Finish" over them, Next set put them back
on for "Set 2 of 2" (Done with Esc), and Esc finished it. At 360 px the popup's buttons sit under its words, inside the
screen, and the header line stays one line. The Android check is optional and not done.

### Block 2: Rest, then the next set

**What you'll see:** when a set ends and more sets remain, the popup (and the header line) turns into **Rest · 1:30 ·
set 2 of 3 next**, with **+30 s**, **Skip** and **Finish**. The partner steps off and rests beside the machine, hands on
hips, breathing. At zero: a short beep and a buzz, and the partner steps back on for set 2 with the same weight and
target. After the last set: "3 sets done" with **Again** and **Finish** (V10-D2). Rest lengths, the beep and the buzz
are in Workout settings.

**How:**
- **Rounds** (`src/workout/rounds.ts`): a small store, `{ resting: { kind, machineId, set, of, kg, until } | null }`.
  When a targeted set ends before its last set, `stopExercise()` hands over to `startRest()`, which sets `until` and a
  timer; at `until` it starts the next set with `startFromList`-style placement on the same machine (the person is still
  beside it) and `set + 1`. +30 s moves `until` and resets the timer; Skip calls the start now; Finish clears everything.
- **Walking away mid-set** (V10-D4) goes through the same path, because it already goes through `stopExercise()`.
- **The resting pose:** one new pose in `poseMath.ts` (hands on hips, a slow breathing sway) used by `Person` while
  `resting` names this machine; the person stands at `returnTo` as after any stop. Nothing new for the machines.
- **Cues** (`src/workout/cues.ts`): `beep()` makes a 150 ms sine tone with an `AudioContext` created on the first Start
  tap and reused; `buzz()` calls `navigator.vibrate(200)` if it exists. Each checks its setting first. Both are called
  once, at `until`.
- **Counting on other tabs:** the countdown text comes from `until − now`, read by the shared minute-and-second clock
  (`shell/clock.ts` gets a one-second tick while resting), so it's right on any tab after any pause.

**Tests (`src/workout/rounds.test.ts`, `src/workout/cues.test.ts`):**

| ID | Checks |
| --- | --- |
| V10B2-T1 | After set 1 of 3, rest begins with the configured length (90 s strength, 60 s cardio) and at zero set 2 starts on the same machine with the same kg and target |
| V10B2-T2 | +30 s extends `until` by 30 s and the next set starts later; Skip starts it now; Finish ends the exercise with no further set and no rest |
| V10B2-T3 | After the last set there's no rest; Again starts one more set with the same target; a set with no target never rests |
| V10B2-T4 | Walking away mid-set (an activity ending with reps done) leads to rest like Done |
| V10B2-T5 | The cues fire once at zero; not when switched off; with no `vibrate` nothing throws; the `AudioContext` is created once |
| V10B2-T6 | The rest timer and the next set work with the render loop off, and the countdown text is right after a simulated 40 s pause |
| V10B2-T7 | The resting pose is used only while resting at that machine; walking cancels rest and the pose |

**Visual check:** 3 × 5 Bicep curls at Fast: watch the partner do 5, step off and rest with hands on hips, then at the
beep step back on. **Phone check (worth doing):** the buzz at zero, and that the beep plays with the phone's volume up.

**Summary:** Sets come in rounds: rest between them with a countdown, a beep and a buzz, the partner resting alongside,
and the next set starting by itself.

**Status: done** (built and committed 2026-10-15 on branch `v10-train-with-partner`). 180 tests passing (8 new:
V10B2-T1..T7, with T7 also checked on the 3D model in `human.test.ts`; two older ones updated, see below). **Built:**
`src/workout/rounds.ts` (the rest's timer, which cues and starts the next set), `src/workout/cues.ts` (the beep and
the buzz), `src/player/walkAway.ts` (when walking counts as walking away), `src/lib/ticking.ts` (the clock for
anything that counts on screen); the rest, `again()`, `moreRest()` and the tap pause for every button in
`gymStore.ts`; `restingPose()` in `poseMath.ts`; rest lengths and the cue switches in the settings and the Workout
settings section. Shell: 22.0 → 23.4 KB (budget 60).

**Changed from this plan, or added to it:**
- **Walking about during a rest doesn't end it** (your choice, 2026-10-15: the plan's V10-D4 and T7 disagreed). The
  countdown carries on and at zero the partner goes back onto the machine; Finish or Esc ends the round. Walking away
  mid-set is still Done (V10-D4). A stick that's already held when a set begins (the next set starting under someone
  walking about) doesn't count as walking away until it's let go once.
- **The rest lives in the gym store** (`between`, which Block 1 added for "Set 1 of 3 done"), not a store of its own:
  `until` is when it ends, or null after the last set ("3 sets done"). `rounds.ts` is only its timer.
- **The rest lengths go from 15 s to 5 minutes in steps of 15 s.** +30 s adds to the rest (from now, if its end has
  passed), up to 10 minutes from now.
- **Again** after the last set is one more set with the same target, counted as the round's next ("Set 4 of 4").
  A round of one set (cardio's 1 × 10 minutes) ends with "1 set done", Again and Finish.
- **The next set goes on the machine the round is on**, wherever the person has wandered (the plan said the same
  machine; picking the nearest one would have moved it).
- **The sound is made ready on the tap that starts a set**, and only once the page has been tapped at all (before
  that, browsers refuse both sound and buzzing, and say so in their console). Switching Beep on is a tap too, so the
  rest going on beeps.
- **The countdown is hidden from screen readers**, which hear "Resting 1:30 before set 2 of 3" once instead (and
  again with the new length after +30 s), rather than every second.
- **No `shell/clock.ts` tick:** the card, the header and the popup each count with `useTicking`, reading the clock on
  every tick, so the countdown is right after any pause.
- **Two older tests follow the new behaviour:** V10B1-T7 (the rest's words and buttons where "Set 1 of 3 done" was,
  and "3 sets done" after the last set) and V10B1-T5 (the settings hold more than the tempo now). V10B1-T2 and T3 count
  the rest's timer.

**A review** (3 angles, one skeptic per finding; 18 findings): 14 held, several the same thing seen two or three
times, all fixed:
- **Walking as the rest ran out ended the round:** set 2 started, and the next frame took the held stick for walking
  away from it, with no rep done. The rule about a held stick above fixed it.
- **Finish had no tap pause, and Skip now sits where Finish appears:** a double tap on Skip could end set 2 at once and
  the round. Every button on the card and the popup waits out the 0.6 s now, pace buttons included (Walk and Run swap
  in place); Esc, a key, still works at once.
- **The hands-on-hips pose put the model's hands into its hips:** the hands now rest at the waist's sides, a little
  behind, checked on the model itself.
- **Smaller:** the countdown began at 1:31 for a moment; switching Beep on mid-rest left that rest silent; +30 s gave
  screen readers no word; two behaviours had no test (Again's tap pause, +30 s after the end has passed).

Four were turned down: the rest buttons' names (the plan's own words), a sleeping phone's clock (not shown to be a
fault), resuming a sound an iPhone interrupted (iOS isn't a test device), and no buzz while the app is hidden (the
plan leaves notifications out).

**Red-checks:** 75 deliberate breaks, one at a time; every one made a test fail. (The first run caught 73: two checks
were added for the two it missed, a saved strength rest read back, and the breath's length.)

**Visual check:** done on the laptop: 3 × 5 Bicep curls at Fast with a 15 s rest, watched in the gym. Set 1 ended by
itself, the person stepped back off the rack with "Rest · 0:10 · set 2 of 3 next · +30 s · Skip · Finish" over them,
and at zero stepped back on for set 2; after set 3, "3 sets done · Again · Finish", and Again ran "Set 4 of 4". With a
1-minute rest the person stood with hands on hips (seen close up on the model), walked about with the rest still
counting, and was back at the rack for set 2 at zero. The Workout settings section and the rest card fit a 360 px
screen. **Not checked here:** the beep and the buzz themselves (the laptop's browser pane can't be heard, and has no
buzz): that's the phone check, which is optional and not done.

### Block 3: The workout card

**What you'll see:** on a phone, a card across the bottom of the Gym tab, above the tab bar: **Bicep curls · set 2 of
3**, **7 / 12 reps** (or **Rest 1:12**), **10 kg**, and the buttons (**Done** or **Skip** and **+30 s**, **Change**,
**Finish**). The popup over the person's head is gone on phones; on a desktop it stays and the card isn't shown
(P-D6). On every other tab a one-line strip above the tab bar shows the same words; tapping it opens the Gym tab.
**Change** opens the Exercises list scrolled to the current exercise. With nothing in progress there's no card and no
strip, and the joystick is back in its corner.

**How:**
- **One component,** `src/shell/WorkoutCard.tsx`, with a `strip` variant, fed by the gym store and `rounds.ts`. Its
  words come from the same text functions as the popup and the log, so nothing can disagree.
- **It replaces three things:** the header's "Doing…" line, `NowDoing` on the Exercises page, and (on phones) the
  popup. `ActivityBubble` stays for `(hover: hover)` wide screens only.
- **The joystick moves up** by the card's height through one CSS variable set on `.app` while the card is shown.
- **Change** switches to the Exercises tab and scrolls the current row into view (`scrollIntoView` on the row's id);
  **Finish** and **Done** are the same actions as before.
- **Keys** (V10-D3): Space = Done or Skip; Esc = Stop; handled where the gym's keys are handled, so they work only on
  the Gym tab, like today.

**Tests (`src/shell/workoutCard.test.ts`):**

| ID | Checks |
| --- | --- |
| V10B3-T1 | The card shows the exercise, set x of y, reps / target or the rest countdown, and the weight, from the same text functions as the popup and the log |
| V10B3-T2 | The card's buttons call the same actions as the popup (Done, Skip, +30 s, Finish); Change opens the list on the current row |
| V10B3-T3 | On other tabs the strip shows the one-line state and tapping it opens the Gym tab |
| V10B3-T4 | With nothing in progress there's no card and no strip, and the joystick's offset is zero |
| V10B3-T5 | The header's "Doing…" line and `NowDoing` are gone, and the status text appears exactly once on any tab |
| V10B3-T6 | Space means Done during a set and Skip during rest, only on the Gym tab; Esc still stops |

**Visual check:** at 360 px, a full set with rest, run from the card without leaving the Gym tab; the joystick sits above
the card; on the desktop the popup is as before. The shell stays under budget (expected under 20 KB).

**Summary:** A workout card under your thumb on the Gym tab, and a strip of it on every other tab, so a whole workout can
be run without leaving the gym. That finishes v10.

**Status: done** (built and committed 2026-10-15 on branch `v10-train-with-partner`). 186 tests passing (6 new:
V10B3-T1..T6; six older ones updated, see below). **Built:** `src/shell/WorkoutCard.tsx` (the card, and the strip as
its other form), `src/shell/touchScreen.ts` (is the main pointer a finger?), `src/shell/cardHeight.ts` (the card's
height for the joystick), `src/shell/rowInView.ts` (Change's row), the card's words (`cardWords`, `stripText`,
`cardKey`) from the popup's own measure in `activityText.ts`, Space in the gym's keys. `NowDoing.tsx` and the header's
"Doing…" line are gone. Shell: 23.4 → 24.3 KB (budget 60; the plan's guess of "under 20" was made before Blocks 1–2
came out bigger).

**Changed from this plan, or added to it:**
- **A phone is a finger, not a width:** the card shows where the main pointer is a finger, `(pointer: coarse)`, the
  same test the joystick has always used; with a mouse the popup stays, on any width.
- **Done and Finish are on every set's card** (and in the popup). Since Block 2, Done after the last set leads to "3
  sets done" (with Again) and Finish doesn't, so on the last set they differ. Change is on every card.
- **The strip shows on the other tabs with a mouse too**, since the header's line is gone everywhere.
- **Change brings the row to the middle of the list** and puts the cursor on its History button; the set or the rest
  carries on.
- **A phone on its side** gets a smaller card on the right of the gym, and the joystick stays in its corner. Everywhere
  else the joystick is lifted by the card's height, but never out of the gym's area.
- **The card is the same height whatever it shows** (one line for each line, one row of buttons sharing the width), so
  the joystick doesn't move under the thumb when a set gives way to the rest.
- **The update note ("A new version… Reload") waits while a round is on**, rest included: a reload loses the round.
- **Six older tests follow the new card:** V10B1-T7 and V10B2-T6 read the card and the strip where they read the old
  card and the header's line; V10B2-T2 counts one Finish on the card; V7B3-T5 and V9B2-T7 no longer find the card on an
  exercise's page (the strip shows it, above the tabs); V10B1-T7's last set has both Done and Finish.

**A review** (3 angles, one skeptic per finding; 21 findings): 19 held, several the same thing seen twice, all fixed:
- **Space didn't work after a mouse click** on a button (the Gym tab, +30 s, the "?"), which kept it: it did nothing,
  added 30 s, or opened the welcome card. A button a click merely left the cursor on gives Space up now (and lets go of
  the cursor); a field, or a button the keyboard took you to, keeps it.
- **Space had no pause** though its meaning changes (Done, then Skip): pressed as the rest ran out, it ended the new set
  with no rep and lost the round. It waits out the 0.6 s now, as a tap does. (Esc, which always means the same, doesn't.)
- **Change had no pause**, and takes Skip's and Finish's places from one card to the next: a double tap on Skip could
  open the list. It waits now, as every other button does.
- **The strip cut off the count** (the part that changes) for longer names on a 360 px phone: the name gives way now.
- **A phone on its side:** the card covered the gym and lifted the joystick over the header (above).
- **Screen readers:** nothing was said on the other tabs as a set ended or a rest began (the old card had said it); the
  strip now has the card's status line beside it, kept there even when empty so the first words are heard. Tapping the
  strip lost the cursor (it goes to the card's next step now); a change of pace lost it too (pace buttons keep their
  place now).
- **The card grew between a set and a rest,** which jumped the joystick under the thumb (above).
- **Tests that couldn't fail:** the joystick's lift, Change's row, the status line's place, the cursor's rule and Space
  on a button were checked only by reading the code; they're checked by running it now (`cardHeight.ts`,
  `rowInView.ts`, `cardKey`, and stand-ins for a focused field or button).

Two were turned down: the popup over the person can't be seen by the "exactly once" test (it's drawn by the 3D scene,
which the tests don't draw), and the update note's check reads the code where a running check was possible (it's
one plain line).

**Red-checks:** 64 deliberate breaks, one at a time; every one made a test fail. (The first run caught 62: a check was
added for the two it missed, the card never counting past its target, in reps and in a cardio set's minutes.)

**Visual check:** done on the laptop, in the browser pane set to a phone (a finger as the main pointer):
- At 375 × 812 and 360 × 740: the card across the bottom of the gym, with the joystick lifted onto it and back down when
  the card went.
- The card is the same height for a set and a rest; four buttons fit one row at 360 px.
- Change opened Exercises with the curls row and then the squat row in view (the list scrolled to the squat row, the
  cursor on its History button).
- The strip on the other tabs (for "Lateral raises (side fly)", the name cut short and the count whole); tapping it went
  back to the gym.
- Space skipped a rest.
- On its side (740 × 360): the card on the right, the joystick in its corner, the gym between.
- With a mouse (800 × 600): no card, the popup over the person with "Skip Space" and "Finish Esc".

The 3D library's known `removeChild` console error (from v9, tracked separately) still appears when the popup goes;
nothing new appeared. The Android check is optional and not done.

**v10 in one line:** a set has a target, and the partner does exactly that many reps at your tempo, rests between sets
with a countdown, a beep and a buzz, and starts the next set by itself, all run from a card under your thumb.

---

## Not in this plan

- **Routines** (N2): a list of exercises run in order, with rest between exercises. v10 is one exercise at a time.
- **Workouts, records and the share card** (P2), **exercise pages, Show me and filters** (P3).
- **Tap-per-rep counting** (P-D1), or counting reps with the camera or sensors.
- **Per-exercise tempo**, supersets, drop sets.
- **Sound files, music, or voice cues.** The beep is made by the browser.
- **iPhone vibration** (not allowed on the web).
- **A rest countdown as a system notification** when the app is in the background. The beep and buzz happen when the
  app is open; a notification needs permission and its own version.
