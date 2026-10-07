# Amygo: the app side, with a 3D partner (roadmap, P1–P3)

Amygo today is a 3D gym with a thin app around it: an Exercises list that puts the person on a machine, a Today page
that saves what they did, and a public link. This plan is about the **app side** (the pages, the cards, the flow of a
workout), not the 3D. Its goal in one line:

> **Amygo is a gym app you'd actually train with, and the person in the gym is your training partner: they do every set
> with you, pace you, rest with you, show you a move you don't know, and celebrate your records.**

Today the person is a mirror: they start when you tap Start and stop when you tap Finish, and "12 reps" means 12 rep
clocks went by. A real gym app works in **sets with a target** ("3 × 12 at 10 kg"), with **rest between sets**, inside a
**workout** that has a beginning, an end and a summary. None of that exists yet, and it's what turns the pages from a log
into an app. The partner idea runs through all of it: the person in the gym is always doing what the card on your phone
says.

## What exists and what's already planned

| Version | Status (2026-10-07) | What it gives the app side |
| --- | --- | --- |
| v6 | On the link | Header, tab bar, Exercises tab, the gym kept mounted and paused on other tabs |
| v7 | On the link | Today, history by day, history by exercise (`src/log/`) |
| v8 | B1–B2 live, B3 built | Amygo name, welcome card, offline, install |
| v9 | Drafted, `PLAN-v9.md` | Back up and restore, **weights in kg**, edit a set and undo |
| N1 | B1 built (`gym3d-tabs`) | Icon tab bar, **Progress**, **Settings** (`PLAN-tabs.md`) |
| N2 | Sketched in `PLAN-tabs.md` | **Routines**: make, run, in the log |

So weights, progress, settings and routines are already spoken for. This plan **doesn't redo them**. It adds the three
versions that are missing between them, and says in what order all of it should land.

## The gaps, and the versions that fill them

| Gap | Why it matters | Version |
| --- | --- | --- |
| A set has no target and no end: it runs until you stop it | You can't say "12 reps", and the partner can't pace you | **P1 Block 1** |
| No rest between sets, no set count | Real training is 3 × 12 with 90 s between; the partner should rest with you | **P1 Block 2** |
| The controls are a popup over the person's head, or on another tab | Mid-set, with a phone in one hand, the buttons must be under your thumb on the Gym tab | **P1 Block 3** |
| No workout: sets are loose, there's no "done for today" | A session with a start, an end and a summary is what people come back for | **P2 Block 1** |
| Records go unnoticed | A new best is the moment a gym app earns its keep; the partner should mark it | **P2 Block 2** |
| Nothing to show anyone | A picture of today's workout to send to a friend | **P2 Block 3** |
| An exercise is a name and a Start button | New users don't know what "Cable rows" is or which muscles it works | **P3 Block 1** |
| The partner can't teach | "Show me" with the camera on the machine is what a 3D partner is for | **P3 Block 2** |
| 17 exercises in one list, no way to narrow it | Filtering by muscle, and hiding machines that aren't in your gym | **P3 Block 3** |

P stands for partner. Each is three features, one per block, with the usual rules.

## The order across everything

1. **v8 Block 3** (install) lands, finishing v8.
2. **N1 Blocks 2–3** (Progress, Settings), already under way in `gym3d-tabs`.
3. **v9** (backup, weights, edit). Weights must exist before targets ("12 at 10 kg") mean anything.
4. **P1 Train with your partner.** The core loop. Routines without targets and rest would be half a feature, so P1 goes
   before N2.
5. **N2 Routines**, planned in detail then. Its open question ("does each step have a target that moves on by itself?")
   is answered by P1: yes.
6. **P2 A workout, not just sets.**
7. **P3 Learn from your partner.**

One version at a time on the shared `master`, each block merged and pushed with your OK, as v8 and N1 do. Two versions
at once (as v8 and N1 are now) is workable only while they touch different files; P1 touches the gym store, the popup
and the Today page, so it waits for v9 and N1 to be in.

## Rules that hold for all three versions

- **No new packages.** The shell is 14–15 KB compressed against a 60 KB budget; P1–P3 together should stay under 30 KB.
- **No 3D work beyond poses the person already has**, except the two small additions named below (a resting pose in P1,
  a "well done" pose in P2). The camera moves in P3 use the controls that exist.
- **Nothing sent anywhere.** Sounds are made by the browser (a short beep from the Web Audio API, no sound file), the
  buzz is the phone's own vibration, and a share card is a picture drawn by the app and handed to the phone's share
  sheet or saved.
- **Everything still works with no target set.** Tap Start with nothing chosen and it's today's free set.

## Decisions (decided 2026-10-07, all as recommended)

| # | Question | Decision |
| --- | --- | --- |
| P-D1 | **Who paces a set:** the partner does the target reps at a steady tempo and the set ends by itself when the target is reached (you can end it early with **Done**), or you tap a button per rep and the partner follows you? | **The partner paces.** One tap to start, none during the set, which is what a hand on a dumbbell allows. Done ends early and saves the reps done so far. A tap-per-rep mode can come later for people who want it. |
| P-D2 | **Tempo:** one setting for all strength exercises, in seconds per rep, default 2.4 (today's `REP_SECONDS`), chosen in Settings (Slow 3.5 · Normal 2.4 · Fast 1.8)? | **Yes.** Per-exercise tempo is a setting nobody adjusts. Cardio keeps its own speeds. |
| P-D3 | **Targets:** reps for strength (1–50) and minutes for cardio (1–60), chosen on the Exercises row next to the weight, remembered per exercise like the weight; **sets per exercise** 1–10, default 3. OK? | **Yes.** The same − / + steppers as v9's weight, so the row reads "3 × 12 · 10 kg · Start". |
| P-D4 | **Rest:** a countdown after each set, default 90 s for strength and 60 s after cardio, adjustable in Settings and with **+30 s** and **Skip** on the card. At the end: a beep and a buzz (each can be turned off in Settings). OK? | **Yes.** Those are the defaults most gym apps use. The buzz needs Android (iPhones don't allow web vibration), which matches your test devices. |
| P-D5 | **What the partner does while you rest:** stands by the machine in a resting pose (hands on hips, breathing), then steps back on when the next set starts. One new pose, no new model. OK? | **Yes.** It's the one piece of 3D in P1, and it's what makes rest feel like rest. |
| P-D6 | **The workout card** sits at the bottom of the Gym tab (above the tab bar), replacing the popup over the person's head on phones (the popup stays on desktop, where there's room). On other tabs, a one-line strip of it stays above the tab bar. OK? | **Yes.** Bottom of the screen is where a thumb is. Keeping the desktop popup avoids changing what already works there. |
| P-D7 | **A workout** (P2) starts when the first set of the day starts and ends when you tap **End workout** (or after 60 minutes with no set). Its summary: time, sets, total reps and kg lifted, distance, and any records. OK? | **Yes.** No "start workout" button to forget. The 60-minute rule closes a workout you walked away from. |
| P-D8 | **Records** (P2): heaviest set, most reps at a weight, longest cardio, per exercise, counted only from sets saved at the public link (not from edited sets). A record shows a short card and the partner's "well done" pose. OK? | **Yes.** Records from edits would let a typo set a record. |
| P-D9 | **Share card** (P2): a 1080 × 1080 picture drawn by the app (Amygo mark, date, the summary lines), offered to the phone's share sheet where it exists and downloaded otherwise. No photo of the 3D scene. OK? | **Yes.** A screenshot of the WebGL canvas is unreliable on phones and can be blank; drawn text and shapes always work. |
| P-D10 | **Exercise pages** (P3): muscles worked, 3–5 how-to steps and 2 tips per exercise, written into the catalog (no pictures). OK? | **Yes.** Seventeen exercises × a few lines is small, and the partner is the picture (P3 Block 2). |

---

## P1: Train with your partner

### Block 1: Sets with a target

**What you'll see:** on the Exercises list each row reads **3 × 12 · 10 kg · Start** for strength (sets × reps, then
the v9 weight) and **1 × 10 min · Start** for cardio. Tap Start: the partner steps onto the machine and does **exactly
12 reps** at the chosen tempo, and the card counts "7 of 12". At 12 the set ends by itself and is saved. **Done** ends
it early and saves what was done. Cardio ends at the target minutes. With no target set, nothing changes from today.

**How:**
- **Targets in a small store** (`src/exercises/targets.ts`): `targetFor(kind)` gives `{ sets, reps }` or `{ sets,
  minutes }`, remembered per exercise under `gym3d.targets` (the same safe storage as weights). Steppers on the row use
  the v9 weight stepper's code.
- **The activity carries its target** (`target` on `Activity`). The gym's rep clock is unchanged; a new check in the
  player's per-frame step (`stepOnto` already runs there) calls Stop when `repsDone` reaches the target or the cardio
  time is up, so the set ends through the same path as Stop and is logged by v7's watcher as it is today.
- **Tempo** (P-D2): `REP_SECONDS` becomes a value read from Settings; the animation and the machines already read it,
  so they follow the tempo with no change.
- The **set number** ("set 2 of 3") lives on the activity too, ready for Block 2.

**Tests (`src/exercises/targets.test.ts`, `src/interaction/sets.test.ts`):**

| ID | Checks |
| --- | --- |
| P1B1-T1 | Targets are remembered per exercise and clamped to their ranges; a row never seen defaults to 3 × 12 (strength) or 1 × 10 min (cardio) |
| P1B1-T2 | A set with target 12 ends by itself at exactly 12 reps and is saved with 12; with no target it runs until Stop |
| P1B1-T3 | Done at 7 of 12 saves 7 reps; cardio ends at the target minutes with the matching distance |
| P1B1-T4 | Changing the tempo changes the rep clock the person and machines use; the default is 2.4 s |
| P1B1-T5 | The row text: "3 × 12 · 10 kg" and "1 × 10 min" |

**Summary:** A set now has a target, the partner does exactly that many reps at your tempo, and the set ends and saves
itself.

### Block 2: Rest, then the next set

**What you'll see:** when a set ends, the card turns into a **rest countdown** ("Rest · 1:30 · set 2 of 3 next"), with
**+30 s**, **Skip** and **Finish**. The partner steps off and rests by the machine (P-D5). At zero: a short beep and a buzz,
and the next set starts by itself with the same weight and target. After the last set the card says "3 sets done" and
offers **Again** or **Finish**.

**How:**
- **A rest state** in the gym store (`resting: { kind, machineId, set, of, until, kg }`), set when a targeted set ends
  before its last set. A timer (not the render loop, which is off on other tabs) starts the next set at `until`.
- **The partner's rest pose:** one new pose in `poseMath.ts` (hands on hips, slight sway), used while `resting` is set.
- **Beep and buzz:** `src/shell/cues.ts`: a 150 ms sine beep from an `AudioContext` created on the first tap (browsers
  allow sound only after a tap), and `navigator.vibrate(200)` where it exists. Both behind Settings switches.
- **Rest length** per exercise type in Settings (P-D4); +30 s adds to `until`; Skip sets it to now.

**Tests:**

| ID | Checks |
| --- | --- |
| P1B2-T1 | After set 1 of 3, rest begins with the configured length and the next set starts at zero with the same kg and target |
| P1B2-T2 | +30 s extends the rest, Skip ends it now, Finish ends the exercise with no further set |
| P1B2-T3 | After the last set there is no rest and no next set; Again starts set 1 again |
| P1B2-T4 | The cues fire once at zero, and not at all when switched off or where vibration doesn't exist (no throw) |
| P1B2-T5 | The rest timer works while another tab is open (the gym's render loop is off there) |

**Summary:** Sets come in rounds: rest between them with a countdown, a beep and a buzz, the partner resting alongside,
and the next set starting by itself.

### Block 3: The workout card on the Gym tab

**What you'll see:** on a phone, a card at the bottom of the Gym tab: exercise, **set 2 of 3**, **7 / 12 reps** or the
rest countdown, the weight, and the buttons (**Done**, **Skip**, **+30 s**, **Change exercise**, **Finish**). The popup over
the person's head is gone on phones (it stays on desktop, P-D6). On every other tab, a one-line strip above the tab bar
shows the same state, and tapping it goes to the Gym tab. **Change exercise** opens the Exercises list with the current
exercise highlighted.

**How:**
- **One component, `src/shell/WorkoutCard.tsx`**, fed by the gym store and the rest state. `NowDoing` (Exercises page)
  and the header's "Doing…" line are replaced by the strip, so there's one source of these words.
- **Where it sits:** a fixed box above the tab bar on the Gym tab; the joystick moves up by its height so it isn't
  covered. On desktop (`hover: hover` and wide), the popup stays and the card isn't shown.
- **Change exercise** switches to the Exercises tab and scrolls the current row into view.

**Tests:**

| ID | Checks |
| --- | --- |
| P1B3-T1 | The card shows the exercise, set x of y, reps done / target or the rest countdown, and the weight, from the same text functions as the log |
| P1B3-T2 | The card's buttons call the same actions as the popup (Done, Skip, +30 s, Finish); Change exercise opens the list on the current row |
| P1B3-T3 | On other tabs the strip shows the one-line state and switching to Gym from it works |
| P1B3-T4 | With nothing in progress there is no card and no strip, and the joystick is back in place |
| P1B3-T5 | The header's "Doing…" line and `NowDoing` are gone, with no duplicate status text anywhere |

**Summary:** A workout card under your thumb on the Gym tab, and a strip of it on every other tab, so a whole workout can
be run without leaving the gym. That finishes P1.

---

## P2: A workout, not just sets (sketch; planned in detail after P1)

- **Block 1: Workouts.** Sets group into a workout (P-D7). Today's page gets a header for the open workout ("Started
  17:05 · 6 sets") and an **End workout** button; the summary card lists time, sets, reps, kg lifted, distance. Earlier
  days list their workouts. Saved under the same log (a `workoutId` on each set), so backups carry it.
- **Block 2: Records.** `src/log/records.ts` finds the bests per exercise; a new best shows a card ("New record · Bicep
  curls · 12 kg × 12") and the partner's "well done" pose (one new pose). History marks records with a small mark.
- **Block 3: Share card.** A 1080 × 1080 PNG drawn on a canvas by `src/share/card.ts` (P-D9): Amygo mark, date, the
  summary lines, records. Offered to the share sheet (`navigator.share` with files) or downloaded.

## P3: Learn from your partner (sketch)

- **Block 1: Exercise pages.** Each exercise's History page grows a **How to** section: muscles worked, steps and tips
  from the catalog (P-D10). The Exercises row shows the main muscle under the name.
- **Block 2: Show me.** A **Show me** button on the exercise page: the camera glides to the machine, the partner does
  three slow reps in a loop with the current step highlighted, then the camera returns. Uses the existing follow camera
  and a slower tempo; Back or Escape ends it.
- **Block 3: Find an exercise.** Chips on the Exercises list (Chest · Back · Legs · Shoulders · Arms · Cardio), a search
  box, and **Hide machines not in my gym**. Chips and the search read the catalog's muscle tags.

## Not in this plan

- **Tap-per-rep counting**, camera-based rep counting, or any sensor.
- **Timed supersets, drop sets, pyramid sets.** Targets are one number per exercise.
- **Body weight, measurements, photos, calories.**
- **Charts over months**, goals and streak rewards beyond what N1's Progress shows.
- **Multiplayer**: a real second person in the gym. The partner is yours alone.
- **A coach that writes routines for you.** Routines (N2) are yours to make.
- **iPhone vibration** (not allowed on the web), and a sound file (the beep is made by the browser).
