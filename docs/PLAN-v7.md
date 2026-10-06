# Gym 3D: workout log plan (v7)

The app remembers what you did. Every finished set is saved in this browser, a **Today** tab in the footer lists today's
sets, and the history is there to look back on two ways: **by day** (what did I do on Monday?) and **by exercise** (how
many curls did I manage last time?). No new machines, no backend, nothing sent anywhere.

It builds on two things that already exist:

- **v5 Block 1** (`src/build/layoutStorage.ts`): the safe way to use the browser's storage. Saving never throws, and
  saved data is checked entry by entry before it's trusted. The log uses the same pattern under its own key.
- **v6 Block 2** (`src/exercises/catalog.ts` and the Exercises tab): every exercise's name and kind, plus Start and Finish.
  A saved set is "this exercise from the catalog, these numbers", and the history pages reuse the list's Start.

## How this plan works

Same rules as before:

- **3 features per version, one feature per block.**
- **Each block has a test phase** (Vitest, each test checked to fail when the thing it guards is broken) that must pass
  before the next block starts. The Android check stays **optional** and is never marked passed unless done on the phone.
- **Each block ends with a 1–3 sentence summary.**
- **We stop after every block** and wait for your yes. A yes to this plan is not a yes to start building.
- v7 gets its own branch off `master` (`v7-workout-log`), merged when you say so.

## Where it sits

After v6 (done, on `master` since 2026-10-07). v7 adds no 3D work: the log is plain data and plain HTML pages, all in the
shell's own code (which v6 Block 3 keeps under its 60 KB budget). So it doesn't change how fast the gym runs on a phone,
and it doesn't need to wait for the v5 phone check (see D1).

## The starting point (2026-10-07)

| Measure | Now |
| --- | --- |
| Tests | 103 passing |
| Shell code (compressed), budget 60 KB | 10.3 KB |
| Footer tabs | Home, Exercises |
| What's saved in the browser | The furniture layout only (`gym3d.layout`) |

**Facts from the code that shape this plan:**
- **Every way an exercise ends goes through one function**, `stopExercise()`, called from six places: the in-gym Stop,
  E, walking away, entering build mode, Finish on the list, and starting a different exercise. Rather than touching all
  six, the log **watches the gym store** and saves a set whenever a session ends. One place, and a future seventh way of
  stopping is covered automatically.
- **Exercise times use the page's own clock** (`performance.now()`), which restarts at every reload. A saved set needs the
  real time of day, so each set is stamped with the wall clock when it's saved.
- **The gym has no weights to choose**: a set can only record what the gym measures (reps, time, distance, strokes).

## The order, and why

| Block | Feature | What it gives you |
| --- | --- | --- |
| 1 | Today tab | Finished sets are saved, survive a reload, and today's sets are listed in a third footer tab |
| 2 | History by day | Earlier days under today, each with its totals and its sets; clear the history |
| 3 | History by exercise | Each exercise's past sets, last time and best, opened from the Exercises list |

- **Saving first,** because both histories are only views of the saved sets. The Today tab is the smallest view that shows
  the saving works, and it settles the data format before anything else reads it.
- **By day second,** because it's the same list as Today, grouped by date. It also brings "clear history", which should
  exist before the log gets long.
- **By exercise last,** because it adds a page inside a tab (the first in the app) and touches the Exercises list, which is
  the most-used page. It's best built on a format that has already settled.

## Decisions (please answer before Block 1)

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Start v7 **now**, or wait until the v5 phone check (V5B3-T4) is done? | **Now.** v7 adds no 3D and stays inside the shell budget, so it can't change the phone numbers. The phone check can happen any time. |
| D2 | A set saves what the gym measures: **reps** (strength), **time and distance** (treadmill, bike), **strokes, time and distance** (rower). There are **no weights**, because the gym has no weight picker. OK? | **Yes.** A weight picker would be its own version. |
| D3 | The shortest set that counts: **at least 1 rep**, or **at least 10 seconds** on treadmill, bike and rower. Anything shorter is a false start and isn't saved. OK? | **Yes.** Otherwise every mis-tap on Start leaves a "0 reps" set behind. |
| D4 | Walk 2 minutes then switch to Run for 3: save **two sets** (Walk 2:00, Run 3:00) or **one**? | **Two**, one per pace. "History by exercise" then means what it says; the day's totals still add both. |
| D5 | Where it lives: a **third footer tab, Today**, with earlier days below today's sets. Each exercise's history opens from its row in the **Exercises** list. OK? | **Yes.** Three tabs fit a phone footer. A separate History tab would split one list in two. |
| D6 | How much is kept: everything, **up to 5,000 sets** (about 500 KB; past that the oldest go first), in **this browser only**, with a **Clear history** button that asks first. OK? | **Yes.** 5,000 sets is years of use, and the cap keeps storage from ever filling up. |
| D7 | Which day a set belongs to: the **day it finished**, by the device's clock (a set finished at 00:05 is the new day's). OK? | **Yes.** It's what you'd write in a paper log. |

---

## v7: A workout log

### Block 1: Today tab

**What you'll see:** a third tab in the footer, **Today**. Do 12 curls and stop (any way you like: Stop, E, walking away,
Finish on the list), and Today lists "Bicep curls · 12 reps · 0:29", with the time you finished. Walk 2 minutes then run 3,
and you get two rows (per D4). At the top: "4 sets · 9 min". Reload the page and it's all still there. Each row has a
**Remove** button for the set you didn't mean to save. With nothing done yet: "No sets yet today. Start one from
Exercises."

**How:**
- **A set** is a small record: which exercise (a catalog kind), when it finished (wall clock), how long it lasted, and its
  numbers (reps, or meters, or strokes and meters), each worked out with the same functions that drive the popup's
  counters (`repsDone`, `metersSoFar`, `strokesSince`), so the log never disagrees with what you saw.
- **Saving in one place:** `src/log/` watches the gym store. When a session ends, or its pace changes (D4), the part that
  just finished becomes a set, if it passes D3. A person still stepping onto a machine hasn't started, so that's never
  saved.
- **Storage** follows `layoutStorage.ts`: key `gym3d.log`, a version number, reads and writes wrapped so blocked or full
  storage never breaks the app (sets are then kept until the page closes). On load, each saved set is checked on its own:
  an unknown exercise, a missing number or a damaged entry is skipped, and the rest are kept.
- **The tab store** gains `today`. The gym stops drawing there, as on Exercises (v6 Block 1's `frameloopFor`).
- The log code imports nothing from three.js, so it stays in the shell file and under the 60 KB budget.

**Tests:**

| ID | Checks |
| --- | --- |
| V7B1-T1 | Stopping after 12 curls saves one set with the right kind, reps, length and finish time; each of the six ways of stopping saves exactly one |
| V7B1-T2 | Walk 60 s, switch to Run, run 60 s, stop: two sets (Walk, Run) whose distances add up to the popup's total |
| V7B1-T3 | Not saved: 0 reps, 9 s of walking, and an exercise stopped before the person reached the machine |
| V7B1-T4 | Saved sets come back after a reload; damaged, old-version or unknown entries are skipped one by one; blocked storage doesn't crash and still lists the session's sets |
| V7B1-T5 | Today shows only today's sets (one finished 23:59 yesterday is not there), newest first, with the right totals |
| V7B1-T6 | Remove takes a set out, and it stays out after a reload |
| V7B1-T7 | The log code imports nothing from three.js or the 3D code (as V6B2-T6), and the shell stays under budget |

**Visual check:** do three different exercises (stopping each a different way), open Today: three rows with the same
numbers the popup showed. Reload: still three. Remove one, reload: two. At phone width, the footer's three tabs fit and
read clearly.

**Summary:** _(written when the block is done)_

### Block 2: History by day

**What you'll see:** under today's sets on the Today tab, **Earlier**: one row per day you trained, newest first,
"Yesterday · 6 sets · 14 min", then "Mon 5 Oct · 3 sets · 8 min", and so on. Each row shows what you did in a line
("Bicep curls 3 × 12 · Walk 1.2 km"), and tapping it opens that day's sets. Days you didn't train aren't listed. At the
very bottom: **Clear history**, which asks before deleting anything.

**How:**
- **Grouping** is a plain function from sets to days, by the local calendar day each set finished (D7). Day keys come from
  the local year, month and day, not from counting 24-hour blocks, so a day when the clocks change still counts as one day.
- **Day labels:** Today, Yesterday, the weekday for the last week, then the date ("5 Oct", with the year once it isn't this
  year).
- **Day totals:** number of sets, total time, sets and reps per strength exercise, distance per cardio exercise.
- **Clear history** works like Reset layout (v5 Block 1): it asks first, then empties the log and its saved copy.
- **The 5,000-set cap** (D6) applies when saving: past it, the oldest set is dropped.

**Tests:**

| ID | Checks |
| --- | --- |
| V7B2-T1 | Sets group into local days, newest day first; days without sets don't appear |
| V7B2-T2 | A set finished at 00:05 belongs to the new day; a day when the clocks change is still one group (the tests use local dates, so they pass in any time zone) |
| V7B2-T3 | Day totals: sets, total time, reps per strength exercise, distance per cardio exercise |
| V7B2-T4 | Labels at a fixed "now": Today, Yesterday, a weekday within the week, a date before that, and the year from another year |
| V7B2-T5 | Clear history empties the list and the saved copy; cancelling leaves both untouched |
| V7B2-T6 | Saving set 5,001 drops the oldest; 5,000 sets still group in under 50 ms |

**Visual check:** with a few days of sets (made by a test helper that writes dated sets into storage, since waiting days
isn't practical), the Earlier list reads right at phone width, a day opens to its sets, and Clear history asks, then
empties it.

**Summary:** _(written when the block is done)_

### Block 3: History by exercise

**What you'll see:** on the Exercises list, under each exercise you've done before, a small line: "Last: 12 reps ·
Yesterday". Each row gets a **History** button that opens that exercise's page: **Last time**, **Best** (most reps; longest
distance on the treadmill and bike; fastest pace per 500 m on the rower), and every set, newest first. There's a **Start**
button on the page too. **Back** (the button on the page, or Android's back gesture) returns to the list.

**How:**
- **Per-exercise history** is another plain function over the saved sets: filter by kind, newest first, plus "last" and
  "best". Walk and Run are separate exercises (D4).
- **A page inside a tab** (the first one in the app): the tab store remembers which exercise's history is open. Leaving
  the tab closes it.
- **Android's back gesture:** opening a history page adds an entry to the browser's history, so back closes the page
  instead of leaving the app. That's the one place the app touches browser history; there's still no router.
- **Start** on the page is the list's own Start (v6 Block 2), so it can't behave differently.

**Tests:**

| ID | Checks |
| --- | --- |
| V7B3-T1 | An exercise's history has only its own sets, newest first (Walk and Run are kept apart) |
| V7B3-T2 | Best is the most reps, the longest distance, or the fastest rower pace, as the exercise needs; on a tie, the earlier set |
| V7B3-T3 | The "Last:" line under each exercise is right, and missing for an exercise never done |
| V7B3-T4 | Browser back (a `popstate`) closes the history page and stays on Exercises; switching tabs closes it too |
| V7B3-T5 | Start on a history page starts that exercise exactly as the list's Start does |
| V7B3-T6 | The Exercises tab still renders all 17 Start buttons, and a history page with no sets shows its empty message |

**Visual check:** do curls twice with different counts, open their History: Last and Best are right and both sets are
listed. Start from the page goes to Home with the person curling. On the phone (optional), the back gesture closes the page.

**Summary:** _(written when the block is done)_

---

## Not in this plan

- **Weights** (kg), and a picker to choose them (see D2). Its own version, if wanted.
- **Editing** a saved set's numbers; Remove is the only correction.
- **Export or import** (a file of your log), **accounts, sync**, or anything sent to a server.
- **Charts.** History is text and numbers; a chart library would weigh more than the whole shell.
- **Goals, streaks, reminders.**
- **Keeping an exercise in progress across a reload.** A reload mid-set loses that set, as today.
